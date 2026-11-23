import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Deliver segments near the viewer": the Watch API checks who may watch video 81 and returns a signed manifest
// URL, carrying no video bytes. The player asks a nearby CDN edge for 720p 0:00, a miss that the edge fills from Video
// storage (the origin) and keeps. A 6-second 720p segment at 3 Mbit/s is 18 megabits: on a 5 Mbit/s link it downloads
// in 3.6 s, so each adds 2.4 s and the buffer holds 12 s (the example's target). At 2 Mbit/s it takes 9 s, so each costs
// 3 s and the 12 s buffer empties after four segments (0:24 to 0:42). Replayed from 12 s, the player takes 0:24 at 720p
// (9 s left), then steps down to 480p (1.5 Mbit/s on the chapter's ladder: 9 megabits, 4.5 s, +1.5 s each), back to
// 10.5 s and 12 s. A launch crowd of 5,000 viewers (example; "thousands" in the lesson) asking one edge for one uncached
// segment costs one origin fetch through an Origin shield. Last, the edge checks a signed URL itself, and Video storage,
// not the edge, is the durable home. The buffer is the Viewer's level bar (buffer ÷ 12 s).
// Control path on lane −1 (Viewer → Watch API), media path on lane +1 (Viewer → CDN edge → Video storage).
// The Viewer stands at lane −0.7, not 0 (the Viewers at 1.4 keep the pair's spacing): on a wide screen the longer hops
// give the messages resting in the reduced-motion stills room to clear the Watch API's tag (step 1) and each other
// (step 4); on a phone a lane only moves a part along its row, so the names keep their size.
export const youtubePlaybackStage: StageScene = {
  id: "youtube-playback",
  intro: "Watch a player fetch segments from a nearby edge, then keep its buffer full as the connection slows.",
  metrics: [{ id: "link", label: "Link" }, { id: "buffer", label: "Buffer" }, { id: "playing", label: "Playing" }],
  nodes: [
    { id: "viewer", role: "phone", label: "Viewer", detail: "adaptive player", at: [0, -0.7] },
    { id: "crowd", role: "crowd", label: "Viewers", detail: "launch crowd", at: [0, 1.4], appear: 5 },
    { id: "api", role: "web", label: "Watch API", detail: "metadata + access", at: [1, -1] },
    { id: "edge", role: "cdn", label: "CDN edge", detail: "near viewers", at: [1, 1] },
    { id: "shield", role: "cdn", label: "Origin shield", detail: "extra cache layer", at: [2, 1], appear: 5 },
    { id: "storage", role: "storage", label: "Video storage", detail: "origin", at: [2, 1] },
  ],
  links: [
    { from: "viewer", to: "api" },
    { from: "viewer", to: "edge" },
    { from: "crowd", to: "edge" },
    { from: "edge", to: "storage", unless: "shield" },
    { from: "edge", to: "shield" },
    { from: "shield", to: "storage" },
  ],
  steps: [
    {
      title: "The API decides who may watch",
      short: "Authorize",
      text: "The Viewer’s watch page asks the Watch API for video 81. The API checks who may watch and returns metadata and a signed manifest URL, where the player finds its index of short segments. Media bytes take another path.",
      focus: ["viewer", "api"],
      frame: ["viewer", "api", "edge", "storage"],
      facts: [["Control path", "Watch API"], ["Media path", "CDN edge"]],
      changes: ["+ GET /watch/v81", "+ Signed manifest URL"],
      events: [
        { type: "packet", path: ["viewer", "api"], label: "GET /watch/v81" },
        { type: "state", node: "api", light: "on" },
        { type: "note", node: "api", text: "checks access", with: true },
        { type: "packet", path: ["api", "viewer"], label: "signed URL", kind: "response" },
        { type: "state", node: "api", light: "work" },
        { type: "state", node: "viewer", light: "on", with: true },
      ],
    },
    {
      title: "A miss at the edge fills from origin",
      short: "Edge miss",
      text: "The player asks the nearby CDN edge for its first segment, 720p 0:00. It’s a miss, so the edge fetches it from Video storage, the origin, keeps a copy for later viewers and passes it on. No video bytes pass through the Watch API.",
      focus: ["viewer", "edge", "storage"],
      frame: ["viewer", "api", "edge", "storage"],
      metrics: { buffer: { n: 6, unit: " s" }, playing: "720p" },
      facts: [["Edge", "miss, then cached"], ["Origin", "Video storage"]],
      changes: ["+ 720p 0:00 cached at the edge", "~ Buffer holds 6 s"],
      events: [
        { type: "state", node: "api", light: "idle" },
        { type: "packet", path: ["viewer", "edge"], label: "720p · 0:00" },
        { type: "state", node: "edge", light: "on" },
        { type: "packet", path: ["edge", "storage"], label: "720p · 0:00" },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["storage", "edge"], label: "720p · 0:00", kind: "response" },
        { type: "state", node: "edge", light: "work" },
        { type: "note", node: "edge", text: "miss · now cached", tone: "work", with: true },
        { type: "packet", path: ["edge", "viewer"], label: "720p · 0:00", kind: "response" },
        { type: "state", node: "viewer", light: "work", opts: { level: 0.5 } },
        { type: "note", node: "api", text: "no video bytes", with: true },
      ],
    },
    {
      title: "At 5 Mbit/s the buffer grows",
      short: "Buffer grows",
      text: "A 6-second 720p segment at 3 Mbit/s is 18 megabits. On a 5 Mbit/s link it downloads in 3.6 seconds, less than the 6 seconds it plays, so each segment adds 2.4 seconds until the buffer holds 12.",
      focus: ["viewer", "edge"],
      frame: ["viewer", "api", "edge", "storage"],
      metrics: { link: { n: 5, unit: " Mbit/s" }, buffer: { n: 12, unit: " s" }, playing: "720p" },
      facts: [["720p segment", "18 megabits"], ["At 5 Mbit/s", "3.6 s to download"]],
      changes: ["+ 2.4 s of buffer per segment", "~ Buffer full at 12 s"],
      events: [
        { type: "state", nodes: ["storage"], light: "idle" },
        { type: "stream", every: 650, routes: [{ path: ["edge", "viewer"], kind: "response" }] },
        { type: "pause", ms: 700 },
        { type: "state", node: "viewer", opts: { level: 0.75 } },
        { type: "pause", ms: 900 },
        { type: "state", node: "viewer", opts: { level: 1 } },
        { type: "note", node: "viewer", text: "+2.4 s per segment", tone: "work", with: true },
      ],
    },
    {
      title: "At 2 Mbit/s each segment costs 3 s",
      short: "Link drops",
      text: "The link drops to 2 Mbit/s. The same 18-megabit segment now takes 9 seconds to download but plays for 6, so each one costs 3 seconds of buffer: 12, 9, 6, 3, then 0. Unless the player steps down, playback stalls.",
      focus: ["viewer", "edge"],
      frame: ["viewer", "api", "edge", "storage"],
      metrics: { link: { n: 2, unit: " Mbit/s" }, buffer: { n: 0, unit: " s", tone: "hot" } },
      facts: [["At 2 Mbit/s", "9 s per segment"], ["Each costs", "3 s of buffer"], ["12 s lasts", "4 segments"]],
      changes: ["~ Link drops to 2 Mbit/s", "− 3 s of buffer per segment", "− Buffer empty after 4 segments"],
      events: [
        { type: "state", node: "viewer", light: "on" },
        // Only the last segment is named: at rest (reduced motion) all four messages lie on the one hop, and four
        // labelled pills would cover each other. The level, the note, the chip and the text carry the count.
        { type: "packet", path: ["edge", "viewer"], label: "", kind: "response" },
        { type: "state", node: "viewer", opts: { level: 0.75 }, with: true },
        { type: "packet", path: ["edge", "viewer"], label: "", kind: "response", gap: 200 },
        { type: "state", node: "viewer", opts: { level: 0.5 }, with: true },
        { type: "packet", path: ["edge", "viewer"], label: "", kind: "response", gap: 200 },
        { type: "state", node: "viewer", light: "hot", tone: "hot", opts: { level: 0.25 }, with: true },
        { type: "packet", path: ["edge", "viewer"], label: "720p · 0:42", kind: "response", gap: 200 },
        { type: "state", node: "viewer", opts: { level: 0 }, with: true },
        { type: "note", node: "viewer", text: "buffer empty · stalls", tone: "hot" },
      ],
    },
    {
      title: "Stepping down to 480p refills the buffer",
      short: "Step down",
      text: "Replay from 12 seconds. Segment 0:24 at 720p leaves 9, so the player steps down to 480p at 1.5 Mbit/s: 9 megabits, 4.5 seconds at 2 Mbit/s. Each segment adds 1.5 seconds, back to 12. Stepping up too early risks rebuffering.",
      focus: ["viewer", "edge"],
      frame: ["viewer", "api", "edge", "storage"],
      metrics: { buffer: { n: 12, unit: " s" }, playing: "480p" },
      facts: [["480p segment", "9 megabits"], ["At 2 Mbit/s", "4.5 s, +1.5 s each"]],
      changes: ["~ 720p → 480p after 0:24", "+ 1.5 s of buffer per segment", "~ Buffer back to 12 s"],
      events: [
        { type: "state", node: "viewer", light: "on", tone: "", opts: { level: 1 } },
        { type: "packet", path: ["edge", "viewer"], label: "720p · 0:24", kind: "response" },
        { type: "state", node: "viewer", opts: { level: 0.75 }, with: true },
        { type: "packet", path: ["edge", "viewer"], label: "480p · 0:30", kind: "response", gap: 200 },
        { type: "state", node: "viewer", opts: { level: 0.875 }, with: true },
        { type: "packet", path: ["edge", "viewer"], label: "480p · 0:36", kind: "response", gap: 200 },
        { type: "state", node: "viewer", light: "work", opts: { level: 1 }, with: true },
        { type: "note", node: "viewer", text: "480p · +1.5 s each", tone: "work" },
      ],
    },
    {
      title: "A launch crowd causes one origin fetch",
      short: "Launch crowd",
      text: "At a launch, 5,000 viewers ask one edge for the same uncached segment. Request collapsing makes one origin fetch and shares the result with all of them. An extra cache layer, such as CloudFront Origin Shield, cuts origin load further.",
      focus: ["crowd", "edge", "shield", "storage"],
      frame: ["viewer", "crowd", "edge", "shield", "storage"],
      facts: [["Requests", "5,000 at once"], ["Origin fetches", "1"]],
      changes: ["+ Launch crowd", "+ Origin shield", "~ 5,000 misses, 1 origin fetch"],
      events: [
        { type: "hide", nodes: ["api"] },
        { type: "show", nodes: ["crowd", "shield"], at: { storage: [3, 1] } },
        { type: "state", nodes: ["viewer", "edge", "storage"], light: "idle", with: true },
        { type: "stream", every: 180, routes: [{ path: ["crowd", "edge"] }] },
        { type: "state", node: "edge", light: "on" },
        { type: "note", node: "edge", text: "5,000 requests · 1 fetch", with: true },
        { type: "packet", path: ["edge", "shield", "storage"], label: "launch · 720p · 0:00" },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["storage", "shield", "edge"], label: "", kind: "response" },
        { type: "state", nodes: ["shield", "edge"], light: "work" },
        { type: "stream", every: 180, routes: [{ path: ["crowd", "edge"], w: 1 }, { path: ["edge", "crowd"], w: 2, kind: "response" }] },
      ],
    },
    {
      title: "Signed URLs; the edge is not the home",
      short: "Signed URLs",
      text: "The CDN edge checks the signed URL itself, with no Watch API call per segment. Edges hold copies; Video storage is the durable home, so takedowns may need a cache purge or short expiry. A low-traffic internal site may not need a CDN at all.",
      focus: ["viewer", "edge", "storage"],
      frame: ["viewer", "api", "edge", "storage"],
      facts: [["Per segment", "no API call"], ["Takedown", "purge or short expiry"]],
      changes: ["− Launch crowd, Origin shield", "~ Edge checks the signature", "~ Video storage keeps the copy"],
      events: [
        // The shield isn't this step's point: without it the stage frames four parts again, as in steps 1–5, so the
        // messages have room on a wide screen and the names keep their size on a phone.
        { type: "hide", nodes: ["crowd", "shield"] },
        { type: "show", nodes: ["api"], at: { storage: [2, 1] } },
        { type: "state", nodes: ["edge", "storage"], light: "idle", with: true },
        { type: "packet", path: ["viewer", "edge"], label: "480p · 0:42 · signed" },
        { type: "state", node: "edge", light: "work" },
        { type: "note", node: "edge", text: "checks signature", tone: "work", with: true },
        { type: "packet", path: ["edge", "viewer"], label: "", kind: "response" },
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "durable home", with: true },
      ],
    },
  ],
};
