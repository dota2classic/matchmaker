import { Test, TestingModule } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import Entities from "@/matchmaker/entity";
import { MatchmakerModule } from "@/matchmaker/matchmaker.module";
import { DeepPartial, MoreThan, ObjectLiteral, Repository } from "typeorm";
import { Party } from "@/matchmaker/entity/party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { Room } from "@/matchmaker/entity/room";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";
import { Constructor, EventBus } from "@nestjs/cqrs";
import { DotaTeam } from "@/gateway/shared-types/dota-team";
import { INestMicroservice } from "@nestjs/common";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { Transport } from "@nestjs/microservices";
import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
import { GetPlayerInfoQuery } from "@/gateway/queries/GetPlayerInfo/get-player-info.query";
import { GetSessionByUserQuery } from "@/gateway/queries/GetSessionByUser/get-session-by-user.query";
import {
  BanStatus,
  GetPlayerInfoQueryResult,
} from "@/gateway/queries/GetPlayerInfo/get-player-info-query.result";
import { GetSessionByUserQueryResult } from "@/gateway/queries/GetSessionByUser/get-session-by-user-query.result";
import { MatchAccessLevel } from "@/gateway/shared-types/match-access-level";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { PlayerApi } from "@/generated-api/gameserver";
import { ConfigModule } from "@nestjs/config";
import "@/util/promise";
import SpyInstance = jest.SpyInstance;

export interface TestEnvironment {
  module: TestingModule;
  app: INestMicroservice;
  containers: {
    pg: StartedPostgreSqlContainer;
    redis: StartedRedisContainer;
  };
  ebus: EventBus;
  ebusSpy: SpyInstance;
  service<R>(c: Constructor<R>): R;
  repo<R extends ObjectLiteral>(c: EntityClassOrSchema): Repository<R>;

  queryMocks: Record<string, jest.Mock>;
}

export function useFullModule(): TestEnvironment {
  jest.setTimeout(120_000);

  const te: TestEnvironment = {
    module: undefined as unknown as any,
    containers: {} as unknown as any,
    ebus: {} as unknown as any,
    ebusSpy: {} as unknown as any,
    app: {} as unknown as any,
    service: {} as unknown as any,
    repo: {} as unknown as any,

    queryMocks: {},
  };

  afterEach(() => {
    te.ebusSpy.mockReset();
  });

  beforeAll(async () => {
    te.containers.pg = await new PostgreSqlContainer()
      .withUsername("username")
      .withPassword("password")
      .start();

    te.containers.redis = await new RedisContainer()
      .withPassword("redispass")
      .start();

    te.queryMocks = {
      [GetPlayerInfoQuery.name]: jest.fn((q: GetPlayerInfoQuery) => {
        return new GetPlayerInfoQueryResult(
          q.playerId,
          q.version,
          1000,
          0.5,
          2,
          50,
          BanStatus.NOT_BANNED,
          MatchAccessLevel.HUMAN_GAMES,
          [],
        );
      }),
      [GetSessionByUserQuery.name]: jest.fn((q: GetSessionByUserQuery) => {
        return new GetSessionByUserQueryResult(undefined);
      }),
    };

    te.module = await Test.createTestingModule({
      imports: [
        await ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              gameserverUrl: "http://lol",
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          host: te.containers.pg.getHost(),
          port: te.containers.pg.getFirstMappedPort(),

          type: "postgres",
          database: "postgres",
          // logging: true,

          username: te.containers.pg.getUsername(),
          password: te.containers.pg.getPassword(),
          entities: Entities,
          migrations: ["dist/src/database/migrations/*.*"],
          migrationsRun: true,
          ssl: false,
        }),
        TypeOrmModule.forFeature(Entities),
        MatchmakerModule,
      ],
      providers: [
        {
          provide: PlayerApi,
          useValue: {
            playerControllerPlayerSummary: (steamId: string) =>
              Promise.resolve({
                accessLevel: 1, // Example enum value
                steamId: steamId,
                season: {
                  mmr: 4300,
                  rank: 12,
                  percentile: 86.7,
                  matchesPlayed: 145,
                  wins: 82,
                  losses: 63,
                },
                overall: {
                  mmr: 4200,
                  rank: 18,
                  percentile: 82.5,
                  matchesPlayed: 385,
                  wins: 207,
                  losses: 178,
                },
                recalibration: {
                  required: false,
                  reason: null,
                  targetMmr: null,
                },
                session: {
                  matchId: "abc123-def456",
                  startTime: new Date().toISOString(),
                  hero: "Invoker",
                  kills: 10,
                  deaths: 2,
                  assists: 14,
                  abandon: false,
                },
                calibrationGamesLeft: 0,
                reports: [
                  {
                    aspect: "communication",
                    count: 3,
                  },
                  {
                    aspect: "intentionalFeeding",
                    count: 1,
                  },
                ],
              }),
          },
        },
      ],
    }).compile();

    te.app = await te.module.createNestMicroservice({
      transport: Transport.REDIS,
      options: {
        retryAttempts: 3,
        retryDelay: 3000,
        password: te.containers.redis.getPassword(),
        host: te.containers.redis.getHost(),
        port: te.containers.redis.getPort(),
      },
    });

    await te.app.listen();

    te.service = (con) => te.module.get(con);
    te.repo = (con) => te.module.get(getRepositoryToken(con));
    te.ebus = te.module.get(EventBus);
    te.ebusSpy = jest.spyOn(te.ebus, "publish");

    await te.repo<QueueSettings>(QueueSettings).update(
      { checkInterval: MoreThan(-1) },
      {
        lastCheckTimestamp: new Date("2011-10-05T14:48:00.000Z"),
      },
    );

    // Mocks:
  });

  afterAll(async () => {
    await te.app.close();
    await te.containers.pg.stop();
    await te.containers.redis.stop();
  });

  return te;
}

