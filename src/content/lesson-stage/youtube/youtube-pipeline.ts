import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Process video off the request path": video 81's verified source starts a job, and the Scheduler builds a DAG
// (inspect first; audio, renditions, thumbnails and optional moderation where dependencies allow; the manifest last,
// since it lists their outputs). Inspect reads the 60-minute source and writes 30 two-minute chunks; 30 chunks × 5
// renditions = 150 encode tasks, 4 min each, so one worker needs 10 h and 50 workers (3 tasks each) about 12 min.
// Worker 1 writes v81/720p/c07 and dies before its ack; the lease expires and Worker 2 finds the output under its fixed
// key. Another upload, video 82, shows the two failure paths: bounded retries ending in Dead letters, or a decode error
// that fails at once. The manifest runs last and video 81 becomes ready; a 30-second clip needs only one FFmpeg job.
export const youtubePipelineStage: StageScene = {
  id: "youtube-pipeline",
  intro: "Watch video 81’s source become 150 parallel tasks, survive a worker crash, and publish only when its outputs exist.",
  metrics: [{ id: "tasks", label: "Tasks" }, { id: "workers", label: "Workers" }, { id: "status", label: "Video status" }],
  // Left to right: Scheduler, Task queue, the workers, Video storage where they write. Dead letters stands behind the
  // queue in its own tier, so its cable runs straight back from the queue and crosses nothing; on a phone it sits
  // beside the queue in that row. On a phone: Scheduler; Dead letters | Task queue; Worker 1 | Worker 2; Video storage.
  nodes: [
    { id: "scheduler", role: "scheduler", label: "Scheduler", detail: "builds the DAG", at: [0, 0], opts: { items: 0 } },
    { id: "queue", role: "queue", label: "Task queue", detail: "keys + job IDs", at: [1, 0], opts: { items: 0 } },
    { id: "w1", role: "worker", label: "Worker", detail: "runs one task", at: [2.15, 0] },
    { id: "w2", role: "worker", label: "Worker 2", detail: "runs one task", at: [2.15, 1], appear: 2 },
    { id: "storage", role: "storage", label: "Video storage", detail: "sources + outputs", at: [3.55, 0] },
    { id: "dead", role: "queue", label: "Dead letters", detail: "for operators", at: [0.19, -1.59], appear: 4, opts: { items: 0 } },
  ],
  links: [
    { from: "scheduler", to: "queue" },
    { from: "queue", to: "w1" },
    { from: "queue", to: "w2" },
    { from: "w1", to: "storage" },
    { from: "w2", to: "storage" },
    { from: "queue", to: "dead" },
  ],
  steps: [
    {
      title: "A verified source starts a task graph",
      short: "Task graph",
      text: "Video 81’s source is verified, so an ingestion event starts a processing job. The Scheduler builds a DAG, tasks with dependency arrows and no loops: inspect first, then audio, video renditions, thumbnails and optional moderation, and the manifest last, since it lists their outputs.",
      focus: ["scheduler"],
      frame: ["scheduler", "queue"],
      facts: [["First", "inspect"], ["Then", "audio, video, thumbs"], ["Last", "manifest"]],
      metrics: { status: "processing" },
      changes: ["+ Processing job for video 81", "+ Task graph, inspect first", "~ Video status: processing"],
      events: [
        { type: "note", node: "scheduler", text: "ingest · video 81" },
        { type: "state", node: "scheduler", light: "on", opts: { items: 4 } },
      ],
    },
    {
      title: "Inspect first; messages carry keys",
      short: "Inspect",
      text: "The Scheduler queues inspect v81. Messages carry object keys and job IDs, not media: the Worker reads v81/source.mp4 from Video storage and writes 30 aligned 2-minute chunks, each starting on a frame that decodes alone. Then the tasks that waited on inspect are released.",
      focus: ["scheduler", "queue", "w1", "storage"],
      facts: [["Source", "60 min"], ["Chunks", "30 × 2 min"]],
      metrics: { tasks: 1, workers: 1 },
      changes: ["+ inspect v81", "+ 30 chunks in storage", "~ Waiting tasks released"],
      events: [
        { type: "packet", path: ["scheduler", "queue", "w1"], label: "inspect v81" },
        { type: "state", node: "w1", light: "on" },
        { type: "packet", path: ["storage", "w1"], label: "v81/source.mp4", kind: "response" },
        { type: "packet", path: ["w1", "storage"], label: "30 chunks", kind: "work" },
        { type: "note", node: "storage", text: "30 chunks · 2 min", tone: "work" },
        { type: "state", node: "w1", light: "work", with: true },
        // Inspect is done, so the tasks that waited on it go out at once; the manifest's card stays behind.
        { type: "packet", path: ["scheduler", "queue"], label: "audio · video · thumbs", with: true },
        { type: "state", node: "scheduler", opts: { items: 1 }, with: true },
        { type: "state", node: "queue", light: "on", opts: { items: 3 } },
      ],
    },
    {
      title: "50 workers finish 150 tasks in about 12 min",
      short: "Parallel encodes",
      text: "30 chunks × 5 renditions gives 150 encode tasks, and none depends on another, so they run in parallel. At 4 minutes per task one worker needs 10 hours; 50 workers, 3 tasks each, finish in about 12 minutes.",
      focus: ["queue", "w1", "w2", "storage"],
      frame: ["scheduler", "queue", "w1", "w2", "storage"],
      facts: [["Per task", "4 min"], ["1 worker", "10 h"], ["50 workers", "about 12 min"]],
      metrics: { tasks: 150, workers: 50 },
      changes: ["+ 150 encode tasks", "+ 50 workers, 3 tasks each", "~ About 12 min, not 10 h"],
      events: [
        { type: "show", nodes: ["w2"], at: { w1: [2.15, -1] } },
        { type: "state", node: "w1", label: "Worker 1", light: "idle", with: true },
        { type: "state", node: "queue", opts: { items: 4 }, with: true },
        { type: "note", node: "w2", text: "50 workers" },
        { type: "state", nodes: ["w1", "w2"], light: "work", with: true },
        {
          type: "stream", every: 230, routes: [
            { path: ["queue", "w1", "storage"], kind: "work" },
            { path: ["queue", "w2", "storage"], kind: "work" },
          ],
        },
      ],
    },
    {
      title: "A crash before the ack repeats the task",
      short: "Crash",
      text: "Worker 1 leases encode 720p · c07, writes v81/720p/c07, then dies before its ack. The lease expires and Worker 2 gets the task again. The output key is fixed, so Worker 2 finds the output, verifies it and acks: the repeat does no harm.",
      focus: ["queue", "w1", "w2", "storage"],
      frame: ["scheduler", "queue", "w1", "w2", "storage"],
      facts: [["Output key", "v81/720p/c07"], ["Lease", "expires on crash"]],
      changes: ["− Worker 1 crashes before its ack", "~ Lease expires, task redelivered", "~ Output verified, not duplicated"],
      events: [
        { type: "state", nodes: ["w1", "w2"], light: "idle" },
        { type: "packet", path: ["queue", "w1"], label: "encode 720p · c07" },
        { type: "state", node: "w1", light: "on" },
        { type: "packet", path: ["w1", "storage"], label: "v81/720p/c07", kind: "work" },
        { type: "state", node: "w1", light: "hot", tone: "hot", down: true },
        { type: "note", node: "w1", text: "no ack", tone: "hot", with: true },
        { type: "pause", ms: 400 },
        { type: "note", node: "queue", text: "lease expired" },
        { type: "packet", path: ["queue", "w2"], label: "720p · c07, again" },
        { type: "state", node: "w2", light: "on" },
        { type: "packet", path: ["w2", "storage"], label: "check v81/720p/c07" },
        { type: "note", node: "w2", text: "key exists · verified", tone: "work" },
        { type: "packet", path: ["w2", "queue"], label: "ack", kind: "quiet", with: true },
        { type: "state", node: "w2", light: "work", with: true },
      ],
    },
    {
      title: "Retries end in dead letters or an error",
      short: "Failures",
      text: "Retries are bounded. Pick a failure in another upload, video 82. Keeps failing: a task fails on both workers, its retries run out, and it moves to Dead letters for operators. Bad source: inspect hits a decode error, a terminal validation error, so it fails at once with no retry.",
      focus: ["queue", "w1", "w2", "dead"],
      frame: ["scheduler", "queue", "w1", "w2", "storage", "dead"],
      facts: [["Transient", "retry, bounded"], ["Persistent", "dead letters"], ["Malformed", "fail, no retry"]],
      changes: ["+ Dead letters, for operators", "~ Retries bounded", "~ Bad source fails at once"],
      events: [
        { type: "show", nodes: ["dead"] },
        { type: "state", node: "w1", light: "idle", tone: "", down: false, with: true },
        { type: "state", nodes: ["w2", "queue"], light: "idle", with: true },
      ],
      control: {
        label: "Failure",
        options: [
          {
            label: "Keeps failing",
            events: [
              { type: "packet", path: ["queue", "w1"], label: "v82 · try 1" },
              { type: "note", node: "w1", text: "fails", tone: "hot" },
              { type: "packet", path: ["queue", "w2"], label: "v82 · try 2" },
              { type: "note", node: "w2", text: "fails again", tone: "hot" },
              { type: "packet", path: ["queue", "dead"], label: "v82 · out of retries", kind: "hot" },
              { type: "state", node: "dead", light: "hot", tone: "hot", opts: { items: 1 } },
              { type: "note", node: "dead", text: "v82 · for operators", tone: "hot", with: true },
            ],
          },
          {
            label: "Bad source",
            events: [
              { type: "packet", path: ["queue", "w1"], label: "inspect v82" },
              { type: "state", node: "w1", light: "on" },
              { type: "note", node: "w1", text: "decode error", tone: "hot", with: true },
              { type: "packet", path: ["w1", "queue"], label: "v82 · terminal error", kind: "hot" },
              { type: "note", node: "queue", text: "v82 failed · no retry", tone: "hot" },
            ],
          },
        ],
      },
    },
    {
      title: "Publish only when outputs exist",
      short: "Publish",
      text: "Back to video 81. Its renditions, audio and thumbnails are in Video storage, so the Scheduler releases its last task. Worker 2 writes the manifest, the player’s index file, and only with every required output in place does video 81 become ready.",
      focus: ["scheduler", "queue", "w2", "storage"],
      facts: [["Publish after", "outputs + manifest"]],
      metrics: { status: "ready" },
      changes: ["+ v81 manifest", "~ Video status: ready"],
      events: [
        { type: "state", nodes: ["w1", "w2", "queue", "dead"], light: "idle", tone: "", down: false },
        { type: "state", node: "queue", opts: { items: 0 }, with: true },
        { type: "packet", path: ["scheduler", "queue", "w2"], label: "manifest · v81" },
        { type: "state", node: "scheduler", light: "work", opts: { items: 0 }, with: true },
        { type: "state", node: "w2", light: "on" },
        { type: "packet", path: ["w2", "storage"], label: "v81 manifest", kind: "work" },
        { type: "note", node: "storage", text: "renditions + manifest", tone: "work" },
        { type: "state", node: "storage", light: "work", with: true },
        { type: "state", node: "w2", light: "work", with: true },
      ],
    },
    {
      title: "A 30-second clip needs one FFmpeg job",
      short: "Short clip",
      text: "A 30-second video needs none of this: one FFmpeg job reads the source and writes the outputs. Workflow engines such as Temporal or AWS Step Functions can hold a long job’s state, but they add a dependency to learn and run.",
      metrics: { tasks: 1, workers: 1 },
      changes: ["− Scheduler and queues", "~ One FFmpeg job for a 30 s clip"],
      events: [
        { type: "hide", nodes: ["scheduler", "queue", "dead", "w2"] },
        { type: "move", at: { w1: [2.15, 0] }, with: true },
        { type: "state", node: "w1", label: "Worker", detail: "30-second clip", light: "idle", with: true },
        { type: "state", node: "storage", light: "idle", with: true },
        { type: "packet", path: ["storage", "w1"], label: "clip.mp4 · 30 s", kind: "response" },
        { type: "state", node: "w1", light: "on" },
        { type: "note", node: "w1", text: "one FFmpeg job", with: true },
        { type: "packet", path: ["w1", "storage"], label: "clip outputs", kind: "work" },
        { type: "state", node: "w1", light: "work" },
      ],
    },
  ],
};
