import { Injectable } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { QueryBus } from "@nestjs/cqrs";
import { DataSource, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { canQueueMode } from "@/gateway/shared-types/match-access-level";
import {
  GameserverPlayerSummaryDto,
  PlayerApi,
} from "@/generated-api/gameserver";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";

@Injectable()
export class PlayerService {
  constructor(
    private readonly qbus: QueryBus,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    private readonly playerApi: PlayerApi,
    private readonly ds: DataSource,
  ) {}

  async preparePartyForQueue(party: Party, modes: MatchmakingMode[]) {
    const plrs = party.players.map((it) => it.steamId);

    const resolvedScores = await Promise.all(
      plrs.map(async (steamId) => {
        const [summary, ban, dodgeList] = await Promise.combine([
          this.playerApi.playerControllerPlayerSummary(steamId),
          this.playerApi.playerControllerBanInfo(steamId),
          this.playerApi.playerControllerGetDodgeList(steamId),
        ]);

        if (summary.session) {
          throw new Error("Can't queue while in game");
        }

        if (ban.isBanned) {
          throw new Error("Can't queue when banned");
        }

        // highroom tmp check
        this.assertHighroom(modes, summary);

        if (
          modes.findIndex(
            (mode) => !canQueueMode(summary.accessLevel, mode),
          ) !== -1
        ) {
          throw new Error("Can't queue this mode");
        }

        const score = PlayerService.getPlayerScore(
          summary.season.mmr,
          0.5,
          summary.season.games,
        );

        return {
          score,
          dodgeList: dodgeList.map((t) => t.steamId),
          steamId,
        };
      }),
    );

    const dodgeList: string[] = resolvedScores.reduce(
      (a, b) => a.concat(b.dodgeList),
      [] as string[],
    );

    party.players.forEach((plr) => {
      plr.score =
        resolvedScores.find((t) => t.steamId === plr.steamId)?.score || 0;
    });

    party.score = resolvedScores.reduce((a, b) => a + b.score, 0);
    party.dodgeList = dodgeList;

    await this.ds.transaction(async (tx) => {
      await tx.save(Party, party);
      await tx.save(PlayerInParty, party.players);
    });

    return party;
  }

  private assertHighroom(
    modes: MatchmakingMode[],
    summary: GameserverPlayerSummaryDto,
  ) {
    if (!modes.includes(MatchmakingMode.HIGHROOM)) return;

    if (summary.overall.games < 30) {
      throw "Not enough games to queue";
    }
  }

  public static getPlayerScore = (
    mmr: number,
    recentWinrate: number,
    gamesPlayed: number,
  ) => {
    // B2 * ((MIN(D2, 90) + 10) / 100)* (C2 + 0.5)

    // const EDUCATION_THRESHOLD = 3;
    // Education factor: the less games you have, the less score you will end up with
    // const educationFactor =
    //   (Math.min(gamesPlayed, EDUCATION_THRESHOLD - 1) + 1) /
    //   EDUCATION_THRESHOLD;

    // Experience factor: if you have a lot of games, its diminishing returns, so we use log
    const experienceFactor = 1 + 1 / (1 + Math.exp(-(gamesPlayed / 10))) / 5;

    // Winrate factor: if you are losing recently, u are worse that ur mmr
    const BASELINE_WINRATE = 0.5;
    const winrateFactor = recentWinrate + BASELINE_WINRATE;

    return mmr * winrateFactor * experienceFactor;
  };
}
