import { Injectable, Logger, Optional } from "@nestjs/common";
import { Room } from "@/matchmaker/entity/room";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { ReadyCheckStartedEvent } from "@/gateway/events/ready-check-started.event";
import {
  DeclineReason,
  PlayerDeclinedGameEvent,
} from "@/gateway/events/mm/player-declined-game.event";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { EventBus } from "@nestjs/cqrs";
import { PartyService } from "@/matchmaker/service/party.service";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { MatchPlayer, RoomReadyEvent } from "@/gateway/events/room-ready.event";
import { PlayerId } from "@/gateway/shared-types/player-id";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ReadyStateUpdatedEvent } from "@/gateway/events/ready-state-updated.event";
import { RoomNotReadyEvent } from "@/gateway/events/room-not-ready.event";
import * as assert from "assert";
import { QueueStatisticsService } from "@/matchmaker/service/queue-statistics.service";

import { PlayerService } from "@/matchmaker/service/player.service";

@Injectable()
export class ReadyCheckService {
  private readonly logger = new Logger(ReadyCheckService.name);
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(PlayerInRoom)
    private readonly playerInRoomRepository: Repository<PlayerInRoom>,
    private readonly datasource: DataSource,
    private readonly ebus: EventBus,
    private readonly partyService: PartyService,
    private readonly players: PlayerService,
    @Optional() private readonly queueStatistics?: QueueStatisticsService,
  ) {}

  async startReadyCheck(room: Room) {
    room = await this.datasource.transaction(async (em) => {
      room.players.forEach((plr) => (plr.readyState = ReadyState.PENDING));
      await em.save(room.players);

      room.readyCheckStartedAt = new Date();
      return em.save(room);
    });
    this.ebus.publish(
      new ReadyCheckStartedEvent(
        room.id,
        room.lobbyType,
        room.players.map((plr) => ({
          steamId: plr.steamId,
          readyState: plr.readyState,
        })),
      ),
    );

    return room;
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  public async expireReadyChecks(readyCheckDuration: string = "1m") {
    this.logger.log("REady check expire");
    const expiredRooms = await this.roomRepository
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.players", "players")
      .where(
        "r.ready_check_started_at + :ready_check_duration::interval < now()",
        { ready_check_duration: readyCheckDuration },
      )
      .andWhere("r.ready_check_finished_at is null")
      .getMany();

    if (expiredRooms.length > 0) {
      this.logger.log(`Expiring ${expiredRooms.length} rooms`);
    }

    await Promise.all(
      expiredRooms.map(async (room) => {
        await this.timeoutPendingReadyChecks(room.id);
        await this.finishReadyCheck(room.id);
      }),
    );
  }

  public async submitReadyCheck(
    roomId: string,
    steamId: string,
    state: ReadyState,
  ) {
    const room = await this.roomRepository.findOneOrFail({
      where: { id: roomId },
      relations: ["players"],
    });

    if (room.readyCheckFinishedAt) {
      // It's already finished
      return;
    }

    const plr = room.players.find((plr) => plr.steamId === steamId);
    if (!plr) return;

    plr.readyState = state;
    await this.playerInRoomRepository.save(plr);
    await this.readyStateUpdate(room);

    if (state === ReadyState.DECLINE) {
      // End ready check
      await this.onExplicitDecline(room);
    }

    await this.checkIsRoomReady(room);
  }

  public async finishReadyCheck(roomId: string) {
    const room = await this.roomRepository.findOneOrFail({
      where: { id: roomId },
      relations: ["players"],
    });
    if (room.readyCheckFinishedAt) {
      // It's already finished
      return;
    }
    assert(
      room.players.filter((t) => t.readyState === ReadyState.PENDING).length ===
        0,
      "Can't call finishReadyCheck when ready check is not resolved yet",
    );

    this.logger.log(`Finishing ready check for room ${roomId}`);

    const claimed = await this.roomRepository.update(
      {
        id: roomId,
        readyCheckFinishedAt: IsNull(),
      },
      { readyCheckFinishedAt: new Date() },
    );

    if (!claimed.affected) return;

    const [accepted, declined] = this.readyCheckResult(room);
    const eligible = declined.length === 0 && (await this.verifyEligibility(room));

    // Delete room, not needed anymore
    await this.roomRepository.delete({ id: room.id });

    await this.queueStatistics?.recordReadyCheckResult(
      room.id,
      room.players,
      room.readyCheckStartedAt,
    );

    if (declined.length > 0) {
      await this.onFailedRoom(room, accepted, declined);
    } else if (eligible) {
      await this.onSucceededRoom(room);
    } else {
      const partyIds = [...new Set(room.players.map((player) => player.partyId))];
      await this.partyService.returnToQueues(partyIds);
      this.ebus.publish(new RoomNotReadyEvent(
        room.id,
        room.players.map((player) => player.steamId),
      ));
    }
  }

  public async timeoutPendingReadyChecks(roomId: string): Promise<Room> {
    const room = await this.roomRepository.findOneOrFail({
      where: { id: roomId },
      relations: ["players"],
    });

    const pendingPlayers = room.players.filter(
      (it) => it.readyState === ReadyState.PENDING,
    );

    pendingPlayers.forEach((plr) => (plr.readyState = ReadyState.TIMEOUT));
    await this.playerInRoomRepository.save(pendingPlayers);

    return room;
  }

  private async checkIsRoomReady(room: Room): Promise<boolean> {
    const readyPlayers = room.players.filter(
      (t) => t.readyState === ReadyState.READY,
    );

    const declinedPlayers = room.players.filter(
      (t) =>
        t.readyState === ReadyState.DECLINE ||
        t.readyState === ReadyState.TIMEOUT,
    );

    if (readyPlayers.length === room.players.length) {
      await this.finishReadyCheck(room.id);
      return true;
    } else if (declinedPlayers.length > 0) {
      await this.finishReadyCheck(room.id);
      return true;
    }
    return false;
  }

  private async onFailedRoom(
    room: Room,
    accepted: PlayerInRoom[],
    notAccepted: PlayerInRoom[],
  ) {
    // Report bad piggies
    for (const plr of notAccepted) {
      this.ebus.publish(
        new PlayerDeclinedGameEvent(
          plr.steamId,
          room.lobbyType,
          plr.readyState === ReadyState.TIMEOUT
            ? DeclineReason.TIMEOUT
            : DeclineReason.DECLINED,
        ),
      );
    }

    // Return good piggies to their queues
    const goodPartyIds = new Set<string>(
      room.players.flatMap((it) => it.partyId),
    );
    notAccepted.forEach((plr) => goodPartyIds.delete(plr.partyId));
    await this.partyService.returnToQueues(Array.from(goodPartyIds));

    await this.ebus.publish(
      new RoomNotReadyEvent(
        room.id,
        accepted.concat(notAccepted).map((it) => it.steamId),
      ),
    );
  }

  private async onExplicitDecline(room: Room) {
    const pendingPlayers = room.players.filter(
      (it) => it.readyState === ReadyState.PENDING,
    );

    pendingPlayers.forEach((plr) => (plr.readyState = ReadyState.READY));
    await this.playerInRoomRepository.save(pendingPlayers);
  }

  private async readyStateUpdate(room: Room) {
    this.ebus.publish(
      new ReadyStateUpdatedEvent(
        room.id,
        room.lobbyType,
        room.players.map((plr) => ({
          steamId: plr.steamId,
          readyState: plr.readyState,
        })),
      ),
    );
  }

  private async verifyEligibility(room: Room): Promise<boolean> {
    try {
      return (await Promise.all(room.players.map((player) =>
        this.players.canPlayQueuedMode(player.steamId, room.lobbyType),
      ))).every(Boolean);
    } catch (error) {
      this.logger.warn("Could not verify ban status for a ready room", error);
      return false;
    }
  }

  private async onSucceededRoom(room: Room) {
    this.ebus.publish(
      new RoomReadyEvent(
        room.id,
        room.lobbyType,
        room.players.map(
          (plr) =>
            new MatchPlayer(new PlayerId(plr.steamId), plr.team, plr.partyId),
        ),
        Dota2Version.Dota_684,
      ),
    );

    // Update parties: set enterQueueTime to null
    await this.partyService.resetQueueTimer(
      room.players.map((it) => it.partyId),
    );
  }

  private readyCheckResult(room: Room): [PlayerInRoom[], PlayerInRoom[]] {
    const accepted = room.players.filter(
      (t) =>
        t.readyState === ReadyState.READY ||
        t.readyState === ReadyState.PENDING,
    );
    const notAccepted = room.players.filter(
      (t) =>
        t.readyState === ReadyState.DECLINE ||
        t.readyState === ReadyState.TIMEOUT,
    );
    return [accepted, notAccepted];
  }
}
