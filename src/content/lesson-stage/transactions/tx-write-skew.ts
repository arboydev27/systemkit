import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Catch conflicts across different rows": section 5 has 100 places and 99 bookings. Buyer A and Buyer B each
// count 99, insert their own booking row and commit, leaving 101 (write skew, each new row a phantom the other's count
// would match). The race is replayed with the conflict materialized on a Section 5 row that keeps a sold count: A's
// UPDATE … sold = sold + 1 WHERE id = 5 AND sold < 100 takes the row lock (99 → 100), B waits on it, then at read
// committed matches no rows and reports the section full. Last, reserved seats with a unique index on show and seat: a
// second insert for seat 14B fails.
export const txWriteSkewStage: StageScene = {
  id: "tx-write-skew",
  layout: "timeline",
  intro: "Watch two buyers take the last of 100 places at once, then replay the race with a row that gives the conflict something to lock.",
  metrics: [{ id: "bookings", label: "Bookings" }, { id: "caught", label: "Conflicts caught" }],
  nodes: [
    { id: "a", role: "client", label: "Buyer A", detail: "books 1 place", at: [0, 0] },
    { id: "bookings", role: "database", label: "Bookings", detail: "a row per sale", at: [1, 0] },
    { id: "s5", role: "row", label: "Section 5", detail: "sold counter", at: [2, 0], appear: 3, opts: { count: 1 } },
    { id: "b", role: "client", label: "Buyer B", detail: "books 1 place", at: [3, 0] },
  ],
  links: [],
  steps: [
    {
      title: "Both buyers count 99 bookings",
      short: "Both count",
      text: "Section 5 has 100 places, and each sale inserts a booking row. With 99 sold, Buyer A and Buyer B check out at once. Each transaction runs SELECT count(*), sees 99, and finds one place left.",
      metrics: { bookings: { n: 99, unit: " of 100" }, caught: 0 },
      facts: [["Rule", "at most 100"]],
      changes: ["+ A counts 99", "+ B counts 99"],
      events: [
        { type: "packet", path: ["a", "bookings"], label: "SELECT count(*)" },
        { type: "packet", path: ["b", "bookings"], label: "SELECT count(*)", with: true },
        { type: "packet", path: ["bookings", "a"], label: "99", kind: "response" },
        { type: "packet", path: ["bookings", "b"], label: "99", kind: "response", with: true },
      ],
    },
    {
      title: "Each inserts a different row",
      short: "Both insert",
      text: "Each buyer inserts its own new booking row. Snapshot isolation stops two transactions writing the same row, but these are different new rows, so there is no write-write conflict to detect.",
      changes: ["+ A’s booking row", "+ B’s booking row", "~ No conflict found"],
      events: [
        { type: "packet", path: ["a", "bookings"], label: "insert booking" },
        { type: "packet", path: ["b", "bookings"], label: "insert booking", with: true },
        { type: "mark", node: "bookings", text: "no conflict", tone: "quiet", t: 3.25 },
      ],
    },
    {
      title: "Both commit: 101 bookings",
      short: "Both commit",
      text: "Both commit, and section 5 holds 101 bookings for 100 places: write skew, though each respected the rule alone. Each new row is a phantom, a row the other’s count would now match, so locking the 99 visible rows wouldn’t stop it.",
      metrics: { bookings: { n: 101, unit: " of 100", tone: "hot" } },
      facts: [["Places", "100"], ["Booked", "101"]],
      changes: ["+ A and B commit", "~ Bookings 99 → 101"],
      events: [
        { type: "mark", node: "a", text: "commit", tone: "work" },
        { type: "mark", node: "b", text: "commit", tone: "work", with: true },
        { type: "mark", node: "bookings", text: "101 of 100", tone: "hot" },
      ],
    },
    {
      title: "Give the conflict a row to lock",
      short: "Materialize",
      text: "Replay with the conflict materialized: a Section 5 row keeps a sold count of 99. Both buyers run UPDATE … SET sold = sold + 1 WHERE id = 5 AND sold < 100. A takes the row lock and makes 100; B needs the same row, so it waits.",
      metrics: { bookings: { n: 99, unit: " of 100" } },
      facts: [["Update", "sold = sold + 1"], ["Guard", "AND sold < 100"]],
      changes: ["+ Section 5 row, sold 99", "+ A holds the row lock", "+ B waits", "~ Sold 99 → 100"],
      events: [
        // The rewind comes first so the chips show this telling's numbers from the start. Section 5 rises as the two
        // updates leave for it, not with the rewind: a show that starts with a rewind is undone when the rewind ends.
        { type: "rewind" },
        { type: "show", nodes: ["s5"] },
        { type: "packet", path: ["a", "s5"], label: "sold + 1 if < 100", with: true },
        { type: "packet", path: ["b", "s5"], label: "sold + 1 if < 100", with: true },
        // A's update takes the lock and writes 100 in one moment; B's waits from that moment on.
        { type: "span", id: "lock", node: "a", label: "holds row lock", tone: "work" },
        // a second version card while A's uncommitted 100 holds the lock, as tx-lost-update and tx-read-committed show
        { type: "state", node: "s5", opts: { locked: true, count: 2 }, with: true },
        { type: "span", id: "wait", node: "b", label: "waits for lock", tone: "quiet", with: true },
        { type: "mark", node: "s5", text: "99 → 100", tone: "work", dur: 1.5, with: true },
        { type: "packet", path: ["s5", "a"], label: "1 row", kind: "response" },
      ],
    },
    {
      title: "Every booking queues on one row",
      short: "One row queue",
      text: "A inserts its booking and commits, which releases the row lock. Only then can B’s update run. That wait is the cost: every booking in section 5 queues on this one row, in a table kept only for concurrency.",
      metrics: { bookings: { n: 100, unit: " of 100" } },
      facts: [["Bookings queue on", "one row"]],
      changes: ["+ A’s booking row", "+ A commits", "− A’s row lock"],
      events: [
        { type: "packet", path: ["a", "bookings"], label: "insert booking" },
        { type: "mark", node: "a", text: "commit", tone: "work", dur: 0 },
        { type: "span", id: "lock", end: true },
        { type: "state", node: "s5", opts: { locked: false, count: 1 }, with: true },
        { type: "span", id: "wait", end: true, with: true },
      ],
    },
    {
      title: "B finds the section full",
      short: "Section full",
      text: "At read committed, B’s update now runs against 100, so the guard sold < 100 fails, the update matches no rows, and B reports the section full. At snapshot isolation Postgres aborts B instead, and the retry reaches the same answer.",
      metrics: { caught: 1 },
      focus: ["s5", "b"],
      facts: [["Read committed", "0 rows: full"], ["Snapshot", "abort, retry: full"]],
      changes: ["~ B’s update: 0 rows", "+ Section full"],
      events: [
        // a reply (blue), as tx-serializable's refusal of the 101st booking is: the guard working, not an anomaly
        { type: "packet", path: ["s5", "b"], label: "0 rows", kind: "response" },
        { type: "mark", node: "b", text: "section full" },
      ],
    },
    {
      title: "For one key, a unique index is simpler",
      short: "Unique index",
      text: "When the rule is about one key, a constraint is simpler. Replay with reserved seats: both buyers insert seat 14B at once, and a unique index on show and seat lets A’s in and fails B’s. With many rules across rows, use serializable isolation.",
      metrics: { bookings: { n: 1, unit: " for seat 14B" } },
      facts: [["Unique index", "show, seat"], ["Many rules", "serializable"]],
      changes: ["− Section 5 row", "+ A books seat 14B", "− B’s duplicate insert"],
      events: [
        // As in step 4: the rewind first, then Section 5 goes as the two inserts leave. Both leave at once; B's lands a
        // fifth of a beat after A's, so the index takes A's first and its pill isn't a repeat of A's (the figure hides a
        // repeated pill whose line crosses the empty Section 5 slot). Both answers then leave together.
        { type: "rewind" },
        { type: "hide", nodes: ["s5"] },
        { type: "state", node: "bookings", detail: "unique show + seat", with: true },
        { type: "packet", path: ["a", "bookings"], label: "insert seat 14B", with: true },
        { type: "packet", path: ["b", "bookings"], label: "insert seat 14B", with: true, dur: 1.2 },
        { type: "packet", path: ["bookings", "a"], label: "1 row", kind: "response" },
        // blue, as tx-acid's "duplicate key" is: the unique index working
        { type: "packet", path: ["bookings", "b"], label: "duplicate key", kind: "response", with: true },
      ],
    },
  ],
};
