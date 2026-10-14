import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const webCrawlerTeachingContent: Record<string, TeachingContent> = {
  "crawler-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-scope:node:0": {"lane": 0, "order": 2, "semanticId": "seed-urls"},
      "crawler-scope:node:1": {"lane": 1, "order": 2, "semanticId": "crawl-policy"},
      "crawler-scope:node:2": {"lane": 2, "order": 1, "semanticId": "search-index"},
      "crawler-scope:node:3": {"lane": 2, "order": 3, "semanticId": "web-archive"}
    },
    "relationships": {
      "crawler-scope:relation:0": {"meaning": "connection", "condition": "", "explanation": "Seed URLs (starting points) leads to Crawl policy (scope + budget) in this lesson. A crawl objective determines what to fetch, keep, and hand to consumers."},
      "crawler-scope:relation:1": {"meaning": "connection", "condition": "", "explanation": "Crawl policy (scope + budget) leads to Search index (parsed documents) in this lesson. A crawl objective determines what to fetch, keep, and hand to consumers."},
      "crawler-scope:relation:2": {"meaning": "connection", "condition": "", "explanation": "Crawl policy (scope + budget) leads to Web archive (retained versions) in this lesson. A crawl objective determines what to fetch, keep, and hand to consumers."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "crawler-scope:explain:1",
        "title": "Choose archive or index objectives",
        "description": "A crawler discovers pages by fetching seed URLs, extracting links, and scheduling useful new URLs. For a search index, the output is a stream of documents and metadata for indexing; an archive may retain the fetched bytes instead. Decide which domains and content types are in scope, how many pages to fetch, how long to retain them, and how quickly changes should appear.",
        "nodeIds": ["crawler-scope:node:0", "crawler-scope:node:1", "crawler-scope:node:2", "crawler-scope:node:3"],
        "linkIds": ["crawler-scope:relation:0", "crawler-scope:relation:1", "crawler-scope:relation:2"]
      },
      {
        "id": "crawler-scope:explain:2",
        "title": "Count fetch attempts and retained bytes",
        "description": "Capacity starts with attempts, not just stored pages. As an illustration, one billion fetches per month is roughly 386 fetches per second on average over 30 days. Peak load, retries, redirects, page size, and recrawls increase the real budget. A crawler must also be polite and robust: the public web contains slow hosts, malformed responses, loops, and changing rules.",
        "nodeIds": ["crawler-scope:node:1", "crawler-scope:node:3"],
        "linkIds": ["crawler-scope:relation:2"],
        "viewId": "crawler-scope:view:point-2"
      }
    ],
    "views": [
      {
        "id": "crawler-scope:view:point-2",
        "title": "Count fetch attempts and retained bytes",
        "description": "Capacity starts with attempts, not just stored pages. As an illustration, one billion fetches per month is roughly 386 fetches per second on average over 30 days. Peak load, retries, redirects, page size, and recrawls increase the real budget. A crawler must also be polite and robust: the public web contains slow hosts, malformed responses, loops, and changing rules.",
        "members": ["crawler-scope:node:1", "crawler-scope:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "crawler-scope:predict:archive-objective",
        "title": "Predict the storage objective",
        "prompt": "Crawl policy changes from search indexing to preserving historical fetched versions. Which displayed output now matters directly?",
        "options": ["Web archive", "Search index alone as a complete archive", "Seed URLs as stored page bytes"],
        "correctIndex": 0,
        "explanation": "The policy’s archive branch leads to retained versions in Web archive. Crawl purpose determines what to fetch, retain, and emit; an index alone is a different output.",
        "reveal": {
          "id": "crawler-scope:reveal:archive-objective",
          "title": "Predict the storage objective",
          "description": "The policy’s archive branch leads to retained versions in Web archive. Crawl purpose determines what to fetch, retain, and emit; an index alone is a different output.",
          "nodeIds": ["crawler-scope:node:1", "crawler-scope:node:2", "crawler-scope:node:3"],
          "linkIds": ["crawler-scope:relation:1", "crawler-scope:relation:2"]
        }
      }
    ]
  },
  "crawler-pipeline": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-pipeline:node:0": {"lane": 0, "order": 2, "semanticId": "url-frontier"},
      "crawler-pipeline:node:1": {"lane": 1, "order": 2, "semanticId": "downloader"},
      "crawler-pipeline:node:2": {"lane": 2, "order": 2, "semanticId": "parser"},
      "crawler-pipeline:node:3": {"lane": 3, "order": 1, "semanticId": "document-sink"},
      "crawler-pipeline:node:4": {"lane": 3, "order": 3, "semanticId": "url-filter"}
    },
    "relationships": {
      "crawler-pipeline:relation:0": {"meaning": "delivery", "condition": "When the host is eligible and a durable URL lease is granted.", "explanation": "Frontier delivers recoverable fetch work to Downloader."},
      "crawler-pipeline:relation:1": {"meaning": "response", "condition": "After a bounded fetch yields a response accepted for parsing.", "explanation": "Downloader supplies response content to Parser."},
      "crawler-pipeline:relation:2": {"meaning": "write", "condition": "Only when parsed content passes the sink’s acceptance policy.", "explanation": "Parser hands accepted document information to storage or an index pipeline."},
      "crawler-pipeline:relation:3": {"meaning": "publish", "condition": "When parsing extracts link candidates.", "explanation": "Discovered links go through URL filtering and deduplication."},
      "crawler-pipeline:relation:4": {"meaning": "publish", "condition": "Only for accepted links that should become future work.", "explanation": "The URL filter returns useful discovered work to the durable frontier, closing the discovery loop."}
    },
    "groups": [
      {
        "id": "crawler-pipeline:document-processing",
        "title": "Document processing",
        "description": "Parsing separates accepted documents from newly discovered link candidates.",
        "members": ["crawler-pipeline:node:2", "crawler-pipeline:node:3", "crawler-pipeline:node:4"]
      }
    ],
    "scenes": [
      {
        "id": "crawler-pipeline:lease",
        "title": "Lease an eligible URL before fetching",
        "description": "The durable frontier supplies work to Downloader. Policy, destination, time, and byte bounds apply before and during the fetch.",
        "nodeIds": ["crawler-pipeline:node:0", "crawler-pipeline:node:1", "crawler-pipeline:node:2"],
        "linkIds": ["crawler-pipeline:relation:0", "crawler-pipeline:relation:1"]
      },
      {
        "id": "crawler-pipeline:parse",
        "title": "Separate a fetch from a usable document",
        "description": "Parser extracts document information and links. Accepted documents reach the sink; successful fetch alone does not imply parsing or indexing success.",
        "nodeIds": ["crawler-pipeline:node:1", "crawler-pipeline:node:2", "crawler-pipeline:node:3"],
        "linkIds": ["crawler-pipeline:relation:1", "crawler-pipeline:relation:2"]
      },
      {
        "id": "crawler-pipeline:discover",
        "title": "Return accepted links to the frontier",
        "description": "New links pass filtering and deduplication, then return to URL frontier as future work. This feedback loop expands the crawl.",
        "nodeIds": ["crawler-pipeline:node:0", "crawler-pipeline:node:2", "crawler-pipeline:node:4"],
        "linkIds": ["crawler-pipeline:relation:3", "crawler-pipeline:relation:4"]
      },
      {
        "id": "crawler-pipeline:lease-recovery",
        "title": "Recover unfinished work through lease expiry",
        "description": "In this authored failure Downloader is unavailable. A durable lease can expire and make the URL eligible again; downstream effects need idempotency because fetching can repeat.",
        "nodeIds": ["crawler-pipeline:node:0", "crawler-pipeline:node:1", "crawler-pipeline:node:2", "crawler-pipeline:node:3"],
        "linkIds": ["crawler-pipeline:relation:0", "crawler-pipeline:relation:1", "crawler-pipeline:relation:2"],
        "statuses": {
          "crawler-pipeline:node:1": "unavailable",
          "crawler-pipeline:node:0": "active"
        }
      }
    ],
    "views": [
      {
        "id": "crawler-pipeline:view:document",
        "title": "Fetch to document",
        "description": "Inspect the forward path into the document sink.",
        "members": ["crawler-pipeline:node:0", "crawler-pipeline:node:1", "crawler-pipeline:node:2", "crawler-pipeline:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "crawler-pipeline:view:discovery",
        "title": "Discovery feedback",
        "description": "The parser’s extracted URLs return through filtering to the frontier.",
        "members": ["crawler-pipeline:node:0", "crawler-pipeline:node:2", "crawler-pipeline:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "crawler-pipeline:predict:fetch-crash",
        "title": "Predict a fetch worker crash",
        "prompt": "Downloader crashes after fetching but before acknowledging its URL lease. What prevents that URL from silently disappearing?",
        "options": ["Durable frontier state and an expiring lease", "Treating a socket close as successful indexing", "Deleting every extracted link"],
        "correctIndex": 0,
        "explanation": "Frontier retains queued and leased state. Lease expiry makes uncompleted work eligible again, which requires repeatable downstream writes and link insertion.",
        "reveal": {
          "id": "crawler-pipeline:reveal:fetch-crash",
          "title": "Predict a fetch worker crash",
          "description": "Frontier retains queued and leased state. Lease expiry makes uncompleted work eligible again, which requires repeatable downstream writes and link insertion.",
          "nodeIds": ["crawler-pipeline:node:0", "crawler-pipeline:node:1", "crawler-pipeline:node:2"],
          "linkIds": ["crawler-pipeline:relation:0", "crawler-pipeline:relation:1"],
          "statuses": {
            "crawler-pipeline:node:1": "unavailable",
            "crawler-pipeline:node:0": "active"
          }
        }
      }
    ]
  },
  "crawler-policy": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-policy:node:0": {"lane": 0, "order": 2, "semanticId": "frontier"},
      "crawler-policy:node:1": {"lane": 1, "order": 1, "semanticId": "robots-rules"},
      "crawler-policy:node:2": {"lane": 1, "order": 3, "semanticId": "host-timer"},
      "crawler-policy:node:3": {"lane": 2, "order": 2, "semanticId": "scheduler"},
      "crawler-policy:node:4": {"lane": 3, "order": 2, "semanticId": "fetch"}
    },
    "relationships": {
      "crawler-policy:relation:0": {"meaning": "connection", "condition": "", "explanation": "Frontier (pending URLs) leads to Scheduler (select eligible) in this lesson. Check robots rules before a fetch and refresh cached rules deliberately."},
      "crawler-policy:relation:1": {"meaning": "connection", "condition": "", "explanation": "Robots rules (allow or disallow) leads to Scheduler (select eligible) in this lesson. Check robots rules before a fetch and refresh cached rules deliberately."},
      "crawler-policy:relation:2": {"meaning": "connection", "condition": "", "explanation": "Host timer (next eligible) leads to Scheduler (select eligible) in this lesson. Check robots rules before a fetch and refresh cached rules deliberately."},
      "crawler-policy:relation:3": {"meaning": "connection", "condition": "", "explanation": "Scheduler (select eligible) leads to Fetch (one host slot) in this lesson. Check robots rules before a fetch and refresh cached rules deliberately."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "crawler-policy:explain:1",
        "title": "Apply robots rules for this crawler",
        "description": "Before fetching a path, check the applicable robots.txt rules for the crawler identity. Cache the rules with a refresh policy and define behavior when they cannot be fetched. Robots rules express a site’s crawl preferences; they are not a security boundary or permission to access otherwise restricted data. Site terms and applicable law may add constraints beyond robots.txt.",
        "nodeIds": ["crawler-policy:node:0", "crawler-policy:node:1", "crawler-policy:node:2", "crawler-policy:node:3"],
        "linkIds": ["crawler-policy:relation:0", "crawler-policy:relation:1", "crawler-policy:relation:2"],
        "viewId": "crawler-policy:view:point-1"
      },
      {
        "id": "crawler-policy:explain:2",
        "title": "Schedule per-host politeness",
        "description": "A global concurrency limit cannot protect a small host from a flood. Track per-host or per-site next-eligible times and active requests, then let the frontier schedule only eligible work. Slow responses, 429, 503, and Retry-After can lower that host’s rate. Keep unrelated hosts moving while one is delayed. Define host grouping carefully for subdomains and shared infrastructure.",
        "nodeIds": ["crawler-policy:node:0", "crawler-policy:node:2", "crawler-policy:node:3", "crawler-policy:node:4"],
        "linkIds": ["crawler-policy:relation:0", "crawler-policy:relation:2", "crawler-policy:relation:3"],
        "viewId": "crawler-policy:view:point-2"
      }
    ],
    "views": [
      {
        "id": "crawler-policy:view:point-1",
        "title": "Apply robots rules for this crawler",
        "description": "Before fetching a path, check the applicable robots.txt rules for the crawler identity. Cache the rules with a refresh policy and define behavior when they cannot be fetched. Robots rules express a site’s crawl preferences; they are not a security boundary or permission to access otherwise restricted data. Site terms and applicable law may add constraints beyond robots.txt.",
        "members": ["crawler-policy:node:0", "crawler-policy:node:1", "crawler-policy:node:2", "crawler-policy:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "crawler-policy:view:point-2",
        "title": "Schedule per-host politeness",
        "description": "A global concurrency limit cannot protect a small host from a flood. Track per-host or per-site next-eligible times and active requests, then let the frontier schedule only eligible work. Slow responses, 429, 503, and Retry-After can lower that host’s rate. Keep unrelated hosts moving while one is delayed. Define host grouping carefully for subdomains and shared infrastructure.",
        "members": ["crawler-policy:node:0", "crawler-policy:node:2", "crawler-policy:node:3", "crawler-policy:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "crawler-policy:predict:crq06",
        "title": "Predict the design consequence",
        "prompt": "Why is a global 500-request limit insufficient for politeness?",
        "options": ["It stores too many URLs", "All 500 requests could hit one host", "It eliminates retries", "It prevents DNS caching"],
        "correctIndex": 1,
        "explanation": "Rate control must be scoped to each host or site, not only the whole fleet.",
        "reveal": {
          "id": "crawler-policy:reveal:crq06",
          "title": "Why this choice follows",
          "description": "Rate control must be scoped to each host or site, not only the whole fleet.",
          "nodeIds": ["crawler-policy:node:1", "crawler-policy:node:2", "crawler-policy:node:3", "crawler-policy:node:4"],
          "linkIds": ["crawler-policy:relation:1", "crawler-policy:relation:2", "crawler-policy:relation:3"]
        }
      }
    ]
  },
  "crawler-frontier": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-frontier:node:0": {"lane": 0, "order": 2, "semanticId": "candidate-urls"},
      "crawler-frontier:node:1": {"lane": 1, "order": 2, "semanticId": "prioritizer"},
      "crawler-frontier:node:2": {"lane": 2, "order": 1, "semanticId": "host-a-queue"},
      "crawler-frontier:node:3": {"lane": 2, "order": 3, "semanticId": "host-b-queue"},
      "crawler-frontier:node:4": {"lane": 3, "order": 2, "semanticId": "selector"}
    },
    "relationships": {
      "crawler-frontier:relation:0": {"meaning": "decision", "condition": "When URLs are evaluated against crawl value and freshness.", "explanation": "Prioritizer ranks candidate URL work according to the crawl objective."},
      "crawler-frontier:relation:1": {"meaning": "publish", "condition": "When prioritized work is assigned to its host’s queue.", "explanation": "Per-host queued state separates URL value from that host’s next allowed fetch time."},
      "crawler-frontier:relation:2": {"meaning": "publish", "condition": "When prioritized work is assigned to its host’s queue.", "explanation": "Per-host queued state separates URL value from that host’s next allowed fetch time."},
      "crawler-frontier:relation:3": {"meaning": "decision", "condition": "While Host A is eligible now.", "explanation": "Selector can choose a URL from ready Host A under priority and fairness rules."},
      "crawler-frontier:relation:4": {"meaning": "decision", "condition": "Only after Host B’s authored next-eligible time, 14:05.", "explanation": "Waiting Host B must not be selected merely because its URL has priority."}
    },
    "groups": [
      {
        "id": "crawler-frontier:host-queues",
        "title": "Host queues",
        "description": "Separate per-host queues retain different eligibility times.",
        "members": ["crawler-frontier:node:2", "crawler-frontier:node:3"]
      }
    ],
    "scenes": [
      {
        "id": "crawler-frontier:priority",
        "title": "Priority chooses which URLs matter",
        "description": "The prioritizer considers value and freshness, then retains host-specific queues. Priority alone does not establish when a host may be fetched.",
        "nodeIds": ["crawler-frontier:node:0", "crawler-frontier:node:1", "crawler-frontier:node:2", "crawler-frontier:node:3"],
        "linkIds": ["crawler-frontier:relation:0", "crawler-frontier:relation:1", "crawler-frontier:relation:2"]
      },
      {
        "id": "crawler-frontier:eligibility",
        "title": "Eligibility chooses what may run now",
        "description": "Host A is ready now; Host B’s authored detail says wait until 14:05. The selector must respect host timing while maintaining fairness.",
        "nodeIds": ["crawler-frontier:node:2", "crawler-frontier:node:3", "crawler-frontier:node:4"],
        "linkIds": ["crawler-frontier:relation:3", "crawler-frontier:relation:4"]
      },
      {
        "id": "crawler-frontier:durability",
        "title": "Retain waiting and leased state",
        "description": "Durable state records waiting reasons, eligibility times, retry count, and recrawl times so restart does not lose scheduling decisions. A Bloom filter is not sole authority when false positives matter.",
        "nodeIds": ["crawler-frontier:node:0", "crawler-frontier:node:1", "crawler-frontier:node:2", "crawler-frontier:node:3", "crawler-frontier:node:4"],
        "linkIds": ["crawler-frontier:relation:0", "crawler-frontier:relation:1", "crawler-frontier:relation:2", "crawler-frontier:relation:3", "crawler-frontier:relation:4"]
      }
    ],
    "views": [
      {
        "id": "crawler-frontier:view:eligibility",
        "title": "Host eligibility",
        "description": "Compare the two actual host timings before selection.",
        "members": ["crawler-frontier:node:2", "crawler-frontier:node:3", "crawler-frontier:node:4"],
        "layout": "peers"
      }
    ],
    "predictions": [
      {
        "id": "crawler-frontier:predict:host-wait",
        "title": "Predict the eligible host",
        "prompt": "At a time before the displayed 14:05 deadline, Host A is ready and Host B is still waiting. Which queue can Selector use now?",
        "options": ["Host A queue", "Host B queue solely because it has a high-priority URL", "Both queues regardless of host timing"],
        "correctIndex": 0,
        "explanation": "Priority and eligibility are separate decisions. Host A → Selector is eligible; Host B must retain its waiting state until its host policy allows a fetch.",
        "reveal": {
          "id": "crawler-frontier:reveal:host-wait",
          "title": "Predict the eligible host",
          "description": "Priority and eligibility are separate decisions. Host A → Selector is eligible; Host B must retain its waiting state until its host policy allows a fetch.",
          "nodeIds": ["crawler-frontier:node:2", "crawler-frontier:node:3", "crawler-frontier:node:4"],
          "linkIds": ["crawler-frontier:relation:3"],
          "viewId": "crawler-frontier:view:eligibility"
        }
      }
    ]
  },
  "crawler-dedup": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-dedup:node:0": {"lane": 0, "order": 2, "semanticId": "discovered-url"},
      "crawler-dedup:node:1": {"lane": 1, "order": 2, "semanticId": "url-identity"},
      "crawler-dedup:node:2": {"lane": 2, "order": 2, "semanticId": "fetch"},
      "crawler-dedup:node:3": {"lane": 3, "order": 2, "semanticId": "content-hash"}
    },
    "relationships": {
      "crawler-dedup:relation:0": {"meaning": "connection", "condition": "", "explanation": "Discovered URL (relative link) leads to URL identity (normalize + seen) in this lesson. URL deduplication happens before fetching; content deduplication happens after."},
      "crawler-dedup:relation:1": {"meaning": "connection", "condition": "", "explanation": "URL identity (normalize + seen) leads to Fetch (response bytes) in this lesson. URL deduplication happens before fetching; content deduplication happens after."},
      "crawler-dedup:relation:2": {"meaning": "connection", "condition": "", "explanation": "Fetch (response bytes) leads to Content hash (same bytes?) in this lesson. URL deduplication happens before fetching; content deduplication happens after."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "crawler-dedup:explain:1",
        "title": "Normalize safe URL equivalents before queueing",
        "description": "Resolve relative links against their source URL and normalize safe equivalents before enqueueing. Lowercase scheme and host, remove default ports and fragments, and apply a deliberate policy for query parameters and trailing slashes. Avoid aggressive rewriting: path case, parameter order, and even apparently tracking-like parameters can change a resource. Redirect targets and declared canonical URLs are useful signals, but do not erase the fetched URL’s history.",
        "nodeIds": ["crawler-dedup:node:0", "crawler-dedup:node:1"],
        "linkIds": ["crawler-dedup:relation:0"],
        "viewId": "crawler-dedup:view:point-1"
      },
      {
        "id": "crawler-dedup:explain:2",
        "title": "Compare content after fetching",
        "description": "The URL-seen set prevents repeatedly queueing the same normalized URL. Content hashes detect byte-identical pages reached through different URLs. A strong hash match is a cheap duplicate signal, while a near-duplicate method is needed for pages that differ only in boilerplate or timestamps. Store URL-to-content relationships because duplicate content may still have distinct links, provenance, or future changes.",
        "nodeIds": ["crawler-dedup:node:0", "crawler-dedup:node:1", "crawler-dedup:node:2", "crawler-dedup:node:3"],
        "linkIds": ["crawler-dedup:relation:0", "crawler-dedup:relation:1", "crawler-dedup:relation:2"]
      }
    ],
    "views": [
      {
        "id": "crawler-dedup:view:point-1",
        "title": "Normalize safe URL equivalents before queueing",
        "description": "Resolve relative links against their source URL and normalize safe equivalents before enqueueing. Lowercase scheme and host, remove default ports and fragments, and apply a deliberate policy for query parameters and trailing slashes. Avoid aggressive rewriting: path case, parameter order, and even apparently tracking-like parameters can change a resource. Redirect targets and declared canonical URLs are useful signals, but do not erase the fetched URL’s history.",
        "members": ["crawler-dedup:node:0", "crawler-dedup:node:1"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "crawler-dedup:predict:crq10",
        "title": "Predict the design consequence",
        "prompt": "Why avoid deleting all history for two URLs with equal HTML?",
        "options": ["A page cannot redirect", "Their provenance or future content may differ", "Hashes cannot match", "URLs are never reused"],
        "correctIndex": 1,
        "explanation": "Keep URL-to-content relationships and fetch history even when bytes are shared.",
        "reveal": {
          "id": "crawler-dedup:reveal:crq10",
          "title": "Why this choice follows",
          "description": "Keep URL-to-content relationships and fetch history even when bytes are shared.",
          "nodeIds": ["crawler-dedup:node:0", "crawler-dedup:node:1", "crawler-dedup:node:2", "crawler-dedup:node:3"],
          "linkIds": ["crawler-dedup:relation:0", "crawler-dedup:relation:1", "crawler-dedup:relation:2"]
        }
      }
    ]
  },
  "crawler-fetch": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-fetch:node:0": {"lane": 0, "order": 2, "semanticId": "leased-url"},
      "crawler-fetch:node:1": {"lane": 1, "order": 2, "semanticId": "dns-redirect"},
      "crawler-fetch:node:2": {"lane": 2, "order": 2, "semanticId": "http-fetch"},
      "crawler-fetch:node:3": {"lane": 3, "order": 2, "semanticId": "html-parser"}
    },
    "relationships": {
      "crawler-fetch:relation:0": {"meaning": "connection", "condition": "", "explanation": "Leased URL (public target) leads to DNS + redirect (check each hop) in this lesson. Bound redirects, time, bytes, decompression, and destinations."},
      "crawler-fetch:relation:1": {"meaning": "connection", "condition": "", "explanation": "DNS + redirect (check each hop) leads to HTTP fetch (time + byte caps) in this lesson. Bound redirects, time, bytes, decompression, and destinations."},
      "crawler-fetch:relation:2": {"meaning": "connection", "condition": "", "explanation": "HTTP fetch (time + byte caps) leads to HTML parser (links + metadata) in this lesson. Bound redirects, time, bytes, decompression, and destinations."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "crawler-fetch:explain:1",
        "title": "Bound network work and validate each hop",
        "description": "Use DNS and HTTP clients with timeouts, redirect limits, response-size caps, accepted content types, and bounded decompression. Validate destinations after every redirect and DNS resolution so a discovered public URL cannot redirect workers into private or local network addresses. Set a clear crawler identity, track response status, and close sockets and streams on failure. Concurrency helps throughput, but each worker has finite memory, bandwidth, and file descriptors.",
        "nodeIds": ["crawler-fetch:node:0", "crawler-fetch:node:1", "crawler-fetch:node:2"],
        "linkIds": ["crawler-fetch:relation:0", "crawler-fetch:relation:1"],
        "viewId": "crawler-fetch:view:point-1"
      },
      {
        "id": "crawler-fetch:explain:2",
        "title": "Parse HTML separately from browser rendering",
        "description": "Parse HTML with a tolerant parser, not a regular expression. Resolve relative links using the final document URL and any valid base URL, filter unsupported schemes, and keep metadata such as status, content type, fetch time, and canonical hints. JavaScript-rendered pages require a separate, more expensive rendering path if they are in scope. Do not render every page by default.",
        "nodeIds": ["crawler-fetch:node:0", "crawler-fetch:node:2", "crawler-fetch:node:3"],
        "linkIds": ["crawler-fetch:relation:2"],
        "viewId": "crawler-fetch:view:point-2"
      }
    ],
    "views": [
      {
        "id": "crawler-fetch:view:point-1",
        "title": "Bound network work and validate each hop",
        "description": "Use DNS and HTTP clients with timeouts, redirect limits, response-size caps, accepted content types, and bounded decompression. Validate destinations after every redirect and DNS resolution so a discovered public URL cannot redirect workers into private or local network addresses. Set a clear crawler identity, track response status, and close sockets and streams on failure. Concurrency helps throughput, but each worker has finite memory, bandwidth, and file descriptors.",
        "members": ["crawler-fetch:node:0", "crawler-fetch:node:1", "crawler-fetch:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "crawler-fetch:view:point-2",
        "title": "Parse HTML separately from browser rendering",
        "description": "Parse HTML with a tolerant parser, not a regular expression. Resolve relative links using the final document URL and any valid base URL, filter unsupported schemes, and keep metadata such as status, content type, fetch time, and canonical hints. JavaScript-rendered pages require a separate, more expensive rendering path if they are in scope. Do not render every page by default.",
        "members": ["crawler-fetch:node:0", "crawler-fetch:node:2", "crawler-fetch:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "crawler-fetch:predict:crq12",
        "title": "Predict the design consequence",
        "prompt": "A public URL redirects into a private network. What failed if the worker follows it?",
        "options": ["Ranking priority", "Duplicate-content hashing", "The index schema", "Destination validation on each hop"],
        "correctIndex": 3,
        "explanation": "Redirect and resolved-address checks must prevent access to private or local destinations.",
        "reveal": {
          "id": "crawler-fetch:reveal:crq12",
          "title": "Why this choice follows",
          "description": "Redirect and resolved-address checks must prevent access to private or local destinations.",
          "nodeIds": ["crawler-fetch:node:0", "crawler-fetch:node:1", "crawler-fetch:node:2"],
          "linkIds": ["crawler-fetch:relation:0", "crawler-fetch:relation:1"]
        }
      }
    ]
  },
  "crawler-freshness": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-freshness:node:0": {"lane": 0, "order": 2, "semanticId": "fetch-result"},
      "crawler-freshness:node:1": {"lane": 1, "order": 1, "semanticId": "change-history"},
      "crawler-freshness:node:2": {"lane": 1, "order": 3, "semanticId": "retry-policy"},
      "crawler-freshness:node:3": {"lane": 2, "order": 2, "semanticId": "recrawl-plan"},
      "crawler-freshness:node:4": {"lane": 3, "order": 2, "semanticId": "frontier"}
    },
    "relationships": {
      "crawler-freshness:relation:0": {"meaning": "write", "condition": "For observed content, response validators, and change history.", "explanation": "Record successful or unchanged fetch evidence for future scheduling."},
      "crawler-freshness:relation:1": {"meaning": "decision", "condition": "When the fetch outcome needs failure classification.", "explanation": "Retry policy distinguishes transient errors, permanent errors, exclusions, and suspicious expansion."},
      "crawler-freshness:relation:2": {"meaning": "decision", "condition": "When change rate and importance determine a next visit.", "explanation": "Change history influences the recrawl schedule rather than one global fixed interval."},
      "crawler-freshness:relation:3": {"meaning": "decision", "condition": "When an eligible transient failure permits bounded backoff and retry.", "explanation": "Retry policy determines a safe later visit; it does not authorize unlimited immediate looping."},
      "crawler-freshness:relation:4": {"meaning": "publish", "condition": "After a next-eligible recrawl time has been chosen.", "explanation": "Retain the future visit in durable frontier state."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "crawler-freshness:successful-history",
        "title": "Use change history for future visits",
        "description": "Successful responses and validators update Change history. Important or changing pages can receive an earlier next visit; a 304 avoids new body transfer without deleting the URL.",
        "nodeIds": ["crawler-freshness:node:0", "crawler-freshness:node:1", "crawler-freshness:node:3"],
        "linkIds": ["crawler-freshness:relation:0", "crawler-freshness:relation:2"]
      },
      {
        "id": "crawler-freshness:failure-policy",
        "title": "Classify errors before rescheduling",
        "description": "Transient failures use bounded backoff and jitter. Permanent errors and policy exclusions are different outcomes; suspicious URL expansion needs limits.",
        "nodeIds": ["crawler-freshness:node:0", "crawler-freshness:node:2", "crawler-freshness:node:3"],
        "linkIds": ["crawler-freshness:relation:1", "crawler-freshness:relation:3"]
      },
      {
        "id": "crawler-freshness:return",
        "title": "Retain a durable next-eligible visit",
        "description": "Both observed change and retry policy feed Recrawl plan. The next visit returns to the durable Frontier rather than immediately looping the fetch.",
        "nodeIds": ["crawler-freshness:node:1", "crawler-freshness:node:2", "crawler-freshness:node:3", "crawler-freshness:node:4"],
        "linkIds": ["crawler-freshness:relation:2", "crawler-freshness:relation:3", "crawler-freshness:relation:4"]
      }
    ],
    "views": [
      {
        "id": "crawler-freshness:view:successful",
        "title": "Change-driven recrawl",
        "description": "Successful and unchanged results inform the next visit.",
        "members": ["crawler-freshness:node:0", "crawler-freshness:node:1", "crawler-freshness:node:3", "crawler-freshness:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "crawler-freshness:view:retry",
        "title": "Failure-driven revisit",
        "description": "Classified retry policy chooses a bounded later visit.",
        "members": ["crawler-freshness:node:0", "crawler-freshness:node:2", "crawler-freshness:node:3", "crawler-freshness:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "crawler-freshness:predict:not-modified",
        "title": "Predict a 304 result",
        "prompt": "Fetch result is 304 Not Modified. What should the history and recrawl path do?",
        "options": ["Retain the URL and schedule its next eligible visit without a new response body", "Delete the URL from Frontier", "Immediately loop without host limits"],
        "correctIndex": 0,
        "explanation": "The response reports no new representation. Change history and Recrawl plan retain useful scheduling state, then place a later eligible visit in Frontier.",
        "reveal": {
          "id": "crawler-freshness:reveal:not-modified",
          "title": "Predict a 304 result",
          "description": "The response reports no new representation. Change history and Recrawl plan retain useful scheduling state, then place a later eligible visit in Frontier.",
          "nodeIds": ["crawler-freshness:node:0", "crawler-freshness:node:1", "crawler-freshness:node:3", "crawler-freshness:node:4"],
          "linkIds": ["crawler-freshness:relation:0", "crawler-freshness:relation:2", "crawler-freshness:relation:4"],
          "viewId": "crawler-freshness:view:successful"
        }
      }
    ]
  },
  "crawler-scale": {
    "layout": "tiers",
    "nodeRoles": {
      "crawler-scale:node:0": {"lane": 0, "order": 2, "semanticId": "host-router"},
      "crawler-scale:node:1": {"lane": 1, "order": 1, "semanticId": "scheduler-a"},
      "crawler-scale:node:2": {"lane": 1, "order": 3, "semanticId": "scheduler-b"},
      "crawler-scale:node:3": {"lane": 2, "order": 2, "semanticId": "worker-pool"},
      "crawler-scale:node:4": {"lane": 3, "order": 1, "semanticId": "doc-storage"},
      "crawler-scale:node:5": {"lane": 3, "order": 3, "semanticId": "index-handoff"}
    },
    "relationships": {
      "crawler-scale:relation:0": {"meaning": "connection", "condition": "", "explanation": "Host router (stable ownership) leads to Scheduler A (host queues) in this lesson. Partition by host to preserve rate ownership, then rebalance carefully."},
      "crawler-scale:relation:1": {"meaning": "connection", "condition": "", "explanation": "Host router (stable ownership) leads to Scheduler B (host queues) in this lesson. Partition by host to preserve rate ownership, then rebalance carefully."},
      "crawler-scale:relation:2": {"meaning": "connection", "condition": "", "explanation": "Scheduler A (host queues) leads to Worker pool (leased fetches) in this lesson. Partition by host to preserve rate ownership, then rebalance carefully."},
      "crawler-scale:relation:3": {"meaning": "connection", "condition": "", "explanation": "Scheduler B (host queues) leads to Worker pool (leased fetches) in this lesson. Partition by host to preserve rate ownership, then rebalance carefully."},
      "crawler-scale:relation:4": {"meaning": "connection", "condition": "", "explanation": "Worker pool (leased fetches) leads to Doc storage (versions) in this lesson. Partition by host to preserve rate ownership, then rebalance carefully."},
      "crawler-scale:relation:5": {"meaning": "connection", "condition": "", "explanation": "Worker pool (leased fetches) leads to Index handoff (durable events) in this lesson. Partition by host to preserve rate ownership, then rebalance carefully."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "crawler-scale:explain:1",
        "title": "Give each host budget a clear owner",
        "description": "Partition host queues across scheduler shards so one host’s rate policy has a clear owner. Multiple downloader workers can lease eligible URLs; rebalance shard ownership as capacity changes without allowing two owners to violate a host delay. A consistent-hash ring can reduce movement, but it does not solve hot hosts or stalled workers by itself. Replicate durable frontier state, checkpoint ownership transitions, and make storage writes idempotent.",
        "nodeIds": ["crawler-scale:node:0", "crawler-scale:node:1", "crawler-scale:node:2", "crawler-scale:node:3", "crawler-scale:node:4"],
        "linkIds": ["crawler-scale:relation:0", "crawler-scale:relation:1", "crawler-scale:relation:2", "crawler-scale:relation:3", "crawler-scale:relation:4"],
        "viewId": "crawler-scale:view:point-1"
      },
      {
        "id": "crawler-scale:explain:2",
        "title": "Separate document storage from index handoff",
        "description": "Separate document storage from the index handoff: store fetched versions and metadata under stable keys, then publish a durable indexing event or batch. Watch queue age by priority, eligible-host count, fetch success and error rates, robots denials, bytes, duplicate ratio, change-detection lag, and per-host request rates. These signals expose starvation, floods, traps, and stale output before aggregate QPS looks wrong.",
        "nodeIds": ["crawler-scale:node:0", "crawler-scale:node:1", "crawler-scale:node:2", "crawler-scale:node:4", "crawler-scale:node:5"],
        "linkIds": ["crawler-scale:relation:0", "crawler-scale:relation:1"],
        "viewId": "crawler-scale:view:point-2"
      }
    ],
    "views": [
      {
        "id": "crawler-scale:view:point-1",
        "title": "Give each host budget a clear owner",
        "description": "Partition host queues across scheduler shards so one host’s rate policy has a clear owner. Multiple downloader workers can lease eligible URLs; rebalance shard ownership as capacity changes without allowing two owners to violate a host delay. A consistent-hash ring can reduce movement, but it does not solve hot hosts or stalled workers by itself. Replicate durable frontier state, checkpoint ownership transitions, and make storage writes idempotent.",
        "members": ["crawler-scale:node:0", "crawler-scale:node:1", "crawler-scale:node:2", "crawler-scale:node:3", "crawler-scale:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "crawler-scale:view:point-2",
        "title": "Separate document storage from index handoff",
        "description": "Separate document storage from the index handoff: store fetched versions and metadata under stable keys, then publish a durable indexing event or batch. Watch queue age by priority, eligible-host count, fetch success and error rates, robots denials, bytes, duplicate ratio, change-detection lag, and per-host request rates. These signals expose starvation, floods, traps, and stale output before aggregate QPS looks wrong.",
        "members": ["crawler-scale:node:0", "crawler-scale:node:1", "crawler-scale:node:2", "crawler-scale:node:4", "crawler-scale:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "crawler-scale:predict:crq16",
        "title": "Predict the design consequence",
        "prompt": "Which signal best reveals an important page is not being revisited in time?",
        "options": ["Only fleet average QPS", "Card background color", "Total domain count alone", "Queue age and change-detection lag by priority"],
        "correctIndex": 3,
        "explanation": "Freshness and queue age reveal starvation that aggregate throughput hides.",
        "reveal": {
          "id": "crawler-scale:reveal:crq16",
          "title": "Why this choice follows",
          "description": "Freshness and queue age reveal starvation that aggregate throughput hides.",
          "nodeIds": ["crawler-scale:node:0", "crawler-scale:node:1", "crawler-scale:node:2", "crawler-scale:node:3"],
          "linkIds": ["crawler-scale:relation:0", "crawler-scale:relation:1", "crawler-scale:relation:2", "crawler-scale:relation:3"]
        }
      }
    ]
  }
};
