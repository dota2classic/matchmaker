import {
  createParty,
  createRoom,
  expectPartyUpdate,
  setQueueLocked,
  testUser,
  useFullModule,
} from "@/test/useFullModule";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";
import { EventBus } from "@nestjs/cqrs";
import {
  MatchmakingMode,
  MatchmakingModes,
} from "@/gateway/shared-types/matchmaking-mode";
import { QueueUpdatedEvent } from "@/gateway/events/queue-updated.event";
import { DataSource } from "typeorm";
import SpyInstance = jest.SpyInstance;

describe("DbMatchmakingQueue", () => {
  const te = useFullModule();

  let q: DbMatchmakingQueue;
  let ebus: EventBus;
  let spy: SpyInstance;

  beforeEach(async () => {
    q = te.module.get(DbMatchmakingQueue);
    ebus = te.module.get(EventBus);
    spy = jest.spyOn(ebus, "publish");
    await setQueueLocked(te, false);
  });

  afterEach(async () => {
    const ds: DataSource = te.module.get(DataSource);
    await ds.query(`TRUNCATE party CASCADE`);
    await ds.query(`TRUNCATE room CASCADE`);

    spy.mockReset();
  });

  describe("enterQueue", () => {
    it(`should add party to queue with multiple modes`, async () => {
      // given
      const party = await createParty(te, [], [testUser()]);

      // when
      await q.enterQueue(party, [
        MatchmakingMode.UNRANKED,
        MatchmakingMode.BOTS_2X2,
      ]);

      // then
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          modes: expect.arrayContaining([
            {
              lobby: MatchmakingMode.UNRANKED,
              count: 1,
            },
            {
              lobby: MatchmakingMode.BOTS_2X2,
              count: 1,
            },
          ]),
        } satisfies QueueUpdatedEvent),
      );

      expectPartyUpdate(spy, party, true, [
        MatchmakingMode.UNRANKED,
        MatchmakingMode.BOTS_2X2,
      ]);
    });

    it.each(MatchmakingModes)(
      `should add party to queue with mode %i if party not in room`,
      async (mode: MatchmakingMode) => {
        // given
        const party = await createParty(te, [], [testUser()]);

        // when
        await q.enterQueue(party, [mode]);

        // then
        expect(spy).toHaveBeenCalledWith(
          new QueueUpdatedEvent([
            {
              lobby: mode,
              count: 1,
            },
          ]),
        );

        expectPartyUpdate(spy, party, true, [mode]);
      },
    );

    it.each(MatchmakingModes)(
      "should not add party to queue with mode %i if party is in room",
      async (mode: MatchmakingMode) => {
        // given
        const party = await createParty(te, [], [testUser()]);
        await createRoom(te, MatchmakingMode.UNRANKED, [party]);

        // when
        await q.enterQueue(party, [mode]);

        // then
        expect(spy).toHaveBeenCalledTimes(0);
      },
    );

    it.skip("should not update if queue is locked", async () => {
      // given
      await setQueueLocked(te, true);
      const p1 = await createParty(te, [], [testUser()]);

      // when
      await q.enterQueue(p1, [MatchmakingMode.UNRANKED]);

      // then
      expect(spy).toHaveBeenCalledTimes(0);
    });
  });

  describe("leaveQueue", () => {
    it("should update party and queue if actually left from queue", async () => {
      // given
      const p = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser()],
        true,
      );

      // when
      await q.leaveQueue([p]);

      // then
      expectPartyUpdate(spy, p, false, [MatchmakingMode.UNRANKED]);
    });

    it("should not update party and queue if nobody left from queue", async () => {
      // given
      const p = await createParty(
        te,
        [MatchmakingMode.BOTS_2X2],
        [testUser()],
        false,
      );

      // when
      await q.leaveQueue([p]);

      // then
      expect(spy).toHaveBeenCalledTimes(0);
    });

    it("should update only those parties which got updated", async () => {
      // given
      const p1 = await createParty(te, [], [testUser()]);
      const p2 = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser()],
        true,
      );

      // when
      await q.leaveQueue([p1, p2]);

      // then
      expect(spy).toHaveBeenCalledTimes(2);
      expectPartyUpdate(spy, p2, false, [MatchmakingMode.UNRANKED]);
      expect(spy).toHaveBeenNthCalledWith(2, new QueueUpdatedEvent([]));
    });

    it("should not update if queue is locked", async () => {
      // given
      await setQueueLocked(te, true);
      const p1 = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser()],
      );

      // when
      await q.leaveQueue([p1]);

      // then
      expect(spy).toHaveBeenCalledTimes(0);
    });
  });

  describe("locks", () => {
    it("should lock", async () => {
      await q.setLocked(true);
      await expect(q.isLocked()).resolves.toEqual(true);

      await q.setLocked(false);
      await expect(q.isLocked()).resolves.toEqual(false);
    });
  });

  describe("entries", () => {
    it("should return all entries in queue", async () => {
      const p1 = await createParty(te, [], [testUser()]);
      const p2 = await createParty(
        te,
        [MatchmakingMode.BOTS_2X2],
        [testUser()],
        true,
      );

      const entries = await q.entries();
      await expect(entries).toEqual([p2]);
    });

    it("should ignore parties that are not in queue", async () => {
      await createParty(te, [], [testUser()]);
      await createParty(te, [], [testUser()]);
      await createParty(te, [], [testUser()]);

      const entries = await q.entries();
      await expect(entries).toEqual([]);
    });
  });
});
