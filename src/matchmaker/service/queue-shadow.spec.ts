import { Logger } from "@nestjs/common";
import { QueueService } from "./queue.service";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";

describe("live queue / shadow boundary", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([false, true])(
    "submits only the live result even if shadow scheduling throws: %s",
    async (fails) => {
      const balance = new GameBalance(MatchmakingMode.UNRANKED, [], []);
      const settings = Object.assign(new QueueSettings(), {
        mode: MatchmakingMode.UNRANKED,
        checkInterval: 0,
        lastCheckTimestamp: new Date(0),
        inProgress: false,
      });
      const queue = {
        entries: jest.fn().mockResolvedValue([]),
        leaveQueue: jest.fn().mockResolvedValue(undefined),
      };
      const rooms = {
        createRoom: jest.fn().mockResolvedValue({ id: "live-room" }),
      };
      const events = { publish: jest.fn() };
      const repo = {
        find: jest.fn().mockResolvedValue([settings]),
        update: jest.fn().mockResolvedValue({}),
      };
      const shadow = {
        selectLive: jest.fn((balance) => balance),
        schedule: jest.fn(() => {
          if (fails) throw new Error("shadow unavailable");
        }),
      };
      const service = new QueueService(
        queue as any,
        rooms as any,
        events as any,
        repo as any,
        shadow as any,
      );
      jest.spyOn(service, "findGamesForConfig").mockResolvedValue([balance]);
      await service.cycle(MatchmakingMode.UNRANKED);
      expect(rooms.createRoom).toHaveBeenCalledTimes(1);
      expect(rooms.createRoom).toHaveBeenCalledWith(balance);
      expect(queue.leaveQueue).toHaveBeenCalledTimes(1);
      expect(events.publish).toHaveBeenCalledWith(
        new RoomCreatedEvent("live-room", balance),
      );
      expect(shadow.schedule).toHaveBeenCalledWith(
        "live-room",
        balance,
        settings,
        balance,
      );
      expect(repo.update).toHaveBeenLastCalledWith(
        { mode: MatchmakingMode.UNRANKED },
        { inProgress: false, lastCheckTimestamp: expect.any(Date) },
      );
    },
  );
});
