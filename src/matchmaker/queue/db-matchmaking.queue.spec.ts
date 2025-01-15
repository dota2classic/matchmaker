import {
  createParty,
  createRoom,
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

describe("DbMatchmakingQueue", () => {
  const te = useFullModule();

  let q: DbMatchmakingQueue;

  beforeEach(() => {
    q = te.module.get(DbMatchmakingQueue);
  });

  afterEach(async () => {
    const ds: DataSource = te.module.get(DataSource);
    await ds.query(`TRUNCATE party CASCADE`);
    await ds.query(`TRUNCATE room CASCADE`);
  });

  it.each(MatchmakingModes)(
    `should add party to queue with mode %i if party not in room`,
    async (mode: MatchmakingMode) => {
      const ebus: EventBus = te.module.get(EventBus);
      const spy = jest.spyOn(ebus, "publish");

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
    },
  );

  it.each(MatchmakingModes)(
    "should not add party to queue with mode %i if party is in room",
    async (mode: MatchmakingMode) => {
      const ebus: EventBus = te.module.get(EventBus);
      const spy = jest.spyOn(ebus, "publish");
      spy.mockReset()

      // given
      const party = await createParty(te, [], [testUser()]);
      await createRoom(te, MatchmakingMode.UNRANKED, [party]);

      // when
      await q.enterQueue(party, [mode]);

      // then
      expect(spy).toHaveBeenCalledTimes(0);
    },
  );
});
