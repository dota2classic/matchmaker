import { Injectable } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { PlayerService } from "@/matchmaker/service/player.service";

@Injectable()
export class PartyService {
  constructor(
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(PlayerInParty)
    private readonly playerInPartyRepository: Repository<PlayerInParty>,
    private readonly datasource: DataSource,
    private readonly playerService: PlayerService,
  ) {}

  public async getOrCreatePartyOf(steamId: string) {
    let party = await this.partyRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.players", "players")
      .leftJoin("p.players", "filterplayers")
      .where("filterplayers.steam_id = :steamId", { steamId: steamId })
      .getOne();


    console.log(JSON.stringify(party))
    if (!party) {
      party = await this.createParty(steamId);
    }
    return party;
  }

  private async createParty(
    leader: string,
    playerIds: string[] = [leader],
  ): Promise<Party> {
    const resolvedPlayers = await Promise.all(
      playerIds.map((pid) => this.playerService.resolvePlayer(pid)),
    );
    return this.datasource.transaction(async (em) => {
      const p = await em.save(new Party());

      p.players = await em.save(
        resolvedPlayers.map(
          (plr) =>
            new PlayerInParty(
              plr.steamId,
              p.id,
              plr.balanceScore,
              plr.steamId === leader,
            ),
        ),
      );
      return p;
    });
  }
}
