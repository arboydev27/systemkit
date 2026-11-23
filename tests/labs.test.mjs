import test from "node:test";
import assert from "node:assert/strict";
import { histogram, limiterAlgorithms, limiterTraffic, runLimiters } from "../src/lib/labs/rate-limiter.ts";
import { clampQuorum, modelQuorum } from "../src/lib/labs/quorum.ts";
import { RETRY_DEFAULTS, simulateRetries } from "../src/lib/labs/retry-storm.ts";
import { buildDrill, drillTemplates, gradeDrill, nextDrillId, parseQuantity } from "../src/lib/estimation-drills.ts";

const peak = (results, id) => results.find((result) => result.algorithm === id).peakInWindow;

test("a burst across a fixed window boundary admits twice the limit, while exact limiters hold", () => {
  const { results, arrivals } = runLimiters({ limit: 100, windowSeconds: 60, traffic: "edge-burst" });
  assert.equal(arrivals.length, 200);
  assert.equal(peak(results, "fixed-window"), 200);
  assert.equal(peak(results, "sliding-log"), 100);
  assert.ok(peak(results, "token-bucket") <= 121, "a token bucket admits its capacity plus what refills during the burst");
  assert.ok(peak(results, "sliding-counter") <= 120, "the weighted estimate limits most of the burst");
});

test("no limiter admits more than arrived, and a sliding log never exceeds its limit on any shape", () => {
  for (const traffic of ["edge-burst", "steady", "spike"]) {
    const { results, arrivals } = runLimiters({ limit: 60, windowSeconds: 30, traffic });
    assert.equal(results.length, limiterAlgorithms.length);
    for (const result of results) assert.equal(result.allowed.length + result.rejected, arrivals.length);
    assert.ok(peak(results, "sliding-log") <= 60, traffic);
    assert.ok(peak(results, "token-bucket") <= 60 * 2, traffic);
  }
});

test("traffic is repeatable and histograms keep every request", () => {
  const input = { limit: 50, windowSeconds: 20, traffic: "spike" };
  assert.deepEqual(limiterTraffic(input), limiterTraffic(input));
  const times = limiterTraffic(input);
  assert.equal(histogram(times, 0, 60_000, 30).reduce((sum, count) => sum + count, 0), times.length);
});

test("overlapping quorums cannot return stale reads, whichever reachable replicas answer", () => {
  for (let n = 3; n <= 7; n++) for (let w = 1; w <= n; w++) for (let r = 1; r <= n; r++) {
    for (const down of [[], [0], [n - 1], [0, 1]]) {
      const result = modelQuorum({ n, w, r, down });
      if (w + r > n) assert.equal(result.staleReadChance, 0, `n=${n} w=${w} r=${r} down=${down}`);
      assert.ok(result.staleReadChance >= 0 && result.staleReadChance <= 1);
    }
  }
});

test("quorum results match worked cases", () => {
  assert.equal(modelQuorum({ n: 3, w: 2, r: 2, down: [] }).staleReadChance, 0);
  assert.ok(Math.abs(modelQuorum({ n: 3, w: 1, r: 1, down: [] }).staleReadChance - 2 / 3) < 1e-9);
  assert.ok(Math.abs(modelQuorum({ n: 5, w: 2, r: 2, down: [] }).staleReadChance - 3 / 10) < 1e-9);
  // The only holder is down, so every reachable copy is old.
  assert.equal(modelQuorum({ n: 3, w: 1, r: 1, down: [0] }).staleReadChance, 1);
  const unavailable = modelQuorum({ n: 3, w: 2, r: 2, down: [0, 1] });
  assert.equal(unavailable.canWrite, false);
  assert.equal(unavailable.canRead, false);
  assert.deepEqual(clampQuorum({ n: 99, w: 99, r: 0, down: [0, 0, 50] }), { n: 7, w: 7, r: 1, down: [0] });
});

test("immediate retries keep a service down after a brief outage", () => {
  const result = simulateRetries(RETRY_DEFAULTS);
  assert.equal(result.recoveryAfter, null, "the outage has ended, but the overload sustains itself");
  assert.ok(result.amplification > 2);
});

test("without retries the service recovers once the backlog drains", () => {
  const result = simulateRetries({ ...RETRY_DEFAULTS, maxRetries: 0 });
  assert.notEqual(result.recoveryAfter, null);
  assert.equal(result.amplification, 1);
});

test("shedding expired work recovers sooner than serving requests nobody is waiting for", () => {
  const serving = simulateRetries({ ...RETRY_DEFAULTS, maxRetries: 0 });
  const shedding = simulateRetries({ ...RETRY_DEFAULTS, maxRetries: 0, shedExpired: true });
  assert.ok(shedding.recoveryAfter < serving.recoveryAfter);
  assert.ok(shedding.successShare > serving.successShare);
});

