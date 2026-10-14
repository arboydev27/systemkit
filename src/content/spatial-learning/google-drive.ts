import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const googleDriveTeachingContent: Record<string, TeachingContent> = {
  "drive-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-scope:node:0": {"lane": 0, "order": 2, "semanticId": "creator"},
      "drive-scope:node:1": {"lane": 1, "order": 2, "semanticId": "file-service"},
      "drive-scope:node:2": {"lane": 2, "order": 1, "semanticId": "storage"},
      "drive-scope:node:3": {"lane": 2, "order": 3, "semanticId": "other-devices"}
    },
    "relationships": {
      "drive-scope:relation:0": {"meaning": "request", "condition": "", "explanation": "Creator → File service: upload. identity + revision."},
      "drive-scope:relation:1": {"meaning": "write", "condition": "", "explanation": "File service → Storage: store. durable content bytes."},
      "drive-scope:relation:2": {"meaning": "replication", "condition": "", "explanation": "File service → Other devices: sync. download + sync."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-scope:explain:1",
        "title": "Separate file sync from live editing",
        "description": "The core jobs are upload, download, cross-device sync, revision history, and sharing. Clarify file size, clients, offline edits, sync delay, retention, and deletion behavior. Real-time collaborative document editing is a separate problem: syncing file revisions does not merge simultaneous keystrokes.",
        "nodeIds": ["drive-scope:node:0", "drive-scope:node:1", "drive-scope:node:3"],
        "linkIds": ["drive-scope:relation:0", "drive-scope:relation:2"],
        "viewId": "drive-scope:view:point-1"
      },
      {
        "id": "drive-scope:explain:2",
        "title": "Size operations, revisions, and bytes",
        "description": "Size operations and bytes separately. The book’s exercise assumes 10 million daily users, two uploads each per day, and 500 KB per file: about 20 million uploads and 10 TB of new originals each day before versions and replicas. That is roughly 230 average upload starts per second. Peak traffic, upload duration, and large-file tails matter too. Reserved quota is not the same as occupied storage.",
        "nodeIds": ["drive-scope:node:0", "drive-scope:node:1", "drive-scope:node:2"],
        "linkIds": ["drive-scope:relation:0", "drive-scope:relation:1"],
        "viewId": "drive-scope:view:point-2"
      }
    ],
    "views": [
      {
        "id": "drive-scope:view:point-1",
        "title": "Separate file sync from live editing",
        "description": "The core jobs are upload, download, cross-device sync, revision history, and sharing. Clarify file size, clients, offline edits, sync delay, retention, and deletion behavior. Real-time collaborative document editing is a separate problem: syncing file revisions does not merge simultaneous keystrokes.",
        "members": ["drive-scope:node:0", "drive-scope:node:1", "drive-scope:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "drive-scope:view:point-2",
        "title": "Size operations, revisions, and bytes",
        "description": "Size operations and bytes separately. The book’s exercise assumes 10 million daily users, two uploads each per day, and 500 KB per file: about 20 million uploads and 10 TB of new originals each day before versions and replicas. That is roughly 230 average upload starts per second. Peak traffic, upload duration, and large-file tails matter too. Reserved quota is not the same as occupied storage.",
        "members": ["drive-scope:node:0", "drive-scope:node:1", "drive-scope:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "drive-scope:predict:dq02",
        "title": "Predict the design consequence",
        "prompt": "What best estimates new original storage per day?",
        "options": ["Accounts × free quota", "Daily uploads × average file size", "API server count × RAM", "Number of folders"],
        "correctIndex": 1,
        "explanation": "Actual uploads and sizes estimate occupied new bytes before versions and replicas.",
        "reveal": {
          "id": "drive-scope:reveal:dq02",
          "title": "Why this choice follows",
          "description": "Actual uploads and sizes estimate occupied new bytes before versions and replicas.",
          "nodeIds": ["drive-scope:node:0", "drive-scope:node:1", "drive-scope:node:2"],
          "linkIds": ["drive-scope:relation:0", "drive-scope:relation:1"]
        }
      }
    ]
  },
  "drive-metadata": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-metadata:node:0": {"lane": 0, "order": 2, "semanticId": "file-api"},
      "drive-metadata:node:1": {"lane": 1, "order": 1, "semanticId": "metadata-db"},
      "drive-metadata:node:2": {"lane": 1, "order": 3, "semanticId": "object-store"},
      "drive-metadata:node:3": {"lane": 2, "order": 2, "semanticId": "ready-revision"}
    },
    "relationships": {
      "drive-metadata:relation:0": {"meaning": "connection", "condition": "", "explanation": "File API → Metadata DB: record. IDs + manifests."},
      "drive-metadata:relation:1": {"meaning": "request", "condition": "", "explanation": "File API → Object store: upload. ordered blocks."},
      "drive-metadata:relation:2": {"meaning": "write", "condition": "", "explanation": "Metadata DB → Ready revision: commit. commit + change event."},
      "drive-metadata:relation:3": {"meaning": "connection", "condition": "", "explanation": "Object store → Ready revision: verify. commit + change event."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-metadata:explain:1",
        "title": "Store names and manifests separately from bytes",
        "description": "Store file identity, owner, parent folder, name, current revision, status, size, and access rules in a metadata database. Immutable content blocks live in object storage. A revision manifest lists ordered block keys and checksums so a download can rebuild that version. Stable file IDs let a rename preserve identity and history.",
        "nodeIds": ["drive-metadata:node:0", "drive-metadata:node:1", "drive-metadata:node:2", "drive-metadata:node:3"],
        "linkIds": ["drive-metadata:relation:0", "drive-metadata:relation:1", "drive-metadata:relation:2", "drive-metadata:relation:3"]
      },
      {
        "id": "drive-metadata:explain:2",
        "title": "Verify objects before ready publication",
        "description": "Metadata and object storage cannot share a simple database transaction. Create a pending revision, upload and verify its objects, then atomically publish the ready revision and a durable change-log entry. A transactional outbox can deliver notifications after commit. Reconcile orphaned objects and pending records before cleanup.",
        "nodeIds": ["drive-metadata:node:0", "drive-metadata:node:1", "drive-metadata:node:2", "drive-metadata:node:3"],
        "linkIds": ["drive-metadata:relation:0", "drive-metadata:relation:1", "drive-metadata:relation:2", "drive-metadata:relation:3"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "drive-metadata:predict:dq04",
        "title": "Predict the design consequence",
        "prompt": "Metadata says ready, but a required block was never stored. What failed?",
        "options": ["CDN placement", "Publication before object verification", "Folder sorting", "Browser cookies"],
        "correctIndex": 1,
        "explanation": "Ready status must follow verification of all required bytes.",
        "reveal": {
          "id": "drive-metadata:reveal:dq04",
          "title": "Why this choice follows",
          "description": "Ready status must follow verification of all required bytes.",
          "nodeIds": ["drive-metadata:node:1", "drive-metadata:node:2", "drive-metadata:node:3"],
          "linkIds": ["drive-metadata:relation:2", "drive-metadata:relation:3"]
        }
      }
    ]
  },
  "drive-upload": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-upload:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "drive-upload:node:1": {"lane": 1, "order": 2, "semanticId": "upload-session"},
      "drive-upload:node:2": {"lane": 2, "order": 1, "semanticId": "object-store"},
      "drive-upload:node:3": {"lane": 2, "order": 3, "semanticId": "verifier"},
      "drive-upload:node:4": {"lane": 3, "order": 2, "semanticId": "revision"}
    },
    "relationships": {
      "drive-upload:relation:0": {"meaning": "connection", "condition": "", "explanation": "Client → Upload session: resume. scope + progress."},
      "drive-upload:relation:1": {"meaning": "connection", "condition": "", "explanation": "Upload session → Object store: chunks. durable chunks."},
      "drive-upload:relation:2": {"meaning": "connection", "condition": "", "explanation": "Upload session → Verifier: finalize. size + checksums."},
      "drive-upload:relation:3": {"meaning": "connection", "condition": "", "explanation": "Verifier → Revision: verified. ready once."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-upload:explain:1",
        "title": "Retain one resumable upload session",
        "description": "The client requests a session for a file and expected base revision. The API checks identity, write permission, and quota, then issues an expiring session or scoped storage permission. Numbered chunks let the client ask which byte ranges were accepted and resume only missing ranges after an interruption.",
        "nodeIds": ["drive-upload:node:0", "drive-upload:node:1", "drive-upload:node:2", "drive-upload:node:4"],
        "linkIds": ["drive-upload:relation:0", "drive-upload:relation:1"],
        "viewId": "drive-upload:view:point-1"
      },
      {
        "id": "drive-upload:explain:2",
        "title": "Verify chunks before final revision commit",
        "description": "At finalization, verify assembled size and checksum, inspect content according to policy, and record the ordered blocks. A content hash can help detect duplicates within an approved scope, but hash equality does not grant access. Compression helps some formats more than already-compressed media. Encrypt stored content and manage keys separately. Make finalization idempotent so a timed-out retry does not create two revisions.",
        "nodeIds": ["drive-upload:node:1", "drive-upload:node:3", "drive-upload:node:4"],
        "linkIds": ["drive-upload:relation:2", "drive-upload:relation:3"],
        "viewId": "drive-upload:view:point-2"
      }
    ],
    "views": [
      {
        "id": "drive-upload:view:point-1",
        "title": "Retain one resumable upload session",
        "description": "The client requests a session for a file and expected base revision. The API checks identity, write permission, and quota, then issues an expiring session or scoped storage permission. Numbered chunks let the client ask which byte ranges were accepted and resume only missing ranges after an interruption.",
        "members": ["drive-upload:node:0", "drive-upload:node:1", "drive-upload:node:2", "drive-upload:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "drive-upload:view:point-2",
        "title": "Verify chunks before final revision commit",
        "description": "At finalization, verify assembled size and checksum, inspect content according to policy, and record the ordered blocks. A content hash can help detect duplicates within an approved scope, but hash equality does not grant access. Compression helps some formats more than already-compressed media. Encrypt stored content and manage keys separately. Make finalization idempotent so a timed-out retry does not create two revisions.",
        "members": ["drive-upload:node:1", "drive-upload:node:3", "drive-upload:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "drive-upload:predict:dq05",
        "title": "Predict the design consequence",
        "prompt": "A mobile upload disconnects near completion. What should it do?",
        "options": ["Restart with a new file ID", "Publish without checks", "Resume missing ranges in the same session", "Ask the CDN to infer bytes"],
        "correctIndex": 2,
        "explanation": "The session records accepted ranges so only missing bytes transfer.",
        "reveal": {
          "id": "drive-upload:reveal:dq05",
          "title": "Why this choice follows",
          "description": "The session records accepted ranges so only missing bytes transfer.",
          "nodeIds": ["drive-upload:node:0", "drive-upload:node:1", "drive-upload:node:2"],
          "linkIds": ["drive-upload:relation:0", "drive-upload:relation:1"]
        }
      }
    ]
  },
  "drive-sync": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-sync:node:0": {"lane": 0, "order": 2, "semanticId": "device-a"},
      "drive-sync:node:1": {"lane": 1, "order": 2, "semanticId": "change-log"},
      "drive-sync:node:2": {"lane": 2, "order": 1, "semanticId": "notification"},
      "drive-sync:node:3": {"lane": 2, "order": 3, "semanticId": "device-b"}
    },
    "relationships": {
      "drive-sync:relation:0": {"meaning": "write", "condition": "", "explanation": "Device A → Change log: commit. ordered events."},
      "drive-sync:relation:1": {"meaning": "connection", "condition": "", "explanation": "Change log → Notification: hint. wake-up hint."},
      "drive-sync:relation:2": {"meaning": "connection", "condition": "", "explanation": "Change log → Device B: pull since cursor. saved cursor."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-sync:explain:1",
        "title": "Record committed changes in order",
        "description": "Each committed change adds an ordered event for its account or namespace: file ID, revision, operation, and sequence. A device saves its last applied cursor. On reconnect it requests paginated changes after that cursor, applies them, and advances the cursor only after local state is durable. An expired cursor requires a consistent snapshot followed by later changes. Shared-file updates must enter each authorized recipient’s change view; revocation removes the file from that view without exposing new content.",
        "nodeIds": ["drive-sync:node:0", "drive-sync:node:1", "drive-sync:node:3"],
        "linkIds": ["drive-sync:relation:0", "drive-sync:relation:2"],
        "viewId": "drive-sync:view:point-1"
      },
      {
        "id": "drive-sync:explain:2",
        "title": "Use notifications to trigger cursor recovery",
        "description": "Push, long polling, or WebSocket can alert an online device that something changed. Signals may be duplicated or missed, so clients pull the authoritative change log. The receiving device fetches metadata, downloads only missing blocks, and rebuilds the revision. Access revocation must stop protected downloads even when an old object key is known.",
        "nodeIds": ["drive-sync:node:0", "drive-sync:node:1", "drive-sync:node:3"],
        "linkIds": ["drive-sync:relation:0", "drive-sync:relation:2"]
      }
    ],
    "views": [
      {
        "id": "drive-sync:view:point-1",
        "title": "Record committed changes in order",
        "description": "Each committed change adds an ordered event for its account or namespace: file ID, revision, operation, and sequence. A device saves its last applied cursor. On reconnect it requests paginated changes after that cursor, applies them, and advances the cursor only after local state is durable. An expired cursor requires a consistent snapshot followed by later changes. Shared-file updates must enter each authorized recipient’s change view; revocation removes the file from that view without exposing new content.",
        "members": ["drive-sync:node:0", "drive-sync:node:1", "drive-sync:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "drive-sync:predict:missed-notification",
        "title": "Predict a missed wake-up hint",
        "prompt": "Device B misses Notification while offline. Which displayed path recovers committed revisions when it returns?",
        "options": ["Change log → Device B after its saved cursor", "Notification as the complete file history", "Device A must upload every file again"],
        "correctIndex": 0,
        "explanation": "Notification is only a wake-up hint. The durable Change log → Device B pull path uses the saved cursor to recover missed committed events.",
        "reveal": {
          "id": "drive-sync:reveal:missed-notification",
          "title": "Predict a missed wake-up hint",
          "description": "Notification is only a wake-up hint. The durable Change log → Device B pull path uses the saved cursor to recover missed committed events.",
          "nodeIds": ["drive-sync:node:1", "drive-sync:node:2", "drive-sync:node:3"],
          "linkIds": ["drive-sync:relation:1", "drive-sync:relation:2"]
        }
      }
    ]
  },
  "drive-conflicts": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-conflicts:node:0": {"lane": 0, "order": 1, "semanticId": "phone"},
      "drive-conflicts:node:1": {"lane": 0, "order": 3, "semanticId": "laptop"},
      "drive-conflicts:node:2": {"lane": 1, "order": 2, "semanticId": "current-file"},
      "drive-conflicts:node:3": {"lane": 2, "order": 1, "semanticId": "publish"},
      "drive-conflicts:node:4": {"lane": 2, "order": 3, "semanticId": "conflict-copy"}
    },
    "relationships": {
      "drive-conflicts:relation:0": {"meaning": "connection", "condition": "", "explanation": "Phone → Current file: first. revision 13."},
      "drive-conflicts:relation:1": {"meaning": "connection", "condition": "", "explanation": "Laptop → Current file: later. revision 13."},
      "drive-conflicts:relation:2": {"meaning": "write", "condition": "", "explanation": "Current file → Publish: commit. base matched."},
      "drive-conflicts:relation:3": {"meaning": "connection", "condition": "", "explanation": "Current file → Conflict copy: preserve. base no longer matches."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-conflicts:explain:1",
        "title": "Compare the upload’s expected base revision",
        "description": "Each upload declares the revision it was based on. At commit, compare that base with the current revision. A match publishes a new immutable version; a mismatch preserves the submitted bytes as a conflict copy or draft. The user may compare, merge when the file format permits it, or choose a version. Silent last-writer-wins can destroy work.",
        "nodeIds": ["drive-conflicts:node:0", "drive-conflicts:node:1", "drive-conflicts:node:2", "drive-conflicts:node:3", "drive-conflicts:node:4"],
        "linkIds": ["drive-conflicts:relation:0", "drive-conflicts:relation:1", "drive-conflicts:relation:2", "drive-conflicts:relation:3"]
      },
      {
        "id": "drive-conflicts:explain:2",
        "title": "Retain versions and deletion tombstones",
        "description": "Retain revisions according to an explicit policy. Delta sync transfers changed blocks, but each manifest still needs enough references to reconstruct its revision. Renames, moves, and deletions can also conflict. Stable IDs and deletion tombstones prevent an offline copy from accidentally resurrecting a removed file. File sync is not a collaborative text protocol.",
        "nodeIds": ["drive-conflicts:node:2", "drive-conflicts:node:4"],
        "linkIds": ["drive-conflicts:relation:3"],
        "viewId": "drive-conflicts:view:point-2"
      }
    ],
    "views": [
      {
        "id": "drive-conflicts:view:point-2",
        "title": "Retain versions and deletion tombstones",
        "description": "Retain revisions according to an explicit policy. Delta sync transfers changed blocks, but each manifest still needs enough references to reconstruct its revision. Renames, moves, and deletions can also conflict. Stable IDs and deletion tombstones prevent an offline copy from accidentally resurrecting a removed file. File sync is not a collaborative text protocol.",
        "members": ["drive-conflicts:node:2", "drive-conflicts:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "drive-conflicts:predict:stale-laptop",
        "title": "Predict the stale edit branch",
        "prompt": "Laptop submits an edit based on revision 12, but Current file is already revision 13. Which branch preserves its competing content?",
        "options": ["Conflict copy", "Publish as though the base still matched", "Silently discard the newer revision"],
        "correctIndex": 0,
        "explanation": "The expected base no longer matches Current file. The preserve relation selects Conflict copy instead of treating the stale edit as an ordinary base-matched publish.",
        "reveal": {
          "id": "drive-conflicts:reveal:stale-laptop",
          "title": "Predict the stale edit branch",
          "description": "The expected base no longer matches Current file. The preserve relation selects Conflict copy instead of treating the stale edit as an ordinary base-matched publish.",
          "nodeIds": ["drive-conflicts:node:1", "drive-conflicts:node:2", "drive-conflicts:node:3", "drive-conflicts:node:4"],
          "linkIds": ["drive-conflicts:relation:1", "drive-conflicts:relation:3"]
        }
      }
    ]
  },
  "drive-sharing": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-sharing:node:0": {"lane": 0, "order": 2, "semanticId": "viewer"},
      "drive-sharing:node:1": {"lane": 1, "order": 2, "semanticId": "access-check"},
      "drive-sharing:node:2": {"lane": 2, "order": 1, "semanticId": "metadata"},
      "drive-sharing:node:3": {"lane": 2, "order": 3, "semanticId": "content"}
    },
    "relationships": {
      "drive-sharing:relation:0": {"meaning": "request", "condition": "", "explanation": "Viewer → Access check: request. current rules."},
      "drive-sharing:relation:1": {"meaning": "decision", "condition": "Only when the current authorization policy allows the operation.", "explanation": "Access check → Metadata: allowed. list + revision."},
      "drive-sharing:relation:2": {"meaning": "decision", "condition": "Only when the current authorization policy allows the operation.", "explanation": "Access check → Content: allowed. short-lived URL."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-sharing:explain:1",
        "title": "Authorize metadata and byte access",
        "description": "A file can be private, shared with named people, or accessed through a scoped link. Store rules against stable IDs and define folder inheritance, link expiry, and whether viewers can download or reshare. Check current effective permission before listing, reading metadata, issuing a download capability, or accepting writes. A guessed object key must not bypass the API gate.",
        "nodeIds": ["drive-sharing:node:0", "drive-sharing:node:1", "drive-sharing:node:2"],
        "linkIds": ["drive-sharing:relation:0", "drive-sharing:relation:1"],
        "viewId": "drive-sharing:view:point-1"
      },
      {
        "id": "drive-sharing:explain:2",
        "title": "Define the revocation window",
        "description": "Revocation should block new capabilities immediately. Short-lived signed URLs limit the life of previously issued links; strict immediate revocation may require online authorization at the serving edge. Cache keys and search results must respect effective access. Encrypt in transit and at rest, maintain keys, and audit sharing changes.",
        "nodeIds": ["drive-sharing:node:1", "drive-sharing:node:3"],
        "linkIds": ["drive-sharing:relation:2"],
        "viewId": "drive-sharing:view:point-2"
      }
    ],
    "views": [
      {
        "id": "drive-sharing:view:point-1",
        "title": "Authorize metadata and byte access",
        "description": "A file can be private, shared with named people, or accessed through a scoped link. Store rules against stable IDs and define folder inheritance, link expiry, and whether viewers can download or reshare. Check current effective permission before listing, reading metadata, issuing a download capability, or accepting writes. A guessed object key must not bypass the API gate.",
        "members": ["drive-sharing:node:0", "drive-sharing:node:1", "drive-sharing:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "drive-sharing:view:point-2",
        "title": "Define the revocation window",
        "description": "Revocation should block new capabilities immediately. Short-lived signed URLs limit the life of previously issued links; strict immediate revocation may require online authorization at the serving edge. Cache keys and search results must respect effective access. Encrypt in transit and at rest, maintain keys, and audit sharing changes.",
        "members": ["drive-sharing:node:1", "drive-sharing:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "drive-sharing:predict:dq12",
        "title": "Predict the design consequence",
        "prompt": "A shared link must stop working rapidly after revocation. What fits?",
        "options": ["A week-long signed URL", "Online checks or very short tokens", "Public immutable caching forever", "Only hide the name"],
        "correctIndex": 1,
        "explanation": "Long-lived capabilities remain valid until expiry without a serving-time check.",
        "reveal": {
          "id": "drive-sharing:reveal:dq12",
          "title": "Why this choice follows",
          "description": "Long-lived capabilities remain valid until expiry without a serving-time check.",
          "nodeIds": ["drive-sharing:node:1", "drive-sharing:node:2", "drive-sharing:node:3"],
          "linkIds": ["drive-sharing:relation:1", "drive-sharing:relation:2"]
        }
      }
    ]
  },
  "drive-download": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-download:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "drive-download:node:1": {"lane": 1, "order": 2, "semanticId": "manifest"},
      "drive-download:node:2": {"lane": 2, "order": 1, "semanticId": "existing-blocks"},
      "drive-download:node:3": {"lane": 2, "order": 3, "semanticId": "missing-block"}
    },
    "relationships": {
      "drive-download:relation:0": {"meaning": "read", "condition": "", "explanation": "Client → Manifest: read. ordered hashes."},
      "drive-download:relation:1": {"meaning": "connection", "condition": "", "explanation": "Manifest → Existing blocks: matches. reuse 99 of 100."},
      "drive-download:relation:2": {"meaning": "connection", "condition": "", "explanation": "Manifest → Missing block: changed. fetch + verify."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-download:explain:1",
        "title": "Fetch manifests and missing verified blocks",
        "description": "After checking access, the API returns a revision manifest and short-lived download capabilities. The client compares checksums against its local block cache, fetches missing objects, verifies them, and assembles them in order. Range requests and a nearby edge can help large downloads. Metadata and immutable blocks have different cache lifetimes.",
        "nodeIds": ["drive-download:node:0", "drive-download:node:1", "drive-download:node:2", "drive-download:node:3"],
        "linkIds": ["drive-download:relation:0", "drive-download:relation:1", "drive-download:relation:2"]
      },
      {
        "id": "drive-download:explain:2",
        "title": "Invalidate mutable pointers within access boundaries",
        "description": "Content-addressed blocks are easy to cache, but current-revision pointers and file listings need invalidation or short lifetimes. Private files need authorization before content delivery. Account-scoped deduplication avoids cross-user information leaks from global content lookup. Cold storage can save space for old revisions but adds retrieval delay.",
        "nodeIds": ["drive-download:node:0", "drive-download:node:1", "drive-download:node:2", "drive-download:node:3"],
        "linkIds": ["drive-download:relation:0", "drive-download:relation:1", "drive-download:relation:2"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "drive-download:predict:dq14",
        "title": "Predict the design consequence",
        "prompt": "One of 100 cached blocks changes. What does a delta-aware client need?",
        "options": ["All 100 again", "New manifest and changed block", "No manifest", "Only a push payload"],
        "correctIndex": 1,
        "explanation": "The manifest identifies order; verified unchanged blocks can be reused.",
        "reveal": {
          "id": "drive-download:reveal:dq14",
          "title": "Why this choice follows",
          "description": "The manifest identifies order; verified unchanged blocks can be reused.",
          "nodeIds": ["drive-download:node:0", "drive-download:node:1", "drive-download:node:2", "drive-download:node:3"],
          "linkIds": ["drive-download:relation:0", "drive-download:relation:1", "drive-download:relation:2"]
        }
      }
    ]
  },
  "drive-operations": {
    "layout": "tiers",
    "nodeRoles": {
      "drive-operations:node:0": {"lane": 0, "order": 1, "semanticId": "upload-health"},
      "drive-operations:node:1": {"lane": 0, "order": 3, "semanticId": "sync-health"},
      "drive-operations:node:2": {"lane": 1, "order": 2, "semanticId": "reconciliation"},
      "drive-operations:node:3": {"lane": 2, "order": 1, "semanticId": "restore"},
      "drive-operations:node:4": {"lane": 2, "order": 3, "semanticId": "recovery"}
    },
    "relationships": {
      "drive-operations:relation:0": {"meaning": "connection", "condition": "", "explanation": "Upload health → Reconciliation: observe. find gaps + orphans."},
      "drive-operations:relation:1": {"meaning": "connection", "condition": "", "explanation": "Sync health → Reconciliation: observe. find gaps + orphans."},
      "drive-operations:relation:2": {"meaning": "connection", "condition": "", "explanation": "Reconciliation → Restore: repair. metadata + blocks."},
      "drive-operations:relation:3": {"meaning": "connection", "condition": "", "explanation": "Reconciliation → Recovery: catch up. cursor replay + retry."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "drive-operations:explain:1",
        "title": "Restore metadata and required bytes together",
        "description": "Replicate durable objects and metadata to meet a stated recovery target, and test restores. Replace a failed stateless API or upload worker; promote a metadata replica with awareness of replication lag. A notification outage delays discovery but cursor replay recovers changes. Use retry backoff and jitter to avoid reconnection storms.",
        "nodeIds": ["drive-operations:node:0", "drive-operations:node:1", "drive-operations:node:2", "drive-operations:node:3", "drive-operations:node:4"],
        "linkIds": ["drive-operations:relation:0", "drive-operations:relation:1", "drive-operations:relation:2", "drive-operations:relation:3"]
      },
      {
        "id": "drive-operations:explain:2",
        "title": "Trace integrity and cross-device convergence",
        "description": "Trace an upload from chunks through verification, commit, change event, and another device’s download. Measure pending-upload age, checksum failures, change-log lag, cursor resets, sync convergence time, conflict rate, and restore success. Reconcile missing objects and orphaned blocks before garbage collection. Deletion must follow retention policy across revisions, backups, and links.",
        "nodeIds": ["drive-operations:node:0", "drive-operations:node:1", "drive-operations:node:2", "drive-operations:node:3", "drive-operations:node:4"],
        "linkIds": ["drive-operations:relation:0", "drive-operations:relation:1", "drive-operations:relation:2", "drive-operations:relation:3"]
      }
    ],
    "views": [],
    "predictions": [
      {
        "id": "drive-operations:predict:dq16",
        "title": "Predict the design consequence",
        "prompt": "Restored metadata references missing blocks. Why is restore incomplete?",
        "options": ["Metadata and content must recover together", "More users must sign in", "All names must change", "Cache should be larger"],
        "correctIndex": 0,
        "explanation": "A revision is usable only with its metadata and required bytes.",
        "reveal": {
          "id": "drive-operations:reveal:dq16",
          "title": "Why this choice follows",
          "description": "A revision is usable only with its metadata and required bytes.",
          "nodeIds": ["drive-operations:node:2", "drive-operations:node:3"],
          "linkIds": ["drive-operations:relation:2"]
        }
      }
    ]
  }
};
