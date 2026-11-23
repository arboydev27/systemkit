import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Update pages in place with a B-tree": fixed-size pages (8 KB Postgres, 16 KB InnoDB) where, at an example 400
// entries a page, three levels reach 64 million entries and four 25.6 billion; a lookup for parcel 8841 walks root to
// leaf with one disk read; 8841 shipped dirties its leaf in the buffer pool and is logged at offset 0, synced at commit;
// 8850 splits the full leaf (3 dirty pages, the split and 8850 at offsets 1–2); a checkpoint writes them in place and its
// mark moves from 0 to 3; 1203 packed, the first change to its page since, logs a full page copy with it (offsets 3–4);
// a power cut tears that page mid-write; and recovery replays only the 2 records past the mark, the copy making it whole.
export const seBtreeStage: StageScene = {
  id: "se-btree",
  intro: "Follow parcel 8841 down a B-tree to its page and change it in memory, then see the log and a checkpoint bring a torn page back.",
  metrics: [
    { id: "dirty", label: "Dirty pages" },
    { id: "replay", label: "Log to replay", derive: { lag: ["wal", "checkpoint"] } },
  ],
  // The buffer pool stands between the App and the disk: the B-tree up and to the right on one straight cable, far
  // enough out that messages resting at the foot of the log's cable keep clear of its tag, and the write-ahead log down
  // and to the right with its strip under it. On a phone the two share the last row either side of the pool, so notes
  // over the tree stay short.
  nodes: [
    { id: "app", role: "web", label: "App", detail: "parcel tracking", at: [0, 0], appear: 1 },
    { id: "pool", role: "cache", label: "Buffer pool", detail: "pages in memory", at: [1, 0], appear: 1 },
    { id: "tree", role: "tree", label: "B-tree", detail: "8 KB pages", at: [2.2, -0.98], opts: { count: 2 } },
    { id: "wal", role: "disk", label: "Write-ahead log", detail: "on disk", at: [2.2, 0.95], appear: 2 },
  ],
  links: [
    { from: "app", to: "pool" },
    { from: "pool", to: "tree" },
    { from: "pool", to: "wal" },
  ],
  logs: [{ id: "wal", node: "wal", side: "below", appear: 2 }],
  steps: [
    {
      title: "Wide pages keep the tree shallow",
      short: "Pages",
      text: "Postgres and InnoDB keep data in B-trees of fixed-size pages, 8 KB and 16 KB by default. Each page holds sorted keys and references to child pages; leaves hold the rows or pointers to them. At an example 400 entries a page, three levels reach 64 million entries, four 25.6 billion.",
      facts: [["Page size", "8 KB or 16 KB"], ["3 levels", "64 million entries"], ["4 levels", "25.6 billion"]],
      changes: ["+ Root, inner and leaf pages", "~ 400 entries per page"],
      events: [
        { type: "state", node: "tree", light: "on", readout: "400 entries a page" },
        { type: "note", node: "tree", text: "3 levels: 64 million" },
      ],
    },
    {
      title: "A lookup walks one path, root to leaf",
      short: "Lookup",
      text: "The App reads parcel 8841. The engine walks from the root to the one leaf whose key range holds 8841. The root and inner pages are already in the buffer pool, so only the leaf costs a disk read: one read, sometimes two. Each key has one home, so reads are predictable.",
      facts: [["In memory", "root and inner pages"], ["Disk reads", "1, sometimes 2"]],
      changes: ["+ App and buffer pool", "~ 1 disk read, for the leaf"],
      metrics: { dirty: 0 },
      events: [
        { type: "state", node: "tree", light: "idle", readout: "" },
        { type: "packet", path: ["app", "pool"], label: "read 8841" },
        { type: "state", node: "pool", light: "work" },
        { type: "note", node: "pool", text: "root, inner: in memory", tone: "work", with: true },
        { type: "packet", path: ["pool", "tree"], label: "read leaf page" },
        { type: "state", node: "tree", light: "work", opts: { count: 2, mark: 1 } },
        { type: "note", node: "tree", text: "1 disk read", tone: "work", with: true },
        { type: "packet", path: ["tree", "pool", "app"], label: "8841 packed", kind: "response" },
      ],
    },
    {
      title: "A change dirties its page and is logged",
      short: "Update",
      text: "Parcel 8841 ships. Its leaf page changes in the buffer pool and is now dirty, to be written back to the same place later. Overwriting in place is risky, so the change first goes in the write-ahead log, synced at commit: the commit is safe though the page is only in memory.",
      facts: [["Logged", "8841 shipped"], ["Dirty", "8841’s leaf page"]],
      changes: ["~ 8841’s leaf page dirty in memory", "+ 8841 shipped in the log, synced", "~ 1 record past the last checkpoint"],
      metrics: { dirty: 1 },
      events: [
        { type: "state", node: "tree", light: "idle" },
        { type: "packet", path: ["app", "pool"], label: "8841 shipped" },
        { type: "state", node: "pool", light: "work" },
        // the last checkpoint, taken before this story starts: everything logged from here on is what recovery replays
        { type: "cursor", log: "wal", id: "checkpoint", at: "end", label: "checkpoint", line: true, with: true },
        { type: "append", log: "wal", from: "pool", records: [{ text: "8841 shipped", key: "8841" }] },
        { type: "note", node: "wal", text: "synced at commit", tone: "work" },
        { type: "packet", path: ["wal", "pool", "app"], label: "commit ok", kind: "response" },
      ],
    },
    {
      title: "A full page splits in two",
      short: "Split",
      text: "Parcel 8850 belongs in 8841’s leaf, which is full, so the leaf splits in two and the parent gains a key for the new page; a full parent would split too. Both changes are logged, and 3 pages are now dirty: two leaves and the parent.",
      facts: [["Leaf", "1 page → 2"], ["Parent", "gains a key"], ["Dirty pages", "3"]],
      changes: ["+ A new leaf page", "~ Parent gains a key", "+ Leaf split, 8850 new in the log"],
      metrics: { dirty: 3 },
      events: [
        { type: "packet", path: ["app", "pool"], label: "8850 new" },
        { type: "note", node: "tree", text: "leaf split" },
        { type: "state", node: "tree", light: "work", opts: { count: 3, mark: 2 }, with: true },
        { type: "append", log: "wal", from: "pool", records: [{ text: "leaf split" }] },
        { type: "append", log: "wal", from: "pool", records: [{ text: "8850 new", key: "8850" }], gap: 120 },
      ],
    },
    {
      title: "A checkpoint writes dirty pages in place",
      short: "Checkpoint",
      text: "A checkpoint writes the 3 dirty pages back, each over its old copy in the same place on disk, and moves its mark to the log’s end. After a crash, recovery replays only the log past the mark: nothing now.",
      facts: [["Written", "3 pages, in place"], ["Replay from", "the checkpoint"]],
      changes: ["~ 3 pages written back in place", "~ Checkpoint moved to the log’s end", "− Dirty pages"],
      metrics: { dirty: 0 },
      events: [
        { type: "packet", path: ["pool", "tree"], label: "write 3 pages", kind: "work" },
        { type: "state", node: "tree", light: "work" },
        { type: "note", node: "tree", text: "in place", tone: "work", with: true },
        { type: "state", node: "pool", light: "on" },
        { type: "cursor", log: "wal", id: "checkpoint", at: "end" },
      ],
    },
    {
      title: "The first change logs a copy of the page",
      short: "Page copy",
      text: "Parcel 1203 is packed, the first change to its leaf page since the checkpoint. A power cut mid-write can tear a page, half old and half new, so Postgres logs a full copy of the page along with the change; InnoDB writes pages to a doublewrite buffer instead.",
      facts: [["Postgres", "full page copy in the log"], ["InnoDB", "doublewrite buffer"]],
      changes: ["+ Page copy and 1203 packed in the log", "~ 1203’s leaf page dirty"],
      metrics: { dirty: 1 },
      events: [
        { type: "state", node: "tree", light: "on", opts: { count: 3, mark: 0 } },
        { type: "packet", path: ["app", "pool"], label: "1203 packed" },
        { type: "state", node: "pool", light: "work" },
        { type: "append", log: "wal", from: "pool", records: [{ text: "page copy", tone: "work" }] },
        { type: "append", log: "wal", from: "pool", records: [{ text: "1203 packed", key: "1203" }], gap: 120 },
        { type: "note", node: "pool", text: "whole page logged", tone: "work" },
      ],
    },
    {
      title: "A power cut tears a page mid-write",
      short: "Torn page",
      text: "The engine starts writing 1203’s page back and the power fails mid-write: the page on disk is torn, half old and half new, and the buffer pool is gone. A crash mid-split is as bad, leaving a parent pointing at a page never written. The log, synced at each commit, is intact.",
      facts: [["On disk", "1203’s page, torn"], ["Lost", "the buffer pool"], ["Kept", "the synced log"]],
      changes: ["− Buffer pool, lost with the power", "~ 1203’s page torn on disk"],
      metrics: { dirty: { n: 1, unit: " lost", tone: "hot" } },
      events: [
        { type: "packet", path: ["pool", "tree"], label: "1203’s page", kind: "work" },
        { type: "state", node: "pool", light: "hot", tone: "hot", down: true },
        { type: "note", node: "pool", text: "power cut", tone: "hot", with: true },
        { type: "state", node: "tree", light: "hot", tone: "hot" },
        { type: "note", node: "tree", text: "torn page", tone: "hot", with: true },
      ],
    },
    {
      title: "Recovery replays the log from the checkpoint",
      short: "Recover",
      text: "On restart the engine replays only the 2 records past the checkpoint: the copy rebuilds 1203’s page in the buffer pool, 1203 packed is redone on it, and the page goes back whole. So a small change costs a log record and, eventually, a whole page write.",
      facts: [["Replayed", "2 records"], ["Skipped", "3, before the mark"]],
      changes: ["+ 1203’s page rebuilt from the copy", "~ 1203 packed redone", "~ Page written back whole"],
      metrics: { dirty: 0 },
      events: [
        { type: "state", node: "pool", light: "on", tone: "", down: false },
        { type: "read", log: "wal", at: 3, to: "pool" },
        { type: "state", node: "pool", light: "work" },
        { type: "read", log: "wal", at: 4, to: "pool" },
        { type: "packet", path: ["pool", "tree"], label: "1203’s page", kind: "work" },
        { type: "state", node: "tree", light: "work", tone: "" },
        { type: "note", node: "tree", text: "whole again", tone: "work", with: true },
        { type: "state", node: "pool", light: "on", with: true },
      ],
    },
  ],
};
