import { Injectable } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { QueryBus } from "@nestjs/cqrs";
import { GetSessionByUserQuery } from "@/gateway/queries/GetSessionByUser/get-session-by-user.query";
import { GetSessionByUserQueryResult } from "@/gateway/queries/GetSessionByUser/get-session-by-user-query.result";
import { GetPlayerInfoQuery } from "@/gateway/queries/GetPlayerInfo/get-player-info.query";
import { GetPlayerInfoQueryResult } from "@/gateway/queries/GetPlayerInfo/get-player-info-query.result";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import { PlayerId } from "@/gateway/shared-types/player-id";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { canQueueMode } from "@/gateway/shared-types/match-access-level";

@Injectable()
export class PlayerService {
  constructor(
    private readonly qbus: QueryBus,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
  ) {}

  async preparePartyForQueue(party: Party, modes: MatchmakingMode[]) {
    const plrs = party.players.map((it) => it.steamId);

    const resolvedScores = await Promise.all(
      plrs.map(async (steamId) => {
        const isInGame = await this.qbus.execute<
          GetSessionByUserQuery,
          GetSessionByUserQueryResult
        >(new GetSessionByUserQuery(new PlayerId(steamId)));

        //
        if (isInGame.serverUrl) {
          throw new Error("Can't queue while in game");
        }

        const mmr = await this.qbus.execute<
          GetPlayerInfoQuery,
          GetPlayerInfoQueryResult
        >(new GetPlayerInfoQuery(new PlayerId(steamId), Dota2Version.Dota_684));

        if (mmr.banStatus.isBanned) {
          throw new Error("Can't queue when banned");
        }

        if (
          modes.findIndex((mode) => !canQueueMode(mmr.accessLevel, mode)) !== -1
        ) {
          throw new Error("Can't queue this mode");
        }

        const score = PlayerService.getPlayerScore(
          mmr.mmr,
          mmr.recentWinrate,
          mmr.gamesPlayed,
        );

        return {
          score,
          dodgeList: mmr.dodgeList,
        };
      }),
    );

    const dodgeList: string[] = resolvedScores.reduce(
      (a, b) => a.concat(b.dodgeList),
      [] as string[],
    );

    party.score = resolvedScores.reduce((a, b) => a + b.score, 0);
    party.dodgeList = dodgeList;
    await this.partyRepository.save(party);

    return party;
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
    const experienceFactor = Math.log10(
      Math.min(500, Math.max(10, gamesPlayed)),
    );

    // Winrate factor: if you are losing recently, u are worse that ur mmr
    const BASELINE_WINRATE = 0.5;
    const winrateFactor = recentWinrate + BASELINE_WINRATE;

    return mmr * winrateFactor * experienceFactor;
  };
}
