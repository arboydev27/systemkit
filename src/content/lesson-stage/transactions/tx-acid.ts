import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Know what a transaction promises": a transfer job moves $50 from Ana ($200) to Ben ($100), $300 in all.
// As two autocommit writes, a crash between them leaves Ana $150 and Ben $100: $50 gone. Replayed as one transaction,
// a crash before COMMIT discards the debit (Ana still $200, safe to retry): atomicity, about failure, where isolation is
// the concurrency promise. The retry's writes and its commit record (blue, as the chapter marks commits)
// join the write-ahead log (WAL, offsets 0-2), and COMMIT waits ("waits for flush") until the "flushed" line passes
// them before it is acknowledged (Ana $150, Ben $150); a database crash then recovers from that log. A declared check
// (balance ≥ 0, on the database's tag) can't see a bug that debits $50 and credits $40 (offsets 3-5), so it commits
// and $10 goes (Ana $100, Ben $190, $290). Last, the next transfer (offsets 6-9) waits for its flush too, saves idempotency key 81
// and commits (Ana $50, Ben $240), the reply to COMMIT is lost, and the retry's key 81 is a duplicate, so it changes
// nothing: Ana keeps $50 rather than $0.
// The WAL lies below the database so the two parts stay large on a wide screen; its short name leaves room on a phone
// for three records, a whole transaction until step 6, whose four show as the last three (key 81 and commit in view).
// The job sends statements and the database writes its own log, so records join it without a message from the job.
export const txAcidStage: StageScene = {
  id: "tx-acid",
  intro: "Watch $50 move from Ana to Ben through crashes, a log flush, a bug and a lost reply, and see which promises the database keeps.",
  metrics: [{ id: "ana", label: "Ana" }, { id: "ben", label: "Ben" }, { id: "total", label: "Total" }],
  nodes: [
    { id: "job", role: "worker", label: "Transfer job", detail: "moves $50 Ana → Ben", at: [0, 0] },
    { id: "db", role: "database", label: "Database", detail: "accounts table", at: [1, 0] },
  ],
  links: [{ from: "job", to: "db" }],
  logs: [{ id: "wal", node: "db", label: "WAL", side: "below", appear: 2 }],
  steps: [
    {
      title: "A crash between two writes loses $50",
      short: "Two writes",
      text: "Moving $50 from Ana to Ben takes two writes, here sent as separate autocommit statements. The debit commits on its own, then the Transfer job crashes before the credit. Ana has $150 and Ben still $100: $50 has vanished.",
      metrics: { ana: "$150", ben: "$100", total: "$250" },
      facts: [["Should be", "$300 in all"], ["Is", "$250"]],
      changes: ["~ Ana $200 → $150, committed alone", "− Ben’s credit, never sent", "− $50 of the $300"],
      events: [
        { type: "packet", path: ["job", "db"], label: "Ana −50" },
        { type: "state", node: "db", light: "on" },
        { type: "note", node: "db", text: "commits on its own", with: true },
        { type: "pause", ms: 500 },
        { type: "state", node: "job", down: true, light: "hot", tone: "hot" },
        { type: "note", node: "job", text: "crash before Ben +50", tone: "hot", with: true },
        // the database now holds half a transfer: orange here, where the transaction's replay leaves it blue
        { type: "state", node: "db", light: "hot", tone: "hot", readout: "$50 missing" },
      ],
    },
    {
      title: "A crash before COMMIT leaves no trace",
      short: "Atomicity",
      text: "Replay the transfer as one transaction. The job crashes after the debit, before COMMIT, so the database discards it: Ana still has $200 and the job can safely retry. That is atomicity, a promise about failure, not concurrency; keeping concurrent transactions apart is isolation.",
      metrics: { ana: "$200", ben: "$100", total: "$300" },
      facts: [["Ana", "still $200"], ["Retry", "safe"]],
      changes: ["~ Both writes in one transaction", "− Job crashed before COMMIT", "− The uncommitted debit"],
      events: [
        { type: "state", node: "job", down: false, light: "on", tone: "" },
        { type: "state", node: "db", light: "idle", tone: "", readout: "", with: true },
        { type: "packet", path: ["job", "db"], label: "BEGIN · Ana −50" },
        { type: "state", node: "db", light: "on", readout: "Ana −50 uncommitted" },
        { type: "pause", ms: 400 },
        { type: "state", node: "job", down: true, light: "hot", tone: "hot" },
        { type: "note", node: "job", text: "crash before COMMIT", tone: "hot", with: true },
        { type: "pause", ms: 500 },
        { type: "state", node: "db", readout: "", light: "work" },
        { type: "note", node: "db", text: "Ana −50 discarded", tone: "work", with: true },
      ],
    },
    {
      title: "COMMIT is acknowledged after the flush",
      short: "Durability",
      text: "The retry runs the whole transaction. Its writes, then a commit record, join the write-ahead log (WAL), an append-only file, and the database acknowledges COMMIT only once the log is flushed to disk. Ana has $150 and Ben $150.",
      metrics: { ana: "$150", ben: "$150", total: "$300" },
      facts: [["COMMIT waits for", "the log flush"]],
      changes: ["+ Write-ahead log (WAL)", "+ Ana −50, Ben +50, commit", "~ Flushed, then acknowledged"],
      events: [
        { type: "state", node: "job", down: false, light: "on", tone: "" },
        { type: "state", node: "db", light: "idle", with: true },
        { type: "cursor", log: "wal", id: "flushed", at: "end", label: "flushed", line: true, tone: "work" },
        // the job sends statements and the database writes its own log, so the records join it from the database (no
        // request rests on the cable in the link's still, where it crowded the database's note on a phone)
        { type: "packet", path: ["job", "db"], label: "BEGIN … COMMIT" },
        { type: "append", log: "wal", records: [{ text: "Ana −50" }, { text: "Ben +50" }], gap: 0 },
        { type: "append", log: "wal", records: [{ text: "commit", tone: "work" }], gap: 200 },
        // the commit sits past the flushed line while the disk catches up: the wait every commit pays
        { type: "state", node: "db", light: "on", readout: "waits for flush" },
        { type: "pause", ms: 700 },
        { type: "cursor", log: "wal", id: "flushed", at: "end" },
        { type: "state", node: "db", light: "work", readout: "" },
        { type: "note", node: "db", text: "flushed before the ack", tone: "work", with: true },
        { type: "packet", path: ["db", "job"], label: "committed", kind: "response" },
        { type: "state", node: "job", light: "work" },
      ],
    },
    {
      title: "Committed data survives a crash",
      short: "Survives a crash",
      text: "Now the database crashes, just after that acknowledgement. On restart it recovers from the flushed log, so Ana still has $150 and Ben $150. Durability has a limit: a failed disk with no replica can still lose a commit.",
      focus: ["db"],
      frame: ["job", "db"],
      metrics: { ana: "$150", ben: "$150", total: "$300" },
      facts: [["Survives", "a crash and restart"], ["Can still lose it", "a failed disk, no replica"]],
      changes: ["− Database crashed", "+ Restarted from the flushed log", "~ Ana $150 and Ben $150 kept"],
      events: [
        { type: "state", node: "db", down: true, light: "hot", tone: "hot" },
        { type: "pause", ms: 700 },
        { type: "state", node: "db", down: false, light: "on", tone: "" },
        { type: "read", log: "wal", at: 0 },
        { type: "read", log: "wal", at: 1, gap: 60 },
        { type: "read", log: "wal", at: 2, gap: 60 },
        { type: "state", node: "db", light: "work" },
        { type: "note", node: "db", text: "recovered from the log", tone: "work", with: true },
      ],
    },
    {
      title: "Only declared rules are enforced",
      short: "Consistency",
      text: "The database enforces a check you declared: balances stay at or above zero. A bug now debits Ana $50 but credits Ben only $40. No declared rule breaks, so it commits and $10 is gone. Consistency is mostly your code’s job.",
      metrics: { ana: "$100", ben: "$190", total: "$290" },
      facts: [["Declared", "balance ≥ 0"], ["Not declared", "money is conserved"]],
      changes: ["+ Ana −50, Ben +40 committed", "~ Every balance still ≥ 0", "− $10 of the $300"],
      events: [
        { type: "state", node: "job", detail: "bug: credits $40", light: "on" },
        // the declared rule on the database's tag, so the still shows the check that held while $10 went
        { type: "state", node: "db", light: "idle", detail: "check: balance ≥ 0", with: true },
        { type: "packet", path: ["job", "db"], label: "Ana −50 · Ben +40" },
        { type: "append", log: "wal", records: [{ text: "Ana −50" }, { text: "Ben +40", tone: "hot" }], gap: 0 },
        { type: "append", log: "wal", records: [{ text: "commit", tone: "work" }], gap: 200 },
        { type: "cursor", log: "wal", id: "flushed", at: "end" },
        { type: "packet", path: ["db", "job"], label: "committed", kind: "response" },
        { type: "state", node: "db", light: "hot", tone: "hot" },
        { type: "note", node: "db", text: "$10 gone, no rule broken", tone: "hot", with: true },
      ],
    },
    {
      title: "A lost reply leaves the outcome unknown",
      short: "Lost reply",
      text: "With the bug fixed, the next transfer saves idempotency key 81, a unique ID, with its writes. Like every COMMIT, it waits for its flush, then commits, but the connection drops before the reply, so the job can’t tell whether it did.",
      metrics: { ana: "$50", ben: "$240", total: "$290" },
      facts: [["In the WAL", "key 81 and commit"], ["Reply lost", "outcome unknown"]],
      changes: ["+ Next transfer, key 81", "− The reply to COMMIT", "~ Committed, but the job can’t tell"],
      // one plain message for the whole transaction, not appends from the job, so no request rests on the cable over
      // the lost reply's × in the link's still; with reduced motion it rests by the database, and its short label keeps
      // it clear of the ×, which is placed without regard to resting messages
      events: [
        { type: "state", node: "job", detail: "moves $50 Ana → Ben", light: "on" },
        { type: "state", node: "db", light: "idle", tone: "", detail: "accounts table", with: true },
        { type: "packet", path: ["job", "db"], label: "COMMIT" },
        { type: "append", log: "wal", records: [{ text: "Ana −50" }, { text: "Ben +50" }, { text: "key 81" }, { text: "commit", tone: "work" }], gap: 0 },
        { type: "state", node: "db", light: "on", readout: "waits for flush" },
        { type: "pause", ms: 600 },
        { type: "cursor", log: "wal", id: "flushed", at: "end" },
        { type: "state", node: "db", light: "work", readout: "" },
        { type: "packet", path: ["db", "job"], label: "committed", kind: "hot", lost: true },
        { type: "state", node: "job", light: "hot", tone: "hot" },
        { type: "note", node: "job", text: "committed or not?", tone: "hot", with: true },
      ],
    },
    {
      title: "An idempotency key marks the repeat",
      short: "Idempotency key",
      text: "The job retries with the same key. The first attempt saved key 81 under a unique constraint, so the retry’s insert of it fails as a duplicate: nothing changes, and the job knows the transfer is done. Ana keeps $50 instead of being debited twice.",
      metrics: { ana: "$50", ben: "$240", total: "$290" },
      facts: [["Without the key", "Ana $0"], ["With it", "Ana $50"]],
      changes: ["+ Retry with key 81", "~ Seen as a repeat", "~ Ana debited once"],
      events: [
        { type: "state", node: "job", light: "on", tone: "" },
        { type: "state", node: "db", light: "idle", with: true },
        { type: "packet", path: ["job", "db"], label: "retry · key 81" },
        { type: "state", node: "db", light: "work" },
        { type: "note", node: "db", text: "key 81 exists: a repeat", tone: "work", with: true },
        { type: "packet", path: ["db", "job"], label: "duplicate key", kind: "response" },
        { type: "state", node: "job", light: "work" },
        { type: "note", node: "job", text: "already done", tone: "work", with: true },
      ],
    },
  ],
};
