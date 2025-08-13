import { performance } from "perf_hooks";
import { Party } from "@/matchmaker/entity/party";
import { BalancePredicate } from "@/util/predicates";

export type Team = Party[];

export interface BalancePair {
  left: Team;
  right: Team;
}

const passesPredicates = (
  left: Party[],
  right: Party[],
  score: number,
  predicates: BalancePredicate[],
) => {
  return (
    predicates.findIndex((predicate) => !predicate(left, right, score)) === -1
  );
};

function* subsetPairs(parties: Party[]): Generator<[Party[], Party[]]> {
  const n = parties.length;
  const totalCombinations = 1 << n; // 2^n possible subsets

  // Ensure first party is always in group A to avoid mirrored duplicates
  for (let mask = 1; mask < totalCombinations - 1; mask++) {
    if ((mask & 1) === 0) continue;

    const groupA: Party[] = [];
    const groupB: Party[] = [];

    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        groupA.push(parties[i]);
      } else {
        groupB.push(parties[i]);
      }
    }

    yield [groupA, groupB];
  }
}

function bestGame(
  combinations: Generator<[Party[], Party[]]>,
  func: (left: Team, right: Team) => number,
  timeLimitation: number,
  predicates: BalancePredicate[] = [],
) {
  const timeStarted = performance.now();

  let bestScore = Number.MAX_SAFE_INTEGER;
  let bestPair: BalancePair | undefined = undefined;

  for (const [left, right] of combinations) {
    const score = func(left, right);

    if (!passesPredicates(left, right, score, predicates)) {
      continue;
    }

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

  return bestPair;
}

export function findBestMatchBy(
  pool: Party[],
  func: (left: Team, right: Team) => number,
  timeLimitation: number,
  predicates: BalancePredicate[] = [],
): BalancePair | undefined {
  return bestGame(subsetPairs(pool), func, timeLimitation, predicates);
}
