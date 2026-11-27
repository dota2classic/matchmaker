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
import { partyTransaction } from "@/matchmaker/service/party-transaction";
import { isSecretQueueBan } from "./secret-ban";

type QueuePlayerSummary = PlayerSummaryDto & { educationVerified?: boolean };

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

  async canPlayQueuedMode(steamId: string, mode: MatchmakingMode): Promise<boolean> {
    const { data: ban } = await this.playerApi.player.playerControllerBanInfo(steamId);
    if (mode !== MatchmakingMode.SECRET) return !ban.isBanned;
    if (!isSecretQueueBan(ban)) return false;

    const { data: summary } =
      await this.playerApi.player.playerControllerPlayerSummary(steamId);
    return this.hasQueueAccess(summary, mode);
  }

  async preparePartyForQueue(party: Party, modes: MatchmakingMode[]) {
    const secret = modes.includes(MatchmakingMode.SECRET);
    if (modes.length === 0 || (secret && (modes.length !== 1 || party.size > 5))) {
      throw new Error("Invalid queue selection");
    }

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

        if (secret ? !isSecretQueueBan(ban) : ban.isBanned) {
          throw new Error("The player's ban status does not allow this queue");
        }

        this.assertHighroom(modes, summary);

        if (modes.some((mode) => !this.hasQueueAccess(summary, mode))) {
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
          // Lifetime PvP experience, separate from the seasonal score formula.
          pvpGames:
            Number.isSafeInteger(summary.overall?.games) &&
            summary.overall.games >= 0 &&
            summary.overall.games <= 2147483647
              ? summary.overall.games
              : null,
          seasonMmr: Number.isFinite(summary.season.mmr)
            ? summary.season.mmr
            : null,
          balanceStatsAt: new Date(),
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
      const resolved = resolvedScores.find((t) => t.steamId === plr.steamId);
      plr.score = resolved?.score || 0;
      plr.pvpGames = resolved?.pvpGames ?? null;
      plr.seasonMmr = resolved?.seasonMmr ?? null;
      plr.balanceStatsAt = resolved?.balanceStatsAt ?? null;
    });

    party.score = resolvedScores.reduce((a, b) => a + b.score, 0);
    party.dodgeList = dodgeList;

    await partyTransaction(this.ds, party.id, async (tx) => {
      await tx.save(Party, party);
      await tx.save(PlayerInParty, party.players);
    });

    return party;
  }

  private hasQueueAccess(summary: QueuePlayerSummary, mode: MatchmakingMode): boolean {
    if (mode === MatchmakingMode.SECRET && summary.educationVerified !== true) {
      return false;
    }
    return canQueueMode(summary.accessLevel as unknown as MatchAccessLevel, mode);
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
