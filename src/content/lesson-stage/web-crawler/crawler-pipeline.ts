import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Trace one page through the system", with the lesson's example values: a Fetch worker leases
// example.org/guide from the URL frontier for 5 minutes, checks policy, resolves the host and gets a 200 of 180 KB.
// The Parser finds 40 links; the Link filter drops 25 as seen or out of scope, so 15 return to the frontier (40 − 25)
// and close the discovery loop. The document goes to the Page store, and only then is the lease marked complete.
// Then the same moment with a crash: the worker dies after the page is stored and its links queued, before the lease
// is complete, so after 5 minutes the lease expires and the URL is eligible again. Another worker repeats the work;
// the same key keeps one stored copy and the 15 links are already queued (at-least-once processing).
export const crawlerPipelineStage: StageScene = {
  id: "crawler-pipeline",
  intro: "Follow one page from a leased URL to a stored document and 15 new URLs, then crash the worker halfway.",
  metrics: [
    { id: "links", label: "Links found" },
    { id: "fresh", label: "New URLs" },
    { id: "lease", label: "Lease" },
  ],
  // A loop on the floor: URL frontier → Fetch worker → Parser along lane 0, the Web host and the Page store down the
  // diagonal beside the worker and the parser, and the Link filter on the far side carrying links back to the frontier.
  // Phone rows: URL frontier | Fetch worker, Web host | Link filter | Parser, Page store.
  // No step sets `frame`: a wide screen keeps the whole loop in view, and a phone frames each step's focus, so its
  // labels keep their size. A step whose focus spans all three rows uses readouts or notes, not both, so the rows fit
  // a 375×667 phone; the Page store speaks through readouts, since a note over it would cover the Parser's tag.
  nodes: [
    { id: "frontier", role: "frontier", label: "URL frontier", detail: "durable list", at: [0, 0], opts: { count: 3, items: 3 } },
    { id: "fetcher", role: "fetcher", label: "Fetch worker", detail: "leases a URL", at: [1, 0] },
    { id: "host", role: "external", label: "Web host", detail: "example.org", at: [1, 1.5] },
    { id: "parser", role: "worker", label: "Parser", detail: "finds links", at: [2, 0] },
    { id: "store", role: "storage", label: "Page store", detail: "document sink", at: [2, 1.5] },
    { id: "filter", role: "gate", label: "Link filter", detail: "seen + scope", at: [1.8, -1.4] },
  ],
  links: [
    { from: "frontier", to: "fetcher" },
    { from: "fetcher", to: "host" },
    { from: "fetcher", to: "parser" },
    { from: "parser", to: "store" },
    { from: "parser", to: "filter" },
    { from: "filter", to: "frontier" },
  ],
  steps: [
    {
      title: "A worker leases one URL for 5 minutes",
      short: "Lease",
      text: "Seed URLs wait in the URL frontier, the durable list of URLs to fetch. The Fetch worker leases example.org/guide: it claims the URL for a limited time, here an example lease of 5 minutes.",
      focus: ["frontier", "fetcher"],
      metrics: { lease: "5 min" },
      changes: ["+ example.org/guide leased", "~ Lease runs 5 minutes"],
      events: [
        // the readout first, so a phone lifts the note above it
        { type: "state", node: "frontier", light: "on", readout: "leased · 5 min", opts: { mark: 0 } },
        { type: "note", node: "frontier", text: "seed URLs waiting", with: true },
        { type: "packet", path: ["frontier", "fetcher"], label: "example.org/guide" },
        { type: "state", node: "fetcher", light: "on" },
      ],
    },
    {
      title: "The fetch returns 200 and 180 KB",
      short: "Fetch",
      text: "Before it fetches, the Fetch worker checks crawl policy and resolves the host. It fetches example.org/guide with bounds, gets a 200 response of 180 KB from the Web host, and records the outcome.",
      focus: ["fetcher", "host"],
      changes: ["+ GET /guide", "+ 200 · 180 KB recorded"],
      events: [
        { type: "packet", path: ["fetcher", "host"], label: "GET /guide" },
        { type: "state", node: "host", light: "on" },
        { type: "packet", path: ["host", "fetcher"], label: "200 · 180 KB", kind: "response" },
        { type: "state", node: "host", light: "work" },
        { type: "state", node: "fetcher", readout: "200 · 180 KB", with: true },
      ],
    },
    {
      title: "The parser finds 40 links",
      short: "Parse",
      text: "The Fetch worker hands the 180 KB of HTML to the Parser. The Parser validates the response, extracts the document’s information and finds 40 links on the page.",
      focus: ["fetcher", "parser"],
      metrics: { links: 40 },
      changes: ["+ 180 KB handed to the Parser", "+ 40 links found"],
      events: [
        { type: "state", node: "host", light: "idle" },
        { type: "packet", path: ["fetcher", "parser"], label: "180 KB HTML" },
        { type: "state", node: "fetcher", readout: "", with: true },
        { type: "state", node: "parser", light: "on" },
        { type: "note", node: "parser", text: "40 links", with: true },
      ],
    },
    {
      title: "15 of 40 links return to the frontier",
      short: "Filter",
      text: "The Link filter drops 25 of the 40 links as already seen or out of scope, and 15 become new entries in the URL frontier. That closes the discovery loop: each page can create more work, so a crawl needs a budget rather than a natural end.",
      focus: ["parser", "filter", "frontier"],
      facts: [["Found", "40"], ["Dropped", "25"], ["New", "15"]],
      metrics: { fresh: 15 },
      changes: ["− 25 seen or out of scope", "+ 15 new frontier entries"],
      events: [
        { type: "packet", path: ["parser", "filter"], label: "40 links" },
        // a readout, not a note: the frontier already shows one, and this step frames all three phone rows
        { type: "state", node: "filter", light: "on", readout: "25 dropped", opts: { open: "half" } },
        { type: "packet", path: ["filter", "frontier"], label: "15 new URLs", kind: "work" },
        { type: "state", node: "frontier", light: "work", opts: { items: 4 } },
      ],
    },
    {
      title: "Store the page, then complete the lease",
      short: "Complete",
      text: "The Parser hands the document to the Page store, the sink: storing is a separate stage from parsing. Only then is the lease on example.org/guide marked complete.",
      focus: ["fetcher", "parser", "store", "frontier"],
      metrics: { lease: "complete" },
      changes: ["+ Document in the Page store", "~ Lease complete"],
      events: [
        { type: "state", node: "filter", light: "idle", readout: "", opts: { open: false } },
        { type: "packet", path: ["parser", "store"], label: "document", kind: "work" },
        // the store's light says it: a note over the store covers the Parser's tag on a wide screen, and a readout
        // with the frontier's note would shrink a 375×667 phone's labels
        { type: "state", node: "store", light: "work" },
        { type: "state", node: "parser", light: "idle", with: true },
        { type: "packet", path: ["fetcher", "frontier"], label: "lease complete", kind: "quiet" },
        // a note rather than a readout: a resting message would cover a readout beside the frontier
        { type: "state", node: "frontier", light: "idle", readout: "", opts: { mark: undefined } },
        { type: "note", node: "frontier", text: "lease marked complete", with: true },
        { type: "state", node: "fetcher", light: "idle", with: true },
      ],
    },
    {
      title: "A crash leaves the lease to expire",
      short: "Crash",
      text: "Suppose instead the Fetch worker crashes after the page is stored and its links queued, but before the lease is complete. The URL isn’t silently lost: after 5 minutes the lease expires, and example.org/guide is eligible again.",
      focus: ["frontier", "fetcher"],
      metrics: { lease: "expired" },
      changes: ["− Fetch worker crashes before completing", "~ Lease expires after 5 minutes", "~ example.org/guide eligible again"],
      events: [
        { type: "state", node: "frontier", light: "on", readout: "leased · 5 min", opts: { mark: 0 } },
        { type: "state", node: "fetcher", light: "on", with: true },
        { type: "pause", ms: 400 },
        { type: "state", node: "fetcher", light: "hot", tone: "hot", down: true, detail: "crashed" },
        { type: "pause", ms: 900 },
        { type: "state", node: "frontier", readout: "eligible again" },
        { type: "note", node: "frontier", text: "lease expired: 5 min", tone: "hot", with: true },
      ],
    },
    {
      title: "Idempotent keys make the repeat harmless",
      short: "Repeat",
      text: "Another worker leases the URL, then fetches and processes the page again. The document lands under the same key, so the Page store keeps one copy, and the 15 links are already queued. This is at-least-once processing: simpler than exactly once, at the cost of occasional repeats.",
      focus: ["frontier", "fetcher", "parser", "store", "filter"],
      metrics: { lease: "complete" },
      changes: ["+ Another worker", "~ Same key: one stored copy", "~ 15 links already queued", "~ Lease complete"],
      events: [
        { type: "state", node: "fetcher", light: "on", tone: "", down: false, detail: "another worker" },
        { type: "state", node: "frontier", light: "on", readout: "leased · 5 min", with: true },
        { type: "packet", path: ["fetcher", "parser"], label: "180 KB HTML" },
        { type: "state", node: "parser", light: "on" },
        { type: "packet", path: ["parser", "store"], label: "document", kind: "work" },
        { type: "packet", path: ["parser", "filter"], label: "40 links", with: true },
        // readouts, not notes: all three phone rows are framed, and the Lease metric says the lease is complete
        { type: "state", node: "store", readout: "still 1 copy" },
        { type: "state", node: "filter", light: "on", readout: "already queued", with: true },
        { type: "packet", path: ["fetcher", "frontier"], label: "lease complete", kind: "quiet" },
        { type: "state", node: "frontier", light: "idle", readout: "", opts: { mark: undefined } },
        { type: "state", nodes: ["fetcher", "parser"], light: "idle", with: true },
      ],
    },
  ],
};
