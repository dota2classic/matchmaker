import {
  createParties,
  createParty,
  testUser,
  useFullModule,
} from "@/test/useFullModule";
import { QueueService } from "@/matchmaker/service/queue.service";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";
import { DeepPartial } from "typeorm";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { Party } from "@/matchmaker/entity/party";

describe("QueueService", () => {
  const te = useFullModule();
  let qs: QueueService;

  beforeEach(() => {
    qs = te.service(QueueService);
  });

  it("should find SOLOMID game", async () => {
    // given
    const p1 = await createParty(
      te,
      [MatchmakingMode.SOLOMID],
      [testUser()],
      true,
    );
    const p2 = await createParty(
      te,
      [MatchmakingMode.SOLOMID],
      [testUser()],
      true,
    );

    // when
    await qs.cycle();

    // then
    expect(te.ebusSpy).toReceiveCall(
      expect.objectContaining({
        id: expect.any(String),
        balance: expect.objectContaining({
          mode: MatchmakingMode.SOLOMID,
          left: expect.any(Array),
          right: expect.any(Array),
        } satisfies DeepPartial<GameBalance>),
      } satisfies DeepPartial<RoomCreatedEvent>),
    );
  });

  it("should not find a game where score difference too big", async () => {
    // given
    console.log(
      "QUEUESERIZE:",
      te.repo(Party).count({ where: { inQueue: true } }),
    );
    const boss = testUser();
    const noobParties = await createParties(
      te,
      9,
      [MatchmakingMode.UNRANKED],
      true,
    );
    const bossParty = await createParty(
      te,
      [MatchmakingMode.UNRANKED],
      [boss],
      true,
      boss,
      10000,
    );

    // when
    await qs.cycle();

    // then

    await expect(
      te.repo(Party).find({ where: { inQueue: true } }),
    ).resolves.toHaveLength(10);
  });
});
