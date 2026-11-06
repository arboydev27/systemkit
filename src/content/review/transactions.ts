import type { ReviewVariation } from "../../lib/review";

export const transactionsReview: Record<string, ReviewVariation> = {
  "transactions/tx-acid": {
    prompts: ["A teammate says wrapping a library’s book checkout in a transaction guarantees its rules can never break. What does the database actually protect?", "A loyalty job retries whenever its database call fails, and atomicity is guaranteed. Why can it still award points twice, and what prevents that?"],
    answer: "Atomicity only rolls back partial writes when a failure strikes. The database enforces declared rules such as unique indexes; other invariants live in your code. If the connection dies during COMMIT you cannot tell what happened, so a retry may repeat committed work unless an idempotency key marks it.",
  },
  "transactions/tx-read-committed": {
    prompts: ["A grading tool overwrites a score another transaction changed but hasn’t committed, and that transaction then aborts. What goes wrong, and what prevents it?", "In a multi-version engine at read committed, an open update to a catalog row lets readers continue but makes other writers wait. Why the difference?"],
    answer: "A dirty write lets a rollback wipe out someone’s committed change, so each row’s uncommitted value needs one owner: a writer holds a row lock until commit or abort. Readers wait for nobody, since the prior committed version stays available. The guarantee covers each read alone, not a series of them.",
  },
  "transactions/tx-snapshot": {
    prompts: ["In one transaction, a payroll audit reads headcount, then total salaries. They disagree, though both were committed. What is this anomaly, and what removes it?", "A long support-analytics query reads a busy tickets table while updates keep committing, and neither waits for the other. How, and at what cost?"],
    answer: "Reads spanning several moments in one transaction are read skew. Under snapshot isolation a transaction sees one fixed view of committed data, via MVCC row versions, so neither readers nor writers wait for the other. Old versions linger while any snapshot needs them, so lengthy snapshots delay cleanup and bloat tables.",
  },
  "transactions/tx-lost-update": {
    prompts: ["A video site reads a view count, adds one in code, then writes it back. Why do views go missing, and what fixes it?", "A job reads a parcel, calls a slow carrier API, then writes the result. Which lost-update guard fits, and which would you avoid?"],
    answer: "Both writes were computed from one stale read, so one overwrites the other: a lost update, allowed at read committed. An atomic update fits single-statement changes. Across a slow call, avoid a row lock, which queues writers; compare-and-set holds none, but on zero affected rows you must re-read and recompute.",
  },
  "transactions/tx-write-skew": {
    prompts: ["Two managers check a team’s spending total, then each insert an expense. Snapshot isolation allows both, and the budget is exceeded. Why?", "A coupon allows 1,000 redemptions, each inserting a row. Why does locking existing rows fail to enforce this, and what would work?"],
    answer: "Each transaction read overlapping data and wrote a different row, so there was no write-write conflict to catch: write skew. Locks on visible rows cannot stop a new row, a phantom. Materialize the conflict with a guarded counter row, accepting contention there, or use serializable isolation.",
  },
  "transactions/tx-serializable": {
    prompts: ["Two bids on one auction item conflict. How do actual serial execution, two-phase locking, and serializable snapshot isolation each handle them?", "A payroll app moves to another database engine, keeping the same isolation level name. Why is that risky, and what should the team do?"],
    answer: "Serial execution runs them one at a time, so no conflict arises, but a slow one stalls the rest. 2PL makes them block on locks; SSI lets them run and aborts one; both need whole-transaction retries. Level names differ across engines (Oracle’s serializable permits write skew), so test for the anomaly itself.",
  },
};
