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
import { PartyService } from "@/matchmaker/service/party.service";
import { ReadyCheckStartedEvent } from "@/gateway/events/ready-check-started.event";

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly datasource: DataSource,
    private readonly ebus: EventBus,
    private readonly partyService: PartyService,
  ) {}

  public async createRoom(balance: GameBalance): Promise<Room> {
    return await this.datasource.transaction(async (em) => {
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


}
