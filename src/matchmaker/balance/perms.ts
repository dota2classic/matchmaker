import { performance } from "perf_hooks";
import { Party } from "@/matchmaker/entity/party";
import { BalancePredicate, BalancePredicateFn } from "@/util/predicates";
import { Logger } from "@nestjs/common";
import { join } from "path";
import { promisifyWorker } from "@/util/promisify-worker";
import { construct } from "@/gateway/util/construct";

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
  predicates: BalancePredicateFn[],
) => {
  return (
    predicates.findIndex((predicate) => !predicate(left, right, score)) === -1
  );
};

export function* subsetPairs<T>(
  parties: T[],
  maxTeamSize?: number,
  getSize: (t: T) => number = () => 1,
): Generator<[T[], T[]]> {
  const n = parties.length;

  function* backtrack(
    index: number,
    left: T[],
    right: T[],
    leftSize: number,
    rightSize: number,
  ): Generator<[T[], T[]]> {
    if (index === n) {
      if (left.length > 0 && right.length > 0) {
        yield [left.slice(), right.slice()];
      }
      return;
    }

    const party = parties[index];
    const size = getSize(party);

    // Option 1: put in left
    if (maxTeamSize === undefined || leftSize + size <= maxTeamSize) {
      left.push(party);
      yield* backtrack(index + 1, left, right, leftSize + size, rightSize);
      left.pop();
    }

    // Option 2: put in right
    if (maxTeamSize === undefined || rightSize + size <= maxTeamSize) {
      right.push(party);
      yield* backtrack(index + 1, left, right, leftSize, rightSize + size);
      right.pop();
    }

    // Option 3: leave unused
    yield* backtrack(index + 1, left, right, leftSize, rightSize);
  }

  yield* backtrack(0, [], [], 0, 0);
}

function bestGame(
  combinations: Generator<[Party[], Party[]]>,
  func: (left: Team, right: Team) => number,
  timeLimitation: number,
  predicates: BalancePredicateFn[] = [],
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
  maxTeamSize?: number,
): BalancePair | undefined {
  return bestGame(
    subsetPairs(pool, maxTeamSize, (p) => p.size),
    func,
    timeLimitation,
    predicates.map((t) => (typeof t === "function" ? t : t.fn)),
  );
}

export async function findBestMatchByAsync(
  pool: Party[],
  func: (left: Team, right: Team) => number,
  timeLimitation: number,
  predicates: BalancePredicate[] = [],
  maxTeamSize?: number,
): Promise<BalancePair | undefined> {
  const serializedPredicates = predicates
    .map((it) => {
      if (typeof it === "function") {
        return {
          fn: it,
          context: {},
        };
      } else {
        return it;
      }
    })
    .map((it) => {
      let serializedFunctionWithContext = "(_left, _right) => {\n";
      if (Object.keys(it.context).length > 0) {
        serializedFunctionWithContext += `const { ${Object.keys(it.context).join(", ")} } = ${JSON.stringify(it.context)};\n`;
      }

      serializedFunctionWithContext += `const predicate = ${it.fn.toString()};\n`;

      serializedFunctionWithContext += `return predicate(_left, _right);\n`;

      serializedFunctionWithContext += "}";

      return serializedFunctionWithContext;
    });

  const path = resolveWorkerPath();

  return promisifyWorker(path, {
    pool: pool.map((entry) => ({
      ...entry,
      size: entry.size,
      queueTimeMillis: entry.queueTimeMillis,
    })),
    scoreFn: func.toString(),
    predicates: serializedPredicates,
    timeLimitation,
    maxTeamSize,
  }).then((data: BalancePair | undefined) => {
    if (!data) return undefined;

    data.right = data.right.map((party) => construct(Party, party));
    data.left = data.left.map((party) => construct(Party, party));

    return data;
  });
}

const resolveWorkerPath = () => {
  if (process.env.NODE_ENV === "production") {
    return join(__dirname, "perms.worker.js");
  } else {
    return join(
      __dirname,
      "../../../dist/src/matchmaker/balance",
      "perms.worker.js",
    );
  }
};
