import type { DesignChallengeContent } from "../design-challenge";

export const apiQuotaChallenge: DesignChallengeContent = {
  id: "api-quota",
  chapterId: "rate-limiter",
  stepId: "rate-operate",
  minutes: 30,
  adaptationTitle: "Prepaid request packs",
  title: "Design rate limits and plan quotas for a public API",
  summary: "Apply the rate limiter chapter to two limits with different jobs: a per-second limit that protects capacity and a monthly quota that customers pay for.",
  brief: "A company sells a public API from three regions. Each API key has a per-second limit that protects the service and a monthly quota set by its paid plan. Design how requests are checked, how usage is counted across regions, and how customers learn where they stand. Keep the API’s own business logic, invoicing, and key issuance outside this exercise.",
  assumptions: [
    "Traffic averages 1,000 requests per second across all keys, with a peak of 5 times the average. Use a 30-day month of 2,592,000 seconds and decimal units.",
    "Plans: Free allows 10 requests per second and 1 million a month; Pro allows 100 per second and 50 million a month; Enterprise allows 1,000 per second and 1 billion a month. 50,000 keys are active in a month.",
    "The API runs in 3 regions with traffic roughly even across them. A cross-region round trip takes 80 ms, and the limiter’s decision must add under 5 ms at p99.",
    "The per-second limit protects capacity and may overshoot briefly. The monthly quota may overshoot by at most 0.1%, and usage that customers are billed for must not be lost.",
    "Limiter state takes 120 bytes per key in each region. A raw usage record is 100 bytes; an hourly rollup per key and region is 50 bytes.",
  ],
  change: "Sales launches prepaid packs: a customer buys 10 million requests up front, and the contract forbids serving even one request beyond what was paid for. Customers can buy more at any time. How do you stop at exactly the limit without putting an 80 ms call on every request?",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope. Estimate monthly requests, peak decisions per region, limiter state, and usage storage. Work out how long a key at its full per-second limit takes to use its monthly quota, and compare the cross-region round trip with the decision budget.",
      placeholder: "Requests per month = …\nDecisions per region at peak = …\nA Pro key at full rate uses its quota in…\nRound trip versus budget: …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores. Trace one allowed request, one request rejected by the per-second limit, and one rejected by the monthly quota, including what each response tells the client.",
      placeholder: "Allowed: client → gateway → …\nOver the per-second limit: …\nOver the monthly quota: …\nUsage is counted by…",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Work out the worst-case monthly overshoot for a key active in all three regions, given how often your regions sync. Then explain what happens if a regional counter store fails, and if one region is cut off from the others.",
      placeholder: "Worst-case overshoot = …\nIf the counter store fails, per-second checks…\nIf a region is cut off, quota checks…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the prepaid change below. Explain how a region decides it may serve a request, what happens near zero balance, and what a crashed region does to the customer’s remaining balance.",
      placeholder: "A region may serve a request when…\nNear zero balance…\nIf a region crashes…\nThe cost of this is…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I compare the cross-region round trip with the decision budget, and I compute how quickly a key at its per-second limit uses its monthly quota." },
    { id: "two-limits", title: "The two limits are treated as two problems.", detail: "I explain why the per-second limit and the monthly quota need different state, accuracy, and failure behavior." },
    { id: "atomic", title: "Counting is safe under concurrency and retries.", detail: "I name the atomic operation for the per-second check, and I explain how repeated usage records avoid double counting." },
    { id: "overshoot", title: "Regional overshoot is bounded.", detail: "I state the worst case for a key active in all three regions and compare it with the 0.1% allowance." },
    { id: "client", title: "Clients can act on a rejection.", detail: "I distinguish a per-second 429 from an exhausted monthly quota, including what each tells the client to do next." },
  ],
  estimateGuide: "Month: 30 × 86,400 = 2,592,000 seconds. At 1,000 requests per second that is 2.592 billion requests a month, with a peak of 5,000 per second, or about 1,667 decisions per second in each region. The 80 ms round trip is 16 times the 5 ms budget, so the per-request decision must stay inside the region. State: 50,000 keys × 120 bytes = 6 MB per region, so memory is not the constraint. Time to use a quota at the full limit: Free 1 million ÷ 10 = 100,000 seconds, about 28 hours; Pro 50 million ÷ 100 = 500,000 seconds, about 5.8 days; Enterprise 1 billion ÷ 1,000 = 1,000,000 seconds, about 11.6 days. A per-second limit therefore does not protect a monthly quota. With a 10-second sync and each region enforcing the full limit, worst-case overshoot is limit × 10 × 3: Free 300 (0.03%), Pro 3,000 (0.006%), Enterprise 30,000 (0.003%), all inside 0.1%. Usage storage: 2.592 billion × 100 bytes = 259.2 GB a month raw; 50,000 keys × 3 regions × 720 hours × 50 bytes = 5.4 GB a month as hourly rollups.",
  solutions: [
    {
      id: "synced-ledger",
      title: "Local buckets and a synced usage ledger",
      approach: "Enforce the per-second limit with a token bucket in a Redis instance in each region, and treat the monthly quota as a separately counted total. Gateways emit usage to a durable regional log, an aggregator builds hourly rollups into a global ledger, and each region receives updated totals every 10 seconds. Local checks stay fast, and the quota is allowed to lag by a bounded amount.",
      paths: [
        "Allowed request: the gateway authenticates the key and reads its plan from a local cache. A short Lua script in regional Redis spends a token and reads a cached “quota exhausted” flag in one atomic step. The gateway forwards the request and adds a usage record to its next batch.",
        "Usage: gateways write batches with stable IDs to a log such as Kafka. The aggregator deduplicates by batch ID, updates rollups, and publishes totals to all regions every 10 seconds, setting the flag on any key at its quota.",
        "Rejected request: over the per-second limit, return 429 with a Retry-After of about a second. Over the monthly quota, return 429 with a distinct error code, Retry-After set to the reset time, and remaining-quota headers, so a client does not retry until next month.",
      ],
      failure: "If regional Redis fails, per-second checks fall back to an approximate bucket in each gateway process, because a brief overshoot is acceptable and an outage is not. Usage is unaffected because it travels through the log. If the log is unavailable, gateways buffer to local disk; if the buffer fills, the design must choose between serving unbilled traffic and rejecting it, and should default to rejecting for free keys. A region cut off from the others keeps serving on its last totals, and its overshoot grows with the outage, so alert on sync age. Watch decision latency, sync age, and rejects by plan.",
      adaptation: "Prepaid keys cannot use this path, because lagging totals would serve requests nobody paid for. Add a small ledger in a home region that hands each region blocks of 1,000 requests. A region serves from its block with a local atomic decrement and asks for more in the background, so at 100 requests per second a key makes one 80 ms call about every 10 seconds, off the request path. Shrink blocks near zero balance, down to single requests. Leftover blocks return after a timeout, so a crashed region can make part of the balance unavailable for a few minutes. The dashboard shows the ledger balance minus outstanding blocks.",
      tradeoff: "Requests stay fast and the regular path is cheap and simple, and overshoot is small and calculable. A key enforced separately in each region can briefly reach three times its per-second limit, dashboards lag by seconds, and the usage pipeline is a system of its own. Prepaid keys need a second path.",
    },
    {
      id: "leased-quota",
      title: "Quota leases for every key",
      approach: "Make leasing the only way to spend quota. A quota service in a home region owns each key’s balance and grants regions blocks sized to their recent traffic. A region can serve only from a block it holds, so monthly overshoot is zero in normal operation. Per-second limits still use a local token bucket, with each region’s share of the limit adjusted from observed traffic.",
      paths: [
        "Allowed request: the gateway runs one Lua script in regional Redis that spends a token and decrements the key’s local block. If both succeed, it forwards the request and records usage for billing.",
        "Lease refill: when a block falls below a low-water mark, a background call to the quota service grants another, sized to about 60 seconds of that region’s recent traffic. The service updates the balance in one database transaction per grant. Requests keep flowing during the call.",
        "Rejected request: an empty token bucket returns 429 with a short Retry-After. Once the quota service refuses a refill because no balance remains and the block runs out, requests get 429 with a quota error code and the reset time.",
      ],
      failure: "If the home region is down, regions spend the blocks they hold, then apply a per-plan policy: paid monthly plans continue and record usage for later reconciliation, while free keys stop. That is a real availability dependency, so run a standby with tested promotion. A crashed region strands its blocks until they time out and return, which can reject requests while the balance appears to have room. Busy keys cause frequent grants, so monitor grant rate per key and grow block sizes for steady traffic. Billing reads the usage log, not the grants, so stranded blocks are not charged.",
      adaptation: "Prepaid packs fit this model with two changes: no fail-open during a home-region outage, and smaller blocks. As the balance nears zero, blocks shrink until the last requests each make a cross-region call and pay the 80 ms, in exchange for never exceeding what was paid. Buying more raises the balance, and the next grant reflects it. The dashboard must show a range, since blocks already granted may or may not be spent yet. The cost falls on the final few requests and on customers whose regions crash near zero.",
      tradeoff: "One mechanism covers every plan, and quota accuracy is exact. In exchange, the home region becomes part of request availability for any key that runs out of blocks, allowance can be stranded, and the quota service is a busier and more critical component than most monthly plans need. Keys that never approach their quota pay for precision they do not use.",
    },
  ],
};
