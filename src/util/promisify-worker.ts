import { Worker } from "worker_threads";

export function promisifyWorker<T>(path: string, workerData?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path, { workerData });

    let settled = false;

    // Receive messages from the worker
    worker.once("message", (msg: T) => {
      if (settled) return;
      settled = true;
      resolve(msg);
      worker.terminate().catch(() => {});
    });

    // Handle worker errors
    worker.once("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
      worker.terminate().catch(() => {});
    });

    // Handle abnormal exits
    worker.once("exit", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        // worker exited normally but didn’t send a message
        reject(new Error("Worker exited without sending a message"));
      } else {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
