import { performance } from "perf_hooks";
import { Party } from "@/matchmaker/entity/party";
import { BalancePredicate } from "@/util/predicates";
import { Logger } from "@nestjs/common";

const logger = new Logger("Permutations");

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

export function* subsetPairs<T>(parties: T[]): Generator<[T[], T[]]> {
  const n = parties.length;

  function* backtrack(
    index: number,
    left: T[],
    right: T[],
  ): Generator<[T[], T[]]> {
    if (index === n) {
      if (left.length > 0 && right.length > 0) {
        yield [left.slice(), right.slice()];
      }
      return;
    }

    const party = parties[index];

    // Option 1: put in left
    left.push(party);
    yield* backtrack(index + 1, left, right);
    left.pop();

    // Option 2: put in right
    right.push(party);
    yield* backtrack(index + 1, left, right);
    right.pop();

    // Option 3: leave unused
    yield* backtrack(index + 1, left, right);
  }

  yield* backtrack(0, [], []);
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
    const time = performance.now() - timeStarted;
    if (time > timeLimitation) {
      logger.warn("Exceeded time limitation: exiting early", time);
      // We have to quit now
      return bestPair;
    }
    const score = func(left, right);

    if (!passesPredicates(left, right, score, predicates)) {
      continue;
    }

    if (score < bestScore) {
      bestScore = score;
      bestPair = { left, right };
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
