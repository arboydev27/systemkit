import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Set the video workload": publishing and watching are two jobs, sized from behavior rather than user counts.
// 8 million daily viewers watching three 200 MB videos pull about 4.8 PB a day from the CDN edge, about 440 Gbit/s on
// average and 1.3 Tbit/s at a threefold peak. If 2% of them upload one 400 MB source daily (160,000 uploads), originals
// add about 64 TB a day, 23 PB a year, before renditions, replication and retention. Playback drives egress,
// transcoding compute and uploads storage. Last, a company training library of a few thousand videos buys the whole
// pipeline (Video storage, Transcoder, CDN edge) from a managed service such as Mux. The inputs are the lesson's
// illustrative ones, not current YouTube measurements.
export const youtubeScopeStage: StageScene = {
  id: "youtube-scope",
  intro: "Watch publishing and watching turn into bytes in and bytes out, then see which resource each path strains.",
  metrics: [
    { id: "delivered", label: "Delivered" },
    { id: "peak", label: "Peak egress" },
    { id: "originals", label: "Originals" },
  ],
  // The upload path runs along lane −1, the playback path along lane +1, and storage feeds the edge between them.
  // On a phone the rows read Creators | Viewers, Video storage | CDN edge, Transcoder. In the last step the pipeline
  // sinks away and the Managed service stands alone between the two jobs, at [1, 0]: on a phone, one part under them.
  nodes: [
    { id: "creators", role: "client", label: "Creators", detail: "2% upload daily", at: [0, -1], opts: { many: true } },
    { id: "viewers", role: "crowd", label: "Viewers", detail: "8M a day", at: [0, 1] },
    { id: "storage", role: "storage", label: "Video storage", detail: "originals", at: [1, -1] },
    { id: "edge", role: "cdn", label: "CDN edge", detail: "near viewers", at: [1, 1] },
    { id: "transcoder", role: "transcoder", label: "Transcoder", detail: "encodes renditions", at: [2, -1], appear: 4, opts: { count: 3 } },
    { id: "managed", role: "external", label: "Managed service", detail: "such as Mux", at: [1, 0], appear: 5 },
  ],
  links: [
    { from: "creators", to: "storage" },
    { from: "storage", to: "transcoder" },
    { from: "storage", to: "edge" },
    { from: "edge", to: "viewers" },
    { from: "creators", to: "managed" },
    { from: "managed", to: "viewers" },
  ],
  steps: [
    {
      title: "Two jobs: publish a video, watch it",
      short: "Two jobs",
      text: "Creators upload videos into Video storage, and Viewers play them from the CDN edge. Agree on source size, devices, reach and startup time first. Live video leaves little time for queues and retries, so it is close to a separate design.",
      facts: [["Agree on", "size, devices, reach"], ["Can wait", "comments, recommendations"]],
      changes: ["+ Publishing: Creators upload", "+ Watching: Viewers play"],
      events: [
        { type: "packet", path: ["creators", "storage"], label: "upload a video" },
        { type: "packet", path: ["viewers", "edge"], label: "play a video", with: true },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["edge", "viewers"], label: "segments", kind: "response" },
        { type: "state", node: "edge", light: "work", with: true },
        { type: "note", node: "storage", text: "bytes in" },
        { type: "note", node: "edge", text: "bytes out", with: true },
      ],
    },
    {
      title: "Viewers pull 4.8 PB a day",
      short: "Bytes out",
      text: "Size demand from behavior, not registered users. As an exercise, 8 million daily viewers each watch three 200 MB videos, so the CDN edge delivers about 4.8 PB a day.",
      focus: ["viewers", "edge"],
      frame: ["creators", "viewers", "storage", "edge"],
      facts: [["Viewers", "8 million a day"], ["Each watches", "3 videos × 200 MB"]],
      metrics: { delivered: "4.8 PB/day" },
      changes: ["+ 4.8 PB a day out of the edge", "~ Sized from views, not sign-ups"],
      events: [
        { type: "note", node: "viewers", text: "3 × 200 MB" },
        { type: "state", node: "viewers", light: "on", with: true },
        { type: "stream", every: 260, routes: [{ path: ["edge", "viewers"], kind: "work" }] },
        { type: "state", node: "edge", light: "work", readout: "4.8 PB/day", with: true },
      ],
    },
    {
      title: "Average 440 Gbit/s, peak 1.3 Tbit/s",
      short: "Peak",
      text: "Spread evenly over a day, 4.8 PB is about 440 Gbit/s. At a threefold peak the CDN edge sends 1.3 Tbit/s. These illustrative inputs are not current YouTube measurements: state the peak-to-average ratio and recalculate when an assumption changes.",
      focus: ["viewers", "edge"],
      frame: ["creators", "viewers", "storage", "edge"],
      facts: [["Average", "about 440 Gbit/s"], ["Peak", "3 × average"]],
      metrics: { peak: "1.3 Tbit/s" },
      changes: ["+ About 440 Gbit/s on average", "+ 1.3 Tbit/s at a threefold peak"],
      events: [
        { type: "stream", every: 120, routes: [{ path: ["edge", "viewers"], kind: "work" }] },
        { type: "state", node: "edge", readout: "1.3 Tbit/s", with: true },
        { type: "note", node: "edge", text: "3 × 440 Gbit/s" },
      ],
    },
    {
      title: "Uploads add 64 TB of originals a day",
      short: "Bytes in",
      text: "If 2% of the 8 million upload one 400 MB source daily, Creators send 160,000 uploads and Video storage gains about 64 TB of originals a day, or 23 PB a year, before renditions, replication and retention.",
      focus: ["creators", "storage"],
      frame: ["creators", "viewers", "storage", "edge"],
      facts: [["Uploads", "160,000 a day"], ["Each", "one 400 MB source"], ["A year", "about 23 PB"]],
      metrics: { originals: "64 TB/day" },
      changes: ["+ 64 TB of originals a day, 23 PB a year", "~ Before renditions, replication, retention"],
      events: [
        { type: "note", node: "creators", text: "160,000 × 400 MB" },
        { type: "state", node: "creators", light: "on", with: true },
        { type: "stream", every: 240, routes: [{ path: ["creators", "storage"] }] },
        { type: "state", node: "storage", light: "on", readout: "64 TB/day", with: true },
        { type: "note", node: "storage", text: "originals only" },
      ],
    },
    {
      title: "Each path stresses a different resource",
      short: "Three resources",
      text: "Playback drives egress, the bytes the CDN edge sends to viewers. Transcoding, converting each source into playable formats, drives compute in the Transcoder. Uploads drive storage. The balance varies: Netflix encodes a curated catalog ahead of release, while YouTube absorbs a constant stream of uploads.",
      changes: ["+ Transcoder", "~ Playback drives egress", "~ Transcoding drives compute", "~ Uploads drive storage"],
      events: [
        { type: "show", nodes: ["transcoder"] },
        { type: "state", node: "transcoder", light: "work" },
        {
          type: "stream", every: 200, routes: [
            { path: ["creators", "storage"], w: 1 },
            { path: ["storage", "transcoder"], w: 1, kind: "work" },
            { path: ["edge", "viewers"], w: 2, kind: "work" },
          ],
        },
        { type: "note", node: "edge", text: "egress" },
        { type: "note", node: "transcoder", text: "compute", with: true },
        { type: "note", node: "storage", text: "storage", with: true },
      ],
    },
    {
      title: "A small library can buy the pipeline",
      short: "Buy it",
      text: "Not every video feature needs this pipeline. A company training library with a few thousand videos can buy it from a managed service such as Mux, in place of Video storage, the Transcoder and the CDN edge, and spend its effort elsewhere.",
      // On a phone, frame the three parts that stay, so the camera closes in while the pipeline leaves, not at the end.
      frame: ["creators", "viewers", "managed"],
      facts: [["Library", "a few thousand videos"], ["Bought from", "a managed service"]],
      // The big workload's numbers don't describe a small library: clear them.
      metrics: { delivered: "—", peak: "—", originals: "—" },
      changes: ["+ Managed service such as Mux", "− Video storage, Transcoder, CDN edge", "~ A few thousand videos skip the build"],
      events: [
        { type: "hide", nodes: ["storage", "edge", "transcoder"] },
        { type: "state", nodes: ["creators", "viewers"], light: "idle", with: true },
        { type: "state", node: "creators", detail: "training videos", with: true },
        { type: "state", node: "viewers", detail: "employees", with: true },
        { type: "show", nodes: ["managed"] },
        { type: "packet", path: ["creators", "managed"], label: "upload a video" },
        { type: "packet", path: ["viewers", "managed"], label: "play a video", with: true },
        { type: "packet", path: ["managed", "viewers"], label: "segments", kind: "response" },
        { type: "state", node: "managed", light: "work", with: true },
        { type: "note", node: "managed", text: "a few thousand videos" },
      ],
    },
  ],
};
