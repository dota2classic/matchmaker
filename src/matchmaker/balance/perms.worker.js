// src/workers/heavy.worker.ts
const { parentPort, workerData } = require("worker_threads");
console.log(__dirname)
const { findBestMatchBy } = require("./perms");

// show fatal errors in worker stderr
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception in worker:", err);
});
process.on("unhandledRejection", (r) => {
  console.error("Unhandled rejection in worker:", r);
});

function heavyCompute(pool, scoreFn, predicates, timeLimitation = 10000) {
  const compiledPredicates = predicates.map((predSerialized) =>
    eval(predSerialized),
  );

  const balance = findBestMatchBy(
    pool,
    eval(scoreFn),
    timeLimitation,
    compiledPredicates,
  );

  if (!balance) return undefined;

  const mapper = (entry) => ({
    ...entry,
    size: entry.size,
    queueTimeMillis: entry.queueTimeMillis,
  });

  return {
    left: balance.left.map(mapper),
    right: balance.right.map(mapper),
  };
}

// When running as a worker:
if (parentPort) {
  const { pool, scoreFn, predicates, timeLimitation } = workerData;
  const result = heavyCompute(pool, scoreFn, predicates, timeLimitation);
  parentPort.postMessage(result);
}
