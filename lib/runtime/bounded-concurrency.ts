export async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  maxConcurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 128) {
    throw new RangeError("maxConcurrency must be an integer between 1 and 128");
  }
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(maxConcurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function mapSettledWithConcurrencyLimit<T, R>(
  items: readonly T[],
  maxConcurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  return mapWithConcurrencyLimit(items, maxConcurrency, async (item, index) => {
    try {
      return { status: "fulfilled", value: await worker(item, index) } as PromiseFulfilledResult<R>;
    } catch (reason) {
      return { status: "rejected", reason } as PromiseRejectedResult;
    }
  });
}

export const BOUNDED_CONCURRENCY_READINESS = {
  schemaVersion: "velmere.bounded-concurrency.v1",
  stableOrdering: true,
  rejectsInvalidConcurrency: true,
  settledVariantAvailable: true,
  productionBoundary:
    "Use this for request-scoped fan-out. It limits simultaneous work inside one request but does not replace durable job queues, provider-specific quotas, distributed rate limits or process-level concurrency budgets.",
} as const;
