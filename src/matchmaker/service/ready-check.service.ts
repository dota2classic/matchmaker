import { Injectable } from "@nestjs/common";
import { Room } from "@/matchmaker/entity/room";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { ReadyCheckStartedEvent } from "@/gateway/events/ready-check-started.event";
import { PlayerDeclinedGameEvent } from "@/gateway/events/mm/player-declined-game.event";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
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

@Injectable()
export class ReadyCheckService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(PlayerInRoom)
    private readonly playerInRoomRepository: Repository<PlayerInRoom>,
    private readonly datasource: DataSource,
    private readonly ebus: EventBus,
    private readonly partyService: PartyService,
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

  @Cron(CronExpression.EVERY_SECOND)
  public async expireReadyChecks(readyCheckDuration: string = "1m") {
    const expiredRooms = await this.roomRepository
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.players", "players")
      .where(
        "r.ready_check_started_at + :ready_check_duration::interval < now()",
        { ready_check_duration: readyCheckDuration },
      )
      .getMany();

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

    await this.roomRepository.update(
      {
        id: roomId,
      },
      { readyCheckFinishedAt: new Date() },
    );

    // Delete room, not needed anymore
    await this.roomRepository.delete({ id: room.id });

    const [accepted, declined] = this.readyCheckResult(room);

    if (declined.length > 0) {
      await this.onFailedRoom(room, accepted, declined);
    } else {
      await this.onSucceededRoom(room);
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
        new PlayerDeclinedGameEvent(plr.steamId, room.lobbyType),
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

  private async onSucceededRoom(room: Room) {
    // We are done here! just emit event
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
