import type { ReviewVariation } from "../../lib/review";

export const chatReview: Record<string, ReviewVariation> = {
  "chat/chat-scope": {
    prompts: ["A telehealth startup wants patient messaging. Name decisions that change what you build, not just how big it gets.", "A teacher posts a class message. What different promise does the system owe the teacher, an online student, and a student who is away?"],
    answer: "Conversation types, devices per account, retention, attachments, and end-to-end encryption, which rules out server-side search, all reshape the design. The sender is owed confirmation of acceptance, an online recipient fast delivery, and an absent one the message on return. A push or an online dot does not replace a stored message.",
  },
  "chat/chat-transport": {
    prompts: ["Three million open dashboards poll every 10 seconds, mostly finding nothing new. What load is that, and what would you consider instead?", "Moving a shared whiteboard from plain HTTP to WebSocket adds what ongoing work, and when is that work justified?"],
    answer: "That is 300,000 mostly empty requests per second; long polling cuts empty replies but needs timeout handling, and SSE streams one-way updates over HTTP. WebSocket adds live connection management, heartbeats, reconnects, backpressure, and credential refresh, so use it only when frequent two-way traffic justifies that.",
  },
  "chat/chat-connections": {
    prompts: ["A live-auction gateway holding 30,000 sockets dies. What should clients do so healthy gateways survive, and what rate results with a 30-second window?", "A routing directory lists a support agent’s laptop and phone as live. What can that directory not do when one of them drops?"],
    answer: "Clients retry with jitter: 30,000 authentications over 30 seconds is about 1,000 per second rather than all at once. The directory only points live delivery at each device’s gateway. After reconnecting, a device signs in again, lands on a new gateway, and reads stored history beyond its cursor.",
  },
  "chat/chat-delivery": {
    prompts: ["A dispatch app shows ‘sent’ once a driver’s message leaves the phone. Why is that misleading, and what should the label wait for?", "A ride-hailing app counts on push notifications to carry rider messages to sleeping phones. Why can messages still go missing, and what fixes it?"],
    answer: "Show ‘sent’ only after the server stores the message and acknowledges it; until then the send may have failed, and a retry with the same idempotency key must not duplicate it. Push is only a hint and earlier ones can vanish, so woken clients fetch history from storage.",
  },
  "chat/chat-ordering": {
    prompts: ["A warehouse scanner saves the highest event number it has seen as its resume point. How can that lose events after a reconnect?", "Every bid in a busy auction takes the next number from one counter. What can go wrong, and what would an alternative cost you?"],
    answer: "If event 16 arrives before 15, resuming after 16 skips 15 forever. Save the last position before the first gap, replay from there, and drop repeats by ID. A dense counter takes an atomic increment per number, so a hot sequence can bottleneck; time-sortable IDs avoid that, but gaps force range fetches.",
  },
  "chat/chat-presence": {
    prompts: ["You are choosing how long a lease lasts behind a support agent’s ‘available’ badge. What improves and what worsens as you lengthen it?", "A clinic app skips saving a patient’s message when the doctor’s dot is green, assuming live delivery will do. What can go wrong?"],
    answer: "A longer lease rides out missed heartbeats without flicker, but a dead device keeps looking online until it expires. Presence is only approximate: the recipient can vanish between the check and the send. So always save the message, try live delivery second, and let the saved copy serve catch-up.",
  },
  "chat/chat-groups": {
    prompts: ["A transit-alert channel has 200,000 followers and posts six times a minute. Compare inbox writes for copying to everyone with pushing to the active 5%.", "Why not have a 30-person study group pull messages at read time, the way a huge broadcast channel might?"],
    answer: "Copying to everyone costs 20,000 inbox writes per second; pushing to the active 5% costs 1,000, with others pulling on open. Pull charges every open with a read and an unread-count calculation, so a small group favors write fanout: bounded copies and simple inbox reads.",
  },
  "chat/chat-recovery": {
    prompts: ["In a hospital paging app, what separately protects against losing a stored page, a crashed delivery worker, a repeated push, and a dropped socket?", "A tutoring app commits a message, then enqueues its delivery job as a separate step. What failure does that allow, and what closes it?"],
    answer: "A replicated durable log protects the record, a retryable job queue lets another worker take over, stable message IDs let devices drop repeats, and replay from history fills socket gaps. A crash before a separate enqueue strands a message jobless; committing both in one transaction, an outbox, prevents it.",
  },
};
