import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Accept an upload safely": the Upload API checks a 2 GB upload (auth, quota, size) and records video 81 as
// pending, then hands back a presigned URL for one key, v81/source.mp4. The bytes go straight to Video storage in 200
// parts of 10 MB, never through the API. The connection dies after part 150, so storage keeps 150 parts (1.5 GB) and
// the creator resends only parts 151-200: 50 parts, 500 MB, not 2 GB. Storage confirms the object, the API checks its
// size, checksum and type and sets status uploaded (durable, not yet playable). Last, a lifecycle rule aborts stale
// parts, and a 5 MB profile clip goes as one plain PUT.
export const youtubeUploadStage: StageScene = {
  id: "youtube-upload",
  intro: "Follow a 2 GB upload from permission to verified original, through a connection that drops after part 150.",
  metrics: [
    { id: "parts", label: "Parts stored" },
    { id: "resent", label: "Resent" },
    { id: "status", label: "Video status" },
  ],
  // Two paths leave the Creator: the small control request climbs to the Upload API, and the big bytes run along the
  // front, past the API, straight into Video storage. Storage stands a tier beyond the API, beside the Metadata DB, so
  // the API's check of the stored object has a cable of its own instead of one bundled with the Creator's. The API sits
  // half a lane up so its notes stay on a phone. On a phone: Creator; Upload API; Metadata DB | Video storage.
  nodes: [
    { id: "creator", role: "client", label: "Creator", detail: "uploads a video", at: [0, 0] },
    { id: "api", role: "web", label: "Upload API", detail: "auth, quota, size", at: [1, -0.5] },
    { id: "storage", role: "storage", label: "Video storage", detail: "receives parts", at: [2, 1] },
    { id: "db", role: "database", label: "Metadata DB", detail: "video rows", at: [2, -1] },
  ],
  links: [
    { from: "creator", to: "api" },
    { from: "creator", to: "storage" },
    { from: "api", to: "db" },
    { from: "api", to: "storage" },
  ],
  steps: [
    {
      title: "The API checks and records a pending video",
      short: "Create upload",
      text: "The Creator asks the Upload API to create an upload for a 2 GB source. Authentication, quota and size checks pass, so the API writes video 81 to the Metadata DB as a pending record.",
      focus: ["creator", "api", "db"],
      frame: ["creator", "api", "storage", "db"],
      facts: [["Checks", "auth, quota, size"], ["Source", "2 GB"]],
      metrics: { status: "pending" },
      changes: ["+ POST /uploads · 2 GB", "+ Video 81, pending"],
      events: [
        { type: "packet", path: ["creator", "api"], label: "POST /uploads · 2 GB" },
        { type: "state", node: "api", light: "on" },
        { type: "note", node: "api", text: "auth · quota · size ok", tone: "work", with: true },
        { type: "packet", path: ["api", "db"], label: "INSERT v81 pending" },
        { type: "state", node: "db", light: "on", readout: "v81 · pending" },
      ],
    },
    {
      title: "A short-lived URL for one object key",
      short: "Presigned URL",
      text: "The Upload API answers with a presigned URL: short-lived permission to write one object key, v81/source.mp4. It records the owner and the expected key, so a guessed key can’t publish someone else’s upload.",
      focus: ["creator", "api"],
      frame: ["creator", "api", "storage", "db"],
      facts: [["Key", "v81/source.mp4"], ["Scope", "one key, short-lived"]],
      changes: ["+ Presigned URL for v81/source.mp4", "~ Owner and expected key recorded"],
      events: [
        { type: "packet", path: ["api", "creator"], label: "presigned URL · v81", kind: "response" },
        { type: "state", node: "api", light: "work", with: true },
        { type: "state", node: "creator", light: "on" },
        { type: "note", node: "creator", text: "may write v81/source.mp4", tone: "work", with: true },
        { type: "note", node: "api", text: "owner + key recorded", with: true },
      ],
    },
    {
      title: "Bytes go straight to storage in 200 parts",
      short: "Direct upload",
      text: "The Creator sends the 2 GB source straight to Video storage in 10 MB parts, 200 in all, each with a checksum. No video bytes pass through the Upload API, so big files don’t tie up its servers. 150 parts are in so far.",
      focus: ["creator", "api", "storage"],
      frame: ["creator", "api", "storage", "db"],
      facts: [["Source", "2 GB"], ["Parts", "200 × 10 MB"]],
      metrics: { parts: { n: 150, unit: " of 200" } },
      changes: ["+ 150 of 200 parts stored", "~ Bytes bypass the Upload API"],
      events: [
        { type: "state", nodes: ["api", "db"], light: "idle" },
        { type: "state", node: "storage", light: "on", readout: "10 MB parts", with: true },
        { type: "note", node: "api", text: "no video bytes", with: true },
        { type: "stream", every: 240, routes: [{ path: ["creator", "storage"] }] },
      ],
    },
    {
      title: "The connection drops after part 150",
      short: "Drop",
      text: "The connection dies while part 151 is in flight. Video storage keeps the 150 parts it already has, 1.5 GB. Sent as one request, the upload would have lost everything and started again from zero.",
      focus: ["creator", "storage"],
      frame: ["creator", "api", "storage", "db"],
      facts: [["Stored", "150 of 200 parts"], ["Kept", "1.5 GB"]],
      changes: ["− Part 151 lost in flight", "~ 150 parts, 1.5 GB, kept"],
      events: [
        { type: "packet", path: ["creator", "storage"], label: "part 151", kind: "hot", lost: true },
        { type: "state", node: "creator", light: "hot", tone: "hot" },
        { type: "note", node: "creator", text: "connection lost", tone: "hot", with: true },
        { type: "state", node: "storage", readout: "150 parts kept", with: true },
      ],
    },
    {
      title: "Resume: resend only the last 50 parts",
      short: "Resume",
      text: "The Creator reconnects to the same upload session and resends parts 151 to 200: 50 parts, or 500 MB, rather than the whole 2 GB. S3 multipart uploads and the open tus protocol work this way.",
      focus: ["creator", "storage"],
      frame: ["creator", "api", "storage", "db"],
      facts: [["Resent", "50 parts, 500 MB"], ["Not", "the whole 2 GB"]],
      metrics: { parts: { n: 200, unit: " of 200" }, resent: "500 MB" },
      changes: ["+ Parts 151–200", "~ 500 MB resent, not 2 GB"],
      events: [
        { type: "state", node: "creator", light: "on", tone: "" },
        { type: "note", node: "creator", text: "same session", with: true },
        { type: "packet", path: ["creator", "storage"], label: "parts 151–200" },
        { type: "state", node: "storage", light: "work", readout: "200 of 200 parts" },
      ],
    },
    {
      title: "Verify the object, then mark it uploaded",
      short: "Verify",
      text: "Storage confirms the complete object, and the Upload API checks its size, checksum and media type before setting video 81 to uploaded. Retrying the same session avoids a duplicate. Uploaded means the original is durable, not that it can play.",
      focus: ["api", "storage", "db"],
      frame: ["creator", "api", "storage", "db"],
      facts: [["Checked", "size, checksum, type"], ["Uploaded", "durable, not playable"]],
      metrics: { status: "uploaded" },
      changes: ["~ Size, checksum and type verified", "~ v81 pending → uploaded"],
      events: [
        { type: "state", node: "creator", light: "idle" },
        { type: "packet", path: ["storage", "api"], label: "complete · checksum", kind: "response" },
        { type: "state", node: "api", light: "on" },
        { type: "note", node: "api", text: "size · checksum · type", tone: "work", with: true },
        { type: "packet", path: ["api", "db"], label: "status = uploaded" },
        { type: "state", node: "db", light: "work", readout: "v81 · uploaded" },
        { type: "state", node: "api", light: "work", with: true },
        { type: "note", node: "storage", text: "not playable yet" },
      ],
    },
    {
      title: "Expire stale parts; small files skip this",
      short: "Clean up",
      text: "A lifecycle rule aborts abandoned sessions, since S3 keeps billing for an unfinished upload’s parts until they are aborted. Resumable flows also add client code and session state, so a 5 MB profile clip goes as one plain PUT.",
      focus: ["creator", "storage"],
      frame: ["creator", "api", "storage", "db"],
      facts: [["Stale parts", "aborted by a rule"], ["5 MB clip", "one plain PUT"]],
      changes: ["~ Abandoned parts aborted by a rule", "+ 5 MB clip in one PUT"],
      events: [
        { type: "state", nodes: ["api", "db"], light: "idle" },
        // one note says it (a pill would repeat it); short enough to clear a phone's right edge
        { type: "state", node: "storage", light: "on", readout: "", with: true },
        { type: "note", node: "storage", text: "aborts stale parts", with: true },
        { type: "packet", path: ["creator", "storage"], label: "PUT · 5 MB clip" },
        { type: "state", node: "storage", light: "work" },
        { type: "note", node: "creator", text: "one request, no parts", with: true },
      ],
    },
  ],
};
