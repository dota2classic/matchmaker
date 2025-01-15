import { Test, TestingModule } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getRepositoryToken, TypeOrmModule } from "@nestjs/typeorm";
import Entities from "@/matchmaker/entity";
import { MatchmakerModule } from "@/matchmaker/matchmaker.module";
import { Repository } from "typeorm";
import { Party } from "@/matchmaker/entity/party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { Room } from "@/matchmaker/entity/room";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";
import { QueueMeta } from "@/matchmaker/entity/queue-meta";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import SpyInstance = jest.SpyInstance;

export interface TestEnvironment {
  module: TestingModule;
  containers: {
    pg: StartedPostgreSqlContainer;
  };
}

export function useFullModule(): TestEnvironment {
  jest.setTimeout(60_000);

  const te: TestEnvironment = {
    module: undefined as unknown as any,
    containers: {} as unknown as any,
  };

  beforeAll(async () => {
    te.containers.pg = await new PostgreSqlContainer()
      .withUsername("username")
      .withPassword("password")
      .start();

    te.module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          host: te.containers.pg.getHost(),
          port: te.containers.pg.getFirstMappedPort(),

          type: "postgres",
          database: "postgres",
          logging: true,

          username: te.containers.pg.getUsername(),
          password: te.containers.pg.getPassword(),
          entities: Entities,
          synchronize: true,
          dropSchema: false,
          ssl: false,
        }),
        TypeOrmModule.forFeature(Entities),
        MatchmakerModule,
      ],
    }).compile();
  });

  afterAll(async () => {
    await te.containers.pg.stop();
  });

  return te;
}

export async function createParty(
  te: TestEnvironment,
  modes: MatchmakingMode[],
  players: string[],
  leader: string = players[0],
): Promise<Party> {
  const pr: Repository<Party> = te.module.get(getRepositoryToken(Party));
  const p = await pr.save(new Party(modes));

  const pip: Repository<Party> = te.module.get(
    getRepositoryToken(PlayerInParty),
  );
  p.players = await pip.save(
    players.map((plr) => new PlayerInParty(plr, p.id, 0, plr === leader)),
  );

  return p;
}

export async function createRoom(
  te: TestEnvironment,
  mode: MatchmakingMode,
  parties: Party[],
): Promise<Room> {
  const pr: Repository<Room> = te.module.get(getRepositoryToken(Room));
  const pir: Repository<PlayerInRoom> = te.module.get(
    getRepositoryToken(PlayerInRoom),
  );
  const p = await pr.save(new Room(mode));

  p.players = await pir.save(
    parties
      .flatMap((p) => p.players)
      .map((pl) => new PlayerInRoom(p.id, pl.partyId, pl.steamId)),
  );
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
  modes: MatchmakingMode[] = party.queueModes,
) {
  expect(spy).toHaveBeenCalledWith(
    new PartyUpdatedEvent(
      party.id,
      party.players[0].steamId,
      party.players.map((it) => it.steamId),
      modes,
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
