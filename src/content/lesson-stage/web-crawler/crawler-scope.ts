import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Define the crawl": a crawler is a loop from a seed list through the URL frontier and a fetch worker to pages
// and their links (example.org/guide is an example page, the one the pipeline lesson traces). Its purpose decides what it keeps: documents and
// metadata for a search index, the fetched bytes for an archive (Common Crawl sits closer to the archive end). The
// budget, in the lesson's illustrative numbers: 600 million fetches a month ≈ 230 fetches/s over 30 days; at 150 KB a
// page that is about 35 MB/s (280 Mbit/s) and 90 TB of raw bytes a month; keeping every fetch for five years takes
// 5.4 PB (60 × 90 TB), which an index of parsed text avoids, and peak, retries, redirects and recrawls add to it. Last,
// for three partner sites a feed reader (sitemap, published API or data feed) replaces the whole crawler.
export const crawlerScopeStage: StageScene = {
  id: "crawler-scope",
  intro: "Watch a crawler turn seed URLs into pages and links, then count what 600 million fetches a month costs.",
  metrics: [
    { id: "fetches", label: "Fetches" },
    { id: "bw", label: "Bandwidth" },
    { id: "bytes", label: "Raw bytes" },
  ],
  // The loop runs along lane 0 (Seed list, URL frontier, Fetch worker); the Web host stands up the diagonal beside the
  // Fetch worker, and the two outputs share the last tier: the Search index almost straight up the floor's axis from
  // the Fetch worker (lane −0.8), the Page store in front (lane 1). The load readouts sit on the Web host, not the
  // Fetch worker: on a wide screen a pill to the Fetch worker's right would block its way up to the Search index and
  // tangle its links round its back. Phone rows: Seed list | URL frontier | Web host, Fetch worker | Search index,
  // Page store. In the last step the Feed reader takes the Fetch worker's place, and the Web host and Search index
  // line up with it: one short path, one column on a phone.
  nodes: [
    { id: "seeds", role: "doc", label: "Seed list", detail: "starting URLs", at: [0, 0] },
    { id: "frontier", role: "frontier", label: "URL frontier", detail: "durable, by host", at: [1, 0], opts: { count: 3, items: 0 } },
    { id: "fetcher", role: "fetcher", label: "Fetch worker", detail: "fetches, finds links", at: [2, 0] },
    { id: "host", role: "external", label: "Web host", detail: "public web", at: [2, -1.5] },
    { id: "index", role: "index", label: "Search index", detail: "parsed documents", at: [3, -0.8], appear: 1 },
    { id: "store", role: "storage", label: "Page store", detail: "archive: raw bytes", at: [3, 1], appear: 1 },
    { id: "reader", role: "worker", label: "Feed reader", detail: "sitemap, API, feed", at: [2, 0], appear: 5 },
  ],
  links: [
    { from: "seeds", to: "frontier" },
    { from: "frontier", to: "fetcher" },
    { from: "fetcher", to: "host" },
    { from: "fetcher", to: "index" },
    { from: "fetcher", to: "store" },
    { from: "reader", to: "host" },
    { from: "reader", to: "index" },
  ],
  steps: [
    {
      title: "Seeds start a loop of fetching and finding",
      short: "Discovery loop",
      text: "A crawler starts from a seed list of URLs. The URL frontier holds URLs waiting to be fetched. A fetch worker takes example.org/guide, downloads it from its web host, extracts its links and sends useful new ones back to the frontier.",
      changes: ["+ Seed URLs in the frontier", "+ example.org/guide fetched", "+ New links scheduled"],
      events: [
        { type: "packet", path: ["seeds", "frontier"], label: "seed URLs" },
        { type: "state", node: "frontier", light: "on", opts: { items: 2 } },
        { type: "packet", path: ["frontier", "fetcher"], label: "example.org/guide" },
        { type: "state", node: "fetcher", light: "on" },
        { type: "packet", path: ["fetcher", "host"], label: "GET /guide" },
        { type: "packet", path: ["host", "fetcher"], label: "200 · page", kind: "response" },
        { type: "packet", path: ["fetcher", "frontier"], label: "new links", kind: "work" },
        { type: "state", node: "frontier", light: "work", opts: { items: 3 } },
        { type: "note", node: "frontier", text: "new URLs wait here", tone: "work", with: true },
      ],
    },
    {
      title: "The purpose decides what the crawler keeps",
      short: "Index or archive",
      text: "For a search index, the output is parsed documents and metadata. An archive keeps the fetched bytes instead; Common Crawl, which publishes crawl snapshots, sits closer to the archive end. Decide the domains, content types, page count, retention and freshness first.",
      focus: ["fetcher", "index", "store"],
      frame: ["frontier", "fetcher", "host", "index", "store"],
      facts: [["In scope", "domains, content types"], ["Keep", "how many, how long"], ["Freshness", "how soon changes show"]],
      changes: ["+ Search index: documents", "+ Page store: fetched bytes", "~ Purpose sets what is kept", "− Seed list, now in the frontier"],
      events: [
        // The seeds live in the frontier now; with the Seed list gone a phone shows three rows, not four.
        { type: "hide", nodes: ["seeds"] },
        { type: "packet", path: ["fetcher", "index"], label: "parsed text + links", kind: "work" },
        { type: "packet", path: ["fetcher", "store"], label: "fetched bytes", kind: "work", with: true },
        { type: "state", nodes: ["index", "store"], light: "work" },
        { type: "note", node: "index", text: "documents + metadata", with: true },
        { type: "note", node: "store", text: "every byte", with: true },
      ],
    },
    {
      title: "600 million fetches a month: about 230/s",
      short: "Count fetches",
      text: "Capacity starts with attempts, not stored pages. As an illustration, 600 million fetches a month is roughly 230 fetches a second on average over 30 days. Each attempt costs a request, whether or not its page is kept.",
      focus: ["frontier", "fetcher", "host"],
      facts: [["Per month", "600 million"], ["Average", "≈ 230/s over 30 days"]],
      metrics: { fetches: { n: 230, unit: "/s" } },
      changes: ["+ 600 million fetches a month", "~ About 230 fetches/s"],
      events: [
        { type: "state", nodes: ["index", "store"], light: "idle" },
        { type: "stream", every: 240, routes: [{ path: ["frontier", "fetcher", "host"] }] },
        { type: "state", node: "fetcher", light: "on", with: true },
        { type: "state", node: "host", light: "on", readout: "230 fetches/s", with: true },
      ],
    },
    {
      title: "150 KB pages: 35 MB/s and 90 TB a month",
      short: "Bytes",
      text: "If pages average 150 KB, 230 fetches a second download about 35 MB a second, or about 280 Mbit/s. Over a month that is 90 TB of raw bytes, before anything is kept.",
      // The same camera as the last step on a phone: requests still go out, and each brings a page back.
      focus: ["frontier", "fetcher", "host"],
      facts: [["Average page", "150 KB"], ["Download", "≈ 35 MB/s"], ["A month", "90 TB raw"]],
      metrics: { bw: { n: 280, unit: " Mbit/s" }, bytes: { n: 90, unit: " TB/mo" } },
      changes: ["+ About 35 MB/s, 280 Mbit/s", "+ 90 TB of raw bytes a month"],
      events: [
        { type: "packet", path: ["host", "fetcher"], label: "150 KB page", kind: "response" },
        { type: "stream", every: 220, routes: [{ path: ["frontier", "fetcher", "host"] }, { path: ["host", "fetcher"], kind: "response" }] },
        { type: "state", node: "host", light: "work", readout: "35 MB/s", with: true },
      ],
    },
    {
      title: "Keeping every fetch 5 years takes 5.4 PB",
      short: "Retention",
      text: "Keeping every fetch for five years would take 5.4 PB, 60 months of 90 TB. A search index storing only parsed text avoids it. Peak load, retries, redirects and recrawls add fetches, so the real budget is higher.",
      focus: ["host", "fetcher", "index", "store"],
      frame: ["frontier", "fetcher", "host", "index", "store"],
      facts: [["Kept", "every fetch, 5 years"], ["Takes", "5.4 PB"], ["Adds more", "peak, retries, recrawls"]],
      metrics: { bytes: "5.4 PB" },
      changes: ["+ 5.4 PB to keep 5 years", "~ Parsed text avoids it", "~ Peak, retries, recrawls add more"],
      events: [
        { type: "stream", every: 260, routes: [{ path: ["fetcher", "store"], kind: "work" }] },
        { type: "state", node: "store", light: "on", readout: "5.4 PB kept", with: true },
        { type: "state", node: "index", light: "work", with: true },
        { type: "note", node: "index", text: "parsed text only", tone: "work", with: true },
        // The real budget asks more of the web than the average: the Web host's readout says so. It stays short: on a
        // phone the host is the leftmost part, and a pill wider than its tag would reach the stage's edge.
        { type: "state", node: "host", light: "on", readout: "more fetches", with: true },
      ],
    },
    {
      title: "For three partner sites, read their feeds",
      short: "Narrow job",
      text: "A general crawler must be polite and survive slow hosts, malformed responses, loops and changing rules, so it costs a lot to run for a narrow job. For data from three partner sites, a sitemap reader, a published API or a data feed is usually cheaper.",
      focus: ["host", "reader", "index"],
      frame: ["host", "reader", "index"],
      facts: [["Sources", "3 partner sites"], ["Read", "sitemap, API or feed"]],
      // The crawl's numbers don't describe three partner sites: clear them.
      metrics: { fetches: "—", bw: "—", bytes: "—" },
      changes: ["− URL frontier, fetch worker", "− Page store", "+ Feed reader", "~ 3 partner sites"],
      events: [
        { type: "hide", nodes: ["frontier", "fetcher", "store"] },
        { type: "state", node: "index", light: "idle", with: true },
        { type: "state", node: "host", light: "idle", readout: "", detail: "3 partner sites", with: true },
        { type: "show", nodes: ["reader"], at: { host: [1, 0], index: [3, 0] } },
        { type: "packet", path: ["host", "reader"], label: "sitemap + feed", kind: "response" },
        { type: "state", node: "reader", light: "on" },
        { type: "packet", path: ["reader", "index"], label: "documents", kind: "work" },
        { type: "state", node: "index", light: "work" },
        { type: "note", node: "reader", text: "cheaper than crawling", tone: "work", with: true },
      ],
    },
  ],
};
