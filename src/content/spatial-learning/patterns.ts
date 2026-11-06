import { flowLesson } from "./flow-lesson";

export const patternsTeachingContent = {
  "pt-idempotency": flowLesson("pt-idempotency", {
    kind: "flow",
    semanticIds: ["client-key", "key-row", "payment-provider", "stored-response"],
    points: [
      { title: "One key per operation", description: "The client reuses one key across retries, and a unique constraint admits only the first.", items: [0, 1] },
      { title: "The provider needs the key too", description: "Your database cannot cover the provider’s side, so the key travels with the call.", items: [1, 2] },
      { title: "Retries get the saved answer", description: "Once the response is stored on the row, a retry receives it without another charge.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A team keeps keys in the same database as orders, but inserts the key row only after the provider call returns. Two retries arrive 50 ms apart. What can happen?",
      options: [
        "The unique constraint blocks the second request ahead of its provider call",
        "The provider rejects the second call, because it has the same amount",
        "Both requests find no key and call the provider before either one inserts",
        "The second request waits, because the database runs requests one at a time",
      ],
      correctIndex: 2,
      explanation: "A constraint only guards what has been inserted. Commit the key row before the external call, so a concurrent retry sees it and does not charge again.",
      items: [1, 2],
    },
  }),
  "pt-outbox": flowLesson("pt-outbox", {
    kind: "flow",
    semanticIds: ["business-write", "outbox-row", "relay", "consumer-dedupe"],
    points: [
      { title: "One commit covers both", description: "The order and its outbox row share a transaction, so both exist or neither does.", items: [0, 1] },
      { title: "The relay does the publishing", description: "A separate process reads unsent rows, publishes them, and marks them sent.", items: [1, 2] },
      { title: "A crash means a repeat", description: "A relay that dies before marking a row publishes it again, so consumers deduplicate by event ID.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A team adds an outbox table, but keeps it in a different database cluster from the orders table. Why does this not fix the dual write?",
      options: [
        "The relay can read outbox rows only from the primary of the orders cluster",
        "The order and the outbox row no longer commit in one transaction",
        "Consumers need an extra key, since event IDs are unique per cluster alone",
        "The broker expects each outbox row to arrive from the cluster of its topic",
      ],
      correctIndex: 1,
      explanation: "The pattern depends on one atomic commit. Two clusters bring back two writes with no transaction across them, and a crash between them leaves the same disagreement.",
      items: [0, 1],
    },
  }),
  "pt-retries": flowLesson("pt-retries", {
    kind: "flow",
    semanticIds: ["slowdown", "client-retries", "full-queue", "retry-budget"],
    points: [
      { title: "A short trigger starts it", description: "A 30-second slowdown makes requests time out, and each can be retried up to 3 times.", items: [0, 1] },
      { title: "The overload feeds itself", description: "Retries keep the queue full of work whose callers have left, so nearly everything times out and retries again.", items: [1, 2] },
      { title: "A budget breaks the loop", description: "Capping retries at 10 percent holds load to 880 per second, below capacity, so the queue drains.", items: [2, 3] },
    ],
    prediction: {
      prompt: "Users send a steady 500 requests per second. Each may retry 3 times, with backoff and jitter but no budget. A dependency is down for an hour. About how many attempts per second reach it?",
      options: [
        "About 500, since backoff holds retries back until the dependency recovers",
        "About 8,000, since each failed attempt doubles the number of new attempts",
        "Close to zero, since jitter keeps most clients waiting through the outage",
        "About 2,000, since each request still makes 4 attempts, just spread out",
      ],
      correctIndex: 3,
      explanation: "New requests keep arriving, and each makes up to 4 attempts, so 500 × 4 = 2,000. Backoff and jitter change when attempts land, not how many there are. Only a budget caps the total.",
      items: [1, 3],
    },
  }),
  "pt-protect": flowLesson("pt-protect", {
    kind: "comparison",
    semanticIds: ["timeout", "circuit-breaker", "fallback", "load-shedding"],
    points: [
      { title: "The caller limits its exposure", description: "A timeout bounds one wait, and a breaker stops calling a dependency that keeps failing.", items: [0, 1] },
      { title: "An open breaker needs an answer", description: "Where one exists, a fallback such as a page with no recommendations replaces the failed call.", items: [1, 2] },
      { title: "The server protects itself", description: "Load shedding rejects excess requests early, so the accepted ones finish within their deadline.", items: [3] },
    ],
    prediction: {
      prompt: "A checkout service has one circuit breaker for its whole database, which has 16 shards. One shard goes down. What can the breaker do to checkouts on the other 15?",
      options: [
        "It stays closed, since breakers measure latency rather than failed calls",
        "It fails the affected shard’s calls alone, since breakers follow the data",
        "It reroutes those calls to a healthy shard, since half-open allows this",
        "It can open and fail them too, since it counts all failures together",
      ],
      correctIndex: 3,
      explanation: "One breaker sees one failure rate. If that rate passes the threshold, calls to healthy shards fail as well, which is why failures should be tracked per shard.",
      items: [1],
    },
  }),
  "pt-backpressure": flowLesson("pt-backpressure", {
    kind: "comparison",
    semanticIds: ["block-producer", "reject-new-work", "drop-oldest", "spill-to-disk"],
    points: [
      { title: "Tell someone upstream", description: "Blocking suits a producer that can wait. Rejecting suits a caller that can decide what to do next.", items: [0, 1] },
      { title: "Or give up on old data", description: "Dropping the oldest suits data that fresh values replace, such as live locations.", items: [2] },
      { title: "Disk only moves the limit", description: "Spilling keeps work that must survive, but it is a larger queue with a backlog to repay.", items: [3] },
    ],
    prediction: {
      prompt: "Sensors send a temperature each second into a bounded queue. Each reading is used only to display the current temperature, and the display service is slow. What fits at the limit?",
      options: [
        "Block the sensors, since each reading has to reach the display in order",
        "Reject the new readings, since the queue should keep the earliest data",
        "Drop the oldest readings, since each new reading replaces the one before",
        "Spill to disk, since a slow display can go through the history later",
      ],
      correctIndex: 2,
      explanation: "Only the latest value matters for a current-temperature display, so an old reading has no remaining use. Keeping the earliest data would show the most outdated value.",
      items: [2],
    },
  }),
  "pt-stampede": flowLesson("pt-stampede", {
    kind: "comparison",
    semanticIds: ["no-protection", "single-flight", "jittered-expiry", "serve-stale"],
    points: [
      { title: "Unprotected, all readers rebuild", description: "A key read 5,000 times per second with a 200 ms rebuild sends about 1,000 readers to the database.", items: [0] },
      { title: "Limit the rebuilds", description: "Single-flight lets one caller rebuild a key while the others wait for that result.", items: [0, 1] },
      { title: "Spread expiry or hide the rebuild", description: "Jitter spreads many keys across time, and serving stale lets readers skip the wait on a hot key.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A service with 40 servers adds in-process single-flight to a key that takes 2 seconds to rebuild. How many concurrent rebuilds can the database see at expiry?",
      options: [
        "Just 1, since single-flight coalesces readers across all servers",
        "Up to 80, since each server runs a rebuild and then one retry",
        "Up to 40, since each process coalesces only its own readers",
        "None, since readers are served the old value during the rebuild",
      ],
      correctIndex: 2,
      explanation: "In-process single-flight knows nothing about other servers, so each may run one rebuild. A shared lock is what gets the fleet down to one.",
      items: [1],
    },
  }),
};
