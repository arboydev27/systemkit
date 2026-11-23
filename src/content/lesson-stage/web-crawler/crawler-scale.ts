import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Partition and operate the crawl": the Host router hashes example.org to Scheduler A, one of 20 scheduler
// shards, so one place owns that host's rate policy while many Fetch workers lease its URLs (an example pace of 1
// request every 2 s; Apache Nutch partitions fetch lists by host, domain or IP for the same reason). Scheduler B joins
// as the 21st shard: a consistent-hash ring moves about 5% of hosts (1/21), example.org among them, where modulo
// hashing moves about 95% (20/21). The handover, with example times: A's last fetch was at 12:00:00, A stops and saves
// next eligible 12:00:02 with the ownership change (it rides to B through the Host router), and only then does B start,
// fetching at 12:00:02. Replayed without the save, B fetches at
// 12:00:01, two fetches inside one 2-second window. Then pages go to the Page store under stable keys before a durable
// index event goes out, and last the lesson's scenario: more workers raise total fetches, but example.org stays at
// 1 per 2 s and its queue ages, which per-host signals in Crawl health show before total QPS does.
export const crawlerScaleStage: StageScene = {
  id: "crawler-scale",
  intro: "Watch example.org get one scheduler as its owner, change owners when a shard joins, and stay polite through the handover.",
  metrics: [
    { id: "shards", label: "Shards" },
    { id: "moved", label: "Hosts moved" },
    { id: "rate", label: "Host rate" },
  ],
  // Ownership runs left to right: Host router → Scheduler A and B (either side of the tier's middle) → Fetch workers →
  // Web host. On a wide screen lanes step down the diagonal, so the schedulers stand a little early and the workers and
  // the host a little late and up the diagonal: Scheduler B's notes and pill then stay clear of the workers' tag. The
  // router's numbers are notes over it, since a pill beside it would sit under Scheduler A's tag. The Page store and
  // Index events take the host's tier in step 6. In step 7 Scheduler A leaves, so Scheduler B's queue note has room, and
  // Crawl health stands beside the host. The schedulers have no link of their own: the handover rides through the Host
  // router, which on a phone keeps one clean fork instead of a cable looping round the row. At most five parts at once.
  // Phone rows: Host router | Scheduler A, Scheduler B | Fetch workers | Web host (+ Crawl health), or Page store + Index events.
  nodes: [
    { id: "router", role: "router", label: "Host router", detail: "hash(host) → shard", at: [0, 0], opts: { count: 4, mark: 1 } },
    { id: "schedA", role: "frontier", label: "Scheduler A", detail: "1 of 20 shards", at: [0.9, -0.9], opts: { count: 3, items: 2 } },
    { id: "schedB", role: "frontier", label: "Scheduler B", detail: "21st shard", at: [0.9, 0.9], appear: 2, opts: { count: 2, items: 1 } },
    { id: "fetcher", role: "fetcher", label: "Fetch workers", detail: "500 workers", at: [2.2, -0.6] },
    { id: "host", role: "external", label: "Web host", detail: "example.org", at: [3.2, -0.6] },
    { id: "store", role: "storage", label: "Page store", detail: "stable keys", at: [3.2, -1.4], appear: 5 },
    { id: "events", role: "queue", label: "Index events", detail: "durable handoff", at: [3.2, 0.5], appear: 5, opts: { items: 0 } },
    { id: "health", role: "monitor", label: "Crawl health", detail: "per-host signals", at: [3.2, 1.0], appear: 6 },
  ],
  links: [
    { from: "router", to: "schedA" },
    { from: "router", to: "schedB" },
    { from: "schedA", to: "fetcher" },
    { from: "schedB", to: "fetcher" },
    { from: "fetcher", to: "host" },
    { from: "fetcher", to: "store" },
    { from: "fetcher", to: "events" },
    { from: "fetcher", to: "health" },
  ],
  steps: [
    {
      title: "Each host has exactly one scheduler",
      short: "One owner",
      text: "A shard is one scheduler’s slice of the hosts. The Host router hashes each host to one of 20 shards, and example.org lands on Scheduler A. One place now owns that host’s rate policy, however many workers fetch for it.",
      focus: ["router", "schedA"],
      frame: ["router", "schedA", "fetcher", "host"],
      facts: [["Shards", "20"], ["example.org", "Scheduler A"]],
      metrics: { shards: 20 },
      changes: ["+ example.org → Scheduler A", "~ One owner per host"],
      events: [
        { type: "state", node: "router", light: "on" },
        { type: "note", node: "router", text: "20 shards", with: true },
        { type: "packet", path: ["router", "schedA"], label: "example.org" },
        { type: "state", node: "schedA", light: "on", readout: "owns example.org", opts: { mark: 0 } },
      ],
    },
    {
      title: "Many workers lease, one owner sets pace",
      short: "Workers lease",
      text: "Fetch workers lease eligible URLs from Scheduler A, claiming each for a limited time, many at once. Only Scheduler A decides when example.org is eligible: here, once every 2 seconds, an example pace. Apache Nutch partitions fetch lists by host, domain or IP for the same reason.",
      focus: ["schedA", "fetcher", "host"],
      frame: ["router", "schedA", "fetcher", "host"],
      facts: [["example.org", "1 request / 2 s"], ["Paced by", "Scheduler A only"]],
      metrics: { rate: { n: 1, unit: " per 2 s" } },
      changes: ["+ Workers lease URLs from A", "~ example.org: 1 request every 2 s"],
      events: [
        { type: "state", node: "router", light: "idle" },
        { type: "state", node: "schedA", readout: "next in 2 s", with: true },
        { type: "state", node: "fetcher", light: "on", with: true },
        { type: "state", node: "host", light: "on", readout: "1 per 2 s", with: true },
        // Leases for A's other hosts end at the workers; one in four goes on to example.org, so it gets one every 2 s.
        {
          type: "stream", every: 500, routes: [
            { path: ["schedA", "fetcher"], w: 3 },
            { path: ["schedA", "fetcher", "host"], w: 1 },
          ],
        },
      ],
    },
    {
      title: "A 21st shard moves only about 5% of hosts",
      short: "New shard",
      text: "Scheduler B joins as the 21st shard. A consistent-hash ring moves about 5% of hosts to it, example.org among them; modulo hashing would move about 95%. The ring doesn’t fix hot hosts or stalled workers, and every shard adds failure modes, so add shards only when a scheduler’s memory or CPU runs out.",
      focus: ["router", "schedA", "schedB"],
      frame: ["router", "schedA", "schedB", "fetcher", "host"],
      facts: [["Ring", "about 5% move"], ["Modulo", "about 95% move"]],
      metrics: { shards: 21, moved: { n: 5, unit: "%" } },
      changes: ["+ Scheduler B, the 21st shard", "~ About 5% of hosts move", "~ example.org now maps to B"],
      events: [
        { type: "show", nodes: ["schedB"] },
        { type: "state", node: "schedA", light: "idle", detail: "1 of 21 shards", readout: "", opts: { mark: undefined }, with: true },
        { type: "state", node: "fetcher", light: "idle", with: true },
        { type: "state", node: "host", light: "idle", readout: "", with: true },
        { type: "state", node: "router", light: "on", opts: { mark: 2 } },
        { type: "note", node: "router", text: "20 → 21", with: true },
        { type: "packet", path: ["router", "schedB"], label: "≈5% of hosts" },
        { type: "state", node: "schedB", light: "on" },
        { type: "note", node: "schedB", text: "gets example.org", with: true },
      ],
    },
    {
      title: "Hand over in order: stop, save, start",
      short: "Handover",
      text: "Scheduler A stops scheduling example.org and saves its next-eligible time with the ownership change: last fetch 12:00:00, so next eligible 12:00:02 (example times). Only then does Scheduler B start, and its first fetch waits until 12:00:02.",
      focus: ["schedA", "router", "schedB", "fetcher", "host"],
      frame: ["router", "schedA", "schedB", "fetcher", "host"],
      facts: [["Last fetch", "12:00:00"], ["Next eligible", "12:00:02"]],
      metrics: { rate: { n: 1, unit: " per 2 s" } },
      changes: ["− A stops scheduling example.org", "+ Saved: next eligible 12:00:02", "+ B fetches at 12:00:02"],
      events: [
        { type: "state", node: "router", light: "idle" },
        { type: "state", node: "schedA", light: "on", opts: { count: 2 }, with: true },
        { type: "note", node: "schedA", text: "stops example.org", with: true },
        { type: "packet", path: ["schedA", "router", "schedB"], label: "next: 12:00:02", kind: "work" },
        { type: "state", node: "schedA", light: "idle" },
        { type: "state", node: "schedB", light: "work", readout: "eligible 12:00:02", opts: { count: 3, mark: 0 }, with: true },
        { type: "pause", ms: 600 },
        { type: "packet", path: ["schedB", "fetcher", "host"], label: "fetch 12:00:02" },
        { type: "state", node: "host", light: "on", readout: "1 per 2 s" },
      ],
    },
    {
      title: "Skip the save and the host is hit twice",
      short: "No save",
      text: "Replay the handover without the save. Scheduler A fetches example.org at 12:00:00 and stops, but Scheduler B never gets the next-eligible time. It treats the host as eligible now and fetches at 12:00:01: two fetches inside one 2-second window.",
      focus: ["schedA", "schedB", "fetcher", "host"],
      frame: ["router", "schedA", "schedB", "fetcher", "host"],
      facts: [["Last fetch", "12:00:00"], ["Second fetch", "12:00:01"]],
      metrics: { rate: { n: 2, unit: " in 2 s", tone: "hot" } },
      changes: ["− No saved next-eligible time", "+ Second fetch at 12:00:01", "~ Two fetches in one 2 s window"],
      events: [
        { type: "state", node: "schedB", light: "idle", readout: "" },
        { type: "state", node: "host", light: "idle", readout: "", with: true },
        { type: "state", node: "schedA", light: "on", with: true },
        { type: "packet", path: ["schedA", "fetcher", "host"], label: "fetch 12:00:00" },
        { type: "state", node: "host", light: "on", readout: "fetched 12:00:00" },
        { type: "state", node: "schedA", light: "idle", with: true },
        { type: "note", node: "schedA", text: "stops, no save", tone: "hot", with: true },
        { type: "state", node: "schedB", light: "hot", tone: "hot", readout: "eligible now" },
        { type: "packet", path: ["schedB", "fetcher", "host"], label: "fetch 12:00:01", kind: "hot" },
        { type: "state", node: "host", light: "hot", tone: "hot", readout: "2 fetches in 2 s" },
      ],
    },
    {
      title: "Store pages, then publish index events",
      short: "Index handoff",
      text: "With the save back in place, Fetch workers store each fetched version and its metadata in the Page store under a stable key, then publish a durable event to Index events. A retried write lands on the same key, so storing twice does no harm.",
      focus: ["fetcher", "store", "events"],
      frame: ["schedA", "schedB", "fetcher", "store", "events"],
      facts: [["Store", "versions, stable keys"], ["Then", "a durable index event"]],
      metrics: { rate: { n: 1, unit: " per 2 s" } },
      changes: ["+ Page under a stable key", "+ Durable index event", "~ Saved handover: 1 per 2 s again"],
      events: [
        { type: "hide", nodes: ["router", "host"] },
        { type: "state", node: "schedB", light: "idle", tone: "", readout: "", with: true },
        { type: "show", nodes: ["store", "events"] },
        { type: "state", node: "fetcher", light: "on" },
        { type: "packet", path: ["fetcher", "store"], label: "page · stable key", kind: "work" },
        { type: "state", node: "store", light: "work" },
        { type: "note", node: "store", text: "retry: same key", tone: "work", with: true },
        { type: "packet", path: ["fetcher", "events"], label: "index event", kind: "work" },
        { type: "state", node: "events", light: "work", opts: { items: 1 } },
        { type: "state", node: "fetcher", light: "work", with: true },
      ],
    },
    {
      title: "Watch per-host signals, not total QPS",
      short: "Signals",
      text: "More workers raise total fetches a second, but example.org still allows 1 per 2 s, so its queue in Scheduler B ages. Crawl health watches queue age by priority, change-detection lag and per-host request rates, with errors, robots denials, bytes and duplicate ratio. These show the host falling behind before total QPS does.",
      focus: ["schedB", "fetcher", "host", "health"],
      frame: ["schedB", "fetcher", "host", "health"],
      facts: [["Fleet", "more fetches/s"], ["example.org", "still 1 per 2 s"]],
      metrics: { rate: { n: 1, unit: " per 2 s" } },
      changes: ["+ More fetch workers", "~ example.org still 1 per 2 s", "~ Its queue age rises"],
      events: [
        { type: "hide", nodes: ["store", "events", "schedA"] },
        { type: "state", node: "fetcher", light: "on", detail: "more workers", with: true },
        { type: "show", nodes: ["host", "health"] },
        { type: "state", node: "host", light: "on", tone: "", readout: "1 per 2 s", with: true },
        // Leases for B's other hosts end at the workers; one in four goes on to example.org, still one every 2 s.
        {
          type: "stream", every: 500, routes: [
            { path: ["schedB", "fetcher"], w: 3 },
            { path: ["schedB", "fetcher", "host"], w: 1 },
          ],
        },
        { type: "state", node: "schedB", light: "hot", tone: "hot", opts: { items: 4 } },
        { type: "note", node: "schedB", text: "queue age rising", tone: "hot", with: true },
        { type: "state", node: "health", light: "hot", tone: "hot", readout: "example.org behind" },
      ],
    },
  ],
};
