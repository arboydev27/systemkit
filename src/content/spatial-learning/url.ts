import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const urlTeachingContent: Record<string, TeachingContent> = {
  "url-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "url-scope:node:0": {"lane": 0, "order": 1, "semanticId": "creator"},
      "url-scope:node:1": {"lane": 1, "order": 1, "semanticId": "shortener"},
      "url-scope:node:2": {"lane": 2, "order": 1, "semanticId": "mapping"},
      "url-scope:node:3": {"lane": 0, "order": 3, "semanticId": "visitor"},
      "url-scope:node:4": {"lane": 1, "order": 3, "semanticId": "redirect-service"},
      "url-scope:node:5": {"lane": 2, "order": 3, "semanticId": "destination"}
    },
    "relationships": {
      "url-scope:relation:0": {"meaning": "connection", "condition": "", "explanation": "Creator → Shortener: create. creates a new key."},
      "url-scope:relation:1": {"meaning": "write", "condition": "", "explanation": "Shortener → Mapping: persist. key → destination."},
      "url-scope:relation:2": {"meaning": "request", "condition": "", "explanation": "Visitor → Redirect service: open. resolves the key."},
      "url-scope:relation:3": {"meaning": "connection", "condition": "", "explanation": "Redirect service → Destination: redirect. receives the visitor."},
      "url-scope:relation:4": {"meaning": "read", "condition": "", "explanation": "Mapping → Redirect service: read mapping. resolves the key."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "url-scope:explain:1",
        "title": "Define creation and redirect promises",
        "description": "A shortener has two core actions: accept a long URL and return a short link, then resolve that link to the original destination. Agree on allowed schemes, link lifetime, whether a destination can change, custom aliases, and whether click analytics matters. These choices affect storage, redirects, and abuse controls.",
        "nodeIds": ["url-scope:node:0", "url-scope:node:1", "url-scope:node:3", "url-scope:node:4", "url-scope:node:5"],
        "linkIds": ["url-scope:relation:0", "url-scope:relation:2", "url-scope:relation:3"],
        "viewId": "url-scope:view:point-1"
      },
      {
        "id": "url-scope:explain:2",
        "title": "Size creation and read demand separately",
        "description": "Suppose the service creates 100 million links each day and each is opened ten times. Average creation traffic is about 1,160 writes per second; redirects average about 11,600 reads per second. Peaks need separate headroom. Ten years yields about 365 billion mappings. At 100 bytes of destination text each, that is about 36.5 TB of raw URL text, before identifiers, indexes, metadata, replicas, and overhead.",
        "nodeIds": ["url-scope:node:1", "url-scope:node:2", "url-scope:node:3", "url-scope:node:4", "url-scope:node:5"],
        "linkIds": ["url-scope:relation:1", "url-scope:relation:2", "url-scope:relation:3", "url-scope:relation:4"],
        "viewId": "url-scope:view:point-2"
      }
    ],
    "views": [
      {
        "id": "url-scope:view:point-1",
        "title": "Define creation and redirect promises",
        "description": "A shortener has two core actions: accept a long URL and return a short link, then resolve that link to the original destination. Agree on allowed schemes, link lifetime, whether a destination can change, custom aliases, and whether click analytics matters. These choices affect storage, redirects, and abuse controls.",
        "members": ["url-scope:node:0", "url-scope:node:1", "url-scope:node:3", "url-scope:node:4", "url-scope:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "url-scope:view:point-2",
        "title": "Size creation and read demand separately",
        "description": "Suppose the service creates 100 million links each day and each is opened ten times. Average creation traffic is about 1,160 writes per second; redirects average about 11,600 reads per second. Peaks need separate headroom. Ten years yields about 365 billion mappings. At 100 bytes of destination text each, that is about 36.5 TB of raw URL text, before identifiers, indexes, metadata, replicas, and overhead.",
        "members": ["url-scope:node:1", "url-scope:node:2", "url-scope:node:3", "url-scope:node:4", "url-scope:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "url-scope:predict:missing-mapping",
        "title": "Predict the durable dependency",
        "prompt": "Shortener returned a new key, but Mapping was never stored. Which later user action is broken?",
        "options": ["Visitor opening the key through Redirect service", "DNS resolving a video edge", "A worker acknowledging a queue job"],
        "correctIndex": 0,
        "explanation": "The creation path must persist Mapping. Redirect service later reads that same durable key-to-destination record; a returned key without it cannot fulfill the redirect promise.",
        "reveal": {
          "id": "url-scope:reveal:missing-mapping",
          "title": "Predict the durable dependency",
          "description": "The creation path must persist Mapping. Redirect service later reads that same durable key-to-destination record; a returned key without it cannot fulfill the redirect promise.",
          "nodeIds": ["url-scope:node:1", "url-scope:node:2", "url-scope:node:3", "url-scope:node:4"],
          "linkIds": ["url-scope:relation:1", "url-scope:relation:2", "url-scope:relation:4"]
        }
      }
    ]
  },
  "url-contract": {
    "layout": "tiers",
    "nodeRoles": {
      "url-contract:node:0": {"lane": 0, "order": 1, "semanticId": "post-links"},
      "url-contract:node:1": {"lane": 1, "order": 1, "semanticId": "validate-assign"},
      "url-contract:node:2": {"lane": 2, "order": 1, "semanticId": "unique-record"},
      "url-contract:node:3": {"lane": 0, "order": 3, "semanticId": "get-key"},
      "url-contract:node:4": {"lane": 1, "order": 3, "semanticId": "find-mapping"},
      "url-contract:node:5": {"lane": 2, "order": 3, "semanticId": "location-header"}
    },
    "relationships": {
      "url-contract:relation:0": {"meaning": "connection", "condition": "", "explanation": "POST /links (destination URL) leads to Validate + assign (scheme · key · policy) in this lesson. Persist before acknowledging creation so a returned link resolves."},
      "url-contract:relation:1": {"meaning": "write", "condition": "", "explanation": "Validate + assign → Unique record: store first. atomic insert."},
      "url-contract:relation:2": {"meaning": "connection", "condition": "", "explanation": "GET /{key} (visitor request) leads to Find mapping (key lookup) in this lesson. Persist before acknowledging creation so a returned link resolves."},
      "url-contract:relation:3": {"meaning": "connection", "condition": "", "explanation": "Find mapping → Location header: respond. redirect response."},
      "url-contract:relation:4": {"meaning": "read", "condition": "", "explanation": "Unique record → Find mapping: look up. key lookup."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "url-contract:explain:1",
        "title": "Persist before acknowledging creation",
        "description": "A client can POST a destination URL to create a link. The service validates it, assigns a unique key, persists a record, then returns the complete short URL. A request to GET /{key} looks up that record and responds with an HTTP Location header. Store the key, destination, creation time, and optional expiry; enforce a unique index on the key.",
        "nodeIds": ["url-contract:node:0", "url-contract:node:1", "url-contract:node:2", "url-contract:node:3", "url-contract:node:5"],
        "linkIds": ["url-contract:relation:0", "url-contract:relation:1"],
        "viewId": "url-contract:view:point-1"
      },
      {
        "id": "url-contract:explain:2",
        "title": "Choose duplicate and key policies",
        "description": "Choose an explicit duplicate policy. Reusing a key for the same destination can reduce storage, but distinct owners, expiry dates, and analytics often require distinct records. For retry safety, a caller-provided idempotency key can return the same creation result after a network timeout without forcing global destination deduplication.",
        "nodeIds": ["url-contract:node:0", "url-contract:node:1", "url-contract:node:2", "url-contract:node:3", "url-contract:node:4"],
        "linkIds": ["url-contract:relation:0", "url-contract:relation:1", "url-contract:relation:2", "url-contract:relation:4"],
        "viewId": "url-contract:view:point-2"
      }
    ],
    "views": [
      {
        "id": "url-contract:view:point-1",
        "title": "Persist before acknowledging creation",
        "description": "A client can POST a destination URL to create a link. The service validates it, assigns a unique key, persists a record, then returns the complete short URL. A request to GET /{key} looks up that record and responds with an HTTP Location header. Store the key, destination, creation time, and optional expiry; enforce a unique index on the key.",
        "members": ["url-contract:node:0", "url-contract:node:1", "url-contract:node:2", "url-contract:node:3", "url-contract:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "url-contract:view:point-2",
        "title": "Choose duplicate and key policies",
        "description": "Choose an explicit duplicate policy. Reusing a key for the same destination can reduce storage, but distinct owners, expiry dates, and analytics often require distinct records. For retry safety, a caller-provided idempotency key can return the same creation result after a network timeout without forcing global destination deduplication.",
        "members": ["url-contract:node:0", "url-contract:node:1", "url-contract:node:2", "url-contract:node:3", "url-contract:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "url-contract:predict:uq04",
        "title": "Predict the design consequence",
        "prompt": "What must happen before a creation API acknowledges a new short link?",
        "options": ["The first redirect must occur", "Click analytics must be aggregated", "The link must be posted to social media", "The mapping must be durably stored"],
        "correctIndex": 3,
        "explanation": "A returned link promises future resolution. Persist its mapping before claiming creation succeeded.",
        "reveal": {
          "id": "url-contract:reveal:uq04",
          "title": "Why this choice follows",
          "description": "A returned link promises future resolution. Persist its mapping before claiming creation succeeded.",
          "nodeIds": ["url-contract:node:1", "url-contract:node:2", "url-contract:node:4"],
          "linkIds": ["url-contract:relation:1", "url-contract:relation:4"]
        }
      }
    ]
  },
  "url-redirect": {
    "layout": "tiers",
    "nodeRoles": {
      "url-redirect:node:0": {"lane": 0, "order": 2, "semanticId": "visitor"},
      "url-redirect:node:1": {"lane": 1, "order": 2, "semanticId": "lookup"},
      "url-redirect:node:2": {"lane": 2, "order": 2, "semanticId": "expiry-check"},
      "url-redirect:node:3": {"lane": 3, "order": 1, "semanticId": "redirect"},
      "url-redirect:node:4": {"lane": 3, "order": 3, "semanticId": "error"}
    },
    "relationships": {
      "url-redirect:relation:0": {"meaning": "connection", "condition": "", "explanation": "Visitor (GET /{key}) leads to Lookup (load key record) in this lesson. 301 and 302 are product and caching decisions, not just performance switches."},
      "url-redirect:relation:1": {"meaning": "connection", "condition": "", "explanation": "Lookup (load key record) leads to Expiry check (active or expired?) in this lesson. 301 and 302 are product and caching decisions, not just performance switches."},
      "url-redirect:relation:2": {"meaning": "decision", "condition": "When the key exists and has not expired.", "explanation": "Expiry check → Redirect: active. Location header."},
      "url-redirect:relation:3": {"meaning": "decision", "condition": "On the authored cache-miss branch.", "explanation": "Expiry check → Error: missing / expired. 404 or 410."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "url-redirect:explain:1",
        "title": "Choose redirect and client caching semantics",
        "description": "For a valid key, respond with a redirect and a Location header pointing to the saved destination. A 301 expresses a permanent move and can be reused by browsers or intermediaries, reducing service traffic. A 302 expresses a temporary move and is usually preferable when the service should observe later clicks or the destination may change. Cache headers and client behavior still matter; neither status alone guarantees an exact analytics count.",
        "nodeIds": ["url-redirect:node:0", "url-redirect:node:1", "url-redirect:node:3"],
        "linkIds": ["url-redirect:relation:0"],
        "viewId": "url-redirect:view:point-1"
      },
      {
        "id": "url-redirect:explain:2",
        "title": "Check expiry before redirecting",
        "description": "Check expiry before redirecting. An unknown key can return 404; a known, deliberately expired link may return 410. Never redirect an expired link to an old destination. If deletion or editing is out of scope, say so; otherwise define how caches and browser-stored redirects are invalidated or allowed to age out.",
        "nodeIds": ["url-redirect:node:0", "url-redirect:node:1", "url-redirect:node:2", "url-redirect:node:3", "url-redirect:node:4"],
        "linkIds": ["url-redirect:relation:0", "url-redirect:relation:1", "url-redirect:relation:2", "url-redirect:relation:3"]
      }
    ],
    "views": [
      {
        "id": "url-redirect:view:point-1",
        "title": "Choose redirect and client caching semantics",
        "description": "For a valid key, respond with a redirect and a Location header pointing to the saved destination. A 301 expresses a permanent move and can be reused by browsers or intermediaries, reducing service traffic. A 302 expresses a temporary move and is usually preferable when the service should observe later clicks or the destination may change. Cache headers and client behavior still matter; neither status alone guarantees an exact analytics count.",
        "members": ["url-redirect:node:0", "url-redirect:node:1", "url-redirect:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "url-redirect:predict:expired-key",
        "title": "Predict an expired key",
        "prompt": "Expiry check finds that this key has expired. Which existing outcome should be selected?",
        "options": ["Error with the defined 404 or 410 behavior", "Redirect to a guessed destination", "Create a new mapping silently"],
        "correctIndex": 0,
        "explanation": "The missing / expired relation terminates at Error. The active relation to Redirect applies only to an existing unexpired key.",
        "reveal": {
          "id": "url-redirect:reveal:expired-key",
          "title": "Predict an expired key",
          "description": "The missing / expired relation terminates at Error. The active relation to Redirect applies only to an existing unexpired key.",
          "nodeIds": ["url-redirect:node:1", "url-redirect:node:2", "url-redirect:node:3", "url-redirect:node:4"],
          "linkIds": ["url-redirect:relation:1", "url-redirect:relation:3"]
        }
      }
    ]
  },
  "url-keys": {
    "layout": "tiers",
    "nodeRoles": {
      "url-keys:node:0": {"lane": 0, "order": 2, "semanticId": "new-link"},
      "url-keys:node:1": {"lane": 1, "order": 2, "semanticId": "generate-key"},
      "url-keys:node:2": {"lane": 2, "order": 2, "semanticId": "unique-insert"},
      "url-keys:node:3": {"lane": 3, "order": 1, "semanticId": "accepted"},
      "url-keys:node:4": {"lane": 3, "order": 3, "semanticId": "collision"}
    },
    "relationships": {
      "url-keys:relation:0": {"meaning": "connection", "condition": "", "explanation": "New link (validated destination) leads to Generate key (ID→base62 or random) in this lesson. Estimate key-space from lifetime creations, not daily traffic alone."},
      "url-keys:relation:1": {"meaning": "connection", "condition": "", "explanation": "Generate key (ID→base62 or random) leads to Unique insert (database constraint) in this lesson. Estimate key-space from lifetime creations, not daily traffic alone."},
      "url-keys:relation:2": {"meaning": "connection", "condition": "When the unique insertion succeeds.", "explanation": "Unique insert → Accepted: success. return link."},
      "url-keys:relation:3": {"meaning": "decision", "condition": "When the atomic unique insertion detects a collision.", "explanation": "Unique insert → Collision: conflict. try a new key."},
      "url-keys:relation:4": {"meaning": "decision", "condition": "After an insertion collision, with a new candidate key.", "explanation": "Collision → Generate key: retry. ID→base62 or random."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "url-keys:explain:1",
        "title": "Budget the lifetime key space",
        "description": "Base62 uses digits and uppercase and lowercase letters. Six characters provide about 56.8 billion combinations; seven provide about 3.52 trillion, enough for the example’s 365 billion mappings before reservations and uneven allocation. A unique integer encoded in base62 is compact and collision-free when the ID allocator is truly unique. It also exposes a guessable sequence unless keys are obfuscated or access policy accepts enumeration.",
        "nodeIds": ["url-keys:node:1", "url-keys:node:2", "url-keys:node:4"],
        "linkIds": ["url-keys:relation:1", "url-keys:relation:3", "url-keys:relation:4"],
        "viewId": "url-keys:view:point-1"
      },
      {
        "id": "url-keys:explain:2",
        "title": "Let atomic insertion detect collisions",
        "description": "A random key hides ordering but needs collision detection. Generate a candidate, insert with a unique constraint, and retry on conflict. Truncating a hash of the destination also creates collision risk and couples identity to URL normalization; merely checking for an existing key before insertion is not safe under concurrent writers. Custom aliases need the same atomic uniqueness guarantee.",
        "nodeIds": ["url-keys:node:0", "url-keys:node:1", "url-keys:node:2", "url-keys:node:4"],
        "linkIds": ["url-keys:relation:0", "url-keys:relation:1", "url-keys:relation:3", "url-keys:relation:4"],
        "viewId": "url-keys:view:point-2"
      }
    ],
    "views": [
      {
        "id": "url-keys:view:point-1",
        "title": "Budget the lifetime key space",
        "description": "Base62 uses digits and uppercase and lowercase letters. Six characters provide about 56.8 billion combinations; seven provide about 3.52 trillion, enough for the example’s 365 billion mappings before reservations and uneven allocation. A unique integer encoded in base62 is compact and collision-free when the ID allocator is truly unique. It also exposes a guessable sequence unless keys are obfuscated or access policy accepts enumeration.",
        "members": ["url-keys:node:1", "url-keys:node:2", "url-keys:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "url-keys:view:point-2",
        "title": "Let atomic insertion detect collisions",
        "description": "A random key hides ordering but needs collision detection. Generate a candidate, insert with a unique constraint, and retry on conflict. Truncating a hash of the destination also creates collision risk and couples identity to URL normalization; merely checking for an existing key before insertion is not safe under concurrent writers. Custom aliases need the same atomic uniqueness guarantee.",
        "members": ["url-keys:node:0", "url-keys:node:1", "url-keys:node:2", "url-keys:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "url-keys:predict:insertion-collision",
        "title": "Predict a collision",
        "prompt": "Unique insert reports that a generated key already exists. Which displayed branch preserves uniqueness?",
        "options": ["Collision, then retry Generate key", "Accepted despite the conflict", "Delete the previous destination"],
        "correctIndex": 0,
        "explanation": "The atomic Unique insert → Collision branch rejects reuse, then the retry relation returns to Generate key with a new candidate.",
        "reveal": {
          "id": "url-keys:reveal:insertion-collision",
          "title": "Predict a collision",
          "description": "The atomic Unique insert → Collision branch rejects reuse, then the retry relation returns to Generate key with a new candidate.",
          "nodeIds": ["url-keys:node:1", "url-keys:node:2", "url-keys:node:3", "url-keys:node:4"],
          "linkIds": ["url-keys:relation:3", "url-keys:relation:4"]
        }
      }
    ]
  },
  "url-scale": {
    "layout": "tiers",
    "nodeRoles": {
      "url-scale:node:0": {"lane": 0, "order": 2, "semanticId": "visitor"},
      "url-scale:node:1": {"lane": 1, "order": 2, "semanticId": "redirect-tier"},
      "url-scale:node:2": {"lane": 2, "order": 1, "semanticId": "mapping-cache"},
      "url-scale:node:3": {"lane": 2, "order": 4, "semanticId": "database"},
      "url-scale:node:4": {"lane": 3, "order": 2, "semanticId": "destination"}
    },
    "relationships": {
      "url-scale:relation:0": {"meaning": "connection", "condition": "", "explanation": "Visitor (opens short link) leads to Redirect tier (stateless servers) in this lesson. Cache mappings for read speed while the database remains durable authority."},
      "url-scale:relation:1": {"meaning": "write", "condition": "", "explanation": "Redirect tier → Mapping cache: read / fill. hot keys."},
      "url-scale:relation:2": {"meaning": "response", "condition": "On the authored cache-hit branch.", "explanation": "Mapping cache → Redirect tier: hit. stateless servers."},
      "url-scale:relation:3": {"meaning": "decision", "condition": "On the authored cache-miss branch.", "explanation": "Redirect tier → Database: miss. durable mapping."},
      "url-scale:relation:4": {"meaning": "read", "condition": "", "explanation": "Database → Redirect tier: read. stateless servers."},
      "url-scale:relation:5": {"meaning": "connection", "condition": "", "explanation": "Redirect tier → Destination: redirect. Location: URL."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "url-scale:explain:1",
        "title": "Keep redirect servers and cache replaceable",
        "description": "Place stateless redirect servers behind a load balancer. On a cache hit they read the key-to-destination mapping and return the redirect. On a miss they query persistent storage, fill the cache, and respond. A missing key should not be cached forever because a future creation or recovery may change the answer.",
        "nodeIds": ["url-scale:node:1", "url-scale:node:2", "url-scale:node:3", "url-scale:node:4"],
        "linkIds": ["url-scale:relation:1", "url-scale:relation:2", "url-scale:relation:3", "url-scale:relation:4", "url-scale:relation:5"],
        "viewId": "url-scale:view:point-1"
      },
      {
        "id": "url-scale:explain:2",
        "title": "Plan skew and read freshness",
        "description": "Popular links create skew: a small set may receive most reads. Measure cache hit rate, database lookup latency, and redirect traffic before adding replicas or partitioning by key. Replicas can expand reads but may lag a new write; a just-created link should resolve reliably through the chosen consistency path. Sharding becomes useful when storage or write demand exceeds one database tier, not merely because traffic sounds large.",
        "nodeIds": ["url-scale:node:0", "url-scale:node:1", "url-scale:node:2", "url-scale:node:3"],
        "linkIds": ["url-scale:relation:0", "url-scale:relation:1", "url-scale:relation:2", "url-scale:relation:3", "url-scale:relation:4"],
        "viewId": "url-scale:view:point-2"
      }
    ],
    "views": [
      {
        "id": "url-scale:view:point-1",
        "title": "Keep redirect servers and cache replaceable",
        "description": "Place stateless redirect servers behind a load balancer. On a cache hit they read the key-to-destination mapping and return the redirect. On a miss they query persistent storage, fill the cache, and respond. A missing key should not be cached forever because a future creation or recovery may change the answer.",
        "members": ["url-scale:node:1", "url-scale:node:2", "url-scale:node:3", "url-scale:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "url-scale:view:point-2",
        "title": "Plan skew and read freshness",
        "description": "Popular links create skew: a small set may receive most reads. Measure cache hit rate, database lookup latency, and redirect traffic before adding replicas or partitioning by key. Replicas can expand reads but may lag a new write; a just-created link should resolve reliably through the chosen consistency path. Sharding becomes useful when storage or write demand exceeds one database tier, not merely because traffic sounds large.",
        "members": ["url-scale:node:0", "url-scale:node:1", "url-scale:node:2", "url-scale:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "url-scale:predict:cache-miss",
        "title": "Predict the authoritative miss path",
        "prompt": "Mapping cache has no destination for the requested key. Which dependency supplies the authoritative mapping?",
        "options": ["Database", "Destination as a key database", "An unshown read replica"],
        "correctIndex": 0,
        "explanation": "Redirect tier follows its miss relation to Database. The returned mapping may fill cache, while persistent storage retains authority.",
        "reveal": {
          "id": "url-scale:reveal:cache-miss",
          "title": "Predict the authoritative miss path",
          "description": "Redirect tier follows its miss relation to Database. The returned mapping may fill cache, while persistent storage retains authority.",
          "nodeIds": ["url-scale:node:1", "url-scale:node:2", "url-scale:node:3"],
          "linkIds": ["url-scale:relation:3", "url-scale:relation:4"]
        }
      }
    ]
  },
  "url-operations": {
    "layout": "tiers",
    "nodeRoles": {
      "url-operations:node:0": {"lane": 0, "order": 1, "semanticId": "creation"},
      "url-operations:node:1": {"lane": 1, "order": 1, "semanticId": "guardrails"},
      "url-operations:node:2": {"lane": 2, "order": 1, "semanticId": "durable-store"},
      "url-operations:node:3": {"lane": 0, "order": 3, "semanticId": "visitor"},
      "url-operations:node:4": {"lane": 1, "order": 3, "semanticId": "redirect-tier"},
      "url-operations:node:5": {"lane": 2, "order": 3, "semanticId": "analytics-queue"},
      "url-operations:node:6": {"lane": 3, "order": 3, "semanticId": "destination"}
    },
    "relationships": {
      "url-operations:relation:0": {"meaning": "connection", "condition": "", "explanation": "Creation (new destination) leads to Guardrails (validate · rate limit) in this lesson. Separate durability of new links from availability of cached redirects."},
      "url-operations:relation:1": {"meaning": "connection", "condition": "", "explanation": "Guardrails (validate · rate limit) leads to Durable store (confirm write) in this lesson. Separate durability of new links from availability of cached redirects."},
      "url-operations:relation:2": {"meaning": "connection", "condition": "", "explanation": "Visitor (open existing link) leads to Redirect tier (serve mapping) in this lesson. Separate durability of new links from availability of cached redirects."},
      "url-operations:relation:3": {"meaning": "connection", "condition": "", "explanation": "Redirect tier → Analytics queue: event. best-effort event."},
      "url-operations:relation:4": {"meaning": "connection", "condition": "", "explanation": "Redirect tier → Destination: redirect. visit continues."},
      "url-operations:relation:5": {"meaning": "read", "condition": "", "explanation": "Durable store → Redirect tier: lookup. serve mapping."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "url-operations:explain:1",
        "title": "Protect durability during dependency failure",
        "description": "If a cache node fails, redirect servers fall back to the database, so protect it with capacity and controlled retry behavior. If durable storage is unavailable, existing hot keys may still redirect from cache for a limited time, but creation should not claim success until its mapping is durable. Monitor error rate, redirect latency, cache hit rate, database pressure, and key-generation conflicts.",
        "nodeIds": ["url-operations:node:0", "url-operations:node:1", "url-operations:node:2", "url-operations:node:3", "url-operations:node:4"],
        "linkIds": ["url-operations:relation:0", "url-operations:relation:1", "url-operations:relation:2", "url-operations:relation:5"],
        "viewId": "url-operations:view:point-1"
      },
      {
        "id": "url-operations:explain:2",
        "title": "Validate destinations and control misuse",
        "description": "Validate destination schemes such as http and https and reject unsafe schemes. Rate-limit creation, and have a policy for spam, phishing, and malicious destinations. Do not fetch submitted URLs from privileged infrastructure without SSRF defenses. If click analytics is needed, publish an event asynchronously; a failed analytics sink should not usually hold up the redirect.",
        "nodeIds": ["url-operations:node:0", "url-operations:node:1", "url-operations:node:4", "url-operations:node:5", "url-operations:node:6"],
        "linkIds": ["url-operations:relation:0", "url-operations:relation:3", "url-operations:relation:4"],
        "viewId": "url-operations:view:point-2"
      }
    ],
    "views": [
      {
        "id": "url-operations:view:point-1",
        "title": "Protect durability during dependency failure",
        "description": "If a cache node fails, redirect servers fall back to the database, so protect it with capacity and controlled retry behavior. If durable storage is unavailable, existing hot keys may still redirect from cache for a limited time, but creation should not claim success until its mapping is durable. Monitor error rate, redirect latency, cache hit rate, database pressure, and key-generation conflicts.",
        "members": ["url-operations:node:0", "url-operations:node:1", "url-operations:node:2", "url-operations:node:3", "url-operations:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "url-operations:view:point-2",
        "title": "Validate destinations and control misuse",
        "description": "Validate destination schemes such as http and https and reject unsafe schemes. Rate-limit creation, and have a policy for spam, phishing, and malicious destinations. Do not fetch submitted URLs from privileged infrastructure without SSRF defenses. If click analytics is needed, publish an event asynchronously; a failed analytics sink should not usually hold up the redirect.",
        "members": ["url-operations:node:0", "url-operations:node:1", "url-operations:node:4", "url-operations:node:5", "url-operations:node:6"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "url-operations:predict:uq16",
        "title": "Predict the design consequence",
        "prompt": "Persistent storage is unavailable. Which action must not claim success?",
        "options": ["Creating a new link without a durable mapping", "Serving a cached valid redirect within policy", "Reporting a storage alert", "Measuring cache hit rate"],
        "correctIndex": 0,
        "explanation": "A new link is unusable if its mapping can be lost. Cached existing redirects may continue temporarily, but creation needs durable persistence.",
        "reveal": {
          "id": "url-operations:reveal:uq16",
          "title": "Why this choice follows",
          "description": "A new link is unusable if its mapping can be lost. Cached existing redirects may continue temporarily, but creation needs durable persistence.",
          "nodeIds": ["url-operations:node:0", "url-operations:node:1", "url-operations:node:2"],
          "linkIds": ["url-operations:relation:0", "url-operations:relation:1"],
          "statuses": {
            "url-operations:node:2": "unavailable"
          }
        }
      }
    ]
  }
};
