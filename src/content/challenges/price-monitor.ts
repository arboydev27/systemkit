import type { DesignChallengeContent } from "../design-challenge";

export const priceMonitorChallenge: DesignChallengeContent = {
  id: "price-monitor",
  chapterId: "web-crawler",
  stepId: "crawler-scale",
  minutes: 35,
  adaptationTitle: "Flash-sale rechecks",
  title: "Design a retail price monitor",
  summary: "Apply the chapter's scheduling and politeness ideas to targeted rechecks, where each site's request budget decides what is possible.",
  brief: "A service tracks product prices across many online retailers, shows customers price history, and raises an event when a price changes. URLs come from customer watchlists and retailer sitemaps, so this is targeted rechecking rather than open link discovery. Some products need rechecks every 15 minutes and most need one a day. The crawler must respect robots.txt and each site's rate limits. Alert delivery, logging in to retailers, and purchasing are outside this exercise.",
  assumptions: [
    "Track 50 million product URLs across 20,000 retail sites. The 100 largest sites hold 60% of those URLs.",
    "1 million priority products are rechecked every 15 minutes, and the other 49 million once a day. Add 10% to fetches for retries. Use decimal units and 86,400 seconds per day.",
    "A product page averages 400 KB. 20% of fetches need a headless browser, at about 2 CPU-seconds per render. These are example figures to verify.",
    "Store a 100-byte price observation per planned recheck for a year (retries add none), and raw HTML for 7 days.",
    "The default budget is 1 request per second per site, lowered by robots.txt, 429, or 503 responses. An event for a priority product should fire within 20 minutes of a price change; treat this as a target to verify.",
  ],
  change: "Customers now want products in flash sales rechecked every minute for two hours. Assume 20,000 such products at a time, concentrated evenly on 5 retailers. Work out the per-site request rate this implies, decide what you would build, and say what you would tell the product team.",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and assumptions. Estimate fleet fetches per second with retries, bandwidth, rendering capacity, and storage. Then work out one site's daily budget and compare it with a large site's URL count.",
      placeholder: "I would support…\nFetches per second = …\nBandwidth = …\nRendering = …\nStorage = …\nOne site's budget per day = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores or does. Trace one priority product from becoming due, through robots and rate checks, to a stored price and a change event.",
      placeholder: "Scheduling state lives in…\nDue: …\nFetch: …\nParse and record: …",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Explain recovery from a crashed worker. Then handle a retailer redesign and a block page served with status 200, neither of which should create a false price. Say which site's budget is your bottleneck and how you would show it.",
      placeholder: "If a worker crashes…\nIf a retailer redesigns its pages…\nIf a block page returns 200…\nI would monitor…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the flash-sale change below. Show the per-site rate it implies, then say what you would build, what you would decline to build, and what you would tell the product team.",
      placeholder: "Per-site rate = …\nI would build…\nI would not…\nI would tell the product team…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I show units, separate fleet rate from per-site rate, and distinguish raw HTML from stored price observations." },
    { id: "budget", title: "Site limits shape the plan.", detail: "I say where robots rules and rate limits are enforced, what happens when robots.txt cannot be fetched, and where a large site cannot meet the stated recheck rate." },
    { id: "durable", title: "Recheck work survives a crash.", detail: "I explain due times and leases, and why repeating a fetch cannot create duplicate observations or events." },
    { id: "accuracy", title: "A bad parse cannot raise a false event.", detail: "I separate a real price change from a redesign, a block page, or a missing price, and I back off from a block rather than evading it." },
    { id: "change", title: "The flash-sale change is answered honestly.", detail: "I compute the per-site rate, stay within each site's limits, and offer an alternative such as a feed, a smaller set, or a stated achievable interval." },
  ],
  estimateGuide: "Priority: 1 million × 96 checks/day = 96 million. Others: 49 million. Total 145 million fetches/day ≈ 1,678/s, or about 1,846/s with 10% retries. Bandwidth: 1,846 × 400 KB ≈ 738 MB/s ≈ 5.9 Gbit/s. Rendering: 20% of 1,846 ≈ 369 renders/s, and × 2 CPU-seconds ≈ 738 busy CPU cores. Observations: 145 million × 100 bytes = 14.5 GB/day, about 5.3 TB/year. Raw HTML: 145 million × 400 KB = 58 TB/day, or 406 TB for 7 days, so keeping every raw page deserves a second look. The fleet average hides the real limit. One site at 1 request/s allows 86,400 fetches/day. The 100 largest sites hold 30 million URLs, averaging 300,000 each, so one pass takes about 3.5 days and a daily recheck does not fit at the default rate. The same budget allows at most 900 fetches per 15 minutes per site. The other 19,900 sites average about 1,005 URLs and fit easily. Flash sales: 20,000 ÷ 5 = 4,000 products per site, or about 67 requests/s per site against a budget of 1/s.",
  solutions: [
    {
      id: "fixed-tiers",
      title: "Fixed recheck tiers on a per-site scheduler",
      approach: "Keep one row per product URL with a tier and a next-due time, in a store partitioned by site. Scheduler shards each own a set of sites and hold each site's next-eligible time. A shared fetch pool leases due URLs, with a separate rendering pool for pages that need a browser. A parser per retailer template writes observations, and price-change events go to a durable log. URLs that cannot fit the budget fall behind and show a last-checked time.",
      paths: [
        "Schedule: the shard picks due URLs, priority first, for sites whose next-eligible time has passed and whose robots rules allow the path. It refreshes robots rules within 24 hours and pauses a site whose robots.txt returns 5xx. It leases each URL for 5 minutes and advances the site's next-eligible time.",
        "Fetch: the worker sends If-None-Match when it holds an ETag, with size and time caps. A 304 records an unchanged price and sets the next due time. Other responses go to the parser, or to the rendering pool when that template needs it.",
        "Record: the parser extracts price, currency, and availability. In one transaction, an observation keyed by URL and fetch ID and any change event in an outbox table are written together, and a relay publishes to the log.",
      ],
      failure: "A crashed worker's lease expires and the URL comes due again; the observation key makes a replay harmless. A retailer redesign shows up as falling extraction success for one template, so stop emitting changes for it, alert, and mark the last good price as stale. A block page served with 200 is classified as a block, not a price: back off, do not try to evade it. Refetch before emitting a large drop, such as more than 50%. Monitor due-queue age by tier and site, requests per site, extraction success, and robots denials.",
      adaptation: "A per-minute tier would need about 67 requests/s per site, and the scheduler's budget check will not schedule that. At 1 request/s a site allows 60 checks a minute, which is its entire budget for the two hours. Offer three honest options: ask the retailer for a feed or an agreed higher rate, check a small watched set of up to 60 products per site, or keep the 15-minute tier and show the last-checked time. Nothing bypasses the limiter.",
      tradeoff: "Tiers are easy to explain, price, and debug, and customers can be told what 15 minutes means. They spend budget evenly, so stable products cost as many requests as volatile ones. Conditional requests save bytes rather than requests, so large sites stay behind.",
    },
    {
      id: "adaptive-budget",
      title: "Budget-first adaptive rechecks",
      approach: "Treat each site's request budget as the fixed resource and spend it where a change is most likely to matter. Score each URL from its observed change rate, watcher count, and time since last check. Read sitemap lastmod values and retailer feeds where offered, trusting lastmod only on sites where it has proven accurate. Replace tiers with a durable per-site priority queue. A priority product keeps a maximum-age rule, so it stays near 15 minutes wherever the budget allows.",
      paths: [
        "Score: a periodic job ranks each site's URLs and writes enough of them to fill the budget until its next run. It includes a small random sample, so rarely checked products can still reveal changes.",
        "Fetch: the scheduler takes the next URL from a site's queue when robots rules and its next-eligible time allow. Sitemaps and feeds come first, since one request can reveal thousands of changed URLs.",
        "Record and learn: the parser writes an observation keyed by URL and fetch ID. Whether the price changed updates the URL's change-rate estimate, and any change goes through an outbox to the durable event log.",
      ],
      failure: "Queues and leases are durable, so a crash loses little. If scoring fails, a site keeps draining its previous queue and then falls back to oldest-first, which degrades the plan without stopping work. Beware a feedback trap: a rarely checked URL appears stable because few changes are observed, so keep the random sample and a maximum age for every URL. Parser safety rules match any design, and a broken template must not feed change-rate estimates. Monitor staleness percentiles per site, weighted by watchers, and the changes caught by the random sample.",
      adaptation: "A flash sale becomes a temporary score boost, capped by the site's budget. At 1 request/s, up to 60 of a site's 4,000 sale products get checked each minute, ordered by watcher count, so the most watched see close to a minute and the rest wait longer. Report the achieved interval to the product team rather than promising per-minute checks, and ask the five retailers for feeds if the sale matters enough.",
      tradeoff: "It finds more changes per request, which matters most on large sites, and it uses a fixed budget honestly. No single product gets a firm promise beyond its maximum age where budget allows, behavior is harder to explain and test, and new URLs need default scores until they build a history.",
    },
  ],
};
