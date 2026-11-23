import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Spend capacity where demand is": a 10-minute view at 3 Mbit/s delivers 225 MB, so one million views of a
// title deliver 225 TB, $6,750 at an illustrative $0.03 per GB. A hot title is cached at the CDN edge and its repeat
// views are hits; a cold title waits at origin (Video storage) with fewer renditions, so its request misses and starts
// later. When a cold title goes viral, on-demand encoding meets the burst and viewers wait, so Monitoring watches views
// per title and promotes a rising one to the full ladder, cached at the edge. Cutting the title from 3 to 2.4 Mbit/s
// saves 20% of egress: 45 TB of 1 million views (180 TB, $5,400), but only 9 GB of 200 views (45 GB, $1.35, becomes
// 36 GB, $1.08). Few companies need a private CDN like Netflix's Open Connect; most compare commercial CDNs on measured
// results.
export const youtubeCostStage: StageScene = {
  id: "youtube-cost",
  intro: "Price one million views, then see where caching, cold storage and bitrate change the bill.",
  metrics: [
    { id: "delivered", label: "Delivered" },
    { id: "bill", label: "Egress bill" },
    { id: "bitrate", label: "Bitrate" },
  ],
  // The delivery path runs straight along lane 0: Viewers, CDN edge, Video storage (the origin), Transcoder, so the edge's
  // pill and notes have room before storage. Monitoring stands in front of storage, between the edge it reads and the
  // Transcoder it promotes; it never carries a note, which would land on those two tags on a wide screen, so its
  // reading in the last step is a pill. On a phone the rows read Viewers; CDN edge; Video storage | Monitoring;
  // Transcoder (a lane further out bends the phone's cables round in loops).
  nodes: [
    { id: "viewers", role: "crowd", label: "Viewers", detail: "1M views", at: [0, 0] },
    { id: "edge", role: "cdn", label: "CDN edge", detail: "near viewers", at: [1, 0] },
    { id: "storage", role: "storage", label: "Video storage", detail: "origin", at: [2, 0] },
    { id: "monitor", role: "monitor", label: "Monitoring", detail: "views per title", at: [2, 1.5], appear: 4 },
    { id: "transcoder", role: "transcoder", label: "Transcoder", detail: "encodes renditions", at: [3, 0], appear: 2, opts: { count: 1 } },
  ],
  links: [
    { from: "viewers", to: "edge" },
    { from: "edge", to: "storage" },
    { from: "storage", to: "transcoder" },
    { from: "edge", to: "monitor" },
    { from: "monitor", to: "transcoder" },
  ],
  steps: [
    {
      title: "Delivered bytes drive the bill",
      short: "Egress",
      text: "Delivered bytes can dominate video cost. Estimate egress, the data sent out of your network, from watched minutes and bitrate. A 10-minute view at 3 Mbit/s delivers 225 MB, so one million views deliver 225 TB: $6,750 at an illustrative $0.03 per GB. Prices change, so compare measured bills.",
      focus: ["viewers", "edge"],
      frame: ["viewers", "edge", "storage"],
      facts: [["One view", "10 min at 3 Mbit/s"], ["Delivers", "225 MB"], ["Price", "$0.03/GB, illustrative"]],
      metrics: { delivered: { n: 225, unit: " TB" }, bill: "$6,750", bitrate: "3 Mbit/s" },
      changes: ["+ 225 MB per view", "+ 225 TB for 1 million views", "+ $6,750 at $0.03 per GB"],
      events: [
        { type: "note", node: "viewers", text: "10 min at 3 Mbit/s" },
        { type: "state", node: "viewers", light: "on", with: true },
        { type: "stream", every: 220, routes: [{ path: ["edge", "viewers"], kind: "work" }] },
        { type: "state", node: "edge", light: "work", readout: "225 TB", with: true },
      ],
    },
    {
      title: "Hot titles stay at the edge",
      short: "Hot titles",
      text: "A hot title, one getting heavy traffic, is cached at the CDN edge and placed broadly. Repeat views are hits served near viewers, and Video storage, the origin, isn’t asked again.",
      focus: ["viewers", "edge"],
      frame: ["viewers", "edge", "storage"],
      changes: ["+ Hot title cached at the edge", "~ Repeat views are hits"],
      events: [
        { type: "state", node: "edge", readout: "" },
        { type: "packet", path: ["viewers", "edge"], label: "hot title" },
        { type: "note", node: "edge", text: "hit · cached widely", tone: "work" },
        { type: "packet", path: ["edge", "viewers"], label: "segments", kind: "response" },
        { type: "note", node: "storage", text: "not asked", with: true },
        { type: "stream", every: 220, routes: [{ path: ["edge", "viewers"], kind: "work" }] },
      ],
    },
    {
      title: "Cold titles wait at origin",
      short: "Cold titles",
      text: "A cold title may stay at origin with fewer precomputed renditions, which saves encoding and storage. Its request misses the edge and travels to Video storage and back, so playback starts later.",
      frame: ["viewers", "edge", "storage", "transcoder"],
      changes: ["+ Fewer renditions for cold titles", "~ Edge miss, fetched from origin", "~ Slower start"],
      events: [
        { type: "show", nodes: ["transcoder"] },
        { type: "note", node: "transcoder", text: "fewer renditions" },
        { type: "packet", path: ["viewers", "edge"], label: "cold title" },
        { type: "note", node: "edge", text: "miss" },
        { type: "packet", path: ["edge", "storage"], label: "fetch from origin" },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["storage", "edge", "viewers"], label: "segments", kind: "response" },
        { type: "note", node: "viewers", text: "slower start" },
      ],
    },
    {
      title: "A cold title goes viral",
      short: "Goes viral",
      text: "A cold title can go viral. Every new viewer misses the edge while the Transcoder encodes renditions on demand, so playback waits and encoding runs flat out. The savings on a cold title turn into startup delay.",
      frame: ["viewers", "edge", "storage", "transcoder"],
      changes: ["~ A cold title goes viral", "+ Encoding on demand under a burst", "+ Viewers wait to start"],
      events: [
        { type: "stream", every: 200, routes: [{ path: ["viewers", "edge", "storage", "transcoder"], kind: "hot" }] },
        { type: "state", node: "transcoder", light: "hot", tone: "hot" },
        { type: "note", node: "transcoder", text: "encoding on demand", tone: "hot", with: true },
        { type: "note", node: "viewers", text: "waiting to start", tone: "hot", with: true },
      ],
    },
    {
      title: "Promote a title as demand rises",
      short: "Promote",
      text: "Monitoring watches views per title. As this title’s views rise, Monitoring promotes it: the Transcoder encodes the full ladder and the edge caches it, so new viewers start fast. Bounded ladders, storage lifecycle rules and cache policies keep promotion from becoming waste.",
      focus: ["edge", "storage", "monitor", "transcoder"],
      frame: ["viewers", "edge", "storage", "monitor", "transcoder"],
      changes: ["+ Monitoring, views per title", "~ Title promoted to the full ladder", "+ Cached at the edge"],
      events: [
        { type: "show", nodes: ["monitor"] },
        { type: "packet", path: ["edge", "monitor"], label: "views rising" },
        { type: "state", node: "monitor", light: "on" },
        { type: "packet", path: ["monitor", "transcoder"], label: "promote title" },
        { type: "state", node: "transcoder", light: "work", tone: "", opts: { count: 3 } },
        { type: "note", node: "transcoder", text: "full ladder", tone: "work", with: true },
        { type: "packet", path: ["transcoder", "storage", "edge"], label: "renditions", kind: "work" },
        { type: "note", node: "edge", text: "cached at the edge", tone: "work" },
        { type: "stream", every: 220, routes: [{ path: ["edge", "viewers"], kind: "work" }], with: true },
      ],
    },
    {
      title: "A lower bitrate saves on every view",
      short: "Bitrate",
      text: "Encoding is paid once; bitrate savings repeat on every view. Cutting this title from 3 to 2.4 Mbit/s at equal quality saves 20% of egress, 45 TB over 1 million views, so slower encoding pays off. Choose 200 views: the cut saves 9 GB, and the trade can go the other way.",
      focus: ["viewers", "edge", "transcoder"],
      frame: ["viewers", "edge", "storage", "monitor", "transcoder"],
      facts: [["Bitrate", "3 → 2.4 Mbit/s"], ["Egress", "20% less per view"]],
      changes: ["~ 3 → 2.4 Mbit/s at equal quality", "+ A slower encode, paid once", "− 20% of egress on every view"],
      events: [
        { type: "state", node: "monitor", light: "idle" },
        { type: "state", node: "transcoder", light: "work", readout: "2.4 Mbit/s", with: true },
        { type: "note", node: "transcoder", text: "slower encode, paid once", tone: "work", with: true },
      ],
      control: {
        label: "Views",
        options: [
          {
            label: "1 million",
            metrics: { delivered: { n: 180, unit: " TB" }, bill: "$5,400", bitrate: "2.4 Mbit/s" },
            events: [
              { type: "state", node: "viewers", detail: "1M views" },
              { type: "state", node: "edge", light: "work", readout: "180 TB", with: true },
              { type: "note", node: "edge", text: "saves 45 TB", tone: "work", with: true },
              { type: "stream", every: 220, routes: [{ path: ["edge", "viewers"], kind: "work" }] },
            ],
          },
          {
            label: "200",
            metrics: { delivered: "36 GB", bill: "$1.08", bitrate: "2.4 Mbit/s" },
            events: [
              { type: "state", node: "viewers", detail: "200 views" },
              { type: "state", node: "edge", light: "on", readout: "36 GB", with: true },
              { type: "note", node: "edge", text: "saves 9 GB", with: true },
              { type: "stream", every: 1100, routes: [{ path: ["edge", "viewers"], kind: "work" }] },
            ],
          },
        ],
      },
    },
    {
      title: "Few teams need their own CDN",
      short: "Own CDN?",
      text: "A private CDN pays off only with sustained volume and measured savings. Netflix runs Open Connect, placing its own caching appliances inside internet providers, but few companies have that traffic. Most should use commercial CDNs and compare them on measured results.",
      focus: ["edge", "monitor"],
      frame: ["viewers", "edge", "storage", "monitor", "transcoder"],
      facts: [["Own CDN", "sustained volume only"], ["Most teams", "commercial CDNs"]],
      metrics: { delivered: { n: 180, unit: " TB" }, bill: "$5,400", bitrate: "2.4 Mbit/s" },
      changes: ["~ CDN edge from a commercial CDN", "+ Compare CDNs on measured results"],
      events: [
        { type: "state", node: "viewers", detail: "1M views" },
        { type: "state", node: "edge", light: "work", readout: "180 TB", with: true },
        { type: "state", node: "transcoder", light: "idle", with: true },
        { type: "note", node: "edge", text: "commercial CDN", with: true },
        { type: "packet", path: ["edge", "monitor"], label: "bytes · hit rate" },
        { type: "state", node: "monitor", light: "on", readout: "compare CDNs" },
      ],
    },
  ],
};