test("a retry budget with jitter and shedding recovers where unlimited retries do not", () => {
  const guarded = simulateRetries({ ...RETRY_DEFAULTS, backoff: "jitter", retryBudget: true, shedExpired: true });
  assert.notEqual(guarded.recoveryAfter, null);
  assert.ok(guarded.amplification < simulateRetries(RETRY_DEFAULTS).amplification);
  assert.ok(guarded.successShare > simulateRetries(RETRY_DEFAULTS).successShare);
});

test("dropping expired work still lets clients retry, and it breaks the loop retries alone cannot", () => {
  const shedding = simulateRetries({ ...RETRY_DEFAULTS, shedExpired: true });
  assert.ok(shedding.amplification > 1, "clients still retry when the queue drops their abandoned work");
  assert.notEqual(shedding.recoveryAfter, null);
  assert.equal(simulateRetries({ ...RETRY_DEFAULTS, backoff: "jitter" }).recoveryAfter, null, "backoff alone delays the same retries");
});

test("a healthy service with no outage does nothing surprising", () => {
  const result = simulateRetries({ ...RETRY_DEFAULTS, outageSeconds: 0 });
  assert.equal(result.recoveryAfter, 0);
  assert.equal(result.amplification, 1);
  assert.ok(result.ticks.every((tick) => Math.abs(tick.goodput - RETRY_DEFAULTS.arrivalRate) < 1e-6));
});

test("simulation is repeatable", () => {
  assert.deepEqual(simulateRetries(RETRY_DEFAULTS), simulateRetries(RETRY_DEFAULTS));
});

test("every drill template builds repeatable, positive, finite answers across seeds", () => {
  for (const template of drillTemplates) for (let seed = 0; seed < 200; seed++) {
    const drill = buildDrill(`${template}.${seed}`);
    assert.ok(drill.prompt && drill.unit && drill.steps.length, template);
    assert.ok(Number.isFinite(drill.answer) && drill.answer > 0, `${template}.${seed}`);
    assert.deepEqual(buildDrill(`${template}.${seed}`), drill);
  }
});

test("worked drill arithmetic is correct", () => {
  // 86,400 seconds a day is the only constant, so check one template by its own stated inputs.
  const drill = buildDrill("availability.1");
  const target = Number(drill.prompt.match(/promises ([\d.]+)%/)[1]);
  assert.ok(Math.abs(drill.answer - 43200 * (1 - target / 100)) < 1e-6);
  const qps = buildDrill("qps.3");
  const [, users, actions, peakFactor] = qps.prompt.match(/(\d+) million.*makes (\d+) requests.*at (\d+) times/);
  assert.ok(Math.abs(qps.answer - (Number(users) * 1e6 * Number(actions) * Number(peakFactor)) / 86400) < 1e-6);
});

test("unknown drill links are rejected rather than crashing", () => {
  for (const id of ["nope.1", "qps.x", "qps.-1", "constructor.1", ""]) assert.equal(buildDrill(id), undefined, id);
});

test("drills rotate through templates", () => {
  const first = nextDrillId(null, 4);
  assert.equal(first, `${drillTemplates[0]}.4`);
  assert.equal(nextDrillId(first, 5), `${drillTemplates[1]}.5`);
  assert.equal(nextDrillId(`${drillTemplates.at(-1)}.9`, 6), `${drillTemplates[0]}.6`);
});

test("quantities parse the way people write them", () => {
  assert.equal(parseQuantity("1,200", "requests per second"), 1200);
  assert.equal(parseQuantity("1.2k", "requests per second"), 1200);
  assert.equal(parseQuantity("2 million", "requests per second"), 2e6);
  assert.equal(parseQuantity("5e3", "servers"), 5000);
  assert.equal(parseQuantity("~40", "minutes"), 40);
  assert.equal(parseQuantity("2000 GB", "TB"), 2);
  assert.equal(parseQuantity("3 TB", "TB"), 3);
  assert.equal(parseQuantity("lots", "TB"), undefined);
  assert.equal(parseQuantity("", "TB"), undefined);
});

test("drill grades use the ratio in both directions", () => {
  assert.equal(gradeDrill(1000, 1100), "on-target");
  assert.equal(gradeDrill(1000, 800), "on-target");
  assert.equal(gradeDrill(1000, 1900), "ballpark");
  assert.equal(gradeDrill(1000, 501), "ballpark");
  assert.equal(gradeDrill(1000, 5000), "off");
  assert.equal(gradeDrill(1000, 0), "off");
});
