import type { ReviewVariation } from "../../lib/review";

export const urlReview: Record<string, ReviewVariation> = {
  "url/url-scope": {
    prompts: ["A museum wants short codes on exhibit labels that open audio guides. Which product decisions shape storage and code choice?", "Does a school room-booking tool storing 200 records a day for ten years need sharding? Show how you would decide."],
    answer: "Agree on the expected total, allowed characters, lifetime, whether targets can change, custom codes, and whether visits are counted. Then do the arithmetic with units and overhead visible: 200 a day for ten years is about 730,000 rows, which fits one database, so sharding only adds cost.",
  },
  "url/url-contract": {
    prompts: ["A clinic’s system returned a referral number, but the lab later finds no such referral. What in the creation path could cause this?", "An API that bills per voucher code sees repeat calls after timeouts. How can it recognize a repeat without merging two genuinely separate orders?"],
    answer: "Commit the record before returning its code, or a crash leaves a promise nothing can resolve. The caller sends one token per logical request, kept under a unique index, so a retry gets the first result. Matching on contents would merge separate orders. The cost is a column and token retention.",
  },
  "url/url-redirect": {
    prompts: ["A docs site has permanently renamed its pages, and nobody counts visits. Which redirect status fits, and what would make it the wrong choice?", "A sale’s redirect address must stop working at noon on Friday. What should later requests receive, and how long may earlier responses be cached?"],
    answer: "A 301 fits: it is cacheable by default, so browsers can skip your server. It is wrong if targets may change or visits matter; those suit a 302. After expiry return 410 Gone, never the old destination, and keep each max-age shorter than the remaining life.",
  },
  "url/url-keys": {
    prompts: ["A voucher program draws random five-digit codes and issues 30,000 a year for three years. What gets worse over time, and why?", "Choosing between a counter and random values for public event-ticket codes, what does each one cost you?"],
    answer: "Size the space from the lifetime total: 90,000 of 100,000 codes taken means about ten tries per new code by the end. A counter avoids collisions if its allocator is unique, but is guessable. Random values hide order but need a unique constraint and retries, because checking first races.",
  },
  "url/url-scale": {
    prompts: ["A restaurant-menu lookup serves 150 reads per second from an indexed table. A teammate wants to add a cache. How do you respond?", "A recipe site caches only its most popular pages, yet database load falls sharply. Why, and what must a cache miss still rely on?"],
    answer: "Popularity is skewed, so a small cached set can absorb most reads, while a miss still reads the durable database and fills the cache. A cache adds a component, a staleness window, and a failure mode, so under a few hundred reads a second an indexed query often copes alone.",
  },
  "url/url-operations": {
    prompts: ["During a database outage, a ticket-lookup service still answers from cache. What may it keep doing, and what may it no longer promise?", "An ad service bills per click. Why might it handle click events differently from a blog’s view counter, and what does that cost?"],
    answer: "Cached reads can continue for a limited time, but new records must not report success until they are durable. Reporting normally goes out asynchronously so it cannot block requests, accepting some lost events. Billing data may not tolerate that loss, which means a local durable buffer and extra latency.",
  },
};
