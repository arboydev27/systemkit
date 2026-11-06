import type { DesignChallengeContent } from "../design-challenge";

export const podcastPlatformChallenge: DesignChallengeContent = {
  id: "podcast-platform",
  chapterId: "youtube",
  stepId: "youtube-operations",
  minutes: 30,
  adaptationTitle: "Per-listener ads",
  title: "Design a podcast publishing and listening platform",
  summary: "Apply the video pipeline to audio, where files are small, position saves far outnumber plays, and the biggest spike arrives on a published schedule.",
  brief: "Creators upload episodes to a show and schedule their release. Listeners stream or download episodes in your app, and other podcast apps read a public RSS feed (an XML list of episodes with links to audio files). A listener who stops on one device should be able to resume on another. A popular show releases new episodes at an announced time, and that must not degrade the service. Keep recommendations, search, comments, and transcripts outside this exercise.",
  assumptions: [
    "2 million daily listeners play 2 episodes a day, for 40 minutes each on average, at 128 kbit/s. Use decimal units and 86,400 seconds per day.",
    "Peak traffic is 3 times the daily average. Playing clients save their listening position every 30 seconds.",
    "Creators publish 20,000 episodes a day. Each source averages 100 MB, and encoded outputs add 60 MB per episode. Estimate one year of storage, before replicas.",
    "A popular show releases an episode at an announced time, and 500,000 listeners start it within 15 minutes, on top of normal traffic.",
    "An episode must not appear in feeds until its audio is playable. Position may lag by up to a minute across devices, and listening done offline must sync later without overwriting newer progress.",
  ],
  change: "Advertisers now want different ads for different listeners, inserted into episodes at play time, while each episode's content stays the same for everyone. What happens to your caching, offline downloads, RSS-delivered files, and saved positions?",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and assumptions. Estimate play rate, delivery bandwidth, concurrent listeners, position-save rate, one year of storage, and the added load from the launch. Keep units visible.",
      placeholder: "Plays per second = …\nDelivery = … Gbit/s\nConcurrent listeners = …\nPosition saves per second = …\nLaunch adds = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores. Trace one publish, one play with resume on a second device, and one fetch by a third-party app reading your feed. An arrow list is enough.",
      placeholder: "Publish: creator → …\nPlay and resume: app → …\nFeed: third-party app → …",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Choose a likely bottleneck and the evidence for it. Explain how you prepare for the scheduled launch, and what listeners experience if the position store is unavailable during it.",
      placeholder: "Before the launch I would…\nI would monitor…\nIf the position store fails…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the per-listener ads change below. Explain what can still be cached, how offline and RSS downloads are handled, and how saved positions stay correct.",
      placeholder: "Still cacheable: …\nDownloads and RSS get…\nPositions are saved as…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates find the surprising load.", detail: "I show units, separate average, peak, and launch, and notice that position saves far outnumber plays." },
    { id: "audio", title: "The design fits audio rather than copying video.", detail: "I justify my encoded outputs and delivery format for small audio files and third-party apps, and add no video-sized machinery without a reason." },
    { id: "publish", title: "Publication is a verified step.", detail: "An episode reaches feeds only after its audio is verified, so a scheduled release cannot expose a missing file." },
    { id: "launch", title: "The launch is prepared.", detail: "I use the announced time to warm caches ahead of release, and I protect origin and position storage from the surge." },
    { id: "position", title: "Resume survives conflict and failure.", detail: "I define how offline and multi-device updates merge, and playback continues even when position saves fail." },
  ],
  estimateGuide: "Plays: 2 million × 2 = 4 million/day ≈ 46/s average and 139/s at peak. Each play is 128 kbit/s × 2,400 s = 307,200 kbit = 38.4 MB. Delivery: 4 million × 38.4 MB = 153.6 TB/day ≈ 14 Gbit/s average and 43 Gbit/s at peak. Concurrent listeners: 4 million × 2,400 s ÷ 86,400 s ≈ 111,000 average and 333,000 at peak. Position saves: 111,000 ÷ 30 ≈ 3,700/s average and 11,100/s at peak, about 80 saves for every play. Storage: 20,000 × 160 MB = 3.2 TB/day ≈ 1.17 PB in a year. Launch: 500,000 starts ÷ 900 s ≈ 556 starts/s. Once all are playing, that adds 64 Gbit/s of delivery and about 16,700 position saves/s. If it lands on the normal peak, the totals are about 107 Gbit/s and 27,800 saves/s. Apps that download the file run faster than real time, so early delivery could be higher still.",
  solutions: [
    {
      id: "cdn-files",
      title: "Plain audio files on a CDN, with a dedicated position store",
      approach: "Encode each episode into widely supported constant-bitrate files, such as a 128 kbit/s MP3 and a lower-bitrate AAC, and serve them through a CDN with HTTP range requests (asking for part of a file by byte offset). Keep shows and episodes in a relational database. Keep positions in a key-value store such as DynamoDB or Cassandra, keyed by listener and episode. The app and RSS readers use the same files.",
      paths: [
        "Publish: the creator uploads through a scoped URL to object storage. A queued job checks the source, normalizes loudness, encodes outputs, and verifies them. The episode then moves to scheduled with its release time. At release, a job marks it published and regenerates the feed, so a missing file cannot appear.",
        "Play and resume: the app reads metadata and the last position from the API, then requests bytes from the CDN at the offset for that time, which is simple at a constant bitrate. While playing, it saves the position every 30 seconds along with the time that listening happened. A second device reads the latest value and starts there.",
        "Feed: a third-party app polls the feed URL. The CDN holds the feed for a few minutes, and conditional requests using ETag let an unchanged feed answer 304 with no body. Its links point at the same CDN-hosted audio.",
      ],
      failure: "Because the launch time is known, warm the CDN by requesting the files through the main regions beforehand, and release the feed only after checking they are in place. If the position store fails, playback continues; the app keeps its position locally and retries with jittered backoff. Merge updates by listening time, so a late offline sync cannot overwrite newer progress, and accept that clock skew may misjudge very close updates. Monitor CDN hit rate, origin bytes, time to first audio, save errors, and job age.",
      adaptation: "Whole-file caching ends once each listener needs a different file. Cut episodes at ad breaks into cached content pieces and ad pieces, encoded with identical settings so they can be joined. A stitching tier assembles a per-listener response and handles range requests across the joins. Downloads and RSS fetches get one stitched file chosen at download time, so those ads cannot change later. Save positions in content time rather than file time or byte offset, because ad lengths vary between sessions.",
      tradeoff: "Plain files work with every podcast app, cache whole, and need little compute. The cost is no adaptive bitrate on weak networks, bytes wasted when automatic downloads go unheard, and a new stitching tier if per-listener ads arrive.",
    },
    {
      id: "hls-plus-files",
      title: "Segmented audio for your app, plain files for RSS",
      approach: "Package audio as HLS in short segments at two bitrates for your own app, which gains adaptive quality and per-segment delivery data, and keep a plain MP3 for RSS readers and downloads. Position saves go first to Redis, which holds the latest value per listener and episode, and are appended to a compacted Kafka topic (one that keeps the latest record per key) that is copied to durable storage about once a minute.",
      paths: [
        "Publish: the upload and verification path matches the other design, with one more output: HLS segments and manifests. At 6 seconds per segment, a 40-minute episode has 400 segments per bitrate. The episode is published only once manifests, segments, and the MP3 are all verified.",
        "Play and resume: the app gets the manifest from the CDN, reads the position from the API, and starts at the segment containing that time. Every 30 seconds it sends its position; API servers batch those writes before applying them to Redis and Kafka. Another device reads Redis and falls back to the durable copy on a miss.",
        "Feed: third-party apps fetch the cached feed with conditional requests, then download the MP3 through the CDN, using range requests to seek.",
      ],
      failure: "Warm the first few minutes of segments for the launch in the main regions. Later segments fill as the first listeners reach them, which spreads origin load across the episode rather than concentrating it at the start. If Redis loses data, the durable copy is about a minute behind, close to the stated lag, and Kafka consumer lag shows how stale it is. If the whole position path fails, the app keeps positions locally and playback continues. Monitor rebuffering, segment hit rate, Kafka lag, and Redis memory.",
      adaptation: "A per-listener manifest can point at shared content segments and separate ad segments, so content stays cacheable and only the manifest is personal. The manifest service becomes a new request path needing its own capacity, about 556 requests per second during the launch. Downloads and RSS still need a stitched file, so this solves only the app half. Save positions in content time here too, because ad lengths vary between sessions.",
      tradeoff: "Segments handle weak mobile networks better and make in-app ads simpler. The cost is two packaging paths, many more objects and CDN requests, and a position pipeline with more moving parts than one store, justified only if adaptive playback or the write rate demands it.",
    },
  ],
};
