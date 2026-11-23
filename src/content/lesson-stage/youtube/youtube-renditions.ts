import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Make one source fit many screens": video 81's one MP4 source (H.264) can't suit every device, so the Transcoder
// encodes a four-rung ladder (240p at 0.4 Mbit/s, 480p at 1.5, 720p at 3, 1080p at 6: 10.9 Mbit/s, about 4.9 GB per
// hour) and cuts each rendition into 6-second segments (600 per rendition per hour), drawn as four strips beside Video
// storage whose offsets are seconds (0:00 to 0:18 shown), listed in a manifest. The boundaries line up, so a Viewer on a
// slowing train whose buffer runs low on 720p takes the next segment, 0:18, from 480p (half the bits) without
// restarting. Then AV1 saves bits but encodes slower, so H.264 stays as the fallback; last, a private video for three
// colleagues needs one MP4 file, not a ladder.
export const youtubeRenditionsStage: StageScene = {
  id: "youtube-renditions",
  intro: "Watch one source become a four-rung ladder of 6-second segments, then see a player step down at a boundary.",
  metrics: [{ id: "rungs", label: "Renditions" }, { id: "stored", label: "Per video hour" }, { id: "playing", label: "Playing" }],
  // The strips lie to the right of Video storage, in lane 0 of the tiers after it; the Manifest and the Viewer stand
  // in front of the Transcoder and Video storage. On a phone: Transcoder | Manifest, then Video storage | Viewer with
  // the strips stacked under that row. The Colleagues take the Viewer's place in the last step.
  nodes: [
    { id: "transcoder", role: "transcoder", label: "Transcoder", detail: "encodes renditions", at: [0, 0], opts: { count: 3 } },
    { id: "manifest", role: "doc", label: "Manifest", detail: "lists segments", at: [0, 1.65], appear: 2 },
    { id: "storage", role: "storage", label: "Video storage", detail: "source + segments", at: [1, 0] },
    { id: "viewer", role: "phone", label: "Viewer", detail: "adaptive player", at: [1, 1.65] },
    { id: "colleagues", role: "phone", label: "3 colleagues", detail: "private video", at: [1, 1.65], appear: 7, opts: { many: true } },
  ],
  links: [
    { from: "storage", to: "transcoder" },
    { from: "transcoder", to: "manifest" },
    { from: "manifest", to: "viewer" },
    { from: "storage", to: "viewer" },
    { from: "storage", to: "colleagues" },
  ],
  // One strip per rendition, top to bottom; an offset is a segment's start in seconds.
  logs: [
    { id: "r1080", node: "storage", label: "1080p", start: 0, step: 6, appear: 2 },
    { id: "r720", node: "storage", label: "720p", start: 0, step: 6, appear: 2 },
    { id: "r480", node: "storage", label: "480p", start: 0, step: 6, appear: 2 },
    { id: "r240", node: "storage", label: "240p", start: 0, step: 6, appear: 2 },
  ],
  steps: [
    {
      title: "One file can’t fit every screen",
      short: "One file",
      text: "Video 81’s source sits in Video storage as one MP4 file. MP4 is a container that packages tracks; H.264 is the codec that compresses the video. Devices differ in the codecs, resolutions and bandwidth they support, so no single file suits them all.",
      focus: ["storage", "viewer"],
      frame: ["transcoder", "storage", "viewer"],
      facts: [["Container", "MP4: packages tracks"], ["Codec", "H.264: compresses"]],
      changes: ["+ v81/source.mp4, one file", "~ Devices differ in codec and speed"],
      events: [
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "source.mp4 · H.264", with: true },
        { type: "note", node: "viewer", text: "codec? speed?" },
      ],
    },
    {
      title: "Encode a ladder of four renditions",
      short: "Ladder",
      text: "The Transcoder encodes four renditions, each a resolution at a bitrate: 240p at 0.4 Mbit/s, 480p at 1.5, 720p at 3, 1080p at 6. They total 10.9 Mbit/s, about 4.9 GB per hour of video. More rungs fit better but cost compute and storage; Netflix tunes its ladder per title.",
      focus: ["storage", "transcoder"],
      frame: ["transcoder", "storage", "viewer"],
      metrics: { rungs: 4, stored: "4.9 GB" },
      facts: [["Ladder", "0.4 · 1.5 · 3 · 6 Mbit/s"], ["Total", "10.9 Mbit/s"]],
      changes: ["+ 4 renditions, 240p to 1080p", "+ 4.9 GB stored per hour of video"],
      events: [
        { type: "state", node: "storage", light: "idle" },
        { type: "packet", path: ["storage", "transcoder"], label: "v81/source.mp4", kind: "response" },
        { type: "state", node: "transcoder", light: "work" },
        { type: "note", node: "transcoder", text: "4 renditions", tone: "work", with: true },
      ],
    },
    {
      title: "Cut each rendition into 6-second segments",
      short: "Segments",
      text: "The Transcoder packages each rendition into independently decodable 6-second segments in Video storage, and publishes a manifest, an index file listing them. Six seconds is Apple’s HLS target: 600 segments per rendition per hour. Very short segments add requests; long ones delay adaptation.",
      focus: ["transcoder", "storage", "manifest"],
      frame: ["transcoder", "manifest", "storage", "viewer"],
      facts: [["Segment", "6 s"], ["Per hour", "600 per rendition"]],
      changes: ["+ 6-second segments in each rendition", "+ v81 manifest"],
      events: [
        { type: "packet", path: ["transcoder", "storage"], label: "v81 segments · 6 s", kind: "work" },
        { type: "append", log: "r1080", records: [{ text: "0:00" }, { text: "0:06" }, { text: "0:12" }, { text: "0:18" }] },
        { type: "append", log: "r720", records: [{ text: "0:00" }, { text: "0:06" }, { text: "0:12" }, { text: "0:18" }], with: true },
        { type: "append", log: "r480", records: [{ text: "0:00" }, { text: "0:06" }, { text: "0:12" }, { text: "0:18" }], with: true },
        { type: "append", log: "r240", records: [{ text: "0:00" }, { text: "0:06" }, { text: "0:12" }, { text: "0:18" }], with: true },
        { type: "show", nodes: ["manifest"] },
        { type: "packet", path: ["transcoder", "manifest"], label: "v81 manifest", kind: "work" },
        { type: "state", node: "manifest", light: "on" },
        { type: "state", node: "transcoder", light: "idle", with: true },
      ],
    },
    {
      title: "Segment boundaries line up",
      short: "Aligned",
      text: "Every rendition breaks at the same times: 0:00, 0:06, 0:12, 0:18. Segment 0:18 starts at the same moment of the video in 240p as in 1080p, so a player can switch renditions at any boundary and carry on from there.",
      focus: ["storage"],
      frame: ["storage", "viewer"],
      facts: [["Boundaries", "every 6 s"], ["Aligned in", "all 4 renditions"]],
      changes: ["~ Boundaries match in all 4 renditions"],
      events: [
        { type: "state", node: "manifest", light: "idle" },
        { type: "cursor", log: "r1080", id: "cut", at: 18, label: "0:18", line: true },
        { type: "cursor", log: "r720", id: "cut", at: 18, line: true, gap: 60 },
        { type: "cursor", log: "r480", id: "cut", at: 18, line: true, gap: 60 },
        { type: "cursor", log: "r240", id: "cut", at: 18, line: true, gap: 60 },
      ],
    },
    {
      title: "On a slow train, the buffer runs low",
      short: "Buffer low",
      text: "The Viewer reads the manifest and plays 720p at 3 Mbit/s. On a train the connection slows, so each 720p segment takes longer to arrive, and the buffer, the seconds of video already downloaded, runs low.",
      focus: ["manifest", "storage", "viewer"],
      frame: ["transcoder", "manifest", "storage", "viewer"],
      metrics: { playing: "720p" },
      facts: [["Playing", "720p at 3 Mbit/s"], ["Buffer", "running low"]],
      changes: ["~ Viewer on a train", "~ Buffer runs low on 720p"],
      events: [
        { type: "state", node: "viewer", detail: "on a train", light: "on", opts: { level: 0.75 } },
        { type: "packet", path: ["manifest", "viewer"], label: "v81 manifest", kind: "response" },
        { type: "read", log: "r720", at: 6, to: "viewer", label: "720p · 0:06" },
        { type: "state", node: "viewer", opts: { level: 0.5 } },
        { type: "read", log: "r720", at: 12, to: "viewer", label: "720p · 0:12" },
        { type: "state", node: "viewer", light: "hot", tone: "hot", opts: { level: 0.25 } },
        { type: "note", node: "viewer", text: "buffer low", tone: "hot", with: true },
      ],
    },
    {
      title: "The player steps down at a boundary",
      short: "Step down",
      text: "To protect its buffer, the Viewer takes the next segment, 0:18, from 480p at 1.5 Mbit/s instead of 720p. The boundaries line up, so playback continues from 0:18 without restarting, and each segment now carries half the bits.",
      focus: ["storage", "viewer"],
      frame: ["transcoder", "manifest", "storage", "viewer"],
      metrics: { playing: "480p" },
      facts: [["Next segment", "0:18"], ["From", "480p at 1.5 Mbit/s"]],
      changes: ["~ 720p 0:18 not fetched", "~ 480p 0:18 plays next"],
      events: [
        { type: "record", log: "r720", at: 18, tone: "quiet" },
        { type: "read", log: "r480", at: 18, to: "viewer", label: "480p · 0:18" },
        { type: "state", node: "viewer", light: "work", tone: "", opts: { level: 0.4 } },
        { type: "note", node: "viewer", text: "now 480p", tone: "work", with: true },
      ],
    },
    {
      title: "Newer codecs save bits; H.264 stays",
      short: "Codecs",
      text: "Newer codecs such as AV1 reach similar quality at lower bitrates, but take longer to encode, and not every device decodes them in hardware. So services keep a widely supported codec, H.264, as a fallback.",
      focus: ["transcoder", "viewer"],
      frame: ["transcoder", "manifest", "storage", "viewer"],
      facts: [["AV1", "fewer bits, slower encode"], ["Fallback", "H.264"]],
      changes: ["~ AV1 where devices decode it", "~ H.264 kept for the rest"],
      events: [
        { type: "state", node: "viewer", detail: "adaptive player", light: "on" },
        { type: "note", node: "transcoder", text: "AV1: fewer bits", with: true },
        { type: "note", node: "viewer", text: "H.264 fallback", with: true },
      ],
    },
    {
      title: "A private video needs one MP4 file",
      short: "One MP4",
      text: "Not every video needs this. A private video shared with three colleagues needs one MP4 file, rather than a ladder of renditions cut into segments to encode and store.",
      focus: ["storage", "colleagues"],
      frame: ["transcoder", "manifest", "storage", "colleagues"],
      // the private video has one file and no ladder, so the chips stop describing video 81's
      metrics: { rungs: 1, stored: "—", playing: "MP4" },
      facts: [["3 colleagues", "one MP4 file"], ["Ladder", "not needed"]],
      changes: ["+ Private video, one MP4 file", "~ No ladder to encode or store"],
      events: [
        { type: "hide", nodes: ["viewer"] },
        { type: "show", nodes: ["colleagues"] },
        { type: "packet", path: ["storage", "colleagues"], label: "private.mp4", kind: "response" },
        { type: "state", node: "colleagues", light: "on" },
        { type: "note", node: "colleagues", text: "one MP4 file", with: true },
      ],
    },
  ],
};
