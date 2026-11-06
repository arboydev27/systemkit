import type { ReviewVariation } from "../../lib/review";

export const patternsReview: Record<string, ReviewVariation> = {
  "patterns/pt-idempotency": {
    prompts: ["A gift card redemption times out on the client. How do the client and server cooperate so a retry cannot redeem it twice?", "Your service sends paid texts through a provider, keeping idempotency keys in its own database. How can a crash still cause a double send?"],
    answer: "The client creates one key for the whole operation and reuses it on each attempt. The server stores it under a unique constraint in the effect’s database and replays the saved response. After a crash mid-call, only the provider knows the outcome, so pass it the key to deduplicate repeats.",
  },
  "patterns/pt-outbox": {
    prompts: ["A signup service saves a user, then publishes an event for onboarding. Some users never get onboarded. Why, and what fixes it?", "A teammate says a transactional outbox gives exactly-once delivery to consumers of inventory events. How would you correct them?"],
    answer: "Saving and publishing share no transaction, so a crash between them loses the event. Write an outbox row in the same transaction as the change, and let a relay publish it. A relay can die before marking a row sent, so delivery is at-least-once and consumers deduplicate by event ID.",
  },
  "patterns/pt-retries": {
    prompts: ["Why can the same retry policy rescue requests during a brief network blip yet prolong an outage during overload?", "A team adds exponential backoff to a photo app’s clients and calls retry overload solved. What could still keep the service overloaded?"],
    answer: "A retry works for a short blip with capacity to spare, but under overload it adds work, and timed-out requests keep the queue full. Backoff spaces attempts and jitter decorrelates them, yet new requests keep arriving. A retry budget caps the total, at the cost of some requests failing fast.",
  },
  "patterns/pt-protect": {
    prompts: ["A video site’s login stalls whenever its thumbnail service gets slow, even though login never calls thumbnails. How can that happen, and what limits it?", "A currency-rate API is swamped by incoming requests, though all its dependencies are healthy. Which defense fits, and what does it cost?"],
    answer: "Callers hold threads while waiting, so a slow dependency can drain a shared pool and stall unrelated requests. A timeout bounds the wait, and a circuit breaker pauses calls to the failing service. An overloaded server sheds load, rejecting early with a 503, at the cost of visible errors and tuning.",
  },
  "patterns/pt-backpressure": {
    prompts: ["A video processing queue with no limit has grown slowly for days without any errors. Why is that worse than it looks?", "A team spills a full analytics queue to disk and calls overload solved. Why might that be wrong, and what other limit policies exist?"],
    answer: "A queue smooths bursts, but when arrivals keep exceeding service it only delays failure as memory fills and work goes stale; disk merely enlarges the queue and leaves a backlog to repay. Bound it by the longest tolerable wait, then block producers that can wait, reject callers, or drop stale items.",
  },
  "patterns/pt-stampede": {
    prompts: ["A city weather forecast entry is read constantly and rebuilt by a slow query. How can readers avoid waiting, and when would that be unsafe?", "A nightly job loads a million catalog entries with the same one-hour expiry. What happens an hour later, and what simple change helps?"],
    answer: "Entries loaded together expire together, so jitter each TTL, which spreads many keys but cannot help a hot one. For a hot key, single-flight caps rebuilds, yet readers wait; serving the old value after a soft expiry, while one worker refreshes, avoids waiting. Stale serving suits forecasts, not permission checks.",
  },
};
