import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const rateLimiterTeachingContent: Record<string, TeachingContent> = {
  "rate-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "rate-scope:node:0": {"lane": 0, "order": 2, "semanticId": "caller"},
      "rate-scope:node:1": {"lane": 1, "order": 2, "semanticId": "policy-key"},
      "rate-scope:node:2": {"lane": 2, "order": 2, "semanticId": "quota-rule"},
      "rate-scope:node:3": {"lane": 3, "order": 1, "semanticId": "allow"},
      "rate-scope:node:4": {"lane": 3, "order": 3, "semanticId": "throttle"}
    },
    "relationships": {
      "rate-scope:relation:0": {"meaning": "connection", "condition": "", "explanation": "Caller → Policy key: identify. identity + operation."},
      "rate-scope:relation:1": {"meaning": "read", "condition": "", "explanation": "Policy key → Quota rule: look up. amount + period."},
      "rate-scope:relation:2": {"meaning": "connection", "condition": "", "explanation": "Quota rule → Allow: room. forward request."},
      "rate-scope:relation:3": {"meaning": "connection", "condition": "", "explanation": "Quota rule → Throttle: full. 429 + retry."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "rate-scope:explain:1",
        "title": "Specify identity, action, and period",
        "description": "Start with the reason for throttling: protect an expensive endpoint, contain abuse, or allocate a fair share of capacity. Specify the key (authenticated user, API key, IP address, or a combination), the operation, the allowed amount, and the time period. A per-IP login limit can punish people behind a shared network; a per-user limit does not help before sign-in. The correct identity depends on the threat and product contract.",
        "nodeIds": ["rate-scope:node:0", "rate-scope:node:1", "rate-scope:node:2"],
        "linkIds": ["rate-scope:relation:0", "rate-scope:relation:1"],
        "viewId": "rate-scope:view:point-1"
      },
      {
        "id": "rate-scope:explain:2",
        "title": "Choose burst and outage policy",
        "description": "State whether the quota must be strict, whether brief bursts are useful, and what happens when the store is unavailable. Decide if excess requests are rejected, delayed, or queued; a synchronous API commonly returns HTTP 429 with a useful retry signal. Set latency and accuracy targets before selecting an algorithm.",
        "nodeIds": ["rate-scope:node:2", "rate-scope:node:4"],
        "linkIds": ["rate-scope:relation:3"],
        "viewId": "rate-scope:view:point-2"
      }
    ],
    "views": [
      {
        "id": "rate-scope:view:point-1",
        "title": "Specify identity, action, and period",
        "description": "Start with the reason for throttling: protect an expensive endpoint, contain abuse, or allocate a fair share of capacity. Specify the key (authenticated user, API key, IP address, or a combination), the operation, the allowed amount, and the time period. A per-IP login limit can punish people behind a shared network; a per-user limit does not help before sign-in. The correct identity depends on the threat and product contract.",
        "members": ["rate-scope:node:0", "rate-scope:node:1", "rate-scope:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "rate-scope:view:point-2",
        "title": "Choose burst and outage policy",
        "description": "State whether the quota must be strict, whether brief bursts are useful, and what happens when the store is unavailable. Decide if excess requests are rejected, delayed, or queued; a synchronous API commonly returns HTTP 429 with a useful retry signal. Set latency and accuracy targets before selecting an algorithm.",
        "members": ["rate-scope:node:2", "rate-scope:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "rate-scope:predict:rq01",
        "title": "Predict the design consequence",
        "prompt": "What must a useful limit rule identify?",
        "options": ["Only a cache vendor", "Identity, action, quota, and time period", "Only the client IP", "Only peak server capacity"],
        "correctIndex": 1,
        "explanation": "A quota must say whose activity is counted, which action counts, how much is allowed, and over what time scale.",
        "reveal": {
          "id": "rate-scope:reveal:rq01",
          "title": "Why this choice follows",
          "description": "A quota must say whose activity is counted, which action counts, how much is allowed, and over what time scale.",
          "nodeIds": ["rate-scope:node:0", "rate-scope:node:1", "rate-scope:node:2"],
          "linkIds": ["rate-scope:relation:0", "rate-scope:relation:1"]
        }
      }
    ]
  },
  "rate-placement": {
    "layout": "tiers",
    "nodeRoles": {
      "rate-placement:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "rate-placement:node:1": {"lane": 1, "order": 2, "semanticId": "gateway"},
      "rate-placement:node:2": {"lane": 2, "order": 1, "semanticId": "rules"},
      "rate-placement:node:3": {"lane": 2, "order": 3, "semanticId": "counters"},
      "rate-placement:node:4": {"lane": 3, "order": 2, "semanticId": "api-service"}
    },
    "relationships": {
      "rate-placement:relation:0": {"meaning": "request", "condition": "", "explanation": "Client → Gateway: request. enforce quota."},
      "rate-placement:relation:1": {"meaning": "connection", "condition": "", "explanation": "Gateway → Rules: load rule. policy cache."},
      "rate-placement:relation:2": {"meaning": "connection", "condition": "", "explanation": "Gateway → Counters: decide. shared fast state."},
      "rate-placement:relation:3": {"meaning": "decision", "condition": "", "explanation": "Counters → API service: allow. allowed work."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "rate-placement:explain:1",
        "title": "Enforce at a trusted boundary",
        "description": "Client-side throttling can improve behavior, but an untrusted client can bypass it. A gateway or middleware can reject requests before application work; an application-level limiter can use richer business context. Existing gateway features, control over custom rules, and the cost of adding a new hop drive the choice.",
        "nodeIds": ["rate-placement:node:0", "rate-placement:node:1", "rate-placement:node:2", "rate-placement:node:4"],
        "linkIds": ["rate-placement:relation:0", "rate-placement:relation:1"],
        "viewId": "rate-placement:view:point-1"
      },
      {
        "id": "rate-placement:explain:2",
        "title": "Check quota before expensive application work",
        "description": "A typical path is client → load balancer → limiter → API service. The limiter reads the current rule and counter, makes one decision, then forwards an allowed request or returns a throttle response. Keep policy configuration separate from fast-changing counters. A centrally shared counter store lets many stateless limiter instances enforce one logical quota.",
        "nodeIds": ["rate-placement:node:0", "rate-placement:node:1", "rate-placement:node:2", "rate-placement:node:3", "rate-placement:node:4"],
        "linkIds": ["rate-placement:relation:0", "rate-placement:relation:1", "rate-placement:relation:2", "rate-placement:relation:3"]
      }
    ],
    "views": [
      {
        "id": "rate-placement:view:point-1",
        "title": "Enforce at a trusted boundary",
        "description": "Client-side throttling can improve behavior, but an untrusted client can bypass it. A gateway or middleware can reject requests before application work; an application-level limiter can use richer business context. Existing gateway features, control over custom rules, and the cost of adding a new hop drive the choice.",
        "members": ["rate-placement:node:0", "rate-placement:node:1", "rate-placement:node:2", "rate-placement:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "rate-placement:predict:rq04",
        "title": "Predict the design consequence",
        "prompt": "Why enforce a public API quota before application work?",
        "options": ["To avoid spending protected resources on requests that will be rejected", "To remove all need for auth", "To make client limits trustworthy", "To persist every request"],
        "correctIndex": 0,
        "explanation": "Early enforcement protects downstream computation and storage capacity.",
        "reveal": {
          "id": "rate-placement:reveal:rq04",
          "title": "Why this choice follows",
          "description": "Early enforcement protects downstream computation and storage capacity.",
          "nodeIds": ["rate-placement:node:1", "rate-placement:node:2", "rate-placement:node:3", "rate-placement:node:4"],
          "linkIds": ["rate-placement:relation:1", "rate-placement:relation:2", "rate-placement:relation:3"]
        }
      }
    ]
  },
  "rate-token": {
    "layout": "tiers",
    "nodeRoles": {
      "rate-token:node:0": {"lane": 0, "order": 2, "semanticId": "time"},
      "rate-token:node:1": {"lane": 1, "order": 1, "semanticId": "token-bucket"},
      "rate-token:node:2": {"lane": 2, "order": 1, "semanticId": "request-allowed"},
      "rate-token:node:3": {"lane": 2, "order": 3, "semanticId": "request-throttled"}
    },
    "relationships": {
      "rate-token:relation:0": {"meaning": "write", "condition": "As elapsed time earns tokens, capped at bucket capacity.", "explanation": "Time refills the bounded token bucket at the displayed two tokens per second."},
      "rate-token:relation:1": {"meaning": "decision", "condition": "Only while a token is available.", "explanation": "The request spends one current token and is allowed."},
      "rate-token:relation:2": {"meaning": "decision", "condition": "When no token remains.", "explanation": "The empty bucket throttles the request until refill makes a token available."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "rate-token:explain:1",
        "title": "Spend and refill a bounded bucket",
        "description": "A token bucket stores up to a capacity of tokens. Tokens refill over time. Each request consumes a token if one is available; otherwise it is throttled. A capacity of 10 and a refill of 2 tokens per second permits a burst of 10 after idleness, then sustains roughly 2 requests per second. Refill is capped at capacity, so unused allowance does not grow without bound.",
        "nodeIds": ["rate-token:node:0", "rate-token:node:1", "rate-token:node:2", "rate-token:node:3"],
        "linkIds": ["rate-token:relation:0", "rate-token:relation:1", "rate-token:relation:2"]
      },
      {
        "id": "rate-token:explain:2",
        "title": "Permit bursts without unbounded average demand",
        "description": "This is useful when ordinary traffic arrives in short bursts but its average should remain bounded. A leaky bucket instead drains a finite queue at a steady pace, which is helpful when downstream work needs a smooth output rate. Queueing adds wait time; when the queue fills, requests must be rejected or handled by another explicit policy.",
        "nodeIds": ["rate-token:node:0", "rate-token:node:1", "rate-token:node:3"],
        "linkIds": ["rate-token:relation:0", "rate-token:relation:2"],
        "viewId": "rate-token:view:point-2"
      }
    ],
    "views": [
      {
        "id": "rate-token:view:point-2",
        "title": "Permit bursts without unbounded average demand",
        "description": "This is useful when ordinary traffic arrives in short bursts but its average should remain bounded. A leaky bucket instead drains a finite queue at a steady pace, which is helpful when downstream work needs a smooth output rate. Queueing adds wait time; when the queue fills, requests must be rejected or handled by another explicit policy.",
        "members": ["rate-token:node:0", "rate-token:node:1", "rate-token:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "rate-token:predict:current-tokens",
        "title": "Predict the displayed burst",
        "prompt": "The displayed Token bucket has current 7 and no new refill time has elapsed. How many one-token requests can it immediately allow?",
        "options": ["7", "10 merely because capacity is 10", "0 despite available tokens"],
        "correctIndex": 0,
        "explanation": "Current tokens, not total capacity, pay for requests. Seven requests can spend the seven displayed tokens; after that the empty branch throttles until Time refills the bucket.",
        "reveal": {
          "id": "rate-token:reveal:current-tokens",
          "title": "Predict the displayed burst",
          "description": "Current tokens, not total capacity, pay for requests. Seven requests can spend the seven displayed tokens; after that the empty branch throttles until Time refills the bucket.",
          "nodeIds": ["rate-token:node:0", "rate-token:node:1", "rate-token:node:2", "rate-token:node:3"],
          "linkIds": ["rate-token:relation:1", "rate-token:relation:2"]
        }
      }
    ]
  },
  "rate-windows": {
    "layout": "tiers",
    "nodeRoles": {
      "rate-windows:node:0": {"lane": 0, "order": 1, "semanticId": "minute-a"},
      "rate-windows:node:1": {"lane": 1, "order": 1, "semanticId": "minute-b"},
      "rate-windows:node:2": {"lane": 2, "order": 1, "semanticId": "fixed-counter"},
      "rate-windows:node:3": {"lane": 2, "order": 3, "semanticId": "sliding-window"}
    },
    "relationships": {
      "rate-windows:relation:0": {"meaning": "connection", "condition": "", "explanation": "Minute A → Minute B: reset. 100 near its start."},
      "rate-windows:relation:1": {"meaning": "connection", "condition": "", "explanation": "Minute B → Fixed counter: per block. allows both blocks."},
      "rate-windows:relation:2": {"meaning": "acknowledgement", "condition": "", "explanation": "Minute B → Sliding window: look back. sees the combined burst."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "rate-windows:explain:1",
        "title": "Understand fixed-window boundary bursts",
        "description": "A fixed window counter increments one value per identity per time block. It is cheap, but a client can send a full quota just before a boundary and another just after it. The result can be almost twice the configured amount in a short span. A sliding window log checks timestamps over the true rolling period and is more precise, but stores many timestamps and costs more memory.",
        "nodeIds": ["rate-windows:node:1", "rate-windows:node:2", "rate-windows:node:3"],
        "linkIds": ["rate-windows:relation:1", "rate-windows:relation:2"],
        "viewId": "rate-windows:view:point-1"
      },
      {
        "id": "rate-windows:explain:2",
        "title": "Compare rolling accuracy and storage cost",
        "description": "A sliding window counter combines counts from the current and previous blocks, weighting the previous block by how much of it overlaps the rolling period. It uses little memory and softens boundary spikes, but assumes requests in the previous block were spread evenly. Choose it when approximation is acceptable; choose a stricter method when a hard rolling-window cap is essential.",
        "nodeIds": ["rate-windows:node:1", "rate-windows:node:2", "rate-windows:node:3"],
        "linkIds": ["rate-windows:relation:1", "rate-windows:relation:2"]
      }
    ],
    "views": [
      {
        "id": "rate-windows:view:point-1",
        "title": "Understand fixed-window boundary bursts",
        "description": "A fixed window counter increments one value per identity per time block. It is cheap, but a client can send a full quota just before a boundary and another just after it. The result can be almost twice the configured amount in a short span. A sliding window log checks timestamps over the true rolling period and is more precise, but stores many timestamps and costs more memory.",
        "members": ["rate-windows:node:1", "rate-windows:node:2", "rate-windows:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "rate-windows:predict:rq10",
        "title": "Predict the design consequence",
        "prompt": "Why can a 100-per-minute fixed window allow almost 200 requests in a short interval?",
        "options": ["A counter is always eventually consistent", "Requests straddle a window boundary", "The client retries every 429", "A 302 is cached"],
        "correctIndex": 1,
        "explanation": "The client can spend one window’s quota just before reset and the next immediately after.",
        "reveal": {
          "id": "rate-windows:reveal:rq10",
          "title": "Why this choice follows",
          "description": "The client can spend one window’s quota just before reset and the next immediately after.",
          "nodeIds": ["rate-windows:node:0", "rate-windows:node:1", "rate-windows:node:2", "rate-windows:node:3"],
          "linkIds": ["rate-windows:relation:0", "rate-windows:relation:1", "rate-windows:relation:2"]
        }
      }
    ]
  },
  "rate-atomic": {
    "layout": "tiers",
    "nodeRoles": {
      "rate-atomic:node:0": {"lane": 0, "order": 1, "semanticId": "worker-a"},
      "rate-atomic:node:1": {"lane": 0, "order": 3, "semanticId": "worker-b"},
      "rate-atomic:node:2": {"lane": 1, "order": 2, "semanticId": "atomic-decision"},
      "rate-atomic:node:3": {"lane": 2, "order": 1, "semanticId": "allow"},
      "rate-atomic:node:4": {"lane": 2, "order": 3, "semanticId": "reject"}
    },
    "relationships": {
      "rate-atomic:relation:0": {"meaning": "request", "condition": "", "explanation": "Both workers submit requests to one indivisible counter decision."},
      "rate-atomic:relation:1": {"meaning": "request", "condition": "", "explanation": "Both workers submit requests to one indivisible counter decision."},
      "rate-atomic:relation:2": {"meaning": "decision", "condition": "When the first request consumes the remaining quota slot.", "explanation": "The atomic check and mutation allow one request and consume slot 100."},
      "rate-atomic:relation:3": {"meaning": "decision", "condition": "When the next request finds the quota counter full.", "explanation": "The next request is rejected instead of reusing the already consumed slot."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "rate-atomic:explain:1",
        "title": "Make check and update indivisible",
        "description": "Two limiter workers can both read a counter below the threshold and both approve. If they independently write the same incremented value, one update is lost and the quota is breached. The check and counter change must form one atomic operation. A shared in-memory store can execute a small script or use an appropriate atomic data structure; simply calling increment after a separate read does not solve the race.",
        "nodeIds": ["rate-atomic:node:0", "rate-atomic:node:1", "rate-atomic:node:2", "rate-atomic:node:4"],
        "linkIds": ["rate-atomic:relation:0", "rate-atomic:relation:1", "rate-atomic:relation:3"],
        "viewId": "rate-atomic:view:point-1"
      },
      {
        "id": "rate-atomic:explain:2",
        "title": "Align expiry and algorithm state",
        "description": "Use expiry to reclaim counters, but set it consistently with the algorithm. Preserve enough state for the chosen window or token refill. Monitor store latency because every enforced request may depend on this path. If the store fails, an explicit fail-open or fail-closed policy should reflect the endpoint: availability may dominate for low-risk reads, while expensive or abuse-sensitive operations may need protection.",
        "nodeIds": ["rate-atomic:node:0", "rate-atomic:node:1", "rate-atomic:node:2", "rate-atomic:node:4"],
        "linkIds": ["rate-atomic:relation:0", "rate-atomic:relation:1", "rate-atomic:relation:3"]
      }
    ],
    "views": [
      {
        "id": "rate-atomic:view:point-1",
        "title": "Make check and update indivisible",
        "description": "Two limiter workers can both read a counter below the threshold and both approve. If they independently write the same incremented value, one update is lost and the quota is breached. The check and counter change must form one atomic operation. A shared in-memory store can execute a small script or use an appropriate atomic data structure; simply calling increment after a separate read does not solve the race.",
        "members": ["rate-atomic:node:0", "rate-atomic:node:1", "rate-atomic:node:2", "rate-atomic:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "rate-atomic:predict:last-slot",
        "title": "Predict two competing requests",
        "prompt": "Atomic decision has one quota slot left. The first request consumes slot 100. Which displayed outcome should the next request receive?",
        "options": ["Reject because the counter is full", "Allow the same final slot again", "Read the counter without updating it"],
        "correctIndex": 0,
        "explanation": "Check and mutation happen together. The first relation reaches Allow and consumes slot 100; the next relation reaches Reject after the counter is full.",
        "reveal": {
          "id": "rate-atomic:reveal:last-slot",
          "title": "Predict two competing requests",
          "description": "Check and mutation happen together. The first relation reaches Allow and consumes slot 100; the next relation reaches Reject after the counter is full.",
          "nodeIds": ["rate-atomic:node:0", "rate-atomic:node:1", "rate-atomic:node:2", "rate-atomic:node:3", "rate-atomic:node:4"],
          "linkIds": ["rate-atomic:relation:0", "rate-atomic:relation:1", "rate-atomic:relation:2", "rate-atomic:relation:3"]
        }
      }
    ]
  },
  "rate-distributed": {
    "layout": "tiers",
    "nodeRoles": {
      "rate-distributed:node:0": {"lane": 0, "order": 2, "semanticId": "caller"},
      "rate-distributed:node:1": {"lane": 1, "order": 1, "semanticId": "limiter-a"},
      "rate-distributed:node:2": {"lane": 1, "order": 3, "semanticId": "limiter-b"},
      "rate-distributed:node:3": {"lane": 2, "order": 2, "semanticId": "shared-counters"}
    },
    "relationships": {
      "rate-distributed:relation:0": {"meaning": "connection", "condition": "", "explanation": "Caller → Limiter A: route 1. stateless worker."},
      "rate-distributed:relation:1": {"meaning": "connection", "condition": "", "explanation": "Caller → Limiter B: route 2. stateless worker."},
      "rate-distributed:relation:2": {"meaning": "connection", "condition": "", "explanation": "Limiter A → Shared counters: atomic. one quota per policy key."},
      "rate-distributed:relation:3": {"meaning": "connection", "condition": "", "explanation": "Limiter B → Shared counters: atomic. one quota per policy key."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "rate-distributed:explain:1",
        "title": "Share one logical quota across workers",
        "description": "If each limiter keeps a private counter, a caller can exceed its quota by reaching different workers. Sticky sessions reduce the symptom but complicate scaling and recovery. A shared counter store gives all workers the same decision state. At regional scale, one remote store adds latency; local regional counters improve speed but allow some overshoot while totals converge. That is a product tradeoff, not exact global enforcement.",
        "nodeIds": ["rate-distributed:node:0", "rate-distributed:node:1", "rate-distributed:node:2", "rate-distributed:node:3"],
        "linkIds": ["rate-distributed:relation:0", "rate-distributed:relation:1", "rate-distributed:relation:2", "rate-distributed:relation:3"]
      },
      {
        "id": "rate-distributed:explain:2",
        "title": "Partition counters with explicit failure policy",
        "description": "Partition counters by a stable key when one store cannot handle the workload. Replication and failover need careful handling: losing recent counter state can temporarily reset allowance. Estimate requests per second, state size, and acceptable overshoot before distributing the decision. A strict global cap may require a more coordinated path than an eventually consistent regional quota.",
        "nodeIds": ["rate-distributed:node:0", "rate-distributed:node:1", "rate-distributed:node:2", "rate-distributed:node:3"],
        "linkIds": ["rate-distributed:relation:0", "rate-distributed:relation:1", "rate-distributed:relation:2", "rate-distributed:relation:3"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "rate-distributed:predict:rq16",
        "title": "Predict the design consequence",
        "prompt": "Why do two private limiter counters risk doubling a caller’s quota?",
        "options": ["Each worker sees only its own requests", "Redis deletes every key", "The load balancer changes HTTP status codes", "The client has two devices"],
        "correctIndex": 0,
        "explanation": "Without shared state or coordinated allocation, each worker can independently grant the full quota.",
        "reveal": {
          "id": "rate-distributed:reveal:rq16",
          "title": "Why this choice follows",
          "description": "Without shared state or coordinated allocation, each worker can independently grant the full quota.",
          "nodeIds": ["rate-distributed:node:0", "rate-distributed:node:1", "rate-distributed:node:2"],
          "linkIds": ["rate-distributed:relation:0", "rate-distributed:relation:1"]
        }
      }
    ]
  },
  "rate-operate": {
    "layout": "tiers",
    "nodeRoles": {
      "rate-operate:node:0": {"lane": 0, "order": 2, "semanticId": "limiter"},
      "rate-operate:node:1": {"lane": 1, "order": 1, "semanticId": "client-response"},
      "rate-operate:node:2": {"lane": 1, "order": 3, "semanticId": "metrics"},
      "rate-operate:node:3": {"lane": 2, "order": 2, "semanticId": "policy-tuning"}
    },
    "relationships": {
      "rate-operate:relation:0": {"meaning": "connection", "condition": "", "explanation": "Limiter → Client response: explain. 429 · Retry-After."},
      "rate-operate:relation:1": {"meaning": "connection", "condition": "", "explanation": "Limiter → Metrics: record. rejects · latency · errors."},
      "rate-operate:relation:2": {"meaning": "connection", "condition": "", "explanation": "Metrics → Policy tuning: review. false blocks + load."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "rate-operate:explain:1",
        "title": "Return a meaningful retry signal",
        "description": "Return 429 for rejected synchronous requests and a Retry-After value when a meaningful wait can be computed. Quota and remaining-allowance headers can help clients pace themselves; keep their semantics consistent with the algorithm. Clients should back off, avoid retry storms, and cache or batch work where appropriate. Queueing is suitable only when the API contract permits delayed processing.",
        "nodeIds": ["rate-operate:node:0", "rate-operate:node:1", "rate-operate:node:2"],
        "linkIds": ["rate-operate:relation:0", "rate-operate:relation:1"],
        "viewId": "rate-operate:view:point-1"
      },
      {
        "id": "rate-operate:explain:2",
        "title": "Tune limits from decision and product evidence",
        "description": "Track allowed and rejected requests by rule, endpoint, and safe aggregate client segment; measure decision latency, counter-store errors, and downstream load. A high reject rate may mean the rule is too strict, an attack is active, or the key groups unrelated users. Review both false blocks and capacity protection. Load-test boundary bursts and concurrent requests, then tune based on the actual traffic shape.",
        "nodeIds": ["rate-operate:node:1", "rate-operate:node:2", "rate-operate:node:3"],
        "linkIds": ["rate-operate:relation:2"],
        "viewId": "rate-operate:view:point-2"
      }
    ],
    "views": [
      {
        "id": "rate-operate:view:point-1",
        "title": "Return a meaningful retry signal",
        "description": "Return 429 for rejected synchronous requests and a Retry-After value when a meaningful wait can be computed. Quota and remaining-allowance headers can help clients pace themselves; keep their semantics consistent with the algorithm. Clients should back off, avoid retry storms, and cache or batch work where appropriate. Queueing is suitable only when the API contract permits delayed processing.",
        "members": ["rate-operate:node:0", "rate-operate:node:1", "rate-operate:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "rate-operate:view:point-2",
        "title": "Tune limits from decision and product evidence",
        "description": "Track allowed and rejected requests by rule, endpoint, and safe aggregate client segment; measure decision latency, counter-store errors, and downstream load. A high reject rate may mean the rule is too strict, an attack is active, or the key groups unrelated users. Review both false blocks and capacity protection. Load-test boundary bursts and concurrent requests, then tune based on the actual traffic shape.",
        "members": ["rate-operate:node:1", "rate-operate:node:2", "rate-operate:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "rate-operate:predict:rq19",
        "title": "Predict the design consequence",
        "prompt": "What should a throttled synchronous client usually receive?",
        "options": ["A 429 and a meaningful retry signal", "A 201 and no body", "A 301 to the database", "A silent disconnect"],
        "correctIndex": 0,
        "explanation": "A clear 429 and Retry-After when computable let clients pace retries rather than hammer the service.",
        "reveal": {
          "id": "rate-operate:reveal:rq19",
          "title": "Why this choice follows",
          "description": "A clear 429 and Retry-After when computable let clients pace retries rather than hammer the service.",
          "nodeIds": ["rate-operate:node:0", "rate-operate:node:1", "rate-operate:node:2"],
          "linkIds": ["rate-operate:relation:0", "rate-operate:relation:1"]
        }
      }
    ]
  }
};
