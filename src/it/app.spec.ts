import { sleep, testUser, useFullModule } from "@/test/useFullModule";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import Redis from "ioredis";
import { DeepPartial } from "typeorm";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";
import { GameBalance } from "@/matchmaker/balance/game-balance";

describe("AppController (e2e)", () => {
  const te = useFullModule(true);

  let redisClient: Redis;

  beforeEach(async () => {
    redisClient = new Redis(
      te.containers.redis.getPort(),
      te.containers.redis.getHost(),
      {
        password: te.containers.redis.getPassword(),
      },
    );
  });

  const publish = async (t: any) =>
    redisClient.publish(t.constructor.name, JSON.stringify(t));

  it("enter queue and leave flow", async () => {
    const u1 = testUser();
    const u2 = testUser();

    // Enter 1x1 queue
    await publish(
      new PlayerEnterQueueRequestedEvent(u1, [MatchmakingMode.SOLOMID]),
    );
    await publish(
      new PlayerEnterQueueRequestedEvent(u2, [MatchmakingMode.SOLOMID]),
    );

    // wait for cycle

    await sleep(2000);


    expect(te.ebusSpy).toReceiveCall(
      expect.objectContaining({
        id: expect.any(String),
        balance: expect.objectContaining({
          mode: MatchmakingMode.SOLOMID,
        } satisfies DeepPartial<GameBalance>),
      } satisfies DeepPartial<RoomCreatedEvent>),
    );
  });
});
