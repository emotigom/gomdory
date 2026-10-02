export type BatchRunResult<T> = { batch: T; ok: true } | { batch: T; ok: false; code: "BATCH_FAILED" };
export function splitIntoBatches<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("batch size must be a positive integer");
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}
export async function runBatchesWithConcurrency<T>(batches: readonly T[], run: (batch: T) => Promise<void>, concurrency = 2): Promise<Array<BatchRunResult<T>>> {
  let cursor = 0;
  const results: Array<BatchRunResult<T> | undefined> = new Array(batches.length);
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= batches.length) return;
      try { await run(batches[index]); results[index] = { batch: batches[index], ok: true }; }
      catch { results[index] = { batch: batches[index], ok: false, code: "BATCH_FAILED" }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), batches.length) }, worker));
  return results.filter((item): item is BatchRunResult<T> => item !== undefined);
}
