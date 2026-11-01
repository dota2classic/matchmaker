import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { join } from "path";
import { readFileSync } from "fs";
import Entities from "@/matchmaker/entity";
import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { MirrorShadowEvaluation } from "@/matchmaker/entity/mirror-shadow-evaluation";
import { compareMirror, MirrorInput } from "@/matchmaker/balance/mirror-shadow";

describe("mirror shadow PostgreSQL migration", () => {
  jest.setTimeout(180_000);
  let container: StartedPostgreSqlContainer | undefined;
  let db: DataSource | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
    db = await new DataSource({
      type: "postgres",
      url: container.getConnectionUri(),
      entities: Entities,
      migrations: [join(process.cwd(), "dist/src/database/migrations/*.js")],
      migrationsRun: true,
      synchronize: false,
    }).initialize();
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    await container?.stop();
  });

  it("roundtrips known and unknown experience without changing the stored score", async () => {
    const party = Object.assign(new Party(), {
      id: randomUUID(),
      score: 1800,
      players: [],
      dodgeList: [],
      queueModes: [],
      inQueue: false,
      enterQueueAt: null,
    });
    await db!.getRepository(Party).save(party);
    const known = Object.assign(new PlayerInParty("12345", party.id, true), {
      score: 1800,
      pvpGames: 123,
      seasonMmr: 1500,
      balanceStatsAt: new Date(),
    });
    const legacy = Object.assign(new PlayerInParty("12346", party.id, false), {
      score: 0,
    });
    await db!.getRepository(PlayerInParty).save([known, legacy]);
    const loaded = await db!
      .getRepository(PlayerInParty)
      .findOneByOrFail({ steamId: "12345" });
    expect(loaded.pvpGames).toBe(123);
    expect(loaded.seasonMmr).toBe(1500);
    expect(loaded.score).toBe(1800);
    expect(loaded.balanceStatsAt).toBeInstanceOf(Date);
    expect(
      (
        await db!
          .getRepository(PlayerInParty)
          .findOneByOrFail({ steamId: "12346" })
      ).pvpGames,
    ).toBeNull();
  });

  it("persists a replayable skipped snapshot without requiring a surviving room", async () => {
    const roomId = randomUUID();
    const input: MirrorInput = {
      version: "mirror-shadow-v1",
      scope: "selected-ten",
      capturedAt: new Date().toISOString(),
      leftPartyIds: [],
      rightPartyIds: [],
      parties: [],
      maxTeamScoreDifference: 3500,
      maxPlayerScoreDifference: 5500,
      balanceFunction: "LOG_WAITING_SCORE",
    };
    const repo = db!.getRepository(MirrorShadowEvaluation);
    await repo.save(
      repo.create({
        roomId,
        input,
        result: { status: "insufficient_data", candidatesEvaluated: 0 },
      }),
    );
    const loaded = await repo.findOneByOrFail({ roomId });
    expect(loaded.input).toEqual(input);
    expect(loaded.result.status).toBe("insufficient_data");
    await expect(
      repo.save(repo.create({ roomId, input, result: loaded.result })),
    ).rejects.toThrow();
  });

  it("executes the reporting queries against a complete comparison", async () => {
    const parties = Array.from({ length: 10 }, (_, i) => ({
      id: `party-${i}`,
      score: 1200,
      enteredAt: null,
      dodgeList: [],
      players: [
        {
          id: `${100 + i}`,
          score: 1200,
          mmr: 1000,
          pvpGames: i === 6 || i === 8 ? 0 : 100,
          statsAt: null,
        },
      ],
    }));
    const input: MirrorInput = {
      version: "mirror-shadow-v1",
      scope: "selected-ten",
      capturedAt: new Date().toISOString(),
      parties,
      leftPartyIds: parties.slice(0, 5).map((p) => p.id),
      rightPartyIds: parties.slice(5).map((p) => p.id),
      maxTeamScoreDifference: 3500,
      maxPlayerScoreDifference: 5500,
      balanceFunction: "LOG_WAITING_SCORE",
    };
    const result = compareMirror(input);
    expect(result.status).toBe("compared");
    const repo = db!.getRepository(MirrorShadowEvaluation);
    await repo.save(repo.create({ roomId: randomUUID(), input, result }));
    // TypeORM versions differ in their return value for multi-statement SQL.
    // Executing without rejection verifies the real JSONB/reporting queries.
    await db!.query(
      readFileSync(
        join(process.cwd(), "docs/mirror-shadow-report.sql"),
        "utf8",
      ),
    );
    expect(await repo.count()).toBe(2);
  });

  it("rolls back and reapplies only the additive shadow schema", async () => {
    await db!.undoLastMigration();
    expect(
      await db!.query(
        "SELECT to_regclass('public.mirror_shadow_evaluation') AS name",
      ),
    ).toEqual([{ name: null }]);
    expect(
      (await db!.query("SELECT count(*)::int AS n FROM player_in_party"))[0].n,
    ).toBe(2);
    await db!.runMigrations();
    expect(
      (
        await db!
          .getRepository(PlayerInParty)
          .findOneByOrFail({ steamId: "12345" })
      ).pvpGames,
    ).toBeNull();
  });
});
