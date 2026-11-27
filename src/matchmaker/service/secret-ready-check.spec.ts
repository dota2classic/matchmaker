import { ReadyCheckService } from "./ready-check.service";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { RoomNotReadyEvent } from "@/gateway/events/room-not-ready.event";
import { RoomReadyEvent } from "@/gateway/events/room-ready.event";

describe("SECRET ready check", () => {
  it("cancels without marking a decline if a ban expires during confirmation", async () => {
    const room = {
      id: "room",
      lobbyType: MatchmakingMode.SECRET,
      players: [{ steamId: "1", partyId: "party", readyState: ReadyState.READY }],
    };
    const rooms = {
      findOneOrFail: jest.fn().mockResolvedValue(room),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn(),
    };
    const parties = { returnToQueues: jest.fn() };
    const bus = { publish: jest.fn() };
    const bans = { canPlayQueuedMode: jest.fn().mockResolvedValue(false) };
    const service = new ReadyCheckService(
      rooms as any,
      {} as any,
      {} as any,
      bus as any,
      parties as any,
      bans as any,
    );

    await service.finishReadyCheck(room.id);
    expect(bans.canPlayQueuedMode).toHaveBeenCalledWith("1", MatchmakingMode.SECRET);
    expect(parties.returnToQueues).toHaveBeenCalledWith(["party"]);
    expect(bus.publish).toHaveBeenCalledTimes(1);
    expect(bus.publish).toHaveBeenCalledWith(expect.any(RoomNotReadyEvent));
    expect(bus.publish).not.toHaveBeenCalledWith(expect.any(RoomReadyEvent));
  });
});
