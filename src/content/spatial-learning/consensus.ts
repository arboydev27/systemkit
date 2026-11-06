import { flowLesson } from "./flow-lesson";

export const consensusTeachingContent = {
  "cs-linearizability": flowLesson("cs-linearizability", {
    kind: "flow",
    semanticIds: ["write-a", "read-b", "read-c", "lagging-replica"],
    points: [
      { title: "Overlap allows either answer", description: "B’s read overlaps A’s write, so it may return either value. If it returns the new one, every read starting after it must too.", items: [0, 1] },
      { title: "After the acknowledgment, no choice", description: "C starts after the write finished, so it must see the new value. A lagging follower returning the old value breaks linearizability, even if it catches up soon after.", items: [1, 2, 3] },
    ],
    prediction: {
      prompt: "Seat 14 is written “sold” and acknowledged at t=30. The leader is replaced at t=35, and a client reads from the new leader at t=40. What must a linearizable store return?",
      options: [
        "“Free” or “sold”, because a failover resets the ordering rules",
        "“Sold”, because an acknowledged write has to survive the change",
        "“Free”, because the new leader starts from its own copy of data",
        "An error, because reads stay refused for one replication interval",
      ],
      correctIndex: 1,
      explanation: "Changing leader does not excuse going back in time. The new leader must already hold every acknowledged write before it can answer as leader.",
      items: [0, 2],
    },
  }),
  "cs-cap": flowLesson("cs-cap", {
    kind: "comparison",
    semanticIds: ["partition-refuse", "partition-answer", "healthy-sync", "healthy-async"],
    points: [
      { title: "During a partition", description: "A cut-off node refuses, keeping answers correct but returning errors, or answers anyway and may be stale. It can decide per operation.", items: [0, 1] },
      { title: "On a healthy network", description: "Waiting for remote replicas costs a round trip on every write. Not waiting is fast but risks losing recent data if a region fails.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A public leaderboard shows fan rankings during a sale, and a partition cuts off one region. Which behavior suits the cut-off region’s leaderboard?",
      options: [
        "Refuse the page, because every read here must be linearizable",
        "Hide rankings in every region until the link has been restored",
        "Accept ranking writes locally and discard the remote ones later",
        "Serve the last known rankings, marked as possibly a little old",
      ],
      correctIndex: 3,
      explanation: "A slightly old leaderboard harms nobody, so availability wins. The same region can still refuse purchases, because the choice is made per operation.",
      items: [1],
    },
  }),
  "cs-ordering": flowLesson("cs-ordering", {
    kind: "flow",
    semanticIds: ["fast-clock-write", "informed-write", "last-write-wins", "lamport-counters"],
    points: [
      { title: "The stamps run backward", description: "A’s clock is 30 ms fast, so its write is stamped later than B’s, even though B’s write came 15 ms afterward and was based on A’s value.", items: [0, 1] },
      { title: "The wrong write survives", description: "Last-write-wins compares stamps, keeps 90, and drops the later 80 with no error.", items: [1, 2] },
      { title: "Counters follow cause", description: "B’s counter jumps past the 8 carried from A’s write, so the later write gets 9 and wins.", items: [1, 2, 3] },
    ],
    prediction: {
      prompt: "Replay the same two writes, but with A’s clock 30 ms slow instead of fast. Which value does last-write-wins keep?",
      options: [
        "80, but only because this skew happens to favor the right write",
        "90, because A’s write happened first and so it has priority here",
        "80, because NTP has now corrected A’s clock before B’s write began",
        "90, because any clock skew reverses the order of the two writes",
      ],
      correctIndex: 0,
      explanation: "A’s stamp is now earlier, so 80 wins, and the bug stays invisible. Nothing changed in the design, which is why clock-based ordering can pass tests and still fail later.",
      items: [0, 1, 2],
    },
  }),
  "cs-fencing": flowLesson("cs-fencing", {
    kind: "flow",
    semanticIds: ["p1-lease", "lease-expiry", "p1-wakes", "token-check"],
    points: [
      { title: "A pause outlasts the lease", description: "P1 freezes holding token 71. The lease expires, and P2 receives token 72 and writes.", items: [0, 1] },
      { title: "Storage has the last word", description: "P1 wakes believing it leads and cannot tell otherwise. Storage has seen 72, so it refuses the write carrying 71.", items: [1, 2, 3] },
    ],
    prediction: {
      prompt: "P1 (token 71) wakes up after its lease expired, and writes before P2 (token 72) has written anything. P2 writes next. What does storage do with each write?",
      options: [
        "It refuses P1’s write, because P1’s lease had already expired",
        "It refuses P2’s write, because storage has just heard from P1",
        "It accepts both, and refuses any later write that carries 71",
        "It refuses both, until the lock service settles who the leader is",
      ],
      correctIndex: 2,
      explanation: "Storage knows only tokens, not leases. 71 is the highest it has seen, so it is accepted, and 72 is accepted after it. From then on 71 is fenced off, and P2’s work is not overwritten.",
      items: [3],
    },
  }),
  "cs-raft": flowLesson("cs-raft", {
    kind: "flow",
    semanticIds: ["leader-append", "majority-store", "candidate-refused", "new-leader"],
    points: [
      { title: "Committed means a majority has it", description: "N1 appends entry 42 and copies it. Three of five nodes hold it, so N1 can acknowledge the client.", items: [0, 1] },
      { title: "Votes protect committed entries", description: "N4 lacks entry 42, and N3 refuses to vote for it, so N4 stops at two votes. N3 wins a later term with three, and the entry survives.", items: [1, 2, 3] },
    ],
    prediction: {
      prompt: "N1 leads term 7 and appends an entry that only N1 and N2 store before N1 is cut off. N3 then wins term 8 without that entry. Has a client lost an acknowledged write?",
      options: [
        "Yes, because the leader stored it, and clients hear back at that point",
        "No, because N3 will copy the entry from N1 once the link has healed",
        "Yes, because a follower also held it, and that makes it committed",
        "No, because without a majority the entry was not acknowledged",
      ],
      correctIndex: 3,
      explanation: "Two of five is not a majority, so the entry never committed and the client never heard success. The entry is overwritten when N1 and N2 rejoin, and the client should retry.",
      items: [0, 1, 3],
    },
  }),
  "cs-2pc": flowLesson("cs-2pc", {
    kind: "comparison",
    semanticIds: ["two-phase-commit", "consensus-group", "commit-over-consensus", "coordination-service"],
    points: [
      { title: "All versus a majority", description: "2PC needs every participant’s yes and blocks if its coordinator disappears after the votes. Consensus continues as long as a majority is alive.", items: [0, 1] },
      { title: "Using them in practice", description: "Running 2PC over consensus groups makes the commit decision survive a crash. A coordination service gives you consensus for small data without building it.", items: [2, 3] },
    ],
    prediction: {
      prompt: "Four participants run two-phase commit on one transaction. One participant’s disk is full, so it votes no while the other three vote yes. What happens?",
      options: [
        "The three yes voters commit, because they form a clear majority",
        "All four abort, because commit requires every vote to be yes",
        "The three commit, and the fourth catches up when it has disk space",
        "The coordinator waits, because a no vote needs a second voting round",
      ],
      correctIndex: 1,
      explanation: "Atomic commit is unanimous: one no aborts the transaction everywhere. Majority rules belong to consensus, where nodes agree on a value rather than on whether every party can do its part.",
      items: [0],
    },
  }),
};
