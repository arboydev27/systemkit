import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Plan for failure and removal": two casts on one floor. First the creator path (Creator → Task queue) beside
// the viewer path (Viewer → CDN edge): retries are bounded and a bad source fails clearly, while new uploads become
// ready in about 12 min (example). The queue stalls and pending-video age climbs to 3 h (example; "hours" in the lesson)
// while video 81 keeps playing with rebuffering steady, so one "service healthy" signal hides it; Monitoring with each
// path measured apart puts the fault on the creator path. Then a takedown of video 81: its status changes to blocked,
// the Watch API stops returning a manifest (403), a CDN purge clears v81/* at the edge, a viewer already playing holds a
// URL signed for five minutes that the edge accepts but Video storage, the origin, refuses, and once it expires the edge
// refuses it too. Last, DRM licenses (Widevine, FairPlay) restrict players and a watermark traces a leak.
// The new upload in the first cast is left unnamed: video 81 is the popular video already playing that is taken down.
// Notes on the parts at a phone's edge columns are kept short (about 16 characters) so they aren't cut off, and in the
// URL step only the expired request is a lost message: a note over the edge would hide its ×, so a note over the Viewer
// says the URL expired, and the accepted request rides on through the edge to Video storage, whose note refuses it.
// The Watch API and the Metadata DB leave once the row is blocked (step 5): the rest of the takedown is the edge, the
// origin and URLs already issued, and keeping them on would push a small phone's camera out past its label floor. For
// the same reason the URL step uses notes, not a load pill: on a phone a pill adds room between every row.
// The takedown stays ink and quiet, the purge included (chapter plan); the status chip clears for the DRM step, which
// is about any protected video, not video 81.
export const youtubeOperationsStage: StageScene = {
  id: "youtube-operations",
  intro: "Watch a stalled queue hide behind healthy playback, then follow a takedown through the API, the edge and URLs already issued.",
  metrics: [{ id: "pending", label: "Pending age" }, { id: "rebuffer", label: "Rebuffering" }, { id: "status", label: "Video status" }],
  nodes: [
    { id: "creator", role: "client", label: "Creator", detail: "uploads a video", at: [0, -1] },
    { id: "license", role: "web", label: "License server", detail: "DRM licenses", at: [0, -1], appear: 6 },
    { id: "viewer", role: "phone", label: "Viewer", detail: "adaptive player", at: [0, 1], opts: { level: 1 } },
    { id: "queue", role: "queue", label: "Task queue", detail: "keys + job IDs", at: [1, -1], opts: { items: 1 } },
    { id: "api", role: "web", label: "Watch API", detail: "metadata + access", at: [1, -1], appear: 3 },
    { id: "edge", role: "cdn", label: "CDN edge", detail: "near viewers", at: [1, 1] },
    { id: "monitor", role: "monitor", label: "Monitoring", detail: "both paths", at: [2, 0], appear: 1 },
    { id: "db", role: "database", label: "Metadata DB", detail: "video rows", at: [2, -1], appear: 3 },
    { id: "storage", role: "storage", label: "Video storage", detail: "origin", at: [2, 1], appear: 4 },
  ],
  links: [
    { from: "creator", to: "queue" },
    { from: "viewer", to: "edge" },
    { from: "queue", to: "monitor" },
    { from: "edge", to: "monitor" },
    { from: "viewer", to: "api" },
    { from: "api", to: "db" },
    { from: "edge", to: "storage" },
    { from: "viewer", to: "license" },
  ],
  steps: [
    {
      title: "Retry what recovers; fail what can’t",
      short: "Recover",
      text: "A dropped upload or a crashed worker resumes or retries, with bounds; a bad source format fails with a clear error. Replicate durable objects and metadata against the availability target, and test restores. Here a new upload waits about 12 minutes to become ready, an example figure.",
      focus: ["creator", "queue"],
      frame: ["creator", "viewer", "queue", "edge"],
      facts: [["Recoverable", "retry, bounded"], ["Bad source", "fail clearly"], ["Durable data", "replicate, test restores"]],
      metrics: { pending: { n: 12, unit: " min" }, rebuffer: "steady" },
      changes: ["+ New upload queued", "~ Retries are bounded", "~ A bad source fails clearly"],
      events: [
        { type: "packet", path: ["creator", "queue"], label: "new upload" },
        { type: "state", node: "queue", light: "on" },
        { type: "note", node: "queue", text: "retry · bounded", with: true },
        { type: "note", node: "creator", text: "bad source fails" },
      ],
    },
    {
      title: "A stalled queue hides behind playback",
      short: "Stall",
      text: "The task queue stalls, so new uploads wait hours to become ready: 3 in this example. Video 81 and other existing videos keep playing from the CDN edge with rebuffering steady, so a single “service healthy” signal would still pass and hide the stall.",
      frame: ["creator", "viewer", "queue", "edge", "monitor"],
      metrics: { pending: { n: 3, unit: " h", tone: "hot" }, rebuffer: "steady" },
      changes: ["~ Task queue stalls", "~ Pending age: 12 min → 3 h", "~ Playback unchanged"],
      events: [
        { type: "state", node: "queue", light: "hot", tone: "hot", opts: { items: 4 } },
        { type: "state", node: "creator", detail: "waits for ready", with: true },
        { type: "note", node: "queue", text: "stalled", tone: "hot", with: true },
        {
          type: "stream", every: 260, routes: [
            { path: ["creator", "queue"], w: 1 },
            { path: ["edge", "viewer"], w: 2, kind: "response" },
          ],
        },
        { type: "show", nodes: ["monitor"] },
        { type: "state", node: "monitor", light: "on", detail: "one health check" },
        { type: "note", node: "monitor", text: "one signal: “healthy”", with: true },
      ],
    },
    {
      title: "Measure creator and viewer paths apart",
      short: "Two paths",
      text: "Creator path: upload completion, pending-video age, queue lag, transcode failure. Viewer path: CDN hit rate, time to first frame, rebuffering, egress. Pending age at 3 hours with rebuffering steady points to the creator path. Trace one video ID through publication and one session through playback.",
      focus: ["queue", "edge", "monitor"],
      frame: ["creator", "viewer", "queue", "edge", "monitor"],
      facts: [["Creator path", "pending age, queue lag"], ["Viewer path", "first frame, rebuffering"]],
      changes: ["+ Creator-path measures", "+ Viewer-path measures", "~ Fault on the creator path"],
      events: [
        { type: "state", node: "monitor", detail: "both paths" },
        { type: "packet", path: ["queue", "monitor"], label: "pending age 3 h", kind: "hot" },
        { type: "packet", path: ["edge", "monitor"], label: "rebuffering steady", kind: "quiet", with: true },
        { type: "state", node: "monitor", light: "hot" },
        { type: "note", node: "monitor", text: "problem: creator path", tone: "hot", with: true },
      ],
    },
    {
      title: "Blocked: the Watch API stops the manifest",
      short: "Blocked",
      text: "A takedown starts in policy: video 81’s status changes to blocked in the Metadata DB. The Watch API reads it, stops returning a manifest and answers 403. Rights work can grow large: YouTube’s Content ID matches uploads against reference files from rights holders.",
      focus: ["viewer", "api", "db"],
      frame: ["viewer", "api", "edge", "db"],
      facts: [["Status", "blocked"], ["Watch API", "no manifest"]],
      metrics: { pending: "—", rebuffer: "—", status: "blocked" },
      changes: ["~ Video 81’s status: blocked", "~ Watch API returns no manifest", "+ 403 for new requests"],
      events: [
        { type: "hide", nodes: ["creator", "queue", "monitor"] },
        { type: "show", nodes: ["api", "db"] },
        { type: "state", node: "edge", light: "idle", with: true },
        { type: "state", node: "db", light: "on" },
        { type: "note", node: "db", text: "status → blocked", with: true },
        { type: "packet", path: ["viewer", "api"], label: "GET /watch/v81" },
        { type: "state", node: "api", light: "on" },
        // one message per hop, so the reduced-motion still keeps every pill clear
        { type: "packet", path: ["api", "db"], label: "read v81 row" },
        { type: "packet", path: ["api", "viewer"], label: "403 · blocked", kind: "quiet" },
        { type: "note", node: "api", text: "403 · no manifest", with: true },
      ],
    },
    {
      title: "Purge the copies at the edge",
      short: "Purge",
      text: "Blocking the row stops new manifests, but the CDN edge still holds copies of video 81’s segments. A CDN purge clears them by path or tag, here v81/*, so anything the edge serves next must come from Video storage, the origin.",
      focus: ["edge", "storage"],
      frame: ["viewer", "edge", "storage"],
      facts: [["Purge", "v81/*"], ["By", "path or tag"]],
      changes: ["+ Video storage, the origin", "~ v81 segments purged from the edge"],
      events: [
        { type: "hide", nodes: ["api", "db"] },
        { type: "show", nodes: ["storage"] },
        { type: "state", node: "edge", light: "on", readout: "v81 cached" },
        { type: "pause", ms: 700 },
        // one pill at the end: the copies were there, now they are gone
        { type: "state", node: "edge", readout: "" },
        { type: "note", node: "edge", text: "v81/* purged", with: true },
      ],
    },
    {
      title: "Issued URLs expire within 5 minutes",
      short: "URL expiry",
      text: "A viewer already playing holds a URL signed for five minutes. The edge accepts it but misses after the purge, and Video storage, the origin, refuses the blocked video. Once five minutes pass, the edge refuses the expired URL itself. Short signatures bound how long issued access lasts.",
      focus: ["viewer", "edge", "storage"],
      frame: ["viewer", "edge", "storage"],
      facts: [["URL signed for", "5 min"], ["Origin", "refuses v81"], ["After 5 min", "edge refuses"]],
      changes: ["~ Valid URL, but origin refuses v81", "~ Access ends when the URL expires"],
      events: [
        { type: "state", node: "edge", light: "idle" },
        { type: "state", node: "viewer", detail: "already playing", with: true },
        // the edge accepts the signed URL, misses, and goes on to the origin: one message, so the Viewer–edge hop is
        // left to the expired request's × in the still
        { type: "packet", path: ["viewer", "edge", "storage"], label: "720p · 1:12" },
        { type: "state", node: "edge", light: "on" },
        { type: "note", node: "storage", text: "refuses blocked v81", with: true },
        { type: "pause", ms: 600 },
        // five minutes on: the URL itself is refused at the edge, and its × stays in the still
        { type: "note", node: "viewer", text: "URL expired" },
        { type: "packet", path: ["viewer", "edge"], label: "720p · 1:12 · expired", kind: "quiet", lost: true, with: true },
      ],
    },
    {
      title: "DRM limits players; watermarks trace",
      short: "DRM",
      text: "DRM, encryption and watermarking are different controls. DRM restricts playback to licensed players through systems such as Widevine and FairPlay; a watermark marks a copy so a leak can be traced. DRM adds license servers and per-platform packaging, so a free lecture site would skip it.",
      focus: ["viewer", "license"],
      frame: ["license", "viewer", "edge", "storage"],
      facts: [["DRM", "licensed players only"], ["Watermark", "traces a leak"]],
      metrics: { status: "—" },
      changes: ["+ License server", "+ DRM license", "+ Watermark on the copy"],
      events: [
        { type: "show", nodes: ["license"] },
        { type: "state", node: "edge", light: "idle", with: true },
        { type: "state", node: "viewer", detail: "licensed player", with: true },
        { type: "packet", path: ["viewer", "license"], label: "license request" },
        { type: "state", node: "license", light: "on" },
        { type: "note", node: "license", text: "Widevine · FairPlay", with: true },
        { type: "packet", path: ["license", "viewer"], label: "license", kind: "response" },
        { type: "state", node: "license", light: "work" },
        { type: "state", node: "viewer", light: "work", with: true },
        { type: "note", node: "viewer", text: "watermarked copy", with: true },
      ],
    },
  ],
};
