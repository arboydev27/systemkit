import type { ReviewVariation } from "../../lib/review";

export const notificationReview: Record<string, ReviewVariation> = {
  "notification/notification-scope": {
    prompts: ["An airline sends gate-change alerts. Which separate states should it record, and what can it honestly claim at each one?", "A game reminds 600,000 players about a weekend event. Compare sending in five minutes with sending over an hour. What decides which is acceptable?"],
    answer: "Track separately: your service accepting it, the handoff, the provider accepting it, and the person opening or acting on it. Provider acceptance never proves someone saw it. Averages hide bursts: 2,000 per second in five minutes against about 170 over an hour. The category’s permitted delay decides.",
  },
  "notification/notification-ingest": {
    prompts: ["Why is publishing to a queue right after a booking’s database commit not enough for a confirmation that must never be lost?", "Ride-hailing ‘driver arrived’ alerts crawl whenever a marketing blast runs. What should the accepting and queueing design have separated?"],
    answer: "A crash between commit and publish loses the message, so commit an outbox row with the booking and let a dispatcher publish it; a stable event ID lets consumers drop repeats. Split queues and workers by channel or priority, and reserve capacity for urgent events, so bulk work cannot stall them.",
  },
  "notification/notification-personalize": {
    prompts: ["A news app caches each reader’s alert settings for five minutes to cut lookups. What does that save, and what risk does it add?", "A fitness app sends ‘class starting soon’ alerts for each booking. How should you scope the key that stops repeats of one alert?"],
    answer: "The cache saves a preference read per recipient, but an opt-out can be missed for up to five minutes, and consent should be read near send time. Key on one logical event, combining event ID, recipient, and category. Too broad collapses separate bookings; too narrow lets repeats through.",
  },
  "notification/notification-channels": {
    prompts: ["A clinic is replacing its SMS vendor. What should limit how far that change spreads, and when would something simpler be enough?", "A storm-warning app wants SMS to follow when a push goes unconfirmed. What must that rule specify before it ships?"],
    answer: "A provider adapter contains one vendor’s request shapes, credentials, limits, and response handling, so swapping vendors leaves ingestion alone; a lone provider with no switch planned needs only a plain wrapper. Fallback is a product rule: set the delay, allowed channels, consent, and a shared notification ID to avoid surprising doubles.",
  },
  "notification/notification-reliability": {
    prompts: ["One school alert gets a provider 5xx; another gets ‘malformed address’. How should the worker treat each, and where do failures end up?", "A client asks you to guarantee each alert is delivered exactly once across your service and your provider. What do you tell them?"],
    answer: "Retry transient failures such as a 5xx with exponential backoff, jitter, and a limit; a malformed address is permanent, so stop. Exhausted attempts go to a dead-letter queue. Exactly-once cannot be promised across independent services: at-least-once plus stable attempt keys and provider idempotency keys reduce duplicates, leaving some risk.",
  },
  "notification/notification-pacing": {
    prompts: ["A reminder goes to 900,000 voters on an account allowing 1,000 sends per second, 100 reserved. How long, and when is that too slow?", "A podcast app stays well under its provider quota, yet listeners complain of too many promos. What limit is missing, and why?"],
    answer: "900 per second gives about 1,000 seconds, or 17 minutes: fine for a reminder, unacceptable for something urgent like a login code. A per-user frequency cap protects people, while a provider quota protects throughput or cost. Neither does the other’s job, so enforce both.",
  },
  "notification/notification-operations": {
    prompts: ["A customer asks why a delivery-window text arrived late. What record lets support answer, and what would it show?", "What should page an operator for time-critical shift-change alerts, and why can a steady backlog still hide a problem?"],
    answer: "An event timeline keyed by a stable notification ID shows acceptance, each attempt, provider responses, and callbacks. For urgent messages, page on end-to-end delay and queue age, because steady depth can hide old or starved work. Timelines take storage, so set their retention on purpose.",
  },
};
