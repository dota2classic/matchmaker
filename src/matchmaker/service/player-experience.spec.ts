import "@/util/promise";
import { of } from "rxjs";
import { PlayerService } from "./player.service";
import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { MatchAccessLevel } from "@/gateway/shared-types/match-access-level";

describe("player experience snapshot", () => {
  it.each([123, 0, undefined, -1, 1.5, NaN, 2147483648])(
    "captures lifetime games %s independently of the score formula",
    async (games) => {
      const summary = {
        season: { mmr: 1500, games: 2 },
        overall: { games },
        accessLevel: MatchAccessLevel.HUMAN_GAMES,
      };
      const api = {
        player: {
          playerControllerPlayerSummary: jest
            .fn()
            .mockResolvedValue({ data: summary }),
          playerControllerBanInfo: jest
            .fn()
            .mockResolvedValue({ data: { isBanned: false } }),
          playerControllerGetDodgeList: jest
            .fn()
            .mockResolvedValue({ data: [] }),
        },
      };
      const save = jest.fn().mockResolvedValue({});
      const query = jest.fn().mockResolvedValue([]);
      const service = new PlayerService(
        {} as any,
        {} as any,
        api as any,
        { transaction: (fn: any) => fn({ save, query }) } as any,
        { send: () => of({ roles: [] }) } as any,
      );
      const party = new Party();
      party.id = "party";
      party.players = [new PlayerInParty("12345", party.id, true)];
      await service.preparePartyForQueue(party, [MatchmakingMode.UNRANKED]);
      expect(party.players[0].pvpGames).toBe(
        games === 123 || games === 0 ? games : null,
      );
      expect(party.players[0].seasonMmr).toBe(1500);
      expect(party.players[0].balanceStatsAt).toBeInstanceOf(Date);
      expect(party.score).toBe(PlayerService.getPlayerScore(1500, 0.5, 2));
      expect(save).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("FOR UPDATE"),
        ["party"],
      );
      expect(query.mock.invocationCallOrder[0]).toBeLessThan(
        save.mock.invocationCallOrder[0],
      );
    },
  );
});

describe("SECRET admission", () => {
  it.each([
    { bans: [true, true], modes: [MatchmakingMode.SECRET], allowed: true, level: undefined },
    { bans: [true, true], modes: [MatchmakingMode.SECRET], allowed: false, level: MatchAccessLevel.EDUCATION },
    { bans: [true, true], modes: [MatchmakingMode.SECRET], allowed: false, level: MatchAccessLevel.SIMPLE_MODES },
    { bans: [false, false], modes: [MatchmakingMode.UNRANKED], allowed: false, level: MatchAccessLevel.EDUCATION },
    { bans: [false, false], modes: [MatchmakingMode.BOTS], allowed: true, level: MatchAccessLevel.EDUCATION },
    { bans: [true, false], modes: [MatchmakingMode.SECRET], allowed: false },
    { bans: [false, false], modes: [MatchmakingMode.SECRET], allowed: false },
    { bans: [false, false], modes: [MatchmakingMode.UNRANKED], allowed: true },
    { bans: [false, true], modes: [MatchmakingMode.TURBO], allowed: false },
    { bans: [true, true], modes: [MatchmakingMode.BOTS], allowed: false },
    { bans: [true, true], modes: [MatchmakingMode.SECRET, MatchmakingMode.BOTS], allowed: false },
  ])("checks every member for $modes with bans $bans", async ({ bans, modes, allowed, level }) => {
    const summary = {
      season: { mmr: 1500, games: 2 },
      accessLevel: MatchAccessLevel.HUMAN_GAMES,
    };
    const player = {
      playerControllerPlayerSummary: async (id: string) => ({
        data: { ...summary, accessLevel: id === "2" ? (level ?? summary.accessLevel) : summary.accessLevel },
      }),
      playerControllerBanInfo: async (id: string) => ({
        data: { isBanned: bans[Number(id) - 1], bannedUntil: "2040-01-01T00:00:00Z" },
      }),
      playerControllerGetDodgeList: async () => ({ data: [] }),
    };
    const save = jest.fn();
    const service = new PlayerService(
      {} as any,
      {} as any,
      { player } as any,
      { transaction: (fn: any) => fn({ save, query: jest.fn() }) } as any,
      { send: () => of({ roles: [] }) } as any,
    );
    const party = new Party();
    party.id = "party";
    party.players = [new PlayerInParty("1", party.id, true), new PlayerInParty("2", party.id, false)];

    if (modes.length === 1 && modes[0] === MatchmakingMode.SECRET) {
      await expect(service.canPlayQueuedMode("2", MatchmakingMode.SECRET))
        .resolves.toBe(bans[1] && level === undefined);
    }

    const preparation = service.preparePartyForQueue(party, modes);
    if (allowed) {
      await expect(preparation).resolves.toBe(party);
    } else {
      await expect(preparation).rejects.toThrow();
      expect(save).not.toHaveBeenCalled();
    }
  });
});
