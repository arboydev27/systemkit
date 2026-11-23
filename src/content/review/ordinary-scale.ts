import type { ReviewVariation } from "../../lib/review";

export const ordinaryScaleReview: Record<string, ReviewVariation> = {
  "ordinary-scale/os-traffic": {
    prompts: ["A law firm’s document tool gets nearly all its requests during office hours. Why would dividing daily requests by 86,400 understate the load?", "An export endpoint gets only 5 requests per second, yet the app runs out of worker threads. What could explain that?"],
    answer: "Office use crowds into the working day, so divide by about 28,800 seconds (8 hours), then apply a peak factor. Concurrency is rate times duration, so 5 requests per second taking 20 seconds each means 100 in progress. Also count machine sources, such as polling and imports.",
  },
  "ordinary-scale/os-database": {
    prompts: ["A support ticket app’s owner wonders how much growth one Postgres instance can absorb. How would you find out?", "A booking site’s traffic is modest, yet its database is struggling. Which specific problems would you check before considering more databases?"],
    answer: "Test a copy holding production-sized data with your real query mix, raising load until p95 latency jumps, then compare that limit with your peak. Check first for missing indexes, exhausted connections, long locks, and data outgrowing memory. Writes that stay saturated despite tuning and more hardware justify splitting data.",
  },
  "ordinary-scale/os-monolith": {
    prompts: ["An architect wants microservices because the company just hired its twentieth engineer. What would you ask, and what might you try first?", "A hotel booking flow moves from in-process function calls to three separate services. What new failure and operating costs has the team accepted?"],
    answer: "Network calls can now fail or stall, work that shared one transaction can stop partway, and each service adds deploys, monitoring, and a versioned interface. Team size settles nothing: name the pressure, such as coordination, deploy conflicts, scaling, or failure isolation. A modular monolith or separate worker pool may suffice.",
  },
  "ordinary-scale/os-cache-queue": {
    prompts: ["Why is a cache often not the first fix for a slow school gradebook page, and what would you try instead?", "A small veterinary app needs background jobs, and an engineer proposes a message broker. What simpler start fits, and what would change your mind?"],
    answer: "A cache brings staleness, invalidation work, and cold starts, so first fix the query, add an index, or try a summary table. Cache repeated, expensive reads that can be slightly old. Start jobs in a database table committed with the business change; move to a broker when job queries become costly.",
  },
  "ordinary-scale/os-availability": {
    prompts: ["A 600 GB database restores at 200 MB/s. What does that imply for a contract promising 99.9% monthly availability?", "A city permits office runs a synchronized replica and wants to drop its backups. What failure would prove that a mistake?"],
    answer: "The restore takes about 50 minutes, already over the 43.2 minutes that 99.9% allows in a 30-day month, so run a standby in another zone and time real restores. A replica copies an accidental delete too, so keep backups and archived logs to recover to just before it.",
  },
  "ordinary-scale/os-reversible": {
    prompts: ["You launch a marketplace in a month. Which early choices are expensive to change later, and which can you decide quickly?", "A deferred fix is easy to reverse but takes months to ship. What can go wrong if the plan just says ‘revisit later’?"],
    answer: "Data ownership, public APIs, and the data model are costly to undo, so spend care there and settle internal choices such as caches quickly. For each deferred choice, record checkable evidence that would reopen it. Reversible fixes still have lead time, so start before headroom runs out.",
  },
};
