import { Inject, Injectable, Logger } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { QueryBus } from "@nestjs/cqrs";
import { DataSource, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import {
  canQueueMode,
  MatchAccessLevel,
} from "@/gateway/shared-types/match-access-level";
import { ApiClient } from "@dota2classic/gs-api-generated/dist/module";
import { PlayerSummaryDto } from "@dota2classic/gs-api-generated";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { ClientProxy } from "@nestjs/microservices";
import { GetUserInfoQuery } from "@/gateway/queries/GetUserInfo/get-user-info.query";
import { GetUserInfoQueryResult } from "@/gateway/queries/GetUserInfo/get-user-info-query.result";
import { PlayerId } from "@/gateway/shared-types/player-id";
import { Role } from "@/gateway/shared-types/roles";

@Injectable()
export class PlayerService {
  private logger = new Logger(PlayerService.name);

  constructor(
    private readonly qbus: QueryBus,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    private readonly playerApi: ApiClient,
    private readonly ds: DataSource,
    @Inject("RedisQueue") private readonly redisEventQueue: ClientProxy,
  ) {}

  private async getIsSubscriber(steamId: string): Promise<boolean> {
    const userInfo = await this.redisEventQueue
      .send<
        GetUserInfoQueryResult,
        GetUserInfoQuery
      >(GetUserInfoQuery.name, new GetUserInfoQuery(new PlayerId(steamId)))
      .toPromise();
    this.logger.log(
      `Resolve subscription status of ${steamId}: ${userInfo?.roles}`,
    );

    return userInfo ? userInfo.roles.includes(Role.OLD) : false;
  }

  async preparePartyForQueue(party: Party, modes: MatchmakingMode[]) {
    const plrs = party.players.map((it) => it.steamId);

    const resolvedScores = await Promise.all(
      plrs.map(async (steamId) => {
        const [summary, ban, dodgeList, isSubscriber] = await Promise.combine([
          this.playerApi.player
            .playerControllerPlayerSummary(steamId)
            .then((r) => r.data),
          this.playerApi.player
            .playerControllerBanInfo(steamId)
            .then((r) => r.data),
          this.playerApi.player
            .playerControllerGetDodgeList({ steamId })
            .then((r) => r.data),
          this.getIsSubscriber(steamId),
        ]);

        if (summary.session) {
          throw new Error("Can't queue while in game");
        }

        if (ban.isBanned && modes.includes(MatchmakingMode.UNRANKED)) {
          throw new Error("Can't queue when banned");
        }

        if (
          ban.isBanned &&
          new Date(ban.bannedUntil).getTime() >
            Date.now() + 1000 * 60 * 60 * 24 * 365
        ) {
          // It's perma ban
          throw new Error("Perma banned");
        }

        // highroom tmp check
        this.assertHighroom(modes, summary);

        if (
          modes.findIndex(
            (mode) =>
              !canQueueMode(
                summary.accessLevel as unknown as MatchAccessLevel,
                mode,
              ),
          ) !== -1
        ) {
          throw new Error("Can't queue this mode");
        }

        const score = PlayerService.getPlayerScore(
          summary.season.mmr,
          0.5,
          summary.season.games,
        );

        const dodgeListSteamIds = isSubscriber
          ? dodgeList.map((t) => t.steamId)
          : [];

        this.logger.log(
          `Player ${steamId} is subscriber: ${isSubscriber}, dodgeList: ${dodgeListSteamIds}`,
        );

        return {
          score,
          dodgeList: dodgeListSteamIds,
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

  private assertHighroom(modes: MatchmakingMode[], summary: PlayerSummaryDto) {
    if (!modes.includes(MatchmakingMode.HIGHROOM)) return;

    if (summary.season.mmr < 2500) {
      throw "Too small mmr to queue";
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
