import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const notificationTeachingContent: Record<string, TeachingContent> = {
  "notification-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "notification-scope:node:0": {"lane": 0, "order": 2, "semanticId": "product-event"},
      "notification-scope:node:1": {"lane": 1, "order": 2, "semanticId": "accepted-intent"},
      "notification-scope:node:2": {"lane": 2, "order": 2, "semanticId": "provider"},
      "notification-scope:node:3": {"lane": 3, "order": 2, "semanticId": "person"}
    },
    "relationships": {
      "notification-scope:relation:0": {"meaning": "request", "condition": "", "explanation": "Product event → Accepted intent: submit. durably recorded."},
      "notification-scope:relation:1": {"meaning": "connection", "condition": "", "explanation": "Accepted intent → Provider: handoff. accepts request."},
      "notification-scope:relation:2": {"meaning": "decision", "condition": "", "explanation": "Provider → Person: not guaranteed. may act later."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "notification-scope:explain:1",
        "title": "Define category and timing promises",
        "description": "A notification can be a mobile push, email, SMS, or an in-app item. They differ in cost, reach, payload, and what their providers can confirm. Start with the events worth sending: a payment alert may be urgent, while a weekly digest may wait. Record the expected daily volume, peak burst, permitted delay, supported devices, and markets.",
        "nodeIds": ["notification-scope:node:0", "notification-scope:node:2", "notification-scope:node:3"],
        "linkIds": ["notification-scope:relation:2"],
        "viewId": "notification-scope:view:point-1"
      },
      {
        "id": "notification-scope:explain:2",
        "title": "Separate acceptance from recipient outcomes",
        "description": "Use separate states for accepted by our service, handed to a provider, accepted by that provider, and opened or acted on by the person. A successful provider API response does not prove that a phone displayed a push or that an email was read. The product should specify which of these promises matters for each event.",
        "nodeIds": ["notification-scope:node:0", "notification-scope:node:1", "notification-scope:node:2", "notification-scope:node:3"],
        "linkIds": ["notification-scope:relation:0", "notification-scope:relation:1", "notification-scope:relation:2"]
      },
      {
        "id": "notification-scope:explain:3",
        "title": "Bound the supported channel contract",
        "description": "This design supports push, email, and SMS. A signed-in client registers device tokens; account settings store verified addresses and phone numbers. Transactional and promotional traffic have distinct policies. User consent and channel eligibility are part of the send decision, not a cleanup step after delivery.",
        "nodeIds": ["notification-scope:node:0", "notification-scope:node:1", "notification-scope:node:2"],
        "linkIds": ["notification-scope:relation:0", "notification-scope:relation:1"],
        "viewId": "notification-scope:view:point-3"
      }
    ],
    "views": [
      {
        "id": "notification-scope:view:point-1",
        "title": "Define category and timing promises",
        "description": "A notification can be a mobile push, email, SMS, or an in-app item. They differ in cost, reach, payload, and what their providers can confirm. Start with the events worth sending: a payment alert may be urgent, while a weekly digest may wait. Record the expected daily volume, peak burst, permitted delay, supported devices, and markets.",
        "members": ["notification-scope:node:0", "notification-scope:node:2", "notification-scope:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "notification-scope:view:point-3",
        "title": "Bound the supported channel contract",
        "description": "This design supports push, email, and SMS. A signed-in client registers device tokens; account settings store verified addresses and phone numbers. Transactional and promotional traffic have distinct policies. User consent and channel eligibility are part of the send decision, not a cleanup step after delivery.",
        "members": ["notification-scope:node:0", "notification-scope:node:1", "notification-scope:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "notification-scope:predict:provider-accepted",
        "title": "Predict what provider acceptance proves",
        "prompt": "Provider accepted a request. What does the final relation allow this service to conclude about Person?",
        "options": ["Recipient action is not guaranteed", "The person definitely opened it", "The durable intent can now be erased without policy"],
        "correctIndex": 0,
        "explanation": "Provider acceptance is a separate state from the person receiving or acting. The last relation is explicitly labelled not guaranteed.",
        "reveal": {
          "id": "notification-scope:reveal:provider-accepted",
          "title": "Predict what provider acceptance proves",
          "description": "Provider acceptance is a separate state from the person receiving or acting. The last relation is explicitly labelled not guaranteed.",
          "nodeIds": ["notification-scope:node:1", "notification-scope:node:2", "notification-scope:node:3"],
          "linkIds": ["notification-scope:relation:1", "notification-scope:relation:2"]
        }
      }
    ]
  },
  "notification-ingest": {
    "layout": "tiers",
    "nodeRoles": {
      "notification-ingest:node:0": {"lane": 0, "order": 2, "semanticId": "product"},
      "notification-ingest:node:1": {"lane": 1, "order": 2, "semanticId": "send-api"},
      "notification-ingest:node:2": {"lane": 2, "order": 1, "semanticId": "intent-store"},
      "notification-ingest:node:3": {"lane": 3, "order": 1, "semanticId": "channel-queue"},
      "notification-ingest:node:4": {"lane": 3, "order": 3, "semanticId": "worker"}
    },
    "relationships": {
      "notification-ingest:relation:0": {"meaning": "request", "condition": "When a trusted product submits a notification intent.", "explanation": "The stable event identity accompanies an authenticated producer request."},
      "notification-ingest:relation:1": {"meaning": "write", "condition": "After authentication, schema, and authorization checks.", "explanation": "Persist notification intent and its recovery path before acknowledgement."},
      "notification-ingest:relation:2": {"meaning": "publish", "condition": "After the durable intent/outbox commit; retry if publishing fails.", "explanation": "The dispatcher publishes recoverable work from retained intent."},
      "notification-ingest:relation:3": {"meaning": "delivery", "condition": "When a channel worker leases eligible queued work.", "explanation": "The queue supplies work for later execution; it does not prove provider or recipient delivery."}
    },
    "groups": [
      {
        "id": "notification-ingest:durable-dispatch",
        "title": "Durable dispatch",
        "description": "Persisted intent/outbox and queue preserve recoverable work across the handoff.",
        "members": ["notification-ingest:node:2", "notification-ingest:node:3"]
      }
    ],
    "scenes": [
      {
        "id": "notification-ingest:validate",
        "title": "Accept only an authorized intent",
        "description": "A trusted product submits a stable event ID. The Send API authenticates the producer and validates schema and authorization.",
        "nodeIds": ["notification-ingest:node:0", "notification-ingest:node:1", "notification-ingest:node:2"],
        "linkIds": ["notification-ingest:relation:0", "notification-ingest:relation:1"]
      },
      {
        "id": "notification-ingest:commit",
        "title": "Retain the recovery path before acknowledgement",
        "description": "Persist the intent and outbox before claiming acceptance. A dispatcher can recover from the committed outbox after a process or publish failure.",
        "nodeIds": ["notification-ingest:node:1", "notification-ingest:node:2", "notification-ingest:node:3"],
        "linkIds": ["notification-ingest:relation:1", "notification-ingest:relation:2"]
      },
      {
        "id": "notification-ingest:dispatch",
        "title": "Publish work for later execution",
        "description": "The durable queue buffers work and supplies a worker. Queue acceptance is separate from provider delivery or recipient receipt.",
        "nodeIds": ["notification-ingest:node:2", "notification-ingest:node:3", "notification-ingest:node:4"],
        "linkIds": ["notification-ingest:relation:2", "notification-ingest:relation:3"]
      },
      {
        "id": "notification-ingest:publish-failure",
        "title": "A failed publish leaves recoverable intent",
        "description": "In this authored scenario Channel queue is unavailable. Intent store remains active, allowing the outbox dispatcher to retry rather than losing an acknowledged intent.",
        "nodeIds": ["notification-ingest:node:1", "notification-ingest:node:2", "notification-ingest:node:3", "notification-ingest:node:4"],
        "linkIds": ["notification-ingest:relation:1"],
        "statuses": {
          "notification-ingest:node:3": "unavailable",
          "notification-ingest:node:2": "active"
        }
      }
    ],
    "views": [
      {
        "id": "notification-ingest:view:accept",
        "title": "Acceptance and recovery",
        "description": "Inspect the committed intent before queue execution.",
        "members": ["notification-ingest:node:0", "notification-ingest:node:1", "notification-ingest:node:2", "notification-ingest:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "notification-ingest:view:execution",
        "title": "Deferred execution",
        "description": "A worker consumes work separately from API acknowledgement.",
        "members": ["notification-ingest:node:2", "notification-ingest:node:3", "notification-ingest:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "notification-ingest:predict:failed-publish",
        "title": "Predict a publish failure",
        "prompt": "The intent and outbox committed, but Channel queue is temporarily unavailable. Which displayed state makes retry possible?",
        "options": ["The persisted Intent store/outbox", "A provider receipt that has not happened", "The Send API’s process memory only"],
        "correctIndex": 0,
        "explanation": "Intent store retains the durable outbox record. The dispatcher retries publishing when the queue recovers; acknowledgement must be backed by that recovery path.",
        "reveal": {
          "id": "notification-ingest:reveal:failed-publish",
          "title": "Predict a publish failure",
          "description": "Intent store retains the durable outbox record. The dispatcher retries publishing when the queue recovers; acknowledgement must be backed by that recovery path.",
          "nodeIds": ["notification-ingest:node:1", "notification-ingest:node:2", "notification-ingest:node:3"],
          "linkIds": ["notification-ingest:relation:1", "notification-ingest:relation:2"],
          "statuses": {
            "notification-ingest:node:3": "unavailable",
            "notification-ingest:node:2": "active"
          }
        }
      }
    ]
  },
  "notification-personalize": {
    "layout": "tiers",
    "nodeRoles": {
      "notification-personalize:node:0": {"lane": 0, "order": 2, "semanticId": "send-intent"},
      "notification-personalize:node:1": {"lane": 1, "order": 2, "semanticId": "resolver"},
      "notification-personalize:node:2": {"lane": 2, "order": 1, "semanticId": "preferences"},
      "notification-personalize:node:3": {"lane": 2, "order": 3, "semanticId": "template"},
      "notification-personalize:node:4": {"lane": 3, "order": 2, "semanticId": "attempts"}
    },
    "relationships": {
      "notification-personalize:relation:0": {"meaning": "request", "condition": "When a retained send intent is evaluated.", "explanation": "The recipient and notification category reach policy resolution."},
      "notification-personalize:relation:1": {"meaning": "read", "condition": "Close to send time, especially for scheduled work.", "explanation": "The resolver reads current consent and channel preferences."},
      "notification-personalize:relation:2": {"meaning": "read", "condition": "When preparing eligible content.", "explanation": "The resolver selects and renders a versioned template with validated parameters."},
      "notification-personalize:relation:3": {"meaning": "decision", "condition": "Only when current category and channel policy permits the recipient.", "explanation": "Preferences constrain which attempts are eligible; this is a policy dependency."},
      "notification-personalize:relation:4": {"meaning": "decision", "condition": "When rendered content and policy support an eligible channel.", "explanation": "The rendered template forms attempt content rather than granting permission by itself."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "notification-personalize:policy",
        "title": "Resolve recipient policy close to send time",
        "description": "The resolver takes the intent’s category and recipient, then reads current preferences. Scheduled work must not rely only on consent from enqueue time.",
        "nodeIds": ["notification-personalize:node:0", "notification-personalize:node:1", "notification-personalize:node:2"],
        "linkIds": ["notification-personalize:relation:0", "notification-personalize:relation:1"]
      },
      {
        "id": "notification-personalize:render",
        "title": "Render the chosen template safely",
        "description": "Versioned templates and validated parameters form channel-specific content. Record the policy and template used to explain historical delivery.",
        "nodeIds": ["notification-personalize:node:1", "notification-personalize:node:3"],
        "linkIds": ["notification-personalize:relation:2"]
      },
      {
        "id": "notification-personalize:eligible",
        "title": "Create attempts only for eligible channels",
        "description": "Current preferences and rendered content feed eligible attempts. Device-level destinations can change independently, and opt-out or quiet-hour policy can suppress work.",
        "nodeIds": ["notification-personalize:node:2", "notification-personalize:node:3", "notification-personalize:node:4"],
        "linkIds": ["notification-personalize:relation:3", "notification-personalize:relation:4"]
      }
    ],
    "views": [
      {
        "id": "notification-personalize:view:consent",
        "title": "Consent decision",
        "description": "Focus on current recipient policy before attempt creation.",
        "members": ["notification-personalize:node:0", "notification-personalize:node:1", "notification-personalize:node:2", "notification-personalize:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "notification-personalize:view:content",
        "title": "Template to attempt",
        "description": "Versioned content is assembled for eligible channel attempts.",
        "members": ["notification-personalize:node:1", "notification-personalize:node:3", "notification-personalize:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "notification-personalize:predict:opted-out",
        "title": "Predict changed consent",
        "prompt": "A promotional intent was queued before the recipient opted out. At send time, what should Resolver do?",
        "options": ["Read current Preferences and suppress ineligible attempts", "Use consent from enqueue time forever", "Switch automatically to a different channel"],
        "correctIndex": 0,
        "explanation": "Resolver reads current Preferences. The eligibility path must reflect mutable consent close to send time; rendering a template is not permission to send.",
        "reveal": {
          "id": "notification-personalize:reveal:opted-out",
          "title": "Predict changed consent",
          "description": "Resolver reads current Preferences. The eligibility path must reflect mutable consent close to send time; rendering a template is not permission to send.",
          "nodeIds": ["notification-personalize:node:0", "notification-personalize:node:1", "notification-personalize:node:2", "notification-personalize:node:4"],
          "linkIds": ["notification-personalize:relation:0", "notification-personalize:relation:1", "notification-personalize:relation:3"],
          "viewId": "notification-personalize:view:consent"
        }
      }
    ]
  },
  "notification-channels": {
    "layout": "tiers",
    "nodeRoles": {
      "notification-channels:node:0": {"lane": 0, "order": 2, "semanticId": "eligible-work"},
      "notification-channels:node:1": {"lane": 1, "order": 1, "semanticId": "push-worker"},
      "notification-channels:node:2": {"lane": 1, "order": 2, "semanticId": "email-worker"},
      "notification-channels:node:3": {"lane": 1, "order": 4, "semanticId": "sms-worker"},
      "notification-channels:node:4": {"lane": 2, "order": 1, "semanticId": "push-service"},
      "notification-channels:node:5": {"lane": 2, "order": 2, "semanticId": "email-service"},
      "notification-channels:node:6": {"lane": 2, "order": 4, "semanticId": "sms-service"}
    },
    "relationships": {
      "notification-channels:relation:0": {"meaning": "delivery", "condition": "When this channel is eligible under recipient policy.", "explanation": "Eligible work is routed to the corresponding channel worker."},
      "notification-channels:relation:1": {"meaning": "delivery", "condition": "When this channel is eligible under recipient policy.", "explanation": "Eligible work is routed to the corresponding channel worker."},
      "notification-channels:relation:2": {"meaning": "delivery", "condition": "When this channel is eligible under recipient policy.", "explanation": "Eligible work is routed to the corresponding channel worker."},
      "notification-channels:relation:3": {"meaning": "request", "condition": "When the worker executes an eligible attempt under provider rate rules.", "explanation": "The worker calls its matching provider adapter. Provider acceptance is separate from recipient delivery or viewing."},
      "notification-channels:relation:4": {"meaning": "request", "condition": "When the worker executes an eligible attempt under provider rate rules.", "explanation": "The worker calls its matching provider adapter. Provider acceptance is separate from recipient delivery or viewing."},
      "notification-channels:relation:5": {"meaning": "request", "condition": "When the worker executes an eligible attempt under provider rate rules.", "explanation": "The worker calls its matching provider adapter. Provider acceptance is separate from recipient delivery or viewing."}
    },
    "groups": [
      {
        "id": "notification-channels:push-channel",
        "title": "Push channel",
        "description": "Push worker and its platform provider.",
        "members": ["notification-channels:node:1", "notification-channels:node:4"]
      },
      {
        "id": "notification-channels:email-channel",
        "title": "Email channel",
        "description": "Email worker and its mail provider.",
        "members": ["notification-channels:node:2", "notification-channels:node:5"]
      },
      {
        "id": "notification-channels:sms-channel",
        "title": "SMS channel",
        "description": "SMS worker and its gateway provider.",
        "members": ["notification-channels:node:3", "notification-channels:node:6"]
      }
    ],
    "scenes": [
      {
        "id": "notification-channels:separate",
        "title": "Keep channel worker paths independent",
        "description": "Eligible work is split into push, email, and SMS responsibilities. One provider outage should not block every other channel.",
        "nodeIds": ["notification-channels:node:0", "notification-channels:node:1", "notification-channels:node:2", "notification-channels:node:3"],
        "linkIds": ["notification-channels:relation:0", "notification-channels:relation:1", "notification-channels:relation:2"]
      },
      {
        "id": "notification-channels:adapters",
        "title": "Call the corresponding provider adapter",
        "description": "Each worker calls its matching provider. The adapter isolates request formats, credentials, rate rules, and response codes.",
        "nodeIds": ["notification-channels:node:1", "notification-channels:node:2", "notification-channels:node:3", "notification-channels:node:4", "notification-channels:node:5", "notification-channels:node:6"],
        "linkIds": ["notification-channels:relation:3", "notification-channels:relation:4", "notification-channels:relation:5"]
      },
      {
        "id": "notification-channels:provider-outage",
        "title": "Retain an affected channel’s backlog",
        "description": "In this authored scenario Email service is unavailable. Email work needs a controlled backlog while push and SMS continue under their own policies. An outage does not authorize an automatic SMS fallback.",
        "nodeIds": ["notification-channels:node:1", "notification-channels:node:2", "notification-channels:node:3", "notification-channels:node:4", "notification-channels:node:5", "notification-channels:node:6"],
        "linkIds": ["notification-channels:relation:3", "notification-channels:relation:5"],
        "statuses": {
          "notification-channels:node:2": "under-pressure",
          "notification-channels:node:5": "unavailable",
          "notification-channels:node:4": "active",
          "notification-channels:node:6": "active"
        }
      }
    ],
    "views": [
      {
        "id": "notification-channels:view:email",
        "title": "Email provider path",
        "description": "Focus the affected channel independently of push and SMS.",
        "members": ["notification-channels:node:0", "notification-channels:node:2", "notification-channels:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "notification-channels:view:providers",
        "title": "Channel providers",
        "description": "Compare three worker/provider pairs.",
        "members": ["notification-channels:node:1", "notification-channels:node:2", "notification-channels:node:3", "notification-channels:node:4", "notification-channels:node:5", "notification-channels:node:6"],
        "layout": "peers"
      }
    ],
    "predictions": [
      {
        "id": "notification-channels:predict:email-down",
        "title": "Predict email outage behavior",
        "prompt": "Email service is unavailable while push and SMS remain healthy. What follows from the displayed separation?",
        "options": ["Control and retain email work; other eligible channels may continue", "Turn every promotional email into SMS automatically", "Treat provider acceptance as proof the recipient saw the message"],
        "correctIndex": 0,
        "explanation": "The Email worker → Email service path is affected. Other worker/provider pairs remain separate, and fallback requires an explicit eligible product policy.",
        "reveal": {
          "id": "notification-channels:reveal:email-down",
          "title": "Predict email outage behavior",
          "description": "The Email worker → Email service path is affected. Other worker/provider pairs remain separate, and fallback requires an explicit eligible product policy.",
          "nodeIds": ["notification-channels:node:1", "notification-channels:node:2", "notification-channels:node:3", "notification-channels:node:4", "notification-channels:node:5", "notification-channels:node:6"],
          "linkIds": ["notification-channels:relation:3", "notification-channels:relation:5"],
          "statuses": {
            "notification-channels:node:2": "under-pressure",
            "notification-channels:node:5": "unavailable",
            "notification-channels:node:4": "active",
            "notification-channels:node:6": "active"
          },
          "viewId": "notification-channels:view:providers"
        }
      }
    ]
  },
  "notification-reliability": {
    "layout": "tiers",
    "nodeRoles": {
      "notification-reliability:node:0": {"lane": 0, "order": 2, "semanticId": "attempt-queue"},
      "notification-reliability:node:1": {"lane": 1, "order": 2, "semanticId": "worker"},
      "notification-reliability:node:2": {"lane": 2, "order": 1, "semanticId": "provider"},
      "notification-reliability:node:3": {"lane": 2, "order": 3, "semanticId": "attempt-log"},
      "notification-reliability:node:4": {"lane": 3, "order": 3, "semanticId": "dead-letter"}
    },
    "relationships": {
      "notification-reliability:relation:0": {"meaning": "delivery", "condition": "When queued work is leased or redelivered before acknowledgement.", "explanation": "The worker must tolerate repeated execution of the same attempt."},
      "notification-reliability:relation:1": {"meaning": "request", "condition": "For one stable delivery-attempt identity.", "explanation": "The worker calls the provider with an idempotency key where the provider supports it."},
      "notification-reliability:relation:2": {"meaning": "write", "condition": "After the worker can record provider evidence.", "explanation": "The outcome is persisted in Attempt log. This authored Provider → Attempt log arrow summarizes result recording by the worker; it is not a provider-owned database write."},
      "notification-reliability:relation:3": {"meaning": "decision", "condition": "After bounded retry policy is exhausted.", "explanation": "The retained attempt and context move to operator-visible dead-letter handling."},
      "notification-reliability:relation:4": {"meaning": "response", "condition": "For a transient failure or ambiguous provider timeout eligible for bounded retry.", "explanation": "The provider outcome returns to Worker, which chooses backoff and retry. Permanent invalid destinations are not retried."}
    },
    "groups": [
      {
        "id": "notification-reliability:attempt-recovery",
        "title": "Attempt recovery",
        "description": "Attempt evidence and dead-letter state retain the context needed for controlled replay.",
        "members": ["notification-reliability:node:3", "notification-reliability:node:4"]
      }
    ],
    "scenes": [
      {
        "id": "notification-reliability:attempt",
        "title": "Use a stable identity across retries",
        "description": "At-least-once queue work reaches Worker. Stable attempt identity and provider idempotency where supported reduce duplicate external effects.",
        "nodeIds": ["notification-reliability:node:0", "notification-reliability:node:1", "notification-reliability:node:2"],
        "linkIds": ["notification-reliability:relation:0", "notification-reliability:relation:1"]
      },
      {
        "id": "notification-reliability:ambiguous",
        "title": "A provider timeout can hide acceptance",
        "description": "The provider may accept before Worker records the result. A timeout is ambiguous, so retry cannot be described as guaranteed exactly-once delivery.",
        "nodeIds": ["notification-reliability:node:1", "notification-reliability:node:2", "notification-reliability:node:3"],
        "linkIds": ["notification-reliability:relation:1", "notification-reliability:relation:2", "notification-reliability:relation:4"]
      },
      {
        "id": "notification-reliability:classify",
        "title": "Separate transient from permanent outcomes",
        "description": "Transient timeouts and 5xx can retry under bounded backoff. Invalid tokens, malformed addresses, and denied consent are terminal outcomes.",
        "nodeIds": ["notification-reliability:node:1", "notification-reliability:node:2", "notification-reliability:node:3"],
        "linkIds": ["notification-reliability:relation:1", "notification-reliability:relation:2", "notification-reliability:relation:4"]
      },
      {
        "id": "notification-reliability:dead-letter",
        "title": "Inspect bounded failures with original identity",
        "description": "After the retry budget, retain state and context in Dead letter for inspection and controlled replay. Replay keeps the original notification identity.",
        "nodeIds": ["notification-reliability:node:1", "notification-reliability:node:2", "notification-reliability:node:3", "notification-reliability:node:4"],
        "linkIds": ["notification-reliability:relation:2", "notification-reliability:relation:3"]
      }
    ],
    "views": [
      {
        "id": "notification-reliability:view:provider-attempt",
        "title": "Provider attempt",
        "description": "Inspect the send, outcome record, and transient-retry loop.",
        "members": ["notification-reliability:node:1", "notification-reliability:node:2", "notification-reliability:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "notification-reliability:view:failure-state",
        "title": "Failure state",
        "description": "Attempt evidence and dead-letter handling are distinct from sending.",
        "members": ["notification-reliability:node:3", "notification-reliability:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "notification-reliability:predict:timeout-after-accept",
        "title": "Predict ambiguous retry",
        "prompt": "Provider accepted the request, then Worker crashed before storing its result. What can a repeated queue attempt risk?",
        "options": ["Duplicate provider effects unless supported idempotency prevents them", "Exactly one recipient delivery by queue guarantee", "The provider request is automatically reversed"],
        "correctIndex": 0,
        "explanation": "At-least-once work can execute again after the worker crash. A stable attempt key and provider idempotency reduce duplicates, while unsupported external idempotency leaves residual ambiguity.",
        "reveal": {
          "id": "notification-reliability:reveal:timeout-after-accept",
          "title": "Predict ambiguous retry",
          "description": "At-least-once work can execute again after the worker crash. A stable attempt key and provider idempotency reduce duplicates, while unsupported external idempotency leaves residual ambiguity.",
          "nodeIds": ["notification-reliability:node:0", "notification-reliability:node:1", "notification-reliability:node:2", "notification-reliability:node:3"],
          "linkIds": ["notification-reliability:relation:0", "notification-reliability:relation:1", "notification-reliability:relation:2"],
          "statuses": {
            "notification-reliability:node:1": "unavailable",
            "notification-reliability:node:2": "active"
          }
        }
      }
    ]
  },
  "notification-pacing": {
    "layout": "tiers",
    "nodeRoles": {
      "notification-pacing:node:0": {"lane": 0, "order": 2, "semanticId": "schedule"},
      "notification-pacing:node:1": {"lane": 1, "order": 2, "semanticId": "pacer"},
      "notification-pacing:node:2": {"lane": 2, "order": 1, "semanticId": "urgent-lane"},
      "notification-pacing:node:3": {"lane": 2, "order": 3, "semanticId": "campaign-lane"},
      "notification-pacing:node:4": {"lane": 3, "order": 2, "semanticId": "provider"}
    },
    "relationships": {
      "notification-pacing:relation:0": {"meaning": "connection", "condition": "", "explanation": "Schedule (due time + zone) leads to Pacer (consent + limits) in this lesson. Schedule and pace large fanouts rather than releasing all recipients at once."},
      "notification-pacing:relation:1": {"meaning": "connection", "condition": "", "explanation": "Pacer (consent + limits) leads to Urgent lane (reserved capacity) in this lesson. Schedule and pace large fanouts rather than releasing all recipients at once."},
      "notification-pacing:relation:2": {"meaning": "connection", "condition": "", "explanation": "Pacer (consent + limits) leads to Campaign lane (bounded batches) in this lesson. Schedule and pace large fanouts rather than releasing all recipients at once."},
      "notification-pacing:relation:3": {"meaning": "connection", "condition": "", "explanation": "Urgent lane (reserved capacity) leads to Provider (throughput quota) in this lesson. Schedule and pace large fanouts rather than releasing all recipients at once."},
      "notification-pacing:relation:4": {"meaning": "connection", "condition": "", "explanation": "Campaign lane (bounded batches) leads to Provider (throughput quota) in this lesson. Schedule and pace large fanouts rather than releasing all recipients at once."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "notification-pacing:explain:1",
        "title": "Store due work durably",
        "description": "A scheduled campaign stores a due time and recipient selection plan. A scheduler releases due intents into channel queues in bounded batches, taking account of time zones, quiet hours, and newly changed preferences. For a large audience, avoid loading every recipient into one process or firing the whole campaign in one second.",
        "nodeIds": ["notification-pacing:node:0", "notification-pacing:node:1", "notification-pacing:node:3"],
        "linkIds": ["notification-pacing:relation:0", "notification-pacing:relation:2"],
        "viewId": "notification-pacing:view:point-1"
      },
      {
        "id": "notification-pacing:explain:2",
        "title": "Reserve capacity and enforce layered limits",
        "description": "Apply limits at several levels: an individual user should not receive too many promotional messages; each provider account has a throughput or cost budget; urgent transactional work may need reserved capacity. These limits solve different problems. A global provider quota does not prevent one user from being overwhelmed, and a per-user cap does not protect a provider during a huge burst.",
        "nodeIds": ["notification-pacing:node:1", "notification-pacing:node:2", "notification-pacing:node:4"],
        "linkIds": ["notification-pacing:relation:1", "notification-pacing:relation:3"],
        "viewId": "notification-pacing:view:point-2"
      },
      {
        "id": "notification-pacing:explain:3",
        "title": "Bound batches and measure queue age",
        "description": "Batching reduces provider calls when the channel supports it, but batches should remain small enough for retries and per-recipient status. Queue age, not only queue length, reveals whether a campaign is making people wait beyond its promised window. Drop stale promotional items only under a documented expiry policy; do not silently drop transactional alerts.",
        "nodeIds": ["notification-pacing:node:3", "notification-pacing:node:4"],
        "linkIds": ["notification-pacing:relation:4"],
        "viewId": "notification-pacing:view:point-3"
      }
    ],
    "views": [
      {
        "id": "notification-pacing:view:point-1",
        "title": "Store due work durably",
        "description": "A scheduled campaign stores a due time and recipient selection plan. A scheduler releases due intents into channel queues in bounded batches, taking account of time zones, quiet hours, and newly changed preferences. For a large audience, avoid loading every recipient into one process or firing the whole campaign in one second.",
        "members": ["notification-pacing:node:0", "notification-pacing:node:1", "notification-pacing:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "notification-pacing:view:point-2",
        "title": "Reserve capacity and enforce layered limits",
        "description": "Apply limits at several levels: an individual user should not receive too many promotional messages; each provider account has a throughput or cost budget; urgent transactional work may need reserved capacity. These limits solve different problems. A global provider quota does not prevent one user from being overwhelmed, and a per-user cap does not protect a provider during a huge burst.",
        "members": ["notification-pacing:node:1", "notification-pacing:node:2", "notification-pacing:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "notification-pacing:view:point-3",
        "title": "Bound batches and measure queue age",
        "description": "Batching reduces provider calls when the channel supports it, but batches should remain small enough for retries and per-recipient status. Queue age, not only queue length, reveals whether a campaign is making people wait beyond its promised window. Drop stale promotional items only under a documented expiry policy; do not silently drop transactional alerts.",
        "members": ["notification-pacing:node:3", "notification-pacing:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "notification-pacing:predict:notification-q17",
        "title": "Predict the design consequence",
        "prompt": "A large campaign and urgent receipts share a send pipeline. What helps preserve receipt latency?",
        "options": ["Delete every campaign item", "Reserve priority capacity and release the campaign in bounded batches", "Make receipts promotional", "Use one unbounded batch"],
        "correctIndex": 1,
        "explanation": "Pacing campaign work and reserving transactional capacity prevent a bulk release from starving receipts.",
        "reveal": {
          "id": "notification-pacing:reveal:notification-q17",
          "title": "Why this choice follows",
          "description": "Pacing campaign work and reserving transactional capacity prevent a bulk release from starving receipts.",
          "nodeIds": ["notification-pacing:node:0", "notification-pacing:node:1", "notification-pacing:node:2", "notification-pacing:node:3"],
          "linkIds": ["notification-pacing:relation:0", "notification-pacing:relation:1", "notification-pacing:relation:2"]
        }
      }
    ]
  },
  "notification-operations": {
    "layout": "tiers",
    "nodeRoles": {
      "notification-operations:node:0": {"lane": 0, "order": 2, "semanticId": "intent"},
      "notification-operations:node:1": {"lane": 1, "order": 2, "semanticId": "queue"},
      "notification-operations:node:2": {"lane": 3, "order": 2, "semanticId": "provider"},
      "notification-operations:node:3": {"lane": 4, "order": 2, "semanticId": "callback"},
      "notification-operations:node:4": {"lane": 2, "order": 4, "semanticId": "monitor"}
    },
    "relationships": {
      "notification-operations:relation:0": {"meaning": "connection", "condition": "", "explanation": "Intent (accepted / suppressed) leads to Queue (waiting / retrying) in this lesson. Follow one stable ID through acceptance, policy, queue, provider, and callback states."},
      "notification-operations:relation:1": {"meaning": "connection", "condition": "", "explanation": "Queue (waiting / retrying) leads to Provider (accepted / rejected) in this lesson. Follow one stable ID through acceptance, policy, queue, provider, and callback states."},
      "notification-operations:relation:2": {"meaning": "connection", "condition": "", "explanation": "Provider (accepted / rejected) leads to Callback (bounce / delivered) in this lesson. Follow one stable ID through acceptance, policy, queue, provider, and callback states."},
      "notification-operations:relation:3": {"meaning": "connection", "condition": "", "explanation": "Queue → Monitor: queue age. lag, errors, dead letters."},
      "notification-operations:relation:4": {"meaning": "connection", "condition": "", "explanation": "Provider → Monitor: errors. lag, errors, dead letters."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "notification-operations:explain:1",
        "title": "Measure every delivery stage",
        "description": "Track accepted intents, eligibility suppressions, queue age, worker failures, provider latency and error rate, retries, dead-letter count, accepted-by-provider rate, bounces, and invalid tokens. Label these by channel, provider, and priority without placing personal content in metrics or logs. Alert on end-to-end time for urgent messages, not just total queue depth.",
        "nodeIds": ["notification-operations:node:0", "notification-operations:node:1", "notification-operations:node:2", "notification-operations:node:3", "notification-operations:node:4"],
        "linkIds": ["notification-operations:relation:0", "notification-operations:relation:1", "notification-operations:relation:2", "notification-operations:relation:3", "notification-operations:relation:4"]
      },
      {
        "id": "notification-operations:explain:2",
        "title": "Retain an explainable notification timeline",
        "description": "An event timeline keyed by notification ID lets support answer what happened: accepted, suppressed, queued, attempted, accepted by provider, bounced, or opened where measurable. Open and click events are incomplete and affected by client behavior; they are product signals, not a delivery proof. Retain only necessary personal data and constrain access to message content.",
        "nodeIds": ["notification-operations:node:0", "notification-operations:node:1", "notification-operations:node:2"],
        "linkIds": ["notification-operations:relation:0", "notification-operations:relation:1"],
        "viewId": "notification-operations:view:point-2"
      },
      {
        "id": "notification-operations:explain:3",
        "title": "Control the affected provider backlog",
        "description": "For provider outages, pause or divert the affected queue according to policy, keep the durable backlog, use controlled retries or a consented fallback, and monitor age against the promise. Drill a failure where one provider is down while others continue, and another where a callback is duplicated. The design is complete only when operators can explain and recover those paths.",
        "nodeIds": ["notification-operations:node:1", "notification-operations:node:2", "notification-operations:node:3", "notification-operations:node:4"],
        "linkIds": ["notification-operations:relation:1", "notification-operations:relation:2", "notification-operations:relation:3", "notification-operations:relation:4"],
        "viewId": "notification-operations:view:point-3"
      }
    ],
    "views": [
      {
        "id": "notification-operations:view:point-2",
        "title": "Retain an explainable notification timeline",
        "description": "An event timeline keyed by notification ID lets support answer what happened: accepted, suppressed, queued, attempted, accepted by provider, bounced, or opened where measurable. Open and click events are incomplete and affected by client behavior; they are product signals, not a delivery proof. Retain only necessary personal data and constrain access to message content.",
        "members": ["notification-operations:node:0", "notification-operations:node:1", "notification-operations:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "notification-operations:view:point-3",
        "title": "Control the affected provider backlog",
        "description": "For provider outages, pause or divert the affected queue according to policy, keep the durable backlog, use controlled retries or a consented fallback, and monitor age against the promise. Drill a failure where one provider is down while others continue, and another where a callback is duplicated. The design is complete only when operators can explain and recover those paths.",
        "members": ["notification-operations:node:1", "notification-operations:node:2", "notification-operations:node:3", "notification-operations:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "notification-operations:predict:notification-q20",
        "title": "Predict the design consequence",
        "prompt": "An email provider is down while SMS remains healthy. What is a sound response?",
        "options": ["Discard the email backlog", "Pause all channels", "Send all email intents by SMS", "Retain and control the email backlog while other channels continue"],
        "correctIndex": 3,
        "explanation": "Channel isolation and durable queues let healthy providers continue while email is retried or held under policy.",
        "reveal": {
          "id": "notification-operations:reveal:notification-q20",
          "title": "Why this choice follows",
          "description": "Channel isolation and durable queues let healthy providers continue while email is retried or held under policy.",
          "nodeIds": ["notification-operations:node:1", "notification-operations:node:2", "notification-operations:node:4"],
          "linkIds": ["notification-operations:relation:1", "notification-operations:relation:3", "notification-operations:relation:4"],
          "statuses": {
            "notification-operations:node:2": "unavailable",
            "notification-operations:node:1": "under-pressure"
          }
        }
      }
    ]
  }
};
