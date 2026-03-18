import { Injectable } from "@nestjs/common";
import { Room } from "@/matchmaker/entity/room";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { EventBus } from "@nestjs/cqrs";
import { PartyService } from "@/matchmaker/service/party.service";
import { DotaTeam } from "@/gateway/shared-types/dota-team";

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly datasource: DataSource,
    private readonly ebus: EventBus,
    private readonly partyService: PartyService,
  ) {}

  public async findRoomOf(steamId: string): Promise<Room | null> {
    return this.roomRepository
      .createQueryBuilder("r")
      .leftJoinAndSelect("r.players", "players")
      .leftJoin("r.players", "filterplayers")
      .where("filterplayers.steam_id = :steamId", { steamId: steamId })
      .getOne();
  }

  public async createRoom(balance: GameBalance): Promise<Room> {
    // Special case: party of 2 matched against itself (solomid 1v1)
    if (
      balance.left.length === 1 &&
      balance.right.length === 1 &&
      balance.left[0].id === balance.right[0].id
    ) {
      return this.createIntraPartyRoom(balance);
    }

    return await this.datasource.transaction(async (em) => {
      let room = new Room(balance.mode);
      room = await em.save(room);

      const parties = balance.left.concat(balance.right);

      const buf =
        Math.random() > 0.5
          ? [DotaTeam.RADIANT, DotaTeam.DIRE]
          : [DotaTeam.DIRE, DotaTeam.RADIANT];

      const teamLookup = new Map<string, DotaTeam>();
      balance.left.forEach((party) => teamLookup.set(party.id, buf[0]));
      balance.right.forEach((party) => teamLookup.set(party.id, buf[1]));

      room.players = await em.save(
        parties
          .flatMap((party) => party.players)
          .map(
            (player) =>
              new PlayerInRoom(
                room.id,
                player.partyId,
                player.steamId,
                teamLookup.get(player.partyId)!,
              ),
          ),
      );

      return room;
    });
  }

  private async createIntraPartyRoom(balance: GameBalance): Promise<Room> {
    return await this.datasource.transaction(async (em) => {
      let room = new Room(balance.mode);
      room = await em.save(room);

      const party = balance.left[0];
      const [team1, team2] =
        Math.random() > 0.5
          ? [DotaTeam.RADIANT, DotaTeam.DIRE]
          : [DotaTeam.DIRE, DotaTeam.RADIANT];

      room.players = await em.save([
        new PlayerInRoom(room.id, party.id, party.players[0].steamId, team1),
        new PlayerInRoom(room.id, party.id, party.players[1].steamId, team2),
      ]);

      return room;
    });
  }
}
