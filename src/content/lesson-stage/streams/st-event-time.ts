import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Decide when a window is complete": counted by processing time, a window job back from a 10-minute outage
// draws a spike of about 4,500 events in one minute (example, ours: a usual minute holds about 410). Counted by event
// time, each phone event is filed under its own stamp in a one-minute tumbling window. The watermark is the latest event
// time seen minus 30 s: 12:00:57 sets it to 12:00:27, 12:01:30 to 12:01:00, so the 12:00–12:01 window closes and emits
// 412. A phone then sends 12:00:50: late. The learner picks a policy (drop, update to 413, side output); then what a
// 1-minute delay would buy, and an idle partition (P1, silent since 12:01:40) holding the minimum watermark at 12:01:10.
export const stEventTimeStage: StageScene = {
  id: "st-event-time",
  intro: "Watch a window job count phone events by the time they happened, close a minute when its watermark passes, then decide what to do with an event that arrives late.",
  metrics: [
    { id: "wm", label: "Watermark" },
    { id: "count", label: "12:00–12:01" },
    { id: "late", label: "Late" },
  ],
  // The topic and the window job stand one behind the other, each with its strip to the right: the topic's partition in
  // arrival order (offsets on its ruler), the job's events sorted by event time. The dashboard stands left of the job.
  // On a phone the phones and the dashboard share the top row and the topic and job the row under it, their strips
  // stacked below, so no link crosses a strip. The side output takes the phones' place while they have nothing to send
  // (between them and the dashboard it crowds the dashboard on a wide screen; on a phone its link to the job crosses the
  // topic's, dimmed in step 6).
  nodes: [
    { id: "phones", role: "phone", label: "Phones", detail: "stamp each event", at: [0, 0], opts: { many: true } },
    { id: "side", role: "queue", label: "Side output", detail: "late events", at: [0, 0], appear: 5, opts: { items: 0 } },
    { id: "topic", role: "broker", label: "Events topic", detail: "2 partitions", at: [1, 0], opts: { count: 2, items: 3 } },
    { id: "job", role: "worker", label: "Window job", detail: "counts per minute", at: [1, 2] },
    { id: "dash", role: "monitor", label: "Dashboard", detail: "events per minute", at: [0, 2] },
  ],
  links: [
    { from: "phones", to: "topic" },
    { from: "topic", to: "job" },
    { from: "job", to: "dash" },
    { from: "job", to: "side" },
  ],
  logs: [
    // partition 0 in arrival order: 12:00:24 is held up on the way and lands after 12:00:41
    { id: "p0", node: "topic", label: "P0", start: 7400, appear: 1 },
    // the job's events filed by event time (a sorted log keeps arrival offsets, so cursors and brackets name them):
    // 0-3 the 12:00 minute (12:00:08, :41, :24, :57), 4 is 12:01:30, 5 the late 12:00:50 (or, once it is dropped or
    // routed away, the first of step 8's events). The short name keeps three tiles on a phone, where both strips stack.
    { id: "et", node: "job", label: "Job", sorted: true, appear: 1 },
  ],
  steps: [
    {
      title: "Processing time draws a false spike",
      short: "False spike",
      text: "Phones stamp each event when it happens: its event time. Processing time is when the window job handles it. Back from a 10-minute outage, the job handles the backlog in one minute: by processing time, about 4,500 events against a usual 410, a spike that never happened.",
      facts: [["Usual minute", "about 410"], ["Outage", "10 minutes"], ["Minute after", "about 4,500"]],
      changes: ["~ Window job back from a 10-minute outage", "+ Backlog handled in one minute", "~ Dashboard spikes to 4,500/min"],
      events: [
        { type: "state", node: "job", light: "hot", tone: "hot", down: true },
        { type: "stream", every: 300, routes: [{ path: ["phones", "topic"] }], with: true },
        { type: "state", node: "topic", opts: { items: 6 }, gap: 500 },
        { type: "pause", ms: 900 },
        { type: "state", node: "job", light: "work", tone: "", down: false },
        { type: "packet", path: ["topic", "job"], label: "", kind: "work" },
        { type: "state", node: "topic", opts: { items: 3 }, with: true },
        { type: "packet", path: ["job", "dash"], label: "4,500", kind: "hot" },
        { type: "state", node: "dash", light: "hot", tone: "hot", readout: "4,500/min" },
        { type: "note", node: "dash", text: "a false spike", tone: "hot", with: true },
      ],
    },
    {
      title: "Event time files each event in its minute",
      short: "Event time",
      text: "By event time, each event goes under its own stamp. 12:00:24, held up on the network, reaches the topic after 12:00:41, yet the window job files it ahead of 12:00:41. A tumbling window takes each whole minute, here 12:00 to 12:01; a sliding window overlaps, and a session window closes after a gap.",
      focus: ["topic", "job"],
      facts: [["Window", "12:00 to 12:01"], ["Kind", "tumbling, 1 minute"]],
      changes: ["+ Events filed by event time", "~ 12:00:24 filed before 12:00:41", "+ Window 12:00 to 12:01"],
      events: [
        { type: "state", node: "dash", light: "idle", tone: "", readout: "" },
        { type: "state", node: "job", light: "on", with: true },
        { type: "append", log: "p0", records: [{ text: "12:00:08" }, { text: "12:00:41" }, { text: "12:00:24" }], with: true },
        { type: "packet", path: ["topic", "job"], label: "in arrival order" },
        { type: "append", log: "et", records: [{ text: "12:00:08" }] },
        { type: "append", log: "et", records: [{ text: "12:00:41" }], gap: 100 },
        { type: "append", log: "et", records: [{ text: "12:00:24" }], gap: 100 },
        { type: "bracket", log: "et", id: "w0", from: 0, to: 3, label: "12:00–12:01" },
      ],
    },
    {
      title: "A watermark estimates what has arrived",
      short: "Watermark estimate",
      text: "When is a minute complete? The watermark is the job’s estimate that events older than time T have probably all arrived: here the latest event time seen minus 30 seconds. 12:00:57 sets it to 12:00:27, short of 12:01, so the window stays open.",
      focus: ["phones", "topic", "job"],
      facts: [["Watermark", "latest − 30 s"], ["Latest seen", "12:00:57"]],
      metrics: { wm: "12:00:27" },
      changes: ["+ 12:00:57 arrives", "+ Watermark at 12:00:27", "~ Window still open"],
      events: [
        { type: "append", log: "p0", from: "phones", records: [{ text: "12:00:57" }] },
        // no packet from the topic to the job here or in later steps: step 2 showed the job reading the topic, the new
        // tiles in P0 and the Job strip show the hop, and a resting packet would crowd the cable's bend in a still
        { type: "append", log: "et", records: [{ text: "12:00:57" }] },
        { type: "cursor", log: "et", id: "wm", at: 1, label: "watermark", line: true },
        { type: "note", node: "job", text: "12:00:57 − 30 s", with: true },
      ],
    },
    {
      title: "Watermark at 12:01:00 closes the window",
      short: "Window closes",
      text: "An event stamped 12:01:30 moves the watermark to 12:01:00, the end of the window. The window from 12:00 to 12:01 closes and emits its count to the dashboard: 412 events, of which the strip shows a few.",
      focus: ["phones", "topic", "job", "dash"],
      facts: [["Latest seen", "12:01:30"], ["Count", "412"]],
      metrics: { wm: "12:01:00", count: 412 },
      changes: ["+ 12:01:30 arrives", "~ Watermark at 12:01:00", "+ 12:00 to 12:01 emits 412"],
      events: [
        { type: "append", log: "p0", from: "phones", records: [{ text: "12:01:30" }] },
        { type: "append", log: "et", records: [{ text: "12:01:30" }] },
        { type: "cursor", log: "et", id: "wm", at: 4 },
        // the window is done: its bracket turns blue as it emits
        { type: "bracket", log: "et", id: "w0", tone: "work" },
        { type: "packet", path: ["job", "dash"], label: "412", kind: "work", with: true },
        // the 12:00–12:01 chip carries 412, not a readout: on a wide screen a pill beside the dashboard stands on the
        // topic-to-job cable's way and sends it round another, and a played step leaves the old way lit
        { type: "state", node: "dash", light: "work" },
      ],
    },
    {
      title: "An event stamped 12:00:50 arrives late",
      short: "Late event",
      text: "A phone reconnects and sends an event stamped 12:00:50. It is the newest record in the topic, but by event time it belongs to the window that already closed: it lands behind the watermark. It is late.",
      focus: ["phones", "topic", "job"],
      metrics: { late: { n: 1, tone: "hot" } },
      changes: ["+ 12:00:50 arrives after 12:01:30", "~ Behind the watermark: late"],
      events: [
        { type: "append", log: "p0", from: "phones", records: [{ text: "12:00:50", tone: "hot" }] },
        { type: "append", log: "et", records: [{ text: "12:00:50", tone: "hot" }] },
        { type: "note", node: "job", text: "window closed", tone: "hot", with: true },
      ],
    },
    {
      title: "Choose what a late event does",
      short: "Late policy",
      text: "The window already emitted 412, so the job needs a policy. Drop the event and count the drops; update the emitted result to 413; or route the event to a side output for later correction. Try each.",
      focus: ["job", "dash", "side"],
      events: [
        { type: "hide", nodes: ["phones"] },
        { type: "show", nodes: ["side"] },
        // a policy handles it here, so the topic's copy goes back to ink and doesn't pull the eye in later steps
        { type: "record", log: "p0", at: 7405, tone: "", with: true },
      ],
      control: {
        label: "Late event",
        options: [
          {
            label: "Drop it",
            metrics: { late: { n: 1, unit: " dropped" } },
            events: [
              { type: "truncate", log: "et", after: 4 },
              { type: "note", node: "job", text: "drops: 1" },
            ],
          },
          {
            label: "Update result",
            metrics: { count: 413, late: { n: 1, unit: " counted" } },
            events: [
              { type: "record", log: "et", at: 5, tone: "work" },
              { type: "packet", path: ["job", "dash"], label: "413", kind: "work" },
              { type: "state", node: "dash", light: "work" },
            ],
          },
          {
            label: "Side output",
            metrics: { late: { n: 1, unit: " to side" } },
            events: [
              { type: "truncate", log: "et", after: 4 },
              // no packet to the side output: a resting one would sit on the topic's tag in a wide still, and the lit
              // side output, its item and note say where the event went. A note floats over the part; a readout would
              // sit beside it, on the topic, on a wide screen
              { type: "state", node: "side", light: "work", opts: { items: 1 } },
              { type: "note", node: "side", text: "to correct later", with: true },
            ],
          },
        ],
      },
    },
    {
      title: "A longer delay waits for stragglers",
      short: "Longer delay",
      text: "The delay trades freshness for completeness. With 1 minute instead of 30 seconds, 12:01:30 would move the watermark only to 12:00:30: the window would stay open and 12:00:50 arrive in time, but the count would wait until events reach 12:02:00. A short delay gives fast results and more late events.",
      focus: ["job"],
      // everything on the stage stays framed: framing only the topic and the job cuts the dashboard on a wide screen
      frame: ["side", "topic", "job", "dash"],
      facts: [["30 s delay", "faster, more late"], ["1 min delay", "slower, fewer late"]],
      changes: ["~ A 1-minute delay: 12:00:30", "~ The window would wait for 12:00:50"],
      events: [
        { type: "cursor", log: "et", id: "slow", at: 1, label: "1-min delay", line: true, tone: "quiet" },
      ],
    },
    {
      title: "One idle partition stalls every window",
      short: "Idle partition",
      text: "The job takes the minimum watermark over its partitions. P1 has had no event since 12:01:40, so its watermark stays at 12:01:10 while P0’s passes 12:02, and the window from 12:01 to 12:02 stays open. Device clocks can be wrong too, so validate timestamps at ingest.",
      focus: ["phones", "topic", "job"],
      facts: [["P0 watermark", "12:02:01"], ["P1 watermark", "12:01:10"], ["Job takes", "the minimum"]],
      metrics: { wm: "12:01:10" },
      changes: ["+ P0 reaches 12:02:31", "− P1 idle since 12:01:40", "~ Watermark stuck at 12:01:10"],
      events: [
        { type: "hide", nodes: ["side"] },
        { type: "show", nodes: ["phones"] },
        { type: "cursor", log: "et", id: "slow", at: null, with: true },
        { type: "bracket", log: "et", id: "w0", remove: true, with: true },
        { type: "state", node: "topic", light: "hot", opts: { mark: 1 } },
        { type: "note", node: "topic", text: "P1 idle", tone: "hot", with: true },
        { type: "append", log: "p0", from: "phones", records: [{ text: "12:02:05" }] },
        { type: "append", log: "p0", from: "phones", records: [{ text: "12:02:31" }], gap: 100 },
        { type: "append", log: "et", records: [{ text: "12:02:05" }, { text: "12:02:31" }] },
        // the watermark's cursor stays put and in ink, so its label doesn't read as the orange window's
        { type: "bracket", log: "et", id: "w1", from: 4, to: 4, label: "12:01–12:02", tone: "hot" },
        { type: "note", node: "job", text: "window stalls", tone: "hot", with: true },
      ],
    },
  ],
};
