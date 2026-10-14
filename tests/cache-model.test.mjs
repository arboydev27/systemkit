import assert from "node:assert/strict";
import test from "node:test";
import { modelCacheReads } from "../src/lib/cache-model.ts";

const example = {
  requestsPerSecond: 1000,
  hitRatePercent: 90,
  cacheAvailable: true,
  databaseCapacity: 300,
};

test("losing a healthy 90% cache increases database demand tenfold", () => {
  const healthy = modelCacheReads(example);
  const failed = modelCacheReads({ ...example, cacheAvailable: false });
  assert.equal(healthy.databaseReads, 100);
  assert.equal(healthy.cacheReads, 900);
  assert.equal(failed.databaseReads, 1000);
  assert.equal(failed.databaseReads / healthy.databaseReads, 10);
  assert.equal(failed.cacheReads, 0);
  assert.equal(failed.excessReads, 700);
  assert.equal(failed.exceedsCapacity, true);
});

test("cache misses and hits account for all incoming reads across the supported range", () => {
  for (const requestsPerSecond of [0, 100, 700, 1000, 5000]) {
    for (const hitRatePercent of [0, 1, 50, 70, 90, 99, 100]) {
      for (const cacheAvailable of [true, false]) {
        const result = modelCacheReads({ ...example, requestsPerSecond, hitRatePercent, cacheAvailable });
        assert.equal(result.databaseReads + result.cacheReads, requestsPerSecond);
        assert.ok(result.databaseReads >= 0 && result.databaseReads <= requestsPerSecond);
        if (!cacheAvailable) assert.equal(result.databaseReads, requestsPerSecond);
      }
    }
  }
});

test("a full cache hit rate avoids database reads only while the cache is available", () => {
  assert.equal(modelCacheReads({ ...example, hitRatePercent: 100 }).databaseReads, 0);
  assert.equal(modelCacheReads({ ...example, hitRatePercent: 100, cacheAvailable: false }).databaseReads, 1000);
});

test("exactly reaching example capacity leaves no headroom without being above it", () => {
  const result = modelCacheReads({ ...example, hitRatePercent: 70 });
  assert.equal(result.databaseReads, 300);
  assert.equal(result.capacityRatio, 1);
  assert.equal(result.exceedsCapacity, false);
  assert.equal(result.spareCapacity, 0);
  assert.equal(result.excessReads, 0);
});

test("higher hit rates reduce database reads, while a failed cache ignores its usual hit rate", () => {
  let previous = Infinity;
  for (let hitRatePercent = 0; hitRatePercent <= 100; hitRatePercent += 1) {
    const healthy = modelCacheReads({ ...example, hitRatePercent });
    assert.ok(healthy.databaseReads <= previous);
    previous = healthy.databaseReads;
    assert.equal(modelCacheReads({ ...example, hitRatePercent, cacheAvailable: false }).databaseReads, 1000);
  }
});

test("invalid demand, hit rate, or capacity cannot produce a misleading result", () => {
  for (const requestsPerSecond of [-1, Infinity, NaN]) {
    assert.throws(() => modelCacheReads({ ...example, requestsPerSecond }), RangeError);
  }
  for (const hitRatePercent of [-1, 101, NaN]) {
    assert.throws(() => modelCacheReads({ ...example, hitRatePercent }), RangeError);
  }
  for (const databaseCapacity of [0, -1, Infinity, NaN]) {
    assert.throws(() => modelCacheReads({ ...example, databaseCapacity }), RangeError);
  }
});
