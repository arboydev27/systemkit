import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Hide unfinished work": one row, Ana’s balance of $200, while T1 moves $50 to Ben (Ben holds $100, as in
// tx-acid, so a correct total is $300). With no isolation the report (T2) reads T1’s uncommitted 150 and totals $250, and
// T1’s abort leaves it holding a value that never existed: a dirty read, its read landing inside the row’s uncommitted
// stretch. Replayed, a support tool (T3) writes 500 over that uncommitted 150 and commits, and T1’s rollback restores 200
// and wipes the 500 out: a dirty write. Replayed again at read committed, following the lesson’s one row: T1 writes 150
// and holds the row lock, and the row keeps the committed 200 beside it (two version cards), so T2 reads 200 at once; T3’s
// subtract-20 waits on the lock while T1 credits Ben; T1 commits, T2’s next read (sent once the commit lands) returns
// 150, and T3 resumes against 150 and commits 130. The cost: T2 read 200 and then 150 inside one transaction. Metrics:
// Ana’s committed balance and what T2 has read.
export const txReadCommittedStage: StageScene = {
  id: "tx-read-committed",
  layout: "timeline",
  intro: "Watch Ana’s row while a transfer is half done, first with no isolation, then at read committed.",
  metrics: [{ id: "committed", label: "Ana committed" }, { id: "seen", label: "T2 sees" }],
  nodes: [
    { id: "t1", role: "client", label: "T1", detail: "moves $50 to Ben", at: [0, 0] },
    { id: "ana", role: "row", label: "Ana’s row", detail: "balance", at: [1, 0], opts: { count: 1 } },
    { id: "t2", role: "client", label: "T2", detail: "the report", at: [2, 0] },
    { id: "t3", role: "client", label: "T3", detail: "support tool", at: [3, 0], appear: 2 },
  ],
  links: [],
  steps: [
    {
      title: "The report reads unfinished work",
      short: "Dirty read",
      text: "With no isolation, T1 debits Ana by writing 150 and hasn’t committed yet. The report, T2, reads that 150 and adds Ben’s $100: $250, not $300, so $50 looks missing. That is a dirty read.",
      metrics: { committed: "$200", seen: "$150" },
      facts: [["T2’s total", "$250"], ["Should be", "$300"]],
      changes: ["+ T1 writes 150, uncommitted", "+ T2 reads 150"],
      events: [
        { type: "packet", path: ["t1", "ana"], label: "write 150" },
        { type: "span", id: "open1", node: "ana", label: "uncommitted" },
        { type: "packet", path: ["t2", "ana"], label: "read", t: 1.2 },
        { type: "packet", path: ["ana", "t2"], label: "150", kind: "hot" },
        { type: "mark", node: "t2", text: "total 250", tone: "hot" },
      ],
    },
    {
      title: "T1 aborts: the 150 never existed",
      short: "T1 aborts",
      text: "T1 aborts, and Ana’s row goes back to 200. The committed balance was 200 all along, so the report has acted on 150, a value that never officially existed.",
      metrics: { committed: "$200", seen: "$150" },
      changes: ["~ T1 aborts", "~ Ana back to 200", "− The 150 T2 read"],
      events: [
        // the abort takes a beat of its own, so the row’s rollback (and the end of its uncommitted stretch) lands under it
        { type: "mark", node: "t1", text: "abort", tone: "hot", t: 4.2, dur: 1.5 },
        { type: "mark", node: "ana", text: "back to 200", dur: 1 },
        { type: "span", id: "open1", end: true, with: true },
      ],
    },
    {
      title: "T3 overwrites T1’s unfinished write",
      short: "Dirty write",
      text: "Replay T1’s debit, still with no isolation. It writes 150 and hasn’t committed when T3, a support tool, sets Ana’s balance to 500 and commits. T3 has overwritten another transaction’s uncommitted write: a dirty write.",
      metrics: { committed: "$500", seen: "—" },
      focus: ["t1", "ana", "t3"],
      changes: ["+ T1 writes 150, uncommitted", "+ T3 writes 500 over it", "+ T3 commits 500"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["t1", "ana"], label: "write 150" },
        { type: "span", id: "open2", node: "ana", label: "uncommitted" },
        { type: "packet", path: ["t3", "ana"], label: "set 500", t: 1.6 },
        { type: "mark", node: "ana", text: "150 → 500", tone: "hot" },
        { type: "mark", node: "t3", text: "commit 500", tone: "work", with: true },
      ],
    },
    {
      title: "T1’s abort wipes out the 500",
      short: "500 lost",
      text: "T1 aborts, and rollback restores the 200 its write replaced. T3’s 500 is gone even though it committed. Rollback only works when one transaction at a time owns a row’s uncommitted value.",
      metrics: { committed: "$200" },
      facts: [["T3 committed", "$500"], ["Ana now", "$200"]],
      focus: ["t1", "ana", "t3"],
      changes: ["~ T1 aborts", "~ Ana back to 200", "− T3’s committed 500"],
      events: [
        { type: "mark", node: "t1", text: "abort", tone: "hot", t: 4, dur: 1 },
        { type: "mark", node: "ana", text: "500 → 200", tone: "hot", dur: 1 },
        { type: "span", id: "open2", end: true, with: true },
        { type: "mark", node: "t3", text: "500 lost", tone: "hot", with: true },
      ],
    },
    {
      title: "Readers get the last committed value",
      short: "Read committed",
      text: "Replay at read committed. T1 writes 150 and takes the row lock until it commits or aborts. In a multi-version engine such as Postgres, the row keeps the last committed value, 200, beside the new one, so T2’s read returns 200 at once.",
      metrics: { committed: "$200", seen: "$200" },
      facts: [["Row lock", "T1, until commit"], ["T2 reads", "200, no wait"]],
      focus: ["t1", "ana", "t2"],
      changes: ["+ T1 holds the row lock", "+ Row keeps 200 beside 150", "+ T2 reads 200"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["t1", "ana"], label: "write 150" },
        { type: "span", id: "lock", node: "t1", label: "holds row lock", tone: "work" },
        { type: "state", node: "ana", opts: { locked: true, count: 2 }, with: true },
        { type: "mark", node: "ana", text: "150 new · 200 kept", dur: 0, with: true },
        { type: "packet", path: ["t2", "ana"], label: "read", t: 1.1 },
        { type: "packet", path: ["ana", "t2"], label: "200", kind: "response" },
      ],
    },
    {
      title: "A second writer waits for the lock",
      short: "Writer waits",
      text: "T3 tries to subtract 20 from Ana’s balance. Its update needs the row lock T1 holds, so it waits while T1 goes on to credit Ben. Readers don’t wait for the lock; writers queue on it.",
      focus: ["t1", "ana", "t3"],
      changes: ["+ T3 waits for the lock", "+ T1 credits Ben $50"],
      events: [
        // sent once the 200 reply has reached T2, so its line crosses only T2’s rail. T3 waits from the moment it sends (the
        // lock is already held), and T1’s credit runs long enough that the wait sleeve has room for its label at 1440
        { type: "packet", path: ["t3", "ana"], label: "balance − 20", t: 3.2 },
        { type: "span", id: "wait", node: "t3", label: "waits for lock", tone: "quiet", with: true },
        { type: "mark", node: "t1", text: "Ben +50", t: 4.4, dur: 0.9 },
      ],
    },
    {
      title: "After T1 commits, both see 150",
      short: "T1 commits",
      text: "T1 commits 150 and releases the lock. T2’s next read returns 150, the new committed value, and T3’s update resumes against 150 and commits 130.",
      metrics: { committed: "$130", seen: "$150" },
      changes: ["+ T1 commits 150", "~ T2 reads 150", "+ T3 commits 150 − 20 = 130"],
      events: [
        { type: "packet", path: ["t1", "ana"], label: "COMMIT" },
        { type: "span", id: "lock", end: true },
        { type: "state", node: "ana", opts: { locked: false, count: 1 }, with: true },
        { type: "span", id: "wait", end: true, with: true },
        // T2 reads once the commit has landed, and T3’s update applies once that read’s reply is home
        { type: "packet", path: ["t2", "ana"], label: "read" },
        { type: "packet", path: ["ana", "t2"], label: "150", kind: "response" },
        { type: "mark", node: "ana", text: "150 → 130", tone: "work" },
        { type: "mark", node: "t3", text: "commit 130", tone: "work", with: true },
      ],
    },
    {
      title: "Each read is safe, not the sequence",
      short: "The cost",
      text: "Inside one transaction, T2 read 200 and then 150: both committed, at different moments. Read committed protects each read, not a sequence of them. It’s cheap, and Postgres and Oracle both default to it.",
      facts: [["First read", "$200"], ["Next read", "$150"]],
      focus: ["t2", "ana"],
      changes: ["~ T2 saw two values"],
      events: [{ type: "mark", node: "t2", text: "200, then 150", tone: "hot" }],
    },
  ],
};
