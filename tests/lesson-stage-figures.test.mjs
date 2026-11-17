import assert from "node:assert/strict";
import test from "node:test";
import { applyEvent, initialModel, metricsAt, stateBefore } from "../src/lib/lesson-stage/model.ts";
import { compacted, preferenceList, ringMoved, ringOwner, ringShare, scatter, timelineSpan } from "../src/lib/lesson-stage/figure-model.ts";
import { validateScene } from "../src/lib/lesson-stage/validate.ts";

// ---------- the ring ----------
const ringScene = {
  id: "ring", intro: "Keys and nodes on a ring.", layout: "ring",
  metrics: [{ id: "a", label: "A owns", derive: { share: "a" } }, { id: "moved", label: "Moved", derive: { moved: true } }],
  ring: { size: 100, marks: [0, 25, 50, 75], tokens: [{ id: "A", node: "a", at: 20 }, { id: "B", node: "b", at: 50 }, { id: "C", node: "c", at: 80 }] },
  nodes: [
    { id: "a", role: "cache", label: "Node A", at: [20, 1] },
    { id: "b", role: "cache", label: "Node B", at: [50, 1] },
    { id: "c", role: "cache", label: "Node C", at: [80, 1] },
    { id: "d", role: "cache", label: "Node D", at: [35, 1], appear: 2 },
  ],
  links: [],
  steps: [
    { title: "Keys find their owner", short: "Owners", text: "Each key walks clockwise.", events: [{ type: "key", id: "k15", at: 15 }, { type: "key", id: "k91", at: 91 }] },
    { title: "Exactly on a token", short: "Ties", text: "A token owns its own position.", events: [{ type: "key", id: "k50", at: 50 }, { type: "walk", from: 15, count: 2 }] },
    { title: "D joins", short: "Join", text: "D takes 21 to 35 from B.", events: [{ type: "token", add: [{ id: "D", node: "d", at: 35 }] }, { type: "arc", id: "slice", from: 20, to: 35, tone: "work" }] },
  ],
};

test("a key belongs to the first token at or after it, wrapping past the top", () => {
  const ring = initialModel(ringScene).ring;
  assert.equal(ringOwner(ring, 15).node, "a");
  assert.equal(ringOwner(ring, 63).node, "c");
  assert.equal(ringOwner(ring, 91).node, "a");
  assert.equal(ringOwner(ring, 50).node, "b");
  assert.equal(ringOwner(ring, 0).node, "a");
});

test("shares add up to the whole ring, and a joining token takes only the slice before it", () => {
  const before = initialModel(ringScene).ring;
  assert.equal(ringShare(before, "a"), 0.4);
  assert.equal(ringShare(before, "b") + ringShare(before, "c") + ringShare(before, "a"), 1);
  const after = stateBefore(ringScene, 3).ring;
  assert.equal(ringShare(after, "d"), 0.15);
  assert.equal(ringShare(after, "b"), 0.15);
  assert.equal(ringShare(after, "a"), 0.4);
  assert.equal(ringMoved(before, after), 0.15);
  assert.deepEqual(after.tokens.map((t) => t.id), ["A", "D", "B", "C"]);
});

test("ring metrics are worked out from the ring", () => {
  assert.deepEqual(metricsAt(ringScene, 0).a, { n: 40, unit: "%" });
  assert.deepEqual(metricsAt(ringScene, 2).moved, { n: 15, unit: "%" });
  assert.deepEqual(metricsAt(ringScene, 1).moved, { n: 0, unit: "%" });
});

test("named keys rest on the ring and can be taken off; scatter is the same for the same seed", () => {
  const m = stateBefore(ringScene, 2);
  assert.deepEqual(m.ring.keys.map((k) => k.id), ["k15", "k91", "k50"]);
  applyEvent(m, { type: "key", id: "k15", at: null });
  assert.deepEqual(m.ring.keys.map((k) => k.id), ["k91", "k50"]);
  const dots = scatter(100, 24, 7);
  assert.equal(dots.length, 24);
  assert.deepEqual(dots, scatter(100, 24, 7));
  assert.ok(dots.every((d, i) => d >= 0 && d < 100 && (i === 0 || d >= dots[i - 1])));
});

test("a preference list skips parts already chosen when asked to", () => {
  const ring = { size: 100, tokens: [{ id: "A1", node: "a", at: 10 }, { id: "A2", node: "a", at: 20 }, { id: "B1", node: "b", at: 30 }, { id: "B2", node: "b", at: 40 }, { id: "C1", node: "c", at: 50 }], keys: [], dots: [], arcs: [] };
  assert.deepEqual(preferenceList(ring, 5, 3).map((t) => t.id), ["A1", "A2", "B1"]);
  assert.deepEqual(preferenceList(ring, 5, 3, true).map((t) => t.id), ["A1", "B1", "C1"]);
  assert.deepEqual(preferenceList(ring, 45, 3, true).map((t) => t.id), ["C1", "A1", "B1"]);
});

