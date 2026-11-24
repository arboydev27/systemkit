import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Revisit without looping": Crawl history keeps each page's visits in order, one strip per page, numbered by
// visit ("diff" when the content hash changed, "same" when it didn't). The strips start at visit 21, so no first visit
// (with no earlier hash to differ from) is shown as "diff". example.org/news comes back with a new hash (visit 24, its
// fourth change in a row); example.org/about is asked with If-None-Match and answers 304 Not Modified, so no body is
// resent and it stays scheduled (visit 25, its fifth unchanged visit). With the lesson's example rule, the Recrawl
// planner reads those sequences: changed on its last four daily visits moves /news to every 12 hours, unchanged for five
// moves /about to every 2 days, up to a cap. The budget: recrawling 10 million pages a day takes about 116 fetches/s,
// nearly a third of a 386-per-second crawl (10,000,000 ÷ 86,400 = 115.7; 116 ÷ 386 = 30%), drawn as 3 recrawls in every
// 10 fetches. A 503 with Retry-After: 120 is retried in 2 minutes, at most 3 times (both example values). Last, the
// lesson's scenario: a calendar on example.org links each date to the next (/cal/2031-04-18, /cal/2031-04-19, …), and
// after two dates the Link filter's per-site cap on /cal/* stops the rest.
// Record words stay four letters ("diff", "same") so a phone's strip shows four tiles and a wide one all five.
// Reduced motion rests every message on the stage, and a wide stage's short hops hold one labelled message each. So a
// reply rides on to the part that acts on it (Crawl history, the frontier) and rests on that cable, leaving the
// worker → host hop to the request; the planner's message to the frontier and the trap's passing dates carry no label
// (the chips, the note and the text say what they carry); the 503's header shows on the host's tag, so its message is
// short; and the held date stops short of the filter with an ×.
export const crawlerFreshnessStage: StageScene = {
  id: "crawler-freshness",
  intro: "Watch two pages’ visit histories set how soon each comes back, then see what retries and a calendar trap cost.",
  // Short labels: the three chips must fit a 375-wide phone.
  metrics: [
    { id: "news", label: "/news" },
    { id: "about", label: "/about" },
    { id: "recrawl", label: "Recrawl load" },
  ],
  // Two lines of three on a wide stage, two columns of three rows on a phone, so the phone stays narrow and its tags
  // keep 10 px. Up the diagonal: Link filter, Fetch worker, Web host; down it: URL frontier, Recrawl planner, Crawl
  // history, with the history's two strips lying below it on every screen (beside it, they squeezed the parts on a wide
  // stage). The frontier and the worker stand 1.6 lanes apart, so the phone's cable between them runs straight; the
  // planner and the history sit lower, at lane 1, so the worker → history cable and the messages resting on the lower
  // line's cables keep clear of the upper line's tags; the filter sits higher, at lane −1, so the trap's dates rest
  // clear of the Fetch worker's tag. The recrawl loop (worker → history → planner → frontier → worker) closes without a
  // cable crossing a part. Notes sit on the upper line (Web host, Link filter), where they float into open floor; the
  // lower line speaks with readouts beside its parts, which a note over it would put on the upper line's tags. Every
  // step carries a note or a readout, never both: one keeps the phone's rows far enough apart for the frontier's cable
  // to the worker to run straight, and both spread them so far that the phone zooms out. Spreading the tiers would give
  // a wide stage's messages longer hops, but a phone spaces its rows by tier, and at 375 × 667 the rows already fill
  // the height.
  // Phone rows: Link filter, URL frontier | Fetch worker, Recrawl planner | Web host, Crawl history (strips under it).
  nodes: [
    { id: "frontier", role: "frontier", label: "URL frontier", detail: "due recrawls", at: [0, 0.8], opts: { count: 2, items: 2 } },
    { id: "planner", role: "scheduler", label: "Recrawl planner", detail: "next visit times", at: [1.15, 1], opts: { items: 2 } },
    { id: "fetcher", role: "fetcher", label: "Fetch worker", detail: "leases a URL", at: [1.15, -0.8] },
    { id: "filter", role: "gate", label: "Link filter", detail: "trap caps", at: [0, -1], appear: 5, opts: { open: true } },
    { id: "host", role: "external", label: "Web host", detail: "example.org", at: [2.15, -0.8] },
    { id: "history", role: "database", label: "Crawl history", detail: "fetches, validators", at: [2.15, 1] },
  ],
  links: [
    { from: "frontier", to: "fetcher" },
    { from: "fetcher", to: "host" },
    { from: "fetcher", to: "history" },
    { from: "history", to: "planner" },
    { from: "planner", to: "frontier" },
    { from: "fetcher", to: "filter" },
    { from: "filter", to: "frontier" },
  ],
  logs: [
    {
      id: "news",
      node: "history",
      label: "/news",
      start: 21,
      side: "below",
      records: [{ text: "diff" }, { text: "diff" }, { text: "diff" }],
    },
    {
      id: "about",
      node: "history",
      label: "/about",
      start: 21,
      side: "below",
      records: [{ text: "same" }, { text: "same" }, { text: "same" }, { text: "same" }],
    },
  ],
  steps: [
    {
      title: "Pages change, so each fetch leaves a record",
      short: "History",
      text: "The Fetch worker fetches example.org/news and its content hash differs from the last visit’s, so Crawl history logs /news visit 24 as diff. It keeps each URL’s fetch times, content hash, last change and validators, such as an ETag, a version tag the server assigned.",
      focus: ["frontier", "fetcher", "host", "history"],
      frame: ["frontier", "planner", "fetcher", "host", "history"],
      facts: [["Kept per URL", "hash, ETag, change time"]],
      metrics: { news: "1 day", about: "1 day" },
      changes: ["+ GET /news: 200, new hash", "+ /news visit 24: diff"],
      events: [
        { type: "state", node: "frontier", light: "on", opts: { mark: 0 } },
        { type: "packet", path: ["frontier", "fetcher"], label: "example.org/news" },
        { type: "state", node: "fetcher", light: "on" },
        // the request carries no label: the reply's label, the changes and the text name it
        { type: "packet", path: ["fetcher", "host"], label: "" },
        { type: "state", node: "host", light: "on" },
        // the reply rides on to Crawl history, which records the visit
        { type: "packet", path: ["host", "fetcher", "history"], label: "200 · changed", kind: "response" },
        { type: "state", node: "host", light: "work", with: true },
        { type: "state", node: "history", light: "work", readout: "hash changed" },
        { type: "append", log: "news", records: [{ text: "diff" }] },
      ],
    },
    {
      title: "A 304 means no new body, still scheduled",
      short: "304",
      text: "Next, example.org/about. The Fetch worker sends a conditional request, If-None-Match with the stored ETag, and the server answers 304 Not Modified without a body, saving the bandwidth of resending it. Crawl history logs /about visit 25 as same, and the URL stays in the schedule.",
      focus: ["frontier", "fetcher", "host", "history"],
      frame: ["frontier", "planner", "fetcher", "host", "history"],
      facts: [["Request", "If-None-Match: ETag"], ["Answer", "304, no body"]],
      changes: ["+ GET /about, If-None-Match", "+ 304 Not Modified, no body", "+ /about visit 25: same"],
      events: [
        { type: "state", node: "host", light: "idle" },
        { type: "state", node: "history", light: "idle", readout: "", with: true },
        { type: "packet", path: ["frontier", "fetcher"], label: "example.org/about" },
        { type: "packet", path: ["fetcher", "host"], label: "If-None-Match" },
        { type: "state", node: "host", light: "on" },
        { type: "packet", path: ["host", "fetcher", "history"], label: "304 Not Modified", kind: "response" },
        { type: "state", node: "host", detail: "answered 304", light: "work", with: true },
        { type: "state", node: "history", light: "work" },
        { type: "append", log: "about", records: [{ text: "same" }] },
        { type: "state", node: "frontier", light: "work", readout: "still scheduled" },
      ],
    },
    {
      title: "Changing pages return sooner, stable later",
      short: "Adapt",
      text: "With example values: /news changed on its last four daily visits, so the Recrawl planner moves it to every 12 hours. /about was unchanged for five visits, so it moves to every 2 days, up to a cap. Pages that change often or matter more come back sooner.",
      focus: ["frontier", "planner", "history"],
      frame: ["frontier", "planner", "fetcher", "host", "history"],
      facts: [["Changed 4 in a row", "every 12 h"], ["Unchanged 5", "every 2 days, capped"]],
      metrics: { news: "12 h", about: "2 days" },
      changes: ["~ /news every 12 hours", "~ /about every 2 days"],
      events: [
        { type: "state", node: "fetcher", light: "idle" },
        { type: "state", node: "host", detail: "example.org", light: "idle", with: true },
        { type: "state", node: "frontier", light: "idle", readout: "", with: true },
        { type: "bracket", log: "news", id: "rule", from: 21, to: 24, label: "last 4 changed" },
        { type: "bracket", log: "about", id: "rule", from: 21, to: 25, label: "5 unchanged", gap: 120 },
        { type: "packet", path: ["history", "planner"], label: "visits" },
        { type: "state", node: "planner", light: "on" },
        // no label: the chips, facts and changes carry 12 h and 2 days
        { type: "packet", path: ["planner", "frontier"], label: "", kind: "work" },
        { type: "state", node: "planner", light: "work" },
        { type: "state", node: "frontier", light: "work", readout: "rescheduled", with: true },
      ],
    },
    {
      title: "Recrawls take nearly a third of the budget",
      short: "Budget",
      text: "Across the whole crawl, recrawling 10 million pages a day takes about 116 fetches a second, nearly a third of a 386-per-second crawl: 3 in every 10 fetches here, in blue. That share finds no new pages, so the budget decides how far adapting goes.",
      focus: ["frontier", "planner", "fetcher", "host"],
      frame: ["frontier", "planner", "fetcher", "host", "history"],
      facts: [["Recrawls", "10 million pages a day"], ["That is", "≈ 116 of 386 fetches/s"]],
      metrics: { recrawl: { n: 116, unit: " of 386/s" } },
      changes: ["+ 116 recrawls/s of 386/s", "~ Fewer fetches for new pages"],
      events: [
        { type: "state", node: "history", light: "idle" },
        { type: "state", node: "host", detail: "every site", light: "on", with: true },
        { type: "state", node: "frontier", readout: "", with: true },
        { type: "state", node: "planner", light: "work", with: true },
        { type: "state", node: "fetcher", light: "on", with: true },
        { type: "note", node: "host", text: "3 in 10: recrawls", tone: "work", with: true },
        // Recrawls come from the planner's schedule, so a still picture (reduced motion) shows them in blue on its
        // cable to the frontier; on the shared cables the new URLs, drawn after them, show in ink.
        {
          type: "stream", every: 240, routes: [
            { path: ["planner", "frontier", "fetcher", "host"], w: 3, kind: "work" },
            { path: ["frontier", "fetcher", "host"], w: 7 },
          ],
        },
      ],
    },
    {
      title: "Retry a 503 later, with backoff and jitter",
      short: "Retry",
      text: "On a later visit, example.org/news answers 503 with Retry-After: 120. A temporary failure is retried with bounded exponential backoff and jitter, honoring Retry-After: here in 2 minutes, at most 3 times (example values). Permanent errors and policy exclusions are not retried; their reasons are kept.",
      focus: ["frontier", "fetcher", "host"],
      frame: ["frontier", "planner", "fetcher", "host", "history"],
      facts: [["Temporary", "retry, back off"], ["Permanent", "stop, keep the reason"], ["Policy", "excluded, recorded"]],
      changes: ["+ 503 · Retry-After: 120", "~ Retry 1 of 3, in 2 minutes"],
      events: [
        { type: "state", node: "planner", light: "idle" },
        { type: "state", node: "fetcher", light: "on", with: true },
        { type: "state", node: "host", detail: "example.org", light: "idle", with: true },
        // the request carries no label, and the answer's header shows on the host's tag: a longer message would rest on
        // the Fetch worker's tag, and a note here as well as the frontier's readout would zoom a phone out
        { type: "packet", path: ["fetcher", "host"], label: "" },
        { type: "state", node: "host", detail: "Retry-After: 120", light: "hot" },
        // the answer rides on to the frontier, which holds the URL until its retry is due
        { type: "packet", path: ["host", "fetcher", "frontier"], label: "503", kind: "hot", with: true },
        { type: "state", node: "frontier", light: "on", readout: "retry 1 of 3" },
      ],
    },
    {
      title: "A calendar trap makes URLs without end",
      short: "Trap",
      text: "A calendar on example.org links each date to the next: a spider trap, which generates URLs without end. After a few dates, the Link filter’s per-site cap on /cal/* stops the rest. A universal trap detector would also block real pages; site rules or human review may be needed.",
      focus: ["fetcher", "filter", "frontier", "host"],
      frame: ["frontier", "planner", "filter", "fetcher", "host", "history"],
      facts: [["Cap", "per site, per pattern"], ["Also cap", "length, depth, params"]],
      changes: ["+ Link filter", "~ /cal/* capped for example.org"],
      events: [
        { type: "show", nodes: ["filter"] },
        { type: "state", node: "host", detail: "calendar pages", light: "on", with: true },
        { type: "state", node: "frontier", light: "idle", readout: "", with: true },
        { type: "state", node: "fetcher", light: "on", with: true },
        // the first dates get through; the next is stopped short of the closed filter, with an ×
        { type: "packet", path: ["fetcher", "filter", "frontier"], label: "", kind: "hot" },
        { type: "packet", path: ["fetcher", "filter", "frontier"], label: "", kind: "hot", gap: 120 },
        { type: "state", node: "filter", light: "hot", opts: { open: false } },
        { type: "note", node: "filter", text: "/cal/* capped", tone: "hot", with: true },
        { type: "packet", path: ["fetcher", "filter"], label: "/cal/2031-04-20", kind: "hot", lost: true },
      ],
    },
  ],
};
