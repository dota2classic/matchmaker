import { Injectable } from "@nestjs/common";
import { Room } from "@/matchmaker/entity/room";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { ACCEPT_GAME_TIMEOUT } from "@/gateway/shared-types/timings";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { EventBus } from "@nestjs/cqrs";
import { PlayerDeclinedGameEvent } from "@/gateway/events/mm/player-declined-game.event";
import { PlayerId } from "@/gateway/shared-types/player-id";

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly datasource: DataSource,
    private readonly ebus: EventBus,
  ) {}

  public createRoom(balance: GameBalance): Promise<Room> {
    return this.datasource.transaction(async (em) => {
      let room = new Room(balance.mode);
      room = await em.save(room);

      const parties = balance.left.concat(balance.right);

      room.players = await em.save(
        parties
          .flatMap((party) => party.players)
          .map(
            (player) =>
              new PlayerInRoom(room.id, player.partyId, player.steamId),
          ),
      );

      return room;
    });
  }

  private async startReadyCheck(room: Room) {
    await this.datasource.transaction(async (em) => {
      room.players.forEach((plr) => (plr.readyState = ReadyState.PENDING));
      await em.save(room.players);
    });
    setTimeout(() => {
      this.finishReadyCheck(room.id);
    }, ACCEPT_GAME_TIMEOUT);
  }

  private async finishReadyCheck(roomId: string) {
    const room = await this.roomRepository.findOneOrFail({
      where: { id: roomId },
      relations: ["players"],
    });

    const accepted = room.players.filter(
      (t) => t.readyState === ReadyState.READY,
    );
    const notAccepted = room.players.filter(
      (t) => t.readyState !== ReadyState.READY,
    );


    if(notAccepted.length > 0) {
      // Report bad piggies

      // Return good piggies to their queues


      for (const plr of notAccepted) {
        this.ebus.publish(
          new PlayerDeclinedGameEvent(new PlayerId(plr.steamId), room.lobbyType),
        );
      }

    }

  }


}
