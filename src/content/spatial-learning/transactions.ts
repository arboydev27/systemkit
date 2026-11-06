import { flowLesson } from "./flow-lesson";

export const transactionsTeachingContent = {
  "tx-acid": flowLesson("tx-acid", {
    kind: "comparison",
    semanticIds: ["atomicity", "consistency", "isolation", "durability"],
    points: [
      { title: "What the database keeps", description: "Atomicity, isolation, and durability are mechanisms the database provides once you group writes into a transaction.", items: [0, 2, 3] },
      { title: "What your code keeps", description: "The database enforces only the constraints you declare. Whether a transfer is correct is a rule your application has to get right.", items: [1] },
    ],
    prediction: {
      prompt: "Power fails after a transaction has written three of its five rows, before it commits. What does the database show after it restarts?",
      options: [
        "Three rows changed, with two pending",
        "All five rows changed, by log replay",
        "None of the five rows has changed",
        "Three rows changed until a repair runs",
      ],
      correctIndex: 2,
      explanation: "Without a commit, atomicity discards everything the transaction wrote. Recovery replays committed work and undoes the rest.",
      items: [0],
    },
  }),
  "tx-read-committed": flowLesson("tx-read-committed", {
    kind: "flow",
    semanticIds: ["t1-write", "t2-read", "t3-write", "t1-commit"],
    points: [
      { title: "Unfinished work stays hidden", description: "T1 has written 150 but not committed, so T2 reads the last committed value, 200, without waiting.", items: [0, 1] },
      { title: "Writers take turns", description: "T3 waits on T1’s row lock. When T1 commits, T2’s next read returns 150, and T3 applies its change to that value.", items: [0, 1, 2, 3] },
    ],
    prediction: {
      prompt: "Suppose T1 aborts instead of committing. What do T2’s next read and T3’s blocked subtraction of 20 see?",
      options: [
        "T2 reads 150 once, and T3 then fails with an error",
        "T2 reads 200, and T3 goes ahead from 200, leaving 180",
        "T2 reads 200, and T3 stays blocked until it times out",
        "T2 waits for cleanup, and T3 goes ahead from 150, leaving 130",
      ],
      correctIndex: 1,
      explanation: "An abort releases the lock and T1’s value never counted. T2 keeps seeing 200, and T3 proceeds from 200.",
      items: [1, 2, 3],
    },
  }),
  "tx-snapshot": flowLesson("tx-snapshot", {
    kind: "flow",
    semanticIds: ["snapshot-start", "new-version", "snapshot-read", "version-cleanup"],
    points: [
      { title: "A write adds a version", description: "Transaction 102 commits 484 as a new version, and the 480 version stays in place.", items: [0, 1] },
      { title: "The snapshot picks the version", description: "Transaction 100 still reads 480, because 102 had not committed when its snapshot was taken. It does not wait for anyone.", items: [1, 2] },
      { title: "Old versions cost space", description: "Cleanup can remove the 480 version only once no running snapshot could still need it.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A row has versions from transactions 90 and 102. Transaction 100, whose snapshot predates 102’s commit, is still open. A new transaction starts after 102 commits. Which versions can cleanup remove?",
      options: [
        "Version 90, because a newer committed version already exists",
        "Version 102, because transaction 100 is not able to see it",
        "Both, because each can be rebuilt from the write-ahead log",
        "Neither yet: 100 still reads 90, and the newcomer reads 102",
      ],
      correctIndex: 3,
      explanation: "Each open snapshot pins the version it can see. Version 90 becomes removable once transaction 100 ends.",
      items: [2, 3],
    },
  }),
  "tx-lost-update": flowLesson("tx-lost-update", {
    kind: "flow",
    semanticIds: ["read-a", "read-b", "write-a", "write-b"],
    points: [
      { title: "Both read 100", description: "Two transactions read the same balance before either writes, and each computes its new value in application code.", items: [0, 1] },
      { title: "The second write wins", description: "A writes 70 and B writes 50. Each write is valid alone, but B’s value was computed without A’s debit, so $30 of debits disappears.", items: [0, 1, 2, 3] },
    ],
    prediction: {
      prompt: "The same two debits now each run `UPDATE wallets SET balance = balance - amount` at read committed, with no earlier read in application code. Where does the $100 balance end up?",
      options: [
        "$20, because the second waits and then subtracts from 70",
        "$50, because the second write still replaces the first one",
        "$70, because the first write wins and the second one aborts",
        "$20, but only if both of them run at serializable isolation",
      ],
      correctIndex: 0,
      explanation: "The database reads and writes under the row lock, so the second statement computes from the first one’s committed result. No stale value exists in application code.",
      items: [2, 3],
    },
  }),
  "tx-write-skew": flowLesson("tx-write-skew", {
    kind: "flow",
    semanticIds: ["t1-count", "t2-count", "insert-rows", "both-commit"],
    points: [
      { title: "Both checks pass", description: "Each snapshot shows 99 bookings out of 100 places, so each transaction decides there is room.", items: [0, 1] },
      { title: "Nothing collides", description: "Each inserts its own new row. No row is written twice, so the database sees no conflict, and the section ends with 101 bookings.", items: [0, 1, 2, 3] },
    ],
    prediction: {
      prompt: "The same code runs at snapshot isolation, but the section has 98 sold when two buyers check out together. What do you observe?",
      options: [
        "One aborts, because the two transactions read the same rows",
        "Both commit and 101 are sold, because the count runs too late",
        "Both commit and 100 are sold, so the flaw stays hidden",
        "One waits, because the first insert locks the whole section",
      ],
      correctIndex: 2,
      explanation: "The race still happens, but the result lands within capacity. Write skew shows up only at the boundary, which is why ordinary testing misses it.",
      items: [0, 1, 3],
    },
  }),
  "tx-serializable": flowLesson("tx-serializable", {
    kind: "comparison",
    semanticIds: ["serial-execution", "two-phase-locking", "ssi", "weaker-plus-guards"],
    points: [
      { title: "Queue, block, or abort", description: "Serial execution queues whole transactions, two-phase locking blocks on conflicting locks, and SSI lets both run and aborts one if the pattern is risky.", items: [0, 1, 2] },
      { title: "The common shortcut", description: "Many systems stay at a weaker level and protect known risks with atomic updates, constraints, and locks. A forgotten guard is the risk.", items: [3] },
    ],
    prediction: {
      prompt: "A database runs long reports alongside short sales writes. Sales need serializable behavior, and reports must not stall them. Which approach is least likely to make sales wait behind a report?",
      options: [
        "Two-phase locking, because shared locks let many readers run at once",
        "SSI, because readers use snapshots and take no blocking read locks",
        "Serial execution, because each report runs through to its end in turn",
        "Read committed, with explicit row locks on all the rows reports read",
      ],
      correctIndex: 1,
      explanation: "Under SSI a report does not block writers. Shared locks do block writers, and a serial queue stalls behind any long report.",
      items: [2],
    },
  }),
};
