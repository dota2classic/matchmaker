import { Injectable } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { PlayerService } from "@/matchmaker/service/player.service";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";

@Injectable()
export class PartyService {
  constructor(
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(PlayerInParty)
    private readonly playerInPartyRepository: Repository<PlayerInParty>,
    private readonly datasource: DataSource,
    private readonly playerService: PlayerService,
    private readonly queue: DbMatchmakingQueue,
  ) {}

  public async getOrCreatePartyOf(steamId: string) {
    let party = await this.partyRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.players", "players")
      .leftJoin("p.players", "filterplayers")
      .where("filterplayers.steam_id = :steamId", { steamId: steamId })
      .getOne();

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

  async returnToQueues(goodPartyIds: string[]) {
    const parties = await this.partyRepository.find({
      where: {
        id: In(goodPartyIds),
      },
    });

    await Promise.all(parties.map((party) => this.queue.enterQueue(party)));
  }
}
