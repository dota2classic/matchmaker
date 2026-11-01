import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { Logger } from "@nestjs/common";
import { MirrorShadowService } from "./mirror-shadow.service";
import { MirrorShadowEvaluation } from "@/matchmaker/entity/mirror-shadow-evaluation";
import { Party } from "@/matchmaker/entity/party";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function setup(enabled = true) {
  const parties = Array.from({ length: 10 }, (_, i) =>
    Object.assign(new Party(), {
      id: `party-${i}`,
      score: 1200,
      enterQueueAt: new Date("2026-11-01T00:00:00Z"),
      dodgeList: [],
      players: [
        {
          steamId: `player-${i}`,
          score: 1200,
          seasonMmr: 1000,
          pvpGames: i === 0 ? 131 : i === 6 || i === 8 ? 5 : 100,
          balanceStatsAt: new Date("2026-11-01T00:00:00Z"),
        },
      ],
    }),
  );
  const balance = new GameBalance(
    MatchmakingMode.UNRANKED,
    parties.slice(0, 5),
    parties.slice(5),
  );
  const repo = {
    create: jest.fn((x) => x),
    save: jest.fn().mockResolvedValue({}),
  };
  const config = { get: jest.fn(() => enabled) };
  const service = new MirrorShadowService(
    config as unknown as ConfigService,
    repo as unknown as Repository<MirrorShadowEvaluation>,
  );
  const settings = Object.assign(new QueueSettings(), {
    maxTeamScoreDifference: 3500,
    maxPlayerScoreDifference: 5500,
    balanceFunctionType: "LOG_WAITING_SCORE",
  });
  return { service, balance, settings, repo };
}

describe("MirrorShadowService isolation", () => {
  it("applies the 500 alternative to the same ten players without mutating baseline", () => {
    const { service, balance, settings } = setup();
    const live = service.selectLive(balance, settings);
    expect(live).not.toBe(balance);
    for (const team of [live.left, live.right]) {
      expect(
        team.flatMap((p) => p.players).filter((p) => p.pvpGames! < 10),
      ).toHaveLength(1);
    }
    expect(
      balance.right.flatMap((p) => p.players).filter((p) => p.pvpGames! < 10),
    ).toHaveLength(2);
    expect(new Set([...live.left, ...live.right].map((p) => p.id))).toEqual(
      new Set([...balance.left, ...balance.right].map((p) => p.id)),
    );
  });
  it("uses the baseline when live is disabled or experience is unknown", () => {
    const disabled = setup(false);
    expect(
      disabled.service.selectLive(disabled.balance, disabled.settings),
    ).toBe(disabled.balance);
    const unknown = setup();
    unknown.balance.left[0].players[0].pvpGames = null;
    expect(unknown.service.selectLive(unknown.balance, unknown.settings)).toBe(
      unknown.balance,
    );
  });
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("is inert when disabled or for other modes", async () => {
    const disabled = setup(false);
    disabled.service.schedule("room", disabled.balance, disabled.settings);
    const other = setup();
    other.service.schedule(
      "room",
      new GameBalance(
        MatchmakingMode.TURBO,
        other.balance.left,
        other.balance.right,
      ),
      other.settings,
    );
    await flush();
    expect(disabled.repo.save).not.toHaveBeenCalled();
    expect(other.repo.save).not.toHaveBeenCalled();
  });

  it("captures immutable inputs and persists after returning without replacing live teams", async () => {
    const { service, balance, settings, repo } = setup();
    const originalLeft = balance.left;
    service.schedule("room", balance, settings);
    expect(repo.save).not.toHaveBeenCalled();
    balance.left[0].players[0].pvpGames = 0;
    balance.left[0].dodgeList.push("later-change");
    settings.maxTeamScoreDifference = 1;
    await flush();
    const saved = repo.save.mock.calls[0][0];
    expect(saved.input.parties[0].players[0].pvpGames).toBe(131);
    expect(saved.input.parties[0].dodgeList).toEqual([]);
    expect(saved.input.maxTeamScoreDifference).toBe(3500);
    expect(saved.result.status).toBe("compared");
    expect(balance.left).toBe(originalLeft);
    expect(balance.left.map((p) => p.id)).toEqual(
      Array.from({ length: 5 }, (_, i) => `party-${i}`),
    );
  });

  it("contains persistence failures and records unknown legacy stats as skipped", async () => {
    const { service, balance, settings, repo } = setup();
    balance.left[0].players[0].pvpGames = null;
    repo.save.mockRejectedValueOnce(new Error("database unavailable"));
    expect(() => service.schedule("room", balance, settings)).not.toThrow();
    await flush();
    expect(repo.save.mock.calls[0][0].result.status).toBe("insufficient_data");
    expect(Logger.prototype.warn).toHaveBeenCalled();
    service.schedule("room-2", balance, settings);
    await flush();
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it("bounds outstanding writes instead of building an unlimited backlog", async () => {
    const { service, balance, settings, repo } = setup();
    const release: Array<() => void> = [];
    repo.save.mockImplementationOnce(
      () => new Promise<void>((resolve) => release.push(resolve)),
    );
    for (let i = 0; i < 12; i++)
      service.schedule(`room-${i}`, balance, settings);
    await flush();
    expect(repo.save).toHaveBeenCalledTimes(1);
    release.forEach((resolve) => resolve());
    await flush();
    expect(repo.save).toHaveBeenCalledTimes(8);
    service.schedule("room-after-backlog", balance, settings);
    await flush();
    expect(repo.save).toHaveBeenCalledTimes(9);
  });
});
