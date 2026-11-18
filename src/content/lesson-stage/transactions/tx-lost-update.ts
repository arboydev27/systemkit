import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Stop writers overwriting each other": two payments read the same balance and the second write wipes out the
// first; then the race is replayed with an atomic update (the second writer waits for the row lock) and with
// compare-and-set (the stale write matches zero rows, and the learner's eye goes to each writer in turn).
export const txLostUpdateStage: StageScene = {
  id: "tx-lost-update",
  layout: "timeline",
  intro: "Watch two payments debit one wallet at the same moment, then replay the race with fixes that keep both debits.",
  metrics: [{ id: "balance", label: "Balance" }, { id: "kept", label: "Debits kept" }],
  nodes: [
    { id: "a", role: "client", label: "Payment A", detail: "debits $30", at: [0, 0] },
    { id: "wallet", role: "database", label: "Wallet", detail: "row 7", at: [1, 0] },
    { id: "b", role: "client", label: "Payment B", detail: "debits $50", at: [2, 0] },
  ],
  links: [],
  steps: [
    {
      title: "Both payments read the balance",
      short: "Both read",
      text: "A wallet holds $100. Payment A will debit $30 and Payment B $50. Each reads the balance first, and both see 100, because neither has written yet.",
      metrics: { balance: "$100", kept: { n: 0, unit: " of 2" } },
      changes: ["+ A reads 100", "+ B reads 100"],
      events: [
        { type: "packet", path: ["a", "wallet"], label: "read" },
        { type: "packet", path: ["b", "wallet"], label: "read", with: true },
        { type: "packet", path: ["wallet", "a"], label: "100", kind: "response" },
        { type: "packet", path: ["wallet", "b"], label: "100", kind: "response", with: true },
      ],
    },
    {
      title: "A writes 70 and commits",
      short: "A commits",
      text: "Each subtracts in its own code: A works out 70 and B works out 50. A writes its 70 and commits, so the balance is now 70.",
      metrics: { balance: "$70", kept: { n: 1, unit: " of 2" } },
      changes: ["+ A computes 100 − 30", "+ B computes 100 − 50", "~ Balance 70"],
      events: [
        { type: "mark", node: "a", text: "100 − 30 = 70", dur: 1 },
        { type: "mark", node: "b", text: "100 − 50 = 50", with: true },
        { type: "packet", path: ["a", "wallet"], label: "write 70" },
        { type: "mark", node: "wallet", text: "commit 70", tone: "work" },
      ],
    },
    {
      title: "B writes 50 over it",
      short: "B overwrites",
      text: "B writes the 50 it worked out from its stale read, and commits. The balance should be 20, but it is 50: A’s debit has vanished. Read committed allows this lost update, since nobody saw uncommitted data.",
      metrics: { balance: "$50", kept: { n: 1, unit: " of 2", tone: "hot" } },
      facts: [["Should be", "$20"], ["Is", "$50"]],
      changes: ["~ Balance 50", "− A’s $30 debit"],
      events: [
        { type: "packet", path: ["b", "wallet"], label: "write 50" },
        { type: "mark", node: "wallet", text: "commit 50", tone: "hot" },
        { type: "mark", node: "a", text: "debit lost", tone: "hot", with: true },
      ],
    },
    {
      title: "Let the database subtract",
      short: "Atomic update",
      text: "Replay the race with UPDATE … SET balance = balance − 30, so the database does the arithmetic. A’s update takes the row lock, makes 70 and reports 1 row. B’s update needs the same lock, so it waits.",
      metrics: { balance: "$70", kept: { n: 1, unit: " of 2" } },
      changes: ["~ Both send an atomic UPDATE", "+ A holds the row lock", "+ B waits", "+ A’s update: 1 row"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["a", "wallet"], label: "balance − 30" },
        { type: "packet", path: ["b", "wallet"], label: "balance − 50", with: true },
        { type: "span", id: "lock", node: "a", label: "holds row lock", tone: "work" },
        { type: "span", id: "wait", node: "b", label: "waits for lock", tone: "quiet", with: true },
        { type: "mark", node: "wallet", text: "100 → 70", tone: "work", dur: 1.5 },
        { type: "packet", path: ["wallet", "a"], label: "1 row", kind: "response" },
      ],
    },
    {
      title: "B runs on the new balance",
      short: "Lock passes",
      text: "A commits and releases the lock. B’s update then runs against the latest value, 70, and leaves 20, so both debits are kept. A guard such as AND balance >= 50 turns too little money into 0 rows updated, never a negative balance.",
      metrics: { balance: "$20", kept: { n: 2, unit: " of 2" } },
      facts: [["Guard", "AND balance >= 50"], ["Too little money", "0 rows updated"]],
      changes: ["− A’s row lock", "~ B’s update runs on 70", "~ Balance 20"],
      events: [
        { type: "packet", path: ["a", "wallet"], label: "COMMIT" },
        { type: "span", id: "lock", end: true },
        { type: "span", id: "wait", end: true, with: true },
        { type: "mark", node: "wallet", text: "70 → 20", tone: "work" },
        { type: "packet", path: ["wallet", "b"], label: "1 row", kind: "response" },
      ],
    },
    {
      title: "Read a version with the balance",
      short: "Read versions",
      text: "Compare-and-set suits logic that can’t fit one statement, such as a form left open for minutes. Replay the race once more: both payments read the balance with its version, 100 at version 7, and hold no lock.",
      metrics: { balance: "$100", kept: { n: 0, unit: " of 2" } },
      changes: ["~ Each read returns a version", "~ No lock held"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["a", "wallet"], label: "read" },
        { type: "packet", path: ["b", "wallet"], label: "read", with: true },
        { type: "packet", path: ["wallet", "a"], label: "100 · v7", kind: "response" },
        { type: "packet", path: ["wallet", "b"], label: "100 · v7", kind: "response", with: true },
      ],
    },
    {
      title: "A’s write checks the version",
      short: "Versioned write",
      text: "A writes 70 only if the version is still 7. It is, so the row moves to version 8 with the new balance. The check and the write are one statement, so nothing can slip in between.",
      metrics: { balance: "$70", kept: { n: 1, unit: " of 2" } },
      focus: ["a", "wallet"],
      changes: ["+ Version 8 holds 70"],
      events: [
        { type: "packet", path: ["a", "wallet"], label: "70 if v7" },
        { type: "mark", node: "wallet", text: "70 · v8", tone: "work" },
      ],
    },
    {
      title: "The stale write changes nothing",
      short: "Stale write fails",
      text: "B’s write also asks for version 7, but the row is at version 8 now, so it matches zero rows and changes nothing. B must re-read 70 and recompute, not resend.",
      metrics: { balance: "$70", kept: { n: 1, unit: " of 2" } },
      facts: [["Repeatable read", "Postgres aborts B"]],
      focus: ["b", "wallet"],
      changes: ["− B’s write: 0 rows", "~ B re-reads, then retries"],
      events: [
        { type: "packet", path: ["b", "wallet"], label: "50 if v7" },
        { type: "packet", path: ["wallet", "b"], label: "0 rows", kind: "hot" },
        { type: "mark", node: "b", text: "re-read, retry" },
      ],
    },
  ],
};