test("a valid ring scene passes, and ring mistakes are caught", () => {
  assert.deepEqual(validateScene(ringScene), []);
  const broken = structuredClone(ringScene);
  broken.steps[0].events.push({ type: "key", id: "far", at: 120, label: "far too long" }, { type: "token", remove: ["Z"] }, { type: "append", log: "x", records: [{ text: "1" }] });
  broken.nodes[0].at = [20, 5];
  const problems = validateScene(broken).join("\n");
  assert.match(problems, /key at 120 is not a position/);
  assert.match(problems, /longer than 8 characters/);
  assert.match(problems, /removes token "Z"/);
  assert.match(problems, /needs a log/);
  assert.match(problems, /stands at \[20,5\]/);
});

// ---------- logs ----------
const logScene = {
  id: "logs", intro: "A topic split into partitions.",
  metrics: [{ id: "lag", label: "Billing lag", derive: { lag: ["p0", "billing"] } }],
  nodes: [{ id: "producer", role: "client", label: "Checkout", at: [0, 0] }, { id: "broker", role: "queue", label: "Kafka", at: [1, 0] }],
  links: [{ from: "producer", to: "broker" }],
  logs: [
    { id: "p0", node: "broker", label: "Partition 0", start: 1040, records: [{ text: "811 paid", key: "811" }] },
    { id: "mem", node: "broker", label: "Memtable", sorted: true },
    { id: "sst", node: "broker", label: "File 1", appear: 2 },
  ],
  steps: [
    { title: "Records join the end", short: "Append", text: "Each record gets the next offset.", events: [{ type: "append", log: "p0", from: "producer", records: [{ text: "812 new", key: "812" }, { text: "812 paid", key: "812" }] }, { type: "cursor", log: "p0", id: "billing", at: 1040, label: "billing" }] },
    { title: "A memtable keeps keys in order", short: "Sorted", text: "Then it is written out.", events: [{ type: "append", log: "mem", records: [{ text: "b", key: "b" }, { text: "a", key: "a" }, { text: "b2", key: "b" }] }, { type: "read", log: "p0", at: 1041 }] },
    { title: "Flush and compact", short: "Compact", text: "Old versions go.", events: [{ type: "flush", from: "mem", to: "sst" }, { type: "compact", log: "p0" }, { type: "cursor", log: "p0", id: "billing", at: "end" }] },
  ],
};

test("appends take the next offsets, and a cursor's lag counts what is left to read", () => {
  const m = stateBefore(logScene, 1);
  assert.deepEqual(m.logs.p0.records.map((r) => r.offset), [1040, 1041, 1042]);
  assert.equal(m.logs.p0.next, 1043);
  assert.equal(metricsAt(logScene, 0).lag, 3);
  assert.equal(metricsAt(logScene, 2).lag, 0);
});

test("a sorted log keeps one record per key in key order; a flush moves them all and shows the target", () => {
  const m = stateBefore(logScene, 2);
  assert.deepEqual(m.logs.mem.records.map((r) => r.text), ["a", "b2"]);
  assert.equal(m.logs.sst.visible, false);
  const end = stateBefore(logScene, 3);
  assert.deepEqual(end.logs.mem.records, []);
  assert.deepEqual(end.logs.sst.records.map((r) => r.text), ["a", "b2"]);
  assert.equal(end.logs.sst.visible, true);
});

test("compaction keeps each key's newest record and drops tombstones with what they hide", () => {
  const records = [
    { text: "x1", key: "x", offset: 0, seg: 0 }, { text: "y1", key: "y", offset: 1, seg: 0 }, { text: "note", offset: 2, seg: 0 },
    { text: "x2", key: "x", offset: 3, seg: 1 }, { text: "y gone", key: "y", tomb: true, offset: 4, seg: 1 },
  ];
  assert.deepEqual(compacted(records).map((r) => r.text), ["note", "x2"]);
  const m = stateBefore(logScene, 3);
  assert.deepEqual(m.logs.p0.records.map((r) => [r.offset, r.text]), [[1040, "811 paid"], [1042, "812 paid"]]);
  assert.ok(m.logs.p0.records.every((r) => r.seg === 0));
  assert.equal(m.logs.p0.seg, 1);
});

test("merging logs empties and hides them; roll, truncate and record change a log in place", () => {
  const m = initialModel({ ...logScene, logs: [{ id: "a", node: "broker", records: [{ text: "k1", key: "k" }] }, { id: "b", node: "broker", records: [{ text: "k2", key: "k" }, { text: "j", key: "j" }] }] });
  applyEvent(m, { type: "compact", log: "b", merge: ["a"] });
  assert.deepEqual(m.logs.b.records.map((r) => r.text), ["k2", "j"]);
  assert.equal(m.logs.a.visible, false);
  applyEvent(m, { type: "roll", log: "b" });
  applyEvent(m, { type: "roll", log: "b" });
  applyEvent(m, { type: "append", log: "b", records: [{ text: "n" }, { text: "o" }] });
  assert.deepEqual(m.logs.b.records.map((r) => r.seg), [0, 0, 1, 1]);
  applyEvent(m, { type: "record", log: "b", at: m.logs.b.records[2].offset, tone: "hot", text: "late" });
  assert.equal(m.logs.b.records[2].tone, "hot");
  applyEvent(m, { type: "truncate", log: "b", after: m.logs.b.records[2].offset });
  assert.deepEqual(m.logs.b.records.map((r) => r.text), ["k2", "j", "late"]);
  assert.equal(m.logs.b.next, m.logs.b.records[2].offset + 1);
});

