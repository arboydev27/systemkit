import type { TeachingContent } from "../../lib/spatial-learning-types";

// Authored explanation points and illustrative diagram scenarios.
export const chatTeachingContent: Record<string, TeachingContent> = {
  "chat-scope": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-scope:node:0": {"lane": 0, "order": 2, "semanticId": "sender"},
      "chat-scope:node:1": {"lane": 1, "order": 1, "semanticId": "acceptance"},
      "chat-scope:node:2": {"lane": 1, "order": 3, "semanticId": "live-delivery"},
      "chat-scope:node:3": {"lane": 2, "order": 3, "semanticId": "offline-recovery"}
    },
    "relationships": {
      "chat-scope:relation:0": {"meaning": "write", "condition": "", "explanation": "Sender → Acceptance: write. persisted + ID."},
      "chat-scope:relation:1": {"meaning": "connection", "condition": "", "explanation": "Acceptance → Live delivery: online. connected devices."},
      "chat-scope:relation:2": {"meaning": "connection", "condition": "", "explanation": "Acceptance → Offline recovery: offline later. retrieve from history."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "chat-scope:explain:1",
        "title": "Define conversations and supported devices",
        "description": "“Build chat” leaves important choices unanswered. For this design, assume text messages, one-to-one conversations, groups of at most 100 members, multiple devices per account, online indicators, and notifications when the app is away. Agree on a target audience, latency goal, history retention, and whether edits, attachments, or end-to-end encryption belong in the first release.",
        "nodeIds": ["chat-scope:node:0", "chat-scope:node:1", "chat-scope:node:2", "chat-scope:node:3"],
        "linkIds": ["chat-scope:relation:0", "chat-scope:relation:1", "chat-scope:relation:2"]
      },
      {
        "id": "chat-scope:explain:2",
        "title": "Separate acceptance from live delivery",
        "description": "Separate sending a message from receiving it. A sender needs an acceptance result; an online recipient should see the message quickly; an offline recipient should find it on return. These are three different promises. A green dot or push notification cannot stand in for durable message delivery.",
        "nodeIds": ["chat-scope:node:0", "chat-scope:node:1", "chat-scope:node:2", "chat-scope:node:3"],
        "linkIds": ["chat-scope:relation:0", "chat-scope:relation:1", "chat-scope:relation:2"]
      },
      {
        "id": "chat-scope:explain:3",
        "title": "Size concurrent connections and fanout",
        "description": "Estimate active concurrent connections, messages per second at peak, average message size, and group fanout. Registered accounts alone cannot size a connection fleet. Carry uncertain numbers as assumptions and revisit them when the path is designed.",
        "nodeIds": ["chat-scope:node:0", "chat-scope:node:1", "chat-scope:node:2"],
        "linkIds": ["chat-scope:relation:0", "chat-scope:relation:1"],
        "viewId": "chat-scope:view:point-3"
      }
    ],
    "views": [
      {
        "id": "chat-scope:view:point-3",
        "title": "Size concurrent connections and fanout",
        "description": "Estimate active concurrent connections, messages per second at peak, average message size, and group fanout. Registered accounts alone cannot size a connection fleet. Carry uncertain numbers as assumptions and revisit them when the path is designed.",
        "members": ["chat-scope:node:0", "chat-scope:node:1", "chat-scope:node:2"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-scope:predict:chat-q02",
        "title": "Predict the design consequence",
        "prompt": "A PM says “a sent message must survive the receiver being offline.” What system promise does that require?",
        "options": ["A green online indicator", "A shorter polling interval", "Durable storage and later catch-up", "A push notification only"],
        "correctIndex": 2,
        "explanation": "The server must retain the message and let the recipient fetch it later. Presence and push cannot guarantee history.",
        "reveal": {
          "id": "chat-scope:reveal:chat-q02",
          "title": "Why this choice follows",
          "description": "The server must retain the message and let the recipient fetch it later. Presence and push cannot guarantee history.",
          "nodeIds": ["chat-scope:node:1", "chat-scope:node:2", "chat-scope:node:3"],
          "linkIds": ["chat-scope:relation:1", "chat-scope:relation:2"]
        }
      }
    ]
  },
  "chat-transport": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-transport:node:0": {"lane": 0, "order": 1, "semanticId": "polling"},
      "chat-transport:node:1": {"lane": 0, "order": 2, "semanticId": "long-polling"},
      "chat-transport:node:2": {"lane": 0, "order": 4, "semanticId": "websocket"},
      "chat-transport:node:3": {"lane": 1, "order": 2, "semanticId": "chat-gateway"},
      "chat-transport:node:4": {"lane": 2, "order": 2, "semanticId": "recipient"}
    },
    "relationships": {
      "chat-transport:relation:0": {"meaning": "connection", "condition": "", "explanation": "Polling → Chat gateway: ask again. receives and pushes."},
      "chat-transport:relation:1": {"meaning": "request", "condition": "", "explanation": "Long polling → Chat gateway: hold request. receives and pushes."},
      "chat-transport:relation:2": {"meaning": "connection", "condition": "", "explanation": "WebSocket → Chat gateway: live channel. receives and pushes."},
      "chat-transport:relation:3": {"meaning": "connection", "condition": "", "explanation": "Chat gateway → Recipient: update. gets live update."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "chat-transport:explain:1",
        "title": "Compare polling and held requests",
        "description": "Ordinary HTTP works well for login and profile changes and can also send a message. For live delivery, short polling repeatedly asks for updates, creating empty requests when traffic is quiet. Long polling waits for an event or timeout before the client opens another request; it reduces empty replies but still needs reconnect and timeout handling.",
        "nodeIds": ["chat-transport:node:0", "chat-transport:node:1", "chat-transport:node:3", "chat-transport:node:4"],
        "linkIds": ["chat-transport:relation:0", "chat-transport:relation:1", "chat-transport:relation:3"],
        "viewId": "chat-transport:view:point-1"
      },
      {
        "id": "chat-transport:explain:2",
        "title": "Maintain a bidirectional live channel",
        "description": "A WebSocket starts with a client handshake and then holds a bidirectional channel. It suits frequent asynchronous chat updates, but the server must manage many live connections, heartbeats, reconnects, backpressure, and authentication refresh. A persistent channel is a delivery path, not durable storage.",
        "nodeIds": ["chat-transport:node:2", "chat-transport:node:3", "chat-transport:node:4"],
        "linkIds": ["chat-transport:relation:2", "chat-transport:relation:3"],
        "viewId": "chat-transport:view:point-2"
      },
      {
        "id": "chat-transport:explain:3",
        "title": "Choose transport for the actual product",
        "description": "Use the simplest transport that meets the product’s latency and scale goals. This chapter uses WebSocket for live send and receive while keeping routine account APIs on HTTP. Mobile push wakes an inactive device; it is a notification path and may be delayed or disabled.",
        "nodeIds": ["chat-transport:node:2", "chat-transport:node:3", "chat-transport:node:4"],
        "linkIds": ["chat-transport:relation:2", "chat-transport:relation:3"]
      }
    ],
    "views": [
      {
        "id": "chat-transport:view:point-1",
        "title": "Compare polling and held requests",
        "description": "Ordinary HTTP works well for login and profile changes and can also send a message. For live delivery, short polling repeatedly asks for updates, creating empty requests when traffic is quiet. Long polling waits for an event or timeout before the client opens another request; it reduces empty replies but still needs reconnect and timeout handling.",
        "members": ["chat-transport:node:0", "chat-transport:node:1", "chat-transport:node:3", "chat-transport:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "chat-transport:view:point-2",
        "title": "Maintain a bidirectional live channel",
        "description": "A WebSocket starts with a client handshake and then holds a bidirectional channel. It suits frequent asynchronous chat updates, but the server must manage many live connections, heartbeats, reconnects, backpressure, and authentication refresh. A persistent channel is a delivery path, not durable storage.",
        "members": ["chat-transport:node:2", "chat-transport:node:3", "chat-transport:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-transport:predict:chat-q05",
        "title": "Predict the design consequence",
        "prompt": "Which path best fits frequent server-initiated chat updates?",
        "options": ["A persistent WebSocket channel with connection management", "A CDN object per message", "DNS polling on each send", "A daily batch job"],
        "correctIndex": 0,
        "explanation": "WebSocket offers a bidirectional live channel. The gateway still needs authentication, heartbeats, reconnects, and backpressure.",
        "reveal": {
          "id": "chat-transport:reveal:chat-q05",
          "title": "Why this choice follows",
          "description": "WebSocket offers a bidirectional live channel. The gateway still needs authentication, heartbeats, reconnects, and backpressure.",
          "nodeIds": ["chat-transport:node:2", "chat-transport:node:3", "chat-transport:node:4"],
          "linkIds": ["chat-transport:relation:2", "chat-transport:relation:3"]
        }
      }
    ]
  },
  "chat-connections": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-connections:node:0": {"lane": 0, "order": 1, "semanticId": "phone"},
      "chat-connections:node:1": {"lane": 0, "order": 3, "semanticId": "laptop"},
      "chat-connections:node:2": {"lane": 1, "order": 2, "semanticId": "placement"},
      "chat-connections:node:3": {"lane": 2, "order": 1, "semanticId": "gateway-1"},
      "chat-connections:node:4": {"lane": 2, "order": 3, "semanticId": "gateway-2"},
      "chat-connections:node:5": {"lane": 3, "order": 2, "semanticId": "routes"}
    },
    "relationships": {
      "chat-connections:relation:0": {"meaning": "connection", "condition": "", "explanation": "Phone (device A) leads to Placement (healthy capacity) in this lesson. Track live routes per device, not only per account."},
      "chat-connections:relation:1": {"meaning": "connection", "condition": "", "explanation": "Laptop (device B) leads to Placement (healthy capacity) in this lesson. Track live routes per device, not only per account."},
      "chat-connections:relation:2": {"meaning": "connection", "condition": "", "explanation": "Placement (healthy capacity) leads to Gateway 1 (live socket A) in this lesson. Track live routes per device, not only per account."},
      "chat-connections:relation:3": {"meaning": "connection", "condition": "", "explanation": "Placement (healthy capacity) leads to Gateway 2 (live socket B) in this lesson. Track live routes per device, not only per account."},
      "chat-connections:relation:4": {"meaning": "connection", "condition": "", "explanation": "Gateway 1 (live socket A) leads to Routes (device → host) in this lesson. Track live routes per device, not only per account."},
      "chat-connections:relation:5": {"meaning": "connection", "condition": "", "explanation": "Gateway 2 (live socket B) leads to Routes (device → host) in this lesson. Track live routes per device, not only per account."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "chat-connections:explain:1",
        "title": "Place devices on healthy gateways",
        "description": "After authentication, a placement service chooses a healthy chat gateway with capacity near the device. The device connects and registers its user and device identity. A routing directory maps the active device to its gateway; the gateway owns the socket while connected.",
        "nodeIds": ["chat-connections:node:1", "chat-connections:node:2", "chat-connections:node:3", "chat-connections:node:4", "chat-connections:node:5"],
        "linkIds": ["chat-connections:relation:1", "chat-connections:relation:2", "chat-connections:relation:3", "chat-connections:relation:4", "chat-connections:relation:5"],
        "viewId": "chat-connections:view:point-1"
      },
      {
        "id": "chat-connections:explain:2",
        "title": "Track routes for each device",
        "description": "One account may have a phone and laptop on different gateways. Do not assume “user online” means there is only one destination. Gateways need limits for connection count, memory, and outbound queues. Drain them during deployment so clients reconnect gradually rather than all at once.",
        "nodeIds": ["chat-connections:node:0", "chat-connections:node:1", "chat-connections:node:2", "chat-connections:node:3", "chat-connections:node:4"],
        "linkIds": ["chat-connections:relation:0", "chat-connections:relation:1", "chat-connections:relation:2", "chat-connections:relation:3"],
        "viewId": "chat-connections:view:point-2"
      },
      {
        "id": "chat-connections:explain:3",
        "title": "Recover through reconnect and catch-up",
        "description": "If a gateway fails, the socket disappears. The client reconnects, authenticates again, receives a new placement, and requests messages since its last acknowledged cursor. The routing directory is a hint to live delivery; stored history is the recovery source.",
        "nodeIds": ["chat-connections:node:2", "chat-connections:node:3", "chat-connections:node:4"],
        "linkIds": ["chat-connections:relation:2", "chat-connections:relation:3"],
        "viewId": "chat-connections:view:point-3"
      }
    ],
    "views": [
      {
        "id": "chat-connections:view:point-1",
        "title": "Place devices on healthy gateways",
        "description": "After authentication, a placement service chooses a healthy chat gateway with capacity near the device. The device connects and registers its user and device identity. A routing directory maps the active device to its gateway; the gateway owns the socket while connected.",
        "members": ["chat-connections:node:1", "chat-connections:node:2", "chat-connections:node:3", "chat-connections:node:4", "chat-connections:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "chat-connections:view:point-2",
        "title": "Track routes for each device",
        "description": "One account may have a phone and laptop on different gateways. Do not assume “user online” means there is only one destination. Gateways need limits for connection count, memory, and outbound queues. Drain them during deployment so clients reconnect gradually rather than all at once.",
        "members": ["chat-connections:node:0", "chat-connections:node:1", "chat-connections:node:2", "chat-connections:node:3", "chat-connections:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "chat-connections:view:point-3",
        "title": "Recover through reconnect and catch-up",
        "description": "If a gateway fails, the socket disappears. The client reconnects, authenticates again, receives a new placement, and requests messages since its last acknowledged cursor. The routing directory is a hint to live delivery; stored history is the recovery source.",
        "members": ["chat-connections:node:2", "chat-connections:node:3", "chat-connections:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-connections:predict:gateway-down",
        "title": "Predict route recovery",
        "prompt": "Gateway 1 is unavailable, but Gateway 2 is healthy. What should recovery update after a device reconnects?",
        "options": ["Its device-to-host entry in Routes", "The canonical message into process-local memory", "Every account to one permanent gateway"],
        "correctIndex": 0,
        "explanation": "Placement must choose a healthy gateway and Routes must identify the new device host. A socket on the failed gateway cannot be recovered by a balancer alone.",
        "reveal": {
          "id": "chat-connections:reveal:gateway-down",
          "title": "Predict route recovery",
          "description": "Placement must choose a healthy gateway and Routes must identify the new device host. A socket on the failed gateway cannot be recovered by a balancer alone.",
          "nodeIds": ["chat-connections:node:2", "chat-connections:node:3", "chat-connections:node:4", "chat-connections:node:5"],
          "linkIds": ["chat-connections:relation:3", "chat-connections:relation:5"],
          "statuses": {
            "chat-connections:node:3": "unavailable",
            "chat-connections:node:4": "active"
          }
        }
      }
    ]
  },
  "chat-delivery": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-delivery:node:0": {"lane": 0, "order": 2, "semanticId": "sender"},
      "chat-delivery:node:1": {"lane": 1, "order": 2, "semanticId": "chat-service"},
      "chat-delivery:node:2": {"lane": 2, "order": 1, "semanticId": "history"},
      "chat-delivery:node:3": {"lane": 2, "order": 3, "semanticId": "delivery-job"},
      "chat-delivery:node:4": {"lane": 3, "order": 1, "semanticId": "online-device"},
      "chat-delivery:node:5": {"lane": 3, "order": 3, "semanticId": "offline-device"}
    },
    "relationships": {
      "chat-delivery:relation:0": {"meaning": "request", "condition": "When the sender submits a message or retries its stable key.", "explanation": "The submitted idempotency key identifies one logical message."},
      "chat-delivery:relation:1": {"meaning": "write", "condition": "After membership validation and server ID assignment.", "explanation": "The chat service persists the canonical record before durable acceptance."},
      "chat-delivery:relation:2": {"meaning": "publish", "condition": "Only after the message commit succeeds.", "explanation": "This authored handoff starts retryable delivery work after persistence."},
      "chat-delivery:relation:3": {"meaning": "delivery", "condition": "When a recipient device is offline.", "explanation": "The delivery job may send a push wake-up hint; the device retrieves canonical history later."},
      "chat-delivery:relation:4": {"meaning": "delivery", "condition": "When the recipient device has a live route.", "explanation": "The delivery job sends a socket event to the connected device; delivery is separate from a read receipt."}
    },
    "groups": [
      {
        "id": "chat-delivery:acceptance",
        "title": "Durable acceptance",
        "description": "The chat service validates and persists one canonical record.",
        "members": ["chat-delivery:node:1", "chat-delivery:node:2"]
      }
    ],
    "scenes": [
      {
        "id": "chat-delivery:accept",
        "title": "Persist before showing durable sent",
        "description": "The sender supplies an idempotency key. The service validates membership, assigns an ID and position, and commits the canonical message before acknowledging durable acceptance.",
        "nodeIds": ["chat-delivery:node:0", "chat-delivery:node:1", "chat-delivery:node:2"],
        "linkIds": ["chat-delivery:relation:0", "chat-delivery:relation:1"]
      },
      {
        "id": "chat-delivery:handoff",
        "title": "Start retryable delivery after commit",
        "description": "A persisted message creates retryable fanout work. Delivery failure does not erase the canonical history.",
        "nodeIds": ["chat-delivery:node:2", "chat-delivery:node:3"],
        "linkIds": ["chat-delivery:relation:2"]
      },
      {
        "id": "chat-delivery:online",
        "title": "Deliver to a connected device",
        "description": "The delivery worker checks each device route and pushes to its live channel. Accepted, delivered, and read remain different outcomes.",
        "nodeIds": ["chat-delivery:node:2", "chat-delivery:node:3", "chat-delivery:node:4"],
        "linkIds": ["chat-delivery:relation:2", "chat-delivery:relation:4"]
      },
      {
        "id": "chat-delivery:offline",
        "title": "Wake an offline device, then recover history",
        "description": "The offline branch may send a push hint. The message remains in History for later retrieval; the notification is not the message source of truth.",
        "nodeIds": ["chat-delivery:node:2", "chat-delivery:node:3", "chat-delivery:node:5"],
        "linkIds": ["chat-delivery:relation:2", "chat-delivery:relation:3"]
      },
      {
        "id": "chat-delivery:ambiguous",
        "title": "A timeout can follow a successful commit",
        "description": "The sender can miss the acceptance response after persistence. Reusing the same idempotency key reconciles the original message rather than creating another record.",
        "nodeIds": ["chat-delivery:node:0", "chat-delivery:node:1", "chat-delivery:node:2"],
        "linkIds": ["chat-delivery:relation:0", "chat-delivery:relation:1"]
      }
    ],
    "views": [
      {
        "id": "chat-delivery:view:acceptance",
        "title": "Acceptance path",
        "description": "Follow submission and commit before fanout.",
        "members": ["chat-delivery:node:0", "chat-delivery:node:1", "chat-delivery:node:2"],
        "layout": "pipeline"
      },
      {
        "id": "chat-delivery:view:delivery-branches",
        "title": "Delivery branches",
        "description": "Compare live delivery and the offline notification branch against durable history.",
        "members": ["chat-delivery:node:2", "chat-delivery:node:3", "chat-delivery:node:4", "chat-delivery:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-delivery:predict:offline-recipient",
        "title": "Predict durable acceptance",
        "prompt": "The recipient is offline after the service commits the message. Which state can the sender safely show?",
        "options": ["Durably accepted; delivery and read may happen later", "Read by every recipient", "Lost because the live socket is unavailable"],
        "correctIndex": 0,
        "explanation": "History already contains the canonical message. The Offline device branch can notify and later fetch; lack of a live socket does not undo acceptance.",
        "reveal": {
          "id": "chat-delivery:reveal:offline-recipient",
          "title": "Predict durable acceptance",
          "description": "History already contains the canonical message. The Offline device branch can notify and later fetch; lack of a live socket does not undo acceptance.",
          "nodeIds": ["chat-delivery:node:1", "chat-delivery:node:2", "chat-delivery:node:3", "chat-delivery:node:4", "chat-delivery:node:5"],
          "linkIds": ["chat-delivery:relation:1", "chat-delivery:relation:2", "chat-delivery:relation:3"],
          "statuses": {
            "chat-delivery:node:4": "unavailable",
            "chat-delivery:node:2": "active"
          }
        }
      }
    ]
  },
  "chat-ordering": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-ordering:node:0": {"lane": 0, "order": 2, "semanticId": "conversation"},
      "chat-ordering:node:1": {"lane": 1, "order": 2, "semanticId": "ordered-history"},
      "chat-ordering:node:2": {"lane": 2, "order": 1, "semanticId": "phone"},
      "chat-ordering:node:3": {"lane": 2, "order": 3, "semanticId": "laptop"}
    },
    "relationships": {
      "chat-ordering:relation:0": {"meaning": "decision", "condition": "", "explanation": "Conversation → Ordered history: assign order. conversation + sequence."},
      "chat-ordering:relation:1": {"meaning": "connection", "condition": "", "explanation": "Ordered history → Phone: after 44. cursor 44 → fetch 45–46."},
      "chat-ordering:relation:2": {"meaning": "connection", "condition": "", "explanation": "Ordered history → Laptop: after 39. cursor 39 → fetch 40–46."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "chat-ordering:explain:1",
        "title": "Give messages a conversation sequence",
        "description": "Client clocks and wall-clock timestamps cannot reliably order concurrent messages. Assign a monotonically increasing position within each conversation (or another sortable server-side order) and use a globally unique message ID for identity. A per-conversation sequence is often enough; the whole product need not share one total order.",
        "nodeIds": ["chat-ordering:node:0", "chat-ordering:node:1"],
        "linkIds": ["chat-ordering:relation:0"],
        "viewId": "chat-ordering:view:point-1"
      },
      {
        "id": "chat-ordering:explain:2",
        "title": "Recover each device from its cursor",
        "description": "Store messages keyed for the read pattern, such as conversation ID plus sequence, and page forward or backward from a cursor. Each device tracks the highest contiguous position it has applied per conversation. On reconnect, fetch positions after that cursor and deduplicate messages already seen through live delivery.",
        "nodeIds": ["chat-ordering:node:0", "chat-ordering:node:1", "chat-ordering:node:2", "chat-ordering:node:3"],
        "linkIds": ["chat-ordering:relation:0", "chat-ordering:relation:1", "chat-ordering:relation:2"]
      },
      {
        "id": "chat-ordering:explain:3",
        "title": "Make ordering coordination cost explicit",
        "description": "Ordering comes with a coordination cost. If one conversation gets exceptionally hot, its sequencer or partition may become a bottleneck; explain the chosen consistency promise rather than assuming that adding shards gives strict order for free. Membership changes and deletions also need explicit timeline semantics.",
        "nodeIds": ["chat-ordering:node:0", "chat-ordering:node:1"],
        "linkIds": ["chat-ordering:relation:0"]
      }
    ],
    "views": [
      {
        "id": "chat-ordering:view:point-1",
        "title": "Give messages a conversation sequence",
        "description": "Client clocks and wall-clock timestamps cannot reliably order concurrent messages. Assign a monotonically increasing position within each conversation (or another sortable server-side order) and use a globally unique message ID for identity. A per-conversation sequence is often enough; the whole product need not share one total order.",
        "members": ["chat-ordering:node:0", "chat-ordering:node:1"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-ordering:predict:laptop-cursor",
        "title": "Predict the displayed replay",
        "prompt": "Laptop has the displayed cursor 39 and Ordered history contains positions 40–46. What should the laptop retrieve?",
        "options": ["Positions 40–46", "Only positions 45–46, using the phone’s cursor", "Nothing because the phone is up to date"],
        "correctIndex": 0,
        "explanation": "The History → Laptop relation is labelled after 39. Cursors belong to each device and conversation; Phone has a different cursor, 44.",
        "reveal": {
          "id": "chat-ordering:reveal:laptop-cursor",
          "title": "Predict the displayed replay",
          "description": "The History → Laptop relation is labelled after 39. Cursors belong to each device and conversation; Phone has a different cursor, 44.",
          "nodeIds": ["chat-ordering:node:1", "chat-ordering:node:2", "chat-ordering:node:3"],
          "linkIds": ["chat-ordering:relation:1", "chat-ordering:relation:2"]
        }
      }
    ]
  },
  "chat-presence": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-presence:node:0": {"lane": 0, "order": 1, "semanticId": "phone"},
      "chat-presence:node:1": {"lane": 0, "order": 3, "semanticId": "laptop"},
      "chat-presence:node:2": {"lane": 1, "order": 2, "semanticId": "presence-service"},
      "chat-presence:node:3": {"lane": 2, "order": 2, "semanticId": "account"},
      "chat-presence:node:4": {"lane": 3, "order": 2, "semanticId": "viewer"}
    },
    "relationships": {
      "chat-presence:relation:0": {"meaning": "connection", "condition": "", "explanation": "Phone (heartbeat lease) leads to Presence service (expire with grace) in this lesson. Presence should tolerate transient disconnects and multiple devices."},
      "chat-presence:relation:1": {"meaning": "connection", "condition": "", "explanation": "Laptop (heartbeat lease) leads to Presence service (expire with grace) in this lesson. Presence should tolerate transient disconnects and multiple devices."},
      "chat-presence:relation:2": {"meaning": "connection", "condition": "", "explanation": "Presence service → Account: aggregate. any live device."},
      "chat-presence:relation:3": {"meaning": "connection", "condition": "", "explanation": "Account → Viewer: selective. status hint."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "chat-presence:explain:1",
        "title": "Renew device leases with grace",
        "description": "A connected device periodically renews a short-lived lease in a presence service. A logout can clear that device immediately; an abrupt disconnect expires after a grace period. An account is online when at least one eligible device has a current lease. Presence is approximate because heartbeats, routing, and observers are never perfectly simultaneous.",
        "nodeIds": ["chat-presence:node:0", "chat-presence:node:1", "chat-presence:node:2", "chat-presence:node:3"],
        "linkIds": ["chat-presence:relation:0", "chat-presence:relation:1", "chat-presence:relation:2"],
        "viewId": "chat-presence:view:point-1"
      },
      {
        "id": "chat-presence:explain:2",
        "title": "Publish useful presence changes selectively",
        "description": "Publish meaningful status changes to people currently viewing a small conversation or contact list. Sending every status flip to every member of a huge group can be much more expensive than message traffic. Large audiences can fetch a snapshot when they open the view, then subscribe only while interested.",
        "nodeIds": ["chat-presence:node:0", "chat-presence:node:1", "chat-presence:node:2", "chat-presence:node:4"],
        "linkIds": ["chat-presence:relation:0", "chat-presence:relation:1"],
        "viewId": "chat-presence:view:point-2"
      },
      {
        "id": "chat-presence:explain:3",
        "title": "Keep durable delivery independent of presence",
        "description": "Do not let presence decide whether to store a message. A recipient can disappear between a status check and a send. Persist first, attempt live delivery, and use the stored record for later catch-up.",
        "nodeIds": ["chat-presence:node:2", "chat-presence:node:3", "chat-presence:node:4"],
        "linkIds": ["chat-presence:relation:2", "chat-presence:relation:3"],
        "viewId": "chat-presence:view:point-3"
      }
    ],
    "views": [
      {
        "id": "chat-presence:view:point-1",
        "title": "Renew device leases with grace",
        "description": "A connected device periodically renews a short-lived lease in a presence service. A logout can clear that device immediately; an abrupt disconnect expires after a grace period. An account is online when at least one eligible device has a current lease. Presence is approximate because heartbeats, routing, and observers are never perfectly simultaneous.",
        "members": ["chat-presence:node:0", "chat-presence:node:1", "chat-presence:node:2", "chat-presence:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "chat-presence:view:point-2",
        "title": "Publish useful presence changes selectively",
        "description": "Publish meaningful status changes to people currently viewing a small conversation or contact list. Sending every status flip to every member of a huge group can be much more expensive than message traffic. Large audiences can fetch a snapshot when they open the view, then subscribe only while interested.",
        "members": ["chat-presence:node:0", "chat-presence:node:1", "chat-presence:node:2", "chat-presence:node:4"],
        "layout": "pipeline"
      },
      {
        "id": "chat-presence:view:point-3",
        "title": "Keep durable delivery independent of presence",
        "description": "Do not let presence decide whether to store a message. A recipient can disappear between a status check and a send. Persist first, attempt live delivery, and use the stored record for later catch-up.",
        "members": ["chat-presence:node:2", "chat-presence:node:3", "chat-presence:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-presence:predict:chat-q17",
        "title": "Predict the design consequence",
        "prompt": "A phone disconnects briefly but a laptop remains connected. What is the best account-level status?",
        "options": ["Online, because at least one device has a current lease", "Offline until the phone returns", "Always unknown", "Use the message sequence as status"],
        "correctIndex": 0,
        "explanation": "Account presence aggregates eligible devices. The laptop still provides a current online signal.",
        "reveal": {
          "id": "chat-presence:reveal:chat-q17",
          "title": "Why this choice follows",
          "description": "Account presence aggregates eligible devices. The laptop still provides a current online signal.",
          "nodeIds": ["chat-presence:node:0", "chat-presence:node:1", "chat-presence:node:2", "chat-presence:node:3"],
          "linkIds": ["chat-presence:relation:0", "chat-presence:relation:1", "chat-presence:relation:2"]
        }
      }
    ]
  },
  "chat-groups": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-groups:node:0": {"lane": 0, "order": 2, "semanticId": "sender"},
      "chat-groups:node:1": {"lane": 1, "order": 2, "semanticId": "group-service"},
      "chat-groups:node:2": {"lane": 2, "order": 1, "semanticId": "channel-log"},
      "chat-groups:node:3": {"lane": 2, "order": 3, "semanticId": "fanout-job"},
      "chat-groups:node:4": {"lane": 3, "order": 1, "semanticId": "member-b"},
      "chat-groups:node:5": {"lane": 3, "order": 3, "semanticId": "member-c"}
    },
    "relationships": {
      "chat-groups:relation:0": {"meaning": "connection", "condition": "", "explanation": "Sender (member A) leads to Group service (authorize + order) in this lesson. Small-group fanout buys simple inbox reads at a bounded write cost."},
      "chat-groups:relation:1": {"meaning": "write", "condition": "", "explanation": "Group service → Channel log: persist. one durable message."},
      "chat-groups:relation:2": {"meaning": "connection", "condition": "", "explanation": "Channel log → Fanout job: after save. member references."},
      "chat-groups:relation:3": {"meaning": "connection", "condition": "", "explanation": "Fanout job (member references) leads to Member B (inbox + socket) in this lesson. Small-group fanout buys simple inbox reads at a bounded write cost."},
      "chat-groups:relation:4": {"meaning": "connection", "condition": "", "explanation": "Fanout job (member references) leads to Member C (inbox + socket) in this lesson. Small-group fanout buys simple inbox reads at a bounded write cost."}
    },
    "groups": [],
    "scenes": [
      {
        "id": "chat-groups:explain:1",
        "title": "Persist before authorized group fanout",
        "description": "Authorize the sender against the group membership version, assign a sequence in that group, and persist one canonical message. A fanout job can put references in recipients’ inboxes or push live events to their devices. For groups capped near 100 members, this write-side work may make each person’s inbox simple to read.",
        "nodeIds": ["chat-groups:node:0", "chat-groups:node:1", "chat-groups:node:3", "chat-groups:node:4", "chat-groups:node:5"],
        "linkIds": ["chat-groups:relation:0", "chat-groups:relation:3", "chat-groups:relation:4"],
        "viewId": "chat-groups:view:point-1"
      },
      {
        "id": "chat-groups:explain:2",
        "title": "Keep canonical history separate from jobs",
        "description": "Do not confuse copies in delivery queues with copies of the canonical record. Decide what someone joining later may see, what happens when a member leaves, and whether a retry may repeat a fanout task. Idempotent fanout and membership checks keep those cases predictable.",
        "nodeIds": ["chat-groups:node:0", "chat-groups:node:3", "chat-groups:node:4", "chat-groups:node:5"],
        "linkIds": ["chat-groups:relation:3", "chat-groups:relation:4"],
        "viewId": "chat-groups:view:point-2"
      },
      {
        "id": "chat-groups:explain:3",
        "title": "Consider pull for very large channels",
        "description": "For a very large channel, copying a message to every follower is costly. Store by channel and let readers pull or use a hybrid for active members. The threshold depends on active readership, group size, and latency goals; “always fan out on write” is not a universal rule.",
        "nodeIds": ["chat-groups:node:1", "chat-groups:node:2", "chat-groups:node:3", "chat-groups:node:4", "chat-groups:node:5"],
        "linkIds": ["chat-groups:relation:1", "chat-groups:relation:2", "chat-groups:relation:3", "chat-groups:relation:4"],
        "viewId": "chat-groups:view:point-3"
      }
    ],
    "views": [
      {
        "id": "chat-groups:view:point-1",
        "title": "Persist before authorized group fanout",
        "description": "Authorize the sender against the group membership version, assign a sequence in that group, and persist one canonical message. A fanout job can put references in recipients’ inboxes or push live events to their devices. For groups capped near 100 members, this write-side work may make each person’s inbox simple to read.",
        "members": ["chat-groups:node:0", "chat-groups:node:1", "chat-groups:node:3", "chat-groups:node:4", "chat-groups:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "chat-groups:view:point-2",
        "title": "Keep canonical history separate from jobs",
        "description": "Do not confuse copies in delivery queues with copies of the canonical record. Decide what someone joining later may see, what happens when a member leaves, and whether a retry may repeat a fanout task. Idempotent fanout and membership checks keep those cases predictable.",
        "members": ["chat-groups:node:0", "chat-groups:node:3", "chat-groups:node:4", "chat-groups:node:5"],
        "layout": "pipeline"
      },
      {
        "id": "chat-groups:view:point-3",
        "title": "Consider pull for very large channels",
        "description": "For a very large channel, copying a message to every follower is costly. Store by channel and let readers pull or use a hybrid for active members. The threshold depends on active readership, group size, and latency goals; “always fan out on write” is not a universal rule.",
        "members": ["chat-groups:node:1", "chat-groups:node:2", "chat-groups:node:3", "chat-groups:node:4", "chat-groups:node:5"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-groups:predict:fanout-delay",
        "title": "Predict delayed group fanout",
        "prompt": "Fanout job is delayed after Channel log persists the group message. Which displayed responsibility still holds the canonical record?",
        "options": ["Channel log", "Every transient socket buffer only", "Fanout job as the sole message history"],
        "correctIndex": 0,
        "explanation": "One durable Channel log record precedes the retryable fanout job. Delivery copies can lag without becoming the canonical message.",
        "reveal": {
          "id": "chat-groups:reveal:fanout-delay",
          "title": "Predict delayed group fanout",
          "description": "One durable Channel log record precedes the retryable fanout job. Delivery copies can lag without becoming the canonical message.",
          "nodeIds": ["chat-groups:node:1", "chat-groups:node:2", "chat-groups:node:3", "chat-groups:node:4", "chat-groups:node:5"],
          "linkIds": ["chat-groups:relation:1", "chat-groups:relation:2"],
          "statuses": {
            "chat-groups:node:3": "under-pressure",
            "chat-groups:node:2": "active"
          }
        }
      }
    ]
  },
  "chat-recovery": {
    "layout": "tiers",
    "nodeRoles": {
      "chat-recovery:node:0": {"lane": 0, "order": 2, "semanticId": "client"},
      "chat-recovery:node:1": {"lane": 1, "order": 1, "semanticId": "gateway"},
      "chat-recovery:node:2": {"lane": 1, "order": 3, "semanticId": "worker"},
      "chat-recovery:node:3": {"lane": 2, "order": 1, "semanticId": "history"},
      "chat-recovery:node:4": {"lane": 2, "order": 3, "semanticId": "job-queue"},
      "chat-recovery:node:5": {"lane": 3, "order": 2, "semanticId": "monitor"}
    },
    "relationships": {
      "chat-recovery:relation:0": {"meaning": "request", "condition": "When a client recovers a broken connection.", "explanation": "The client reconnects to a healthy gateway with its saved cursor."},
      "chat-recovery:relation:1": {"meaning": "response", "condition": "When the client requests history after its cursor.", "explanation": "The drawn History → Gateway path carries replayed records back toward the recovering client."},
      "chat-recovery:relation:2": {"meaning": "acknowledgement", "condition": "After successful work, or when failure leaves work retryable.", "explanation": "The worker interacts with the queue through acknowledgement or retry; an unacknowledged job must remain recoverable."},
      "chat-recovery:relation:3": {"meaning": "publish", "condition": "When operational state is measured.", "explanation": "History lag or queue backlog contributes to monitoring; this is a signal path."},
      "chat-recovery:relation:4": {"meaning": "publish", "condition": "When operational state is measured.", "explanation": "History lag or queue backlog contributes to monitoring; this is a signal path."},
      "chat-recovery:relation:5": {"meaning": "connection", "condition": "In the authored split between live channels and delivery work.", "explanation": "The gateway and fanout worker have separate responsibilities; the diagram does not specify a transport protocol on this segment."}
    },
    "groups": [
      {
        "id": "chat-recovery:fanout",
        "title": "Retryable fanout",
        "description": "Worker and retained job queue make background delivery recoverable.",
        "members": ["chat-recovery:node:2", "chat-recovery:node:4"]
      }
    ],
    "scenes": [
      {
        "id": "chat-recovery:reconnect",
        "title": "Replace the socket and keep the cursor",
        "description": "The client reconnects through a replaceable gateway. Its saved recovery cursor identifies the history gap.",
        "nodeIds": ["chat-recovery:node:0", "chat-recovery:node:1", "chat-recovery:node:3"],
        "linkIds": ["chat-recovery:relation:0", "chat-recovery:relation:1"]
      },
      {
        "id": "chat-recovery:replay",
        "title": "Replay comes from canonical history",
        "description": "History supplies missed messages through the gateway. Local socket state can vanish without removing the durable record.",
        "nodeIds": ["chat-recovery:node:0", "chat-recovery:node:1", "chat-recovery:node:3"],
        "linkIds": ["chat-recovery:relation:0", "chat-recovery:relation:1"]
      },
      {
        "id": "chat-recovery:retry",
        "title": "Keep fanout recoverable after a crash",
        "description": "The worker acknowledges or retries queue work. At-least-once processing requires idempotent effects; a crash can leave an unacknowledged job for another worker.",
        "nodeIds": ["chat-recovery:node:1", "chat-recovery:node:2", "chat-recovery:node:4"],
        "linkIds": ["chat-recovery:relation:2", "chat-recovery:relation:5"]
      },
      {
        "id": "chat-recovery:measure",
        "title": "Observe delivery and recovery lag",
        "description": "History and queued work feed the operational view. Reconnect rate, replay backlog, and end-to-end delay help distinguish connection pressure from storage or fanout delay.",
        "nodeIds": ["chat-recovery:node:1", "chat-recovery:node:2", "chat-recovery:node:3", "chat-recovery:node:4", "chat-recovery:node:5"],
        "linkIds": ["chat-recovery:relation:2", "chat-recovery:relation:3", "chat-recovery:relation:4", "chat-recovery:relation:5"]
      }
    ],
    "views": [
      {
        "id": "chat-recovery:view:replay",
        "title": "Reconnect and replay",
        "description": "The client channel is replaced while history survives.",
        "members": ["chat-recovery:node:0", "chat-recovery:node:1", "chat-recovery:node:3"],
        "layout": "pipeline"
      },
      {
        "id": "chat-recovery:view:fanout",
        "title": "Worker recovery",
        "description": "Inspect the worker’s queue interaction.",
        "members": ["chat-recovery:node:1", "chat-recovery:node:2", "chat-recovery:node:4"],
        "layout": "pipeline"
      }
    ],
    "predictions": [
      {
        "id": "chat-recovery:predict:worker-crash",
        "title": "Predict a fanout crash",
        "prompt": "The worker crashes before acknowledging a delivery job. What should the durable Job queue permit?",
        "options": ["Another worker can retry with idempotent effects", "Canonical history disappears", "The client cursor becomes proof that every recipient read it"],
        "correctIndex": 0,
        "explanation": "Unacknowledged work remains retryable under the queue policy. History survives separately, and repeated processing must avoid duplicate effects.",
        "reveal": {
          "id": "chat-recovery:reveal:worker-crash",
          "title": "Predict a fanout crash",
          "description": "Unacknowledged work remains retryable under the queue policy. History survives separately, and repeated processing must avoid duplicate effects.",
          "nodeIds": ["chat-recovery:node:2", "chat-recovery:node:3", "chat-recovery:node:4"],
          "linkIds": ["chat-recovery:relation:2"],
          "statuses": {
            "chat-recovery:node:2": "unavailable",
            "chat-recovery:node:4": "active",
            "chat-recovery:node:3": "active"
          }
        }
      }
    ]
  }
};
