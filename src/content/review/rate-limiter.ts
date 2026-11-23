import type { ReviewVariation } from "../../lib/review";

export const rateLimiterReview: Record<string, ReviewVariation> = {
  "rate-limiter/rate-scope": {
    prompts: ["A forum accepts replies from guests and signed-in members. Why might a limit keyed only by IP, or only by account, disappoint you?", "A nightly batch job you control keeps overwhelming an internal service. Why might a rate limiter not be the simplest fix?"],
    answer: "Identity follows the threat: per-IP catches one machine using many accounts but lumps shared networks together; per-account spares those users but does nothing before sign-in. A rule also needs an action, quota, period, and failure behavior. For your own batch work, a queue with a set worker pool is often simpler.",
  },
  "rate-limiter/rate-placement": {
    prompts: ["A video API’s quotas depend on each customer’s subscription tier. What would push you toward a gateway, and what toward application-level checks?", "A public image API applies its per-key limit before verifying the key. What can go wrong, and what order would you use?"],
    answer: "A gateway rejects early and may need no custom code; application checks see business context such as a plan, but run later. Verify keys before per-key limits, or a forged key drains another customer’s allowance, and put a rough IP limit in front of authentication.",
  },
  "rate-limiter/rate-token": {
    prompts: ["An upload limiter’s bucket holds 30 tokens and refills 1 per second. Starting full, what is the most it admits in a minute?", "A fragile legacy backend chokes on short bunches of requests, though its average load is fine. Would a token bucket protect it? Explain."],
    answer: "Capacity limits the burst and the refill rate governs sustained traffic, so starting full it admits up to 30 plus 60 refilled, or 90. A full bucket can release its whole capacity at once, so a fragile backend suits a leaky bucket, which paces output but adds queue delay.",
  },
  "rate-limiter/rate-windows": {
    prompts: ["A newsletter tool counts sends per calendar month, while a small search backend counts queries per minute. Which should worry about fixed windows, and why?", "A limiter must track two million clients on little memory, and a rough rolling cap is fine. Which approach fits, and what do you lose?"],
    answer: "Fixed blocks admit a burst across each boundary, harmless for a monthly quota but risky for a small backend guarded per minute. A sliding window counter needs little memory but only approximates, assuming requests in the prior block arrived evenly. A sliding window log is precise, yet stores every timestamp.",
  },
  "rate-limiter/rate-atomic": {
    prompts: ["Two limiter workers share a token bucket in Redis, updating its count and timestamp with separate commands. What goes wrong, and what fixes it?", "A few clients stay throttled indefinitely after a limiter crash, though their window ended long ago. What likely happened, and how do you prevent it?"],
    answer: "With separate steps, workers act on the same value and over-admit, so the check and update must be atomic; a short Lua script does that for a token bucket. Set expiry together with the increment, since a crash between them leaves a key that blocks its client forever.",
  },
  "rate-limiter/rate-distributed": {
    prompts: ["A customer calls your API from Tokyo and Paris under one global quota. Compare a single shared counter store with per-region counters.", "After the counter store fails over, a messaging API’s clients briefly exceed their quotas. What probably happened?"],
    answer: "One shared store keeps decisions accurate, but distant callers pay a round trip per request. Per-region counters are faster yet overshoot until totals converge, a product tradeoff to state explicitly. With asynchronous replication, a failover may drop recent increments, briefly restoring allowance.",
  },
  "rate-limiter/rate-operate": {
    prompts: ["A concert presale API rejected 3,000 clients in one second, telling each to wait 60 seconds. What happens next, and how would you soften it?", "A stricter limit on a public maps API might block real users. How would you roll it out, and when would that approach not fit?"],
    answer: "They all return together, and most get rejected again; up to 30 seconds of jitter, for example, spreads them to about 100 per second. Trial a new rule in shadow mode, recording would-be rejections and who they affect. That delays protection, so skip it during an active attack.",
  },
};
