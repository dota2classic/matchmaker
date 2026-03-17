import { createParty, testUser, useFullModule } from "@/test/useFullModule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { QueueStatisticsService } from "@/matchmaker/service/queue-statistics.service";
import {
  QueueEntry,
  QueueResultType,
  ReadyCheckResultType,
} from "@/matchmaker/entity/queue-entry";
import { DataSource, Repository } from "typeorm";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";
import { mockGood } from "@/test/mocks";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { v4 } from "uuid";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { DotaTeam } from "@/gateway/shared-types/dota-team";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { Party } from "@/matchmaker/entity/party";

describe("QueueStatisticsService", () => {
  const te = useFullModule();

  let svc: QueueStatisticsService;
  let queueEntryRepo: Repository<QueueEntry>;
  let dbQueue: DbMatchmakingQueue;

  beforeAll(() => {
    svc = te.service(QueueStatisticsService);
    queueEntryRepo = te.repo(QueueEntry);
    dbQueue = te.service(DbMatchmakingQueue);
  });

  afterEach(async () => {
    const ds = te.module.get(DataSource);
    await ds.query(`TRUNCATE party CASCADE`);
    await ds.query(`TRUNCATE queue_entry`);
  });

  describe("recordQueueEntry", () => {
    it("should create one entry per mode when a player enters queue", async () => {
      // given
      const party = await createParty(te, [], [testUser()]);
      await mockGood(te, party.leader);

      // when — queuing for two modes
      await dbQueue.enterQueue(party, [
        MatchmakingMode.UNRANKED,
        MatchmakingMode.TURBO,
      ]);

      // then — one entry per mode
      const entries = await queueEntryRepo.find({
        where: { partyId: party.id },
      });
      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.mode)).toEqual(
        expect.arrayContaining([
          MatchmakingMode.UNRANKED,
          MatchmakingMode.TURBO,
        ]),
      );
    });

    it("should populate party features correctly", async () => {
      // given
      const party = await createParty(te, [], [testUser()]);
      await mockGood(te, party.leader);

      // when
      await dbQueue.enterQueue(party, [MatchmakingMode.UNRANKED]);

      // then
      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.partyId).toBe(party.id);
      expect(entry.partySize).toBe(1);
      expect(entry.utcHour).toBeGreaterThanOrEqual(0);
      expect(entry.utcHour).toBeLessThanOrEqual(23);
      expect(entry.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(entry.dayOfWeek).toBeLessThanOrEqual(6);
      expect(entry.resultType).toBeNull();
    });

    it("should snapshot queue state per mode at entry time (before entering party is counted)", async () => {
      // given — existing party in queue for UNRANKED only
      await createParty(te, [MatchmakingMode.UNRANKED], [testUser()], true);

      const newParty = await createParty(te, [], [testUser()]);
      await mockGood(te, newParty.leader);

      // when — enter both modes
      await dbQueue.enterQueue(newParty, [
        MatchmakingMode.UNRANKED,
        MatchmakingMode.TURBO,
      ]);

      // then — UNRANKED snapshot sees 1 existing player; TURBO snapshot sees 0
      const unrankedEntry = await queueEntryRepo.findOneOrFail({
        where: { partyId: newParty.id, mode: MatchmakingMode.UNRANKED },
      });
      const turboEntry = await queueEntryRepo.findOneOrFail({
        where: { partyId: newParty.id, mode: MatchmakingMode.TURBO },
      });

      expect(unrankedEntry.snapshotPlayerCount).toBe(1);
      expect(unrankedEntry.snapshotPartyCount).toBe(1);
      expect(turboEntry.snapshotPlayerCount).toBe(0);
      expect(turboEntry.snapshotPartyCount).toBe(0);
    });

    it("should snapshot settings for each mode independently", async () => {
      // given
      const party = await createParty(te, [], [testUser()]);
      await mockGood(te, party.leader);

      // when
      await dbQueue.enterQueue(party, [MatchmakingMode.UNRANKED]);

      // then
      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.snapshotMaxTeamScoreDifference).toBeGreaterThan(0);
      expect(entry.snapshotBalanceFunctionType).toBeDefined();
    });
  });

  describe("recordMatchFound", () => {
    it("should mark the matched mode entry as MATCHED", async () => {
      // given
      const party = await createParty(te, [], [testUser()]);
      party.enterQueueAt = new Date(Date.now() - 10_000);
      await svc.recordQueueEntry(party, [MatchmakingMode.UNRANKED]);

      const balance = new GameBalance(MatchmakingMode.UNRANKED, [party], []);

      // when
      await svc.recordMatchFound(balance, v4());

      // then
      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.resultType).toBe(QueueResultType.MATCHED);
      expect(entry.waitTimeSeconds).toBeGreaterThanOrEqual(10);
    });

    it("should mark other queued modes as MATCHED_OTHER_MODE", async () => {
      // given — party queued for both UNRANKED and TURBO, matched in UNRANKED
      const party = await createParty(te, [], [testUser()]);
      await svc.recordQueueEntry(party, [
        MatchmakingMode.UNRANKED,
        MatchmakingMode.TURBO,
      ]);

      const balance = new GameBalance(MatchmakingMode.UNRANKED, [party], []);

      // when
      await svc.recordMatchFound(balance, v4());

      // then
      const unrankedEntry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      const turboEntry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.TURBO },
      });

      expect(unrankedEntry.resultType).toBe(QueueResultType.MATCHED);
      expect(turboEntry.resultType).toBe(QueueResultType.MATCHED_OTHER_MODE);
      // Both get the same wait time
      expect(turboEntry.waitTimeSeconds).toBe(unrankedEntry.waitTimeSeconds);
    });

    it("should not overwrite an already-resolved entry on re-queue", async () => {
      // given — party queued, left, queued again and matched
      const party = await createParty(te, [], [testUser()]);
      await svc.recordQueueEntry(party, [MatchmakingMode.UNRANKED]);
      await svc.recordQueueLeft(party.id);

      await svc.recordQueueEntry(party, [MatchmakingMode.UNRANKED]);
      await svc.recordMatchFound(
        new GameBalance(MatchmakingMode.UNRANKED, [party], []),
        v4(),
      );

      // then — two separate entries, first stays LEFT_QUEUE
      const entries = await queueEntryRepo.find({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
        order: { enteredAt: "ASC" },
      });
      expect(entries).toHaveLength(2);
      expect(entries[0].resultType).toBe(QueueResultType.LEFT_QUEUE);
      expect(entries[1].resultType).toBe(QueueResultType.MATCHED);
    });
  });

  describe("recordQueueLeft via leaveQueue", () => {
    it("should mark all mode entries as LEFT_QUEUE when player voluntarily leaves", async () => {
      // given — queued for two modes
      const party = await createParty(te, [], [testUser()]);
      await mockGood(te, party.leader);
      await dbQueue.enterQueue(party, [
        MatchmakingMode.UNRANKED,
        MatchmakingMode.TURBO,
      ]);

      const savedParty = await te
        .repo<Party>(Party)
        .findOneOrFail({ where: { id: party.id }, relations: ["players"] });

      // when
      await dbQueue.leaveQueue([savedParty], true);

      // then — both mode entries are LEFT_QUEUE
      const entries = await queueEntryRepo.find({
        where: { partyId: party.id },
      });
      expect(entries).toHaveLength(2);
      expect(
        entries.every((e) => e.resultType === QueueResultType.LEFT_QUEUE),
      ).toBe(true);
      expect(entries[0].waitTimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it("should NOT resolve entries when party leaves because a match was found", async () => {
      // given — leaveQueue called with clearEnterQueueTime=false (match found path)
      const party = await createParty(te, [], [testUser()]);
      await mockGood(te, party.leader);
      await dbQueue.enterQueue(party, [MatchmakingMode.UNRANKED]);

      const savedParty = await te
        .repo<Party>(Party)
        .findOneOrFail({ where: { id: party.id }, relations: ["players"] });

      // when
      await dbQueue.leaveQueue([savedParty], false);

      // then — entry still unresolved (recordMatchFound handles this separately)
      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.resultType).toBeNull();
    });
  });

  describe("recordReadyCheckResult", () => {
    const makePlayersInRoom = (
      party: Party,
      roomId: string,
      state: ReadyState,
    ): PlayerInRoom[] =>
      party.players.map((p) => {
        const pir = new PlayerInRoom(
          roomId,
          party.id,
          p.steamId,
          DotaTeam.RADIANT,
        );
        pir.readyState = state;
        return pir;
      });

    it("should record ALL_READY on the matched entry", async () => {
      // given
      const party = await createParty(te, [], [testUser()]);
      const roomId = v4();
      await svc.recordQueueEntry(party, [MatchmakingMode.UNRANKED]);
      await svc.recordMatchFound(
        new GameBalance(MatchmakingMode.UNRANKED, [party], []),
        roomId,
      );

      // when
      const startedAt = new Date(Date.now() - 5000);
      await svc.recordReadyCheckResult(
        roomId,
        makePlayersInRoom(party, roomId, ReadyState.READY),
        startedAt,
      );

      // then
      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.readyCheckResult).toBe(ReadyCheckResultType.ALL_READY);
      expect(entry.readyCheckDurationSeconds).toBeGreaterThanOrEqual(5);
    });

    it("should record DECLINE", async () => {
      const party = await createParty(te, [], [testUser()]);
      const roomId = v4();
      await svc.recordQueueEntry(party, [MatchmakingMode.UNRANKED]);
      await svc.recordMatchFound(
        new GameBalance(MatchmakingMode.UNRANKED, [party], []),
        roomId,
      );

      await svc.recordReadyCheckResult(
        roomId,
        makePlayersInRoom(party, roomId, ReadyState.DECLINE),
        new Date(),
      );

      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.readyCheckResult).toBe(ReadyCheckResultType.DECLINE);
    });

    it("should record TIMEOUT", async () => {
      const party = await createParty(te, [], [testUser()]);
      const roomId = v4();
      await svc.recordQueueEntry(party, [MatchmakingMode.UNRANKED]);
      await svc.recordMatchFound(
        new GameBalance(MatchmakingMode.UNRANKED, [party], []),
        roomId,
      );

      await svc.recordReadyCheckResult(
        roomId,
        makePlayersInRoom(party, roomId, ReadyState.TIMEOUT),
        new Date(),
      );

      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.readyCheckResult).toBe(ReadyCheckResultType.TIMEOUT);
    });

    it("should prioritise DECLINE over TIMEOUT when both are present", async () => {
      const u1 = testUser();
      const u2 = testUser();
      const party = await createParty(te, [], [u1, u2]);
      const roomId = v4();
      await svc.recordQueueEntry(party, [MatchmakingMode.UNRANKED]);
      await svc.recordMatchFound(
        new GameBalance(MatchmakingMode.UNRANKED, [party], []),
        roomId,
      );

      const pir1 = new PlayerInRoom(roomId, party.id, u1, DotaTeam.RADIANT);
      pir1.readyState = ReadyState.DECLINE;
      const pir2 = new PlayerInRoom(roomId, party.id, u2, DotaTeam.RADIANT);
      pir2.readyState = ReadyState.TIMEOUT;

      await svc.recordReadyCheckResult(roomId, [pir1, pir2], new Date());

      const entry = await queueEntryRepo.findOneOrFail({
        where: { partyId: party.id, mode: MatchmakingMode.UNRANKED },
      });
      expect(entry.readyCheckResult).toBe(ReadyCheckResultType.DECLINE);
    });
  });
});
