import type { ReviewVariation } from "../../lib/review";

export const webCrawlerReview: Record<string, ReviewVariation> = {
  "web-crawler/crawler-scope": {
    prompts: ["A price-comparison startup needs daily data from four partner retailers and asks you to build a crawler. How would you respond?", "A legal archive and a job-search index crawl the same sites. Why would they end up storing and emitting different things?"],
    answer: "The objective decides what to fetch, keep, and hand on: an archive retains fetched versions, while a search index keeps parsed documents and links. Crawlers are costly because they must be polite and robust, so for a few partners, an API, data feed, or sitemap is usually cheaper.",
  },
  "web-crawler/crawler-pipeline": {
    prompts: ["A catalog crawler marks each URL complete right after fetching, before saving the document or links. What can go wrong?", "A recipe-site crawler retries URLs whose lease expired, and some pages appear twice in its index. Why does this happen, and what fixes it?"],
    answer: "Complete a lease only after the document and accepted links are saved; otherwise a crash silently loses the page. An expired lease makes the URL eligible again, so a page can be processed twice. Idempotent keys or deduplication on writes make that at-least-once repeat harmless.",
  },
  "web-crawler/crawler-policy": {
    prompts: ["A records site has 86,400 pages, and politeness allows one request every 10 seconds. How long is one pass, and what does this trade?", "A hosting company runs thousands of small shops on one server. Your crawler limits each hostname, yet the server still struggles. Why?"],
    answer: "One request every 10 seconds is 8,640 fetches a day, so one pass takes 10 days: politeness costs coverage. Per-hostname limits can still add up on a shared server, so group hosts by what shares capacity and schedule only eligible work.",
  },
  "web-crawler/crawler-frontier": {
    prompts: ["A news-monitoring crawler uses one FIFO queue, and breaking stories wait hours behind one forum’s huge archive. What would you change?", "A crawler keeps its frontier only in memory for speed, and a crash loses weeks of waiting URLs. What should it store durably?"],
    answer: "Split the decision: priority picks which URLs matter, per-host queues decide when each may run, and a selector takes a valuable eligible URL with enough fairness. Persist queued and leased state, why each URL waits, its run time, retries, and next recrawl, keeping only small buffers in memory.",
  },
  "web-crawler/crawler-dedup": {
    prompts: ["To save fetches, a crawler lowercases entire URLs and sorts query parameters. What can this break, and how would you tune it?", "Forum pages differ only in a visitor counter in the footer, and content hashing finds no duplicates. Why, and what would catch them?"],
    answer: "Normalize only safe equivalents, since path case and parameter order can change a resource; merging too eagerly loses real pages, so measure the duplicate ratio and tune rules per site. A strong hash changes completely with one differing byte, so boilerplate-only differences need a near-duplicate fingerprint such as SimHash.",
  },
  "web-crawler/crawler-fetch": {
    prompts: ["A chat app’s server fetches pasted links to build previews. How could an attacker abuse that, and what checks would stop it?", "A job-listings crawler finds some pages are empty without JavaScript. Would you render everything in a headless browser, and why?"],
    answer: "An attacker can use redirects or DNS answers to reach internal addresses, which is SSRF. Validate the address actually connected to, on every redirect and resolution. A headless browser costs far more CPU and memory than parsing, so send only the pages that need it down that separate path.",
  },
  "web-crawler/crawler-freshness": {
    prompts: ["A crawler revisits a stock-news site and a museum archive once a week each. How would you schedule them instead, and what limits that?", "To stop endless URLs, a team caps path depth everywhere. Then a deep documentation site loses pages. What went wrong, and what works better?"],
    answer: "Recrawl by change history and importance, moving fast-changing pages sooner and stable ones later, within a budget, since recrawls take capacity from new pages. Endless generated URLs are a spider trap: cap parameter variation, depth, and per-site discovery. Universal detection also suppresses real pages, so add review or site-specific rules.",
  },
  "web-crawler/crawler-scale": {
    prompts: ["After scheduler shards rebalance, a library’s site gets two requests inside one delay window. What went wrong, and what handover order prevents it?", "A small academic crawler runs one scheduler with CPU and memory to spare. A colleague proposes scheduler shards now. How do you respond?"],
    answer: "One scheduler is enough until it truly lacks memory or CPU, since shards bring new failure modes. Once sharded, each host has one owner. The outgoing owner stops and records when the host may next run before the new owner begins; otherwise two requests can land in one delay window.",
  },
};
