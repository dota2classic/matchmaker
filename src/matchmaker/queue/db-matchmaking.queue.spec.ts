import {
  createParty,
  createRoom,
  expectPartyUpdate,
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
import { createTestingUtils } from "@/test/party-queue-test.utils";
import { mockBanned, mockGood, mockNewbie, mockPlaying } from "@/test/mocks";
import SpyInstance = jest.SpyInstance;

describe("DbMatchmakingQueue", () => {
  const te = useFullModule();

  let q: DbMatchmakingQueue;
  let ebus: EventBus;
  let spy: SpyInstance;

  const {
    expectInviteDeleted,
    expectPartyHasPlayer,
    expectPartyHasNotPlayer,
    expectPartyInQueue,
  } = createTestingUtils(te);

  beforeEach(async () => {
    q = te.module.get(DbMatchmakingQueue);
    ebus = te.module.get(EventBus);
    spy = jest.spyOn(ebus, "publish");
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

      await mockGood(te, party.leader);

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

      expectPartyUpdate(spy, party.id, [party.leader], true, [
        MatchmakingMode.UNRANKED,
        MatchmakingMode.BOTS_2X2,
      ]);
    });

    it.each(MatchmakingModes)(
      `should add party to queue with mode %i if party not in room`,
      async (mode: MatchmakingMode) => {
        // given
        const party = await createParty(te, [], [testUser()]);
        await mockGood(te, party.leader);

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

        expectPartyUpdate(spy, party.id, [party.leader], true, [mode]);
      },
    );

    it.each(MatchmakingModes)(
      "should not add party to queue with mode %i if party is in room",
      async (mode: MatchmakingMode) => {
        // given
        const party = await createParty(te, [], [testUser()]);
        await createRoom(te, MatchmakingMode.UNRANKED, [party]);
        await mockGood(te, party.leader);

        // when
        await q.enterQueue(party, [mode]);

        // then
        expect(spy).toHaveBeenCalledTimes(0);
      },
    );

    it("should not enter mode if player resolves to be insufficient access level", async () => {
      // given
      const party = await createParty(te, [], [testUser()]);
      await mockNewbie(te, party.leader);

      // when
      await q.enterQueue(party, [MatchmakingMode.UNRANKED]);

      // then
      await expectPartyInQueue(party.id, false);
    });

    it("should not enter queue if player resolves to be banned", async () => {
      // given
      const party = await createParty(te, [], [testUser()]);
      await mockBanned(te, party.leader);

      // when
      await q.enterQueue(party, [MatchmakingMode.UNRANKED]);

      // then
      await expectPartyInQueue(party.id, false);
    });

    it("should not enter queue if player resolves to be in another game", async () => {
      // given
      const party = await createParty(te, [], [testUser(), testUser()]);

      await mockPlaying(te, party.leader);

      // when
      await q.enterQueue(party, [MatchmakingMode.UNRANKED]);

      // then
      await expectPartyInQueue(party.id, false);
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
      await q.leaveQueue([p], true);

      // then
      expectPartyUpdate(spy, p.id, [p.leader], false, [
        MatchmakingMode.UNRANKED,
      ]);
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
      await q.leaveQueue([p], true);

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
      await q.leaveQueue([p1, p2], true);

      // then
      expect(spy).toHaveBeenCalledTimes(2);
      expectPartyUpdate(spy, p2.id, [p2.leader], false, [
        MatchmakingMode.UNRANKED,
      ]);
      expect(spy).toHaveBeenNthCalledWith(2, new QueueUpdatedEvent([]));
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
