export type CacheModelInput = {
  requestsPerSecond: number;
  hitRatePercent: number;
  cacheAvailable: boolean;
  databaseCapacity: number;
};

/** An illustrative steady-state read model, not a benchmark or latency forecast. */
export function modelCacheReads(input: CacheModelInput) {
  const { requestsPerSecond, hitRatePercent, cacheAvailable, databaseCapacity } = input;
  if (!Number.isFinite(requestsPerSecond) || requestsPerSecond < 0) {
    throw new RangeError("Read demand must be a finite, nonnegative number.");
  }
  if (!Number.isFinite(hitRatePercent) || hitRatePercent < 0 || hitRatePercent > 100) {
    throw new RangeError("Cache hit rate must be between zero and one hundred.");
  }
  if (!Number.isFinite(databaseCapacity) || databaseCapacity <= 0) {
    throw new RangeError("Example database capacity must be a finite, positive number.");
  }

  const healthyDatabaseReads = requestsPerSecond * (100 - hitRatePercent) / 100;
  const databaseReads = cacheAvailable ? healthyDatabaseReads : requestsPerSecond;
  const cacheReads = requestsPerSecond - databaseReads;

  return {
    cacheReads,
    databaseReads,
    healthyDatabaseReads,
    capacityRatio: databaseReads / databaseCapacity,
    excessReads: Math.max(0, databaseReads - databaseCapacity),
    spareCapacity: Math.max(0, databaseCapacity - databaseReads),
    exceedsCapacity: databaseReads > databaseCapacity,
  };
}
