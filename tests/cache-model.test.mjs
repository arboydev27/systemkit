import assert from "node:assert/strict";
import test from "node:test";
import { modelCacheReads } from "../src/lib/cache-model.ts";

// The lab's opening values, which are the cache lesson's example: 10,000 reads/s, a 95% hit rate,
// and an example database that takes 3,000 reads/s.
const example = {
  requestsPerSecond: 10000,
  hitRatePercent: 95,
  cacheAvailable: true,
  databaseCapacity: 3000,
};

test("losing a healthy 95% cache increases database demand twentyfold", () => {
  const healthy = modelCacheReads(example);
  const failed = modelCacheReads({ ...example, cacheAvailable: false });
  assert.equal(healthy.databaseReads, 500);
  assert.equal(healthy.cacheReads, 9500);
  assert.equal(failed.databaseReads, 10000);
  assert.equal(failed.databaseReads / healthy.databaseReads, 20);
  assert.equal(failed.cacheReads, 0);
  assert.equal(failed.excessReads, 7000);
  assert.equal(failed.exceedsCapacity, true);
});

test("the lesson's example holds: both healthy hit rates fit the database, a cache outage does not", () => {
  const at95 = modelCacheReads(example);
  const at90 = modelCacheReads({ ...example, hitRatePercent: 90 });
  const down = modelCacheReads({ ...example, cacheAvailable: false });
  assert.equal(at95.databaseReads, 500);
  assert.equal(at90.databaseReads, 1000);
  assert.equal(down.databaseReads, 10000);
  assert.equal(at95.exceedsCapacity, false);
  assert.equal(at90.exceedsCapacity, false);
  assert.equal(down.exceedsCapacity, true);
});

test("cache misses and hits account for all incoming reads across the supported range", () => {
  for (const requestsPerSecond of [0, 1000, 7000, 10000, 50000]) {
    for (const hitRatePercent of [0, 1, 50, 70, 90, 95, 99, 100]) {
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
  assert.equal(modelCacheReads({ ...example, hitRatePercent: 100, cacheAvailable: false }).databaseReads, 10000);
});

test("exactly reaching example capacity leaves no headroom without being above it", () => {
  const result = modelCacheReads({ ...example, hitRatePercent: 70 });
  assert.equal(result.databaseReads, 3000);
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
    assert.equal(modelCacheReads({ ...example, hitRatePercent, cacheAvailable: false }).databaseReads, 10000);
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
