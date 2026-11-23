import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Build from completed searches": a completed search for “camera” becomes event e-4127, appended to the Event
// stream; the Aggregator counts it by term and window, and when the stream delivers e-4127 again the event ID skips the
// repeat (delivered 2, counted 1). Tonight's Index builder reads the Term counts and writes an immutable snapshot, v812
// (20.2M prefixes against v811's 20.0M, example numbers), which fails itself if the prefix count fell more than 5% or a
// popular prefix such as “ca” came back empty; it rose 1%, so v812 passes. The Query API's serving nodes load v812, pass
// a health check and switch, keeping v811 for rollback. A surge in “camera” today climbs in the Term counts but waits for
// the next build (daily suits a stable catalog; a streaming delta is fresher at the cost of a second code path), and
// that build rebuilds all 6 of its lists together: c, ca, cam, came, camer, camera. The log is the Snapshot store's
// versions, offsets equal to version numbers.
export const autocompletePipelineStage: StageScene = {
  id: "autocomplete-pipeline",
  intro: "Follow one completed search for “camera” from the Collector into tonight’s snapshot, and watch the Query API switch to it.",
  metrics: [
    { id: "counted", label: "e‑4127 counted" },
    { id: "prefixes", label: "Prefixes" },
    { id: "serving", label: "Serving" },
  ],
  // A loop on two lanes: collection runs left to right along lane −1 (Client, Collector, Event stream, Aggregator),
  // building comes back right to left along lane +1 (Term counts, Index builder, Snapshot store), and the Query API
  // takes the Collector's place once collection has left the stage, beside the Snapshot store it reads from. On a phone
  // the loop is four rows of two with the versions strip under the Snapshot store's row, and each step shows only two
  // rows of it: a third row shrinks every tag below a readable size on a 375×667 phone. So each step is one stretch of
  // the loop: collection (1), counting (2), building, checking and switching (3 to 5, with the Term counts leaving once
  // the builder has read them), the surge in today's counts (6, the Term counts back beside the Index builder), and the
  // next build (7). From step 3 on, the Snapshot store and its strip never leave. Steps 1 and 2 frame their focus on a
  // phone and everything shown on a wide screen; steps 3 to 7 frame the build row and the Query API. The event ID is
  // written with a non-breaking hyphen (U+2011) so the steps panel never breaks it as "e-" / "4127".
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "search box", at: [0, -1] },
    { id: "collector", role: "web", label: "Collector", detail: "completed searches", at: [1, -1] },
    { id: "stream", role: "broker", label: "Event stream", detail: "append-only log", at: [2, -1], opts: { count: 3, items: 3 } },
    { id: "aggregator", role: "worker", label: "Aggregator", detail: "counts per term", at: [3, -1], appear: 1 },
    { id: "counts", role: "database", label: "Term counts", detail: "term × window", at: [3, 1], appear: 1 },
    { id: "builder", role: "worker", label: "Index builder", detail: "nightly batch job", at: [2, 1], appear: 2 },
    { id: "snapshots", role: "storage", label: "Snapshot store", detail: "versioned snapshots", at: [1, 1], appear: 2 },
    { id: "api", role: "web", label: "Query API", detail: "serving nodes", at: [1, -1], appear: 2, opts: { many: true } },
  ],
  links: [
    { from: "client", to: "collector" },
    { from: "collector", to: "stream" },
    { from: "stream", to: "aggregator" },
    { from: "aggregator", to: "counts" },
    { from: "counts", to: "builder" },
    { from: "builder", to: "snapshots" },
    { from: "snapshots", to: "api" },
  ],
  logs: [
    { id: "versions", node: "snapshots", label: "Versions", start: 810, side: "below", appear: 2, records: [{ text: "v810" }, { text: "v811" }] },
  ],
  steps: [
    {
      title: "A completed search becomes one event",
      short: "Collect",
      text: "Someone submits a search for “camera”. The Collector records the permitted, normalized term, the time and coarse context as one event, e‑4127, and appends it to an append-only Event stream such as Kafka, away from the serving path.",
      focus: ["client", "collector", "stream"],
      facts: [["Event", "e‑4127"], ["Holds", "term, time, context"]],
      metrics: { counted: 0 },
      changes: ["+ Event e‑4127 for “camera”", "+ Appended to the Event stream"],
      events: [
        { type: "packet", path: ["client", "collector"], label: "search “camera”" },
        { type: "state", node: "collector", light: "on" },
        { type: "note", node: "collector", text: "term · time · context", with: true },
        { type: "packet", path: ["collector", "stream"], label: "e‑4127 “camera”" },
        { type: "state", node: "stream", light: "on", opts: { items: 4 } },
        { type: "note", node: "stream", text: "e‑4127 appended", tone: "work", with: true },
      ],
    },
    {
      // Client and Collector stay (dimmed) so a wide screen plays this step at the framing it ends on.
      title: "A redelivered event is counted once",
      short: "Retry",
      text: "The Aggregator counts searches by term and window, so “camera” gets +1. Then the stream retries and delivers e‑4127 again. Its event ID is an idempotency key: the Aggregator has seen it and skips the repeat. A durable checkpoint would also prevent the double count.",
      focus: ["stream", "aggregator", "counts"],
      facts: [["Delivered", "2"], ["Counted", "1"], ["Key", "event ID"]],
      metrics: { counted: 1 },
      changes: ["+ Aggregator and Term counts", "+ “camera” +1", "~ Repeat of e‑4127 skipped"],
      events: [
        { type: "packet", path: ["stream", "aggregator"], label: "e‑4127 “camera”" },
        { type: "state", node: "aggregator", light: "on" },
        { type: "packet", path: ["aggregator", "counts"], label: "“camera” +1", kind: "work" },
        { type: "state", node: "counts", light: "work", readout: "“camera” +1" },
        { type: "packet", path: ["stream", "aggregator"], label: "e‑4127 again", kind: "quiet" },
        { type: "note", node: "aggregator", text: "seen e‑4127: skip" },
        { type: "state", node: "aggregator", light: "work", with: true },
      ],
    },
    {
      // The Term counts move up beside the Index builder, into the Event stream's place (where step 6 brings them back),
      // hand their counts across and leave, so a phone frames the two build rows from the start and ends on them.
      // Framing the Term counts where they start instead would play the whole step on three rows. The Collector is in
      // the frame only because it stands where the Query API arrives: with none of the framed parts on stage at the
      // start, the camera adds a stand-in box at the origin and plays the step (and steps 4 and 5) zoomed out.
      title: "A nightly job builds snapshot v812",
      short: "Build",
      text: "Tonight the Index builder, a batch job often run in Spark, builds ranked prefix lists from the Term counts. It writes them to the Snapshot store as an immutable snapshot, v812, with 20.2 million prefixes in this example. The Query API still serves v811.",
      focus: ["counts", "builder", "snapshots"],
      frame: ["collector", "builder", "snapshots", "api"],
      metrics: { prefixes: "20.2M", serving: "v811" },
      changes: ["+ Index builder, Snapshot store, Query API", "+ v812 written, immutable", "~ Query API still serving v811"],
      events: [
        { type: "hide", nodes: ["client", "collector", "stream", "aggregator"] },
        { type: "state", nodes: ["collector", "stream", "aggregator"], light: "idle", with: true },
        { type: "state", node: "counts", light: "on", readout: "", with: true },
        { type: "move", at: { counts: [2, -1] }, with: true },
        { type: "show", nodes: ["builder", "snapshots", "api"] },
        { type: "cursor", log: "versions", id: "api", at: 811, label: "serving" },
        { type: "packet", path: ["counts", "builder"], label: "counts by term" },
        { type: "state", node: "builder", light: "on" },
        { type: "hide", nodes: ["counts"], with: true },
        { type: "append", log: "versions", from: "builder", records: [{ text: "v812", tone: "quiet" }] },
        { type: "note", node: "builder", text: "v812 written", tone: "work" },
      ],
    },
    {
      title: "v812 must pass its checks first",
      short: "Validate",
      text: "Before release, the job compares v812 with v811 and fails itself if the prefix count fell more than 5% or a known popular prefix came back empty. In this example the count rose 1%, from 20.0 to 20.2 million, and “ca” still has its list, so v812 passes.",
      focus: ["builder", "snapshots"],
      frame: ["builder", "snapshots", "api"],
      // The +1% stays in the note and facts, not the Prefixes chip: with it the chips overflow a 375 px phone.
      facts: [["Fail if", "prefixes fall > 5%"], ["Or if", "a popular prefix is empty"], ["v812", "+1% vs v811"]],
      changes: ["~ Prefixes 20.0M → 20.2M, +1%", "~ “ca” still has a list", "+ v812 passes"],
      events: [
        { type: "note", node: "builder", text: "20.2M vs 20.0M: +1%" },
        { type: "pause", ms: 500 },
        { type: "note", node: "snapshots", text: "“ca” list present", tone: "work" },
        { type: "record", log: "versions", at: 812, tone: "work" },
        { type: "state", node: "builder", light: "work", with: true },
      ],
    },
    {
      title: "Query API switches, keeping v811",
      short: "Switch",
      text: "The Query API’s serving nodes load v812, pass a health check, and only then switch, so every read sees one consistent version. v811 stays in the Snapshot store: rolling back means moving the serving pointer back to it.",
      focus: ["snapshots", "api"],
      frame: ["builder", "snapshots", "api"],
      facts: [["Serving", "v812"], ["Rollback", "v811, kept"]],
      metrics: { serving: "v812" },
      changes: ["+ v812 loaded, health check passed", "~ Serving v811 → v812", "~ v811 kept for rollback"],
      events: [
        { type: "state", node: "builder", light: "idle" },
        { type: "read", log: "versions", at: 812, to: "api", label: "load v812", with: true },
        { type: "state", node: "api", light: "on" },
        { type: "note", node: "api", text: "healthy", tone: "work" },
        { type: "cursor", log: "versions", id: "api", at: 812 },
        { type: "state", node: "api", light: "work", with: true },
      ],
    },
    {
      // The surge shows in the Term counts, back beside the Index builder where step 3 left them, while the
      // Query API and its serving pointer stay in view: two rows on a phone. Bringing the Event stream and Aggregator
      // back instead needs a third row, or hiding the Snapshot store, and a step that hides a part with a log strip
      // leaves a phone's rows out of step with its camera when the step ends (the strip's room leaves the row spacing).
      title: "Today’s surge waits for the next snapshot",
      short: "Freshness",
      text: "If “camera” surges today, the Term counts climb, but the Query API keeps serving v812 until the next build. The build cadence sets freshness: daily suits a stable catalog, and a streaming delta merged at read time is fresher but adds a second code path.",
      focus: ["counts", "snapshots", "api"],
      frame: ["counts", "builder", "snapshots", "api"],
      facts: [["Serving", "v812 until the next build"], ["Delta", "fresher, a second code path"]],
      changes: ["+ “camera” surging in today’s counts", "~ Serving stays on v812"],
      events: [
        { type: "show", nodes: ["counts"], at: { counts: [2, -1] } },
        { type: "state", node: "counts", light: "on", with: true },
        { type: "pause", ms: 400 },
        { type: "state", node: "counts", light: "work", readout: "“camera” ↑" },
        { type: "note", node: "api", text: "still serving v812" },
      ],
    },
    {
      // The Term counts leave (safe for the camera: they carry no strip), so on a wide screen their link doesn't run
      // beside the Query API's.
      title: "The next build rebuilds six lists together",
      short: "Six lists",
      text: "Updating only the “camera” leaf would leave its ancestors’ top-K lists stale. The next build rebuilds all six lists the surge can change, “c”, “ca”, “cam”, “came”, “camer” and “camera”, together in one new snapshot. That is what the snapshot buys.",
      focus: ["builder", "snapshots"],
      frame: ["builder", "snapshots", "api"],
      facts: [["Lists to rebuild", "6, “c” to “camera”"], ["Rebuilt", "together, in one snapshot"]],
      changes: ["+ Next build: 6 lists, “c” to “camera”", "~ No ancestor list left stale"],
      events: [
        { type: "hide", nodes: ["counts"] },
        { type: "state", node: "builder", light: "on" },
        { type: "note", node: "builder", text: "6 lists: c … camera", with: true },
        { type: "cursor", log: "versions", id: "builder", at: "end", label: "next build", tone: "quiet" },
      ],
    },
  ],
};
