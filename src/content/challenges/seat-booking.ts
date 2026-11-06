import type { DesignChallengeContent } from "../design-challenge";

export const seatBookingChallenge: DesignChallengeContent = {
  id: "seat-booking",
  chapterId: "transactions",
  stepId: "tx-serializable",
  minutes: 30,
  adaptationTitle: "No stranded single seats",
  title: "Design ticketing for concert seats",
  summary: "Sell every seat exactly once through a huge on-sale spike, with temporary holds and payments that can fail or go silent.",
  brief: "Fans open a seat map for one concert, choose up to 4 specific seats, hold them for 10 minutes, and pay. Holds can expire and payments can fail, while most of the demand arrives in the first minute. Design the first version for one concert at a time. Keep resale, dynamic pricing, and bot detection outside this exercise.",
  assumptions: [
    "One concert has 50,000 assigned seats, in 100 sections of 500. An order holds 1 to 4 seats and averages 2.5. Use decimal units.",
    "500,000 fans are online when the sale opens. Each polls the seat map every 5 seconds and makes one hold attempt on average during the first 60 seconds.",
    "A hold lasts 10 minutes. Assume 80% of holds become paid orders, and the other 20% expire or fail payment and return their seats to sale.",
    "A charge takes about 3 seconds, and the provider can time out with no clear answer. It accepts idempotency keys. Seat and order rows average 200 bytes.",
    "A seat must not be sold to two buyers, and nobody should be charged without a ticket. The seat map may be a few seconds stale, but the decision to grant a hold may not.",
  ],
  change: "The venue adds a rule: a hold must not leave a single empty seat stranded between two taken seats in the same row. Two buyers claiming different seats at the same moment could strand one together, though neither would alone. How does your design enforce this during the spike, and what does it cost?",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope. Estimate peak seat-map reads, hold attempts, and seat checks per second, how many holds can succeed, charges in flight, and storage. Keep units visible.",
      placeholder: "Map reads per second = …\nHold attempts per second = …\nHolds that can succeed = …\nCharges in flight = …\nStorage = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name each component and what it is the authority for. Trace a hold, a successful payment, and a hold that expires. Say exactly what stops two buyers from holding one seat, and which isolation level or guard you rely on.",
      placeholder: "Seat map: client → …\nHold: client → …\nPay: …\nExpiry: …\nTwo buyers want one seat: …",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "A charge times out with no clear answer. Separately, a server crashes after a charge succeeds and before the seats are marked sold. Explain both outcomes, then name the bottleneck you expect during the spike and the metric that would show it.",
      placeholder: "On a payment timeout…\nAfter a crash mid-payment…\nI expect the bottleneck at…, shown by…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the new seating rule below. Explain whether your per-seat guard catches it, what you would change, and what the change costs at peak.",
      placeholder: "The rule breaks when…\nI would change…\nThe cost is…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates drive the design.", detail: "I separate seat-map reads, hold attempts, and charges, show units, and notice that the data is small while contention is the real limit." },
    { id: "guard", title: "A seat cannot be sold twice.", detail: "I name the exact guard, such as a conditional update, a unique constraint, or a serial writer, and say what the losing buyer sees." },
    { id: "locks", title: "No lock spans the payment call.", detail: "I record the hold in a short transaction and charge outside it, so a slow provider cannot pile up lock waits." },
    { id: "payment", title: "An unclear payment has a defined outcome.", detail: "I explain idempotency keys, keeping seats held until the outcome is known, reconciliation against the provider, and a refund when a charge has no ticket." },
    { id: "skew", title: "The new rule is treated as a multi-row invariant.", detail: "I explain why per-seat guards miss it, and what makes two conflicting holds collide or run one after the other." },
  ],
  estimateGuide: "Orders: 50,000 seats / 2.5 per order = 20,000 orders. At 80% conversion, selling out takes 20,000 / 0.8 = 25,000 holds over time, or 62,500 seat claims (25,000 × 2.5): the 50,000 final seats plus 12,500 reclaimed from the 5,000 holds that never paid. Seat map: 500,000 fans / 5 s = 100,000 reads/s. Hold attempts: 500,000 / 60 s ≈ 8,300 attempts/s, which is about 20,800 seat checks/s (8,333 × 2.5) and about 83 attempts/s per section on average. Seats cover at most 20,000 active holds at once, so only about 4% of first-minute attempts can succeed (20,000 / 500,000), and the rest should fail fast. Payments: if those 20,000 holds all try to pay evenly across 10 minutes, that is 20,000 / 600 s ≈ 33 charges/s, and at 3 s each about 100 charges in flight. People do not pay evenly, so leave headroom. Storage: 50,000 seat rows × 200 bytes = 10 MB, plus 25,000 orders × 200 bytes = 5 MB. The data is tiny, and contention on it is the problem.",
  solutions: [
    {
      id: "seat-rows",
      title: "Seat rows in one database, behind admission control",
      approach: "Pre-create one row per seat in a relational database, which materializes the conflict and makes that database the single authority. Stateless API servers run holds as short conditional updates. A waiting room admits hold attempts at a rate you have load-tested, for example 1,000 per second. Seat-map reads come from per-section snapshots cached at the CDN for about a second, so the 100,000 polls per second become at most about 100 rebuilds per second at the origin, assuming the CDN collapses concurrent misses.",
      paths: [
        "Hold: in one short transaction, update the requested seats, in sorted ID order to avoid deadlocks, to held with a hold ID and an expiry, WHERE the seat is free or its hold has expired. If the affected row count is below the number requested, roll back and tell the buyer which seats went. Insert the order in the same transaction. No lock outlives this transaction.",
        "Pay: mark the order paying and extend the hold past the provider's timeout, then commit. Charge outside any transaction, using the order ID as the idempotency key. On success, one transaction sets the seats to sold WHERE the hold ID still matches and the order to paid. On a decline, release the seats.",
        "Expire: the WHERE clause above makes an expired hold claimable immediately, so selling does not depend on a sweeper. A background job still closes expired orders and refreshes the counts behind the seat map.",
      ],
      failure: "A provider timeout leaves the outcome unknown, so keep the seats held and query the charge using its idempotency key before releasing anything. After a crash between charge and sale, a reconciliation job finds orders stuck in paying, asks the provider, and finishes the sale or releases the seats. A charge whose hold was somehow lost is refunded automatically. A database failure stops all sales, so run a synchronous standby and test promotion. Watch lock wait time, hold latency, rejection rate, and charges in flight, and lower the admission rate when lock waits climb.",
      adaptation: "Per-seat updates cannot see this rule: two holds on different seats touch different rows, so they can strand a seat together, which is write skew. Add a record per row of seats and, at read committed, lock it with SELECT ... FOR UPDATE at the start of the hold transaction, in sorted order if a hold spans rows, then read that row's seats, check the rule, and update. At a snapshot level the waiter would keep its old view and miss the other hold. Holds in one row now queue, but rows are short and so is the transaction. Alternatively, run holds at serializable and retry, which needs no lock record but raises abort rates in the hottest rows during the spike. Either way the rule applies at hold time, since an expiring hold can still reopen a gap.",
      tradeoff: "One authority makes correctness easy to argue, because the database enforces everything. Its write capacity caps the sale: at 1,000 attempts per second, 500,000 first attempts take over 8 minutes to admit unless requests for sold-out seats are rejected earlier. A single primary is also a shared fate for every section.",
    },
    {
      id: "section-serial",
      title: "Per-section serial claims in memory, with a database of record",
      approach: "Route each section's hold attempts to one single-threaded worker, for example a Redis Lua script over keys that share a hash slot, which checks and claims seats atomically with an expiry. At about 83 attempts per second per section, even a section ten times hotter is a modest load for one thread, subject to benchmarking. A relational database stays the durable record of orders and sold seats, with a unique constraint on concert and seat. A hold must fit inside one section.",
      paths: [
        "Hold: the script checks each requested seat and, only if all are free or expired, records them with the hold ID and a 10-minute expiry. There is no lock to wait on, and a sold-out section rejects instantly. Nothing has reached the database yet, and that is acceptable because no money has moved.",
        "Pay: write a pending order to the database, extend the hold in the script past the provider's timeout, and charge using the order ID as the idempotency key. On success, one database transaction inserts the sold seats and marks the order paid. If the unique constraint rejects a seat, refund the charge. Then tell the script the seats are sold.",
        "Seat map: build per-section snapshots from memory about once per second and serve them through the CDN. Fans see a seat as taken within a few seconds of a claim, and a stale map only costs a rejected attempt.",
      ],
      failure: "Redis replicates asynchronously, so a failover can lose recent holds, and two buyers may then hold one seat. The unique constraint still prevents a double sale, but the loser gets a refund and an apology, which is a real cost. A buyer whose hold vanished before paying gets an error at the pay step. After a failure, rebuild the section from sold seats and pending orders before reopening it. A payment timeout is resolved by querying the charge with its idempotency key, and a reconciliation job compares charges with paid orders, finishing the sale or refunding. Watch script latency per section, failovers, constraint violations, and refunds, since the last two show how often the fast path let buyers down.",
      adaptation: "The rule is easy to add here, because each section's script already runs alone: read the row's seats inside the script, reject a claim that would strand one, and claim in the same step, with no race to reason about. The catch is the backstop. A unique constraint cannot express this rule, so a failover that loses holds can let a stranded seat through. That may be acceptable, since the rule protects revenue rather than the promise of one buyer per seat. Keep the check to one row, because a longer script delays everything queued for that section.",
      tradeoff: "Much higher peak throughput, instant rejection, and independent sections, at the cost of two stores that can disagree, a rebuild procedure to rehearse, a rare case where someone holding a seat loses it, and holds that cannot span sections without another protocol.",
    },
  ],
};
