import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const autocompleteTeachingContent: Record<string, TeachingContent> = {
  "autocomplete-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-scope:node:0": {"lane": 0, "order": 2, "semanticId": "typing-client"},
      "autocomplete-scope:node:1": {"lane": 1, "order": 2, "semanticId": "query-api"},
      "autocomplete-scope:node:2": {"lane": 2, "order": 2, "semanticId": "ranked-index"},
      "autocomplete-scope:node:3": {"lane": 3, "order": 2, "semanticId": "suggestion-list"}
    },
    "relationships": {
      "autocomplete-scope:relation:0": {"meaning": "connection", "condition": "", "explanation": "Typing client (latest input) leads to Query API (prefix + locale) in this lesson. Specify matching, ranking, context, and latency before choosing an index."},
      "autocomplete-scope:relation:1": {"meaning": "connection", "condition": "", "explanation": "Query API (prefix + locale) leads to Ranked index (public candidates) in this lesson. Specify matching, ranking, context, and latency before choosing an index."},
      "autocomplete-scope:relation:2": {"meaning": "connection", "condition": "", "explanation": "Ranked index (public candidates) leads to Suggestion list (five safe results) in this lesson. Specify matching, ranking, context, and latency before choosing an index."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-scope:explain:1",
        "title": "Define incomplete-input suggestions",
        "description": "Autocomplete answers an incomplete input, not a completed search. Set the contract first: prefix-only or substring matches, result count, normalization, supported languages, regional differences, personalization, and empty-input behavior. A useful first version returns five popular completed searches that begin with the typed prefix. Spell correction is a separate feature.",
        "nodeIds": ["autocomplete-scope:node:0", "autocomplete-scope:node:1", "autocomplete-scope:node:3"],
        "linkIds": ["autocomplete-scope:relation:0"],
        "viewId": "autocomplete-scope:view:point-1"
      },
      {
        "id": "autocomplete-scope:explain:2",
        "title": "Ignore stale client responses",
        "description": "The client should debounce rapid keystrokes and ignore late responses for older inputs. Cancellation helps but can race with an already completed request. Define a high-percentile latency target from keystroke to visible suggestions, not just the server average. Very short prefixes can be disproportionately expensive because they cover large candidate sets.",
        "nodeIds": ["autocomplete-scope:node:0", "autocomplete-scope:node:2", "autocomplete-scope:node:3"],
        "linkIds": ["autocomplete-scope:relation:2"],
        "viewId": "autocomplete-scope:view:point-2"
      }
    ],
    "views": [
      {
        "id": "autocomplete-scope:view:point-1",
        "title": "Define incomplete-input suggestions",
        "description": "Autocomplete answers an incomplete input, not a completed search. Set the contract first: prefix-only or substring matches, result count, normalization, supported languages, regional differences, personalization, and empty-input behavior. A useful first version returns five popular completed searches that begin with the typed prefix. Spell correction is a separate feature.",
        "members": ["autocomplete-scope:node:0", "autocomplete-scope:node:1", "autocomplete-scope:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "autocomplete-scope:view:point-2",
        "title": "Ignore stale client responses",
        "description": "The client should debounce rapid keystrokes and ignore late responses for older inputs. Cancellation helps but can race with an already completed request. Define a high-percentile latency target from keystroke to visible suggestions, not just the server average. Very short prefixes can be disproportionately expensive because they cover large candidate sets.",
        "members": ["autocomplete-scope:node:0", "autocomplete-scope:node:2", "autocomplete-scope:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-scope:predict:acq02",
        "title": "Predict the design consequence",
        "prompt": "An older request finishes after a newer one and replaces current suggestions. What should the client do?",
        "options": ["Submit automatically", "Disable caching", "Ignore results whose input or sequence is stale", "Increase result count"],
        "correctIndex": 2,
        "explanation": "Response order is not typing order; only the latest input should update the list.",
        "reveal": {
          "id": "autocomplete-scope:reveal:acq02",
          "title": "Why this choice follows",
          "description": "Response order is not typing order; only the latest input should update the list.",
          "nodeIds": ["autocomplete-scope:node:0", "autocomplete-scope:node:1", "autocomplete-scope:node:2"],
          "linkIds": ["autocomplete-scope:relation:0", "autocomplete-scope:relation:1"]
        }
      }
    ]
  },
  "autocomplete-traffic": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-traffic:node:0": {"lane": 0, "order": 2, "semanticId": "typing-client"},
      "autocomplete-traffic:node:1": {"lane": 1, "order": 1, "semanticId": "suggestion-api"},
      "autocomplete-traffic:node:2": {"lane": 1, "order": 4, "semanticId": "submit-search"},
      "autocomplete-traffic:node:3": {"lane": 2, "order": 1, "semanticId": "serving-index"},
      "autocomplete-traffic:node:4": {"lane": 2, "order": 4, "semanticId": "event-log"}
    },
    "relationships": {
      "autocomplete-traffic:relation:0": {"meaning": "connection", "condition": "", "explanation": "Typing client (four requests) leads to Suggestion API (read-heavy path) in this lesson. Estimate suggestion reads from typing behavior and peaks."},
      "autocomplete-traffic:relation:1": {"meaning": "connection", "condition": "", "explanation": "Typing client (four requests) leads to Submit search (one completion) in this lesson. Estimate suggestion reads from typing behavior and peaks."},
      "autocomplete-traffic:relation:2": {"meaning": "connection", "condition": "", "explanation": "Suggestion API (read-heavy path) leads to Serving index (fast prefix reads) in this lesson. Estimate suggestion reads from typing behavior and peaks."},
      "autocomplete-traffic:relation:3": {"meaning": "connection", "condition": "", "explanation": "Submit search (one completion) leads to Event log (ranking signal) in this lesson. Estimate suggestion reads from typing behavior and peaks."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-traffic:explain:1",
        "title": "Count suggestion reads per search",
        "description": "Suppose two million active people make six searches a day and the client sends four suggestion requests per search after debouncing. That is 48 million suggestion reads a day, about 556 per second on average. A tenfold busy-hour multiplier suggests about 5,600 per second. These are illustrative assumptions; check real keystroke patterns, cache hits, and regional peaks before sizing.",
        "nodeIds": ["autocomplete-traffic:node:0", "autocomplete-traffic:node:1", "autocomplete-traffic:node:2", "autocomplete-traffic:node:3"],
        "linkIds": ["autocomplete-traffic:relation:0", "autocomplete-traffic:relation:1", "autocomplete-traffic:relation:2"],
        "viewId": "autocomplete-traffic:view:point-1"
      },
      {
        "id": "autocomplete-traffic:explain:2",
        "title": "Keep prefix requests out of learning counts",
        "description": "Do not count each prefix request as a completed search. A person typing “camera” may request “ca,” “cam,” and “came” before submitting “camera.” Completed searches, with consent and retention rules, can feed popularity counts. Keep the read-heavy serving path separate from collection and periodic index building.",
        "nodeIds": ["autocomplete-traffic:node:0", "autocomplete-traffic:node:1", "autocomplete-traffic:node:2", "autocomplete-traffic:node:3"],
        "linkIds": ["autocomplete-traffic:relation:0", "autocomplete-traffic:relation:1", "autocomplete-traffic:relation:2"]
      }
    ],
    "views": [
      {
        "id": "autocomplete-traffic:view:point-1",
        "title": "Count suggestion reads per search",
        "description": "Suppose two million active people make six searches a day and the client sends four suggestion requests per search after debouncing. That is 48 million suggestion reads a day, about 556 per second on average. A tenfold busy-hour multiplier suggests about 5,600 per second. These are illustrative assumptions; check real keystroke patterns, cache hits, and regional peaks before sizing.",
        "members": ["autocomplete-traffic:node:0", "autocomplete-traffic:node:1", "autocomplete-traffic:node:2", "autocomplete-traffic:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-traffic:predict:completion-signal",
        "title": "Predict the learning event",
        "prompt": "Typing client sends four suggestion requests and then Submit search records one completion. Which path should become the ranking signal?",
        "options": ["Submit search → Event log", "Each Suggestion API prefix read as a completed search", "Every returned suggestion as a chosen result"],
        "correctIndex": 0,
        "explanation": "The displayed Submit search → Event log branch records completed-search behavior. Prefix reads serve suggestions and should not inflate completion counts.",
        "reveal": {
          "id": "autocomplete-traffic:reveal:completion-signal",
          "title": "Predict the learning event",
          "description": "The displayed Submit search → Event log branch records completed-search behavior. Prefix reads serve suggestions and should not inflate completion counts.",
          "nodeIds": ["autocomplete-traffic:node:0", "autocomplete-traffic:node:1", "autocomplete-traffic:node:2", "autocomplete-traffic:node:3", "autocomplete-traffic:node:4"],
          "linkIds": ["autocomplete-traffic:relation:1", "autocomplete-traffic:relation:3"]
        }
      }
    ]
  },
  "autocomplete-prefix": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-prefix:node:0": {"lane": 0, "order": 2, "semanticId": "input-ca"},
      "autocomplete-prefix:node:1": {"lane": 1, "order": 2, "semanticId": "prefix-node"},
      "autocomplete-prefix:node:2": {"lane": 2, "order": 2, "semanticId": "top-k-cache"},
      "autocomplete-prefix:node:3": {"lane": 3, "order": 2, "semanticId": "results"},
      "autocomplete-prefix:node:4": {"lane": 2, "order": 4, "semanticId": "descendants"}
    },
    "relationships": {
      "autocomplete-prefix:relation:0": {"meaning": "connection", "condition": "", "explanation": "Input: ca (two characters) leads to Prefix node (trie path O(p)) in this lesson. Prefix lookup and top-K selection have separate costs."},
      "autocomplete-prefix:relation:1": {"meaning": "connection", "condition": "", "explanation": "Prefix node (trie path O(p)) leads to Top-K cache (bounded candidates) in this lesson. Prefix lookup and top-K selection have separate costs."},
      "autocomplete-prefix:relation:2": {"meaning": "connection", "condition": "", "explanation": "Top-K cache (bounded candidates) leads to Results (ranked matches) in this lesson. Prefix lookup and top-K selection have separate costs."},
      "autocomplete-prefix:relation:3": {"meaning": "connection", "condition": "", "explanation": "Descendants (costly to scan) leads to Top-K cache (bounded candidates) in this lesson. Prefix lookup and top-K selection have separate costs."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-prefix:explain:1",
        "title": "Find a prefix range or trie node",
        "description": "For a small catalog, a normalized indexed range query may suffice. A trie can follow one edge per character to reach a prefix node; a terminal marker distinguishes a complete submitted query from a mere prefix. Prefix lookup costs O(p) for input length p, but that says nothing about the cost of finding the best descendants.",
        "nodeIds": ["autocomplete-prefix:node:0", "autocomplete-prefix:node:1", "autocomplete-prefix:node:4"],
        "linkIds": ["autocomplete-prefix:relation:0"],
        "viewId": "autocomplete-prefix:view:point-1"
      },
      {
        "id": "autocomplete-prefix:explain:2",
        "title": "Precompute candidates for broad prefixes",
        "description": "Scanning and sorting the entire subtree for every request is expensive for broad prefixes. Store a bounded top-K list at selected nodes, or materialize a prefix-to-top-K map. That trades memory and build work for fast reads. A compressed trie, sparse map, or database index may fit better depending on vocabulary size, update rate, and language. Capping input length bounds p only if enforced; it does not make arbitrary lookup inherently O(1).",
        "nodeIds": ["autocomplete-prefix:node:0", "autocomplete-prefix:node:1", "autocomplete-prefix:node:2"],
        "linkIds": ["autocomplete-prefix:relation:0", "autocomplete-prefix:relation:1"],
        "viewId": "autocomplete-prefix:view:point-2"
      }
    ],
    "views": [
      {
        "id": "autocomplete-prefix:view:point-1",
        "title": "Find a prefix range or trie node",
        "description": "For a small catalog, a normalized indexed range query may suffice. A trie can follow one edge per character to reach a prefix node; a terminal marker distinguishes a complete submitted query from a mere prefix. Prefix lookup costs O(p) for input length p, but that says nothing about the cost of finding the best descendants.",
        "members": ["autocomplete-prefix:node:0", "autocomplete-prefix:node:1", "autocomplete-prefix:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "autocomplete-prefix:view:point-2",
        "title": "Precompute candidates for broad prefixes",
        "description": "Scanning and sorting the entire subtree for every request is expensive for broad prefixes. Store a bounded top-K list at selected nodes, or materialize a prefix-to-top-K map. That trades memory and build work for fast reads. A compressed trie, sparse map, or database index may fit better depending on vocabulary size, update rate, and language. Capping input length bounds p only if enforced; it does not make arbitrary lookup inherently O(1).",
        "members": ["autocomplete-prefix:node:0", "autocomplete-prefix:node:1", "autocomplete-prefix:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-prefix:predict:broad-prefix",
        "title": "Predict broad-prefix work",
        "prompt": "The trie locates Input: ca quickly. Why does Top-K cache still help before Results?",
        "options": ["It avoids scanning and sorting all Descendants on every read", "It makes every prefix a complete search", "It removes the need to filter results"],
        "correctIndex": 0,
        "explanation": "Prefix traversal and candidate ranking are different costs. Descendants can be large, so precomputed bounded candidates in Top-K cache keep serving work small.",
        "reveal": {
          "id": "autocomplete-prefix:reveal:broad-prefix",
          "title": "Predict broad-prefix work",
          "description": "Prefix traversal and candidate ranking are different costs. Descendants can be large, so precomputed bounded candidates in Top-K cache keep serving work small.",
          "nodeIds": ["autocomplete-prefix:node:1", "autocomplete-prefix:node:2", "autocomplete-prefix:node:3", "autocomplete-prefix:node:4"],
          "linkIds": ["autocomplete-prefix:relation:1", "autocomplete-prefix:relation:2", "autocomplete-prefix:relation:3"]
        }
      }
    ]
  },
  "autocomplete-rank": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-rank:node:0": {"lane": 0, "order": 2, "semanticId": "count-windows"},
      "autocomplete-rank:node:1": {"lane": 1, "order": 2, "semanticId": "score"},
      "autocomplete-rank:node:2": {"lane": 2, "order": 2, "semanticId": "candidates"},
      "autocomplete-rank:node:3": {"lane": 3, "order": 2, "semanticId": "policy-filter"},
      "autocomplete-rank:node:4": {"lane": 3, "order": 4, "semanticId": "visible-top-five"}
    },
    "relationships": {
      "autocomplete-rank:relation:0": {"meaning": "connection", "condition": "", "explanation": "Count windows (historical + recent) leads to Score (context + ties) in this lesson. Define ranking signals, time window, context, and tie-breakers."},
      "autocomplete-rank:relation:1": {"meaning": "connection", "condition": "", "explanation": "Score (context + ties) leads to Candidates (more than five) in this lesson. Define ranking signals, time window, context, and tie-breakers."},
      "autocomplete-rank:relation:2": {"meaning": "connection", "condition": "", "explanation": "Candidates (more than five) leads to Policy filter (remove unsafe) in this lesson. Define ranking signals, time window, context, and tie-breakers."},
      "autocomplete-rank:relation:3": {"meaning": "connection", "condition": "", "explanation": "Policy filter (remove unsafe) leads to Visible top five (safe ordering) in this lesson. Define ranking signals, time window, context, and tie-breakers."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-rank:explain:1",
        "title": "Rank permitted completed searches",
        "description": "A baseline ranks normalized completed searches by count, then breaks ties deterministically. Lifetime popularity can be stale, so a time-decayed score can favor recent activity. A product catalog may also account for availability or quality. Decide whether rankings differ by region and locale before mixing their signals.",
        "nodeIds": ["autocomplete-rank:node:0", "autocomplete-rank:node:1"],
        "linkIds": ["autocomplete-rank:relation:0"],
        "viewId": "autocomplete-rank:view:point-1"
      },
      {
        "id": "autocomplete-rank:explain:2",
        "title": "Keep extra candidates for filtering",
        "description": "Keep more internal candidates than displayed slots. If the visible list has five entries and policy blocks one, a cache with exactly five gives only four. Filter a larger ranked candidate set, then take five. Public popularity and personal search history are different products; personal suggestions need account-aware access and private caching.",
        "nodeIds": ["autocomplete-rank:node:2", "autocomplete-rank:node:3", "autocomplete-rank:node:4"],
        "linkIds": ["autocomplete-rank:relation:2", "autocomplete-rank:relation:3"],
        "viewId": "autocomplete-rank:view:point-2"
      }
    ],
    "views": [
      {
        "id": "autocomplete-rank:view:point-1",
        "title": "Rank permitted completed searches",
        "description": "A baseline ranks normalized completed searches by count, then breaks ties deterministically. Lifetime popularity can be stale, so a time-decayed score can favor recent activity. A product catalog may also account for availability or quality. Decide whether rankings differ by region and locale before mixing their signals.",
        "members": ["autocomplete-rank:node:0", "autocomplete-rank:node:1"],
        "layout": "pipeline"
      },
      {
        "id": "autocomplete-rank:view:point-2",
        "title": "Keep extra candidates for filtering",
        "description": "Keep more internal candidates than displayed slots. If the visible list has five entries and policy blocks one, a cache with exactly five gives only four. Filter a larger ranked candidate set, then take five. Public popularity and personal search history are different products; personal suggestions need account-aware access and private caching.",
        "members": ["autocomplete-rank:node:2", "autocomplete-rank:node:3", "autocomplete-rank:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-rank:predict:acq10",
        "title": "Predict the design consequence",
        "prompt": "A public list has five slots and may filter blocked entries. How many candidates should it retain internally?",
        "options": ["One", "Exactly five", "Enough beyond five to fill after filtering", "Every raw event"],
        "correctIndex": 2,
        "explanation": "Extra ranked candidates keep the list full after removals.",
        "reveal": {
          "id": "autocomplete-rank:reveal:acq10",
          "title": "Why this choice follows",
          "description": "Extra ranked candidates keep the list full after removals.",
          "nodeIds": ["autocomplete-rank:node:1", "autocomplete-rank:node:2", "autocomplete-rank:node:3"],
          "linkIds": ["autocomplete-rank:relation:1", "autocomplete-rank:relation:2"]
        }
      }
    ]
  },
  "autocomplete-pipeline": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-pipeline:node:0": {"lane": 0, "order": 2, "semanticId": "search-event"},
      "autocomplete-pipeline:node:1": {"lane": 1, "order": 2, "semanticId": "event-stream"},
      "autocomplete-pipeline:node:2": {"lane": 2, "order": 2, "semanticId": "aggregate"},
      "autocomplete-pipeline:node:3": {"lane": 3, "order": 2, "semanticId": "build-index"},
      "autocomplete-pipeline:node:4": {"lane": 4, "order": 2, "semanticId": "snapshot"}
    },
    "relationships": {
      "autocomplete-pipeline:relation:0": {"meaning": "connection", "condition": "", "explanation": "Search event (submitted term) leads to Event stream (retry-safe IDs) in this lesson. Collection, aggregation, building, and serving have different latency and failure needs."},
      "autocomplete-pipeline:relation:1": {"meaning": "connection", "condition": "", "explanation": "Event stream (retry-safe IDs) leads to Aggregate (term × window) in this lesson. Collection, aggregation, building, and serving have different latency and failure needs."},
      "autocomplete-pipeline:relation:2": {"meaning": "connection", "condition": "", "explanation": "Aggregate (term × window) leads to Build index (rank prefixes) in this lesson. Collection, aggregation, building, and serving have different latency and failure needs."},
      "autocomplete-pipeline:relation:3": {"meaning": "connection", "condition": "", "explanation": "Build index (rank prefixes) leads to Snapshot (versioned) in this lesson. Collection, aggregation, building, and serving have different latency and failure needs."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-pipeline:explain:1",
        "title": "Collect permitted completed-search events",
        "description": "After a completed search, a collector records a permitted normalized term, time, and coarse context. An append-only stream lets consumers aggregate counts by term and window. Because events may be retried, an idempotency key or durable checkpoint prevents double counting. Sampling can reduce cost but must be consistent, and it can distort rare-term estimates.",
        "nodeIds": ["autocomplete-pipeline:node:0", "autocomplete-pipeline:node:1", "autocomplete-pipeline:node:2"],
        "linkIds": ["autocomplete-pipeline:relation:0", "autocomplete-pipeline:relation:1"],
        "viewId": "autocomplete-pipeline:view:point-1"
      },
      {
        "id": "autocomplete-pipeline:explain:2",
        "title": "Publish a validated immutable snapshot",
        "description": "Workers build ranked prefix lists from aggregates, validate them, and write an immutable snapshot. Serving nodes switch to a new version only after it is ready and retain the prior version for rollback. The build cadence follows freshness needs: a stable catalog may refresh daily; trending terms may need a small streaming delta merged with the baseline. Updating only one trie leaf leaves its ancestor top-K lists stale.",
        "nodeIds": ["autocomplete-pipeline:node:0", "autocomplete-pipeline:node:2", "autocomplete-pipeline:node:3", "autocomplete-pipeline:node:4"],
        "linkIds": ["autocomplete-pipeline:relation:2", "autocomplete-pipeline:relation:3"],
        "viewId": "autocomplete-pipeline:view:point-2"
      }
    ],
    "views": [
      {
        "id": "autocomplete-pipeline:view:point-1",
        "title": "Collect permitted completed-search events",
        "description": "After a completed search, a collector records a permitted normalized term, time, and coarse context. An append-only stream lets consumers aggregate counts by term and window. Because events may be retried, an idempotency key or durable checkpoint prevents double counting. Sampling can reduce cost but must be consistent, and it can distort rare-term estimates.",
        "members": ["autocomplete-pipeline:node:0", "autocomplete-pipeline:node:1", "autocomplete-pipeline:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "autocomplete-pipeline:view:point-2",
        "title": "Publish a validated immutable snapshot",
        "description": "Workers build ranked prefix lists from aggregates, validate them, and write an immutable snapshot. Serving nodes switch to a new version only after it is ready and retain the prior version for rollback. The build cadence follows freshness needs: a stable catalog may refresh daily; trending terms may need a small streaming delta merged with the baseline. Updating only one trie leaf leaves its ancestor top-K lists stale.",
        "members": ["autocomplete-pipeline:node:0", "autocomplete-pipeline:node:2", "autocomplete-pipeline:node:3", "autocomplete-pipeline:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-pipeline:predict:acq13",
        "title": "Predict the design consequence",
        "prompt": "A collector retries the same completed-search event. What prevents double counting?",
        "options": ["A larger prefix", "An idempotency key or durable checkpoint", "Browser animation", "Sorting after each request"],
        "correctIndex": 1,
        "explanation": "Retried delivery requires deduplication or idempotent aggregation.",
        "reveal": {
          "id": "autocomplete-pipeline:reveal:acq13",
          "title": "Why this choice follows",
          "description": "Retried delivery requires deduplication or idempotent aggregation.",
          "nodeIds": ["autocomplete-pipeline:node:0", "autocomplete-pipeline:node:1", "autocomplete-pipeline:node:2"],
          "linkIds": ["autocomplete-pipeline:relation:0", "autocomplete-pipeline:relation:1"]
        }
      }
    ]
  },
  "autocomplete-serve": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-serve:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "autocomplete-serve:node:1": {"lane": 1, "order": 2, "semanticId": "query-api"},
      "autocomplete-serve:node:2": {"lane": 2, "order": 2, "semanticId": "fast-cache"},
      "autocomplete-serve:node:3": {"lane": 3, "order": 2, "semanticId": "snapshot-store"}
    },
    "relationships": {
      "autocomplete-serve:relation:0": {"meaning": "connection", "condition": "", "explanation": "Client (current prefix) leads to Query API (validate + filter) in this lesson. A versioned, context-aware key prevents mixing results."},
      "autocomplete-serve:relation:1": {"meaning": "connection", "condition": "", "explanation": "Query API (validate + filter) leads to Fast cache (prefix + locale) in this lesson. A versioned, context-aware key prevents mixing results."},
      "autocomplete-serve:relation:2": {"meaning": "connection", "condition": "", "explanation": "Fast cache (prefix + locale) leads to Snapshot store (last good version) in this lesson. A versioned, context-aware key prevents mixing results."},
      "autocomplete-serve:relation:3": {"meaning": "connection", "condition": "", "explanation": "Snapshot store (last good version) leads to Fast cache (prefix + locale) in this lesson. A versioned, context-aware key prevents mixing results."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-serve:explain:1",
        "title": "Serve bounded candidates through cache",
        "description": "The client sends the current prefix to a query API. It validates length and context, reads a versioned prefix-to-candidates entry from memory or a shared cache, filters it, and returns a bounded list. On a miss, the service can read persistent snapshot storage and fill the cache. Warm broad prefixes or coalesce simultaneous misses to avoid a stampede. Replicated query nodes behind health-aware routing protect availability.",
        "nodeIds": ["autocomplete-serve:node:0", "autocomplete-serve:node:1", "autocomplete-serve:node:2", "autocomplete-serve:node:3"],
        "linkIds": ["autocomplete-serve:relation:0", "autocomplete-serve:relation:1", "autocomplete-serve:relation:2", "autocomplete-serve:relation:3"]
      },
      {
        "id": "autocomplete-serve:explain:2",
        "title": "Include context and version in cache keys",
        "description": "A public cache key must include normalized prefix, locale, region, and snapshot version whenever each changes the answer. Browser or CDN caching can help stable public lists with an appropriate lifetime. Account-specific suggestions require private caching or no shared cache. Keep a last-good snapshot available when a build or cache tier fails.",
        "nodeIds": ["autocomplete-serve:node:0", "autocomplete-serve:node:2", "autocomplete-serve:node:3"],
        "linkIds": ["autocomplete-serve:relation:2", "autocomplete-serve:relation:3"],
        "viewId": "autocomplete-serve:view:point-2"
      }
    ],
    "views": [
      {
        "id": "autocomplete-serve:view:point-2",
        "title": "Include context and version in cache keys",
        "description": "A public cache key must include normalized prefix, locale, region, and snapshot version whenever each changes the answer. Browser or CDN caching can help stable public lists with an appropriate lifetime. Account-specific suggestions require private caching or no shared cache. Keep a last-good snapshot available when a build or cache tier fails.",
        "members": ["autocomplete-serve:node:0", "autocomplete-serve:node:2", "autocomplete-serve:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-serve:predict:acq17",
        "title": "Predict the design consequence",
        "prompt": "A cold popular prefix causes many simultaneous snapshot reads. What helps?",
        "options": ["Delete all caches", "Coalesce requests or warm broad prefixes", "Retain more raw logs", "Return every match"],
        "correctIndex": 1,
        "explanation": "Coalescing and warming prevent a miss stampede.",
        "reveal": {
          "id": "autocomplete-serve:reveal:acq17",
          "title": "Why this choice follows",
          "description": "Coalescing and warming prevent a miss stampede.",
          "nodeIds": ["autocomplete-serve:node:1", "autocomplete-serve:node:2", "autocomplete-serve:node:3"],
          "linkIds": ["autocomplete-serve:relation:1", "autocomplete-serve:relation:2", "autocomplete-serve:relation:3"],
          "statuses": {
            "autocomplete-serve:node:2": "under-pressure"
          }
        }
      }
    ]
  },
  "autocomplete-scale": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-scale:node:0": {"lane": 0, "order": 2, "semanticId": "query-api"},
      "autocomplete-scale:node:1": {"lane": 1, "order": 2, "semanticId": "range-map"},
      "autocomplete-scale:node:2": {"lane": 2, "order": 1, "semanticId": "hot-slice-a"},
      "autocomplete-scale:node:3": {"lane": 2, "order": 3, "semanticId": "slice-b"},
      "autocomplete-scale:node:4": {"lane": 3, "order": 2, "semanticId": "merge-top-k"}
    },
    "relationships": {
      "autocomplete-scale:relation:0": {"meaning": "connection", "condition": "", "explanation": "Query API (one prefix) leads to Range map (versioned routes) in this lesson. Partition boundaries should reflect measured load, not equal letter counts."},
      "autocomplete-scale:relation:1": {"meaning": "connection", "condition": "", "explanation": "Range map (versioned routes) leads to Hot slice A (replicated reads) in this lesson. Partition boundaries should reflect measured load, not equal letter counts."},
      "autocomplete-scale:relation:2": {"meaning": "connection", "condition": "", "explanation": "Range map (versioned routes) leads to Slice B (split range) in this lesson. Partition boundaries should reflect measured load, not equal letter counts."},
      "autocomplete-scale:relation:3": {"meaning": "connection", "condition": "", "explanation": "Hot slice A (replicated reads) leads to Merge top-K (if fanout needed) in this lesson. Partition boundaries should reflect measured load, not equal letter counts."},
      "autocomplete-scale:relation:4": {"meaning": "connection", "condition": "", "explanation": "Slice B (split range) leads to Merge top-K (if fanout needed) in this lesson. Partition boundaries should reflect measured load, not equal letter counts."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-scale:explain:1",
        "title": "Partition by measured prefix demand",
        "description": "A prefix range map can assign terms to serving shards. Equal alphabet ranges are often unbalanced: common initial letters and one-letter prefixes may be much hotter than rare ones. Measure bytes, request rate, and CPU per range, then split busy ranges or add read replicas. Version the routing map during movement.",
        "nodeIds": ["autocomplete-scale:node:0", "autocomplete-scale:node:1", "autocomplete-scale:node:2", "autocomplete-scale:node:3"],
        "linkIds": ["autocomplete-scale:relation:0", "autocomplete-scale:relation:1", "autocomplete-scale:relation:2"],
        "viewId": "autocomplete-scale:view:point-1"
      },
      {
        "id": "autocomplete-scale:explain:2",
        "title": "Merge candidates across relevant shards",
        "description": "If a requested prefix spans shards, the query tier must fetch candidates from each relevant shard and merge their top-K results. Keeping all descendants together avoids this fanout but can concentrate storage and traffic; replicas spread reads without splitting the range. A merged response should not combine incompatible ranking versions. Choose partition boundaries from measured demand and failure goals.",
        "nodeIds": ["autocomplete-scale:node:0", "autocomplete-scale:node:1", "autocomplete-scale:node:2", "autocomplete-scale:node:3", "autocomplete-scale:node:4"],
        "linkIds": ["autocomplete-scale:relation:0", "autocomplete-scale:relation:1", "autocomplete-scale:relation:2", "autocomplete-scale:relation:3", "autocomplete-scale:relation:4"]
      }
    ],
    "views": [
      {
        "id": "autocomplete-scale:view:point-1",
        "title": "Partition by measured prefix demand",
        "description": "A prefix range map can assign terms to serving shards. Equal alphabet ranges are often unbalanced: common initial letters and one-letter prefixes may be much hotter than rare ones. Measure bytes, request rate, and CPU per range, then split busy ranges or add read replicas. Version the routing map during movement.",
        "members": ["autocomplete-scale:node:0", "autocomplete-scale:node:1", "autocomplete-scale:node:2", "autocomplete-scale:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-scale:predict:acq19",
        "title": "Predict the design consequence",
        "prompt": "Why can equal letter ranges overload one shard?",
        "options": ["All letters have identical demand", "Prefix and storage distributions are uneven", "A trie cannot contain “s”", "Replicas remove all reads"],
        "correctIndex": 1,
        "explanation": "Hot letters and short prefixes concentrate demand.",
        "reveal": {
          "id": "autocomplete-scale:reveal:acq19",
          "title": "Why this choice follows",
          "description": "Hot letters and short prefixes concentrate demand.",
          "nodeIds": ["autocomplete-scale:node:1", "autocomplete-scale:node:2", "autocomplete-scale:node:3", "autocomplete-scale:node:4"],
          "linkIds": ["autocomplete-scale:relation:1", "autocomplete-scale:relation:2", "autocomplete-scale:relation:3", "autocomplete-scale:relation:4"]
        }
      }
    ]
  },
  "autocomplete-ops": {
    "layout": "tiers",
    "nodeRoles": {
      "autocomplete-ops:node:0": {"lane": 0, "order": 2, "semanticId": "abuse-signal"},
      "autocomplete-ops:node:1": {"lane": 1, "order": 1, "semanticId": "serving-filter"},
      "autocomplete-ops:node:2": {"lane": 1, "order": 3, "semanticId": "source-correction"},
      "autocomplete-ops:node:3": {"lane": 2, "order": 2, "semanticId": "build-rollout"},
      "autocomplete-ops:node:4": {"lane": 3, "order": 2, "semanticId": "fallback"}
    },
    "relationships": {
      "autocomplete-ops:relation:0": {"meaning": "connection", "condition": "", "explanation": "Abuse signal (report or anomaly) leads to Serving filter (suppress now) in this lesson. Immediate filtering and source cleanup solve different parts of removal."},
      "autocomplete-ops:relation:1": {"meaning": "connection", "condition": "", "explanation": "Abuse signal (report or anomaly) leads to Source correction (exclude future) in this lesson. Immediate filtering and source cleanup solve different parts of removal."},
      "autocomplete-ops:relation:2": {"meaning": "connection", "condition": "", "explanation": "Source correction (exclude future) leads to Build + rollout (validated version) in this lesson. Immediate filtering and source cleanup solve different parts of removal."},
      "autocomplete-ops:relation:3": {"meaning": "connection", "condition": "", "explanation": "Serving filter (suppress now) leads to Build + rollout (validated version) in this lesson. Immediate filtering and source cleanup solve different parts of removal."},
      "autocomplete-ops:relation:4": {"meaning": "connection", "condition": "", "explanation": "Build + rollout (validated version) leads to Fallback (last good) in this lesson. Immediate filtering and source cleanup solve different parts of removal."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "autocomplete-ops:explain:1",
        "title": "Protect private searches and suppress unsafe terms",
        "description": "Raw searches can reveal personal information. Minimize collection, limit retention and access, and remove sensitive or abusive terms before public ranking. A fast denylist can suppress an unsafe suggestion now, while aggregate and future snapshot correction prevents its return. Resist manipulation with rate limits, abuse signals, and anomaly review; popularity is not proof of legitimacy.",
        "nodeIds": ["autocomplete-ops:node:0", "autocomplete-ops:node:1", "autocomplete-ops:node:2"],
        "linkIds": ["autocomplete-ops:relation:0", "autocomplete-ops:relation:1"],
        "viewId": "autocomplete-ops:view:point-1"
      },
      {
        "id": "autocomplete-ops:explain:2",
        "title": "Observe latency, freshness, and policy effects",
        "description": "Monitor keystroke latency, API p95/p99, empty-result rate, cache hit rate, shard skew, build age, stream lag, and policy-block hits. Trace snapshot version from aggregate to response. Test stale-snapshot fallback, shard failure, cache stampede, and rollback. If suggestions fail, full search submission should still work.",
        "nodeIds": ["autocomplete-ops:node:3", "autocomplete-ops:node:4"],
        "linkIds": ["autocomplete-ops:relation:4"],
        "viewId": "autocomplete-ops:view:point-2"
      }
    ],
    "views": [
      {
        "id": "autocomplete-ops:view:point-1",
        "title": "Protect private searches and suppress unsafe terms",
        "description": "Raw searches can reveal personal information. Minimize collection, limit retention and access, and remove sensitive or abusive terms before public ranking. A fast denylist can suppress an unsafe suggestion now, while aggregate and future snapshot correction prevents its return. Resist manipulation with rate limits, abuse signals, and anomaly review; popularity is not proof of legitimacy.",
        "members": ["autocomplete-ops:node:0", "autocomplete-ops:node:1", "autocomplete-ops:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "autocomplete-ops:view:point-2",
        "title": "Observe latency, freshness, and policy effects",
        "description": "Monitor keystroke latency, API p95/p99, empty-result rate, cache hit rate, shard skew, build age, stream lag, and policy-block hits. Trace snapshot version from aggregate to response. Test stale-snapshot fallback, shard failure, cache stampede, and rollback. If suggestions fail, full search submission should still work.",
        "members": ["autocomplete-ops:node:3", "autocomplete-ops:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "autocomplete-ops:predict:acq22",
        "title": "Predict the design consequence",
        "prompt": "An unsafe public suggestion needs immediate removal. What is the full response?",
        "options": ["Hide it in CSS", "Suppress it now and exclude it from future builds", "Wait for next build", "Delete all search records"],
        "correctIndex": 1,
        "explanation": "Fast filtering handles current responses; source cleanup prevents reappearance.",
        "reveal": {
          "id": "autocomplete-ops:reveal:acq22",
          "title": "Why this choice follows",
          "description": "Fast filtering handles current responses; source cleanup prevents reappearance.",
          "nodeIds": ["autocomplete-ops:node:0", "autocomplete-ops:node:1", "autocomplete-ops:node:2"],
          "linkIds": ["autocomplete-ops:relation:0", "autocomplete-ops:relation:1"]
        }
      }
    ]
  }
};
