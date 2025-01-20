import { Test, TestingModule } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import Entities from "@/matchmaker/entity";
import { MatchmakerModule } from "@/matchmaker/matchmaker.module";
import { ObjectLiteral, Repository } from "typeorm";
import { Party } from "@/matchmaker/entity/party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { Room } from "@/matchmaker/entity/room";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";
import { QueueMeta } from "@/matchmaker/entity/queue-meta";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import { Constructor, EventBus } from "@nestjs/cqrs";
import { DotaTeam } from "@/gateway/shared-types/dota-team";
import { INestMicroservice } from "@nestjs/common";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { Transport } from "@nestjs/microservices";
import { ScheduleModule } from "@nestjs/schedule";
import { EntityClassOrSchema } from "@nestjs/typeorm/dist/interfaces/entity-class-or-schema.type";
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
}

export function useFullModule(schedule: boolean = true): TestEnvironment {
  jest.setTimeout(120_000);

  const te: TestEnvironment = {
    module: undefined as unknown as any,
    containers: {} as unknown as any,
    ebus: {} as unknown as any,
    ebusSpy: {} as unknown as any,
    app: {} as unknown as any,
    service: {} as unknown as any,
    repo: {} as unknown as any,
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

    te.module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          host: te.containers.pg.getHost(),
          port: te.containers.pg.getFirstMappedPort(),

          type: "postgres",
          database: "postgres",
          // logging: true,

          username: te.containers.pg.getUsername(),
          password: te.containers.pg.getPassword(),
          entities: Entities,
          synchronize: true,
          dropSchema: false,
          ssl: false,
        }),
        TypeOrmModule.forFeature(Entities),
        MatchmakerModule,
        ...(schedule ? [ScheduleModule.forRoot()] : []),
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
): Promise<Party> {
  const pr: Repository<Party> = te.module.get(getRepositoryToken(Party));

  let p = new Party();
  p.queueModes = modes;
  p.inQueue = inQueue;
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
): Promise<Party[]> {
  return Promise.all(
    Array.from({ length: cnt }, () => createParty(te, modes, [testUser()])),
  );
}

export function expectPartyUpdate(
  spy: SpyInstance,
  party: Party,
  inQueue: boolean,
  modes: MatchmakingMode[] = party.queueModes,
  nth = 1,
) {
  expect(spy).toHaveBeenNthCalledWith(
    nth,
    new PartyUpdatedEvent(
      party.id,
      party.players[0].steamId,
      party.players.map((it) => it.steamId),
      modes,
      inQueue,
    ),
  );
}

export async function setQueueLocked(te: TestEnvironment, locked: boolean) {
  const repo: Repository<QueueMeta> = te.module.get(
    getRepositoryToken(QueueMeta),
  );
  await repo.upsert(
    {
      version: Dota2Version.Dota_684,
      isLocked: locked,
    },
    ["version"],
  );
}
export function testUser(): string {
  return Math.round(Math.random() * 1000000).toString();
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
