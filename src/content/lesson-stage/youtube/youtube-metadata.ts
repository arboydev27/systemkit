import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Publish only a playable video": video 81's row (a few KB) lives in the Metadata DB and its files (multi-GB)
// in Video storage. The watch page shows processing and no manifest URL. A worker reports done at 10:00; the Verifier
// finds 4 of 5 manifests (the 1080p one absent, an example) and leaves the status at processing. A retry writes it, and
// at 10:05 the Verifier finds 5 of 5 and runs SET status = ready WHERE status = processing; the cache entry is
// refreshed. The same done event again changes 0 rows. The watch page then gets a manifest URL, and a Reconciler
// compares the DB with storage for stuck jobs, orphaned objects and missing outputs.
// The read side (Viewer, Watch API, cache) stands on lane +1, the publish side (Worker, Verifier, storage) on lane -1,
// and both meet at the Metadata DB, which stands a quarter tier further on so the cache's notes clear its tag. Viewer
// and Worker share a row on a phone, so they are never on stage together. Notes on the side parts stay short enough
// to fit beside a phone's edge, and the row's status shows in the Video status chip rather than a pill on the DB, so a
// phone's rows stay short and its labels readable. What the cache and storage answer is a note on that part, not a
// reply message: a reduced-motion still rests a reply on the same hop as its request, over it and over the notes.
// Step 4 leaves out `frame`: its focus spans both phone columns, so a phone frames those three rows and its labels stay
// larger. Steps 2, 6 and 7 keep the full frame, since their focus is one column and a phone would cut the other off.
export const youtubeMetadataStage: StageScene = {
  id: "youtube-metadata",
  intro: "Follow video 81 from processing to ready, where a verified check, not a worker's report, changes its status.",
  metrics: [
    { id: "status", label: "Video status" },
    { id: "found", label: "Manifests" },
    { id: "clock", label: "Time" },
  ],
  nodes: [
    { id: "viewer", role: "phone", label: "Viewer", detail: "opens watch page", at: [0, 1] },
    { id: "worker", role: "worker", label: "Worker", detail: "runs one task", at: [0, -1], appear: 2 },
    { id: "api", role: "web", label: "Watch API", detail: "metadata + access", at: [1, 1] },
    { id: "verifier", role: "worker", label: "Verifier", detail: "checks outputs", at: [1, -1], appear: 2 },
    { id: "reconciler", role: "worker", label: "Reconciler", detail: "DB vs storage", at: [1, -1], appear: 6 },
    { id: "cache", role: "cache", label: "Metadata cache", detail: "hot rows", at: [2, 1] },
    { id: "storage", role: "storage", label: "Video storage", detail: "media bytes", at: [2, -1] },
    { id: "db", role: "database", label: "Metadata DB", detail: "video rows", at: [3.25, 0] },
  ],
  links: [
    { from: "viewer", to: "api" },
    { from: "api", to: "cache" },
    { from: "api", to: "db" },
    { from: "worker", to: "verifier" },
    { from: "verifier", to: "storage" },
    { from: "verifier", to: "db" },
    { from: "reconciler", to: "storage" },
    { from: "reconciler", to: "db" },
  ],
  steps: [
    {
      title: "Rows describe; storage holds the bytes",
      short: "Two stores",
      text: "Video 81's row in the Metadata DB holds its owner, title, visibility, duration, status and manifest pointers: a few kilobytes that must support queries. Video storage holds the multi-gigabyte files, read as streams. The Metadata cache speeds hot reads, but the DB stays authoritative.",
      focus: ["db", "storage", "cache"],
      frame: ["viewer", "api", "cache", "storage", "db"],
      changes: ["+ Row: a few KB, queried", "+ Files: multi-GB, streamed", "~ Cache speeds hot reads"],
      events: [
        { type: "state", node: "db", light: "on" },
        { type: "note", node: "db", text: "row · a few KB", with: true },
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "files · multi-GB", with: true },
        { type: "state", node: "cache", light: "on" },
        { type: "note", node: "cache", text: "speeds hot reads", with: true },
      ],
    },
    {
      title: "The watch page shows processing",
      short: "Processing",
      text: "A viewer opens video 81's watch page. The Watch API reads the row through the Metadata cache and returns processing, with no manifest URL. Completion may span storage and database writes without one atomic transaction, so status moves only along allowed transitions.",
      focus: ["viewer", "api", "cache"],
      frame: ["viewer", "api", "cache", "storage", "db"],
      facts: [["Status path", "pending → uploaded → processing"], ["Then", "ready or failed"]],
      metrics: { status: "processing" },
      changes: ["+ GET /watch/v81", "~ Status: processing", "~ No manifest URL returned"],
      events: [
        { type: "state", nodes: ["storage", "db", "cache"], light: "idle" },
        { type: "packet", path: ["viewer", "api"], label: "GET /watch/v81" },
        { type: "state", node: "api", light: "on" },
        { type: "packet", path: ["api", "cache"], label: "GET row v81" },
        { type: "note", node: "cache", text: "status: processing" },
        { type: "packet", path: ["api", "viewer"], label: "processing", kind: "response" },
        { type: "state", node: "api", light: "work" },
        { type: "note", node: "viewer", text: "no manifest URL", with: true },
      ],
    },
    {
      title: "Done at 10:00, but a manifest is missing",
      short: "Check fails",
      text: "At 10:00 a worker reports done. The Verifier checks the main manifest and all four rendition manifests in Video storage, finds the 1080p one absent, and leaves the status at processing.",
      focus: ["worker", "verifier", "storage", "db"],
      frame: ["worker", "verifier", "api", "storage", "cache", "db"],
      facts: [["Expected", "main + 4 renditions"], ["Found", "4 of 5"]],
      metrics: { found: { n: 4, unit: " of 5", tone: "hot" }, clock: "10:00" },
      changes: ["+ Worker reports done at 10:00", "− 1080p manifest absent", "~ Status stays processing"],
      events: [
        { type: "hide", nodes: ["viewer"] },
        { type: "show", nodes: ["worker", "verifier"], with: true },
        { type: "state", node: "api", light: "idle", with: true },
        { type: "packet", path: ["worker", "verifier"], label: "done · v81" },
        { type: "state", node: "verifier", light: "on" },
        { type: "packet", path: ["verifier", "storage"], label: "check 5 manifests" },
        { type: "state", node: "storage", light: "hot" },
        { type: "note", node: "storage", text: "4 of 5 · no 1080p", tone: "hot", with: true },
        { type: "note", node: "db", text: "still processing" },
      ],
    },
    {
      title: "Verified at 10:05: status becomes ready",
      short: "Ready",
      text: "A retry writes the missing manifest. At 10:05 the Verifier finds all five and runs the equivalent of SET status = ready WHERE status = processing. The Metadata DB now says ready, and the cached entry is refreshed.",
      focus: ["verifier", "storage", "db", "cache"],
      facts: [["Update", "SET status = ready"], ["Only where", "status = processing"]],
      metrics: { status: "ready", found: { n: 5, unit: " of 5" }, clock: "10:05" },
      changes: ["+ Retry writes the 1080p manifest", "~ 5 of 5 found at 10:05", "~ Status: processing → ready", "~ Cache entry refreshed"],
      events: [
        { type: "state", node: "storage", light: "work" },
        { type: "note", node: "storage", text: "retry wrote 1080p", tone: "work", with: true },
        { type: "packet", path: ["verifier", "storage"], label: "check 5 manifests" },
        { type: "state", node: "verifier", light: "work" },
        { type: "packet", path: ["verifier", "db"], label: "SET status = ready" },
        { type: "state", node: "db", light: "work" },
        { type: "note", node: "db", text: "processing → ready", tone: "work", with: true },
        { type: "state", node: "cache", light: "work", with: true },
        { type: "note", node: "cache", text: "entry refreshed", tone: "work", with: true },
      ],
    },
    {
      title: "A repeated event changes nothing",
      short: "Repeat",
      text: "The worker's done event arrives again. Repeats are normal: Amazon S3 event notifications, for instance, arrive at least once and without guaranteed order. The update runs again, but WHERE status = processing matches no row, so 0 rows change and video 81 stays ready.",
      focus: ["worker", "verifier", "db"],
      frame: ["worker", "verifier", "api", "storage", "cache", "db"],
      facts: [["Where", "status = processing"], ["Matches", "0 rows"]],
      changes: ["+ Done event, again", "~ 0 rows changed", "~ Status stays ready"],
      events: [
        { type: "state", nodes: ["verifier", "storage", "cache", "db"], light: "idle" },
        { type: "packet", path: ["worker", "verifier"], label: "done · v81, again", kind: "quiet" },
        { type: "state", node: "verifier", light: "on" },
        { type: "packet", path: ["verifier", "db"], label: "SET status = ready" },
        { type: "note", node: "db", text: "0 rows changed" },
        { type: "state", node: "verifier", light: "idle", with: true },
      ],
    },
    {
      title: "Now the watch page gets a manifest",
      short: "Manifest URL",
      text: "The viewer opens video 81's watch page again. The refreshed cache entry says ready, so the Watch API returns a permitted manifest location and the player can start.",
      focus: ["viewer", "api", "cache"],
      frame: ["viewer", "verifier", "api", "storage", "cache", "db"],
      changes: ["~ Cache returns ready", "+ Manifest URL returned"],
      events: [
        { type: "hide", nodes: ["worker"] },
        { type: "show", nodes: ["viewer"], with: true },
        { type: "packet", path: ["viewer", "api"], label: "GET /watch/v81" },
        { type: "state", node: "api", light: "on" },
        { type: "packet", path: ["api", "cache"], label: "GET row v81" },
        { type: "note", node: "cache", text: "status: ready", tone: "work" },
        { type: "packet", path: ["api", "viewer"], label: "manifest URL", kind: "response" },
        { type: "state", node: "api", light: "work" },
        { type: "note", node: "viewer", text: "gets manifest URL", tone: "work", with: true },
      ],
    },
    {
      title: "Reconcile stuck jobs and orphans",
      short: "Reconcile",
      text: "A Reconciler, a background job, compares the Metadata DB with what Video storage actually holds and can find stuck jobs, orphaned objects and missing outputs. The cost is more states for the interface and support staff to explain; an internal tool that encodes while the uploader waits could manage with one flag.",
      focus: ["reconciler", "storage", "db"],
      frame: ["viewer", "reconciler", "api", "storage", "cache", "db"],
      changes: ["~ Reconciler takes the Verifier's place", "+ Looks for stuck jobs and orphans"],
      events: [
        { type: "hide", nodes: ["verifier"] },
        { type: "show", nodes: ["reconciler"] },
        { type: "state", node: "api", light: "idle", with: true },
        { type: "packet", path: ["reconciler", "storage"], label: "list objects" },
        { type: "packet", path: ["reconciler", "db"], label: "scan statuses", with: true },
        { type: "state", node: "reconciler", light: "on" },
        { type: "note", node: "storage", text: "looks for orphans" },
        { type: "note", node: "db", text: "looks for stuck jobs", with: true },
      ],
    },
  ],
};
