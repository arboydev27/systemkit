import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Separate names from bytes": Metadata DB holds each file's row (ID, owner, folder, name, current revision,
// status, size, access rules) and its revision manifests; Object storage holds the immutable blocks. Renaming a 2 GB
// file updates one row and moves no bytes. Revision 7 is current; revision 8 has three blocks. The File API inserts
// revision 8 as pending with its manifest, the Laptop uploads the three blocks, the File API checks all three
// checksums, and one transaction sets the current revision to 8 and appends a change-log entry. Replayed with a crash
// before that commit, readers keep revision 7. Last, a Reconciler matches pending revisions against stored blocks
// before anything is deleted.
// The chapter's floor plan B: the Laptop in tier 0, the File API and Object storage side by side in tier 1 (two doors,
// since the Laptop uploads blocks straight to storage), Metadata DB behind the File API and the Reconciler behind
// storage in tier 2. The manifest is a note and a readout on Metadata DB, where it lives, not a part. Replies are notes
// on the part that answers, so a reduced-motion still never rests a reply over its request on the same hop.
export const driveMetadataStage: StageScene = {
  id: "drive-metadata",
  intro: "Watch revision 8 of a file go in pending, gain its blocks, and become current only once all three check out.",
  metrics: [
    { id: "readers", label: "Readers see" },
    { id: "blocks", label: "Blocks verified" },
  ],
  nodes: [
    { id: "laptop", role: "client", label: "Laptop", detail: "edits a file", at: [0, 0] },
    { id: "api", role: "web", label: "File API", detail: "orders the steps", at: [1, -1] },
    { id: "storage", role: "storage", label: "Object storage", detail: "immutable blocks", at: [1, 1] },
    { id: "db", role: "database", label: "Metadata DB", detail: "names, revisions", at: [2, -1] },
    { id: "reconciler", role: "worker", label: "Reconciler", detail: "finds orphans", at: [2, 1], appear: 6 },
  ],
  links: [
    { from: "laptop", to: "api" },
    { from: "laptop", to: "storage" },
    { from: "api", to: "storage" },
    { from: "api", to: "db" },
    { from: "reconciler", to: "db" },
    { from: "reconciler", to: "storage" },
  ],
  steps: [
    {
      title: "Names in metadata, bytes in object storage",
      short: "Two stores",
      text: "Metadata DB holds each file’s row: its ID, owner, folder, name, current revision, status, size and access rules. Object storage holds the immutable blocks a file is split into. A manifest lists a revision’s ordered block keys and checksums, so a download can rebuild it.",
      focus: ["db", "storage"],
      frame: ["laptop", "api", "storage", "db"],
      facts: [["Current", "rev 7"], ["Manifest", "block keys, checksums"]],
      metrics: { readers: "rev 7" },
      changes: ["+ File rows and manifests in Metadata DB", "+ Immutable blocks in Object storage"],
      events: [
        { type: "state", node: "db", light: "on" },
        { type: "note", node: "db", text: "row + manifest", with: true },
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "rev 7’s blocks", with: true },
      ],
    },
    {
      title: "Renaming a 2 GB file updates one row",
      short: "Rename",
      text: "The Laptop renames a 2 GB file. The File API updates one row in Metadata DB, and Object storage moves no bytes: a stable file ID keeps the file’s identity and history through the rename.",
      frame: ["laptop", "api", "storage", "db"],
      facts: [["File", "2 GB"], ["Rows updated", "1"], ["Bytes moved", "0"]],
      changes: ["~ Name changed in 1 row", "~ File ID unchanged", "~ 0 bytes moved"],
      events: [
        { type: "state", nodes: ["db", "storage"], light: "idle" },
        { type: "packet", path: ["laptop", "api"], label: "rename" },
        { type: "state", node: "api", light: "on" },
        { type: "packet", path: ["api", "db"], label: "UPDATE 1 row" },
        { type: "state", node: "db", light: "work", readout: "1 row updated" },
        { type: "note", node: "db", text: "same file ID", tone: "work", with: true },
        { type: "note", node: "storage", text: "0 bytes moved", with: true },
      ],
    },
    {
      title: "Revision 8 starts as pending",
      short: "Pending",
      text: "The Laptop saves revision 8, which has three blocks. Before any bytes move, the File API inserts revision 8 into Metadata DB as pending, with its manifest of three block keys and checksums. Readers still see revision 7.",
      focus: ["laptop", "api", "db"],
      frame: ["laptop", "api", "storage", "db"],
      facts: [["Rev 8", "3 blocks"], ["Status", "pending"]],
      metrics: { readers: "rev 7", blocks: { n: 0, unit: " of 3" } },
      changes: ["+ Rev 8, pending", "+ Manifest of 3 block keys", "~ Readers still on rev 7"],
      events: [
        { type: "state", nodes: ["api", "db"], light: "idle" },
        { type: "packet", path: ["laptop", "api"], label: "save rev 8" },
        { type: "state", node: "api", light: "on" },
        { type: "packet", path: ["api", "db"], label: "INSERT rev 8" },
        { type: "state", node: "db", light: "on", readout: "rev 8 pending" },
      ],
    },
    {
      title: "The laptop uploads three blocks",
      short: "Upload",
      text: "The Laptop uploads revision 8’s three blocks straight to Object storage. Metadata DB and Object storage can’t share one transaction, so these bytes land before the File API has checked them: revision 8 is still pending, and readers still see revision 7.",
      focus: ["laptop", "storage"],
      frame: ["laptop", "api", "storage", "db"],
      facts: [["Uploaded", "3 blocks"], ["Rev 8", "still pending"]],
      changes: ["+ 3 blocks in Object storage", "~ Rev 8 still pending"],
      events: [
        { type: "state", node: "api", light: "idle" },
        { type: "packet", path: ["laptop", "storage"], label: "3 blocks · rev 8" },
        { type: "state", node: "storage", light: "on", readout: "3 new blocks" },
      ],
    },
    {
      title: "Verify every block, then commit once",
      short: "Commit",
      text: "The File API checks that all three blocks exist with the right checksums. Only then does one Metadata DB transaction set the current revision to 8 and append a change-log entry, so readers see revision 8.",
      focus: ["api", "storage", "db"],
      frame: ["laptop", "api", "storage", "db"],
      facts: [["Checked", "3 of 3 blocks"], ["One commit", "current = 8 + log entry"]],
      metrics: { readers: "rev 8", blocks: { n: 3, unit: " of 3" } },
      changes: ["+ 3 of 3 checksums match", "~ Current revision: 7 → 8", "+ Change-log entry, same transaction"],
      events: [
        { type: "packet", path: ["api", "storage"], label: "check 3 checksums" },
        { type: "state", node: "storage", light: "work" },
        { type: "note", node: "storage", text: "3 of 3 match", tone: "work", with: true },
        { type: "packet", path: ["api", "db"], label: "commit rev 8" },
        { type: "state", node: "db", light: "work", readout: "current rev 8" },
        { type: "note", node: "db", text: "change logged", tone: "work", with: true },
        { type: "state", node: "api", light: "work", with: true },
      ],
    },
    {
      title: "A crash before the commit keeps revision 7",
      short: "Crash",
      text: "Replay it with a crash. The three blocks land in Object storage, then the File API crashes before it verifies or commits. Metadata DB still says current revision 7 with revision 8 pending, so readers keep revision 7 and nothing half-published shows.",
      frame: ["laptop", "api", "storage", "db"],
      facts: [["Blocks stored", "3, unverified"], ["Current", "rev 7"]],
      metrics: { readers: "rev 7", blocks: { n: 0, unit: " of 3" } },
      changes: ["− File API crashes before commit", "~ Current revision stays 7", "~ Rev 8 stays pending"],
      events: [
        { type: "state", node: "db", light: "on", readout: "current rev 7" },
        { type: "state", node: "storage", light: "idle", readout: "", with: true },
        { type: "state", node: "api", light: "idle", with: true },
        { type: "packet", path: ["laptop", "storage"], label: "3 blocks · rev 8" },
        { type: "state", node: "storage", light: "on", readout: "3 new blocks" },
        { type: "state", node: "api", light: "hot", tone: "hot", down: true },
        { type: "note", node: "api", text: "crashed", tone: "hot", with: true },
        { type: "note", node: "db", text: "rev 8 pending" },
      ],
    },
    {
      title: "Reconcile orphans before deleting",
      short: "Reconcile",
      text: "The cost of two stores is cleanup: abandoned uploads leave blocks no manifest references. The Reconciler matches pending revisions in Metadata DB against Object storage, then publishes or cleans up; nothing is deleted before that. A very small service can keep small files in the database instead.",
      focus: ["reconciler", "db", "storage"],
      frame: ["laptop", "api", "storage", "db", "reconciler"],
      facts: [["Orphans", "blocks no manifest lists"], ["Before deleting", "reconcile"]],
      changes: ["+ Reconciler", "~ File API back up", "~ Pending rev 8 checked, not deleted"],
      events: [
        { type: "state", node: "api", light: "idle", tone: "", down: false },
        { type: "state", node: "storage", readout: "3 unverified", with: true },
        { type: "state", node: "db", readout: "rev 8 pending", with: true },
        { type: "show", nodes: ["reconciler"], with: true },
        { type: "packet", path: ["reconciler", "db"], label: "pending revisions?" },
        { type: "packet", path: ["reconciler", "storage"], label: "orphaned blocks?", with: true },
        { type: "state", node: "reconciler", light: "on" },
        { type: "note", node: "reconciler", text: "publish or clean up", with: true },
      ],
    },
  ],
};
