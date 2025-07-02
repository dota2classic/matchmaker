import { Constructor, IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Logger } from "@nestjs/common";
import { TestEnvironment } from "@/test/useFullModule";
import { BanReason } from "@/gateway/shared-types/ban";
import {
  GameserverBanStatusDto,
  GameserverDodgeListEntryDto,
  GameserverPlayerSummaryDto,
} from "@/generated-api/gameserver";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { MatchAccessLevel } from "@/gateway/shared-types/match-access-level";

export function testMockQuery<T extends IQuery, B>(
  type: Constructor<T>,
  mock: jest.Mock,
): any {
  // Small trick to set class.name dynamically, it is needed for nestjs
  const ClassName = `${type.name}Handler`;
  const context = {
    [ClassName]: class implements IQueryHandler<T, B | undefined> {
      private readonly logger = new Logger(ClassName);
      constructor() {}

      async execute(query: T): Promise<B | undefined> {
        return mock(query);
      }
    },
  };

  QueryHandler(type)(context[ClassName]);

  return {
    provide: context[ClassName],
    useFactory() {
      return new context[ClassName]();
    },
    inject: [],
  };
}

export async function mockSummary(
  te: TestEnvironment,
  steamId: string,
  accessLevel: MatchAccessLevel,
  session: boolean,
) {
  await te.mock("GET", `/player/summary/${steamId}`, {
    status: 200,
    jsonBody: {
      accessLevel: accessLevel, // Example enum value
      steamId: steamId,
      season: {
        mmr: 4300,
        rank: 12,
        percentile: 86.7,
        matchesPlayed: 145,
        games: 82,
        losses: 63,
      } as any,
      overall: {
        mmr: 4200,
        rank: 18,
        percentile: 82.5,
        matchesPlayed: 385,
        wins: 207,
        losses: 178,
      } as any,
      recalibration: undefined,
      session: session
        ? {
            serverUrl: "",
            matchId: 432,
            lobbyType: MatchmakingMode.LOBBY,
            abandoned: false,
          }
        : undefined,
      calibrationGamesLeft: 0,
      reports: [],
    } satisfies GameserverPlayerSummaryDto,
  });
}

export async function mockBanInfo(
  te: TestEnvironment,
  steamId: string,
  isBanned: boolean,
) {
  await te.mock("GET", `/player/ban_info/${steamId}`, {
    status: 200,
    jsonBody: {
      status: BanReason.INFINITE_BAN, // assuming NONE exists
      steam_id: steamId.toString(), // fake Steam ID
      isBanned,
      bannedUntil: isBanned
        ? new Date(
            Date.now() + Math.random() * 1000 * 60 * 60 * 24 * 30,
          ).toISOString()
        : "", // empty if not banned
    } satisfies GameserverBanStatusDto,
  });
}

export async function mockDodgeList(
  te: TestEnvironment,
  steamId: string,
  list: string[] = [],
) {
  await te.mock("GET", `/player/dodge_list?steamId=${steamId}`, {
    status: 200,
    jsonBody: list.map((t) => ({
      steamId: t,
      createdAt: new Date().toISOString(),
    })) satisfies GameserverDodgeListEntryDto[],
  });
}

export const mockGood = async (te: TestEnvironment, steamId: string) => {
  await mockSummary(te, steamId, MatchAccessLevel.HUMAN_GAMES, false);
  await mockBanInfo(te, steamId, false);
  await mockDodgeList(te, steamId, []);
};

export const mockNewbie = async (te: TestEnvironment, steamId: string) => {
  await mockSummary(te, steamId, MatchAccessLevel.EDUCATION, false);
  await mockBanInfo(te, steamId, false);
  await mockDodgeList(te, steamId, []);
};

export const mockPlaying = async (te: TestEnvironment, steamId: string) => {
  await mockSummary(te, steamId, MatchAccessLevel.HUMAN_GAMES, true);
  await mockBanInfo(te, steamId, false);
  await mockDodgeList(te, steamId, []);
};

export const mockBanned = async (te: TestEnvironment, steamId: string) => {
  await mockSummary(te, steamId, MatchAccessLevel.HUMAN_GAMES, false);
  await mockBanInfo(te, steamId, true);
  await mockDodgeList(te, steamId, []);
};
