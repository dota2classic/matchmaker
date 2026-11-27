import "@/util/promise";
import { of } from "rxjs";
import { PlayerService } from "./player.service";
import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { MatchAccessLevel } from "@/gateway/shared-types/match-access-level";

describe("SECRET cooldown exclusion", () => {
  it.each([0, 1, 99, undefined])(
    "rejects reason %s on admission and ready-check",
    async (status) => {
      const save = jest.fn();
      const player = {
        playerControllerPlayerSummary: async () => ({
          data: {
            season: { mmr: 1500, games: 5 },
            accessLevel: MatchAccessLevel.HUMAN_GAMES,
            educationVerified: true,
          },
        }),
        playerControllerBanInfo: async (id: string) => ({
          data: { isBanned: true, status: id === "1" ? 7 : status },
        }),
        playerControllerGetDodgeList: async () => ({ data: [] }),
      };
      const service = new PlayerService(
        {} as any,
        {} as any,
        { player } as any,
        { transaction: (fn: any) => fn({ save, query: jest.fn() }) } as any,
        { send: () => of({ roles: [] }) } as any,
      );
      const party = new Party();
      party.id = "party";
      party.players = [
        new PlayerInParty("1", party.id, true),
        new PlayerInParty("2", party.id, false),
      ];
      await expect(
        service.canPlayQueuedMode("2", MatchmakingMode.SECRET),
      ).resolves.toBe(false);
      await expect(
        service.canPlayQueuedMode("2", MatchmakingMode.UNRANKED),
      ).resolves.toBe(false);
      await expect(
        service.preparePartyForQueue(party, [MatchmakingMode.SECRET]),
      ).rejects.toThrow();
      await expect(
        service.preparePartyForQueue(party, [MatchmakingMode.UNRANKED]),
      ).rejects.toThrow();
      expect(save).not.toHaveBeenCalled();
    },
  );
});
