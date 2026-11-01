import { findBestMatchBy, findBestMatchByAsync } from "./perms";
import { fakeParty } from "@/test/useFullModule";
import {
  FixedTeamSizePredicate,
  MakeMaxPlayerScoreDeviationPredicate,
  MakeMaxScoreDifferencePredicate,
} from "@/util/predicates";
import { QueueService } from "@/matchmaker/service/queue.service";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

const gap = (a: Array<{ score: number }>, b: Array<{ score: number }>) =>
  Math.abs(
    a.reduce((s, p) => s + p.score, 0) - b.reduce((s, p) => s + p.score, 0),
  );
function pool() {
  return Array.from({ length: 11 }, (_, i) => {
    const party = fakeParty(
      i === 0 ? 1100 : 1000,
      [`${100 + i}`],
      new Date(Date.now() - 30 * 60_000 + i * 1000),
    );
    party.dodgeList = [];
    return party;
  });
}
describe("oldest feasible groups first", () => {
  it("prefers the oldest eligible player over a perfectly balanced newer set", async () => {
    const parties = pool();
    const predicates = [
      FixedTeamSizePredicate(5),
      MakeMaxScoreDifferencePredicate(3500),
    ];
    const normal = findBestMatchBy(parties, gap, 10000, predicates, 5)!;
    expect(gap(normal.left, normal.right)).toBe(0);
    const result = await findBestMatchByAsync(
      parties,
      gap,
      10000,
      predicates,
      5,
      true,
    );
    const ids = [...result!.left, ...result!.right].map((p) => p.id);
    expect(ids).toContain(parties[0].id);
    expect(ids).not.toContain(parties[10].id);
    expect(gap(result!.left, result!.right)).toBe(100);
  });
  it("skips an incompatible oldest group without blocking the other ten", () => {
    const parties = pool();
    parties[0].score = 100000;
    parties[0].players[0].score = 100000;
    const result = findBestMatchBy(
      parties,
      gap,
      10000,
      [FixedTeamSizePredicate(5), MakeMaxPlayerScoreDeviationPredicate(1000)],
      5,
      true,
    )!;
    expect([...result.left, ...result.right].map((p) => p.id)).not.toContain(
      parties[0].id,
    );
    expect([...result.left, ...result.right]).toHaveLength(10);
  });
  it("ordinary 5v5 does not force incompatible 20-minute groups into every match", async () => {
    const parties = pool();
    parties[0].score = 100000;
    parties[0].players[0].score = 100000;
    parties.forEach((p) => (p.queueModes = [MatchmakingMode.UNRANKED]));
    const service = new QueueService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const settings = Object.assign(new QueueSettings(), {
      maxTeamScoreDifference: 3500,
      maxPlayerScoreDifference: 5500,
      balanceFunctionType: "LOG_WAITING_SCORE",
    });
    const config = (service as any).modeBalancingMap.find(
      (x: any) => x.mode === MatchmakingMode.UNRANKED,
    );
    const results = await service.findGamesForConfig(config, parties, settings);
    expect(results).toHaveLength(1);
    expect(
      [...results[0].left, ...results[0].right].map((p) => p.id),
    ).not.toContain(parties[0].id);
  });
});
