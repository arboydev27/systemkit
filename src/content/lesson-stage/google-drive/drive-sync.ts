import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Sync through a change log": every commit appends one event (file, revision, operation) to the change log in
// Metadata DB, whose offset is its sequence; the strip starts at 5,117 and the Laptop has applied through 5,120, drawn
// as its cursor line. The Phone commits two edits to file f8, events 5,121 (rev 4) and 5,122 (rev 5). The Notifier
// sends the Laptop a hint over its held connection, carrying no data. The Laptop asks for changes after 5,120, gets
// 5,121 and 5,122 as one page, applies both, and crashes before saving its cursor, so the saved position still says
// 5,120; it asks again from 5,120, applies both a second time without harm and saves 5,122. Last, the log keeps 30
// days: had the Laptop been away 90 days, it would load a snapshot, then resume from its boundary. That step is a
// what-if, so the picture keeps the live cursor at 5,122 and asks "90 days away?" instead of stating it.
// Notes over the Laptop stay short (13 characters at most) and plain: on a phone it stands at the right edge of its row,
// the camera frames a note's height but not its width, and a tone's dot would widen the pill past the stage's edge
// (its blue light says the work is done).
// The chapter's sync floor plan: the two devices in tier 0, the File API and the Notifier in tier 1, Metadata DB behind
// the File API in tier 2 with the change log lying to its right (nothing stands in tiers 3 and 4 of lane -1). On a phone
// that is three rows of at most two parts, the strip under the last.
// Reduced motion rests every message on its hop, clear only of the two parts it joins. So the Laptop and the Notifier
// stand at lane 1.6, which gives the Laptop–File API cable room for a request and its reply on a wide stage; Metadata DB
// has no detail (the strip beside it says "Change log"), so its one-line tag leaves room under it for the request; one
// label per cable where two messages share it (the commits go unlabelled, the strip's records name them).
export const driveSyncStage: StageScene = {
  id: "drive-sync",
  intro: "Watch a laptop catch up on a phone’s two edits by reading the change log after its saved cursor.",
  metrics: [
    { id: "cursor", label: "Laptop cursor" },
    { id: "after", label: "After cursor", derive: { lag: ["changes", "laptop"] } },
  ],
  nodes: [
    { id: "phone", role: "phone", label: "Phone", detail: "commits 2 edits", at: [0, -1] },
    { id: "laptop", role: "client", label: "Laptop", detail: "cursor 5,120", at: [0, 1.6] },
    { id: "api", role: "web", label: "File API", detail: "commits, changes", at: [1, -1] },
    { id: "notifier", role: "socket", label: "Notifier", detail: "wake-up hints", at: [1, 1.6], opts: { items: 2 } },
    { id: "db", role: "database", label: "Metadata DB", at: [2, -1] },
  ],
  links: [
    { from: "phone", to: "api" },
    { from: "laptop", to: "api" },
    { from: "api", to: "db" },
    { from: "api", to: "notifier" },
    { from: "notifier", to: "laptop" },
  ],
  logs: [
    {
      id: "changes",
      node: "db",
      label: "Change log",
      start: 5117,
      records: [{ text: "f2 r8 edit" }, { text: "f5 r1 add" }, { text: "f8 r3 edit" }, { text: "f2 r9 edit" }],
    },
  ],
  steps: [
    {
      title: "Each commit adds one event to the log",
      short: "Change log",
      text: "Each committed change adds one event to the change log in Metadata DB: the file, its revision and the operation, numbered in order. The Laptop saves a cursor, the position of its last applied event: 5,120.",
      focus: ["api", "db", "laptop"],
      frame: ["phone", "laptop", "api", "notifier", "db"],
      facts: [["Event", "file, rev, operation"], ["Laptop cursor", "5,120"]],
      metrics: { cursor: "5,120" },
      changes: ["+ Change log through 5,120", "+ Laptop cursor at 5,120"],
      events: [
        { type: "state", node: "db", light: "on" },
        { type: "cursor", log: "changes", id: "laptop", at: "end", label: "laptop", line: true },
        { type: "note", node: "laptop", text: "cursor 5,120" },
      ],
    },
    {
      title: "The phone commits two edits",
      short: "Commits",
      text: "The Phone commits two edits to file f8. Each commit appends one event to the change log: 5,121 for revision 4, then 5,122 for revision 5. Two events now lie after the Laptop’s cursor.",
      focus: ["phone", "api", "db"],
      frame: ["phone", "laptop", "api", "notifier", "db"],
      facts: [["New events", "5,121 and 5,122"]],
      changes: ["+ 5,121: f8, rev 4, edit", "+ 5,122: f8, rev 5, edit"],
      events: [
        { type: "state", node: "phone", light: "on" },
        { type: "packet", path: ["phone", "api"], label: "" },
        { type: "append", log: "changes", from: "api", records: [{ text: "f8 r4 edit" }] },
        { type: "packet", path: ["phone", "api"], label: "" },
        { type: "append", log: "changes", from: "api", records: [{ text: "f8 r5 edit" }] },
      ],
    },
    {
      title: "A hint wakes the laptop, without the data",
      short: "Hint",
      text: "The Notifier sends the Laptop a hint over its held connection: changes are waiting. Push, long polling or a WebSocket can carry it, but hints can be duplicated or missed, so the Laptop also polls now and then and always pulls from the log.",
      focus: ["api", "notifier", "laptop"],
      frame: ["phone", "laptop", "api", "notifier", "db"],
      changes: ["+ Hint to the Laptop", "~ No file data in the hint"],
      events: [
        { type: "state", node: "phone", light: "idle" },
        { type: "packet", path: ["api", "notifier", "laptop"], label: "hint", kind: "work" },
        { type: "state", node: "notifier", light: "work" },
        { type: "note", node: "laptop", text: "hint, no data", with: true },
      ],
    },
    {
      title: "The laptop pulls the changes after 5,120",
      short: "Pull",
      text: "The Laptop asks the File API for changes after its cursor, 5,120. The File API reads 5,121 and 5,122 from the log and returns them as one page. The Laptop fetches their metadata and only the missing blocks, and rebuilds f8.",
      focus: ["laptop", "api", "db"],
      frame: ["phone", "laptop", "api", "notifier", "db"],
      changes: ["+ One page: 5,121 and 5,122", "~ f8 rebuilt at rev 5", "~ Cursor not saved yet"],
      events: [
        { type: "state", node: "notifier", light: "idle" },
        { type: "packet", path: ["laptop", "api"], label: "after 5,120" },
        // one page: the second read follows close on the first, and the bracket marks the page as it goes
        { type: "read", log: "changes", at: 5121, to: "api" },
        { type: "read", log: "changes", at: 5122, to: "api", gap: 120 },
        { type: "bracket", log: "changes", id: "page", from: 5121, to: 5122, label: "one page", with: true },
        { type: "packet", path: ["api", "laptop"], label: "2 events", kind: "response" },
        { type: "state", node: "laptop", light: "work" },
        { type: "note", node: "laptop", text: "applied both", with: true },
      ],
    },
    {
      title: "The laptop crashes before saving its cursor",
      short: "Crash",
      text: "The Laptop crashes after applying both events but before saving its cursor. A device advances its cursor only after its local state is durable, so the saved position still says 5,120, with two events after it.",
      focus: ["laptop", "db"],
      frame: ["phone", "laptop", "api", "notifier", "db"],
      facts: [["Saved cursor", "5,120"]],
      changes: ["− Laptop crashes before saving", "~ Saved cursor still 5,120"],
      events: [
        { type: "state", node: "laptop", light: "hot", tone: "hot", down: true },
        { type: "note", node: "laptop", text: "crashed", tone: "hot", with: true },
      ],
    },
    {
      title: "Asking again from 5,120 is harmless",
      short: "Ask again",
      text: "The Laptop restarts and asks again for changes after 5,120. It applies 5,121 and 5,122 a second time with the same result, then saves its cursor at 5,122. Applying an event twice must be harmless.",
      focus: ["laptop", "api", "db"],
      frame: ["phone", "laptop", "api", "notifier", "db"],
      metrics: { cursor: "5,122" },
      changes: ["~ 5,121 and 5,122 applied again", "~ Laptop cursor 5,122"],
      events: [
        { type: "state", node: "laptop", light: "on", tone: "", down: false },
        { type: "packet", path: ["laptop", "api"], label: "after 5,120" },
        { type: "read", log: "changes", at: 5121, to: "api" },
        { type: "read", log: "changes", at: 5122, to: "api", gap: 120 },
        { type: "packet", path: ["api", "laptop"], label: "2 events", kind: "response" },
        { type: "state", node: "laptop", light: "work", detail: "cursor 5,122" },
        { type: "note", node: "laptop", text: "applied twice", with: true },
        { type: "cursor", log: "changes", id: "laptop", at: "end" },
      ],
    },
    {
      title: "An expired cursor starts from a snapshot",
      short: "Snapshot",
      text: "The change log keeps 30 days. Had the Laptop been away 90 days, its cursor would have expired: it loads a consistent snapshot, then resumes from the snapshot’s boundary. Longer retention spares more devices a snapshot but takes more storage.",
      focus: ["api", "db", "laptop"],
      frame: ["phone", "laptop", "api", "notifier", "db"],
      facts: [["Log keeps", "30 days"], ["If away", "90 days"]],
      changes: ["~ If away 90 days: cursor expired", "+ Snapshot, then later changes"],
      events: [
        { type: "state", node: "laptop", light: "on" },
        { type: "bracket", log: "changes", id: "page", remove: true },
        { type: "note", node: "db", text: "keeps 30 days" },
        { type: "note", node: "laptop", text: "90 days away?", with: true },
        { type: "packet", path: ["api", "laptop"], label: "snapshot", kind: "response" },
        { type: "note", node: "api", text: "sends a snapshot", tone: "work", with: true },
        { type: "state", node: "laptop", light: "work" },
      ],
    },
  ],
};
