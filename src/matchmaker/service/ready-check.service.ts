import { Injectable } from "@nestjs/common";
import { Room } from "@/matchmaker/entity/room";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { ReadyCheckStartedEvent } from "@/gateway/events/ready-check-started.event";
import { ACCEPT_GAME_TIMEOUT } from "@/gateway/shared-types/timings";
import { PlayerDeclinedGameEvent } from "@/gateway/events/mm/player-declined-game.event";
import { PlayerId } from "@/gateway/shared-types/player-id";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { EventBus } from "@nestjs/cqrs";
import { PartyService } from "@/matchmaker/service/party.service";

@Injectable()
export class ReadyCheckService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
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

    setTimeout(() => {
      this.finishReadyCheck(room.id);
    }, ACCEPT_GAME_TIMEOUT);

    return room;
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

    await this.roomRepository.update(
      {
        id: roomId,
      },
      { readyCheckFinishedAt: new Date() },
    );

    const accepted = room.players.filter(
      (t) => t.readyState === ReadyState.READY,
    );
    const notAccepted = room.players.filter(
      (t) => t.readyState !== ReadyState.READY,
    );

    // Delete room, not needed anymore
    await this.roomRepository.delete({ id: room.id });

    if (notAccepted.length > 0) {
      await this.datasource.transaction(async (em) => {});

      // Report bad piggies
      for (const plr of notAccepted) {
        this.ebus.publish(
          new PlayerDeclinedGameEvent(
            plr.steamId,
            room.lobbyType,
          ),
        );
      }

      // Return good piggies to their queues
      const goodPartyIds = new Set<string>();
      accepted.forEach((plr) => goodPartyIds.add(plr.partyId));
      await this.partyService.returnToQueues(Array.from(goodPartyIds));
    }
  }
}
