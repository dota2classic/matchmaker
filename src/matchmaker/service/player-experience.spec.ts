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
      const service = new PlayerService(
        {} as any,
        {} as any,
        api as any,
        { transaction: (fn: any) => fn({ save }) } as any,
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
    },
  );
});
