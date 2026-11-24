import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Fetch imperfect pages safely": a bounded Fetch worker resolves example.org (example address 203.0.113.7),
// passes the Address check and fetches /guide, 200 · 180 KB, under example bounds of a 30 s timeout, 5 redirects at
// most and 20 MB unpacked at most. A 10 MB gzip would expand about 1,000× to 10 GB in memory, so the worker stops it
// at its 20 MB decompressed cap and closes the stream. Then SSRF: a public page redirects to 169.254.169.254, where
// cloud instances read metadata, and the Address check refuses the hop (redirect 1 of 5); example.net first resolves
// to 203.0.113.9 (public), then to 169.254.169.254, so the check on the address actually connected to blocks it too
// (2 blocked). Last, a tolerant Parser finds the 40 links on /guide (unsupported schemes such as mailto: dropped), and
// only a JavaScript-rendered page goes on to the costly Renderer, a headless browser. Both 203.0.113.x addresses are
// documentation addresses.
export const crawlerFetchStage: StageScene = {
  id: "crawler-fetch",
  intro: "Watch a fetch worker meet a decompression bomb and a redirect to a private address, then parse and render what it keeps.",
  metrics: [
    { id: "body", label: "Body" },
    { id: "hops", label: "Redirects" },
    { id: "blocked", label: "Blocked" },
  ],
  // One request path along lane 0: Fetch worker → Address check → Web host, with the DNS resolver beside the worker
  // and Cloud metadata down the diagonal from the host, so the check is where the two destinations fork. For parsing,
  // the network parts leave and the Parser and the Renderer take lane 0, a straight line on every screen; the Renderer
  // arrives with the Parser, dimmed, so both parsing steps keep one scale.
  // Phone rows: Fetch worker, DNS resolver | Address check | Web host, Cloud metadata → Fetch worker | Parser | Renderer.
  nodes: [
    { id: "fetcher", role: "fetcher", label: "Fetch worker", detail: "bounded client", at: [0, 0] },
    { id: "dns", role: "dns", label: "DNS resolver", detail: "name → address", at: [0, 1.5] },
    { id: "check", role: "gate", label: "Address check", detail: "public IPs only", at: [1, 0], opts: { open: true } },
    { id: "host", role: "external", label: "Web host", detail: "example.org", at: [2, -0.8] },
    { id: "meta", role: "web", label: "Cloud metadata", detail: "169.254.169.254", at: [2, 0.8], appear: 2 },
    { id: "parser", role: "worker", label: "Parser", detail: "tolerant HTML", at: [1, 0], appear: 4 },
    { id: "renderer", role: "worker", label: "Renderer", detail: "headless browser", at: [2, 0], appear: 4 },
  ],
  links: [
    { from: "fetcher", to: "dns" },
    { from: "fetcher", to: "check" },
    { from: "check", to: "host" },
    { from: "check", to: "meta" },
    { from: "fetcher", to: "parser" },
    { from: "parser", to: "renderer" },
  ],
  steps: [
    {
      title: "Every fetch runs inside set bounds",
      short: "Bounds",
      text: "The Fetch worker resolves example.org to 203.0.113.7, a public address the Address check lets through, and fetches /guide under a clear crawler identity and example bounds. It gets 200 · 180 KB. Concurrency helps, but each worker has finite memory, bandwidth and file descriptors.",
      frame: ["fetcher", "dns", "check", "host"],
      facts: [["Timeout", "30 s"], ["Redirects", "5 at most"], ["Unpacked", "20 MB at most"]],
      metrics: { body: "180 KB", hops: { n: 0, unit: " of 5" }, blocked: 0 },
      changes: ["+ example.org → 203.0.113.7, public", "+ GET /guide: 200 · 180 KB"],
      events: [
        { type: "state", node: "fetcher", light: "on" },
        { type: "packet", path: ["fetcher", "dns"], label: "example.org?" },
        // the answer shows at the resolver, so the link to it carries one message (two would stack at rest)
        { type: "state", node: "dns", light: "work", readout: "203.0.113.7", gap: 160 },
        { type: "packet", path: ["fetcher", "check", "host"], label: "GET /guide", gap: 200 },
        { type: "state", node: "check", light: "work", with: true },
        { type: "note", node: "check", text: "203.0.113.7: public", tone: "work", with: true },
        { type: "state", node: "host", light: "on" },
        { type: "packet", path: ["host", "check", "fetcher"], label: "200 · 180 KB", kind: "response", gap: 160 },
        { type: "state", node: "host", light: "work" },
        { type: "state", node: "fetcher", light: "work", with: true },
      ],
    },
    {
      title: "A 10 MB gzip would unpack to 10 GB",
      short: "Gzip bomb",
      text: "Another response from example.org is a 10 MB gzip body. Gzip can expand about 1,000 times, so it would become 10 GB in memory. The Fetch worker caps the decompressed size, not just the transfer: at 20 MB it closes the stream and records why.",
      focus: ["fetcher", "check", "host"],
      frame: ["fetcher", "dns", "check", "host"],
      facts: [["Gzip can expand", "about 1,000×"], ["Cap", "20 MB unpacked"]],
      metrics: { body: { n: 20, unit: " MB, cut", tone: "hot" } },
      changes: ["+ 10 MB gzip response", "− Stream closed at 20 MB unpacked", "+ Reason recorded"],
      events: [
        { type: "state", node: "host", light: "on" },
        { type: "state", node: "fetcher", light: "on", with: true },
        { type: "state", node: "check", light: "idle", with: true },
        { type: "state", node: "dns", light: "idle", readout: "", with: true },
        { type: "packet", path: ["host", "check", "fetcher"], label: "10 MB gzip", kind: "hot" },
        { type: "state", node: "fetcher", readout: "unpacking…" },
        { type: "state", node: "host", light: "idle", with: true },
        { type: "pause", ms: 700 },
        { type: "state", node: "fetcher", light: "hot", tone: "hot", readout: "stopped at 20 MB" },
        { type: "note", node: "fetcher", text: "would unpack to 10 GB", tone: "hot", with: true },
      ],
    },
    {
      title: "Check the address after every redirect",
      short: "Redirect",
      text: "A public page on example.org answers 301 to 169.254.169.254, where cloud instances read metadata, which may include credentials. That is SSRF, server-side request forgery: an attacker gets your server to call addresses it can reach and they cannot. The Address check validates the new destination and refuses it.",
      focus: ["fetcher", "check", "host", "meta"],
      frame: ["fetcher", "dns", "check", "host", "meta"],
      facts: [["Redirect to", "169.254.169.254"], ["Serves", "instance metadata"]],
      metrics: { body: "—", hops: { n: 1, unit: " of 5" }, blocked: 1 },
      changes: ["+ 301 → 169.254.169.254", "~ Redirect target checked", "− Hop refused before connecting"],
      events: [
        { type: "state", node: "fetcher", light: "on", tone: "", readout: "" },
        { type: "state", node: "host", light: "on", with: true },
        { type: "packet", path: ["host", "check", "fetcher"], label: "301 → 169.254.169.254", kind: "response" },
        { type: "state", node: "host", light: "idle" },
        // the check drops its bar as the request sets out, so the request never passes an open check
        { type: "packet", path: ["fetcher", "check", "meta"], label: "GET 169.254.169.254", kind: "hot", lost: true },
        { type: "state", node: "check", light: "hot", tone: "hot", opts: { open: false }, with: true },
        { type: "note", node: "check", text: "private address: blocked", tone: "hot" },
      ],
    },
    {
      title: "Check the address you actually connect to",
      short: "Connect check",
      text: "Next, example.net resolves to 203.0.113.9, a public address, so a check at that moment passes. Moments later the name resolves to 169.254.169.254. The Address check validates the address actually connected to, not the earlier answer, so it blocks this connection too.",
      focus: ["fetcher", "dns", "check", "meta"],
      frame: ["fetcher", "dns", "check", "host", "meta"],
      facts: [["At check", "203.0.113.9"], ["At connect", "169.254.169.254"]],
      metrics: { hops: { n: 0, unit: " of 5" }, blocked: 2 },
      changes: ["+ New fetch: example.net", "~ example.net now resolves to 169.254.169.254", "− Connection blocked at the Address check"],
      events: [
        { type: "state", node: "check", light: "idle", tone: "", opts: { open: true } },
        { type: "packet", path: ["fetcher", "dns"], label: "example.net?" },
        { type: "state", node: "dns", light: "work", readout: "203.0.113.9", gap: 160 },
        { type: "note", node: "fetcher", text: "ok when resolved", tone: "work", with: true },
        { type: "pause", ms: 600 },
        { type: "state", node: "dns", light: "hot", tone: "hot", readout: "now private" },
        { type: "packet", path: ["fetcher", "check", "meta"], label: "connect example.net", kind: "hot", lost: true },
        { type: "state", node: "check", light: "hot", tone: "hot", opts: { open: false }, with: true },
        { type: "note", node: "check", text: "connected IP: blocked", tone: "hot" },
      ],
    },
    {
      title: "Parse real HTML with a tolerant parser",
      short: "Parse",
      text: "The Fetch worker hands the 180 KB of HTML from /guide to the Parser. Real pages are often malformed, so it is a tolerant parser, not a regular expression. It finds 40 links, resolves them against the final URL, and drops unsupported schemes such as mailto:.",
      focus: ["fetcher", "parser"],
      frame: ["fetcher", "parser", "renderer"],
      facts: [["Links resolved", "final URL, valid base"], ["Kept", "status, type, fetch time"]],
      metrics: { body: "180 KB" },
      changes: ["+ Parser", "+ 40 links found", "− Unsupported schemes dropped"],
      events: [
        { type: "hide", nodes: ["dns", "check", "host", "meta"] },
        { type: "state", node: "fetcher", light: "on", with: true },
        { type: "show", nodes: ["parser", "renderer"] },
        { type: "packet", path: ["fetcher", "parser"], label: "180 KB HTML" },
        { type: "state", node: "parser", light: "on" },
        { type: "note", node: "parser", text: "40 links · mailto: dropped", tone: "work", with: true },
      ],
    },
    {
      title: "Render JavaScript pages only when needed",
      short: "Render",
      text: "Some pages show content only after JavaScript runs. If one is in scope, the Parser sends it to the Renderer, a headless browser that uses far more CPU and memory than parsing. Google renders pages with headless Chromium in a stage after crawling. Don’t render every page by default.",
      focus: ["parser", "renderer"],
      frame: ["fetcher", "parser", "renderer"],
      facts: [["Renderer", "headless browser"], ["Default", "parse, don’t render"]],
      changes: ["+ JS-rendered page to the Renderer", "~ Far more CPU and memory", "~ Other pages only parsed"],
      events: [
        { type: "state", node: "fetcher", light: "idle" },
        { type: "packet", path: ["parser", "renderer"], label: "JS-rendered page" },
        // a note, not a load pill: a pill to the Renderer's right would widen the frame and zoom out from step 5
        { type: "state", node: "renderer", light: "on" },
        { type: "note", node: "renderer", text: "far more CPU + memory", with: true },
        { type: "note", node: "parser", text: "render only if needed", with: true },
      ],
    },
  ],
};
