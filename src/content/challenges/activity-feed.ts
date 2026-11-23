import type { DesignChallengeContent } from "../design-challenge";

export const activityFeedChallenge: DesignChallengeContent = {
  id: "activity-feed",
  chapterId: "news-feed",
  stepId: "feed-operations",
  minutes: 35,
  adaptationTitle: "A retroactive private switch",
  title: "Design a workout activity feed for a fitness app",
  summary: "Apply the news feed chapter to workouts, where a few athletes have huge followings, uploads arrive late, and a route map can reveal where someone lives.",
  brief: "Athletes record a run or ride, and the app uploads it when it next has a connection, sometimes hours later. Followers see a card with a route map, distance, and pace in a home feed. A few popular athletes have about a million followers. Each activity is visible to everyone, followers only, or only the athlete, and that setting can change later. Keep comments, segments, leaderboards, and ranking outside this exercise.",
  assumptions: [
    "20 million registered users, 5 million active each day. Active users open the feed 4 times a day and load 2 pages per open. Peak traffic is 3 times the daily average. Use decimal units and 86,400 seconds per day.",
    "1 million activities a day come from ordinary athletes, who average 150 followers. Separately, 100 popular athletes average 1 million followers and post twice a day.",
    "Followers of popular athletes are as active as anyone else, so about 25% open the app on a given day. The inbox store is sized for 10,000 writes per second.",
    "Each activity stores a 72 KB GPS track and 200 KB of rendered map images. An inbox keeps at most 500 entries of 16 bytes each.",
    "95% of activities should reach followers’ feeds within 60 seconds of upload. Setting an activity to “only me” must stop new reads, including its map image, within 60 seconds.",
  ],
  change: "A safety review asks for a private-account switch. When an athlete turns it on, all of their past activities, perhaps 3,000 of them, must disappear from everyone but approved followers within 60 seconds, including map images. The review also wants the first and last 500 meters of every route hidden from anyone but the athlete. What changes?",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope. Estimate feed page reads, ordinary fanout writes, what pushing popular athletes’ posts would cost, how long one popular post takes to push, inbox storage, and 30 days of activity storage. Keep units visible.",
      placeholder: "Pages per second at peak = …\nOrdinary inbox writes per second = …\nOne popular post takes…\nInbox storage = …\nActivity storage for 30 days = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores. Trace one late upload from the phone to a follower’s feed, and one feed page that includes a popular athlete. State which timestamp orders the feed and what the cursor contains.",
      placeholder: "Upload: phone → …\nFanout: …\nRead: …\nThe feed is ordered by…; the cursor holds…",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Pick a likely bottleneck and the signal that would reveal it. Explain what a follower sees if fanout falls behind or the inbox store fails, and how a stale inbox entry is kept from returning a private activity.",
      placeholder: "The first bottleneck is…\nI would watch…\nIf the inbox store fails…\nA stale entry is stopped by…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the safety review below. Explain how the switch takes effect in 60 seconds without rewriting every inbox, how map images and old links comply, and one cost of your approach.",
      placeholder: "The read path learns of the switch by…\nMap images comply because…\nHidden route ends are produced by…\nThe cost is…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I compare pushing popular posts with the store’s write capacity and the 60-second target, and I separate inbox storage from activity storage." },
    { id: "skew", title: "Popular athletes have a deliberate path.", detail: "I explain how their activities reach readers, what decides who takes that path, and how duplicates are removed when the path changes." },
    { id: "privacy", title: "Privacy holds at the read boundary.", detail: "I show that a stale inbox or cache entry cannot return a private activity, and that this covers its map image as well as its card." },
    { id: "order", title: "Feed order survives late uploads.", detail: "I state which timestamp orders the feed and explain what happens to a cursor when a workout arrives hours after it finished." },
    { id: "retroactive", title: "The retroactive change has a bound.", detail: "I explain how the account-wide switch meets its deadline without rewriting each inbox, and I name what it costs on reads or delivery." },
  ],
  estimateGuide: "Reads: 5 million × 4 opens × 2 pages = 40 million pages a day, about 463 per second on average and 1,389 at peak. Ordinary fanout: 1 million × 150 = 150 million inbox writes a day, about 1,736 per second on average and 5,208 at peak. Popular athletes: 100 × 1 million × 2 = 200 million inbox writes a day if pushed, about 1.3 times all ordinary fanout, and 75% of them (150 million) go to people who do not open the app that day. One popular post is 1 million writes: 100 seconds even with the store’s whole 10,000 per second, and about 209 seconds at ordinary peak, when 4,792 per second are spare. Both miss the 60-second target. Follows: 100 million popular-athlete follows ÷ 20 million users = 5 per user on average, so pulling them adds about 5 lookups per page. Inboxes: 500 × 16 bytes = 8 KB per user, so 160 GB for all 20 million users or 40 GB for the 5 million active each day. Activities: 72 KB + 200 KB = 272 KB × 1 million = 272 GB a day, or 8.16 TB in 30 days, before replicas.",
  solutions: [
    {
      id: "author-threshold",
      title: "Hybrid fanout by author size",
      approach: "Push ordinary athletes’ activities to follower inboxes and leave the 100 popular athletes in their own recent-activity indexes, merged at read time. The feed is ordered by the server’s publish time rather than the workout’s start time, so a late upload appears at the top and existing cursors stay valid. The card still shows when the workout happened. Every page checks current visibility before returning anything.",
      paths: [
        "Upload: the phone stores the GPS file in object storage through a scoped upload URL, then creates the activity with an idempotency key from its recording ID, so a retry over a bad connection does not create a twin. Workers compute distance and pace and render maps, then mark the activity ready and add an outbox row in one transaction.",
        "Fanout: a relay moves the outbox row to a queue. Workers write publish time and activity ID to each follower’s inbox, keyed by activity and reader. Activities from popular athletes skip this and go only to their recent-activity index.",
        "Read: the feed service reads a page from the inbox, merges recent activities from followed popular athletes, removes duplicates, and batch-checks visibility and follows. It then hydrates cards and returns short-lived signed URLs for map images. The cursor holds publish time and activity ID.",
      ],
      failure: "If fanout falls behind, the canonical activity is safe and followers see it late; queue age and upload-to-visible delay reveal this, while page latency will not. If the inbox store fails, build a bounded first page from recent-activity indexes for the reader’s most recently active follows, capped so the fallback cannot overload storage. If the visibility check is unavailable, fail closed and show a retry message rather than unchecked cards. Popular-athlete indexes are few, about 100, so they cache well even at 5 lookups per page. A move across the threshold needs a transition period with deduplication by activity ID.",
      adaptation: "Add an account-level privacy version to the read check, so one setting covers all 3,000 activities with no inbox rewrite. Cache it for at most 15 seconds, and sign map URLs for at most 45 seconds, which together stay inside the 60-second limit. Clients refresh links more often as a result. For hidden route ends, render trimmed map variants and keep the full track readable only by its owner. A background job re-renders old activities; a card shows no map until its trimmed variant exists, and the old variants are deleted and purged from the CDN. Stale inbox entries get cleaned up later and are harmless meanwhile.",
      tradeoff: "Ordinary reads stay fast, and the worst fanout bursts disappear. The team must maintain two read paths, tune a threshold, and accept a merge on every page for readers who follow popular athletes.",
    },
    {
      id: "active-readers",
      title: "Push to active readers, rebuild for returning ones",
      approach: "Choose the path by reader instead of author. Every athlete’s activity is pushed, including popular ones, but only to followers in an active set of people who opened the app recently. Everyone else has no inbox. When someone returns, the service rebuilds their inbox from the recent-activity indexes of the athletes they follow. There is no author threshold to tune, and storage follows actual use.",
      paths: [
        "Upload: as in any design here, the file goes to object storage, the activity is created with an idempotency key, maps render, and the ready state and an outbox row commit together.",
        "Fanout: workers read the athlete’s followers, keep those in the active set, and write inbox entries. If the active set is about the 25% who open the app daily, a popular post means 250,000 writes. Ordinary peak fanout also shrinks, to about 1,302 per second, leaving 8,698 spare, so the post takes about 29 seconds, inside the 60-second target.",
        "Read: an active reader gets a page from their inbox, with visibility checked as usual. A returning reader triggers a rebuild that queries the recent-activity index of each followed athlete, about 150 on average, keeps the newest 500, and fills the inbox.",
      ],
      failure: "Daily inbox writes fall from 350 million to about 87.5 million, and inbox storage is closer to 40 GB than 160 GB. The risk moves to rebuilds. After a holiday or a marketing push, many returning readers can each trigger about 150 index queries, so cap rebuild concurrency, show a smaller first page when the cap is reached, and finish in the background. Watch rebuild queue age and first-page latency for returning readers separately from everyone else. Someone leaving the active set needs their inbox dropped safely; someone joining it mid-fanout may miss one entry until their next rebuild, so reconcile on open.",
      adaptation: "Because inboxes are small and often rebuilt, the same account-level privacy version on the read path covers the switch: the check runs on every page, and rebuilds read it as well, so a private account’s activities do not re-enter inboxes for unapproved followers. Map delivery is handled the same way, with signed URLs short enough to fit inside 60 seconds alongside the settings cache. Trimmed route variants are produced by a background job. The extra step here is purging the private athlete’s activities from any cached rebuild results.",
      tradeoff: "It needs far fewer writes and less storage, and treats popular athletes like anyone else. In exchange, a few popular athletes posting at once can still use up the freshness margin, returning readers wait for a rebuild, the active set is another piece of state to keep correct, and a marketing campaign that wakes inactive users can create a read spike.",
    },
  ],
};
