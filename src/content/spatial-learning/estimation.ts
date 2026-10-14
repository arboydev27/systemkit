import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const estimationTeachingContent: Record<string, TeachingContent> = {
  "estimate-workload": {
    "layout": "pipeline",
    "nodeRoles": {
      "estimate-workload:node:0": {"lane": 0, "order": 2, "semanticId": "5m-accounts"},
      "estimate-workload:node:1": {"lane": 1, "order": 2, "semanticId": "20-active"},
      "estimate-workload:node:2": {"lane": 3, "order": 2, "semanticId": "1m-daily-active"},
      "estimate-workload:node:3": {"lane": 4, "order": 2, "semanticId": "10-opens"},
      "estimate-workload:node:4": {"lane": 2, "order": 4, "semanticId": "10m-reads-day"}
    },
    "relationships": {
      "estimate-workload:relation:0": {"meaning": "decision", "condition": "", "explanation": "5M accounts (registered people) leads to × 20% active (stated assumption) in this lesson. Start with active behavior and a time window."},
      "estimate-workload:relation:1": {"meaning": "decision", "condition": "", "explanation": "× 20% active (stated assumption) leads to 1M daily active (people using the app) in this lesson. Start with active behavior and a time window."},
      "estimate-workload:relation:2": {"meaning": "decision", "condition": "", "explanation": "1M daily active (people using the app) leads to × 10 opens (per active person) in this lesson. Start with active behavior and a time window."},
      "estimate-workload:relation:3": {"meaning": "decision", "condition": "", "explanation": "× 10 opens (per active person) leads to 10M reads/day (the workload to size) in this lesson. Start with active behavior and a time window."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "estimate-workload:explain:1",
        "title": "State activity and size assumptions",
        "description": "Begin with a small set of stated assumptions: daily active users, actions per active user, read-to-write mix, item size, retention, and expected peaks. Registered accounts alone cannot tell you how many requests arrive today. Keep each assumption beside its unit so another person can challenge it.",
        "nodeIds": ["estimate-workload:node:0", "estimate-workload:node:1", "estimate-workload:node:2", "estimate-workload:node:3", "estimate-workload:node:4"],
        "linkIds": ["estimate-workload:relation:0", "estimate-workload:relation:1", "estimate-workload:relation:2", "estimate-workload:relation:3"]
      },
      {
        "id": "estimate-workload:explain:2",
        "title": "Calculate actions by active people",
        "description": "For example, a service with one million daily active people who each open a feed ten times has roughly ten million feed opens per day. If only a fifth of registered accounts are active, using all accounts as daily users would inflate the estimate fivefold. The goal is a plausible workload model, not a precise forecast.",
        "nodeIds": ["estimate-workload:node:0", "estimate-workload:node:1", "estimate-workload:node:2", "estimate-workload:node:3", "estimate-workload:node:4"],
        "linkIds": ["estimate-workload:relation:0", "estimate-workload:relation:1", "estimate-workload:relation:2", "estimate-workload:relation:3"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "estimate-workload:predict:eq02",
        "title": "Predict the design consequence",
        "prompt": "An estimate treats every registered account as active each day. What is the main risk?",
        "options": ["It necessarily undercounts writes", "It measures latency instead of traffic", "It may overstate daily traffic substantially", "It excludes object storage"],
        "correctIndex": 2,
        "explanation": "Many accounts may be inactive. State or measure the active share before deriving daily actions.",
        "reveal": {
          "id": "estimate-workload:reveal:eq02",
          "title": "Why this choice follows",
          "description": "Many accounts may be inactive. State or measure the active share before deriving daily actions.",
          "nodeIds": ["estimate-workload:node:0", "estimate-workload:node:1", "estimate-workload:node:2"],
          "linkIds": ["estimate-workload:relation:0", "estimate-workload:relation:1"]
        }
      }
    ]
  },
  "estimate-traffic": {
    "layout": "pipeline",
    "nodeRoles": {
      "estimate-traffic:node:0": {"lane": 0, "order": 2, "semanticId": "8-64m-reads-day"},
      "estimate-traffic:node:1": {"lane": 1, "order": 2, "semanticId": "86-400"},
      "estimate-traffic:node:2": {"lane": 2, "order": 2, "semanticId": "100-reads-s"},
      "estimate-traffic:node:3": {"lane": 1, "order": 4, "semanticId": "4-busy-peak"},
      "estimate-traffic:node:4": {"lane": 2, "order": 4, "semanticId": "400-reads-s"}
    },
    "relationships": {
      "estimate-traffic:relation:0": {"meaning": "decision", "condition": "", "explanation": "8.64M reads/day (daily volume) leads to ÷ 86,400 (seconds in a day) in this lesson. Daily total ÷ 86,400 = average requests per second."},
      "estimate-traffic:relation:1": {"meaning": "decision", "condition": "", "explanation": "÷ 86,400 (seconds in a day) leads to 100 reads/s (daily average) in this lesson. Daily total ÷ 86,400 = average requests per second."},
      "estimate-traffic:relation:2": {"meaning": "decision", "condition": "", "explanation": "100 reads/s (daily average) leads to × 4 busy peak (observed or assumed) in this lesson. Daily total ÷ 86,400 = average requests per second."},
      "estimate-traffic:relation:3": {"meaning": "decision", "condition": "", "explanation": "× 4 busy peak (observed or assumed) leads to 400 reads/s (starting peak target) in this lesson. Daily total ÷ 86,400 = average requests per second."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "estimate-traffic:explain:1",
        "title": "Convert daily volume into a rate",
        "description": "Average requests per second are daily requests divided by 86,400 seconds. Ten million reads per day average about 116 reads per second. Real people are not evenly distributed across the day, so an assumed fivefold peak gives roughly 580 reads per second. Keep reads and writes separate because they stress different parts of a system.",
        "nodeIds": ["estimate-traffic:node:0", "estimate-traffic:node:1", "estimate-traffic:node:2", "estimate-traffic:node:3", "estimate-traffic:node:4"],
        "linkIds": ["estimate-traffic:relation:0", "estimate-traffic:relation:1", "estimate-traffic:relation:2", "estimate-traffic:relation:3"]
      },
      {
        "id": "estimate-traffic:explain:2",
        "title": "Test peaks and failure headroom",
        "description": "A peak multiplier is an assumption until traffic measurements replace it. If the service has strong regional or event-driven spikes, use the observed peak window instead. Size against the burst the product must actually survive, then leave room for a failed instance, growth, or imperfect load balancing.",
        "nodeIds": ["estimate-traffic:node:3", "estimate-traffic:node:4"],
        "linkIds": ["estimate-traffic:relation:3"],
        "viewId": "estimate-traffic:view:point-2"
      }
    ],
    "views": [
      {
        "id": "estimate-traffic:view:point-2",
        "title": "Test peaks and failure headroom",
        "description": "A peak multiplier is an assumption until traffic measurements replace it. If the service has strong regional or event-driven spikes, use the observed peak window instead. Size against the burst the product must actually survive, then leave room for a failed instance, growth, or imperfect load balancing.",
        "members": ["estimate-traffic:node:3", "estimate-traffic:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "estimate-traffic:predict:eq03",
        "title": "Predict the design consequence",
        "prompt": "About how many average requests per second are 8.64 million requests per day?",
        "options": ["10", "100", "1,000", "8,640"],
        "correctIndex": 1,
        "explanation": "8,640,000 ÷ 86,400 seconds per day = 100 requests per second on average.",
        "reveal": {
          "id": "estimate-traffic:reveal:eq03",
          "title": "Why this choice follows",
          "description": "8,640,000 ÷ 86,400 seconds per day = 100 requests per second on average.",
          "nodeIds": ["estimate-traffic:node:0", "estimate-traffic:node:1", "estimate-traffic:node:2"],
          "linkIds": ["estimate-traffic:relation:0", "estimate-traffic:relation:1"]
        }
      }
    ]
  },
  "estimate-data": {
    "layout": "pipeline",
    "nodeRoles": {
      "estimate-data:node:0": {"lane": 0, "order": 1, "semanticId": "200k-uploads-day"},
      "estimate-data:node:1": {"lane": 1, "order": 1, "semanticId": "4-mb"},
      "estimate-data:node:2": {"lane": 2, "order": 1, "semanticId": "800-gb-day"},
      "estimate-data:node:3": {"lane": 3, "order": 1, "semanticId": "292-tb-year"},
      "estimate-data:node:4": {"lane": 0, "order": 4, "semanticId": "views-day"},
      "estimate-data:node:5": {"lane": 1, "order": 4, "semanticId": "bytes-view"},
      "estimate-data:node:6": {"lane": 2, "order": 4, "semanticId": "transfer-day"}
    },
    "relationships": {
      "estimate-data:relation:0": {"meaning": "decision", "condition": "", "explanation": "200k uploads/day (new stored items) leads to × 4 MB (average item size) in this lesson. Storage follows writes, item size, and retention."},
      "estimate-data:relation:1": {"meaning": "decision", "condition": "", "explanation": "× 4 MB (average item size) leads to 800 GB/day (logical storage) in this lesson. Storage follows writes, item size, and retention."},
      "estimate-data:relation:2": {"meaning": "decision", "condition": "", "explanation": "800 GB/day (logical storage) leads to ≈ 292 TB/year (before extra copies) in this lesson. Storage follows writes, item size, and retention."},
      "estimate-data:relation:3": {"meaning": "decision", "condition": "", "explanation": "Views/day (repeated reads) leads to × bytes/view (delivered size) in this lesson. Storage follows writes, item size, and retention."},
      "estimate-data:relation:4": {"meaning": "decision", "condition": "", "explanation": "× bytes/view (delivered size) leads to Transfer/day (delivery capacity) in this lesson. Storage follows writes, item size, and retention."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "estimate-data:explain:1",
        "title": "Budget retained storage bytes",
        "description": "Estimate logical storage as new items per day × average stored bytes × retention days. If 200,000 images arrive daily at an average of 4 MB, that is about 800 GB of new image data each day and about 292 TB over a year using decimal units. This is before replicas, transformed versions, indexes, backups, and metadata.",
        "nodeIds": ["estimate-data:node:0", "estimate-data:node:2", "estimate-data:node:3", "estimate-data:node:5", "estimate-data:node:6"],
        "linkIds": ["estimate-data:relation:2", "estimate-data:relation:4"],
        "viewId": "estimate-data:view:point-1"
      },
      {
        "id": "estimate-data:explain:2",
        "title": "Budget repeated delivery bytes separately",
        "description": "Delivery is a separate calculation: views × bytes delivered per view. A popular asset can be stored once but transferred millions of times. A CDN may reduce origin traffic while total delivery remains high. Record whether sizes are compressed and whether media has multiple renditions. State your units: 1 GB is 10⁹ bytes, while 1 GiB is 2³⁰ bytes.",
        "nodeIds": ["estimate-data:node:0", "estimate-data:node:1", "estimate-data:node:4", "estimate-data:node:5", "estimate-data:node:6"],
        "linkIds": ["estimate-data:relation:0", "estimate-data:relation:3", "estimate-data:relation:4"],
        "viewId": "estimate-data:view:point-2"
      }
    ],
    "views": [
      {
        "id": "estimate-data:view:point-1",
        "title": "Budget retained storage bytes",
        "description": "Estimate logical storage as new items per day × average stored bytes × retention days. If 200,000 images arrive daily at an average of 4 MB, that is about 800 GB of new image data each day and about 292 TB over a year using decimal units. This is before replicas, transformed versions, indexes, backups, and metadata.",
        "members": ["estimate-data:node:0", "estimate-data:node:2", "estimate-data:node:3", "estimate-data:node:5", "estimate-data:node:6"],
        "layout": "pipeline"
      },
      {
        "id": "estimate-data:view:point-2",
        "title": "Budget repeated delivery bytes separately",
        "description": "Delivery is a separate calculation: views × bytes delivered per view. A popular asset can be stored once but transferred millions of times. A CDN may reduce origin traffic while total delivery remains high. Record whether sizes are compressed and whether media has multiple renditions. State your units: 1 GB is 10⁹ bytes, while 1 GiB is 2³⁰ bytes.",
        "members": ["estimate-data:node:0", "estimate-data:node:1", "estimate-data:node:4", "estimate-data:node:5", "estimate-data:node:6"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "estimate-data:predict:eq06",
        "title": "Predict the design consequence",
        "prompt": "200,000 uploads each averaging 4 MB add about how much logical data per day?",
        "options": ["80 GB", "800 GB", "8 TB", "800 TB"],
        "correctIndex": 1,
        "explanation": "200,000 × 4 MB = 800,000 MB, or about 800 GB in decimal units.",
        "reveal": {
          "id": "estimate-data:reveal:eq06",
          "title": "Why this choice follows",
          "description": "200,000 × 4 MB = 800,000 MB, or about 800 GB in decimal units.",
          "nodeIds": ["estimate-data:node:0", "estimate-data:node:1", "estimate-data:node:2"],
          "linkIds": ["estimate-data:relation:0", "estimate-data:relation:1"]
        }
      }
    ]
  },
  "estimate-limits": {
    "layout": "pipeline",
    "nodeRoles": {
      "estimate-limits:node:0": {"lane": 0, "order": 2, "semanticId": "40-ms-network"},
      "estimate-limits:node:1": {"lane": 1, "order": 2, "semanticId": "30-ms-app"},
      "estimate-limits:node:2": {"lane": 2, "order": 2, "semanticId": "110-ms-data"},
      "estimate-limits:node:3": {"lane": 3, "order": 2, "semanticId": "20-ms-reserve"},
      "estimate-limits:node:4": {"lane": 1, "order": 4, "semanticId": "200-ms-target"},
      "estimate-limits:node:5": {"lane": 2, "order": 4, "semanticId": "99-9-uptime"}
    },
    "relationships": {
      "estimate-limits:relation:0": {"meaning": "decision", "condition": "", "explanation": "40 ms network → 30 ms app: +. business logic."},
      "estimate-limits:relation:1": {"meaning": "decision", "condition": "", "explanation": "30 ms app → 110 ms data: +. query and response."},
      "estimate-limits:relation:2": {"meaning": "decision", "condition": "", "explanation": "110 ms data → 20 ms reserve: +. remaining budget."},
      "estimate-limits:relation:3": {"meaning": "decision", "condition": "", "explanation": "20 ms reserve (remaining budget) leads to 200 ms target (full request path) in this lesson. Split latency across the full request path and check its slowest cases."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "estimate-limits:explain:1",
        "title": "Share the full response-time budget",
        "description": "A response-time target is a budget shared by network travel, application work, data access, and serialization. Memory access, disk access, and travel between regions have very different costs, but old benchmark tables are not a substitute for measuring your hardware and path. For a 200 ms target, a slow 180 ms database call leaves almost no room for the rest. Measure tail latency later; averages can hide the requests users experience as slow.",
        "nodeIds": ["estimate-limits:node:0", "estimate-limits:node:2", "estimate-limits:node:3", "estimate-limits:node:4"],
        "linkIds": ["estimate-limits:relation:2", "estimate-limits:relation:3"],
        "viewId": "estimate-limits:view:point-1"
      },
      {
        "id": "estimate-limits:explain:2",
        "title": "Translate availability into a time allowance",
        "description": "Availability percentages also need a time window. At 99.9% availability over a 30-day month, the allowed unavailable time is 0.1% × 30 × 24 × 60 = 43.2 minutes. That figure is a target, not a guarantee from adding replicas. Recovery procedures, dependencies, deployments, and monitoring determine what users actually experience.",
        "nodeIds": ["estimate-limits:node:3", "estimate-limits:node:4", "estimate-limits:node:5"],
        "linkIds": ["estimate-limits:relation:3"],
        "viewId": "estimate-limits:view:point-2"
      }
    ],
    "views": [
      {
        "id": "estimate-limits:view:point-1",
        "title": "Share the full response-time budget",
        "description": "A response-time target is a budget shared by network travel, application work, data access, and serialization. Memory access, disk access, and travel between regions have very different costs, but old benchmark tables are not a substitute for measuring your hardware and path. For a 200 ms target, a slow 180 ms database call leaves almost no room for the rest. Measure tail latency later; averages can hide the requests users experience as slow.",
        "members": ["estimate-limits:node:0", "estimate-limits:node:2", "estimate-limits:node:3", "estimate-limits:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "estimate-limits:view:point-2",
        "title": "Translate availability into a time allowance",
        "description": "Availability percentages also need a time window. At 99.9% availability over a 30-day month, the allowed unavailable time is 0.1% × 30 × 24 × 60 = 43.2 minutes. That figure is a target, not a guarantee from adding replicas. Recovery procedures, dependencies, deployments, and monitoring determine what users actually experience.",
        "members": ["estimate-limits:node:3", "estimate-limits:node:4", "estimate-limits:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "estimate-limits:predict:reserve",
        "title": "Predict the remaining budget",
        "prompt": "The displayed path budgets 40 ms network, 30 ms app, and 110 ms data against a 200 ms target. How much remains?",
        "options": ["20 ms", "110 ms", "200 ms"],
        "correctIndex": 0,
        "explanation": "40 + 30 + 110 = 180 ms. The 20 ms reserve completes the displayed 200 ms request budget. It is an allowance, not observed latency.",
        "reveal": {
          "id": "estimate-limits:reveal:reserve",
          "title": "Predict the remaining budget",
          "description": "40 + 30 + 110 = 180 ms. The 20 ms reserve completes the displayed 200 ms request budget. It is an allowance, not observed latency.",
          "nodeIds": ["estimate-limits:node:0", "estimate-limits:node:1", "estimate-limits:node:2", "estimate-limits:node:3", "estimate-limits:node:4"],
          "linkIds": ["estimate-limits:relation:0", "estimate-limits:relation:1", "estimate-limits:relation:2", "estimate-limits:relation:3"]
        }
      }
    ]
  },
  "estimate-decisions": {
    "layout": "pipeline",
    "nodeRoles": {
      "estimate-decisions:node:0": {"lane": 0, "order": 2, "semanticId": "1-200-peak-req-s"},
      "estimate-decisions:node:1": {"lane": 1, "order": 2, "semanticId": "210-req-s"},
      "estimate-decisions:node:2": {"lane": 3, "order": 2, "semanticId": "6-healthy"},
      "estimate-decisions:node:3": {"lane": 4, "order": 2, "semanticId": "1-spare"},
      "estimate-decisions:node:4": {"lane": 2, "order": 4, "semanticId": "7-deployed"}
    },
    "relationships": {
      "estimate-decisions:relation:0": {"meaning": "decision", "condition": "", "explanation": "1,200 peak req/s (expected busy load) leads to ÷ 210 req/s (300 measured × 70%) in this lesson. Headroom and failure targets change the required instance count."},
      "estimate-decisions:relation:1": {"meaning": "decision", "condition": "", "explanation": "÷ 210 req/s (300 measured × 70%) leads to 6 healthy (round 5.72 upward) in this lesson. Headroom and failure targets change the required instance count."},
      "estimate-decisions:relation:2": {"meaning": "decision", "condition": "", "explanation": "6 healthy (round 5.72 upward) leads to + 1 spare (survive one failure) in this lesson. Headroom and failure targets change the required instance count."},
      "estimate-decisions:relation:3": {"meaning": "decision", "condition": "", "explanation": "+ 1 spare (survive one failure) leads to 7 deployed (verify in a load test) in this lesson. Headroom and failure targets change the required instance count."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "estimate-decisions:explain:1",
        "title": "Calculate healthy and spare instances",
        "description": "Suppose a web instance sustains 300 requests per second in a representative load test. A 1,200-request-per-second peak needs four instances only if all four run at their limit. With a target of at most 70% utilization, each contributes about 210 requests per second, so the first estimate is six healthy instances. If one must fail without overload, provision and test for that failure too.",
        "nodeIds": ["estimate-decisions:node:0", "estimate-decisions:node:1", "estimate-decisions:node:2", "estimate-decisions:node:3", "estimate-decisions:node:4"],
        "linkIds": ["estimate-decisions:relation:0", "estimate-decisions:relation:1", "estimate-decisions:relation:2", "estimate-decisions:relation:3"]
      },
      {
        "id": "estimate-decisions:explain:2",
        "title": "Find the assumption that changes the choice",
        "description": "Change one assumption at a time: daily activity, peak multiplier, object size, or retention. If doubling one input changes the component choice, that input deserves measurement. Round estimates enough to compare options, then replace guesses with traffic data, load tests, and a clear capacity trigger.",
        "nodeIds": ["estimate-decisions:node:0", "estimate-decisions:node:1", "estimate-decisions:node:2", "estimate-decisions:node:4"],
        "linkIds": ["estimate-decisions:relation:0", "estimate-decisions:relation:1"],
        "viewId": "estimate-decisions:view:point-2"
      }
    ],
    "views": [
      {
        "id": "estimate-decisions:view:point-2",
        "title": "Find the assumption that changes the choice",
        "description": "Change one assumption at a time: daily activity, peak multiplier, object size, or retention. If doubling one input changes the component choice, that input deserves measurement. Round estimates enough to compare options, then replace guesses with traffic data, load tests, and a clear capacity trigger.",
        "members": ["estimate-decisions:node:0", "estimate-decisions:node:1", "estimate-decisions:node:2", "estimate-decisions:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "estimate-decisions:predict:eq11",
        "title": "Predict the design consequence",
        "prompt": "Peak load is 1,200 requests/s. Each instance sustains 300 requests/s, but target utilization is 70%. What is the first healthy-instance estimate?",
        "options": ["4", "5", "6", "12"],
        "correctIndex": 2,
        "explanation": "Effective capacity is 300 × 0.7 = 210 requests/s per instance; 1,200 ÷ 210 rounds up to six.",
        "reveal": {
          "id": "estimate-decisions:reveal:eq11",
          "title": "Why this choice follows",
          "description": "Effective capacity is 300 × 0.7 = 210 requests/s per instance; 1,200 ÷ 210 rounds up to six.",
          "nodeIds": ["estimate-decisions:node:0", "estimate-decisions:node:1", "estimate-decisions:node:2"],
          "linkIds": ["estimate-decisions:relation:0", "estimate-decisions:relation:1"]
        }
      }
    ]
  }
};
