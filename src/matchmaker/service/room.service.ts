import { Injectable } from "@nestjs/common";
import { Room } from "@/matchmaker/entity/room";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly datasource: DataSource,
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
}
