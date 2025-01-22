import {
  createParty,
  createRoom,
  testUser,
  useFullModule,
} from "@/test/useFullModule";
import { RoomCreatedHandler } from "@/matchmaker/event-handler/room-created.handler";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { ReadyCheckStartedEvent } from "@/gateway/events/ready-check-started.event";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { v4 } from "uuid";
import SpyInstance = jest.SpyInstance;

describe("RoomCreatedHandler", () => {
  const te = useFullModule();
  let spy: SpyInstance;
  let handler: RoomCreatedHandler;

  beforeEach(() => {
    spy = jest.spyOn(te.ebus, "publish");
    handler = te.module.get(RoomCreatedHandler);
  });

  afterEach(() => {
    spy.mockReset();
  });

  it("should fail if room doesn't exist", async () => {
    // when
    await handler.handle(
      new RoomCreatedEvent(
        v4(),
        new GameBalance(MatchmakingMode.BOTS_2X2, [], []),
      ),
    );

    // then
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it("should start ready check for room if it exists", async () => {
    // given

    const p = await createParty(te, [MatchmakingMode.BOTS_2X2], [testUser()]);
    const room = await createRoom(te, MatchmakingMode.BOTS_2X2, [p]);

    // when
    await handler.handle(
      new RoomCreatedEvent(
        room.id,
        new GameBalance(MatchmakingMode.BOTS_2X2, [p], []),
      ),
    );

    // then
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      new ReadyCheckStartedEvent(room.id, MatchmakingMode.BOTS_2X2, [
        { steamId: p.players[0].steamId, readyState: ReadyState.PENDING },
      ]),
    );
  });
});
