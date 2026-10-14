import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const scalingTeachingContent: Record<string, TeachingContent> = {
  "single-server": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "dns": {"lane": 1, "order": 2, "semanticId": "dns"},
      "server": {"lane": 2, "order": 2, "semanticId": "application"}
    },
    "relationships": {
      "single-server:relation:0": {"meaning": "request", "condition": "Before HTTP can be sent to the domain.", "explanation": "The browser asks DNS to resolve the entered domain."},
      "single-server:relation:1": {"meaning": "response", "condition": "When DNS resolution succeeds.", "explanation": "DNS returns an IP address to the browser."},
      "single-server:relation:2": {"meaning": "request", "condition": "After the browser has an IP address.", "explanation": "The browser sends an HTTP request to the application server."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "single-server:resolve",
        "title": "Resolve the domain first",
        "description": "DNS supplies an IP address; it does not supply the page. The browser uses that address for the next request.",
        "nodeIds": ["visitor", "dns"],
        "linkIds": ["single-server:relation:0", "single-server:relation:1"]
      },
      {
        "id": "single-server:request",
        "title": "Send HTTP to the application",
        "description": "After resolution, the visitor contacts the one server, which holds the web application and database in this initial design.",
        "nodeIds": ["visitor", "server"],
        "linkIds": ["single-server:relation:2"]
      },
      {
        "id": "single-server:evidence",
        "title": "Keep the first architecture small",
        "description": "The direct request path is a baseline. Find the failing or slow responsibility before adding another tier.",
        "nodeIds": ["visitor", "server"],
        "linkIds": ["single-server:relation:2"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "single-server:predict:dns-result",
        "title": "Predict the next step",
        "prompt": "DNS has returned the address. Which displayed path happens next?",
        "options": ["The visitor sends HTTP to One server", "DNS queries the database", "The server is automatically replicated"],
        "correctIndex": 0,
        "explanation": "The returned IP identifies the server. The HTTP request now crosses the Visitor → One server relation.",
        "reveal": {
          "id": "single-server:reveal:dns-result",
          "title": "Predict the next step",
          "description": "The returned IP identifies the server. The HTTP request now crosses the Visitor → One server relation.",
          "nodeIds": ["visitor", "dns", "server"],
          "linkIds": ["single-server:relation:1", "single-server:relation:2"]
        }
      }
    ]
  },
  "split-tiers": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "web": {"lane": 2, "order": 2, "semanticId": "application"},
      "db": {"lane": 3, "order": 3, "semanticId": "database"}
    },
    "relationships": {
      "split-tiers:relation:0": {"meaning": "request", "condition": "For a browser action.", "explanation": "The visitor sends HTTP to the web application."},
      "split-tiers:relation:1": {"meaning": "read", "condition": "When the application needs persistent records.", "explanation": "The web server reads from the separate database."},
      "split-tiers:relation:2": {"meaning": "write", "condition": "When the application creates or changes records.", "explanation": "The web server writes persistent state to the database."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "split-tiers:separate",
        "title": "Separate two responsibilities",
        "description": "The web server handles the public HTTP request; persistent reads and writes cross a separate database boundary.",
        "nodeIds": ["visitor", "web", "db"],
        "linkIds": ["split-tiers:relation:0", "split-tiers:relation:1", "split-tiers:relation:2"]
      },
      {
        "id": "split-tiers:independent",
        "title": "Resize the tier that needs resources",
        "description": "Moving the database to its own machine allows web and database resources to grow according to their own load. It does not remove database failures.",
        "nodeIds": ["web", "db"],
        "linkIds": ["split-tiers:relation:1", "split-tiers:relation:2"]
      }
    ],
    "views": [
      {
        "id": "split-tiers:view:data-path",
        "title": "Web and persistent data",
        "description": "Inspect both authored read and write relations across the tier boundary.",
        "members": ["web", "db"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "split-tiers:predict:web-growth",
        "title": "Predict the resource change",
        "prompt": "Web application CPU is the bottleneck while database capacity is sufficient. What does separating the tiers permit?",
        "options": ["Grow web resources independently", "Every query moves to a CDN", "Remove persistent storage"],
        "correctIndex": 0,
        "explanation": "The Web server and Database are separate responsibilities. Web capacity can change without resizing the database.",
        "reveal": {
          "id": "split-tiers:reveal:web-growth",
          "title": "Predict the resource change",
          "description": "The Web server and Database are separate responsibilities. Web capacity can change without resizing the database.",
          "nodeIds": ["web", "db"],
          "linkIds": ["split-tiers:relation:1", "split-tiers:relation:2"],
          "statuses": {
            "web": "under-pressure",
            "db": "active"
          }
        }
      }
    ]
  },
  "scale-web": {
    "layout": "tiers",
    "nodeRoles": {
      "visitors": {"lane": 0, "order": 2, "semanticId": "client"},
      "balancer": {"lane": 1, "order": 2, "semanticId": "load-balancer"},
      "web-a": {"lane": 2, "order": 1, "semanticId": "application-a"},
      "web-b": {"lane": 2, "order": 3, "semanticId": "application-b"},
      "db": {"lane": 3, "order": 3, "semanticId": "database"}
    },
    "relationships": {
      "scale-web:relation:0": {"meaning": "request", "condition": "For requests routed to a healthy registered instance.", "explanation": "Visitors send public requests to the load balancer."},
      "scale-web:relation:1": {"meaning": "request", "condition": "For requests routed to a healthy registered instance.", "explanation": "The load balancer forwards public requests to healthy application instances."},
      "scale-web:relation:2": {"meaning": "request", "condition": "For requests routed to a healthy registered instance.", "explanation": "The load balancer forwards public requests to healthy application instances."},
      "scale-web:relation:3": {"meaning": "connection", "condition": "When an application instance needs durable data.", "explanation": "Both web instances share this database; adding web instances does not replicate the database."},
      "scale-web:relation:4": {"meaning": "connection", "condition": "When an application instance needs durable data.", "explanation": "Both web instances share this database; adding web instances does not replicate the database."}
    },
    "groups": [
      {
        "id": "scale-web:web-pool",
        "title": "Web pool",
        "description": "Independent application instances share the application responsibility.",
        "members": ["web-a", "web-b"]
      }
    ],
    "scenes": [
      {
        "id": "scale-web:pool",
        "title": "Add a pool behind a balancer",
        "description": "The balancer chooses healthy web instances. Adding machines is horizontal scaling; upgrading one machine is vertical scaling.",
        "nodeIds": ["visitors", "balancer", "web-a", "web-b"],
        "linkIds": ["scale-web:relation:0", "scale-web:relation:1", "scale-web:relation:2"]
      },
      {
        "id": "scale-web:shared-data",
        "title": "Keep the data responsibility visible",
        "description": "Both application instances still reach the shared database. More web capacity does not automatically add database capacity.",
        "nodeIds": ["web-a", "web-b", "db"],
        "linkIds": ["scale-web:relation:3", "scale-web:relation:4"]
      },
      {
        "id": "scale-web:instance-failure",
        "title": "Route around an unavailable instance",
        "description": "In this authored outage, Web A is unavailable and the balancer routes new requests to healthy Web B. The balancer itself still needs a resilient deployment.",
        "nodeIds": ["visitors", "balancer", "web-a", "web-b"],
        "linkIds": ["scale-web:relation:0", "scale-web:relation:2"],
        "statuses": {
          "web-a": "unavailable",
          "web-b": "active"
        }
      }
    ],
    "views": [
      {
        "id": "scale-web:view:routing",
        "title": "Healthy instance routing",
        "description": "Focus on public entry and the two existing web instances.",
        "members": ["visitors", "balancer", "web-a", "web-b"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "scale-web:predict:one-instance-down",
        "title": "Predict healthy routing",
        "prompt": "Web A is unavailable and Web B is healthy. Where should the balancer route a new request?",
        "options": ["Web B", "The unavailable Web A", "Directly into database storage"],
        "correctIndex": 0,
        "explanation": "Only the Balancer → Web B route is active in this example. Horizontal redundancy helps only while remaining components have capacity.",
        "reveal": {
          "id": "scale-web:reveal:one-instance-down",
          "title": "Predict healthy routing",
          "description": "Only the Balancer → Web B route is active in this example. Horizontal redundancy helps only while remaining components have capacity.",
          "nodeIds": ["visitors", "balancer", "web-a", "web-b"],
          "linkIds": ["scale-web:relation:0", "scale-web:relation:2"],
          "statuses": {
            "web-a": "unavailable",
            "web-b": "active"
          },
          "viewId": "scale-web:view:routing"
        }
      }
    ]
  },
  "replication": {
    "layout": "tiers",
    "nodeRoles": {
      "web": {"lane": 2, "order": 2, "semanticId": "application"},
      "primary": {"lane": 3, "order": 3, "semanticId": "primary-database"},
      "replica-a": {"lane": 4, "order": 2, "semanticId": "read-replica-a"},
      "replica-b": {"lane": 4, "order": 4, "semanticId": "read-replica-b"}
    },
    "relationships": {
      "replication:relation:0": {"meaning": "write", "condition": "While the chosen primary is available.", "explanation": "Application writes terminate at the primary."},
      "replication:relation:1": {"meaning": "read", "condition": "For a replica read; freshness can depend on replication lag.", "explanation": "The application reads a copy rather than sending a write to this replica."},
      "replication:relation:2": {"meaning": "read", "condition": "For a replica read; freshness can depend on replication lag.", "explanation": "The application reads a copy rather than sending a write to this replica."},
      "replication:relation:3": {"meaning": "replication", "condition": "After primary changes, under the selected replication strategy.", "explanation": "Changes flow from the primary to this read replica; the arrow does not promise zero lag."},
      "replication:relation:4": {"meaning": "replication", "condition": "After primary changes, under the selected replication strategy.", "explanation": "Changes flow from the primary to this read replica; the arrow does not promise zero lag."}
    },
    "groups": [
      {
        "id": "replication:database-copies",
        "title": "Database copies",
        "description": "Primary and replicas hold copies of the same database responsibility.",
        "members": ["primary", "replica-a", "replica-b"]
      }
    ],
    "scenes": [
      {
        "id": "replication:writer",
        "title": "One primary accepts writes",
        "description": "Application writes go to the primary. Read replicas copy changes; they do not share the primary write role.",
        "nodeIds": ["web", "primary"],
        "linkIds": ["replication:relation:0"]
      },
      {
        "id": "replication:copies",
        "title": "Copy changes, then use replicas for reads",
        "description": "The primary replicates toward A and B. The application can send reads to those replicas, which may lag.",
        "nodeIds": ["web", "primary", "replica-a", "replica-b"],
        "linkIds": ["replication:relation:1", "replication:relation:2", "replication:relation:3", "replication:relation:4"]
      },
      {
        "id": "replication:replica-failure",
        "title": "Move reads to a surviving copy",
        "description": "Replica A is unavailable in this example; reads can go to Replica B. A single-replica arrangement could temporarily read from the primary.",
        "nodeIds": ["web", "replica-a", "replica-b"],
        "linkIds": ["replication:relation:2"],
        "statuses": {
          "replica-a": "unavailable",
          "replica-b": "active"
        }
      },
      {
        "id": "replication:primary-failure",
        "title": "Promotion needs an explicit recovery plan",
        "description": "A primary outage does not automatically make every replica a writer. Check lag and missing or unconfirmed writes, choose a promotion, and redirect clients under a defined plan.",
        "nodeIds": ["web", "primary", "replica-a", "replica-b"],
        "linkIds": ["replication:relation:3", "replication:relation:4"],
        "statuses": {
          "primary": "unavailable"
        }
      }
    ],
    "views": [
      {
        "id": "replication:view:read-path",
        "title": "Replica read path",
        "description": "Inspect read selection apart from primary writes.",
        "members": ["web", "replica-a", "replica-b"],
        "layout": "peers"
      }
    ],
    "predictions": [
      {
        "id": "replication:predict:primary-down",
        "title": "Predict the write consequence",
        "prompt": "The primary fails and Replica B is reachable. What can this diagram safely conclude about writes?",
        "options": ["A recovery plan must choose and redirect to a promoted writer", "Replica B is automatically a safe writer with every committed write", "Both replicas immediately accept independent writes"],
        "correctIndex": 0,
        "explanation": "The authored write arrow terminates at Primary. Replica B has copies and a read role; lag and promotion policy must be resolved before redirecting writes.",
        "reveal": {
          "id": "replication:reveal:primary-down",
          "title": "Predict the write consequence",
          "description": "The authored write arrow terminates at Primary. Replica B has copies and a read role; lag and promotion policy must be resolved before redirecting writes.",
          "nodeIds": ["web", "primary", "replica-b"],
          "linkIds": ["replication:relation:0", "replication:relation:4"],
          "statuses": {
            "primary": "unavailable",
            "replica-b": "active"
          }
        }
      }
    ]
  },
  "cache": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "web": {"lane": 2, "order": 2, "semanticId": "application"},
      "cache": {"lane": 3, "order": 1, "semanticId": "application-cache"},
      "db": {"lane": 3, "order": 3, "semanticId": "database"}
    },
    "relationships": {
      "cache:relation:0": {"meaning": "request", "condition": "For an incoming user read.", "explanation": "The visitor asks the application for data."},
      "cache:relation:1": {"meaning": "read", "condition": "Before selecting the hit or miss path.", "explanation": "The application checks for a usable cached result."},
      "cache:relation:2": {"meaning": "response", "condition": "After lookup: a usable entry is a hit; absence is a miss.", "explanation": "The cache reports the lookup outcome to the application. A hit can provide the result; a miss sends the application to persistent storage."},
      "cache:relation:3": {"meaning": "read", "condition": "Only on a cache miss or deliberate outage fallback.", "explanation": "The application queries the database; this relation is not part of a normal cache hit."},
      "cache:relation:4": {"meaning": "response", "condition": "After the persistent query succeeds.", "explanation": "The database supplies the authoritative result to the application."},
      "cache:relation:5": {"meaning": "write", "condition": "After a miss fetch succeeds, under the freshness policy.", "explanation": "The application fills cache for subsequent reads."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "cache:lookup",
        "title": "Ask the cache first",
        "description": "The application receives a request and checks its cache for the result. The application owns the conditional branch.",
        "nodeIds": ["visitor", "web", "cache"],
        "linkIds": ["cache:relation:0", "cache:relation:1"]
      },
      {
        "id": "cache:hit",
        "title": "A hit avoids database work",
        "description": "When the cached result is usable, the cache returns it. This branch has no database query.",
        "nodeIds": ["web", "cache"],
        "linkIds": ["cache:relation:1", "cache:relation:2"],
        "viewId": "cache:view:hit"
      },
      {
        "id": "cache:miss",
        "title": "A miss reads persistent data",
        "description": "On a miss the application queries the database, which returns the authoritative result.",
        "nodeIds": ["web", "cache", "db"],
        "linkIds": ["cache:relation:2", "cache:relation:3", "cache:relation:4"],
        "viewId": "cache:view:miss"
      },
      {
        "id": "cache:populate",
        "title": "Fill after the database result",
        "description": "The application stores the fetched result in cache for later reads. The database remains persistent authority.",
        "nodeIds": ["web", "cache", "db"],
        "linkIds": ["cache:relation:4", "cache:relation:5"],
        "viewId": "cache:view:miss"
      },
      {
        "id": "cache:freshness",
        "title": "Choose how cached data becomes stale",
        "description": "Expiration, invalidation, replacement, and eviction determine whether a cached answer remains useful. A speed benefit does not establish freshness.",
        "nodeIds": ["web", "cache", "db"],
        "linkIds": ["cache:relation:1", "cache:relation:3", "cache:relation:5"]
      },
      {
        "id": "cache:outage",
        "title": "Plan the cache fallback",
        "description": "In this authored outage, the unavailable cache shifts reads toward the database. The database is marked under pressure to show the lesson’s stated burst risk, not a measured capacity result.",
        "nodeIds": ["visitor", "web", "cache", "db"],
        "linkIds": ["cache:relation:0", "cache:relation:3", "cache:relation:4"],
        "statuses": {
          "cache": "unavailable",
          "db": "under-pressure"
        }
      }
    ],
    "views": [
      {
        "id": "cache:view:hit",
        "title": "Cache hit",
        "description": "A successful cached lookup uses only the application and cache.",
        "members": ["web", "cache"],
        "linkIds": ["cache:relation:1", "cache:relation:2"],
        "layout": "pipeline"
      },
      {
        "id": "cache:view:miss",
        "title": "Cache miss and populate",
        "description": "Follow the existing database fetch and cache-fill relations.",
        "members": ["web", "cache", "db"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "cache:predict:cache-outage",
        "title": "Predict fallback pressure",
        "prompt": "The cache is unavailable and requests fall back to persistent data. Which component can receive the extra read work?",
        "options": ["Database", "DNS", "A read replica that is not in this diagram"],
        "correctIndex": 0,
        "explanation": "The fallback crosses Web tier → Database. Cached hits no longer avoid that work, so the database can face a burst of reads; fallback and spare capacity need a deliberate plan.",
        "reveal": {
          "id": "cache:reveal:cache-outage",
          "title": "Predict fallback pressure",
          "description": "The fallback crosses Web tier → Database. Cached hits no longer avoid that work, so the database can face a burst of reads; fallback and spare capacity need a deliberate plan.",
          "nodeIds": ["web", "cache", "db"],
          "linkIds": ["cache:relation:3", "cache:relation:4"],
          "statuses": {
            "cache": "unavailable",
            "db": "under-pressure"
          },
          "viewId": "cache:view:miss"
        }
      }
    ]
  },
  "cdn": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "edge": {"lane": 1, "order": 0, "semanticId": "cdn-edge"},
      "origin": {"lane": 3, "order": 3, "semanticId": "origin"}
    },
    "relationships": {
      "cdn:relation:0": {"meaning": "request", "condition": "For a reusable asset request.", "explanation": "The visitor requests media or static files from the nearby edge."},
      "cdn:relation:1": {"meaning": "response", "condition": "On an allowed cache hit.", "explanation": "The edge returns its cached asset to the visitor."},
      "cdn:relation:2": {"meaning": "read", "condition": "On a cache miss or expired copy.", "explanation": "The edge fetches the asset from origin."},
      "cdn:relation:3": {"meaning": "response", "condition": "After origin fetch succeeds and caching is permitted.", "explanation": "Origin returns the asset and the edge can populate its copy."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "cdn:edge-request",
        "title": "Request an asset at the edge",
        "description": "Reusable images, video, CSS, and JavaScript can be served from a nearby CDN copy.",
        "nodeIds": ["visitor", "edge"],
        "linkIds": ["cdn:relation:0"]
      },
      {
        "id": "cdn:edge-hit",
        "title": "A hit returns near the visitor",
        "description": "A cached asset returns from the edge without fetching origin on this branch.",
        "nodeIds": ["visitor", "edge"],
        "linkIds": ["cdn:relation:0", "cdn:relation:1"]
      },
      {
        "id": "cdn:edge-miss",
        "title": "A miss fetches and fills",
        "description": "An empty or expired edge fetches from origin, returns the asset, and can keep a copy for later requests.",
        "nodeIds": ["visitor", "edge", "origin"],
        "linkIds": ["cdn:relation:0", "cdn:relation:2", "cdn:relation:3", "cdn:relation:1"]
      },
      {
        "id": "cdn:asset-policy",
        "title": "Keep version and outage behavior explicit",
        "description": "Invalidation or a new versioned URL refreshes changed assets. CDN delivery does not automatically shorten dynamic application requests.",
        "nodeIds": ["visitor", "edge", "origin"],
        "linkIds": ["cdn:relation:0", "cdn:relation:2", "cdn:relation:3"]
      }
    ],
    "views": [
      {
        "id": "cdn:view:origin-fill",
        "title": "Origin fill",
        "description": "Inspect the cache miss independently of a cached edge hit.",
        "members": ["edge", "origin"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "cdn:predict:cold-edge",
        "title": "Predict a cold edge request",
        "prompt": "The edge has no copy of an asset. Which authored relations supply it?",
        "options": ["Edge → Origin, then Origin → Edge", "Visitor → database", "Origin disappears after the first hit"],
        "correctIndex": 0,
        "explanation": "A cache miss fetches the source asset from origin and fills the edge. A hit can then return from the edge.",
        "reveal": {
          "id": "cdn:reveal:cold-edge",
          "title": "Predict a cold edge request",
          "description": "A cache miss fetches the source asset from origin and fills the edge. A hit can then return from the edge.",
          "nodeIds": ["visitor", "edge", "origin"],
          "linkIds": ["cdn:relation:2", "cdn:relation:3", "cdn:relation:1"]
        }
      }
    ]
  },
  "stateless": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "balancer": {"lane": 1, "order": 2, "semanticId": "load-balancer"},
      "web-a": {"lane": 2, "order": 1, "semanticId": "application-a"},
      "web-b": {"lane": 2, "order": 3, "semanticId": "application-b"},
      "session": {"lane": 3, "order": 1, "semanticId": "session-store"}
    },
    "relationships": {
      "stateless:relation:0": {"meaning": "request", "condition": "For routing to a healthy web instance.", "explanation": "The request can reach either application instance; routing does not supply session durability."},
      "stateless:relation:1": {"meaning": "request", "condition": "For routing to a healthy web instance.", "explanation": "The request can reach either application instance; routing does not supply session durability."},
      "stateless:relation:2": {"meaning": "request", "condition": "For routing to a healthy web instance.", "explanation": "The request can reach either application instance; routing does not supply session durability."},
      "stateless:relation:3": {"meaning": "read", "condition": "When this application instance needs session information.", "explanation": "Session state lives in the shared store rather than only in one web process."},
      "stateless:relation:4": {"meaning": "read", "condition": "When this application instance needs session information.", "explanation": "Session state lives in the shared store rather than only in one web process."}
    },
    "groups": [
      {
        "id": "stateless:web-pool",
        "title": "Web pool",
        "description": "Replaceable application instances use the same session store.",
        "members": ["web-a", "web-b"]
      }
    ],
    "scenes": [
      {
        "id": "stateless:session-risk",
        "title": "Routing should not own login state",
        "description": "A later request may go to either web instance. A session stored only in one instance makes login depend on placement.",
        "nodeIds": ["visitor", "balancer", "web-a", "web-b"],
        "linkIds": ["stateless:relation:0", "stateless:relation:1", "stateless:relation:2"]
      },
      {
        "id": "stateless:shared-session",
        "title": "Both instances reach shared state",
        "description": "Move session information to an appropriately durable shared store. Both web instances can retrieve it.",
        "nodeIds": ["web-a", "web-b", "session"],
        "linkIds": ["stateless:relation:3", "stateless:relation:4"]
      },
      {
        "id": "stateless:replaceable",
        "title": "Replace a web instance without moving sessions",
        "description": "In this authored outage, Web A is unavailable and Web B uses shared session state. The system still has state outside the web process.",
        "nodeIds": ["balancer", "web-a", "web-b", "session"],
        "linkIds": ["stateless:relation:2", "stateless:relation:4"],
        "statuses": {
          "web-a": "unavailable",
          "web-b": "active"
        }
      }
    ],
    "views": [
      {
        "id": "stateless:view:session-access",
        "title": "Shared session access",
        "description": "Compare both application routes into shared durable session state.",
        "members": ["web-a", "web-b", "session"],
        "layout": "peers"
      }
    ],
    "predictions": [
      {
        "id": "stateless:predict:replace-web",
        "title": "Predict login after replacement",
        "prompt": "Web A is removed. Which displayed responsibility lets Web B retain the user’s login state?",
        "options": ["The shared Session store", "The removed Web A heap", "A static CDN asset"],
        "correctIndex": 0,
        "explanation": "Web B reads the shared Session store. Sessions survive web-instance replacement according to that store’s durability policy.",
        "reveal": {
          "id": "stateless:reveal:replace-web",
          "title": "Predict login after replacement",
          "description": "Web B reads the shared Session store. Sessions survive web-instance replacement according to that store’s durability policy.",
          "nodeIds": ["web-a", "web-b", "session"],
          "linkIds": ["stateless:relation:4"],
          "statuses": {
            "web-a": "unavailable",
            "web-b": "active"
          },
          "viewId": "stateless:view:session-access"
        }
      }
    ]
  },
  "multi-dc": {
    "layout": "tiers",
    "nodeRoles": {
      "visitors": {"lane": 0, "order": 2, "semanticId": "client"},
      "geodns": {"lane": 1, "order": 2, "semanticId": "geo-dns"},
      "us-web": {"lane": 2, "order": 1, "semanticId": "region-a-application"},
      "us-db": {"lane": 3, "order": 1, "semanticId": "region-a-database"},
      "eu-web": {"lane": 2, "order": 3, "semanticId": "region-b-application"},
      "eu-db": {"lane": 3, "order": 3, "semanticId": "region-b-database"}
    },
    "relationships": {
      "multi-dc:relation:0": {"meaning": "request", "condition": "For worldwide entry to the application.", "explanation": "Visitors use geo-aware resolution to find a regional entry."},
      "multi-dc:relation:1": {"meaning": "decision", "condition": "When Region A is nearby and healthy under the routing policy.", "explanation": "GeoDNS selects the Region A application route."},
      "multi-dc:relation:2": {"meaning": "decision", "condition": "When Region B is selected by locality or a tested failover policy.", "explanation": "GeoDNS can direct requests toward Region B; this does not itself recover data."},
      "multi-dc:relation:3": {"meaning": "read", "condition": "While the regional data store can serve the required read.", "explanation": "Web A reads Data A in the authored regional path."},
      "multi-dc:relation:4": {"meaning": "read", "condition": "While Region B holds the data required for the request.", "explanation": "Web B reads Data B; redirected traffic can still fail if required records are absent."},
      "multi-dc:relation:5": {"meaning": "replication", "condition": "Under an explicit A-to-B data synchronization strategy.", "explanation": "The authored arrow copies Data A toward Data B. Lag and failover guarantees depend on the chosen strategy.", "source": "us-db", "target": "eu-db"}
    },
    "groups": [
      {
        "id": "multi-dc:region-a",
        "title": "Region A",
        "description": "The authored regional application and its data store.",
        "members": ["us-web", "us-db"]
      },
      {
        "id": "multi-dc:region-b",
        "title": "Region B",
        "description": "The authored regional application and its data store.",
        "members": ["eu-web", "eu-db"]
      }
    ],
    "scenes": [
      {
        "id": "multi-dc:nearby",
        "title": "Route toward a healthy region",
        "description": "GeoDNS directs users toward a nearby healthy deployment. Routing and regional application capacity are separate from data recovery.",
        "nodeIds": ["visitors", "geodns", "us-web", "eu-web"],
        "linkIds": ["multi-dc:relation:0", "multi-dc:relation:1", "multi-dc:relation:2"]
      },
      {
        "id": "multi-dc:regional-data",
        "title": "Keep each regional data path visible",
        "description": "The authored regional applications read their corresponding stores. Data availability must be considered in both regions.",
        "nodeIds": ["us-web", "us-db", "eu-web", "eu-db"],
        "linkIds": ["multi-dc:relation:3", "multi-dc:relation:4"]
      },
      {
        "id": "multi-dc:a-to-b",
        "title": "Copy data in the authored direction",
        "description": "The diagram shows Data A → Data B synchronization. Treat A as the source of the displayed copy; this does not depict two independent concurrent writers.",
        "nodeIds": ["us-db", "eu-db"],
        "linkIds": ["multi-dc:relation:5"]
      },
      {
        "id": "multi-dc:failover",
        "title": "Healthy routing alone is insufficient",
        "description": "Region A is unavailable in this example. Requests can be routed to B only with a capacity and data recovery plan; copied data may be missing or behind. No automatic writer promotion is implied.",
        "nodeIds": ["geodns", "us-web", "us-db", "eu-web", "eu-db"],
        "linkIds": ["multi-dc:relation:2", "multi-dc:relation:4"],
        "statuses": {
          "us-web": "unavailable",
          "us-db": "unavailable",
          "eu-web": "active"
        }
      }
    ],
    "views": [
      {
        "id": "multi-dc:view:data-copy",
        "title": "Regional data synchronization",
        "description": "Inspect the one authored A → B copy relation.",
        "members": ["us-db", "eu-db"],
        "layout": "pipeline"
      },
      {
        "id": "multi-dc:view:region-b",
        "title": "Region B request path",
        "description": "A focused healthy-region read path; routing still needs data and capacity checks.",
        "members": ["geodns", "eu-web", "eu-db"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "multi-dc:predict:source-region-down",
        "title": "Predict a regional failover",
        "prompt": "Region A, the source of the displayed A → B copy, is unavailable. Can routing to B establish that B is a safe new writer with every acknowledged record?",
        "options": ["No; data lag, writer promotion, and capacity need an explicit recovery plan", "Yes; the DNS arrow proves all data is synchronized", "Yes; both data stores are independent simultaneous writers"],
        "correctIndex": 0,
        "explanation": "GeoDNS can change the traffic route. The A → B copy arrow does not promise complete synchronization or safe automatic promotion, so missing records and write recovery remain separate decisions.",
        "reveal": {
          "id": "multi-dc:reveal:source-region-down",
          "title": "Predict a regional failover",
          "description": "GeoDNS can change the traffic route. The A → B copy arrow does not promise complete synchronization or safe automatic promotion, so missing records and write recovery remain separate decisions.",
          "nodeIds": ["geodns", "us-web", "us-db", "eu-web", "eu-db"],
          "linkIds": ["multi-dc:relation:2", "multi-dc:relation:4", "multi-dc:relation:5"],
          "statuses": {
            "us-web": "unavailable",
            "us-db": "unavailable",
            "eu-web": "active"
          }
        }
      }
    ]
  },
  "queue": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "web": {"lane": 2, "order": 2, "semanticId": "application"},
      "queue": {"lane": 3, "order": 5, "semanticId": "job-queue"},
      "worker-a": {"lane": 4, "order": 4, "semanticId": "worker-a"},
      "worker-b": {"lane": 4, "order": 6, "semanticId": "worker-b"},
      "storage": {"lane": 5, "order": 5, "semanticId": "object-storage"}
    },
    "relationships": {
      "queue:relation:0": {"meaning": "request", "condition": "For a photo upload.", "explanation": "The visitor sends the upload to the web tier."},
      "queue:relation:1": {"meaning": "publish", "condition": "After the original is stored.", "explanation": "The web tier publishes a job containing the original object key, not the image bytes."},
      "queue:relation:2": {"meaning": "write", "condition": "Before publishing a processing reference.", "explanation": "The web tier stores the original image in storage."},
      "queue:relation:3": {"meaning": "delivery", "condition": "When a healthy worker consumes pending work.", "explanation": "The queue delivers a processing job to this worker; acknowledgement semantics depend on the selected queue."},
      "queue:relation:4": {"meaning": "delivery", "condition": "When a healthy worker consumes pending work.", "explanation": "The queue delivers a processing job to this worker; acknowledgement semantics depend on the selected queue."},
      "queue:relation:5": {"meaning": "response", "condition": "When a worker fetches the original identified by its job.", "explanation": "The drawn payload arrow supplies original bytes from Storage to the worker; it is a storage-read result."},
      "queue:relation:6": {"meaning": "response", "condition": "When a worker fetches the original identified by its job.", "explanation": "The drawn payload arrow supplies original bytes from Storage to the worker; it is a storage-read result."},
      "queue:relation:7": {"meaning": "write", "condition": "After image processing succeeds.", "explanation": "The worker writes the processed image to storage."},
      "queue:relation:8": {"meaning": "write", "condition": "After image processing succeeds.", "explanation": "The worker writes the processed image to storage."}
    },
    "groups": [
      {
        "id": "queue:background-processing",
        "title": "Background processing",
        "description": "The durable pending-work queue and independent image workers.",
        "members": ["queue", "worker-a", "worker-b"]
      }
    ],
    "scenes": [
      {
        "id": "queue:accept",
        "title": "Store the original and publish its key",
        "description": "The web tier stores the original image and puts a reference in the job queue. It can respond without resizing the image inline.",
        "nodeIds": ["visitor", "web", "queue", "storage"],
        "linkIds": ["queue:relation:0", "queue:relation:2", "queue:relation:1"]
      },
      {
        "id": "queue:consume",
        "title": "Workers consume independently",
        "description": "Both workers can receive jobs. The producer and worker pool can change independently.",
        "nodeIds": ["queue", "worker-a", "worker-b"],
        "linkIds": ["queue:relation:3", "queue:relation:4"]
      },
      {
        "id": "queue:process",
        "title": "Read originals and save outputs",
        "description": "Workers obtain original bytes from storage and write processed images back. Queue jobs carry the key; storage carries image bytes.",
        "nodeIds": ["worker-a", "worker-b", "storage"],
        "linkIds": ["queue:relation:5", "queue:relation:6", "queue:relation:7", "queue:relation:8"]
      },
      {
        "id": "queue:backlog",
        "title": "Pending work survives a worker outage",
        "description": "In this authored example Worker A is unavailable; pending jobs remain in a suitable durable queue and Worker B can process them. A rising backlog calls for checking arrival rate and worker health.",
        "nodeIds": ["web", "queue", "worker-a", "worker-b"],
        "linkIds": ["queue:relation:1", "queue:relation:4"],
        "statuses": {
          "queue": "under-pressure",
          "worker-a": "unavailable",
          "worker-b": "active"
        }
      }
    ],
    "views": [
      {
        "id": "queue:view:processing",
        "title": "Image processing",
        "description": "Follow queue delivery, storage reads, and output writes outside the request path.",
        "members": ["queue", "worker-a", "worker-b", "storage"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "queue:predict:worker-outage",
        "title": "Predict pending work",
        "prompt": "Worker A is unavailable and the queue is durable. What should happen to its unfinished work?",
        "options": ["Keep it recoverable for a healthy worker under the queue policy", "Report every queued image as processed", "Move the original image bytes into DNS"],
        "correctIndex": 0,
        "explanation": "A suitable durable queue retains pending work. The Queue → Worker B path remains available, while queue age and backlog reveal delayed completion.",
        "reveal": {
          "id": "queue:reveal:worker-outage",
          "title": "Predict pending work",
          "description": "A suitable durable queue retains pending work. The Queue → Worker B path remains available, while queue age and backlog reveal delayed completion.",
          "nodeIds": ["queue", "worker-a", "worker-b"],
          "linkIds": ["queue:relation:4"],
          "statuses": {
            "queue": "under-pressure",
            "worker-a": "unavailable",
            "worker-b": "active"
          },
          "viewId": "queue:view:processing"
        }
      }
    ]
  },
  "observability": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "balancer": {"lane": 1, "order": 2, "semanticId": "load-balancer"},
      "web": {"lane": 2, "order": 2, "semanticId": "application"},
      "db": {"lane": 3, "order": 3, "semanticId": "database"},
      "cache": {"lane": 3, "order": 1, "semanticId": "application-cache"},
      "monitor": {"lane": 4, "order": 5, "semanticId": "monitor"}
    },
    "relationships": {
      "observability:relation:0": {"meaning": "connection", "condition": "", "explanation": "Visitor (browser) leads to Balancer (traffic) in this lesson. Logs explain failures; metrics show scale and trends."},
      "observability:relation:1": {"meaning": "connection", "condition": "", "explanation": "Balancer (traffic) leads to Web tier (requests) in this lesson. Logs explain failures; metrics show scale and trends."},
      "observability:relation:2": {"meaning": "read", "condition": "For the application read path.", "explanation": "The web tier accesses this data dependency; inspect its latency and health separately."},
      "observability:relation:3": {"meaning": "read", "condition": "For the application read path.", "explanation": "The web tier accesses this data dependency; inspect its latency and health separately."},
      "observability:relation:4": {"meaning": "publish", "condition": "When the tier emits its operational signals.", "explanation": "Telemetry flows toward Monitor. This authored signal collection arrow does not replicate the database or cache contents."},
      "observability:relation:5": {"meaning": "publish", "condition": "When the tier emits its operational signals.", "explanation": "Telemetry flows toward Monitor. This authored signal collection arrow does not replicate the database or cache contents."},
      "observability:relation:6": {"meaning": "publish", "condition": "When the tier emits its operational signals.", "explanation": "Telemetry flows toward Monitor. This authored signal collection arrow does not replicate the database or cache contents."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "observability:request-health",
        "title": "Trace the request across tiers",
        "description": "Traffic enters through the balancer and web tier; persistent and cached reads have their own health signals.",
        "nodeIds": ["visitor", "balancer", "web", "db", "cache"],
        "linkIds": ["observability:relation:0", "observability:relation:1", "observability:relation:2", "observability:relation:3"]
      },
      {
        "id": "observability:signals",
        "title": "Bring different signals to the monitor",
        "description": "The web tier sends logs and traces. Database and cache signals reveal query health and hit behavior; they are observations, not replication of business records.",
        "nodeIds": ["web", "db", "cache", "monitor"],
        "linkIds": ["observability:relation:4", "observability:relation:5", "observability:relation:6"]
      },
      {
        "id": "observability:choose-bottleneck",
        "title": "Choose a change from evidence",
        "description": "Latency, errors, saturation, queue age, and workload shape should guide the next tier change. User count alone does not establish a sharding requirement.",
        "nodeIds": ["web", "db", "cache", "monitor"],
        "linkIds": ["observability:relation:4", "observability:relation:5", "observability:relation:6"]
      }
    ],
    "views": [
      {
        "id": "observability:view:telemetry",
        "title": "Observability signals",
        "description": "Inspect the authored signal collection paths.",
        "members": ["web", "db", "cache", "monitor"],
        "layout": "peers"
      }
    ],
    "predictions": [
      {
        "id": "observability:predict:falling-hit-rate",
        "title": "Predict the useful investigation",
        "prompt": "Database read load rises while cache hit rate falls. What should the displayed Monitor help investigate first?",
        "options": ["Cache and query behavior along the read path", "Automatic sharding based only on user count", "Whether DNS stores database rows"],
        "correctIndex": 0,
        "explanation": "The monitor receives signals from both Cache and Database. Compare those observations with request latency and workload before choosing a tier change.",
        "reveal": {
          "id": "observability:reveal:falling-hit-rate",
          "title": "Predict the useful investigation",
          "description": "The monitor receives signals from both Cache and Database. Compare those observations with request latency and workload before choosing a tier change.",
          "nodeIds": ["web", "db", "cache", "monitor"],
          "linkIds": ["observability:relation:2", "observability:relation:3", "observability:relation:5", "observability:relation:6"],
          "statuses": {
            "db": "under-pressure"
          }
        }
      }
    ]
  },
  "sharding": {
    "layout": "tiers",
    "nodeRoles": {
      "web": {"lane": 2, "order": 2, "semanticId": "application"},
      "router": {"lane": 3, "order": 2, "semanticId": "shard-router"},
      "shard-0": {"lane": 4, "order": 0, "semanticId": "shard-0"},
      "shard-1": {"lane": 4, "order": 2, "semanticId": "shard-1"},
      "shard-2": {"lane": 4, "order": 4, "semanticId": "shard-2"}
    },
    "relationships": {
      "sharding:relation:0": {"meaning": "request", "condition": "When the operation includes the user ID needed for routing.", "explanation": "The application forwards the keyed operation to the shard router."},
      "sharding:relation:1": {"meaning": "decision", "condition": "Only when user_id % 3 = 0.", "explanation": "This rule selects Shard 0; other shards hold different record slices."},
      "sharding:relation:2": {"meaning": "decision", "condition": "Only when user_id % 3 = 1.", "explanation": "This rule selects Shard 1; other shards hold different record slices."},
      "sharding:relation:3": {"meaning": "decision", "condition": "Only when user_id % 3 = 2.", "explanation": "This rule selects Shard 2; other shards hold different record slices."}
    },
    "groups": [
      {
        "id": "sharding:partitioned-storage",
        "title": "Partitioned storage",
        "description": "The three stores hold different user-ID slices.",
        "members": ["shard-0", "shard-1", "shard-2"]
      }
    ],
    "scenes": [
      {
        "id": "sharding:partition",
        "title": "Route by the record’s key",
        "description": "The router uses user_id % 3. Different shards hold different slices rather than replicas of every record.",
        "nodeIds": ["web", "router", "shard-0", "shard-1", "shard-2"],
        "linkIds": ["sharding:relation:0", "sharding:relation:1", "sharding:relation:2", "sharding:relation:3"]
      },
      {
        "id": "sharding:choose-slice",
        "title": "One routing decision selects a slice",
        "description": "For user 7 the remainder is 1, so the existing Shard 1 branch is selected. Every operation needs enough key information to route.",
        "nodeIds": ["web", "router", "shard-1"],
        "linkIds": ["sharding:relation:0", "sharding:relation:2"]
      },
      {
        "id": "sharding:hot-key",
        "title": "Balanced data can still hide a hot shard",
        "description": "A frequently requested user can concentrate traffic in one shard. Inspect both stored data and request distribution before moving or splitting a partition.",
        "nodeIds": ["router", "shard-0", "shard-1", "shard-2"],
        "linkIds": ["sharding:relation:1", "sharding:relation:2", "sharding:relation:3"],
        "statuses": {
          "shard-1": "under-pressure"
        }
      },
      {
        "id": "sharding:cross-shard",
        "title": "Keep cross-shard cost explicit",
        "description": "Cross-shard joins and reshuffling become harder. Related-data placement or selected denormalization can help but duplicated data must be maintained.",
        "nodeIds": ["router", "shard-0", "shard-1", "shard-2"],
        "linkIds": ["sharding:relation:1", "sharding:relation:2", "sharding:relation:3"]
      }
    ],
    "views": [
      {
        "id": "sharding:view:shard-selection",
        "title": "Shard selection",
        "description": "Compare the three actual routing conditions.",
        "members": ["router", "shard-0", "shard-1", "shard-2"],
        "layout": "peers"
      }
    ],
    "predictions": [
      {
        "id": "sharding:predict:user-seven",
        "title": "Predict the actual diagram route",
        "prompt": "With the displayed user_id % 3 rule, which branch handles user 7?",
        "options": ["Shard 0", "Shard 1", "Shard 2"],
        "correctIndex": 1,
        "explanation": "7 % 3 = 1. The selected Router → Shard 1 relation represents partition placement, not a replicated write to all three shards.",
        "reveal": {
          "id": "sharding:reveal:user-seven",
          "title": "Predict the actual diagram route",
          "description": "7 % 3 = 1. The selected Router → Shard 1 relation represents partition placement, not a replicated write to all three shards.",
          "nodeIds": ["web", "router", "shard-1"],
          "linkIds": ["sharding:relation:0", "sharding:relation:2"]
        }
      }
    ]
  },
  "synthesis": {
    "layout": "tiers",
    "nodeRoles": {
      "visitor": {"lane": 0, "order": 2, "semanticId": "client"},
      "cdn": {"lane": 1, "order": 0, "semanticId": "cdn-edge"},
      "balancer": {"lane": 1, "order": 2, "semanticId": "load-balancer"},
      "web": {"lane": 2, "order": 2, "semanticId": "application"},
      "queue": {"lane": 3, "order": 5, "semanticId": "job-queue"},
      "worker": {"lane": 4, "order": 5, "semanticId": "background-worker"},
      "cache": {"lane": 3, "order": 1, "semanticId": "application-cache"},
      "db": {"lane": 3, "order": 3, "semanticId": "database"}
    },
    "relationships": {
      "synthesis:relation:0": {"meaning": "request", "condition": "For static media and assets.", "explanation": "The visitor uses the CDN asset path."},
      "synthesis:relation:1": {"meaning": "request", "condition": "For dynamic application behavior.", "explanation": "Dynamic traffic enters the load balancer."},
      "synthesis:relation:2": {"meaning": "request", "condition": "For a healthy selected application instance.", "explanation": "The balancer forwards dynamic traffic to the web tier."},
      "synthesis:relation:3": {"meaning": "read", "condition": "Before selecting the cache hit or database miss path.", "explanation": "The application looks up hot data in cache."},
      "synthesis:relation:4": {"meaning": "response", "condition": "On a usable cache hit.", "explanation": "The cache returns the result and avoids a database read."},
      "synthesis:relation:5": {"meaning": "read", "condition": "On a cache miss or a deliberate fallback.", "explanation": "The application fetches authoritative data from the database."},
      "synthesis:relation:6": {"meaning": "publish", "condition": "For slow work moved out of the request.", "explanation": "The web tier publishes a pending job."},
      "synthesis:relation:7": {"meaning": "delivery", "condition": "When a worker consumes queued work.", "explanation": "The queue supplies slow work to the worker."}
    },
    "groups": [
      {
        "id": "synthesis:background-work",
        "title": "Background work",
        "description": "Queued slow tasks and the worker responsibility.",
        "members": ["queue", "worker"]
      }
    ],
    "scenes": [
      {
        "id": "synthesis:two-paths",
        "title": "Separate static and dynamic work",
        "description": "Static asset requests go to the CDN. Dynamic application traffic goes through the balancer and web tier.",
        "nodeIds": ["visitor", "cdn", "balancer", "web"],
        "linkIds": ["synthesis:relation:0", "synthesis:relation:1", "synthesis:relation:2"]
      },
      {
        "id": "synthesis:read-path",
        "title": "Optimize repeated reads where they occur",
        "description": "The application checks cache; a hit avoids the database. A miss still needs durable data.",
        "nodeIds": ["web", "cache", "db"],
        "linkIds": ["synthesis:relation:3", "synthesis:relation:4", "synthesis:relation:5"]
      },
      {
        "id": "synthesis:background",
        "title": "Move slow work to its own path",
        "description": "The application publishes slow jobs to the queue and workers consume them away from the immediate request.",
        "nodeIds": ["web", "queue", "worker"],
        "linkIds": ["synthesis:relation:6", "synthesis:relation:7"]
      },
      {
        "id": "synthesis:evidence",
        "title": "Choose one bottleneck and test the effect",
        "description": "Read replicas do not remove a primary write bottleneck, and even shard sizes do not remove a hot key. Use observations to choose a targeted change.",
        "nodeIds": ["web", "queue", "worker", "cache", "db"],
        "linkIds": ["synthesis:relation:3", "synthesis:relation:5", "synthesis:relation:6", "synthesis:relation:7"]
      }
    ],
    "views": [
      {
        "id": "synthesis:view:repeated-reads",
        "title": "Repeated read path",
        "description": "Focus on the exact cache-hit and persistent-miss branches.",
        "members": ["web", "cache", "db"],
        "layout": "pipeline"
      },
      {
        "id": "synthesis:view:slow-work",
        "title": "Slow work path",
        "description": "The queue and worker decouple slow work from the web request.",
        "members": ["web", "queue", "worker"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "synthesis:predict:repeated-details",
        "title": "Predict a targeted improvement",
        "prompt": "The same stable product details are repeatedly fetched from Database. Which displayed path directly avoids repeated database reads?",
        "options": ["Web tier checks App cache, then uses its hit result", "Deploy every scaling technique at once", "Add worker jobs for every lookup"],
        "correctIndex": 0,
        "explanation": "The Web tier → App cache lookup and Cache → Web tier hit return directly address repeated reads. A freshness and invalidation policy is still required.",
        "reveal": {
          "id": "synthesis:reveal:repeated-details",
          "title": "Predict a targeted improvement",
          "description": "The Web tier → App cache lookup and Cache → Web tier hit return directly address repeated reads. A freshness and invalidation policy is still required.",
          "nodeIds": ["web", "cache", "db"],
          "linkIds": ["synthesis:relation:3", "synthesis:relation:4", "synthesis:relation:5"],
          "viewId": "synthesis:view:repeated-reads"
        }
      }
    ]
  }
};
