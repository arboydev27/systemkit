import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const keyValueTeachingContent: Record<string, TeachingContent> = {
  "kv-contract": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-contract:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "kv-contract:node:1": {"lane": 1, "order": 2, "semanticId": "get-key"},
      "kv-contract:node:2": {"lane": 2, "order": 2, "semanticId": "partition"},
      "kv-contract:node:3": {"lane": 3, "order": 2, "semanticId": "result"},
      "kv-contract:node:4": {"lane": 2, "order": 4, "semanticId": "other-queries"}
    },
    "relationships": {
      "kv-contract:relation:0": {"meaning": "connection", "condition": "", "explanation": "Client (known order ID) leads to get(key) (exact lookup) in this lesson. A key identifies an opaque value; the access pattern drives the design."},
      "kv-contract:relation:1": {"meaning": "connection", "condition": "", "explanation": "get(key) (exact lookup) leads to Partition (opaque value) in this lesson. A key identifies an opaque value; the access pattern drives the design."},
      "kv-contract:relation:2": {"meaning": "connection", "condition": "", "explanation": "Partition (opaque value) leads to Result (one value) in this lesson. A key identifies an opaque value; the access pattern drives the design."},
      "kv-contract:relation:3": {"meaning": "connection", "condition": "", "explanation": "Partition (opaque value) leads to Other queries (separate index) in this lesson. A key identifies an opaque value; the access pattern drives the design."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-contract:explain:1",
        "title": "Define the key-value API contract",
        "description": "A key-value store associates a unique key with an opaque value. Its core operations are put(key, value) and get(key). Deletion, conditional writes, expiration, and listing are separate product decisions. Direct lookup by known key is its strength; arbitrary joins or filtering across values need another index or data model.",
        "nodeIds": ["kv-contract:node:0", "kv-contract:node:1", "kv-contract:node:2", "kv-contract:node:3", "kv-contract:node:4"],
        "linkIds": ["kv-contract:relation:0", "kv-contract:relation:1", "kv-contract:relation:2", "kv-contract:relation:3"]
      },
      {
        "id": "kv-contract:explain:2",
        "title": "State durability and freshness requirements",
        "description": "Agree on key and value sizes, volume, read/write mix, latency, availability, durability, and whether a read must reflect the latest acknowledged write. A one-machine hash table is a useful first model, but a data set larger than one machine or machine failure forces distribution and recovery into the contract.",
        "nodeIds": ["kv-contract:node:1", "kv-contract:node:2", "kv-contract:node:3"],
        "linkIds": ["kv-contract:relation:1", "kv-contract:relation:2"],
        "viewId": "kv-contract:view:point-2"
      }
    ],
    "views": [
      {
        "id": "kv-contract:view:point-2",
        "title": "State durability and freshness requirements",
        "description": "Agree on key and value sizes, volume, read/write mix, latency, availability, durability, and whether a read must reflect the latest acknowledged write. A one-machine hash table is a useful first model, but a data set larger than one machine or machine failure forces distribution and recovery into the contract.",
        "members": ["kv-contract:node:1", "kv-contract:node:2", "kv-contract:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-contract:predict:range-query",
        "title": "Predict a new query requirement",
        "prompt": "The displayed get(key) path returns one opaque value. The product now needs a query over many order records. Which diagram responsibility needs a separate design?",
        "options": ["Other queries: separate index", "get(key) magically becomes an arbitrary join engine", "Client identity alone performs the query"],
        "correctIndex": 0,
        "explanation": "The partition supports exact key lookup. The Other queries branch explicitly calls for a separate index; the key-value contract does not automatically supply arbitrary searches.",
        "reveal": {
          "id": "kv-contract:reveal:range-query",
          "title": "Predict a new query requirement",
          "description": "The partition supports exact key lookup. The Other queries branch explicitly calls for a separate index; the key-value contract does not automatically supply arbitrary searches.",
          "nodeIds": ["kv-contract:node:1", "kv-contract:node:2", "kv-contract:node:3", "kv-contract:node:4"],
          "linkIds": ["kv-contract:relation:1", "kv-contract:relation:2", "kv-contract:relation:3"]
        }
      }
    ]
  },
  "kv-partition": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-partition:node:0": {"lane": 0, "order": 2, "semanticId": "hash-key"},
      "kv-partition:node:1": {"lane": 1, "order": 1, "semanticId": "node-a"},
      "kv-partition:node:2": {"lane": 2, "order": 1, "semanticId": "node-b"},
      "kv-partition:node:3": {"lane": 3, "order": 2, "semanticId": "node-c"},
      "kv-partition:node:4": {"lane": 2, "order": 4, "semanticId": "new-node"},
      "kv-partition:node:5": {"lane": 1, "order": 4, "semanticId": "virtual-nodes"}
    },
    "relationships": {
      "kv-partition:relation:0": {"meaning": "connection", "condition": "", "explanation": "hash(key) (stable position) leads to Node A (range A) in this lesson. Partitioning distributes data; it does not create a safety copy."},
      "kv-partition:relation:1": {"meaning": "connection", "condition": "", "explanation": "Node A (range A) leads to Node B (range B) in this lesson. Partitioning distributes data; it does not create a safety copy."},
      "kv-partition:relation:2": {"meaning": "connection", "condition": "", "explanation": "Node B (range B) leads to Node C (range C) in this lesson. Partitioning distributes data; it does not create a safety copy."},
      "kv-partition:relation:3": {"meaning": "connection", "condition": "", "explanation": "Node C (range C) leads to New node (takes a range) in this lesson. Partitioning distributes data; it does not create a safety copy."},
      "kv-partition:relation:4": {"meaning": "connection", "condition": "", "explanation": "New node (takes a range) leads to Virtual nodes (balance owners) in this lesson. Partitioning distributes data; it does not create a safety copy."},
      "kv-partition:relation:5": {"meaning": "connection", "condition": "", "explanation": "Virtual nodes (balance owners) leads to Node A (range A) in this lesson. Partitioning distributes data; it does not create a safety copy."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-partition:explain:1",
        "title": "Map keys to owned ranges",
        "description": "Hash each key to a partition and route requests to its owner. Consistent hashing places keys and node positions on a ring; a key maps to the next owner clockwise. Virtual nodes distribute ownership more evenly and let larger machines take more ranges. Clients or coordinators need a current membership map during changes.",
        "nodeIds": ["kv-partition:node:0", "kv-partition:node:2", "kv-partition:node:3", "kv-partition:node:4", "kv-partition:node:5"],
        "linkIds": ["kv-partition:relation:2", "kv-partition:relation:3", "kv-partition:relation:4"],
        "viewId": "kv-partition:view:point-1"
      },
      {
        "id": "kv-partition:explain:2",
        "title": "Move ranges with an explicit cutover",
        "description": "When a node joins, only ranges it takes need to move. That transfer still costs network and disk capacity. Watch for hot keys: balanced key counts do not guarantee balanced request load. Replication and caching can help reads, but a write-hot key may require a different data model.",
        "nodeIds": ["kv-partition:node:1", "kv-partition:node:2", "kv-partition:node:3", "kv-partition:node:4", "kv-partition:node:5"],
        "linkIds": ["kv-partition:relation:1", "kv-partition:relation:2", "kv-partition:relation:3", "kv-partition:relation:4", "kv-partition:relation:5"],
        "viewId": "kv-partition:view:point-2"
      }
    ],
    "views": [
      {
        "id": "kv-partition:view:point-1",
        "title": "Map keys to owned ranges",
        "description": "Hash each key to a partition and route requests to its owner. Consistent hashing places keys and node positions on a ring; a key maps to the next owner clockwise. Virtual nodes distribute ownership more evenly and let larger machines take more ranges. Clients or coordinators need a current membership map during changes.",
        "members": ["kv-partition:node:0", "kv-partition:node:2", "kv-partition:node:3", "kv-partition:node:4", "kv-partition:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "kv-partition:view:point-2",
        "title": "Move ranges with an explicit cutover",
        "description": "When a node joins, only ranges it takes need to move. That transfer still costs network and disk capacity. Watch for hot keys: balanced key counts do not guarantee balanced request load. Replication and caching can help reads, but a write-hot key may require a different data model.",
        "members": ["kv-partition:node:1", "kv-partition:node:2", "kv-partition:node:3", "kv-partition:node:4", "kv-partition:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-partition:predict:kvq04",
        "title": "Predict the design consequence",
        "prompt": "A server joins a consistent-hash ring. Which data should normally move?",
        "options": ["Every key", "Ranges assigned to the new owner", "Only cached values", "Nothing until failure"],
        "correctIndex": 1,
        "explanation": "Consistent hashing limits movement to ranges whose ownership changes.",
        "reveal": {
          "id": "kv-partition:reveal:kvq04",
          "title": "Why this choice follows",
          "description": "Consistent hashing limits movement to ranges whose ownership changes.",
          "nodeIds": ["kv-partition:node:1", "kv-partition:node:2", "kv-partition:node:3", "kv-partition:node:4"],
          "linkIds": ["kv-partition:relation:1", "kv-partition:relation:2", "kv-partition:relation:3"]
        }
      }
    ]
  },
  "kv-replication": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-replication:node:0": {"lane": 0, "order": 2, "semanticId": "coordinator"},
      "kv-replication:node:1": {"lane": 1, "order": 1, "semanticId": "replica-a"},
      "kv-replication:node:2": {"lane": 1, "order": 3, "semanticId": "replica-b"},
      "kv-replication:node:3": {"lane": 3, "order": 2, "semanticId": "replica-c"},
      "kv-replication:node:4": {"lane": 2, "order": 2, "semanticId": "n-3"}
    },
    "relationships": {
      "kv-replication:relation:0": {"meaning": "connection", "condition": "", "explanation": "Coordinator (key → owners) leads to Replica A (rack 1) in this lesson. N counts independent physical replicas."},
      "kv-replication:relation:1": {"meaning": "connection", "condition": "", "explanation": "Coordinator (key → owners) leads to Replica B (rack 2) in this lesson. N counts independent physical replicas."},
      "kv-replication:relation:2": {"meaning": "connection", "condition": "", "explanation": "Replica A (rack 1) leads to N = 3 (3 hosts) in this lesson. N counts independent physical replicas."},
      "kv-replication:relation:3": {"meaning": "connection", "condition": "", "explanation": "Replica B (rack 2) leads to N = 3 (3 hosts) in this lesson. N counts independent physical replicas."},
      "kv-replication:relation:4": {"meaning": "connection", "condition": "", "explanation": "N = 3 (3 hosts) leads to Replica C (other site) in this lesson. N counts independent physical replicas."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-replication:explain:1",
        "title": "Place copies in distinct failure domains",
        "description": "For each key choose N distinct physical replicas, often by walking a placement ring. A coordinator sends reads and writes to them. Distinct virtual nodes on one machine are not distinct safety copies. Place copies across independent racks or data centers when those failures are in scope, and budget for extra storage and write traffic.",
        "nodeIds": ["kv-replication:node:0", "kv-replication:node:1", "kv-replication:node:2", "kv-replication:node:3"],
        "linkIds": ["kv-replication:relation:0", "kv-replication:relation:1"],
        "viewId": "kv-replication:view:point-1"
      },
      {
        "id": "kv-replication:explain:2",
        "title": "Allow for temporary replica differences",
        "description": "Copies can temporarily differ. Partitioning answers where a key belongs; replication answers where additional copies belong. Neither alone defines when put() acknowledges success or which version get() returns.",
        "nodeIds": ["kv-replication:node:0", "kv-replication:node:1", "kv-replication:node:2"],
        "linkIds": ["kv-replication:relation:0", "kv-replication:relation:1"],
        "viewId": "kv-replication:view:point-2"
      }
    ],
    "views": [
      {
        "id": "kv-replication:view:point-1",
        "title": "Place copies in distinct failure domains",
        "description": "For each key choose N distinct physical replicas, often by walking a placement ring. A coordinator sends reads and writes to them. Distinct virtual nodes on one machine are not distinct safety copies. Place copies across independent racks or data centers when those failures are in scope, and budget for extra storage and write traffic.",
        "members": ["kv-replication:node:0", "kv-replication:node:1", "kv-replication:node:2", "kv-replication:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "kv-replication:view:point-2",
        "title": "Allow for temporary replica differences",
        "description": "Copies can temporarily differ. Partitioning answers where a key belongs; replication answers where additional copies belong. Neither alone defines when put() acknowledges success or which version get() returns.",
        "members": ["kv-replication:node:0", "kv-replication:node:1", "kv-replication:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-replication:predict:rack-loss",
        "title": "Predict a rack failure",
        "prompt": "Replica A in rack 1 is unavailable. Which displayed copies occupy other failure domains?",
        "options": ["Replica B in rack 2 and Replica C at another site", "Three tokens on Replica A as three independent hosts", "N = 3 as an extra physical storage server"],
        "correctIndex": 0,
        "explanation": "The authored replica details name rack 1, rack 2, and another site, while N = 3 summarizes three hosts. Distinct placement leaves other copies when one rack fails.",
        "reveal": {
          "id": "kv-replication:reveal:rack-loss",
          "title": "Predict a rack failure",
          "description": "The authored replica details name rack 1, rack 2, and another site, while N = 3 summarizes three hosts. Distinct placement leaves other copies when one rack fails.",
          "nodeIds": ["kv-replication:node:1", "kv-replication:node:2", "kv-replication:node:3", "kv-replication:node:4"],
          "linkIds": [],
          "statuses": {
            "kv-replication:node:1": "unavailable",
            "kv-replication:node:2": "active",
            "kv-replication:node:3": "active"
          }
        }
      }
    ]
  },
  "kv-quorum": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-quorum:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "kv-quorum:node:1": {"lane": 1, "order": 2, "semanticId": "coordinator"},
      "kv-quorum:node:2": {"lane": 2, "order": 1, "semanticId": "replica-a"},
      "kv-quorum:node:3": {"lane": 2, "order": 2, "semanticId": "replica-b"},
      "kv-quorum:node:4": {"lane": 2, "order": 4, "semanticId": "replica-c"},
      "kv-quorum:node:5": {"lane": 3, "order": 2, "semanticId": "return"}
    },
    "relationships": {
      "kv-quorum:relation:0": {"meaning": "connection", "condition": "", "explanation": "Client (put(k,v)) leads to Coordinator (W = 2 · R = 2) in this lesson. W + R > N gives overlap for fixed replica sets, subject to assumptions."},
      "kv-quorum:relation:1": {"meaning": "connection", "condition": "", "explanation": "Coordinator (W = 2 · R = 2) leads to Replica A (acknowledges) in this lesson. W + R > N gives overlap for fixed replica sets, subject to assumptions."},
      "kv-quorum:relation:2": {"meaning": "connection", "condition": "", "explanation": "Coordinator (W = 2 · R = 2) leads to Replica B (acknowledges) in this lesson. W + R > N gives overlap for fixed replica sets, subject to assumptions."},
      "kv-quorum:relation:3": {"meaning": "connection", "condition": "", "explanation": "Coordinator (W = 2 · R = 2) leads to Replica C (may lag) in this lesson. W + R > N gives overlap for fixed replica sets, subject to assumptions."},
      "kv-quorum:relation:4": {"meaning": "connection", "condition": "", "explanation": "Replica A (acknowledges) leads to Return (after 2 acks) in this lesson. W + R > N gives overlap for fixed replica sets, subject to assumptions."},
      "kv-quorum:relation:5": {"meaning": "connection", "condition": "", "explanation": "Replica B (acknowledges) leads to Return (after 2 acks) in this lesson. W + R > N gives overlap for fixed replica sets, subject to assumptions."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-quorum:explain:1",
        "title": "Choose required replica acknowledgements",
        "description": "Let N be replica count, W required write acknowledgments, and R required read responses. With N = 3 and W = R = 2, every fixed read and write set intersects. Waiting for more responses raises latency and can lower availability when links or replicas fail. W = 1 acknowledges quickly but leaves a larger stale-read and data-loss window.",
        "nodeIds": ["kv-quorum:node:1", "kv-quorum:node:2", "kv-quorum:node:3", "kv-quorum:node:4"],
        "linkIds": ["kv-quorum:relation:1", "kv-quorum:relation:2", "kv-quorum:relation:3"],
        "viewId": "kv-quorum:view:point-1"
      },
      {
        "id": "kv-quorum:explain:2",
        "title": "Understand overlap and concurrency limits",
        "description": "The familiar W + R > N rule provides overlap under a stable replica set, but does not alone make arbitrary concurrent writes linearizable. Sloppy quorums, changing membership, version selection, and races need further rules. During a network partition decide which operations can proceed and which freshness guarantee must hold.",
        "nodeIds": ["kv-quorum:node:1", "kv-quorum:node:2", "kv-quorum:node:3", "kv-quorum:node:4"],
        "linkIds": ["kv-quorum:relation:1", "kv-quorum:relation:2", "kv-quorum:relation:3"]
      }
    ],
    "views": [
      {
        "id": "kv-quorum:view:point-1",
        "title": "Choose required replica acknowledgements",
        "description": "Let N be replica count, W required write acknowledgments, and R required read responses. With N = 3 and W = R = 2, every fixed read and write set intersects. Waiting for more responses raises latency and can lower availability when links or replicas fail. W = 1 acknowledges quickly but leaves a larger stale-read and data-loss window.",
        "members": ["kv-quorum:node:1", "kv-quorum:node:2", "kv-quorum:node:3", "kv-quorum:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-quorum:predict:two-acks",
        "title": "Predict the write return",
        "prompt": "Replica A and Replica B acknowledge the displayed W = 2 write while Replica C may lag. Which displayed outcome can follow once the required acknowledgments are valid?",
        "options": ["Return after 2 acknowledgments", "Wait for C merely because every operation requires all three", "Return before either acknowledgment"],
        "correctIndex": 0,
        "explanation": "The write contract chooses W = 2. A and B each have an authored acknowledgment path to Return; C can lag, so success does not imply every copy has already converged.",
        "reveal": {
          "id": "kv-quorum:reveal:two-acks",
          "title": "Predict the write return",
          "description": "The write contract chooses W = 2. A and B each have an authored acknowledgment path to Return; C can lag, so success does not imply every copy has already converged.",
          "nodeIds": ["kv-quorum:node:1", "kv-quorum:node:2", "kv-quorum:node:3", "kv-quorum:node:4", "kv-quorum:node:5"],
          "linkIds": ["kv-quorum:relation:1", "kv-quorum:relation:2", "kv-quorum:relation:4", "kv-quorum:relation:5"]
        }
      }
    ]
  },
  "kv-conflicts": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-conflicts:node:0": {"lane": 0, "order": 2, "semanticId": "v1"},
      "kv-conflicts:node:1": {"lane": 1, "order": 1, "semanticId": "v2a"},
      "kv-conflicts:node:2": {"lane": 1, "order": 3, "semanticId": "v2b"},
      "kv-conflicts:node:3": {"lane": 2, "order": 2, "semanticId": "compare"},
      "kv-conflicts:node:4": {"lane": 3, "order": 2, "semanticId": "v3"}
    },
    "relationships": {
      "kv-conflicts:relation:0": {"meaning": "connection", "condition": "", "explanation": "v1 (shared ancestor) leads to v2a (device A edit) in this lesson. Concurrent writes can both be accepted without a single correct timestamp winner."},
      "kv-conflicts:relation:1": {"meaning": "connection", "condition": "", "explanation": "v1 (shared ancestor) leads to v2b (device B edit) in this lesson. Concurrent writes can both be accepted without a single correct timestamp winner."},
      "kv-conflicts:relation:2": {"meaning": "connection", "condition": "", "explanation": "v2a (device A edit) leads to Compare (concurrent siblings) in this lesson. Concurrent writes can both be accepted without a single correct timestamp winner."},
      "kv-conflicts:relation:3": {"meaning": "connection", "condition": "", "explanation": "v2b (device B edit) leads to Compare (concurrent siblings) in this lesson. Concurrent writes can both be accepted without a single correct timestamp winner."},
      "kv-conflicts:relation:4": {"meaning": "connection", "condition": "", "explanation": "Compare (concurrent siblings) leads to v3 (domain merge) in this lesson. Concurrent writes can both be accepted without a single correct timestamp winner."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-conflicts:explain:1",
        "title": "Recognize concurrent changes from one version",
        "description": "Two clients can read one version, change it differently, and write nearly together. Last-write-wins is simple but can discard an accepted update, especially when clocks disagree. Compare-and-set can reject a stale edit; another design exposes sibling versions for application reconciliation. A preference, a cart, and a balance require different policies.",
        "nodeIds": ["kv-conflicts:node:1", "kv-conflicts:node:2", "kv-conflicts:node:3"],
        "linkIds": ["kv-conflicts:relation:2", "kv-conflicts:relation:3"],
        "viewId": "kv-conflicts:view:point-1"
      },
      {
        "id": "kv-conflicts:explain:2",
        "title": "Retain siblings for safe reconciliation",
        "description": "Vector clocks or related metadata distinguish descendants from concurrent siblings. If one version includes every causal update in another, it can replace its ancestor. Incomparable versions need a merge. Metadata size, tombstones, retries, and client logic add cost. A vector clock detects conflict; it cannot decide the business outcome.",
        "nodeIds": ["kv-conflicts:node:0", "kv-conflicts:node:3", "kv-conflicts:node:4"],
        "linkIds": ["kv-conflicts:relation:4"],
        "viewId": "kv-conflicts:view:point-2"
      }
    ],
    "views": [
      {
        "id": "kv-conflicts:view:point-1",
        "title": "Recognize concurrent changes from one version",
        "description": "Two clients can read one version, change it differently, and write nearly together. Last-write-wins is simple but can discard an accepted update, especially when clocks disagree. Compare-and-set can reject a stale edit; another design exposes sibling versions for application reconciliation. A preference, a cart, and a balance require different policies.",
        "members": ["kv-conflicts:node:1", "kv-conflicts:node:2", "kv-conflicts:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "kv-conflicts:view:point-2",
        "title": "Retain siblings for safe reconciliation",
        "description": "Vector clocks or related metadata distinguish descendants from concurrent siblings. If one version includes every causal update in another, it can replace its ancestor. Incomparable versions need a merge. Metadata size, tombstones, retries, and client logic add cost. A vector clock detects conflict; it cannot decide the business outcome.",
        "members": ["kv-conflicts:node:0", "kv-conflicts:node:3", "kv-conflicts:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-conflicts:predict:kvq11",
        "title": "Predict the design consequence",
        "prompt": "Two clients edit a cart from one original version. Which approach preserves both edits for reconciliation?",
        "options": ["Keep the newest timestamp", "Return sibling versions", "Discard the original key", "Move partitions"],
        "correctIndex": 1,
        "explanation": "Siblings preserve concurrent outcomes for domain-aware merging.",
        "reveal": {
          "id": "kv-conflicts:reveal:kvq11",
          "title": "Why this choice follows",
          "description": "Siblings preserve concurrent outcomes for domain-aware merging.",
          "nodeIds": ["kv-conflicts:node:1", "kv-conflicts:node:2", "kv-conflicts:node:3", "kv-conflicts:node:4"],
          "linkIds": ["kv-conflicts:relation:2", "kv-conflicts:relation:3", "kv-conflicts:relation:4"]
        }
      }
    ]
  },
  "kv-failure": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-failure:node:0": {"lane": 0, "order": 2, "semanticId": "coordinator"},
      "kv-failure:node:1": {"lane": 1, "order": 1, "semanticId": "replica-a"},
      "kv-failure:node:2": {"lane": 1, "order": 3, "semanticId": "replica-b"},
      "kv-failure:node:3": {"lane": 2, "order": 2, "semanticId": "substitute-c"},
      "kv-failure:node:4": {"lane": 3, "order": 2, "semanticId": "recovery"}
    },
    "relationships": {
      "kv-failure:relation:0": {"meaning": "connection", "condition": "", "explanation": "Coordinator (preferred set) leads to Replica A (reachable) in this lesson. Failure detection is uncertain under delay."},
      "kv-failure:relation:1": {"meaning": "connection", "condition": "", "explanation": "Coordinator (preferred set) leads to Substitute C (holds hint for B) in this lesson. Failure detection is uncertain under delay."},
      "kv-failure:relation:2": {"meaning": "connection", "condition": "", "explanation": "Substitute C (holds hint for B) leads to Recovery (handoff to B) in this lesson. Failure detection is uncertain under delay."},
      "kv-failure:relation:3": {"meaning": "connection", "condition": "", "explanation": "Recovery (handoff to B) leads to Replica B (temporarily out) in this lesson. Failure detection is uncertain under delay."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-failure:explain:1",
        "title": "Treat a missed heartbeat as suspicion",
        "description": "Nodes can share membership and heartbeat observations through gossip. One missed heartbeat is suspicion, not proof: slow links and overloaded machines can look dead. Use multiple observations and appropriate timeouts, then update routing without a single membership dependency.",
        "nodeIds": ["kv-failure:node:0", "kv-failure:node:1", "kv-failure:node:2"],
        "linkIds": ["kv-failure:relation:0"],
        "viewId": "kv-failure:view:point-1"
      },
      {
        "id": "kv-failure:explain:2",
        "title": "Retain hints when using substitute nodes",
        "description": "A sloppy quorum can use healthy substitute nodes when preferred replicas are unreachable. Hinted handoff stores a temporary copy tagged with its target owner and sends it back after recovery. This helps availability, but weakens simple fixed-set quorum reasoning. Hints can expire or fail, so they cannot be the only repair process.",
        "nodeIds": ["kv-failure:node:0", "kv-failure:node:1", "kv-failure:node:2", "kv-failure:node:3", "kv-failure:node:4"],
        "linkIds": ["kv-failure:relation:0", "kv-failure:relation:1", "kv-failure:relation:2", "kv-failure:relation:3"]
      }
    ],
    "views": [
      {
        "id": "kv-failure:view:point-1",
        "title": "Treat a missed heartbeat as suspicion",
        "description": "Nodes can share membership and heartbeat observations through gossip. One missed heartbeat is suspicion, not proof: slow links and overloaded machines can look dead. Use multiple observations and appropriate timeouts, then update routing without a single membership dependency.",
        "members": ["kv-failure:node:0", "kv-failure:node:1", "kv-failure:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-failure:predict:preferred-replica-out",
        "title": "Predict temporary replica failure",
        "prompt": "Replica B is temporarily out. What does the displayed Substitute C path retain for recovery?",
        "options": ["A hint for B, later handed off through Recovery", "Proof that B permanently died", "A guarantee that every read has newest data"],
        "correctIndex": 0,
        "explanation": "Coordinator can use Substitute C under the sloppy-quorum policy. C retains a hint for B and Recovery hands it back; this is separate from guarantees on fixed replica overlap.",
        "reveal": {
          "id": "kv-failure:reveal:preferred-replica-out",
          "title": "Predict temporary replica failure",
          "description": "Coordinator can use Substitute C under the sloppy-quorum policy. C retains a hint for B and Recovery hands it back; this is separate from guarantees on fixed replica overlap.",
          "nodeIds": ["kv-failure:node:0", "kv-failure:node:2", "kv-failure:node:3", "kv-failure:node:4"],
          "linkIds": ["kv-failure:relation:1", "kv-failure:relation:2", "kv-failure:relation:3"],
          "statuses": {
            "kv-failure:node:2": "unavailable",
            "kv-failure:node:3": "active"
          }
        }
      }
    ]
  },
  "kv-repair": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-repair:node:0": {"lane": 0, "order": 2, "semanticId": "replica-a"},
      "kv-repair:node:1": {"lane": 1, "order": 2, "semanticId": "root-hashes"},
      "kv-repair:node:2": {"lane": 2, "order": 1, "semanticId": "left-branch"},
      "kv-repair:node:3": {"lane": 2, "order": 3, "semanticId": "right-branch"},
      "kv-repair:node:4": {"lane": 3, "order": 2, "semanticId": "repair-keys"}
    },
    "relationships": {
      "kv-repair:relation:0": {"meaning": "connection", "condition": "", "explanation": "Replica A (range 00–99) leads to Root hashes (different) in this lesson. Merkle comparisons narrow the ranges that differ."},
      "kv-repair:relation:1": {"meaning": "connection", "condition": "", "explanation": "Root hashes (different) leads to Left branch (same · skip) in this lesson. Merkle comparisons narrow the ranges that differ."},
      "kv-repair:relation:2": {"meaning": "connection", "condition": "", "explanation": "Root hashes (different) leads to Right branch (differs) in this lesson. Merkle comparisons narrow the ranges that differ."},
      "kv-repair:relation:3": {"meaning": "connection", "condition": "", "explanation": "Right branch (differs) leads to Repair keys (versions + deletes) in this lesson. Merkle comparisons narrow the ranges that differ."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-repair:explain:1",
        "title": "Compare replicas and repair differences",
        "description": "Periodic anti-entropy compares replicas responsible for the same range. A Merkle tree hashes groups of keys and values upward. Matching hashes skip entire subtrees; mismatches narrow the ranges that need transfer. The tree detects differences, but does not decide which value is authoritative.",
        "nodeIds": ["kv-repair:node:0", "kv-repair:node:1", "kv-repair:node:2", "kv-repair:node:4"],
        "linkIds": ["kv-repair:relation:0", "kv-repair:relation:1"],
        "viewId": "kv-repair:view:point-1"
      },
      {
        "id": "kv-repair:explain:2",
        "title": "Retain deletion metadata through safe repair",
        "description": "Repair needs version and deletion metadata. A deleted key needs a tombstone retained long enough to stop an old replica from resurrecting it. Measure repair lag and bytes transferred, and rate-limit background repair so foreground traffic remains healthy. Multi-data-center survival also needs cross-site copies and recovery drills.",
        "nodeIds": ["kv-repair:node:0", "kv-repair:node:1", "kv-repair:node:4"],
        "linkIds": ["kv-repair:relation:0"],
        "viewId": "kv-repair:view:point-2"
      }
    ],
    "views": [
      {
        "id": "kv-repair:view:point-1",
        "title": "Compare replicas and repair differences",
        "description": "Periodic anti-entropy compares replicas responsible for the same range. A Merkle tree hashes groups of keys and values upward. Matching hashes skip entire subtrees; mismatches narrow the ranges that need transfer. The tree detects differences, but does not decide which value is authoritative.",
        "members": ["kv-repair:node:0", "kv-repair:node:1", "kv-repair:node:2", "kv-repair:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "kv-repair:view:point-2",
        "title": "Retain deletion metadata through safe repair",
        "description": "Repair needs version and deletion metadata. A deleted key needs a tombstone retained long enough to stop an old replica from resurrecting it. Measure repair lag and bytes transferred, and rate-limit background repair so foreground traffic remains healthy. Multi-data-center survival also needs cross-site copies and recovery drills.",
        "members": ["kv-repair:node:0", "kv-repair:node:1", "kv-repair:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-repair:predict:kvq15",
        "title": "Predict the design consequence",
        "prompt": "An old value reappears when a node missing a delete rejoins. What failed?",
        "options": ["API syntax", "Deletion metadata expired before safe repair", "Virtual nodes", "TCP"],
        "correctIndex": 1,
        "explanation": "A retained tombstone carries the deletion version.",
        "reveal": {
          "id": "kv-repair:reveal:kvq15",
          "title": "Why this choice follows",
          "description": "A retained tombstone carries the deletion version.",
          "nodeIds": ["kv-repair:node:1", "kv-repair:node:3", "kv-repair:node:4"],
          "linkIds": ["kv-repair:relation:2", "kv-repair:relation:3"]
        }
      }
    ]
  },
  "kv-paths": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-paths:node:0": {"lane": 0, "order": 1, "semanticId": "put-k-v"},
      "kv-paths:node:1": {"lane": 1, "order": 1, "semanticId": "commit-log"},
      "kv-paths:node:2": {"lane": 2, "order": 1, "semanticId": "memtable"},
      "kv-paths:node:3": {"lane": 3, "order": 1, "semanticId": "sstables"},
      "kv-paths:node:4": {"lane": 0, "order": 4, "semanticId": "get-k"},
      "kv-paths:node:5": {"lane": 1, "order": 4, "semanticId": "memory"},
      "kv-paths:node:6": {"lane": 2, "order": 4, "semanticId": "bloom-filter"},
      "kv-paths:node:7": {"lane": 3, "order": 4, "semanticId": "disk-lookup"}
    },
    "relationships": {
      "kv-paths:relation:0": {"meaning": "connection", "condition": "", "explanation": "put(k,v) (write) leads to Commit log (durability gate) in this lesson. Replica acknowledgments need an explicit durability boundary."},
      "kv-paths:relation:1": {"meaning": "connection", "condition": "", "explanation": "Commit log (durability gate) leads to Memtable (fast writes) in this lesson. Replica acknowledgments need an explicit durability boundary."},
      "kv-paths:relation:2": {"meaning": "connection", "condition": "", "explanation": "Memtable (fast writes) leads to SSTables (flush + compaction) in this lesson. Replica acknowledgments need an explicit durability boundary."},
      "kv-paths:relation:3": {"meaning": "connection", "condition": "", "explanation": "get(k) (read) leads to Memory (check first) in this lesson. Replica acknowledgments need an explicit durability boundary."},
      "kv-paths:relation:4": {"meaning": "connection", "condition": "", "explanation": "Memory (check first) leads to Bloom filter (no / maybe) in this lesson. Replica acknowledgments need an explicit durability boundary."},
      "kv-paths:relation:5": {"meaning": "connection", "condition": "", "explanation": "Bloom filter (no / maybe) leads to Disk lookup (if maybe) in this lesson. Replica acknowledgments need an explicit durability boundary."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-paths:explain:1",
        "title": "Persist the write before acknowledging",
        "description": "A log-structured replica commonly appends a write to a durable log and updates an in-memory table. It later flushes sorted tables to disk. Acknowledging before the required log durability boundary risks losing a write on restart, even if the coordinator counted it. Compaction merges files and clears obsolete versions at an I/O cost.",
        "nodeIds": ["kv-paths:node:1", "kv-paths:node:2", "kv-paths:node:3", "kv-paths:node:5", "kv-paths:node:7"],
        "linkIds": ["kv-paths:relation:1", "kv-paths:relation:2"],
        "viewId": "kv-paths:view:point-1"
      },
      {
        "id": "kv-paths:explain:2",
        "title": "Read and compact log-structured state",
        "description": "A read checks memory and then disk tables. Bloom filters can say a table definitely lacks a key or might contain it; a possible hit still needs lookup. Observe log durability, flush and compaction pressure, read amplification, and disk headroom alongside API latency.",
        "nodeIds": ["kv-paths:node:1", "kv-paths:node:3", "kv-paths:node:5", "kv-paths:node:6", "kv-paths:node:7"],
        "linkIds": ["kv-paths:relation:4", "kv-paths:relation:5"],
        "viewId": "kv-paths:view:point-2"
      }
    ],
    "views": [
      {
        "id": "kv-paths:view:point-1",
        "title": "Persist the write before acknowledging",
        "description": "A log-structured replica commonly appends a write to a durable log and updates an in-memory table. It later flushes sorted tables to disk. Acknowledging before the required log durability boundary risks losing a write on restart, even if the coordinator counted it. Compaction merges files and clears obsolete versions at an I/O cost.",
        "members": ["kv-paths:node:1", "kv-paths:node:2", "kv-paths:node:3", "kv-paths:node:5", "kv-paths:node:7"],
        "layout": "pipeline"
      },
      {
        "id": "kv-paths:view:point-2",
        "title": "Read and compact log-structured state",
        "description": "A read checks memory and then disk tables. Bloom filters can say a table definitely lacks a key or might contain it; a possible hit still needs lookup. Observe log durability, flush and compaction pressure, read amplification, and disk headroom alongside API latency.",
        "members": ["kv-paths:node:1", "kv-paths:node:3", "kv-paths:node:5", "kv-paths:node:6", "kv-paths:node:7"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-paths:predict:kvq16",
        "title": "Predict the design consequence",
        "prompt": "When should a replica count toward a durable write acknowledgment?",
        "options": ["After volatile memory only", "After required log persistence", "After all future compaction", "After Bloom filter maybe"],
        "correctIndex": 1,
        "explanation": "The required log durability boundary must be reached first.",
        "reveal": {
          "id": "kv-paths:reveal:kvq16",
          "title": "Why this choice follows",
          "description": "The required log durability boundary must be reached first.",
          "nodeIds": ["kv-paths:node:0", "kv-paths:node:1", "kv-paths:node:2"],
          "linkIds": ["kv-paths:relation:0", "kv-paths:relation:1"]
        }
      }
    ]
  },
  "kv-operations": {
    "layout": "tiers",
    "nodeRoles": {
      "kv-operations:node:0": {"lane": 0, "order": 2, "semanticId": "fault-drill"},
      "kv-operations:node:1": {"lane": 1, "order": 1, "semanticId": "route"},
      "kv-operations:node:2": {"lane": 1, "order": 3, "semanticId": "quorum"},
      "kv-operations:node:3": {"lane": 2, "order": 1, "semanticId": "hints"},
      "kv-operations:node:4": {"lane": 2, "order": 3, "semanticId": "repair"},
      "kv-operations:node:5": {"lane": 3, "order": 2, "semanticId": "client-truth"}
    },
    "relationships": {
      "kv-operations:relation:0": {"meaning": "connection", "condition": "", "explanation": "Fault drill (node / site loss) leads to Route (healthy owners) in this lesson. Verify behavior during partitions and recovery, not only healthy throughput."},
      "kv-operations:relation:1": {"meaning": "connection", "condition": "", "explanation": "Fault drill (node / site loss) leads to Quorum (success / errors) in this lesson. Verify behavior during partitions and recovery, not only healthy throughput."},
      "kv-operations:relation:2": {"meaning": "connection", "condition": "", "explanation": "Route (healthy owners) leads to Hints (backlog age) in this lesson. Verify behavior during partitions and recovery, not only healthy throughput."},
      "kv-operations:relation:3": {"meaning": "connection", "condition": "", "explanation": "Quorum (success / errors) leads to Repair (lag + progress) in this lesson. Verify behavior during partitions and recovery, not only healthy throughput."},
      "kv-operations:relation:4": {"meaning": "connection", "condition": "", "explanation": "Hints (backlog age) leads to Client truth (latency + freshness) in this lesson. Verify behavior during partitions and recovery, not only healthy throughput."},
      "kv-operations:relation:5": {"meaning": "connection", "condition": "", "explanation": "Repair joins the authored path. The diagram does not name a separate endpoint for this segment."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "kv-operations:explain:1",
        "title": "Observe lag, repair, and failure behavior",
        "description": "Measure tail latency, unavailable operations, hot ranges, replica lag, hint backlog, repair age, compaction pressure, and capacity by failure domain. Test node loss, network partitions, membership changes, and data-center loss against the declared W/R policy. A green get() latency chart can hide a replica that has not converged.",
        "nodeIds": ["kv-operations:node:0", "kv-operations:node:3", "kv-operations:node:4", "kv-operations:node:5"],
        "linkIds": ["kv-operations:relation:4"],
        "viewId": "kv-operations:view:point-1"
      },
      {
        "id": "kv-operations:explain:2",
        "title": "Test the actual product invariants",
        "description": "Choose a policy for a real workload. A low-risk cache-like value may accept eventual convergence. Inventory reservations and money movement require stronger coordination and business invariants. Document retry behavior, idempotency, and ambiguous acknowledgments so clients do not accidentally duplicate operations.",
        "nodeIds": ["kv-operations:node:0", "kv-operations:node:1", "kv-operations:node:2", "kv-operations:node:5"],
        "linkIds": ["kv-operations:relation:0", "kv-operations:relation:1"],
        "viewId": "kv-operations:view:point-2"
      }
    ],
    "views": [
      {
        "id": "kv-operations:view:point-1",
        "title": "Observe lag, repair, and failure behavior",
        "description": "Measure tail latency, unavailable operations, hot ranges, replica lag, hint backlog, repair age, compaction pressure, and capacity by failure domain. Test node loss, network partitions, membership changes, and data-center loss against the declared W/R policy. A green get() latency chart can hide a replica that has not converged.",
        "members": ["kv-operations:node:0", "kv-operations:node:3", "kv-operations:node:4", "kv-operations:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "kv-operations:view:point-2",
        "title": "Test the actual product invariants",
        "description": "Choose a policy for a real workload. A low-risk cache-like value may accept eventual convergence. Inventory reservations and money movement require stronger coordination and business invariants. Document retry behavior, idempotency, and ambiguous acknowledgments so clients do not accidentally duplicate operations.",
        "members": ["kv-operations:node:0", "kv-operations:node:1", "kv-operations:node:2", "kv-operations:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "kv-operations:predict:kvq18",
        "title": "Predict the design consequence",
        "prompt": "Latency is low but hint backlog age rises. What should operators inspect?",
        "options": ["CSS", "Replica convergence and repair risk", "DNS only", "Key string type"],
        "correctIndex": 1,
        "explanation": "Old hints imply stale replicas and recovery risk.",
        "reveal": {
          "id": "kv-operations:reveal:kvq18",
          "title": "Why this choice follows",
          "description": "Old hints imply stale replicas and recovery risk.",
          "nodeIds": ["kv-operations:node:3", "kv-operations:node:4", "kv-operations:node:5"],
          "linkIds": ["kv-operations:relation:4", "kv-operations:relation:5"]
        }
      }
    ]
  }
};
