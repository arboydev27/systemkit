import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Preserve competing edits": a timeline with three lifelines, Phone, Metadata DB and Laptop, the database in
// the middle because the compare-and-set runs in its commit (as the wallet row sits between the payments in
// tx-lost-update). The clock runs on its own (no ticks): a beat is one message. Both devices sync revision 12 and go
// offline, and each edits its copy; every upload declares its base revision. The Phone reconnects first: base 12 matches
// current 12, so it publishes revision 13. The Laptop then commits base 12, which no longer matches 13, so its bytes are
// kept as a conflicted copy beside 13 (Dropbox's name, from the lesson): both edits kept, and the cost falls on people.
// That first telling runs 7 beats. A rewind replays it with silent last-writer-wins: no base check, the Laptop's upload
// overwrites revision 13 and the Phone's edit is lost (1 of 2 kept, orange); the overwriting revision isn't numbered,
// as the lesson doesn't number it. A last rewind starts from revision 13: the Laptop goes offline, the Phone deletes the
// file, Metadata DB keeps a tombstone under the file's stable ID, and when the Laptop syncs its old copy the tombstone
// tells it to remove it rather than bring the file back. Metadata DB's detail tracks the current revision; "Current"
// and "Edits kept" are the chips. The lesson's 109-blocks-not-1,000 retention example is left to the text.
export const driveConflictsStage: StageScene = {
  id: "drive-conflicts",
  layout: "timeline",
  intro: "Watch a phone and a laptop edit revision 12 offline, see which edit publishes and what becomes of the other, then replay it two other ways.",
  metrics: [{ id: "current", label: "Current" }, { id: "kept", label: "Edits kept" }],
  nodes: [
    { id: "phone", role: "phone", label: "Phone", detail: "edits rev 12", at: [0, 0] },
    { id: "db", role: "database", label: "Metadata DB", detail: "current rev 12", at: [1, 0] },
    { id: "laptop", role: "client", label: "Laptop", detail: "edits rev 12", at: [2, 0] },
  ],
  links: [],
  steps: [
    {
      title: "Both devices start from revision 12",
      short: "Same base",
      text: "The Phone and the Laptop both sync a file at revision 12, the current revision in Metadata DB. Then both go offline, so neither sees what the other does next.",
      metrics: { current: "rev 12", kept: { n: 0, unit: " of 2" } },
      facts: [["Both start from", "rev 12"]],
      changes: ["+ Phone has rev 12", "+ Laptop has rev 12", "+ Both offline"],
      events: [
        { type: "packet", path: ["db", "phone"], label: "rev 12", kind: "response" },
        { type: "packet", path: ["db", "laptop"], label: "rev 12", kind: "response", with: true },
        { type: "span", id: "phone-off", node: "phone", label: "offline", tone: "quiet", dur: 0.5 },
        { type: "span", id: "laptop-off", node: "laptop", label: "offline", tone: "quiet", with: true },
      ],
    },
    {
      title: "Each edits its copy offline",
      short: "Offline edits",
      text: "Offline, each device edits its own copy of revision 12. When it reconnects, its upload will declare the revision its edit started from, base 12, so Metadata DB can tell whether the file has changed since.",
      facts: [["Each upload declares", "its base revision"], ["Both bases", "rev 12"]],
      changes: ["+ Phone’s edit on rev 12", "+ Laptop’s edit on rev 12"],
      events: [
        { type: "mark", node: "phone", text: "edit on rev 12" },
        { type: "mark", node: "laptop", text: "edit on rev 12", with: true },
      ],
    },
    {
      title: "The phone’s base matches: revision 13",
      short: "Phone first",
      text: "The Phone reconnects first and commits with base 12. Metadata DB compares that base with the current revision, a check called compare-and-set. 12 matches 12, so the Phone’s edit publishes as revision 13, a new immutable version.",
      focus: ["phone", "db"],
      metrics: { current: "rev 13", kept: { n: 1, unit: " of 2" } },
      facts: [["Base = current", "12 = 12"], ["Publishes", "rev 13, immutable"]],
      changes: ["~ Phone back online", "+ Revision 13 published"],
      events: [
        { type: "span", id: "phone-off", end: true },
        { type: "packet", path: ["phone", "db"], label: "commit, base 12" },
        { type: "mark", node: "db", text: "12 = 12 → rev 13", tone: "work" },
        { type: "state", node: "db", detail: "current rev 13", with: true },
        { type: "packet", path: ["db", "phone"], label: "rev 13", kind: "response" },
      ],
    },
    {
      title: "The laptop’s stale base becomes a copy",
      short: "Conflict copy",
      text: "The Laptop reconnects and commits with base 12, but the current revision is now 13, so the check fails. Its bytes aren’t written over 13: they’re kept as a conflicted copy beside it. The user compares, merges where the format allows, or chooses, so the copies cost people time.",
      focus: ["db", "laptop"],
      metrics: { current: "rev 13", kept: { n: 2, unit: " of 2" } },
      facts: [["Base ≠ current", "12 ≠ 13"], ["In Dropbox", "a “conflicted copy” file"]],
      changes: ["~ Laptop back online", "+ Conflicted copy beside revision 13"],
      events: [
        { type: "span", id: "laptop-off", end: true },
        { type: "packet", path: ["laptop", "db"], label: "commit, base 12" },
        { type: "mark", node: "db", text: "12 ≠ 13", tone: "hot" },
        { type: "state", node: "db", detail: "rev 13 + 1 copy", with: true },
        { type: "packet", path: ["db", "laptop"], label: "conflicted copy", kind: "response" },
      ],
    },
    {
      title: "Last-writer-wins loses the phone’s edit",
      short: "Last-writer-wins",
      text: "Replay it with silent last-writer-wins, where the latest upload replaces the rest with no base check. The Phone publishes revision 13, then the Laptop’s upload overwrites it, and the Phone’s edit is gone. It can be acceptable for data that is cheap to regenerate, such as cached thumbnails.",
      metrics: { current: "laptop’s edit", kept: { n: 1, unit: " of 2", tone: "hot" } },
      facts: [["Base check", "none"], ["Can be fine for", "cached thumbnails"]],
      changes: ["~ No base check", "~ Laptop’s upload replaces revision 13", "− Phone’s edit"],
      events: [
        { type: "rewind" },
        { type: "state", node: "db", detail: "current rev 12", gap: 0 },
        { type: "packet", path: ["db", "phone"], label: "rev 12", kind: "response", gap: 0 },
        { type: "packet", path: ["db", "laptop"], label: "rev 12", kind: "response", with: true },
        { type: "span", id: "phone-off", node: "phone", label: "offline", tone: "quiet", dur: 0.5, gap: 60 },
        { type: "span", id: "laptop-off", node: "laptop", label: "offline", tone: "quiet", with: true },
        { type: "mark", node: "phone", text: "edit", gap: 60 },
        { type: "mark", node: "laptop", text: "edit", with: true },
        { type: "span", id: "phone-off", end: true },
        { type: "packet", path: ["phone", "db"], label: "upload", gap: 0 },
        { type: "mark", node: "db", text: "rev 13", tone: "work" },
        { type: "state", node: "db", detail: "current rev 13", with: true },
        { type: "span", id: "laptop-off", end: true },
        { type: "packet", path: ["laptop", "db"], label: "upload", gap: 0 },
        { type: "mark", node: "db", text: "overwrites rev 13", tone: "hot" },
        { type: "mark", node: "phone", text: "edit lost", tone: "hot", with: true },
        { type: "state", node: "db", detail: "laptop’s edit", with: true },
      ],
    },
    {
      title: "Deleting the file leaves a tombstone",
      short: "Tombstone",
      text: "Deletions can conflict too. Replay from revision 13: the Laptop goes offline, then the Phone deletes the file. Metadata DB doesn’t forget the file: it keeps a tombstone under the file’s stable ID, a record that the file was deleted.",
      focus: ["phone", "db"],
      metrics: { current: "deleted", kept: "—" },
      facts: [["Tombstone", "says it was deleted"], ["Kept under", "the file’s stable ID"]],
      changes: ["~ Laptop offline with revision 13", "− File deleted", "+ Tombstone"],
      events: [
        { type: "rewind" },
        { type: "state", node: "phone", detail: "deletes the file", gap: 0 },
        { type: "state", node: "laptop", detail: "has rev 13", with: true },
        { type: "state", node: "db", detail: "current rev 13", with: true },
        { type: "span", id: "laptop-off", node: "laptop", label: "offline", tone: "quiet", dur: 0.5 },
        { type: "packet", path: ["phone", "db"], label: "delete file" },
        { type: "mark", node: "db", text: "tombstone", tone: "work" },
        { type: "state", node: "db", detail: "deleted: tombstone", with: true },
      ],
    },
    {
      title: "The tombstone keeps the file deleted",
      short: "Stays deleted",
      text: "The Laptop reconnects still holding revision 13. Metadata DB finds the tombstone and answers that the file was deleted, so the Laptop removes its local copy. Without a tombstone, that copy would look like a file the server has never seen, and syncing it would bring the deleted file back.",
      focus: ["db", "laptop"],
      facts: [["With a tombstone", "copy removed"], ["Without one", "the file comes back"]],
      changes: ["~ Laptop back online", "− Laptop’s local copy"],
      events: [
        { type: "span", id: "laptop-off", end: true },
        { type: "packet", path: ["laptop", "db"], label: "have rev 13" },
        { type: "packet", path: ["db", "laptop"], label: "file deleted", kind: "response" },
        { type: "mark", node: "laptop", text: "copy removed", tone: "work" },
      ],
    },
  ],
};