test("a valid log scene passes, and log mistakes are caught", () => {
  assert.deepEqual(validateScene(logScene), []);
  const broken = structuredClone(logScene);
  broken.steps[0].events.push({ type: "read", log: "p0", at: 9999 }, { type: "append", log: "nope", records: [{ text: "a record too long" }] }, { type: "cursor", log: "p0", id: "far", at: 5000 });
  broken.steps[1].metrics = { lag: 4 };
  const problems = validateScene(broken).join("\n");
  assert.match(problems, /unknown log "nope"/);
  assert.match(problems, /longer than 12 characters/);
  assert.match(problems, /reads offset 9999/);
  assert.match(problems, /past the end of log "p0"/);
  assert.match(problems, /works out itself/);
});

// ---------- the timeline ----------
const timelineScene = {
  id: "lost", intro: "Two payments read the same balance.", layout: "timeline",
  timeline: { ticks: [0, 2, 4], unit: "ms" },
  metrics: [{ id: "now", label: "Time", derive: { clock: true } }],
  nodes: [
    { id: "a", role: "client", label: "Payment A", at: [0, 0] },
    { id: "row", role: "database", label: "Wallet", at: [1, 0] },
    { id: "b", role: "client", label: "Payment B", at: [2, 0] },
  ],
  links: [],
  steps: [
    { title: "Both read 100", short: "Read", text: "Each reads the balance.", events: [
      { type: "packet", path: ["a", "row"], label: "read" }, { type: "packet", path: ["b", "row"], label: "read", with: true },
      { type: "packet", path: ["row", "a"], label: "100", kind: "response" }, { type: "packet", path: ["row", "b"], label: "100", kind: "response", with: true },
    ] },
    { title: "A holds the lock", short: "Lock", text: "A writes 70.", events: [
      { type: "span", id: "lock", node: "a", label: "row lock", tone: "work" }, { type: "packet", path: ["a", "row"], label: "write 70" },
      { type: "mark", node: "row", text: "70" }, { type: "span", id: "lock", end: true },
    ] },
    { title: "Start again", short: "Again", text: "Replay with an atomic update.", events: [{ type: "rewind" }, { type: "mark", node: "row", text: "100", t: 1 }] },
  ],
};

test("timeline items take their times from the clock, `with` and explicit t", () => {
  const m = stateBefore(timelineScene, 1);
  const msgs = m.timeline.items.map((i) => [i.label, i.t0, i.t1]);
  assert.deepEqual(msgs, [["read", 0, 1], ["read", 0, 1], ["100", 1, 2], ["100", 1, 2]]);
  assert.equal(m.timeline.clock, 2);
  const after = stateBefore(timelineScene, 2).timeline;
  const lock = after.items.find((i) => i.kind === "span");
  assert.deepEqual([lock.t0, lock.t1], [2, 3.5]);
  assert.deepEqual(after.items.find((i) => i.kind === "mark").t, 3);
  assert.equal(after.clock, 3.5);
});

test("rewind clears the timeline; the span covers the furthest the story reaches", () => {
  const m = stateBefore(timelineScene, 3).timeline;
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].t, 1);
  assert.equal(timelineSpan(timelineScene), 3.5);
  assert.deepEqual(metricsAt(timelineScene, 0).now, { n: 2, unit: " ms" });
});

test("packets stay on a timeline but leave nothing in the tiers", () => {
  const m = initialModel(timelineScene);
  applyEvent(m, { type: "packet", path: ["a", "row"], label: "x" });
  assert.equal(m.timeline.items.length, 1);
});

test("a valid timeline passes, and timeline mistakes are caught", () => {
  assert.deepEqual(validateScene(timelineScene), []);
  const broken = structuredClone(timelineScene);
  broken.links = [{ from: "a", to: "row" }];
  broken.nodes[2].at = [1, 0];
  broken.steps[0].events.push({ type: "packet", path: ["a", "row", "b"], label: "hop" }, { type: "span", id: "never", end: true }, { type: "mark", node: "a", text: "a mark that is far too long" });
  const problems = validateScene(broken).join("\n");
  assert.match(problems, /draws no links/);
  assert.match(problems, /share a lifeline/);
  assert.match(problems, /a path of two parts/);
  assert.match(problems, /ends span "never"/);
  assert.match(problems, /longer than 18 characters/);
  const tiers = structuredClone(logScene);
  tiers.steps[0].events.push({ type: "mark", node: "broker", text: "x", t: 2 });
  assert.match(validateScene(tiers).join("\n"), /needs the timeline layout[\s\S]*only a timeline uses|only a timeline uses[\s\S]*needs the timeline layout/);
});
