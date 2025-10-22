// src/workers/heavy.worker.ts
const { parentPort, workerData } = require("worker_threads");
const { findBestMatchBy } = require("./perms");

function heavyCompute(pool, scoreFn, predicates) {
  const compiledPredicates = predicates.map((predSerialized) =>
    eval(predSerialized),
  );

  return findBestMatchBy(pool, eval(scoreFn), 10000, compiledPredicates);
}

// When running as a worker:
if (parentPort) {
  const { pool, scoreFn, predicates } = workerData;
  const result = heavyCompute(pool, scoreFn, predicates);
  parentPort.postMessage(result);
}
