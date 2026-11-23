import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Read from one point in time", on three lifelines: the nightly job, the concert’s sales row and the purchase. At
// read committed the job reads 480 seats, a purchase of 4 seats at $50 commits (484 seats, $24,200), and the job reads
// revenue of $24,200, expects 480 × $50 = $24,000 and raises a false alarm over the $200 gap: read skew. Replayed with
// snapshot isolation (MVCC), the job runs as Txn 100 on a snapshot of 480 seats and $24,000; the purchase runs as Txn 102
// and adds a version tagged 102 (484, $24,200) beside the old one, so the row holds two; Txn 100 skips version 102 and
// still reads $24,000, with no read locks and no purchase blocked. The cost: a dashed "old version" span on the row runs
// from Txn 102’s commit for as long as Txn 100’s snapshot is open, vacuum can’t remove it (the text and changes say so),
// and once Txn 100 commits vacuum removes it. The row’s cards and the Row versions metric show 1, 2, then 1.
export const txSnapshotStage: StageScene = {
  id: "tx-snapshot",
  layout: "timeline",
  intro: "Watch a nightly job read a concert’s sales while a purchase commits, then replay it with each read from one snapshot.",
  metrics: [
    { id: "seats", label: "Seats read" },
    { id: "revenue", label: "Revenue read" },
    { id: "versions", label: "Row versions" },
  ],
  nodes: [
    { id: "job", role: "client", label: "Nightly job", detail: "reconciles sales", at: [0, 0] },
    { id: "sales", role: "row", label: "Concert sales", detail: "seats and revenue", at: [1, 0], opts: { count: 1 } },
    { id: "buy", role: "client", label: "Purchase", detail: "4 seats at $50", at: [2, 0] },
  ],
  links: [],
  steps: [
    {
      title: "The job reads 480 seats",
      short: "Seats read",
      text: "A nightly job reconciles a concert’s sales at read committed, reading sold_seats and then revenue as two statements. Its first read returns 480 seats, the latest committed value.",
      facts: [["Isolation", "read committed"]],
      metrics: { seats: 480, versions: 1 },
      changes: ["+ Job reads 480 seats"],
      events: [
        { type: "packet", path: ["job", "sales"], label: "read seats" },
        { type: "packet", path: ["sales", "job"], label: "480", kind: "response" },
      ],
    },
    {
      title: "A purchase of 4 seats commits",
      short: "Purchase",
      text: "Before the job’s second read, a purchase of 4 seats at $50 commits. Concert sales now holds 484 seats and $24,200 of revenue, and both values are committed.",
      focus: ["sales", "buy"],
      facts: [["Purchase", "4 × $50 = $200"]],
      changes: ["~ Sales: 484 seats, $24,200"],
      events: [
        { type: "packet", path: ["buy", "sales"], label: "+4 seats" },
        { type: "mark", node: "sales", text: "480 → 484", tone: "work" },
        { type: "mark", node: "buy", text: "commit", tone: "work", with: true },
      ],
    },
    {
      title: "Read skew: a false $200 gap",
      short: "Read skew",
      text: "The job reads revenue: $24,200. It expects 480 × $50 = $24,000 and raises a false alarm over the $200 gap. Nothing uncommitted was seen; its two reads came from different moments. This is read skew.",
      facts: [["Expects", "480 × $50 = $24,000"], ["Reads", "$24,200"]],
      metrics: { revenue: "$24,200" },
      changes: ["+ Job reads $24,200", "+ False alarm over $200"],
      events: [
        { type: "packet", path: ["job", "sales"], label: "read revenue" },
        { type: "packet", path: ["sales", "job"], label: "24,200", kind: "response" },
        { type: "mark", node: "job", text: "false alarm", tone: "hot" },
      ],
    },
    {
      title: "Txn 100 reads from one snapshot",
      short: "Snapshot",
      text: "Replay the job with snapshot isolation. It runs as Txn 100, and its snapshot holds only what had committed when the snapshot was taken: 480 seats and $24,000. Its first read returns 480.",
      facts: [["Isolation", "snapshot (MVCC)"], ["Txn 100 sees", "480 · $24,000"]],
      metrics: { seats: 480, revenue: "—", versions: 1 },
      changes: ["~ Snapshot isolation", "+ Txn 100’s snapshot", "+ Txn 100 reads 480 seats"],
      events: [
        { type: "rewind" },
        { type: "state", node: "job", label: "Txn 100", detail: "the nightly job" },
        { type: "state", node: "buy", label: "Txn 102", detail: "the purchase", with: true },
        { type: "span", id: "snap", node: "job", label: "snapshot", tone: "work" },
        { type: "packet", path: ["job", "sales"], label: "read seats" },
        { type: "packet", path: ["sales", "job"], label: "480", kind: "response" },
      ],
    },
    {
      title: "Txn 102 adds a version tagged 102",
      short: "New version",
      text: "Txn 102 buys the same 4 seats. Instead of overwriting, it writes a new version tagged 102, holding 484 seats and $24,200, and commits without waiting. The old version stays, so the row now holds two.",
      focus: ["sales", "buy"],
      facts: [["Old version", "480 · $24,000"], ["Version 102", "484 · $24,200"]],
      metrics: { versions: 2 },
      changes: ["+ Version 102: 484, $24,200", "~ Row holds 2 versions", "+ Txn 102 commits"],
      events: [
        { type: "packet", path: ["buy", "sales"], label: "+4 seats" },
        { type: "mark", node: "sales", text: "v102: 484", tone: "work" },
        { type: "state", node: "sales", opts: { count: 2 }, with: true },
        { type: "mark", node: "buy", text: "commit", tone: "work", with: true },
      ],
    },
    {
      title: "Txn 100 still reads $24,000",
      short: "Consistent read",
      text: "Txn 100 reads revenue. Txn 102 hadn’t committed when the snapshot was taken, so Txn 100 skips version 102 and reads $24,000, which matches 480 × $50. It took no read locks and blocked no purchase.",
      focus: ["job", "sales"],
      facts: [["Matches", "480 × $50 = $24,000"], ["Read locks", "none"]],
      metrics: { revenue: "$24,000" },
      changes: ["+ Txn 100 skips version 102", "+ Txn 100 reads $24,000", "− The $200 gap"],
      events: [
        { type: "packet", path: ["job", "sales"], label: "read revenue" },
        { type: "mark", node: "sales", text: "skips v102", tone: "quiet" },
        { type: "packet", path: ["sales", "job"], label: "24,000", kind: "response" },
      ],
    },
    {
      title: "The old version must stay",
      short: "Versions kept",
      text: "The cost is old versions. The old version has stayed since Txn 102 committed, and cleanup, which Postgres calls vacuum, can’t remove it while Txn 100’s snapshot may read it. A snapshot held open for hours delays cleanup, so busy tables bloat.",
      focus: ["job", "sales"],
      facts: [["Old version", "kept for Txn 100"], ["Open for hours", "busy tables bloat"]],
      changes: ["+ Old version kept", "+ Vacuum can’t remove it"],
      events: [
        { type: "span", id: "old", node: "sales", label: "old version", tone: "quiet", t: 3.1 },
      ],
    },
    {
      title: "Cleanup removes the old version",
      short: "Cleanup",
      text: "Txn 100 commits, so no snapshot needs the old version, and vacuum removes it: the row is back to one version. Postgres offers this level as repeatable read, and some anomalies remain, as a later lesson shows.",
      focus: ["job", "sales"],
      facts: [["Postgres calls it", "repeatable read"]],
      metrics: { versions: 1 },
      changes: ["+ Txn 100 commits", "− Old version"],
      events: [
        { type: "mark", node: "job", text: "commit", tone: "work" },
        { type: "span", id: "snap", end: true, with: true },
        { type: "mark", node: "sales", text: "vacuum removes it", tone: "work" },
        { type: "span", id: "old", end: true, with: true },
        { type: "state", node: "sales", opts: { count: 1 }, with: true },
      ],
    },
  ],
};