export async function createParty(
  te: TestEnvironment,
  modes: MatchmakingMode[],
  players: string[],
  inQueue: boolean = false,
  leader: string = players[0],
  score: number = 0,
  dodgeList: string[] = [],
): Promise<Party> {
  const pr: Repository<Party> = te.module.get(getRepositoryToken(Party));

  let p = new Party();
  p.queueModes = modes;
  p.inQueue = inQueue;
  p.enterQueueAt = inQueue ? new Date() : null;
  p.score = score;
  p.dodgeList = dodgeList;
  p = await pr.save(p);

  const pip = te.repo(PlayerInParty);
  p.players = await pip.save(
    players.map((plr) => new PlayerInParty(plr, p.id, plr === leader)),
  );

  return p;
}

export async function createRoom(
  te: TestEnvironment,
  mode: MatchmakingMode,
  radiantParties: Party[],
  direParties: Party[] = [],
): Promise<Room> {
  const pr: Repository<Room> = te.module.get(getRepositoryToken(Room));
  const pir: Repository<PlayerInRoom> = te.module.get(
    getRepositoryToken(PlayerInRoom),
  );
  const p = await pr.save(new Room(mode));

  const players = radiantParties
    .flatMap((p) => p.players)
    .map(
      (pl) => new PlayerInRoom(p.id, pl.partyId, pl.steamId, DotaTeam.RADIANT),
    )
    .concat(
      direParties
        .flatMap((p) => p.players)
        .map(
          (pl) => new PlayerInRoom(p.id, pl.partyId, pl.steamId, DotaTeam.DIRE),
        ),
    );

  p.players = await pir.save(players);
  return p;
}

export async function createParties(
  te: TestEnvironment,
  cnt: number,
  modes: MatchmakingMode[],
  inQueue: boolean = false,
): Promise<Party[]> {
  return Promise.all(
    Array.from({ length: cnt }, () =>
      createParty(te, modes, [testUser()], inQueue),
    ),
  );
}

export function expectPartyUpdate(
  spy: SpyInstance,
  id: string,
  players: string[],
  inQueue: boolean,
  modes: MatchmakingMode[],
  nth = 1,
) {
  expect(spy).toHaveBeenNthCalledWith(
    nth,
    expect.objectContaining({
      partyId: id,
      leaderId: players[0],
      players,
      modes,
      inQueue,
      enterQueueAt: inQueue ? expect.any(String) : undefined,
    } satisfies DeepPartial<PartyUpdatedEvent>),
  );
}

export function testUser(): string {
  return Math.round(Math.random() * 1000000).toString();
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
