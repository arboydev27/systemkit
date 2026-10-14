import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const youtubeTeachingContent: Record<string, TeachingContent> = {
  "youtube-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-scope:node:0": {"lane": 0, "order": 1, "semanticId": "creators"},
      "youtube-scope:node:1": {"lane": 0, "order": 3, "semanticId": "viewers"},
      "youtube-scope:node:2": {"lane": 1, "order": 1, "semanticId": "source-variants"},
      "youtube-scope:node:3": {"lane": 1, "order": 3, "semanticId": "cdn-traffic"},
      "youtube-scope:node:4": {"lane": 2, "order": 2, "semanticId": "capacity-decision"}
    },
    "relationships": {
      "youtube-scope:relation:0": {"meaning": "connection", "condition": "", "explanation": "Creators → Source + variants: bytes in. storage × retention."},
      "youtube-scope:relation:1": {"meaning": "connection", "condition": "", "explanation": "Viewers → CDN traffic: bytes out. egress × region."},
      "youtube-scope:relation:2": {"meaning": "connection", "condition": "", "explanation": "Source + variants (storage × retention) leads to Capacity decision (peak, cost, and risk) in this lesson. Size watch traffic, upload bytes, derived renditions, and peaks separately."},
      "youtube-scope:relation:3": {"meaning": "connection", "condition": "", "explanation": "CDN traffic (egress × region) leads to Capacity decision (peak, cost, and risk) in this lesson. Size watch traffic, upload bytes, derived renditions, and peaks separately."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "youtube-scope:explain:1",
        "title": "Separate creator and viewer jobs",
        "description": "Start with two jobs: a creator uploads a video and a viewer plays it on a phone, browser, or TV. Agree on maximum source size, supported devices, geographic reach, startup time, availability, and whether live streaming is in scope. Comments, recommendations, and subscriptions can wait; each adds a different system.",
        "nodeIds": ["youtube-scope:node:0", "youtube-scope:node:1", "youtube-scope:node:2"],
        "linkIds": ["youtube-scope:relation:0"],
        "viewId": "youtube-scope:view:point-1"
      },
      {
        "id": "youtube-scope:explain:2",
        "title": "Estimate uploads and delivery from behavior",
        "description": "Use behavior rather than registered users to estimate demand. As an exercise, five million daily viewers watching five 300 MB videos imply about 7.5 PB delivered per day. If 10% upload one 300 MB source daily, originals alone add about 150 TB per day before renditions, replication, and retention. These illustrative inputs are not current YouTube measurements. State peak-to-average ratios and recalculate when an assumption changes. Playback may dominate network egress, transcoding compute, and uploads storage.",
        "nodeIds": ["youtube-scope:node:0", "youtube-scope:node:1", "youtube-scope:node:2", "youtube-scope:node:3", "youtube-scope:node:4"],
        "linkIds": ["youtube-scope:relation:0", "youtube-scope:relation:1", "youtube-scope:relation:2", "youtube-scope:relation:3"]
      }
    ],
    "views": [
      {
        "id": "youtube-scope:view:point-1",
        "title": "Separate creator and viewer jobs",
        "description": "Start with two jobs: a creator uploads a video and a viewer plays it on a phone, browser, or TV. Agree on maximum source size, supported devices, geographic reach, startup time, availability, and whether live streaming is in scope. Comments, recommendations, and subscriptions can wait; each adds a different system.",
        "members": ["youtube-scope:node:0", "youtube-scope:node:1", "youtube-scope:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-scope:predict:yq01",
        "title": "Predict the design consequence",
        "prompt": "Which inputs best estimate daily video delivery?",
        "options": ["Registered accounts and table count", "Number of API servers", "Views, average delivered bytes per view, and geography", "Number of creators alone"],
        "correctIndex": 2,
        "explanation": "Delivered bytes depend on viewing behavior and quality; geography affects paths and costs.",
        "reveal": {
          "id": "youtube-scope:reveal:yq01",
          "title": "Why this choice follows",
          "description": "Delivered bytes depend on viewing behavior and quality; geography affects paths and costs.",
          "nodeIds": ["youtube-scope:node:1", "youtube-scope:node:3", "youtube-scope:node:4"],
          "linkIds": ["youtube-scope:relation:1", "youtube-scope:relation:3"]
        }
      }
    ]
  },
  "youtube-upload": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-upload:node:0": {"lane": 0, "order": 2, "semanticId": "creator"},
      "youtube-upload:node:1": {"lane": 1, "order": 1, "semanticId": "upload-api"},
      "youtube-upload:node:2": {"lane": 1, "order": 4, "semanticId": "pending-record"},
      "youtube-upload:node:3": {"lane": 2, "order": 2, "semanticId": "original-storage"}
    },
    "relationships": {
      "youtube-upload:relation:0": {"meaning": "request", "condition": "Before uploading to a protected object key.", "explanation": "The creator requests a scoped upload grant from the authenticated API."},
      "youtube-upload:relation:1": {"meaning": "write", "condition": "After upload checks succeed.", "explanation": "The API records owner, expected object, and pending status."},
      "youtube-upload:relation:2": {"meaning": "write", "condition": "While the scoped grant and upload session are valid.", "explanation": "The creator sends resumable video parts directly to original storage."},
      "youtube-upload:relation:3": {"meaning": "decision", "condition": "After storage completion and required verification.", "explanation": "The authored completion signal permits finalizing pending state only after the object is checked."}
    },
    "groups": [
      {
        "id": "youtube-upload:upload-control",
        "title": "Upload control",
        "description": "The API and pending record coordinate authorized upload state.",
        "members": ["youtube-upload:node:1", "youtube-upload:node:2"]
      }
    ],
    "scenes": [
      {
        "id": "youtube-upload:control",
        "title": "Authorize and record upload intent",
        "description": "The API checks identity, quota, and size, creates a pending record, and grants short-lived access scoped to one object key.",
        "nodeIds": ["youtube-upload:node:0", "youtube-upload:node:1", "youtube-upload:node:2"],
        "linkIds": ["youtube-upload:relation:0", "youtube-upload:relation:1"]
      },
      {
        "id": "youtube-upload:bytes",
        "title": "Send bulk bytes to original storage",
        "description": "The creator uploads resumable parts directly to object storage. The control API handles permission and metadata rather than every video byte.",
        "nodeIds": ["youtube-upload:node:0", "youtube-upload:node:1", "youtube-upload:node:3"],
        "linkIds": ["youtube-upload:relation:0", "youtube-upload:relation:2"]
      },
      {
        "id": "youtube-upload:finalize",
        "title": "Verify the durable original before processing",
        "description": "After completion, verify object size, checksum, and media type. Received means the original is durable; it does not mean playback is ready.",
        "nodeIds": ["youtube-upload:node:0", "youtube-upload:node:2", "youtube-upload:node:3"],
        "linkIds": ["youtube-upload:relation:2", "youtube-upload:relation:3"]
      }
    ],
    "views": [
      {
        "id": "youtube-upload:view:control",
        "title": "Upload control path",
        "description": "Inspect authorization and creation of pending metadata.",
        "members": ["youtube-upload:node:0", "youtube-upload:node:1", "youtube-upload:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "youtube-upload:view:data",
        "title": "Direct upload path",
        "description": "Bulk video parts go directly from Creator to Original storage.",
        "members": ["youtube-upload:node:0", "youtube-upload:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-upload:predict:parts-complete",
        "title": "Predict upload completion",
        "prompt": "Original storage has received all parts, but required checksum verification has not completed. Should Pending record advertise playback ready?",
        "options": ["No; verify the original, then process required outputs", "Yes; any received part proves playability", "Move video bytes into Pending record"],
        "correctIndex": 0,
        "explanation": "Original storage and Pending record represent different responsibilities. Finalization verifies a durable source before processing; a playable manifest and renditions are later work.",
        "reveal": {
          "id": "youtube-upload:reveal:parts-complete",
          "title": "Predict upload completion",
          "description": "Original storage and Pending record represent different responsibilities. Finalization verifies a durable source before processing; a playable manifest and renditions are later work.",
          "nodeIds": ["youtube-upload:node:2", "youtube-upload:node:3"],
          "linkIds": ["youtube-upload:relation:3"],
          "statuses": {
            "youtube-upload:node:3": "active"
          }
        }
      }
    ]
  },
  "youtube-pipeline": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-pipeline:node:0": {"lane": 0, "order": 2, "semanticId": "original"},
      "youtube-pipeline:node:1": {"lane": 1, "order": 2, "semanticId": "inspect"},
      "youtube-pipeline:node:2": {"lane": 2, "order": 2, "semanticId": "task-queue"},
      "youtube-pipeline:node:3": {"lane": 3, "order": 1, "semanticId": "encode"},
      "youtube-pipeline:node:4": {"lane": 3, "order": 3, "semanticId": "thumbnail"},
      "youtube-pipeline:node:5": {"lane": 4, "order": 2, "semanticId": "outputs"}
    },
    "relationships": {
      "youtube-pipeline:relation:0": {"meaning": "read", "condition": "When processing starts for a verified original.", "explanation": "Inspection reads the stored source."},
      "youtube-pipeline:relation:1": {"meaning": "publish", "condition": "After inspection succeeds and the task prerequisites are known.", "explanation": "The scheduler releases eligible processing tasks to the queue."},
      "youtube-pipeline:relation:2": {"meaning": "delivery", "condition": "When an encode task is eligible and a worker leases it.", "explanation": "The queue delivers an encoding task; media remains in object storage."},
      "youtube-pipeline:relation:3": {"meaning": "delivery", "condition": "When an independent thumbnail task is eligible.", "explanation": "The queue can release thumbnail work independently of encoding after its prerequisites."},
      "youtube-pipeline:relation:4": {"meaning": "write", "condition": "After required encoding succeeds.", "explanation": "Encoding writes the media outputs that publication must verify."},
      "youtube-pipeline:relation:5": {"meaning": "write", "condition": "After thumbnail generation succeeds.", "explanation": "Thumbnail output joins publication checks; it alone does not prove required media is ready."}
    },
    "groups": [
      {
        "id": "youtube-pipeline:processing",
        "title": "Processing workers",
        "description": "Leased tasks feed independently scheduled encoding and thumbnail workers.",
        "members": ["youtube-pipeline:node:2", "youtube-pipeline:node:3", "youtube-pipeline:node:4"]
      }
    ],
    "scenes": [
      {
        "id": "youtube-pipeline:inspect",
        "title": "Inspect the stored source first",
        "description": "Processing begins from a verified durable original. Inspection discovers media tracks and validation errors before dependent work is released.",
        "nodeIds": ["youtube-pipeline:node:0", "youtube-pipeline:node:1", "youtube-pipeline:node:2"],
        "linkIds": ["youtube-pipeline:relation:0", "youtube-pipeline:relation:1"]
      },
      {
        "id": "youtube-pipeline:parallel",
        "title": "Release independent tasks in parallel",
        "description": "After prerequisites finish, the task queue can release encoding and thumbnail work. Messages identify jobs and objects rather than carrying media bytes.",
        "nodeIds": ["youtube-pipeline:node:1", "youtube-pipeline:node:2", "youtube-pipeline:node:3", "youtube-pipeline:node:4"],
        "linkIds": ["youtube-pipeline:relation:1", "youtube-pipeline:relation:2", "youtube-pipeline:relation:3"]
      },
      {
        "id": "youtube-pipeline:publish",
        "title": "Require outputs before publication",
        "description": "Encode and thumbnail tasks write outputs. Required renditions and manifest must exist before the video can be published ready.",
        "nodeIds": ["youtube-pipeline:node:3", "youtube-pipeline:node:4", "youtube-pipeline:node:5"],
        "linkIds": ["youtube-pipeline:relation:4", "youtube-pipeline:relation:5"]
      },
      {
        "id": "youtube-pipeline:recover",
        "title": "Retry work without duplicating outputs",
        "description": "In this authored failure, Encode is unavailable while pending work remains in Task queue. Persist task state, lease work, bound retries, and make output writes idempotent.",
        "nodeIds": ["youtube-pipeline:node:2", "youtube-pipeline:node:3", "youtube-pipeline:node:4", "youtube-pipeline:node:5"],
        "linkIds": ["youtube-pipeline:relation:2", "youtube-pipeline:relation:3", "youtube-pipeline:relation:5"],
        "statuses": {
          "youtube-pipeline:node:2": "under-pressure",
          "youtube-pipeline:node:3": "unavailable",
          "youtube-pipeline:node:4": "active"
        }
      }
    ],
    "views": [
      {
        "id": "youtube-pipeline:view:parallel",
        "title": "Parallel processing",
        "description": "Compare independent branches released by the task queue.",
        "members": ["youtube-pipeline:node:1", "youtube-pipeline:node:2", "youtube-pipeline:node:3", "youtube-pipeline:node:4"],
        "layout": "peers"
      },
      {
        "id": "youtube-pipeline:view:output",
        "title": "Required output convergence",
        "description": "Both authored task branches converge on output verification and publication.",
        "members": ["youtube-pipeline:node:3", "youtube-pipeline:node:4", "youtube-pipeline:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-pipeline:predict:encode-unavailable",
        "title": "Predict publication with a missing rendition",
        "prompt": "Encode is unavailable, but Thumbnail finishes. Can Outputs be published ready when a required rendition is missing?",
        "options": ["No; required output verification must wait or record failure", "Yes; a thumbnail proves every rendition exists", "Yes; the queue guarantees exactly one successful encode"],
        "correctIndex": 0,
        "explanation": "Thumbnail → Outputs is only one dependency branch. Required encoded media and manifest must exist too; the queue can retain retryable work without implying success.",
        "reveal": {
          "id": "youtube-pipeline:reveal:encode-unavailable",
          "title": "Predict publication with a missing rendition",
          "description": "Thumbnail → Outputs is only one dependency branch. Required encoded media and manifest must exist too; the queue can retain retryable work without implying success.",
          "nodeIds": ["youtube-pipeline:node:2", "youtube-pipeline:node:3", "youtube-pipeline:node:4", "youtube-pipeline:node:5"],
          "linkIds": ["youtube-pipeline:relation:2", "youtube-pipeline:relation:5"],
          "statuses": {
            "youtube-pipeline:node:3": "unavailable",
            "youtube-pipeline:node:2": "under-pressure",
            "youtube-pipeline:node:4": "active"
          }
        }
      }
    ]
  },
  "youtube-renditions": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-renditions:node:0": {"lane": 0, "order": 2, "semanticId": "source"},
      "youtube-renditions:node:1": {"lane": 1, "order": 1, "semanticId": "high-bitrate"},
      "youtube-renditions:node:2": {"lane": 1, "order": 2, "semanticId": "medium-bitrate"},
      "youtube-renditions:node:3": {"lane": 1, "order": 4, "semanticId": "low-bitrate"},
      "youtube-renditions:node:4": {"lane": 2, "order": 2, "semanticId": "manifest"},
      "youtube-renditions:node:5": {"lane": 3, "order": 2, "semanticId": "player"}
    },
    "relationships": {
      "youtube-renditions:relation:0": {"meaning": "connection", "condition": "", "explanation": "Source (one uploaded file) leads to High bitrate (aligned segments) in this lesson. Codec, container, bitrate, rendition, segment, and manifest solve different problems."},
      "youtube-renditions:relation:1": {"meaning": "connection", "condition": "", "explanation": "Source (one uploaded file) leads to Medium bitrate (aligned segments) in this lesson. Codec, container, bitrate, rendition, segment, and manifest solve different problems."},
      "youtube-renditions:relation:2": {"meaning": "connection", "condition": "", "explanation": "Source (one uploaded file) leads to Low bitrate (aligned segments) in this lesson. Codec, container, bitrate, rendition, segment, and manifest solve different problems."},
      "youtube-renditions:relation:3": {"meaning": "connection", "condition": "", "explanation": "High bitrate (aligned segments) leads to Manifest (lists renditions) in this lesson. Codec, container, bitrate, rendition, segment, and manifest solve different problems."},
      "youtube-renditions:relation:4": {"meaning": "connection", "condition": "", "explanation": "Medium bitrate (aligned segments) leads to Manifest (lists renditions) in this lesson. Codec, container, bitrate, rendition, segment, and manifest solve different problems."},
      "youtube-renditions:relation:5": {"meaning": "connection", "condition": "", "explanation": "Low bitrate (aligned segments) leads to Manifest (lists renditions) in this lesson. Codec, container, bitrate, rendition, segment, and manifest solve different problems."},
      "youtube-renditions:relation:6": {"meaning": "connection", "condition": "", "explanation": "Manifest (lists renditions) leads to Player (choose next) in this lesson. Codec, container, bitrate, rendition, segment, and manifest solve different problems."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "youtube-renditions:explain:1",
        "title": "Distinguish codec from container",
        "description": "A container such as MP4 packages tracks; a codec such as H.264 compresses video. Devices differ in supported codecs, resolutions, and bandwidth. Encode a deliberately limited ladder of bitrate and resolution combinations. More renditions improve fit but cost compute and storage.",
        "nodeIds": ["youtube-renditions:node:1", "youtube-renditions:node:2", "youtube-renditions:node:3", "youtube-renditions:node:4"],
        "linkIds": ["youtube-renditions:relation:3", "youtube-renditions:relation:4", "youtube-renditions:relation:5"],
        "viewId": "youtube-renditions:view:point-1"
      },
      {
        "id": "youtube-renditions:explain:2",
        "title": "Align segments for adaptive playback",
        "description": "Package each rendition into short, independently decodable segments and publish a manifest listing them. Align segment boundaries so the player switches quality cleanly. HLS and MPEG-DASH are HTTP-based playback approaches; choose against actual client compatibility. On a changing mobile connection, the player can request a lower-bitrate next segment to protect its buffer. Very short segments add requests; long ones delay adaptation and may waste bytes.",
        "nodeIds": ["youtube-renditions:node:1", "youtube-renditions:node:2", "youtube-renditions:node:3", "youtube-renditions:node:4", "youtube-renditions:node:5"],
        "linkIds": ["youtube-renditions:relation:3", "youtube-renditions:relation:4", "youtube-renditions:relation:5", "youtube-renditions:relation:6"],
        "viewId": "youtube-renditions:view:point-2"
      }
    ],
    "views": [
      {
        "id": "youtube-renditions:view:point-1",
        "title": "Distinguish codec from container",
        "description": "A container such as MP4 packages tracks; a codec such as H.264 compresses video. Devices differ in supported codecs, resolutions, and bandwidth. Encode a deliberately limited ladder of bitrate and resolution combinations. More renditions improve fit but cost compute and storage.",
        "members": ["youtube-renditions:node:1", "youtube-renditions:node:2", "youtube-renditions:node:3", "youtube-renditions:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "youtube-renditions:view:point-2",
        "title": "Align segments for adaptive playback",
        "description": "Package each rendition into short, independently decodable segments and publish a manifest listing them. Align segment boundaries so the player switches quality cleanly. HLS and MPEG-DASH are HTTP-based playback approaches; choose against actual client compatibility. On a changing mobile connection, the player can request a lower-bitrate next segment to protect its buffer. Very short segments add requests; long ones delay adaptation and may waste bytes.",
        "members": ["youtube-renditions:node:1", "youtube-renditions:node:2", "youtube-renditions:node:3", "youtube-renditions:node:4", "youtube-renditions:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-renditions:predict:yq11",
        "title": "Predict the design consequence",
        "prompt": "Why align segment boundaries across quality levels?",
        "options": ["Remove metadata reads", "Shorten titles", "Avoid storing audio", "Switch renditions at a matching playback point"],
        "correctIndex": 3,
        "explanation": "Aligned boundaries preserve continuity when bitrate changes.",
        "reveal": {
          "id": "youtube-renditions:reveal:yq11",
          "title": "Why this choice follows",
          "description": "Aligned boundaries preserve continuity when bitrate changes.",
          "nodeIds": ["youtube-renditions:node:0", "youtube-renditions:node:1", "youtube-renditions:node:2", "youtube-renditions:node:3", "youtube-renditions:node:4", "youtube-renditions:node:5"],
          "linkIds": ["youtube-renditions:relation:1", "youtube-renditions:relation:2", "youtube-renditions:relation:3", "youtube-renditions:relation:4", "youtube-renditions:relation:5", "youtube-renditions:relation:6"]
        }
      }
    ]
  },
  "youtube-metadata": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-metadata:node:0": {"lane": 0, "order": 2, "semanticId": "processing-job"},
      "youtube-metadata:node:1": {"lane": 1, "order": 2, "semanticId": "verify-outputs"},
      "youtube-metadata:node:2": {"lane": 2, "order": 2, "semanticId": "metadata-db"},
      "youtube-metadata:node:3": {"lane": 2, "order": 4, "semanticId": "metadata-cache"},
      "youtube-metadata:node:4": {"lane": 0, "order": 4, "semanticId": "viewer"},
      "youtube-metadata:node:5": {"lane": 1, "order": 4, "semanticId": "watch-api"}
    },
    "relationships": {
      "youtube-metadata:relation:0": {"meaning": "publish", "condition": "When a processing completion event arrives.", "explanation": "The durable processing result starts verification; event arrival alone is not readiness."},
      "youtube-metadata:relation:1": {"meaning": "write", "condition": "Only after required media outputs are verified.", "explanation": "The state machine publishes ready in authoritative metadata."},
      "youtube-metadata:relation:2": {"meaning": "write", "condition": "After an authoritative metadata update.", "explanation": "Refresh or evict derived cache entries to avoid stale ready/status data."},
      "youtube-metadata:relation:3": {"meaning": "request", "condition": "When a viewer opens the watch page.", "explanation": "The viewer requests status and access information from the Watch API."},
      "youtube-metadata:relation:4": {"meaning": "read", "condition": "When authoritative status or policy is needed.", "explanation": "The Watch API reads the metadata record before advertising playable media."},
      "youtube-metadata:relation:5": {"meaning": "response", "condition": "When a usable cached metadata result is available.", "explanation": "The drawn cache payload reaches Watch API; metadata cache is not the durable video store."}
    },
    "groups": [
      {
        "id": "youtube-metadata:metadata",
        "title": "Metadata subsystem",
        "description": "Authoritative metadata and its derived read cache.",
        "members": ["youtube-metadata:node:2", "youtube-metadata:node:3"]
      }
    ],
    "scenes": [
      {
        "id": "youtube-metadata:verify",
        "title": "Completion starts a verification step",
        "description": "A processing completion event reaches Verify outputs. The state machine must check required media objects before claiming ready.",
        "nodeIds": ["youtube-metadata:node:0", "youtube-metadata:node:1", "youtube-metadata:node:2"],
        "linkIds": ["youtube-metadata:relation:0", "youtube-metadata:relation:1"]
      },
      {
        "id": "youtube-metadata:publish",
        "title": "Publish ready and refresh derived metadata",
        "description": "Verified output state moves the authoritative metadata record from processing to ready. Refresh or evict cached metadata after writes.",
        "nodeIds": ["youtube-metadata:node:1", "youtube-metadata:node:2", "youtube-metadata:node:3"],
        "linkIds": ["youtube-metadata:relation:1", "youtube-metadata:relation:2"]
      },
      {
        "id": "youtube-metadata:watch",
        "title": "Read status and policy before returning a manifest",
        "description": "The viewer asks Watch API, which reads authoritative status and access policy or useful cached metadata. A processing video receives no playable URL.",
        "nodeIds": ["youtube-metadata:node:2", "youtube-metadata:node:3", "youtube-metadata:node:4", "youtube-metadata:node:5"],
        "linkIds": ["youtube-metadata:relation:3", "youtube-metadata:relation:4", "youtube-metadata:relation:5"]
      }
    ],
    "views": [
      {
        "id": "youtube-metadata:view:publication",
        "title": "Publication state",
        "description": "Inspect verification, ready metadata, and cache refresh.",
        "members": ["youtube-metadata:node:0", "youtube-metadata:node:1", "youtube-metadata:node:2", "youtube-metadata:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "youtube-metadata:view:watch",
        "title": "Watch control path",
        "description": "The watch page receives status and authorization independently of bulk video delivery.",
        "members": ["youtube-metadata:node:2", "youtube-metadata:node:3", "youtube-metadata:node:4", "youtube-metadata:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-metadata:predict:missing-output",
        "title": "Predict a missing output",
        "prompt": "The completion event arrived, but Verify outputs finds a missing required segment. What should Metadata DB advertise?",
        "options": ["Processing or a clear failure without a playable URL", "Ready because the event arrived", "Ready because a cache entry exists"],
        "correctIndex": 0,
        "explanation": "The Verify outputs → Metadata DB publication relation is conditional on required media existing. Cache and completion events cannot establish that condition.",
        "reveal": {
          "id": "youtube-metadata:reveal:missing-output",
          "title": "Predict a missing output",
          "description": "The Verify outputs → Metadata DB publication relation is conditional on required media existing. Cache and completion events cannot establish that condition.",
          "nodeIds": ["youtube-metadata:node:0", "youtube-metadata:node:1", "youtube-metadata:node:2", "youtube-metadata:node:3", "youtube-metadata:node:5"],
          "linkIds": ["youtube-metadata:relation:0", "youtube-metadata:relation:1", "youtube-metadata:relation:2", "youtube-metadata:relation:4"],
          "statuses": {
            "youtube-metadata:node:1": "under-pressure"
          }
        }
      }
    ]
  },
  "youtube-playback": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-playback:node:0": {"lane": 0, "order": 2, "semanticId": "viewer"},
      "youtube-playback:node:1": {"lane": 1, "order": 1, "semanticId": "watch-api"},
      "youtube-playback:node:2": {"lane": 1, "order": 3, "semanticId": "cdn-edge"},
      "youtube-playback:node:3": {"lane": 2, "order": 3, "semanticId": "origin"},
      "youtube-playback:node:4": {"lane": 2, "order": 1, "semanticId": "metadata-db"}
    },
    "relationships": {
      "youtube-playback:relation:0": {"meaning": "request", "condition": "When the viewer opens the watch page.", "explanation": "The viewer asks the API for metadata, status, and permitted manifest access."},
      "youtube-playback:relation:1": {"meaning": "read", "condition": "When checking video status and access policy.", "explanation": "Watch API reads metadata; this control path does not carry video segments."},
      "youtube-playback:relation:2": {"meaning": "request", "condition": "After permitted playback access is established.", "explanation": "The player requests manifest or media segments from the edge."},
      "youtube-playback:relation:3": {"meaning": "read", "condition": "Only when the requested allowed segment is missing at the edge.", "explanation": "CDN edge fetches the segment from authorized origin."},
      "youtube-playback:relation:4": {"meaning": "response", "condition": "After the origin fetch succeeds.", "explanation": "Origin returns encoded media to the edge, which may populate its cache."},
      "youtube-playback:relation:5": {"meaning": "response", "condition": "For a permitted cached hit or completed origin fetch.", "explanation": "The edge returns segments to the adaptive player."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "youtube-playback:watch",
        "title": "Ask for metadata and access first",
        "description": "The viewer opens the page through Watch API. The API checks metadata status and policy before returning an authorized manifest location.",
        "nodeIds": ["youtube-playback:node:0", "youtube-playback:node:1", "youtube-playback:node:4"],
        "linkIds": ["youtube-playback:relation:0", "youtube-playback:relation:1"]
      },
      {
        "id": "youtube-playback:edge",
        "title": "Request playable segments through the edge",
        "description": "The adaptive player requests manifest and segments from CDN edge. A hit returns there, avoiding a bulk transfer through the general API.",
        "nodeIds": ["youtube-playback:node:0", "youtube-playback:node:2"],
        "linkIds": ["youtube-playback:relation:2", "youtube-playback:relation:5"]
      },
      {
        "id": "youtube-playback:miss",
        "title": "Fill the edge from authorized origin",
        "description": "When a segment is missing, CDN edge fetches from origin, then returns the segment and may cache it. Origin retains the durable encoded media responsibility.",
        "nodeIds": ["youtube-playback:node:0", "youtube-playback:node:2", "youtube-playback:node:3"],
        "linkIds": ["youtube-playback:relation:2", "youtube-playback:relation:3", "youtube-playback:relation:4", "youtube-playback:relation:5"]
      },
      {
        "id": "youtube-playback:adapt",
        "title": "Choose quality from bandwidth and buffer health",
        "description": "The player changes the next segment rendition as conditions change. Nearby copies help delivery but authorization, origin controls, and takedown policy still matter.",
        "nodeIds": ["youtube-playback:node:0", "youtube-playback:node:2", "youtube-playback:node:3"],
        "linkIds": ["youtube-playback:relation:2", "youtube-playback:relation:3", "youtube-playback:relation:5"]
      }
    ],
    "views": [
      {
        "id": "youtube-playback:view:control",
        "title": "Watch control",
        "description": "Metadata and policy requests are distinct from bulk segment delivery.",
        "members": ["youtube-playback:node:0", "youtube-playback:node:1", "youtube-playback:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "youtube-playback:view:media",
        "title": "Media delivery",
        "description": "Focus on the conditional CDN hit and origin-fill paths.",
        "members": ["youtube-playback:node:0", "youtube-playback:node:2", "youtube-playback:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-playback:predict:cold-segment",
        "title": "Predict a segment miss",
        "prompt": "The player asks for a new segment that CDN edge does not hold. Which displayed path supplies it?",
        "options": ["CDN edge → Origin → CDN edge → Viewer", "Watch API → Metadata DB for the video bytes", "Viewer reuploads the original"],
        "correctIndex": 0,
        "explanation": "The edge’s miss relation reads authorized origin, the fill returns to the edge, and the segment response reaches the viewer. Metadata DB stores status and policy rather than media bytes.",
        "reveal": {
          "id": "youtube-playback:reveal:cold-segment",
          "title": "Predict a segment miss",
          "description": "The edge’s miss relation reads authorized origin, the fill returns to the edge, and the segment response reaches the viewer. Metadata DB stores status and policy rather than media bytes.",
          "nodeIds": ["youtube-playback:node:0", "youtube-playback:node:2", "youtube-playback:node:3"],
          "linkIds": ["youtube-playback:relation:3", "youtube-playback:relation:4", "youtube-playback:relation:5"],
          "viewId": "youtube-playback:view:media"
        }
      }
    ]
  },
  "youtube-cost": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-cost:node:0": {"lane": 0, "order": 2, "semanticId": "view-history"},
      "youtube-cost:node:1": {"lane": 1, "order": 2, "semanticId": "placement-policy"},
      "youtube-cost:node:2": {"lane": 2, "order": 1, "semanticId": "hot-edge"},
      "youtube-cost:node:3": {"lane": 2, "order": 3, "semanticId": "cold-origin"}
    },
    "relationships": {
      "youtube-cost:relation:0": {"meaning": "connection", "condition": "", "explanation": "View history (popularity × region) leads to Placement policy (latency vs bytes) in this lesson. Use bytes, bitrate, geography, popularity, and cache metrics to model delivery cost."},
      "youtube-cost:relation:1": {"meaning": "connection", "condition": "", "explanation": "Placement policy → Hot → edge: popular. fast repeated reads."},
      "youtube-cost:relation:2": {"meaning": "connection", "condition": "", "explanation": "Placement policy → Cold → origin: rare. lower cost, slower start."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "youtube-cost:explain:1",
        "title": "Measure delivered bytes and cache value",
        "description": "At video scale, delivered bytes can dominate cost. Estimate egress from watched minutes and delivered bitrate, adjusted for devices, cache-hit rate, and geography. Published prices change; use measured bills and playback quality to compare strategies.",
        "nodeIds": ["youtube-cost:node:1", "youtube-cost:node:3"],
        "linkIds": ["youtube-cost:relation:2"],
        "viewId": "youtube-cost:view:point-1"
      },
      {
        "id": "youtube-cost:explain:2",
        "title": "Place hot and local titles deliberately",
        "description": "Hot titles benefit from CDN caching and broad placement. Cold titles may remain at origin or keep fewer precomputed renditions, but misses increase startup time and on-demand encoding can delay playback. A cold title can go viral. Set a promotion path based on demand, and control waste with bounded rendition ladders, storage lifecycle rules, and sensible cache policies. A private CDN needs sustained volume and measured savings to justify operating it.",
        "nodeIds": ["youtube-cost:node:1", "youtube-cost:node:2", "youtube-cost:node:3"],
        "linkIds": ["youtube-cost:relation:1", "youtube-cost:relation:2"],
        "viewId": "youtube-cost:view:point-2"
      }
    ],
    "views": [
      {
        "id": "youtube-cost:view:point-1",
        "title": "Measure delivered bytes and cache value",
        "description": "At video scale, delivered bytes can dominate cost. Estimate egress from watched minutes and delivered bitrate, adjusted for devices, cache-hit rate, and geography. Published prices change; use measured bills and playback quality to compare strategies.",
        "members": ["youtube-cost:node:1", "youtube-cost:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "youtube-cost:view:point-2",
        "title": "Place hot and local titles deliberately",
        "description": "Hot titles benefit from CDN caching and broad placement. Cold titles may remain at origin or keep fewer precomputed renditions, but misses increase startup time and on-demand encoding can delay playback. A cold title can go viral. Set a promotion path based on demand, and control waste with bounded rendition ladders, storage lifecycle rules, and sensible cache policies. A private CDN needs sustained volume and measured savings to justify operating it.",
        "members": ["youtube-cost:node:1", "youtube-cost:node:2", "youtube-cost:node:3"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-cost:predict:yq19",
        "title": "Predict the design consequence",
        "prompt": "What should guide regional caching of a mostly local title?",
        "options": ["Uploader favorite color", "Equal replicas everywhere", "Longest TTL only", "Observed viewer geography and cache performance"],
        "correctIndex": 3,
        "explanation": "Regional demand determines where copies justify their cost.",
        "reveal": {
          "id": "youtube-cost:reveal:yq19",
          "title": "Why this choice follows",
          "description": "Regional demand determines where copies justify their cost.",
          "nodeIds": ["youtube-cost:node:0", "youtube-cost:node:1", "youtube-cost:node:2", "youtube-cost:node:3"],
          "linkIds": ["youtube-cost:relation:0", "youtube-cost:relation:1", "youtube-cost:relation:2"]
        }
      }
    ]
  },
  "youtube-operations": {
    "layout": "tiers",
    "nodeRoles": {
      "youtube-operations:node:0": {"lane": 0, "order": 1, "semanticId": "upload-path"},
      "youtube-operations:node:1": {"lane": 0, "order": 4, "semanticId": "watch-path"},
      "youtube-operations:node:2": {"lane": 1, "order": 2, "semanticId": "operations"},
      "youtube-operations:node:3": {"lane": 2, "order": 1, "semanticId": "recover"},
      "youtube-operations:node:4": {"lane": 2, "order": 4, "semanticId": "remove-access"}
    },
    "relationships": {
      "youtube-operations:relation:0": {"meaning": "connection", "condition": "", "explanation": "Upload path (queue age + success) leads to Operations (alerts + traces) in this lesson. Measure the creator path and viewer path independently."},
      "youtube-operations:relation:1": {"meaning": "connection", "condition": "", "explanation": "Watch path (startup + buffering) leads to Operations (alerts + traces) in this lesson. Measure the creator path and viewer path independently."},
      "youtube-operations:relation:2": {"meaning": "connection", "condition": "", "explanation": "Operations (alerts + traces) leads to Recover (retry, replay, restore) in this lesson. Measure the creator path and viewer path independently."},
      "youtube-operations:relation:3": {"meaning": "connection", "condition": "", "explanation": "Operations (alerts + traces) leads to Remove access (metadata + CDN purge) in this lesson. Measure the creator path and viewer path independently."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "youtube-operations:explain:1",
        "title": "Classify retryable and terminal failures",
        "description": "Recoverable upload and worker failures should resume or retry with bounds; bad source formats should fail clearly. Replicate durable objects and metadata against the availability target and test restore paths. A stalled queue delays newly uploaded videos becoming ready while existing videos may still play.",
        "nodeIds": ["youtube-operations:node:0", "youtube-operations:node:1", "youtube-operations:node:2", "youtube-operations:node:3", "youtube-operations:node:4"],
        "linkIds": ["youtube-operations:relation:0", "youtube-operations:relation:1", "youtube-operations:relation:2", "youtube-operations:relation:3"]
      },
      {
        "id": "youtube-operations:explain:2",
        "title": "Measure creator readiness and viewer playback",
        "description": "Measure upload completion, pending-video age, queue lag, transcode failure, CDN hit rate, time to first frame, rebuffering, and egress. Trace one video ID through upload and publication, and one session through playback. Access control, rights claims, malware checks, abuse reports, and takedowns need product policy and operating workflows. Removal must block new access, change metadata, and invalidate or expire cached media. DRM, encryption, and watermarking are different controls with different guarantees.",
        "nodeIds": ["youtube-operations:node:0", "youtube-operations:node:2", "youtube-operations:node:4"],
        "linkIds": ["youtube-operations:relation:0", "youtube-operations:relation:3"],
        "viewId": "youtube-operations:view:point-2"
      }
    ],
    "views": [
      {
        "id": "youtube-operations:view:point-2",
        "title": "Measure creator readiness and viewer playback",
        "description": "Measure upload completion, pending-video age, queue lag, transcode failure, CDN hit rate, time to first frame, rebuffering, and egress. Trace one video ID through upload and publication, and one session through playback. Access control, rights claims, malware checks, abuse reports, and takedowns need product policy and operating workflows. Removal must block new access, change metadata, and invalidate or expire cached media. DRM, encryption, and watermarking are different controls with different guarantees.",
        "members": ["youtube-operations:node:0", "youtube-operations:node:2", "youtube-operations:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "youtube-operations:predict:yq22",
        "title": "Predict the design consequence",
        "prompt": "Processing queue age rises but existing videos play. Which path is degraded?",
        "options": ["Only login", "Creator-to-ready processing", "All CDN reads", "Only DNS"],
        "correctIndex": 1,
        "explanation": "Backlog delays publication while ready media may continue playing.",
        "reveal": {
          "id": "youtube-operations:reveal:yq22",
          "title": "Why this choice follows",
          "description": "Backlog delays publication while ready media may continue playing.",
          "nodeIds": ["youtube-operations:node:0", "youtube-operations:node:1", "youtube-operations:node:2"],
          "linkIds": ["youtube-operations:relation:0", "youtube-operations:relation:1"],
          "statuses": {
            "youtube-operations:node:0": "under-pressure",
            "youtube-operations:node:1": "active"
          }
        }
      }
    ]
  }
};
