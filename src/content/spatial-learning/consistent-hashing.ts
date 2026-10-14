import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const consistentHashingTeachingContent: Record<string, TeachingContent> = {
  "hash-scope": {
    "layout": "pipeline",
    "nodeRoles": {
      "hash-scope:node:0": {"lane": 0, "order": 2, "semanticId": "key"},
      "hash-scope:node:1": {"lane": 1, "order": 2, "semanticId": "hash-position"},
      "hash-scope:node:2": {"lane": 2, "order": 2, "semanticId": "owner"},
      "hash-scope:node:3": {"lane": 3, "order": 2, "semanticId": "observe"}
    },
    "relationships": {
      "hash-scope:relation:0": {"meaning": "decision", "condition": "", "explanation": "Key (stable identity) leads to Hash position (deterministic mapping) in this lesson. State the remapping and balance goals before choosing a hash scheme."},
      "hash-scope:relation:1": {"meaning": "decision", "condition": "", "explanation": "Hash position (deterministic mapping) leads to Owner (node or partition) in this lesson. State the remapping and balance goals before choosing a hash scheme."},
      "hash-scope:relation:2": {"meaning": "decision", "condition": "", "explanation": "Owner (node or partition) leads to Observe (bytes + request heat) in this lesson. State the remapping and balance goals before choosing a hash scheme."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "hash-scope:explain:1",
        "title": "Define repeatable ownership and movement goals",
        "description": "A distributed cache or key-value store needs a repeatable way to find the node that owns a key. Start with the desired properties: balanced load, predictable lookup, little movement as nodes join or leave, and a membership view clients can agree on. The keys may represent cached objects, durable partitions, or routing entries; each has a different cost of remapping.",
        "nodeIds": ["hash-scope:node:0", "hash-scope:node:1", "hash-scope:node:2"],
        "linkIds": ["hash-scope:relation:0", "hash-scope:relation:1"],
        "viewId": "hash-scope:view:point-1"
      },
      {
        "id": "hash-scope:explain:2",
        "title": "Measure bytes and request heat separately",
        "description": "Hashing makes a key position look uniform, but uniform key counts do not imply uniform work. A single popular key or a few large values can dominate one node. Measure bytes and request rate as well as key count. The placement method is only one part of scaling; it does not copy data, detect failure, or guarantee availability by itself.",
        "nodeIds": ["hash-scope:node:0", "hash-scope:node:1", "hash-scope:node:2", "hash-scope:node:3"],
        "linkIds": ["hash-scope:relation:0", "hash-scope:relation:1", "hash-scope:relation:2"]
      }
    ],
    "views": [
      {
        "id": "hash-scope:view:point-1",
        "title": "Define repeatable ownership and movement goals",
        "description": "A distributed cache or key-value store needs a repeatable way to find the node that owns a key. Start with the desired properties: balanced load, predictable lookup, little movement as nodes join or leave, and a membership view clients can agree on. The keys may represent cached objects, durable partitions, or routing entries; each has a different cost of remapping.",
        "members": ["hash-scope:node:0", "hash-scope:node:1", "hash-scope:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "hash-scope:predict:hq02",
        "title": "Predict the design consequence",
        "prompt": "Key counts are equal but one node has high CPU. Which missing measurement matters?",
        "options": ["Font size", "Request heat and operation cost per key", "Chapter number", "DNS record length"],
        "correctIndex": 1,
        "explanation": "Uniform key count does not mean uniform request or compute load.",
        "reveal": {
          "id": "hash-scope:reveal:hq02",
          "title": "Why this choice follows",
          "description": "Uniform key count does not mean uniform request or compute load.",
          "nodeIds": ["hash-scope:node:2", "hash-scope:node:3"],
          "linkIds": ["hash-scope:relation:2"]
        }
      }
    ]
  },
  "hash-modulo": {
    "layout": "pipeline",
    "nodeRoles": {
      "hash-modulo:node:0": {"lane": 0, "order": 2, "semanticId": "four-nodes"},
      "hash-modulo:node:1": {"lane": 1, "order": 2, "semanticId": "one-fails"},
      "hash-modulo:node:2": {"lane": 2, "order": 2, "semanticId": "recompute"},
      "hash-modulo:node:3": {"lane": 3, "order": 2, "semanticId": "many-misses"}
    },
    "relationships": {
      "hash-modulo:relation:0": {"meaning": "decision", "condition": "", "explanation": "Four nodes (hash(key) mod 4) leads to One fails (pool becomes 3) in this lesson. Modulo is simple for a fixed membership set."},
      "hash-modulo:relation:1": {"meaning": "decision", "condition": "", "explanation": "One fails (pool becomes 3) leads to Recompute (hash(key) mod 3) in this lesson. Modulo is simple for a fixed membership set."},
      "hash-modulo:relation:2": {"meaning": "decision", "condition": "", "explanation": "Recompute (hash(key) mod 3) leads to Many misses (refill from origin) in this lesson. Modulo is simple for a fixed membership set."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "hash-modulo:explain:1",
        "title": "A membership change alters the divisor",
        "description": "The simple rule hash(key) mod N works when a fixed set of N servers is expected. Every client can compute the same index cheaply. But changing N changes the remainder for many keys, including keys whose previous server is still healthy. In a cache, that causes widespread misses and a sudden load increase on the backing store. In durable storage, it calls for a large migration.",
        "nodeIds": ["hash-modulo:node:0", "hash-modulo:node:2", "hash-modulo:node:3"],
        "linkIds": ["hash-modulo:relation:2"],
        "viewId": "hash-modulo:view:point-1"
      },
      {
        "id": "hash-modulo:explain:2",
        "title": "Understand broadly distributed cache churn",
        "description": "The effect is not that every key always moves; it is that movement is broadly distributed rather than limited to the range assigned to the added or removed node. A placement scheme should let membership change without reassigning most unaffected keys.",
        "nodeIds": ["hash-modulo:node:0", "hash-modulo:node:1", "hash-modulo:node:2"],
        "linkIds": ["hash-modulo:relation:0", "hash-modulo:relation:1"],
        "viewId": "hash-modulo:view:point-2"
      }
    ],
    "views": [
      {
        "id": "hash-modulo:view:point-1",
        "title": "A membership change alters the divisor",
        "description": "The simple rule hash(key) mod N works when a fixed set of N servers is expected. Every client can compute the same index cheaply. But changing N changes the remainder for many keys, including keys whose previous server is still healthy. In a cache, that causes widespread misses and a sudden load increase on the backing store. In durable storage, it calls for a large migration.",
        "members": ["hash-modulo:node:0", "hash-modulo:node:2", "hash-modulo:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "hash-modulo:view:point-2",
        "title": "Understand broadly distributed cache churn",
        "description": "The effect is not that every key always moves; it is that movement is broadly distributed rather than limited to the range assigned to the added or removed node. A placement scheme should let membership change without reassigning most unaffected keys.",
        "members": ["hash-modulo:node:0", "hash-modulo:node:1", "hash-modulo:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "hash-modulo:predict:hq05",
        "title": "Predict the design consequence",
        "prompt": "After a cache server fails, database reads surge across many keys. Why?",
        "options": ["Modulo remapped keys to other empty caches", "All user keys expired simultaneously by definition", "The network changed each key string", "The CDN removed images"],
        "correctIndex": 0,
        "explanation": "Changing N causes widespread remapping and cache misses.",
        "reveal": {
          "id": "hash-modulo:reveal:hq05",
          "title": "Why this choice follows",
          "description": "Changing N causes widespread remapping and cache misses.",
          "nodeIds": ["hash-modulo:node:0", "hash-modulo:node:1", "hash-modulo:node:2", "hash-modulo:node:3"],
          "linkIds": ["hash-modulo:relation:0", "hash-modulo:relation:1", "hash-modulo:relation:2"]
        }
      }
    ]
  },
  "hash-ring": {
    "layout": "authored",
    "nodeRoles": {
      "hash-ring:node:0": {"lane": 2, "order": 1, "semanticId": "n1"},
      "hash-ring:node:1": {"lane": 3, "order": 1, "semanticId": "k1"},
      "hash-ring:node:2": {"lane": 4, "order": 2, "semanticId": "n2"},
      "hash-ring:node:3": {"lane": 3, "order": 3, "semanticId": "k2"},
      "hash-ring:node:4": {"lane": 2, "order": 4, "semanticId": "n3"},
      "hash-ring:node:5": {"lane": 1, "order": 3, "semanticId": "k3"},
      "hash-ring:node:6": {"lane": 0, "order": 2, "semanticId": "n4"},
      "hash-ring:node:7": {"lane": 1, "order": 1, "semanticId": "k4"}
    },
    "relationships": {

    },
    "groups": [],
    "scenes": [
      {
        "id": "hash-ring:explain:1",
        "title": "Choose the first clockwise successor",
        "description": "Map both keys and node tokens into one fixed hash space. Imagine its endpoints joined into a ring. For a key, move clockwise to the first node token; the physical node behind that token owns the key. After the last token, lookup wraps to the first. A sorted token map can find the successor efficiently without scanning every node.",
        "nodeIds": ["hash-ring:node:3", "hash-ring:node:4", "hash-ring:node:5", "hash-ring:node:6", "hash-ring:node:7"],
        "linkIds": []
      },
      {
        "id": "hash-ring:explain:2",
        "title": "Keep hash and membership versions consistent",
        "description": "Every participant must use the same hash function and membership version or it may route the same key to different owners. Hash collisions and exact-boundary ties need deterministic rules. The ring describes logical ownership; the application still needs a protocol for reaching the owner and handling reads during transitions.",
        "nodeIds": ["hash-ring:node:1", "hash-ring:node:3", "hash-ring:node:5", "hash-ring:node:7"],
        "linkIds": []
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "hash-ring:predict:wrap",
        "title": "Predict the ring owner",
        "prompt": "Walking clockwise from displayed K4, which node token is encountered first?",
        "options": ["N1", "N4", "Every token owns an independent copy"],
        "correctIndex": 0,
        "explanation": "K4 lies after N4 and before N1 in the clockwise ring. Successor lookup wraps across the top to N1; ownership is distinct from replication.",
        "reveal": {
          "id": "hash-ring:reveal:wrap",
          "title": "Predict the ring owner",
          "description": "K4 lies after N4 and before N1 in the clockwise ring. Successor lookup wraps across the top to N1; ownership is distinct from replication.",
          "nodeIds": ["hash-ring:node:0", "hash-ring:node:6", "hash-ring:node:7"],
          "linkIds": []
        }
      }
    ]
  },
  "hash-membership": {
    "layout": "authored",
    "nodeRoles": {
      "hash-membership:node:0": {"lane": 1, "order": 1, "semanticId": "p"},
      "hash-membership:node:1": {"lane": 2, "order": 1, "semanticId": "old-range"},
      "hash-membership:node:2": {"lane": 2, "order": 3, "semanticId": "new"},
      "hash-membership:node:3": {"lane": 1, "order": 4, "semanticId": "s"},
      "hash-membership:node:4": {"lane": 0, "order": 3, "semanticId": "k"},
      "hash-membership:node:5": {"lane": 0, "order": 1, "semanticId": "n3"}
    },
    "relationships": {

    },
    "groups": [],
    "scenes": [
      {
        "id": "hash-membership:explain:1",
        "title": "Transfer the new token’s preceding interval",
        "description": "When a node token joins between predecessor P and successor S, it becomes owner of keys in the interval (P, new token]. Those keys move from S. Other intervals keep their owner. When a token leaves, its former interval moves to its successor. With evenly spread tokens, expected movement for one equally sized new node is roughly 1/(N+1) of keys, although real layouts vary.",
        "nodeIds": ["hash-membership:node:1", "hash-membership:node:2", "hash-membership:node:3", "hash-membership:node:4", "hash-membership:node:5"],
        "linkIds": []
      },
      {
        "id": "hash-membership:explain:2",
        "title": "Copy before durable routing cutover",
        "description": "Do not flip routing before the new owner has the data if the store is durable. Use a controlled transition: publish a membership version, copy the affected range, catch up concurrent writes, then switch ownership and verify. A cache may tolerate misses and refill instead. Node failure also requires replicas or fallback; hashing alone merely points to a new location.",
        "nodeIds": ["hash-membership:node:0", "hash-membership:node:1", "hash-membership:node:2", "hash-membership:node:3", "hash-membership:node:5"],
        "linkIds": []
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "hash-membership:predict:hq11",
        "title": "Predict the design consequence",
        "prompt": "A durable node begins receiving reads before its new range is copied. What can users observe?",
        "options": ["Guaranteed faster reads", "Missing or stale data", "A longer URL only", "Automatic duplicate elimination"],
        "correctIndex": 1,
        "explanation": "Routing cutover before transfer completion can expose an incomplete owner.",
        "reveal": {
          "id": "hash-membership:reveal:hq11",
          "title": "Why this choice follows",
          "description": "Routing cutover before transfer completion can expose an incomplete owner.",
          "nodeIds": ["hash-membership:node:0", "hash-membership:node:1", "hash-membership:node:2", "hash-membership:node:3"],
          "linkIds": []
        }
      }
    ]
  },
  "hash-vnodes": {
    "layout": "authored",
    "nodeRoles": {
      "hash-vnodes:node:0": {"lane": 1, "order": 1, "semanticId": "a1"},
      "hash-vnodes:node:1": {"lane": 2, "order": 1, "semanticId": "b1"},
      "hash-vnodes:node:2": {"lane": 2, "order": 3, "semanticId": "a2"},
      "hash-vnodes:node:3": {"lane": 1, "order": 4, "semanticId": "b2"},
      "hash-vnodes:node:4": {"lane": 0, "order": 3, "semanticId": "a3"},
      "hash-vnodes:node:5": {"lane": 0, "order": 1, "semanticId": "b3"}
    },
    "relationships": {

    },
    "groups": [],
    "scenes": [
      {
        "id": "hash-vnodes:explain:1",
        "title": "Distribute multiple tokens per physical node",
        "description": "With only one random token per machine, some machines receive large arcs and others tiny arcs. Assign multiple token positions to each physical machine. Its intervals are spread around the ring, so variation usually falls as token count grows. A stronger machine can own more tokens or weighted ranges, but that choice should be based on measured capacity and actual load.",
        "nodeIds": ["hash-vnodes:node:0", "hash-vnodes:node:1", "hash-vnodes:node:2"],
        "linkIds": []
      },
      {
        "id": "hash-vnodes:explain:2",
        "title": "Move smaller ranges with more metadata",
        "description": "Virtual nodes make addition and removal involve many small intervals instead of one large block. That can smooth transfers across donors, but a very large token count increases routing metadata, membership updates, and repair bookkeeping. A token is a placement alias, not an extra replica or machine.",
        "nodeIds": ["hash-vnodes:node:1", "hash-vnodes:node:2", "hash-vnodes:node:3", "hash-vnodes:node:4", "hash-vnodes:node:5"],
        "linkIds": []
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "hash-vnodes:predict:physical-failure",
        "title": "Predict a physical-node failure",
        "prompt": "A1, A2, and A3 are tokens for one physical machine A. Does having three tokens provide three independent failure copies?",
        "options": ["No; all three tokens refer to the same physical machine", "Yes; each token is a separate host", "Yes; tokens imply cross-region replication"],
        "correctIndex": 0,
        "explanation": "Virtual tokens divide ownership ranges. A1, A2, and A3 are all positions for physical A, so its failure affects each; redundancy needs distinct physical replicas.",
        "reveal": {
          "id": "hash-vnodes:reveal:physical-failure",
          "title": "Predict a physical-node failure",
          "description": "Virtual tokens divide ownership ranges. A1, A2, and A3 are all positions for physical A, so its failure affects each; redundancy needs distinct physical replicas.",
          "nodeIds": ["hash-vnodes:node:0", "hash-vnodes:node:2", "hash-vnodes:node:4"],
          "linkIds": []
        }
      }
    ]
  },
  "hash-replicas": {
    "layout": "pipeline",
    "nodeRoles": {
      "hash-replicas:node:0": {"lane": 0, "order": 2, "semanticId": "key"},
      "hash-replicas:node:1": {"lane": 1, "order": 2, "semanticId": "primary"},
      "hash-replicas:node:2": {"lane": 2, "order": 2, "semanticId": "replica-a"},
      "hash-replicas:node:3": {"lane": 3, "order": 2, "semanticId": "replica-b"}
    },
    "relationships": {
      "hash-replicas:relation:0": {"meaning": "decision", "condition": "", "explanation": "Key (hash position) leads to Primary (first successor) in this lesson. Replica placement must select distinct physical failure domains."},
      "hash-replicas:relation:1": {"meaning": "decision", "condition": "", "explanation": "Primary (first successor) leads to Replica A (distinct host) in this lesson. Replica placement must select distinct physical failure domains."},
      "hash-replicas:relation:2": {"meaning": "decision", "condition": "", "explanation": "Replica A (distinct host) leads to Replica B (distinct domain) in this lesson. Replica placement must select distinct physical failure domains."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "hash-replicas:explain:1",
        "title": "Place copies on distinct physical domains",
        "description": "For a replicated store, choose distinct physical nodes after the primary token, often with failure-domain rules so copies do not share one rack or region. Merely selecting the next few virtual tokens can accidentally place multiple copies on the same physical host. Reads, writes, and repair then depend on the consistency policy of the storage system, not on hashing alone.",
        "nodeIds": ["hash-replicas:node:1", "hash-replicas:node:2", "hash-replicas:node:3"],
        "linkIds": ["hash-replicas:relation:1", "hash-replicas:relation:2"],
        "viewId": "hash-replicas:view:point-1"
      },
      {
        "id": "hash-replicas:explain:2",
        "title": "Keep hot-key limits visible",
        "description": "A single key that receives extreme traffic still maps to one primary range. Virtual nodes spread many keys, but cannot split that key’s load. Cache or replicate hot read data, shard an aggregate write key, or redesign the data model. Keep hot-key mitigation separate from general partition balance.",
        "nodeIds": ["hash-replicas:node:0", "hash-replicas:node:1"],
        "linkIds": ["hash-replicas:relation:0"],
        "viewId": "hash-replicas:view:point-2"
      }
    ],
    "views": [
      {
        "id": "hash-replicas:view:point-1",
        "title": "Place copies on distinct physical domains",
        "description": "For a replicated store, choose distinct physical nodes after the primary token, often with failure-domain rules so copies do not share one rack or region. Merely selecting the next few virtual tokens can accidentally place multiple copies on the same physical host. Reads, writes, and repair then depend on the consistency policy of the storage system, not on hashing alone.",
        "members": ["hash-replicas:node:1", "hash-replicas:node:2", "hash-replicas:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "hash-replicas:view:point-2",
        "title": "Keep hot-key limits visible",
        "description": "A single key that receives extreme traffic still maps to one primary range. Virtual nodes spread many keys, but cannot split that key’s load. Cache or replicate hot read data, shard an aggregate write key, or redesign the data model. Keep hot-key mitigation separate from general partition balance.",
        "members": ["hash-replicas:node:0", "hash-replicas:node:1"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "hash-replicas:predict:hq17",
        "title": "Predict the design consequence",
        "prompt": "One popular key is overloaded despite many virtual nodes. Why?",
        "options": ["Virtual nodes never store keys", "That key still has one primary placement", "The hash space is too small by definition", "The client sent a 429"],
        "correctIndex": 1,
        "explanation": "Virtual nodes distribute ranges across many keys, not the load of one indivisible key.",
        "reveal": {
          "id": "hash-replicas:reveal:hq17",
          "title": "Why this choice follows",
          "description": "Virtual nodes distribute ranges across many keys, not the load of one indivisible key.",
          "nodeIds": ["hash-replicas:node:0", "hash-replicas:node:1", "hash-replicas:node:2", "hash-replicas:node:3"],
          "linkIds": ["hash-replicas:relation:0", "hash-replicas:relation:1", "hash-replicas:relation:2"]
        }
      }
    ]
  },
  "hash-operate": {
    "layout": "pipeline",
    "nodeRoles": {
      "hash-operate:node:0": {"lane": 0, "order": 2, "semanticId": "version-map"},
      "hash-operate:node:1": {"lane": 1, "order": 2, "semanticId": "copy"},
      "hash-operate:node:2": {"lane": 2, "order": 2, "semanticId": "cut-over"},
      "hash-operate:node:3": {"lane": 3, "order": 2, "semanticId": "verify"}
    },
    "relationships": {
      "hash-operate:relation:0": {"meaning": "decision", "condition": "", "explanation": "Version map (planned owners) leads to Copy (affected ranges) in this lesson. Observe routing versions, skew, and migration lag."},
      "hash-operate:relation:1": {"meaning": "decision", "condition": "", "explanation": "Copy (affected ranges) leads to Cut over (publish routing) in this lesson. Observe routing versions, skew, and migration lag."},
      "hash-operate:relation:2": {"meaning": "decision", "condition": "", "explanation": "Cut over (publish routing) leads to Verify (lag + skew) in this lesson. Observe routing versions, skew, and migration lag."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "hash-operate:explain:1",
        "title": "Observe owners, skew, and migration lag",
        "description": "Track token ownership, key and byte distribution, per-node request rate, hot partitions, migration progress, and routing-version mismatch. If clients disagree about membership, the same key can be written to different owners. A versioned routing map and an explicit transition protocol make rollout observable. During a node failure, do not assume a reassignment has copied durable data; use replicas and repair.",
        "nodeIds": ["hash-operate:node:0", "hash-operate:node:1", "hash-operate:node:2"],
        "linkIds": ["hash-operate:relation:0", "hash-operate:relation:1"],
        "viewId": "hash-operate:view:point-1"
      },
      {
        "id": "hash-operate:explain:2",
        "title": "Rehearse interrupted membership changes",
        "description": "Test joins, removals, and interrupted transfers with realistic skew. Bound migration bandwidth so background copying does not starve foreground requests. Check that replacement nodes have enough disk and that replicas span the intended failure domains. Consistent hashing is useful when membership changes frequently enough that minimizing remaps matters; a simple fixed partition map may be easier when partitions are stable and centrally managed.",
        "nodeIds": ["hash-operate:node:0", "hash-operate:node:1", "hash-operate:node:3"],
        "linkIds": ["hash-operate:relation:0"],
        "viewId": "hash-operate:view:point-2"
      }
    ],
    "views": [
      {
        "id": "hash-operate:view:point-1",
        "title": "Observe owners, skew, and migration lag",
        "description": "Track token ownership, key and byte distribution, per-node request rate, hot partitions, migration progress, and routing-version mismatch. If clients disagree about membership, the same key can be written to different owners. A versioned routing map and an explicit transition protocol make rollout observable. During a node failure, do not assume a reassignment has copied durable data; use replicas and repair.",
        "members": ["hash-operate:node:0", "hash-operate:node:1", "hash-operate:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "hash-operate:view:point-2",
        "title": "Rehearse interrupted membership changes",
        "description": "Test joins, removals, and interrupted transfers with realistic skew. Bound migration bandwidth so background copying does not starve foreground requests. Check that replacement nodes have enough disk and that replicas span the intended failure domains. Consistent hashing is useful when membership changes frequently enough that minimizing remaps matters; a simple fixed partition map may be easier when partitions are stable and centrally managed.",
        "members": ["hash-operate:node:0", "hash-operate:node:1", "hash-operate:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "hash-operate:predict:hq20",
        "title": "Predict the design consequence",
        "prompt": "A node join finishes routing cutover but migration lags. What should operators inspect?",
        "options": ["Only frontend animations", "Transfer progress, fallback reads, and version mismatch", "Only DNS TTL", "Only link color"],
        "correctIndex": 1,
        "explanation": "Incomplete movement and inconsistent maps are direct risks to data visibility.",
        "reveal": {
          "id": "hash-operate:reveal:hq20",
          "title": "Why this choice follows",
          "description": "Incomplete movement and inconsistent maps are direct risks to data visibility.",
          "nodeIds": ["hash-operate:node:1", "hash-operate:node:2", "hash-operate:node:3"],
          "linkIds": ["hash-operate:relation:1", "hash-operate:relation:2"]
        }
      }
    ]
  }
};
