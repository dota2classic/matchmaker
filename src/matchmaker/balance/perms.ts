import { performance } from "perf_hooks";
import { Party } from "@/matchmaker/entity/party";

type Team = Party[];

export interface BalancePair {
  left: Team;
  right: Team;
}

function* subsetSum(
  pool: Party[],
  target: number,
  partial: Party[] = [],
): Generator<Party[]> {
  const plrCount = partial.reduce((a, x) => a + x.size, 0);

  // check if the partial sum is equals to target
  if (plrCount === target) {
    // total.push(partial);
    yield partial;
  }
  if (plrCount >= target) {
    return; // if we reach the number why bother to continue
  }

  for (let i = 0; i < pool.length; i++) {
    const n = pool[i];
    const remaining = pool.slice(i + 1);
    yield* subsetSum(remaining, target, partial.concat([n]));
  }
}

export function findBestMatchBy(
  pool: Party[],
  target: number,
  func: (left: Team, right: Team) => number,
  timeLimitation: number,
  predicate: (left: Team, right: Team, score: number) => boolean = () => true,
): BalancePair | undefined {
  const timeStarted = performance.now();

  let bestScore = Number.MAX_SAFE_INTEGER;
  let bestPair: BalancePair | undefined = undefined;

  const leftG = subsetSum(pool, target);
  for (const left of leftG) {
    const subpool = pool.filter(
      (t) => left.findIndex((leftParty) => leftParty.id === t.id) === -1,
    );

    const rightG = subsetSum(subpool, target);

    for (const right of rightG) {
      const score = func(left, right);
      const passesPredicate = predicate(left, right, score);

      if (!passesPredicate) continue;

      if (score < bestScore) {
        bestScore = score;
        bestPair = { left, right };
      }
      const time = performance.now() - timeStarted;
      if (time > timeLimitation) {
        // We have to quit now
        return bestPair;
      }
    }
  }
  return bestPair;
}
