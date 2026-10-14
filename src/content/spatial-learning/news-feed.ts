import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const newsFeedTeachingContent: Record<string, TeachingContent> = {
  "feed-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-scope:node:0": {"lane": 0, "order": 2, "semanticId": "publisher"},
      "feed-scope:node:1": {"lane": 1, "order": 1, "semanticId": "accept"},
      "feed-scope:node:2": {"lane": 2, "order": 1, "semanticId": "distribute"},
      "feed-scope:node:3": {"lane": 3, "order": 2, "semanticId": "reader"}
    },
    "relationships": {
      "feed-scope:relation:0": {"meaning": "write", "condition": "", "explanation": "Publisher → Accept: commit. durable post ID."},
      "feed-scope:relation:1": {"meaning": "connection", "condition": "", "explanation": "Accept → Distribute: later. eligible followers."},
      "feed-scope:relation:2": {"meaning": "connection", "condition": "", "explanation": "Distribute → Reader: retrieve. authorized page."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "feed-scope:explain:1",
        "title": "Define whose posts appear and when",
        "description": "A feed is a personalized view of posts, not a single shared list. For this design, people publish text with optional images or video, follow other accounts, and read a home timeline on mobile or web. Assume a reverse chronological first release with a few thousand follows per typical account. Search, ads, stories, and recommendations can be separate designs.",
        "nodeIds": ["feed-scope:node:0", "feed-scope:node:1"],
        "linkIds": ["feed-scope:relation:0"],
        "viewId": "feed-scope:view:point-1"
      },
      {
        "id": "feed-scope:explain:2",
        "title": "Resolve visibility before choosing caches",
        "description": "Ask whether follows require approval, whether posts can be private, and what a block or mute means. State a freshness goal for ordinary posts, the peak publish and refresh rates, active readership, expected media size, and how far people scroll. A celebrity with millions of followers changes the write workload even if they publish rarely.",
        "nodeIds": ["feed-scope:node:0", "feed-scope:node:1", "feed-scope:node:2"],
        "linkIds": ["feed-scope:relation:0", "feed-scope:relation:1"],
        "viewId": "feed-scope:view:point-2"
      },
      {
        "id": "feed-scope:explain:3",
        "title": "Separate publishing, eligibility, and rendering",
        "description": "Keep three operations distinct: accepting a post durably, making it eligible in followers’ feeds, and rendering a feed page. A successful publish response need not mean every follower has already received an entry; the product must say what delay is acceptable.",
        "nodeIds": ["feed-scope:node:0", "feed-scope:node:1", "feed-scope:node:2", "feed-scope:node:3"],
        "linkIds": ["feed-scope:relation:0", "feed-scope:relation:1", "feed-scope:relation:2"]
      }
    ],
    "views": [
      {
        "id": "feed-scope:view:point-1",
        "title": "Define whose posts appear and when",
        "description": "A feed is a personalized view of posts, not a single shared list. For this design, people publish text with optional images or video, follow other accounts, and read a home timeline on mobile or web. Assume a reverse chronological first release with a few thousand follows per typical account. Search, ads, stories, and recommendations can be separate designs.",
        "members": ["feed-scope:node:0", "feed-scope:node:1"],
        "layout": "pipeline"
      },
      {
        "id": "feed-scope:view:point-2",
        "title": "Resolve visibility before choosing caches",
        "description": "Ask whether follows require approval, whether posts can be private, and what a block or mute means. State a freshness goal for ordinary posts, the peak publish and refresh rates, active readership, expected media size, and how far people scroll. A celebrity with millions of followers changes the write workload even if they publish rarely.",
        "members": ["feed-scope:node:0", "feed-scope:node:1", "feed-scope:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-scope:predict:post-accepted",
        "title": "Predict the next feed outcome",
        "prompt": "Accept has committed a durable post ID. Does that alone prove Reader already has an authorized page containing the post?",
        "options": ["No; Distribute and authorized retrieval are separate outcomes", "Yes; a post ID is permanent read permission", "Yes; all readers share one immediate list"],
        "correctIndex": 0,
        "explanation": "Accept → Distribute is labelled later. Reader retrieval still needs an authorized page, so durable acceptance alone does not establish feed visibility.",
        "reveal": {
          "id": "feed-scope:reveal:post-accepted",
          "title": "Predict the next feed outcome",
          "description": "Accept → Distribute is labelled later. Reader retrieval still needs an authorized page, so durable acceptance alone does not establish feed visibility.",
          "nodeIds": ["feed-scope:node:1", "feed-scope:node:2", "feed-scope:node:3"],
          "linkIds": ["feed-scope:relation:1", "feed-scope:relation:2"]
        }
      }
    ]
  },
  "feed-publish": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-publish:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "feed-publish:node:1": {"lane": 1, "order": 2, "semanticId": "post-api"},
      "feed-publish:node:2": {"lane": 2, "order": 1, "semanticId": "post-store"},
      "feed-publish:node:3": {"lane": 2, "order": 3, "semanticId": "outbox"},
      "feed-publish:node:4": {"lane": 3, "order": 3, "semanticId": "worker"},
      "feed-publish:node:5": {"lane": 3, "order": 1, "semanticId": "inboxes"}
    },
    "relationships": {
      "feed-publish:relation:0": {"meaning": "request", "condition": "For a publisher action or retry with its same idempotency key.", "explanation": "The client submits validated content and a stable logical request identity."},
      "feed-publish:relation:1": {"meaning": "write", "condition": "After identity, rate, audience, and media checks.", "explanation": "The API commits one canonical post."},
      "feed-publish:relation:2": {"meaning": "write", "condition": "In the same transaction as the canonical post.", "explanation": "The outbox records durable fanout intent with the post; this is a transaction relationship rather than a later independent network call."},
      "feed-publish:relation:3": {"meaning": "publish", "condition": "After the transaction commits; retry the relay if needed.", "explanation": "The outbox relays durable fanout work to a worker."},
      "feed-publish:relation:4": {"meaning": "write", "condition": "For eligible followers and retry-safe insertion by post ID.", "explanation": "The worker writes small canonical post references into derived inboxes."}
    },
    "groups": [
      {
        "id": "feed-publish:canonical-handoff",
        "title": "Canonical post and handoff",
        "description": "Canonical post and outbox are committed together for durable fanout.",
        "members": ["feed-publish:node:2", "feed-publish:node:3"]
      },
      {
        "id": "feed-publish:derived-feeds",
        "title": "Derived feed materialization",
        "description": "Fanout worker populates inbox references asynchronously.",
        "members": ["feed-publish:node:4", "feed-publish:node:5"]
      }
    ],
    "scenes": [
      {
        "id": "feed-publish:canonical",
        "title": "Commit one canonical post",
        "description": "The API validates identity, audience, content readiness, and idempotency. The Post store is the singular canonical record.",
        "nodeIds": ["feed-publish:node:0", "feed-publish:node:1", "feed-publish:node:2"],
        "linkIds": ["feed-publish:relation:0", "feed-publish:relation:1"]
      },
      {
        "id": "feed-publish:outbox",
        "title": "Commit a durable fanout intent with the post",
        "description": "The Post store and Outbox share the transactional handoff. This closes the gap between a valid committed post and a failed enqueue.",
        "nodeIds": ["feed-publish:node:1", "feed-publish:node:2", "feed-publish:node:3"],
        "linkIds": ["feed-publish:relation:1", "feed-publish:relation:2"]
      },
      {
        "id": "feed-publish:fanout",
        "title": "Write small inbox references asynchronously",
        "description": "The relay gives the worker durable work. Idempotent inbox insertion writes post IDs instead of copying full post or media bytes.",
        "nodeIds": ["feed-publish:node:2", "feed-publish:node:3", "feed-publish:node:4", "feed-publish:node:5"],
        "linkIds": ["feed-publish:relation:2", "feed-publish:relation:3", "feed-publish:relation:4"]
      },
      {
        "id": "feed-publish:stalled-worker",
        "title": "A delayed fanout does not erase the post",
        "description": "In this authored example Worker is unavailable. The canonical post and outbox remain durable so inboxes can catch up later.",
        "nodeIds": ["feed-publish:node:2", "feed-publish:node:3", "feed-publish:node:4", "feed-publish:node:5"],
        "linkIds": ["feed-publish:relation:2"],
        "statuses": {
          "feed-publish:node:4": "unavailable",
          "feed-publish:node:3": "under-pressure",
          "feed-publish:node:2": "active"
        }
      }
    ],
    "views": [
      {
        "id": "feed-publish:view:commit",
        "title": "Post and outbox transaction",
        "description": "Inspect the atomic handoff before derived timeline work.",
        "members": ["feed-publish:node:0", "feed-publish:node:1", "feed-publish:node:2", "feed-publish:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "feed-publish:view:fanout",
        "title": "Asynchronous fanout",
        "description": "Retained intent drives repeatable inbox materialization.",
        "members": ["feed-publish:node:2", "feed-publish:node:3", "feed-publish:node:4", "feed-publish:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-publish:predict:failed-relay",
        "title": "Predict a failed fanout handoff",
        "prompt": "The post and outbox commit, then Worker becomes unavailable. What remains recoverable?",
        "options": ["The canonical post and durable fanout intent", "Only full media copies in every inbox", "Nothing until the publisher posts again"],
        "correctIndex": 0,
        "explanation": "Post store remains authoritative and Outbox retains fanout intent. Workers can resume the derived inbox writes idempotently when recovered.",
        "reveal": {
          "id": "feed-publish:reveal:failed-relay",
          "title": "Predict a failed fanout handoff",
          "description": "Post store remains authoritative and Outbox retains fanout intent. Workers can resume the derived inbox writes idempotently when recovered.",
          "nodeIds": ["feed-publish:node:2", "feed-publish:node:3", "feed-publish:node:4", "feed-publish:node:5"],
          "linkIds": ["feed-publish:relation:2", "feed-publish:relation:3", "feed-publish:relation:4"],
          "statuses": {
            "feed-publish:node:4": "unavailable",
            "feed-publish:node:3": "under-pressure",
            "feed-publish:node:2": "active"
          },
          "viewId": "feed-publish:view:fanout"
        }
      }
    ]
  },
  "feed-media": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-media:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "feed-media:node:1": {"lane": 1, "order": 1, "semanticId": "object-store"},
      "feed-media:node:2": {"lane": 1, "order": 3, "semanticId": "post-store"},
      "feed-media:node:3": {"lane": 2, "order": 1, "semanticId": "processor"},
      "feed-media:node:4": {"lane": 3, "order": 1, "semanticId": "cdn"},
      "feed-media:node:5": {"lane": 3, "order": 3, "semanticId": "reader"}
    },
    "relationships": {
      "feed-media:relation:0": {"meaning": "request", "condition": "", "explanation": "Client → Object store: upload. original media."},
      "feed-media:relation:1": {"meaning": "publish", "condition": "", "explanation": "Client → Post store: publish ref. object key + ACL."},
      "feed-media:relation:2": {"meaning": "connection", "condition": "", "explanation": "Object store → Processor: process. scan + variants."},
      "feed-media:relation:3": {"meaning": "delivery", "condition": "", "explanation": "Processor → CDN: deliver. approved variants."},
      "feed-media:relation:4": {"meaning": "read", "condition": "", "explanation": "CDN → Reader: fetch. authorized access."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "feed-media:explain:1",
        "title": "Store media separately from post records",
        "description": "The client uploads images or video to object storage through a controlled upload path. Processing workers can scan, resize, or transcode the files before a post references a ready media object. The post database retains metadata, ownership, and object keys; it does not carry large video bytes through every feed query.",
        "nodeIds": ["feed-media:node:0", "feed-media:node:1", "feed-media:node:2", "feed-media:node:3"],
        "linkIds": ["feed-media:relation:0", "feed-media:relation:1", "feed-media:relation:2"],
        "viewId": "feed-media:view:point-1"
      },
      {
        "id": "feed-media:explain:2",
        "title": "Deliver approved variants with authorization",
        "description": "A CDN serves approved variants near readers. The feed API returns media URLs or tokens alongside post metadata; the browser fetches the bytes separately. Private media requires an authorization-aware delivery strategy, such as short-lived signed access, rather than assuming a public CDN URL is safe.",
        "nodeIds": ["feed-media:node:1", "feed-media:node:2", "feed-media:node:3", "feed-media:node:4", "feed-media:node:5"],
        "linkIds": ["feed-media:relation:2", "feed-media:relation:3", "feed-media:relation:4"],
        "viewId": "feed-media:view:point-2"
      },
      {
        "id": "feed-media:explain:3",
        "title": "Reconcile orphaned and revoked objects",
        "description": "If upload succeeds but publishing fails, clean up the unreferenced object after a grace period. If processing is delayed, show an explicit pending state or postpone publication according to the product promise. Deleting a post must also make cached media inaccessible within the required revocation window.",
        "nodeIds": ["feed-media:node:0", "feed-media:node:1", "feed-media:node:2"],
        "linkIds": ["feed-media:relation:0", "feed-media:relation:1"],
        "viewId": "feed-media:view:point-3"
      }
    ],
    "views": [
      {
        "id": "feed-media:view:point-1",
        "title": "Store media separately from post records",
        "description": "The client uploads images or video to object storage through a controlled upload path. Processing workers can scan, resize, or transcode the files before a post references a ready media object. The post database retains metadata, ownership, and object keys; it does not carry large video bytes through every feed query.",
        "members": ["feed-media:node:0", "feed-media:node:1", "feed-media:node:2", "feed-media:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "feed-media:view:point-2",
        "title": "Deliver approved variants with authorization",
        "description": "A CDN serves approved variants near readers. The feed API returns media URLs or tokens alongside post metadata; the browser fetches the bytes separately. Private media requires an authorization-aware delivery strategy, such as short-lived signed access, rather than assuming a public CDN URL is safe.",
        "members": ["feed-media:node:1", "feed-media:node:2", "feed-media:node:3", "feed-media:node:4", "feed-media:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "feed-media:view:point-3",
        "title": "Reconcile orphaned and revoked objects",
        "description": "If upload succeeds but publishing fails, clean up the unreferenced object after a grace period. If processing is delayed, show an explicit pending state or postpone publication according to the product promise. Deleting a post must also make cached media inaccessible within the required revocation window.",
        "members": ["feed-media:node:0", "feed-media:node:1", "feed-media:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-media:predict:feed-q08",
        "title": "Predict the design consequence",
        "prompt": "A private image is cached at an edge. What should govern future access?",
        "options": ["The image filename alone", "A permanent public URL", "The number of likes", "A revocable or short-lived authorized delivery path"],
        "correctIndex": 3,
        "explanation": "Private media cannot rely on an indefinitely reusable public URL after audience or deletion changes.",
        "reveal": {
          "id": "feed-media:reveal:feed-q08",
          "title": "Why this choice follows",
          "description": "Private media cannot rely on an indefinitely reusable public URL after audience or deletion changes.",
          "nodeIds": ["feed-media:node:1", "feed-media:node:2", "feed-media:node:4", "feed-media:node:5"],
          "linkIds": ["feed-media:relation:4"]
        }
      }
    ]
  },
  "feed-fanout": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-fanout:node:0": {"lane": 0, "order": 1, "semanticId": "ordinary-author"},
      "feed-fanout:node:1": {"lane": 0, "order": 3, "semanticId": "large-author"},
      "feed-fanout:node:2": {"lane": 1, "order": 1, "semanticId": "fanout-queue"},
      "feed-fanout:node:3": {"lane": 1, "order": 3, "semanticId": "author-index"},
      "feed-fanout:node:4": {"lane": 2, "order": 1, "semanticId": "inbox-ids"},
      "feed-fanout:node:5": {"lane": 2, "order": 3, "semanticId": "merge"},
      "feed-fanout:node:6": {"lane": 3, "order": 2, "semanticId": "reader"}
    },
    "relationships": {
      "feed-fanout:relation:0": {"meaning": "delivery", "condition": "", "explanation": "Ordinary author → Fanout queue: push. push on write."},
      "feed-fanout:relation:1": {"meaning": "write", "condition": "", "explanation": "Fanout queue → Inbox IDs: write. precomputed."},
      "feed-fanout:relation:2": {"meaning": "connection", "condition": "", "explanation": "Large author → Author index: index. pull on read."},
      "feed-fanout:relation:3": {"meaning": "connection", "condition": "", "explanation": "Inbox IDs → Merge: candidates. dedupe IDs."},
      "feed-fanout:relation:4": {"meaning": "connection", "condition": "", "explanation": "Author index → Merge: pull. dedupe IDs."},
      "feed-fanout:relation:5": {"meaning": "read", "condition": "", "explanation": "Merge → Reader: read. one feed."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "feed-fanout:explain:1",
        "title": "Compare write fanout with read fanout",
        "description": "Fanout on write adds a post ID to each eligible follower’s timeline as the author publishes. Reads become cheap because the candidate list is ready, but a high-follower author creates many writes and inactive followers consume needless work. Fanout on read queries followed authors’ recent posts when a reader opens the feed, reducing idle writes but increasing read latency and merge cost.",
        "nodeIds": ["feed-fanout:node:0", "feed-fanout:node:2", "feed-fanout:node:3", "feed-fanout:node:5", "feed-fanout:node:6"],
        "linkIds": ["feed-fanout:relation:0", "feed-fanout:relation:4", "feed-fanout:relation:5"],
        "viewId": "feed-fanout:view:point-1"
      },
      {
        "id": "feed-fanout:explain:2",
        "title": "Choose a hybrid for large publishers",
        "description": "A hybrid pushes ordinary authors to follower inboxes and leaves very large authors in their own recent-post indexes. At read time the feed service merges the reader’s inbox with recent posts from those high-follower authors. The threshold is a measured choice based on follower count, active-reader fraction, publish rate, fanout lag, and read latency.",
        "nodeIds": ["feed-fanout:node:0", "feed-fanout:node:1", "feed-fanout:node:3", "feed-fanout:node:5", "feed-fanout:node:6"],
        "linkIds": ["feed-fanout:relation:2", "feed-fanout:relation:4", "feed-fanout:relation:5"],
        "viewId": "feed-fanout:view:point-2"
      },
      {
        "id": "feed-fanout:explain:3",
        "title": "Size the work by active demand",
        "description": "Avoid treating a follower count as a complete cost estimate. One million inactive followers differ from one million readers refreshing now. Bound work with queue partitions, per-author limits, and backpressure. Changing an author between push and pull needs a transition rule so posts are neither absent nor shown twice.",
        "nodeIds": ["feed-fanout:node:0", "feed-fanout:node:1", "feed-fanout:node:2", "feed-fanout:node:3", "feed-fanout:node:6"],
        "linkIds": ["feed-fanout:relation:0", "feed-fanout:relation:2"],
        "viewId": "feed-fanout:view:point-3"
      }
    ],
    "views": [
      {
        "id": "feed-fanout:view:point-1",
        "title": "Compare write fanout with read fanout",
        "description": "Fanout on write adds a post ID to each eligible follower’s timeline as the author publishes. Reads become cheap because the candidate list is ready, but a high-follower author creates many writes and inactive followers consume needless work. Fanout on read queries followed authors’ recent posts when a reader opens the feed, reducing idle writes but increasing read latency and merge cost.",
        "members": ["feed-fanout:node:0", "feed-fanout:node:2", "feed-fanout:node:3", "feed-fanout:node:5", "feed-fanout:node:6"],
        "layout": "pipeline"
      },
      {
        "id": "feed-fanout:view:point-2",
        "title": "Choose a hybrid for large publishers",
        "description": "A hybrid pushes ordinary authors to follower inboxes and leaves very large authors in their own recent-post indexes. At read time the feed service merges the reader’s inbox with recent posts from those high-follower authors. The threshold is a measured choice based on follower count, active-reader fraction, publish rate, fanout lag, and read latency.",
        "members": ["feed-fanout:node:0", "feed-fanout:node:1", "feed-fanout:node:3", "feed-fanout:node:5", "feed-fanout:node:6"],
        "layout": "pipeline"
      },
      {
        "id": "feed-fanout:view:point-3",
        "title": "Size the work by active demand",
        "description": "Avoid treating a follower count as a complete cost estimate. One million inactive followers differ from one million readers refreshing now. Bound work with queue partitions, per-author limits, and backpressure. Changing an author between push and pull needs a transition rule so posts are neither absent nor shown twice.",
        "members": ["feed-fanout:node:0", "feed-fanout:node:1", "feed-fanout:node:2", "feed-fanout:node:3", "feed-fanout:node:6"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-fanout:predict:feed-q11",
        "title": "Predict the design consequence",
        "prompt": "A high-follower account posts to mostly inactive followers. Which approach avoids millions of idle inbox writes?",
        "options": ["Copy full post bodies", "Pin all content in CDN", "Pull its recent posts at read time or selectively push to active readers", "Disable pagination"],
        "correctIndex": 2,
        "explanation": "Read fanout or hybrid delivery shifts work toward people who actually open the feed.",
        "reveal": {
          "id": "feed-fanout:reveal:feed-q11",
          "title": "Why this choice follows",
          "description": "Read fanout or hybrid delivery shifts work toward people who actually open the feed.",
          "nodeIds": ["feed-fanout:node:1", "feed-fanout:node:3", "feed-fanout:node:5", "feed-fanout:node:6"],
          "linkIds": ["feed-fanout:relation:2", "feed-fanout:relation:4", "feed-fanout:relation:5"]
        }
      }
    ]
  },
  "feed-read": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-read:node:0": {"lane": 0, "order": 1, "semanticId": "inbox"},
      "feed-read:node:1": {"lane": 0, "order": 3, "semanticId": "author-index"},
      "feed-read:node:2": {"lane": 1, "order": 2, "semanticId": "merge"},
      "feed-read:node:3": {"lane": 2, "order": 2, "semanticId": "access-check"},
      "feed-read:node:4": {"lane": 3, "order": 1, "semanticId": "post-user-cache"},
      "feed-read:node:5": {"lane": 3, "order": 3, "semanticId": "page"}
    },
    "relationships": {
      "feed-read:relation:0": {"meaning": "read", "condition": "When assembling a bounded candidate window for this reader.", "explanation": "This authored input supplies post IDs for merge and deduplication, not guaranteed visibility."},
      "feed-read:relation:1": {"meaning": "read", "condition": "When assembling a bounded candidate window for this reader.", "explanation": "This authored input supplies post IDs for merge and deduplication, not guaranteed visibility."},
      "feed-read:relation:2": {"meaning": "decision", "condition": "For every merged candidate before returning content.", "explanation": "Current authorization must be evaluated on candidate IDs."},
      "feed-read:relation:3": {"meaning": "read", "condition": "Only for candidates allowed under current policy.", "explanation": "Hydrate post and user details after authorization."},
      "feed-read:relation:4": {"meaning": "response", "condition": "After allowed candidates are hydrated and a continuation cursor is formed.", "explanation": "Return page items and cursor, with media references rather than media bytes."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "feed-read:candidates",
        "title": "Merge pushed and pulled candidates",
        "description": "The service obtains precomputed Inbox IDs and recent Author index IDs, then merges and removes duplicate candidates. Neither input is permanent read permission.",
        "nodeIds": ["feed-read:node:0", "feed-read:node:1", "feed-read:node:2"],
        "linkIds": ["feed-read:relation:0", "feed-read:relation:1"]
      },
      {
        "id": "feed-read:authorize",
        "title": "Check current rules before hydration",
        "description": "Candidate IDs pass current follow, block, mute, deletion, and audience rules. Only allowed records continue into detail hydration.",
        "nodeIds": ["feed-read:node:2", "feed-read:node:3", "feed-read:node:4"],
        "linkIds": ["feed-read:relation:2", "feed-read:relation:3"]
      },
      {
        "id": "feed-read:page",
        "title": "Hydrate and return stable continuation",
        "description": "Post and author details form the page. A cursor based on stable ordering keys avoids page-two offset shifts when new posts arrive.",
        "nodeIds": ["feed-read:node:3", "feed-read:node:4", "feed-read:node:5"],
        "linkIds": ["feed-read:relation:3", "feed-read:relation:4"]
      },
      {
        "id": "feed-read:cold-cache",
        "title": "A cold cache affects latency, not canonical existence",
        "description": "The cache is derived. A miss can rebuild a bounded page from durable indexes; media references are returned rather than bulk media bytes.",
        "nodeIds": ["feed-read:node:0", "feed-read:node:1", "feed-read:node:2", "feed-read:node:3", "feed-read:node:4", "feed-read:node:5"],
        "linkIds": ["feed-read:relation:0", "feed-read:relation:1", "feed-read:relation:2", "feed-read:relation:3", "feed-read:relation:4"]
      }
    ],
    "views": [
      {
        "id": "feed-read:view:merge",
        "title": "Candidate merge",
        "description": "Compare pushed inbox references and pulled author references.",
        "members": ["feed-read:node:0", "feed-read:node:1", "feed-read:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "feed-read:view:authorized-page",
        "title": "Authorized page",
        "description": "Follow current authorization before hydration and response.",
        "members": ["feed-read:node:2", "feed-read:node:3", "feed-read:node:4", "feed-read:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-read:predict:stale-inbox",
        "title": "Predict an old inbox entry",
        "prompt": "Inbox contains a post reference whose audience no longer permits the reader. Which displayed stage prevents it from reaching Page?",
        "options": ["Access check", "Inbox presence alone", "Post + user cache merely being warm"],
        "correctIndex": 0,
        "explanation": "Inbox is a source of candidate IDs. The Merge → Access check → allowed path enforces current authorization before hydration and Page output.",
        "reveal": {
          "id": "feed-read:reveal:stale-inbox",
          "title": "Predict an old inbox entry",
          "description": "Inbox is a source of candidate IDs. The Merge → Access check → allowed path enforces current authorization before hydration and Page output.",
          "nodeIds": ["feed-read:node:0", "feed-read:node:2", "feed-read:node:3", "feed-read:node:4", "feed-read:node:5"],
          "linkIds": ["feed-read:relation:0", "feed-read:relation:2", "feed-read:relation:3", "feed-read:relation:4"]
        }
      }
    ]
  },
  "feed-ranking": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-ranking:node:0": {"lane": 0, "order": 2, "semanticId": "candidates"},
      "feed-ranking:node:1": {"lane": 1, "order": 2, "semanticId": "access-check"},
      "feed-ranking:node:2": {"lane": 2, "order": 1, "semanticId": "chronological"},
      "feed-ranking:node:3": {"lane": 2, "order": 3, "semanticId": "ranked"},
      "feed-ranking:node:4": {"lane": 3, "order": 2, "semanticId": "page-token"}
    },
    "relationships": {
      "feed-ranking:relation:0": {"meaning": "connection", "condition": "", "explanation": "Candidates (inbox + pull) leads to Access check (allowed only) in this lesson. Candidate selection, authorization, and ranking are distinct stages."},
      "feed-ranking:relation:1": {"meaning": "connection", "condition": "", "explanation": "Access check → Chronological: recency. time + ID."},
      "feed-ranking:relation:2": {"meaning": "connection", "condition": "", "explanation": "Access check → Ranked: relevance. bounded scoring."},
      "feed-ranking:relation:3": {"meaning": "connection", "condition": "", "explanation": "Chronological (time + ID) leads to Page token (stable continuation) in this lesson. Candidate selection, authorization, and ranking are distinct stages."},
      "feed-ranking:relation:4": {"meaning": "connection", "condition": "", "explanation": "Ranked (bounded scoring) leads to Page token (stable continuation) in this lesson. Candidate selection, authorization, and ranking are distinct stages."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "feed-ranking:explain:1",
        "title": "Separate candidate selection from ordering",
        "description": "Chronological ordering makes the first version easy to reason about: newest eligible posts appear first. A ranked feed changes the product goal. The candidate stage still gathers allowed posts, but a ranking stage scores a bounded set using signals such as relationship strength, freshness, and prior interactions. The score is a derived value and may change as behavior changes.",
        "nodeIds": ["feed-ranking:node:0", "feed-ranking:node:1", "feed-ranking:node:2", "feed-ranking:node:3"],
        "linkIds": ["feed-ranking:relation:0", "feed-ranking:relation:1", "feed-ranking:relation:2"],
        "viewId": "feed-ranking:view:point-1"
      },
      {
        "id": "feed-ranking:explain:2",
        "title": "Apply access rules before ranking",
        "description": "Do not rank before access checks: a high score cannot make a private post visible. A ranking system also needs diversity, quality, and abuse controls; otherwise engagement signals can amplify spam. State whether the learner is designing a chronological feed or a ranked one, because the storage and pagination choices differ.",
        "nodeIds": ["feed-ranking:node:1", "feed-ranking:node:2", "feed-ranking:node:3"],
        "linkIds": ["feed-ranking:relation:1", "feed-ranking:relation:2"],
        "viewId": "feed-ranking:view:point-2"
      },
      {
        "id": "feed-ranking:explain:3",
        "title": "Keep continuation tied to ranked order",
        "description": "For ranked pagination, pin a feed session, snapshot candidate set, or carry an opaque continuation token that captures enough ordering state. Recomputing all scores between pages can reorder items and produce duplicates or gaps. Measure both relevance and freshness, not only click rate.",
        "nodeIds": ["feed-ranking:node:0", "feed-ranking:node:3", "feed-ranking:node:4"],
        "linkIds": ["feed-ranking:relation:4"],
        "viewId": "feed-ranking:view:point-3"
      }
    ],
    "views": [
      {
        "id": "feed-ranking:view:point-1",
        "title": "Separate candidate selection from ordering",
        "description": "Chronological ordering makes the first version easy to reason about: newest eligible posts appear first. A ranked feed changes the product goal. The candidate stage still gathers allowed posts, but a ranking stage scores a bounded set using signals such as relationship strength, freshness, and prior interactions. The score is a derived value and may change as behavior changes.",
        "members": ["feed-ranking:node:0", "feed-ranking:node:1", "feed-ranking:node:2", "feed-ranking:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "feed-ranking:view:point-2",
        "title": "Apply access rules before ranking",
        "description": "Do not rank before access checks: a high score cannot make a private post visible. A ranking system also needs diversity, quality, and abuse controls; otherwise engagement signals can amplify spam. State whether the learner is designing a chronological feed or a ranked one, because the storage and pagination choices differ.",
        "members": ["feed-ranking:node:1", "feed-ranking:node:2", "feed-ranking:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "feed-ranking:view:point-3",
        "title": "Keep continuation tied to ranked order",
        "description": "For ranked pagination, pin a feed session, snapshot candidate set, or carry an opaque continuation token that captures enough ordering state. Recomputing all scores between pages can reorder items and produce duplicates or gaps. Measure both relevance and freshness, not only click rate.",
        "members": ["feed-ranking:node:0", "feed-ranking:node:3", "feed-ranking:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-ranking:predict:feed-q17",
        "title": "Predict the design consequence",
        "prompt": "A team adds ranking but keeps a pure creation-time cursor. What should it change?",
        "options": ["The image format", "The follow graph data model only", "The login form", "Use a continuation token or snapshot tied to ranked order"],
        "correctIndex": 3,
        "explanation": "Ranked scores can change independently of creation time, so chronological cursors no longer describe page boundaries.",
        "reveal": {
          "id": "feed-ranking:reveal:feed-q17",
          "title": "Why this choice follows",
          "description": "Ranked scores can change independently of creation time, so chronological cursors no longer describe page boundaries.",
          "nodeIds": ["feed-ranking:node:1", "feed-ranking:node:2", "feed-ranking:node:3"],
          "linkIds": ["feed-ranking:relation:1", "feed-ranking:relation:2"]
        }
      }
    ]
  },
  "feed-privacy": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-privacy:node:0": {"lane": 0, "order": 1, "semanticId": "post-audience"},
      "feed-privacy:node:1": {"lane": 0, "order": 3, "semanticId": "relationship"},
      "feed-privacy:node:2": {"lane": 1, "order": 2, "semanticId": "old-inbox-id"},
      "feed-privacy:node:3": {"lane": 2, "order": 2, "semanticId": "read-filter"},
      "feed-privacy:node:4": {"lane": 3, "order": 1, "semanticId": "allowed"},
      "feed-privacy:node:5": {"lane": 3, "order": 3, "semanticId": "denied"}
    },
    "relationships": {
      "feed-privacy:relation:0": {"meaning": "decision", "condition": "When canonical post/audience version is reflected in derived state.", "explanation": "Canonical post and audience rules can change after an inbox pointer is created."},
      "feed-privacy:relation:1": {"meaning": "decision", "condition": "When follow, block, mute, or audience relationships change.", "explanation": "Existing inbox pointers can lag current relationship rules."},
      "feed-privacy:relation:2": {"meaning": "request", "condition": "When an old inbox ID is considered for a feed page.", "explanation": "The candidate passes current read filtering; the pointer is not proof of access."},
      "feed-privacy:relation:3": {"meaning": "decision", "condition": "Only if current authorization allows the post.", "explanation": "The allowed branch permits showing the post."},
      "feed-privacy:relation:4": {"meaning": "decision", "condition": "If current authorization denies or deletion suppresses the post.", "explanation": "The denied branch suppresses content before return."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "feed-privacy:derived",
        "title": "Old inbox references can outlive a rule",
        "description": "Canonical post/audience and relationship changes can leave a stale derived inbox pointer. A pointer is a candidate rather than permission.",
        "nodeIds": ["feed-privacy:node:0", "feed-privacy:node:1", "feed-privacy:node:2"],
        "linkIds": ["feed-privacy:relation:0", "feed-privacy:relation:1"]
      },
      {
        "id": "feed-privacy:current",
        "title": "Read filtering is the privacy boundary",
        "description": "Read filter checks current canonical rules before choosing the allowed or denied branch. Background invalidation reduces work but does not replace authorization.",
        "nodeIds": ["feed-privacy:node:0", "feed-privacy:node:1", "feed-privacy:node:2", "feed-privacy:node:3"],
        "linkIds": ["feed-privacy:relation:0", "feed-privacy:relation:1", "feed-privacy:relation:2"]
      },
      {
        "id": "feed-privacy:branches",
        "title": "Suppress denied content before return",
        "description": "The yes branch shows eligible content; the no branch suppresses it. Deletion tombstones and version checks also stop old fanout events from restoring deleted posts.",
        "nodeIds": ["feed-privacy:node:2", "feed-privacy:node:3", "feed-privacy:node:4", "feed-privacy:node:5"],
        "linkIds": ["feed-privacy:relation:2", "feed-privacy:relation:3", "feed-privacy:relation:4"]
      }
    ],
    "views": [
      {
        "id": "feed-privacy:view:decision",
        "title": "Visibility decision",
        "description": "Focus on the current read decision and its two outcomes.",
        "members": ["feed-privacy:node:2", "feed-privacy:node:3", "feed-privacy:node:4", "feed-privacy:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-privacy:predict:new-block",
        "title": "Predict a stale derived pointer",
        "prompt": "A reader is now blocked, but Old inbox ID still exists. Which branch should Read filter select?",
        "options": ["Denied: suppress the post", "Allowed because fanout once inserted it", "Allowed until every cache is empty"],
        "correctIndex": 0,
        "explanation": "Current canonical relationship and post rules decide access. The no relation reaches Denied even while the old derived pointer remains.",
        "reveal": {
          "id": "feed-privacy:reveal:new-block",
          "title": "Predict a stale derived pointer",
          "description": "Current canonical relationship and post rules decide access. The no relation reaches Denied even while the old derived pointer remains.",
          "nodeIds": ["feed-privacy:node:1", "feed-privacy:node:2", "feed-privacy:node:3", "feed-privacy:node:5"],
          "linkIds": ["feed-privacy:relation:1", "feed-privacy:relation:2", "feed-privacy:relation:4"]
        }
      }
    ]
  },
  "feed-operations": {
    "layout": "tiers",
    "nodeRoles": {
      "feed-operations:node:0": {"lane": 0, "order": 2, "semanticId": "post-api"},
      "feed-operations:node:1": {"lane": 1, "order": 2, "semanticId": "outbox"},
      "feed-operations:node:2": {"lane": 2, "order": 2, "semanticId": "workers"},
      "feed-operations:node:3": {"lane": 3, "order": 1, "semanticId": "feed-read"},
      "feed-operations:node:4": {"lane": 3, "order": 3, "semanticId": "monitor"}
    },
    "relationships": {
      "feed-operations:relation:0": {"meaning": "write", "condition": "", "explanation": "Post API → Outbox: persist. handoff gap."},
      "feed-operations:relation:1": {"meaning": "publish", "condition": "", "explanation": "Outbox → Workers: relay. queue age."},
      "feed-operations:relation:2": {"meaning": "connection", "condition": "", "explanation": "Workers → Feed read: inboxes. first-page latency."},
      "feed-operations:relation:3": {"meaning": "connection", "condition": "", "explanation": "Feed read → Monitor: measure. visible delay."},
      "feed-operations:relation:4": {"meaning": "connection", "condition": "", "explanation": "Workers → Monitor: lag. visible delay."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "feed-operations:explain:1",
        "title": "Measure reader freshness across the path",
        "description": "Define service-level signals across the complete path: post commit success, event handoff failures, fanout queue age, percentage of eligible followers seeing a post within the freshness target, feed first-page latency, cache hit rate, empty-feed rate, and media error rate. A healthy post API with hours of fanout lag is still a broken feed.",
        "nodeIds": ["feed-operations:node:0", "feed-operations:node:1", "feed-operations:node:2", "feed-operations:node:3"],
        "linkIds": ["feed-operations:relation:0", "feed-operations:relation:1", "feed-operations:relation:2"],
        "viewId": "feed-operations:view:point-1"
      },
      {
        "id": "feed-operations:explain:2",
        "title": "Recover derived timelines without losing posts",
        "description": "Retry workers with idempotent post-recipient keys and dead-letter handling for poison events. If the inbox cache or store is unavailable, offer a bounded pull from canonical recent-post indexes for a degraded first page if capacity allows. Limit that fallback so a broad cache outage does not overload the post database.",
        "nodeIds": ["feed-operations:node:0", "feed-operations:node:2", "feed-operations:node:3"],
        "linkIds": ["feed-operations:relation:2"],
        "viewId": "feed-operations:view:point-2"
      },
      {
        "id": "feed-operations:explain:3",
        "title": "Plan skew, partitions, and privacy suppression",
        "description": "Skew matters: a high-follower publisher can produce a burst even at a modest global posts-per-second rate. Partition work, cap concurrency, and monitor per-author hotspots. Reconcile sampled inboxes against canonical posts to detect lost fanout or duplicate entries. Revisit read and write fanout thresholds using observed activity, not a fixed rule from the diagram.",
        "nodeIds": ["feed-operations:node:0", "feed-operations:node:3", "feed-operations:node:4"],
        "linkIds": ["feed-operations:relation:3"],
        "viewId": "feed-operations:view:point-3"
      }
    ],
    "views": [
      {
        "id": "feed-operations:view:point-1",
        "title": "Measure reader freshness across the path",
        "description": "Define service-level signals across the complete path: post commit success, event handoff failures, fanout queue age, percentage of eligible followers seeing a post within the freshness target, feed first-page latency, cache hit rate, empty-feed rate, and media error rate. A healthy post API with hours of fanout lag is still a broken feed.",
        "members": ["feed-operations:node:0", "feed-operations:node:1", "feed-operations:node:2", "feed-operations:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "feed-operations:view:point-2",
        "title": "Recover derived timelines without losing posts",
        "description": "Retry workers with idempotent post-recipient keys and dead-letter handling for poison events. If the inbox cache or store is unavailable, offer a bounded pull from canonical recent-post indexes for a degraded first page if capacity allows. Limit that fallback so a broad cache outage does not overload the post database.",
        "members": ["feed-operations:node:0", "feed-operations:node:2", "feed-operations:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "feed-operations:view:point-3",
        "title": "Plan skew, partitions, and privacy suppression",
        "description": "Skew matters: a high-follower publisher can produce a burst even at a modest global posts-per-second rate. Partition work, cap concurrency, and monitor per-author hotspots. Reconcile sampled inboxes against canonical posts to detect lost fanout or duplicate entries. Revisit read and write fanout thresholds using observed activity, not a fixed rule from the diagram.",
        "members": ["feed-operations:node:0", "feed-operations:node:3", "feed-operations:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "feed-operations:predict:freshness-signal",
        "title": "Predict hidden feed delay",
        "prompt": "Workers show growing queue age while Feed read still has low first-page latency. Does a fast read alone establish that followers see new posts promptly?",
        "options": ["No; monitor worker lag and visible post delay too", "Yes; query latency proves fanout freshness", "Yes; post commit success proves all inboxes caught up"],
        "correctIndex": 0,
        "explanation": "Workers → Monitor measures lag, while Feed read → Monitor measures the page path. Fast reads can serve old derived state, so visible delay is a separate end-to-end signal.",
        "reveal": {
          "id": "feed-operations:reveal:freshness-signal",
          "title": "Predict hidden feed delay",
          "description": "Workers → Monitor measures lag, while Feed read → Monitor measures the page path. Fast reads can serve old derived state, so visible delay is a separate end-to-end signal.",
          "nodeIds": ["feed-operations:node:2", "feed-operations:node:3", "feed-operations:node:4"],
          "linkIds": ["feed-operations:relation:3", "feed-operations:relation:4"],
          "statuses": {
            "feed-operations:node:2": "under-pressure",
            "feed-operations:node:3": "active"
          }
        }
      }
    ]
  }
};
