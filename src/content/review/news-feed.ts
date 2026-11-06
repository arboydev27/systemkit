import type { ReviewVariation } from "../../lib/review";

export const newsFeedReview: Record<string, ReviewVariation> = {
  "news-feed/feed-scope": {
    prompts: ["A running app adds a home screen of workouts from people you follow. What should you settle before sizing how updates reach readers?", "A recipe site confirms a cook’s new recipe, yet a follower sees nothing for a minute. How would you decide whether that is a bug?"],
    answer: "Settle who may see what, the freshness target, busiest posting and refresh load, how many people actively read, and how skewed follower counts are. Durable acceptance, feed eligibility, and rendering are separate steps; confirmation promises only the first, so the delay is a bug only if it misses the stated target.",
  },
  "news-feed/feed-publish": {
    prompts: ["A podcast host publishes an episode for 50,000 subscribers’ personal lists. Should the publish request wait for those lists to update? Why?", "A classifieds site sends a ‘new listing’ event to its queue, then commits the listing. What can go wrong, and would swapping the order fix it?"],
    answer: "Commit one canonical record and return; writing every list inline ties response time to audience size. An event sent first can announce something that never commits, and committing first can lose the event, so use a transactional outbox. Workers dedupe on item and recipient, so repeats do no harm.",
  },
  "news-feed/feed-media": {
    prompts: ["A real estate app keeps 30 photos inside each listing’s database row, and its results page has become slow. Why, and what would you change?", "A clinic portal wants to serve patients’ scans through a CDN for speed. What access approach fits, and what risk remains?"],
    answer: "Bytes in rows travel through every page query, so keep them in object storage and leave metadata, ownership, and object keys in the row. Private files need short-lived signed links issued after a permission check; the cost is re-signing links for each page, and a leaked one stays usable until expiry.",
  },
  "news-feed/feed-fanout": {
    prompts: ["A developer platform shows users activity from projects they watch. Most projects have a dozen watchers; a few have millions. How would you deliver updates?", "A knitting community’s largest account has 3,000 followers. Someone proposes mixing inbox writes with merging at read time. What would you tell them?"],
    answer: "Writing to inboxes makes reads cheap but wastes work on idle followers; pulling at read time does the reverse. So push ordinary accounts and merge huge ones at read time, setting the threshold from measured activity. A hybrid means two read paths, so without extreme accounts, push alone is enough.",
  },
  "news-feed/feed-read": {
    prompts: ["An events app caches a list of event IDs for each member. What must happen to those IDs before a page goes back?", "Support agents scrolling newest-first tickets sometimes see a ticket repeat on the next page. What is the likely cause, and what would you change?"],
    answer: "Cached IDs are only candidates: merge sources, drop duplicates, bound the window, check current rules, then hydrate in a batch. With offsets, new arrivals push older items onto the next page, so they repeat. A cursor of server time plus unique ID anchors the position but gives up page jumps.",
  },
  "news-feed/feed-ranking": {
    prompts: ["A jobs site re-scores listings every few minutes while members scroll. What might a member notice, and what design prevents it?", "An engineer proposes scoring a marketplace’s whole catalog for each shopper, then removing items that shopper may not see. What is wrong with that order?"],
    answer: "Gather and authorize candidates first, then score a bounded set: scoring uses latency budget, and a high score never grants access. Recomputed scores shift page boundaries, so items repeat or go unseen. Pin a session, snapshot candidates, or carry a continuation token; snapshots cost memory per open session.",
  },
  "news-feed/feed-privacy": {
    prompts: ["A team wiki’s activity feed caches page IDs per employee. Someone is removed from a project. Is a nightly cleanup of those lists enough? Explain.", "A classroom app lets new assignments reach students within a minute. Should withdrawing one follow the same target? What could bring it back?"],
    answer: "Stored entries are disposable pointers, so each read checks current rules against canonical state; cleanup only reduces later work. New items can appear eventually, but removals may need much faster suppression, and tombstones stop a delayed worker restoring them. Every page then pays for a batched permission lookup.",
  },
  "news-feed/feed-operations": {
    prompts: ["You run a photography app where people follow each other. Without waiting for complaints, how would you measure how late uploads reach followers?", "On a language-learning app, ordinary tutors’ posts stall for minutes right after one famous tutor publishes. What is happening, and what would you change?"],
    answer: "Measure commit-to-visible delay, using a test account that posts steadily and a test follower, plus the age of the oldest delivery job. One large publisher can flood a shared partition so other authors wait behind it; split the work across partitions, cap concurrency, and watch hot authors.",
  },
};
