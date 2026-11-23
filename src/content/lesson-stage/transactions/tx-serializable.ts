import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Choose how to serialize": the last of 100 places in section 5 (99 sold, as in "Catch conflicts across
// different rows"), with Buyer A and Buyer B checking out at once, replayed three ways that each end at 100 booked, never
// 101, and B refused. Actual serial execution: each buyer sends its transaction as one script and one thread runs them
// in turn, A's (99 → 100) while B's waits, then B's, which counts 100 and is refused. Two-phase locking: both counts take
// a shared lock on section 5's range and see 99, each insert needs an exclusive lock the other's shared lock blocks (a
// deadlock), the database aborts B (its lock ends with the deadlock, before A's insert lands), A's insert runs
// (99 → 100) and A commits, and B's retry, after A's commit, comes back sold out (one mark: step 8 shows a retry in full).
// Serializable snapshot isolation: both read snapshots, count 99 and insert without waiting; at commit A's goes through
// and B is aborted with SQLSTATE 40001; B's retry, on a new snapshot, counts 100. Every run ends with a "sold out" mark on
// B. The last step names the engines' defaults and Oracle's "serializable", which is snapshot isolation and allows
// write skew.
export const txSerializableStage: StageScene = {
  id: "tx-serializable",
  layout: "timeline",
  intro: "Watch two buyers race for the last of 100 places three ways: one at a time, under locks, and on snapshots that abort a conflict.",
  metrics: [{ id: "method", label: "Method" }, { id: "bookings", label: "Bookings" }, { id: "aborts", label: "Aborts" }],
  nodes: [
    { id: "a", role: "client", label: "Buyer A", detail: "books 1 place", at: [0, 0] },
    { id: "db", role: "database", label: "Bookings", detail: "section 5", at: [1, 0] },
    { id: "b", role: "client", label: "Buyer B", detail: "books 1 place", at: [2, 0] },
  ],
  links: [],
  steps: [
    {
      title: "One thread runs Buyer A’s script first",
      short: "One at a time",
      text: "Serializable isolation promises an outcome some one-at-a-time order could give. Replay the last of 100 places, 99 sold, under actual serial execution: one thread runs each buyer’s script in turn, so A’s counts 99 and books while B’s waits.",
      metrics: { method: "Serial", bookings: { n: 100, unit: " of 100" }, aborts: 0 },
      facts: [["Serializable means", "a one-at-a-time outcome"], ["Starts with", "99 of 100 sold"], ["One thread runs", "one script at a time"]],
      changes: ["+ Both send a script", "+ B’s script waits", "~ A books: 99 → 100"],
      events: [
        { type: "packet", path: ["a", "db"], label: "booking script", t: 0 },
        { type: "packet", path: ["b", "db"], label: "booking script", with: true },
        { type: "span", id: "runA", node: "db", label: "A’s script", tone: "work" },
        { type: "span", id: "waitB", node: "b", label: "waits its turn", tone: "quiet", with: true },
        { type: "span", id: "runA", end: true, t: 2 },
        { type: "mark", node: "db", text: "99 → 100", tone: "work", dur: 0, with: true },
      ],
    },
    {
      title: "Then B’s script counts 100 and is refused",
      short: "B refused",
      text: "Only when A’s script ends does B’s run. It counts 100 and is refused, so the section never oversells. B waited out all of A’s script, so one slow script stalls everything queued behind it.",
      facts: [["Scripts stay", "short, as in Redis"], ["A slow script", "stalls the queue"]],
      changes: ["− B’s wait", "+ B’s script counts 100", "~ B refused: sold out"],
      events: [
        { type: "span", id: "waitB", end: true, t: 2 },
        { type: "span", id: "runB", node: "db", label: "B’s script", tone: "work", with: true },
        { type: "span", id: "runB", end: true, t: 3 },
        { type: "packet", path: ["db", "b"], label: "100", kind: "response" },
        { type: "mark", node: "b", text: "sold out" },
      ],
    },
    {
      title: "Both buyers lock the range and count 99",
      short: "Shared locks",
      text: "Replay with two-phase locking. Readers take shared locks and writers exclusive ones, held until the transaction ends. Each buyer’s count takes a shared lock on section 5’s index range, which keeps out phantoms, and sees 99.",
      metrics: { method: "2PL", bookings: { n: 99, unit: " of 100" }, aborts: 0 },
      facts: [["Readers take", "shared locks"], ["Writers need", "exclusive locks"]],
      changes: ["+ A’s shared lock", "+ B’s shared lock", "+ Both count 99"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["a", "db"], label: "count(*)", t: 0 },
        { type: "packet", path: ["b", "db"], label: "count(*)", with: true },
        { type: "span", id: "lockA", node: "a", label: "shared lock", tone: "work" },
        { type: "span", id: "lockB", node: "b", label: "shared lock", tone: "work", with: true },
        { type: "packet", path: ["db", "a"], label: "99", kind: "response", with: true },
        { type: "packet", path: ["db", "b"], label: "99", kind: "response", with: true },
      ],
    },
    {
      title: "Each insert waits on the other’s lock",
      short: "Deadlock",
      text: "Both buyers now insert a booking. An insert into the range needs an exclusive lock, which the other buyer’s shared lock blocks. A waits for B and B waits for A, so neither can go on: a deadlock.",
      changes: ["+ A waits for B’s lock", "+ B waits for A’s lock", "+ Deadlock"],
      events: [
        { type: "packet", path: ["a", "db"], label: "insert booking" },
        { type: "packet", path: ["b", "db"], label: "insert booking", with: true },
        { type: "span", id: "deadlock", node: "db", label: "deadlock", tone: "hot" },
        { type: "mark", node: "a", text: "waits for B", tone: "quiet", t: 4 },
        { type: "mark", node: "b", text: "waits for A", tone: "quiet", with: true },
      ],
    },
    {
      title: "The database aborts B, and B retries",
      short: "Abort, retry",
      text: "The database detects the deadlock and aborts B, which frees its lock. A’s insert goes through and A commits: 100 booked. B retries from the start, counts 100 and is refused. Shared locks block writers, so one long report can stall them.",
      metrics: { bookings: { n: 100, unit: " of 100" }, aborts: 1 },
      facts: [["Serializable in", "InnoDB, SQL Server"], ["A long report", "stalls writers"]],
      changes: ["− B aborted, its lock freed", "+ A’s insert goes through", "~ A commits: 99 → 100", "+ B retries: sold out"],
      events: [
        { type: "span", id: "deadlock", end: true, t: 4.5 },
        { type: "span", id: "lockB", end: true, with: true },
        { type: "packet", path: ["db", "b"], label: "abort", kind: "hot", with: true, dur: 1.25 },
        { type: "packet", path: ["a", "db"], label: "COMMIT", t: 4.75, dur: 1.25 },
        { type: "mark", node: "db", text: "99 → 100", tone: "work", dur: 0 },
        { type: "span", id: "lockA", end: true, with: true },
        { type: "mark", node: "b", text: "retry: sold out", t: 6.25 },
      ],
    },
    {
      title: "On snapshots, both run without waiting",
      short: "Snapshots",
      text: "Replay with serializable snapshot isolation. Each buyer reads from its own snapshot and nothing blocks: both count 99 and insert at once. The database only notes what each one read.",
      metrics: { method: "SSI", bookings: { n: 99, unit: " of 100" }, aborts: 0 },
      changes: ["+ A’s snapshot", "+ B’s snapshot", "+ Both count 99 and insert"],
      events: [
        { type: "rewind" },
        { type: "span", id: "snapA", node: "a", label: "snapshot", t: 0 },
        { type: "span", id: "snapB", node: "b", label: "snapshot", with: true },
        { type: "packet", path: ["a", "db"], label: "count(*)", with: true },
        { type: "packet", path: ["b", "db"], label: "count(*)", with: true },
        { type: "packet", path: ["db", "a"], label: "99", kind: "response" },
        { type: "packet", path: ["db", "b"], label: "99", kind: "response", with: true },
        { type: "mark", node: "db", text: "reads noted", tone: "quiet", t: 1, with: true },
        { type: "packet", path: ["a", "db"], label: "insert booking", t: 2 },
        { type: "packet", path: ["b", "db"], label: "insert booking", with: true },
      ],
    },
    {
      title: "At commit, the database aborts B",
      short: "Abort at commit",
      text: "Both commit, and A’s goes through: 100 booked. Each buyer read the range the other wrote into, so no one-at-a-time order explains both, and the database aborts B with SQLSTATE 40001. Under heavy contention, such aborts waste work.",
      metrics: { bookings: { n: 100, unit: " of 100" }, aborts: 1 },
      facts: [["Postgres", "SERIALIZABLE is SSI"], ["Abort code", "SQLSTATE 40001"]],
      changes: ["~ A commits: 99 → 100", "− B aborted: 40001"],
      events: [
        { type: "packet", path: ["a", "db"], label: "COMMIT" },
        { type: "packet", path: ["b", "db"], label: "COMMIT", with: true },
        { type: "mark", node: "db", text: "99 → 100", tone: "work", dur: 0 },
        { type: "span", id: "snapA", end: true, with: true },
        { type: "packet", path: ["db", "b"], label: "abort 40001", kind: "hot", with: true },
        { type: "span", id: "snapB", end: true },
      ],
    },
    {
      title: "B retries the whole transaction",
      short: "Retry loop",
      text: "2PL and SSI both need a retry loop around the whole transaction: B starts again on a new snapshot, counts 100 and is refused. Defaults and names differ by engine, and Oracle’s “serializable” is snapshot isolation, so test the anomaly, not the label.",
      focus: ["b", "db"],
      facts: [["Postgres, Oracle default", "read committed"], ["InnoDB default", "repeatable read"], ["Oracle serializable", "allows write skew"]],
      changes: ["+ B starts again", "~ B refused: sold out"],
      events: [
        { type: "span", id: "retry", node: "b", label: "retry", t: 5.5 },
        { type: "packet", path: ["b", "db"], label: "count(*)", with: true },
        { type: "packet", path: ["db", "b"], label: "100", kind: "response" },
        { type: "mark", node: "b", text: "sold out", dur: 0 },
        { type: "span", id: "retry", end: true, with: true },
      ],
    },
  ],
};
