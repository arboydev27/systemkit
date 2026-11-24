import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Respect each host": the Fetch workers read a small blog's robots.txt (RFC 9309) and Robots rules caches it
// for 24 hours at most. Each path is checked before a fetch: the example rule Disallow: /drafts/ holds /drafts/9 while
// /posts/7 goes through; the rules are crawl preferences, not a security boundary. A refetch answered with a 5xx means
// assume everything is disallowed (a 4xx lets the crawler proceed). Then the lesson's scenario: a fleet limit of 500 lets
// all 500 workers hit the one small site, so a Host timer tracks the host's next-eligible time and spaces requests 2 s
// apart; a 429 slows that host while Web host B keeps moving. Last, the cost: 1 request every 2 s is 43,200 fetches a day,
// so a site with one million URLs (Web host A, "if" it had that many) takes about 23 days a pass (1,000,000 ÷ 43,200 = 23.1).
export const crawlerPolicyStage: StageScene = {
  id: "crawler-policy",
  intro: "Watch a crawler read a small blog’s robots.txt, then pace its requests to that one host while others keep moving.",
  metrics: [
    { id: "robots", label: "Robots" },
    { id: "rate", label: "Blog rate" },
    { id: "pass", label: "Full pass" },
  ],
  // The request path runs along lane 0: URL frontier → Robots rules → Fetch workers → Web host. Robots rules' story ends
  // at step 4; from step 5 it leaves the stage (the check still runs, as the step says) and the URL frontier slides into
  // its tier, so a phone holds three rows while the pacing plays. The Host timer stands down the diagonal beside the
  // frontier it paces. Web host B arrives beside Web host A, which steps up the diagonal to make room.
  // Phone rows, steps 1–4: URL frontier | Robots rules | Fetch workers | Web host. Steps 5–7: URL frontier, Host timer |
  // Fetch workers | Web host A, Web host B.
  nodes: [
    { id: "frontier", role: "frontier", label: "URL frontier", detail: "durable, by host", at: [0, 0], opts: { count: 2, items: 3 } },
    { id: "timer", role: "timer", label: "Host timer", detail: "next eligible", at: [1, 1.6], appear: 4 },
    { id: "robots", role: "gate", label: "Robots rules", detail: "cached ≤ 24 h", at: [1, 0], opts: { open: false } },
    { id: "fetcher", role: "fetcher", label: "Fetch workers", detail: "500 workers", at: [2, 0] },
    { id: "host", role: "external", label: "Web host", detail: "small blog", at: [3, 0] },
    { id: "hostB", role: "external", label: "Web host B", detail: "other site", at: [3, 0.9], appear: 5 },
  ],
  links: [
    { from: "frontier", to: "robots" },
    { from: "frontier", to: "fetcher", unless: "robots" },
    { from: "frontier", to: "timer" },
    { from: "robots", to: "fetcher" },
    { from: "fetcher", to: "host" },
    { from: "fetcher", to: "hostB" },
  ],
  steps: [
    {
      title: "Fetch robots.txt and cache its rules",
      short: "Robots.txt",
      text: "Before fetching any path on a small blog, the Fetch workers read its robots.txt: a plain text file at the site’s root, standardized in RFC 9309, listing paths that named crawlers are asked to avoid. Robots rules keeps the copy for 24 hours at most.",
      focus: ["robots", "fetcher", "host"],
      frame: ["frontier", "robots", "fetcher", "host"],
      facts: [["Standard", "RFC 9309"], ["Cache", "24 h at most"]],
      metrics: { robots: "cached" },
      changes: ["+ GET /robots.txt", "+ Rules cached, 24 h at most"],
      events: [
        { type: "state", node: "fetcher", light: "on" },
        { type: "packet", path: ["fetcher", "host"], label: "GET /robots.txt" },
        { type: "state", node: "host", light: "on" },
        { type: "packet", path: ["host", "fetcher", "robots"], label: "rules", kind: "response" },
        { type: "state", node: "host", light: "work", with: true },
        { type: "state", node: "robots", light: "work", opts: { open: true } },
        { type: "note", node: "robots", text: "rules cached", tone: "work", with: true },
      ],
    },
    {
      title: "Check each path before fetching it",
      short: "Check path",
      text: "Robots rules checks each path the URL frontier hands out: Disallow: /drafts/ holds /drafts/9, and /posts/7 goes on to the blog. The rules are crawl preferences, not a security boundary or permission to read restricted data. Site terms and law may add constraints.",
      focus: ["frontier", "robots", "fetcher", "host"],
      frame: ["frontier", "robots", "fetcher", "host"],
      facts: [["Rule", "Disallow: /drafts/"], ["Not", "a security boundary"]],
      metrics: { robots: "allowed" },
      changes: ["~ /drafts/9 held by the rule", "+ GET /posts/7"],
      events: [
        { type: "state", node: "host", light: "idle" },
        { type: "state", node: "frontier", light: "on", opts: { mark: 0 }, with: true },
        { type: "packet", path: ["frontier", "robots"], label: "/drafts/9" },
        { type: "state", node: "robots", light: "on", opts: { open: false } },
        { type: "note", node: "robots", text: "held: Disallow /drafts/", with: true },
        { type: "pause", ms: 500 },
        { type: "state", node: "robots", light: "work", opts: { open: true } },
        { type: "packet", path: ["frontier", "robots", "fetcher", "host"], label: "/posts/7" },
        { type: "state", node: "host", light: "on" },
        { type: "note", node: "host", text: "/posts/7 allowed", tone: "work", with: true },
      ],
    },
    {
      title: "A 5xx on robots.txt means disallow all",
      short: "Rules fail",
      text: "When the cached copy reaches 24 hours, the Fetch workers request robots.txt again and the blog answers 503. The RFC says to assume everything is disallowed after a 5xx, so Robots rules holds every path. After a 4xx, the crawler may proceed.",
      focus: ["robots", "fetcher", "host"],
      frame: ["frontier", "robots", "fetcher", "host"],
      facts: [["After a 4xx", "crawl allowed"], ["After a 5xx", "disallow all"]],
      metrics: { robots: "disallow all" },
      changes: ["+ GET /robots.txt again", "~ 503: every path disallowed"],
      events: [
        { type: "state", node: "frontier", light: "idle", opts: { mark: undefined } },
        { type: "state", node: "host", light: "idle", with: true },
        { type: "packet", path: ["fetcher", "host"], label: "GET /robots.txt" },
        { type: "state", node: "host", light: "hot" },
        { type: "packet", path: ["host", "fetcher", "robots"], label: "503", kind: "hot" },
        { type: "state", node: "robots", light: "hot", opts: { open: false } },
        { type: "note", node: "robots", text: "5xx: assume all disallowed", tone: "hot", with: true },
      ],
    },
    {
      title: "500 workers can flood one small site",
      short: "Host flood",
      text: "The rules load again and work resumes. Most queued URLs belong to the small blog, and the fleet’s only limit is 500 requests at once, so all 500 workers can hit the blog together. A global limit says nothing about how requests spread across hosts.",
      focus: ["frontier", "fetcher", "host"],
      frame: ["frontier", "robots", "fetcher", "host"],
      facts: [["Fleet limit", "500 at once"], ["Per host", "no limit"]],
      metrics: { robots: "allowed", rate: { n: 500, unit: " at once", tone: "hot" } },
      changes: ["~ Rules loaded again", "+ 500 workers on one blog"],
      events: [
        { type: "state", node: "robots", light: "work", opts: { open: true } },
        { type: "state", node: "host", light: "idle", with: true },
        { type: "state", node: "frontier", light: "on", opts: { items: 4 }, with: true },
        { type: "state", node: "fetcher", light: "on" },
        { type: "state", node: "host", light: "hot", tone: "hot", readout: "up to 500 at once", with: true },
        { type: "stream", every: 170, routes: [{ path: ["frontier", "robots", "fetcher", "host"], kind: "hot" }] },
      ],
    },
    {
      title: "A host timer spaces requests 2 s apart",
      short: "Host timer",
      text: "The Host timer tracks the blog’s next-eligible time and its active requests, and the URL frontier schedules only eligible work. The blog is eligible, so /posts/8 goes out; the timer then holds the blog’s next request for 2 seconds.",
      focus: ["frontier", "timer", "fetcher", "host"],
      frame: ["frontier", "timer", "fetcher", "host"],
      facts: [["Per host", "1 request / 2 s"]],
      metrics: { rate: "1 per 2 s" },
      changes: ["− Robots rules (still checked)", "+ Host timer", "+ GET /posts/8", "~ Next request in 2 s"],
      events: [
        // Robots rules sinks away while the URL frontier slides into its place, so the direct link never stands as a
        // long arch over the empty tier; the Host timer arrives beside the frontier.
        { type: "hide", nodes: ["robots"] },
        { type: "show", nodes: ["timer"], at: { frontier: [1, 0] }, with: true },
        { type: "state", node: "host", light: "idle", tone: "", readout: "", with: true },
        { type: "state", node: "fetcher", light: "idle", with: true },
        { type: "state", node: "frontier", opts: { items: 3 }, with: true },
        { type: "state", node: "timer", light: "work", meter: 0, readout: "eligible now" },
        { type: "note", node: "frontier", text: "blog eligible", tone: "work", with: true },
        { type: "packet", path: ["frontier", "fetcher", "host"], label: "/posts/8" },
        { type: "state", node: "host", light: "on", readout: "1 per 2 s" },
        { type: "state", node: "timer", light: "on", meter: 1, readout: "next in 2 s", with: true },
      ],
    },
    {
      title: "A 429 slows one host; others keep going",
      short: "Others move",
      text: "Web host A, the blog, answers 429 Too Many Requests, so the Host timer backs off and the blog waits longer between requests. Slow responses, 503 and Retry-After lower a host’s rate the same way. Meanwhile Web host B, another site, keeps getting requests.",
      focus: ["frontier", "timer", "fetcher", "host", "hostB"],
      frame: ["frontier", "timer", "fetcher", "host", "hostB"],
      facts: [["Slows a host", "429, 503, Retry-After"]],
      metrics: { rate: "backing off" },
      changes: ["+ Web host B", "~ Web host A backs off", "~ Web host B keeps moving"],
      events: [
        { type: "show", nodes: ["hostB"], at: { host: [3, -0.9] } },
        { type: "state", node: "host", label: "Web host A", readout: "", with: true },
        { type: "packet", path: ["host", "fetcher"], label: "429", kind: "hot" },
        { type: "state", node: "host", light: "hot" },
        { type: "note", node: "host", text: "429: slow down", tone: "hot", with: true },
        { type: "state", node: "timer", light: "on", meter: 1, readout: "backing off", with: true },
        { type: "state", node: "frontier", opts: { mark: 1 }, with: true },
        { type: "state", node: "hostB", light: "work", readout: "keeps moving" },
        {
          type: "stream", every: 320, routes: [
            { path: ["frontier", "fetcher", "hostB"], w: 6 },
            { path: ["frontier", "fetcher", "host"], w: 1 },
          ],
        },
      ],
    },
    {
      title: "Politeness costs coverage: 23 days a pass",
      short: "Coverage cost",
      text: "At one request every 2 seconds, a host allows 43,200 fetches a day, so a site with one million URLs takes about 23 days a pass. Crawl-delay is non-standard, so you set the pace. Group hostnames carefully: many small sites can share one server.",
      focus: ["timer", "host"],
      frame: ["frontier", "timer", "fetcher", "host", "hostB"],
      facts: [["1 request / 2 s", "43,200 a day"], ["1 million URLs", "≈ 23 days a pass"], ["Crawl-delay", "ignored by Google"]],
      metrics: { rate: "1 per 2 s", pass: { n: 23, unit: " days" } },
      changes: ["~ 43,200 fetches a day", "+ About 23 days per pass"],
      events: [
        { type: "state", node: "hostB", light: "idle", readout: "" },
        { type: "state", node: "frontier", light: "idle", opts: { mark: undefined }, with: true },
        { type: "state", node: "timer", light: "work", meter: 1, readout: "43,200 a day", with: true },
        { type: "state", node: "host", light: "on", detail: "if 1 million URLs", readout: "≈ 23 days" },
      ],
    },
  ],
};
