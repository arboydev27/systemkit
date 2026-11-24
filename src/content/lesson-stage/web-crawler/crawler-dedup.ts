import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Remove repeated work carefully": the Link filter normalizes the lesson's link HTTP://Example.com:80/a/../b#top
// to http://example.com/b before it is queued, and keeps the query on two example look-alikes, example.com/b?ref=feed
// (byte-identical to /b) and example.com/b?print=1 (the same article, different boilerplate). The URL-seen set lets the
// 3 new URLs into the URL frontier and drops a repeat of /b before any fetch; 8-byte fingerprints for 10 billion URLs
// take 80 GB. After the fetch, a matching SHA-256 finds ?ref=feed an exact copy (1 of 2 duplicates) and SimHash finds
// ?print=1 a near copy (2 of 3). Crawl history keeps all 3 URLs linked to 2 contents, and the example duplicate ratio,
// 2 of 3 for example.com, is what each site's rules are tuned by.
export const crawlerDedupStage: StageScene = {
  id: "crawler-dedup",
  intro: "Watch one link get normalized and checked before its fetch, then watch its content get compared after.",
  metrics: [
    { id: "queued", label: "Queued" },
    { id: "dropped", label: "Dropped" },
    { id: "dups", label: "Duplicates" },
  ],
  // Before-fetch checks on the left, after-fetch checks on the right: Parser → Link filter → URL-seen set → URL frontier
  // → Fetch worker → Crawl history. Each store stands behind and to the right of the part that feeds it, so notes over it
  // rise into free space, the Link filter → URL-seen set → URL frontier route forms a Λ (the repeat's × on one leg, the
  // new URLs' message on the other), and the Fetch worker → Crawl history link stays inside the stage with room on it
  // for a short message. Crawl history stands at [4.4, -1.8]. On a phone, lane -2 one row down is too wide for one
  // diagonal at a step's opening spacing, so the link ran as a Z until the spacing settled; lanes -1 to -1.5 one row
  // down leave the wide screen's hop so short that the hash message rests on Crawl history's tag. 1.4 rows down at
  // lane -1.8 gives one diagonal on a phone and a clear hop on a wide screen. Each store arrives in the step where its
  // check first acts, which also keeps the Link filter's notes clear of the URL-seen set's tag on a wide screen.
  // Notes on Crawl history stay short (26 characters at most): on a phone it stands at the left edge. Labels on the
  // short Parser → Link filter hop stay short too ("raw link"), so a resting message clears both parts.
  // Phone rows: Parser | Link filter | URL-seen set (left) | URL frontier | Fetch worker | Crawl history (left).
  // Steps 4–7 leave out `frame`: a wide screen frames every part, a phone frames the step's focus. On a phone step 7
  // frames the Link filter down to Crawl history, so it clears step 6's readout: one pill fewer keeps its tags at
  // 10 px on a 390 phone.
  nodes: [
    { id: "parser", role: "worker", label: "Parser", detail: "found a link", at: [0, 0] },
    { id: "filter", role: "gate", label: "Link filter", detail: "normalizes URLs", at: [1, 0], opts: { open: true } },
    { id: "seen", role: "bloom", label: "URL-seen set", detail: "8-byte fingerprints", at: [1.7, -1.5], appear: 2 },
    { id: "frontier", role: "frontier", label: "URL frontier", detail: "durable, by host", at: [2, 0], opts: { count: 2, items: 0 } },
    { id: "fetcher", role: "fetcher", label: "Fetch worker", detail: "leases a URL", at: [3, 0] },
    { id: "history", role: "database", label: "Crawl history", detail: "URL → content hash", at: [4.4, -1.8], appear: 3 },
  ],
  links: [
    { from: "parser", to: "filter" },
    { from: "filter", to: "seen" },
    { from: "seen", to: "frontier" },
    { from: "frontier", to: "fetcher" },
    { from: "fetcher", to: "history" },
  ],
  steps: [
    {
      title: "Normalize a link before it is queued",
      short: "Normalize URL",
      text: "The Parser resolves a link against its source page, and the Link filter normalizes it before queueing: scheme and host lowercased, default port 80 and the fragment #top removed (a fragment is never sent to the server), /a/../b resolved. HTTP://Example.com:80/a/../b#top becomes http://example.com/b.",
      focus: ["parser", "filter"],
      frame: ["parser", "filter", "frontier", "fetcher"],
      facts: [["Found", "HTTP://Example.com:80/a/../b#top"], ["Becomes", "http://example.com/b"]],
      metrics: { queued: 0, dropped: 0 },
      changes: ["~ Scheme and host lowercased", "− Port 80 and #top", "~ /a/../b resolves to /b"],
      events: [
        { type: "state", node: "parser", light: "on" },
        { type: "packet", path: ["parser", "filter"], label: "raw link" },
        { type: "state", node: "filter", light: "on" },
        { type: "note", node: "filter", text: "→ http://example.com/b", tone: "work", with: true },
      ],
    },
    {
      title: "Rewrite only what is safely equal",
      short: "Keep params",
      text: "Two more links reach the Link filter: example.com/b?ref=feed and example.com/b?print=1. It keeps their query parameters: like path case and parameter order, even a tracking-like parameter can change a resource. Redirects and canonical hints (a page’s preferred address) are signals; they don’t erase a URL’s history.",
      focus: ["parser", "filter"],
      frame: ["parser", "filter", "frontier", "fetcher"],
      changes: ["+ example.com/b?ref=feed", "+ example.com/b?print=1", "~ Query parameters kept"],
      events: [
        { type: "packet", path: ["parser", "filter"], label: "2 more links" },
        { type: "note", node: "filter", text: "?ref=feed · ?print=1 kept" },
      ],
    },
    {
      title: "The URL-seen set drops a repeat",
      short: "Seen set",
      text: "The URL-seen set records each normalized URL: all 3 are new and join the URL frontier. A later repeat of http://example.com/b is dropped before any fetch. At 8 bytes per URL, 10 billion URLs take 80 GB before index overhead: a real capacity item.",
      focus: ["parser", "filter", "seen", "frontier"],
      frame: ["parser", "filter", "seen", "frontier", "fetcher"],
      facts: [["Per URL", "8-byte fingerprint"], ["10 billion URLs", "80 GB"]],
      metrics: { queued: 3, dropped: 1 },
      changes: ["+ URL-seen set", "+ 3 new URLs queued", "− Repeat of /b dropped before fetching"],
      events: [
        { type: "packet", path: ["filter", "seen", "frontier"], label: "3 new URLs", kind: "work" },
        { type: "state", node: "seen", light: "work", opts: { level: 0.5 }, with: true },
        { type: "state", node: "frontier", light: "on", opts: { items: 3 } },
        { type: "packet", path: ["parser", "filter", "seen"], label: "http://example.com/b", lost: true },
        { type: "note", node: "seen", text: "seen: dropped" },
      ],
    },
    {
      title: "Same bytes, same hash: a duplicate",
      short: "Exact copy",
      text: "Content can only be compared after a fetch supplies the bytes. The Fetch worker fetches example.com/b, then example.com/b?ref=feed, and Crawl history stores each body’s SHA-256. The two hashes match: the same bytes reached through two URLs, a cheap duplicate signal.",
      focus: ["frontier", "fetcher", "history"],
      facts: [["Fetched", "/b, /b?ref=feed"], ["SHA-256", "match"]],
      metrics: { dups: { n: 1, unit: " of 2" } },
      changes: ["+ Crawl history", "+ 2 pages fetched, 2 SHA-256 hashes", "~ ?ref=feed is a copy of /b"],
      events: [
        { type: "state", nodes: ["parser", "filter", "seen"], light: "idle" },
        { type: "state", node: "frontier", opts: { mark: 0 }, with: true },
        { type: "packet", path: ["frontier", "fetcher"], label: "/b, then ?ref=feed" },
        { type: "state", node: "fetcher", light: "on" },
        { type: "state", node: "frontier", opts: { items: 1 }, with: true },
        { type: "packet", path: ["fetcher", "history"], label: "2 hashes", kind: "work" },
        { type: "state", node: "history", light: "work" },
        { type: "note", node: "history", text: "same SHA-256 as /b", tone: "work", with: true },
      ],
    },
    {
      title: "Near-copies need a similarity hash",
      short: "Near copy",
      text: "Next comes example.com/b?print=1: the same article, different boilerplate. Even one changed timestamp gives a completely different SHA-256, so the exact check misses it. SimHash, a fingerprint where similar documents get similar values (Google published work on it), lands near /b’s: a near-duplicate.",
      focus: ["frontier", "fetcher", "history"],
      facts: [["SHA-256", "different"], ["SimHash", "near /b’s"]],
      metrics: { dups: { n: 2, unit: " of 3" } },
      changes: ["+ ?print=1 fetched", "~ SHA-256 differs from /b", "+ SimHash: a near copy of /b"],
      events: [
        { type: "packet", path: ["frontier", "fetcher"], label: "/b?print=1" },
        { type: "state", node: "frontier", light: "idle", opts: { items: 0, mark: undefined }, with: true },
        { type: "packet", path: ["fetcher", "history"], label: "+ SimHash", kind: "work" },
        { type: "note", node: "history", text: "SimHash: near /b", tone: "work" },
      ],
    },
    {
      title: "Keep every URL, linked to its content",
      short: "Keep URLs",
      text: "Crawl history keeps all 3 URLs, each linked to its content: 3 URLs, 2 contents. Stored bytes can be shared, but no URL is discarded, because duplicate content may still have distinct links, provenance or future changes. A discarded URL would leave the recrawl schedule.",
      focus: ["fetcher", "history"],
      facts: [["/b and ?ref=feed", "one content"], ["?print=1", "near copy"]],
      changes: ["~ 3 URLs, 2 contents", "~ Each URL keeps its fetch history"],
      events: [
        { type: "state", node: "fetcher", light: "idle" },
        { type: "state", node: "history", readout: "3 URLs, 2 contents", with: true },
        { type: "note", node: "history", text: "every URL kept", tone: "work" },
      ],
    },
    {
      title: "Tune both checks site by site",
      short: "Tune per site",
      text: "Both checks can err. Merge too eagerly and you lose real pages; merge too timidly and you spend fetch budget on copies. Measure the duplicate ratio per site, here 2 of 3 example.com pages, and tune the rules site by site.",
      focus: ["filter", "history"],
      facts: [["example.com", "2 of 3 are copies"]],
      changes: ["~ Duplicate ratio measured per site", "~ Link filter: rules per site"],
      events: [
        { type: "state", node: "filter", detail: "rules per site", light: "on" },
        { type: "state", node: "history", readout: "", with: true },
        { type: "note", node: "history", text: "example.com: 2 of 3 copies", with: true },
      ],
    },
  ],
};
