import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Buffer in memory, merge on disk": parcels 8841 and 1203 go to the WAL in arrival order and to a memtable in
// key order, which flushes at 64 MB as File 2 and lets the WAL go; a read of 1203 stops at File 2, newest first; a
// delete of 4410 writes a tombstone; Bloom filters rule a missing key out (10 bits per key, about 1% false positives:
// 0.2 needless reads instead of 20 across 20 files); compaction merges Files 1 to 3 and drops what is overwritten or
// deleted; when writes outrun it, files pile up and RocksDB throttles writes.
export const seLsmStage: StageScene = {
  id: "se-lsm",
  intro: "Follow two parcel writes into a log and a sorted memtable, then watch the files they become answer reads and merge.",
  metrics: [
    { id: "files", label: "Sorted files" },
    { id: "reads", label: "Files read" },
  ],
  // The App writes to the WAL, down the floor's diagonal, and to the memtable, across. The memtable, the Bloom filters
  // and the sorted files step down one tier, each strip to the right of its part; the files stand close under the
  // memtable until the filters arrive and they step down to make room, so every cable bends once, clear of the strips
  // (with the files at lane 1 from the start, the memtable's cable to them zigzags round File 2's strip).
  // On a phone the App and the WAL share the first row, the memtable, filters and files the second.
  nodes: [
    { id: "app", role: "web", label: "App", detail: "parcel tracking", at: [0, -1.3] },
    { id: "wal", role: "logfile", label: "Write-ahead log", detail: "on disk", at: [-0.1, 0.4], opts: { items: 0 } },
    { id: "mem", role: "memtable", label: "Memtable", detail: "in memory", at: [1, -1.5], opts: { level: 0 } },
    { id: "bloom", role: "bloom", label: "Bloom filters", detail: "one per file", at: [1, -0.4], appear: 5 },
    { id: "sst", role: "sstable", label: "Sorted files", detail: "immutable, on disk", at: [1, -0.1], opts: { count: 1 } },
  ],
  links: [
    { from: "app", to: "mem" },
    { from: "app", to: "wal" },
    { from: "mem", to: "sst", unless: "bloom" },
    { from: "mem", to: "bloom" },
    { from: "bloom", to: "sst" },
  ],
  // the files lie newest first, so a read goes down them in the order it checks them
  logs: [
    { id: "wal", node: "wal", label: "WAL", side: "below" },
    { id: "mem", node: "mem", label: "Memtable", sorted: true },
    { id: "f5", node: "sst", label: "File 5", sorted: true, appear: 7 },
    { id: "f4", node: "sst", label: "File 4", sorted: true, appear: 7 },
    { id: "merged", node: "sst", label: "Merged", sorted: true, appear: 6 },
    { id: "f3", node: "sst", label: "File 3", sorted: true, appear: 6 },
    { id: "f2", node: "sst", label: "File 2", sorted: true, appear: 2 },
    { id: "f1", node: "sst", label: "File 1", sorted: true, records: [{ text: "1203 new", key: "1203" }, { text: "4410 new", key: "4410" }] },
  ],
  steps: [
    {
      title: "Each write goes to the log, then memory",
      short: "Write",
      text: "An LSM tree never edits a file, since inserting into the middle of a sorted one is expensive. The App writes parcel 8841 as sent: it goes on the end of the write-ahead log at offset 0, so a crash can’t lose it, then into the memtable, a sorted table in memory.",
      focus: ["app", "wal", "mem"],
      frame: ["app", "wal", "mem", "sst"],
      facts: [["Record", "8841 sent"], ["WAL offset", "0"]],
      changes: ["+ 8841 sent at WAL offset 0", "+ 8841 sent in the memtable", "~ File 1 unchanged"],
      metrics: { files: 1 },
      events: [
        // a part's own change goes first in a group: a log event started with others would lose theirs
        { type: "state", node: "wal", opts: { items: 1 } },
        { type: "append", log: "wal", from: "app", records: [{ text: "8841 sent", key: "8841" }], with: true },
        { type: "state", node: "mem", opts: { level: 0.3 } },
        { type: "append", log: "mem", from: "app", records: [{ text: "8841 sent", key: "8841" }], with: true },
      ],
    },
    {
      title: "The memtable keeps keys in order",
      short: "Sorted",
      text: "Parcel 1203 is sent next. The WAL appends it at offset 1, after 8841, in arrival order. The memtable files it by key, ahead of 8841, so it can be written out already sorted. File 1’s older 1203 new isn’t touched.",
      focus: ["app", "wal", "mem"],
      frame: ["app", "wal", "mem", "sst"],
      facts: [["WAL", "8841, 1203"], ["Memtable", "1203, 8841"]],
      changes: ["+ 1203 sent at WAL offset 1", "~ Memtable order: 1203, 8841"],
      events: [
        { type: "state", node: "wal", opts: { items: 2 } },
        { type: "append", log: "wal", from: "app", records: [{ text: "1203 sent", key: "1203" }], with: true },
        { type: "note", node: "mem", text: "sorted by key", tone: "work" },
        { type: "state", node: "mem", opts: { level: 0.6 }, with: true },
        { type: "append", log: "mem", from: "app", records: [{ text: "1203 sent", key: "1203" }], with: true },
      ],
    },
    {
      title: "A full memtable becomes a sorted file",
      short: "Flush",
      text: "At a set size, 64 MB here, the engine writes the memtable out as File 2, a sorted file it never edits, and starts an empty memtable. File 2 now holds what WAL offsets 0 and 1 covered, so that part of the log is discarded.",
      focus: ["wal", "mem", "sst"],
      facts: [["Flush at", "64 MB"], ["File 2", "1203, 8841"]],
      changes: ["+ File 2: 1203 sent, 8841 sent", "~ Memtable empty again", "− WAL offsets 0 and 1"],
      metrics: { files: 2 },
      events: [
        { type: "state", node: "mem", opts: { level: 1 } },
        { type: "note", node: "mem", text: "64 MB: full", with: true },
        { type: "state", node: "sst", opts: { count: 2 } },
        { type: "state", node: "mem", opts: { level: 0 }, with: true },
        { type: "flush", from: "mem", to: "f2", with: true },
        // a log has no event that drops its head: the covered records are struck, then compacted away
        { type: "note", node: "wal", text: "covered by File 2" },
        { type: "record", log: "wal", at: 0, tomb: true, with: true },
        { type: "record", log: "wal", at: 1, tomb: true, gap: 0 },
        { type: "state", node: "wal", opts: { items: 0 }, gap: 0 },
        { type: "compact", log: "wal", with: true },
      ],
    },
    {
      title: "A read stops at the first match",
      short: "Read",
      text: "A read of 1203 checks the memtable, now empty, then the files from newest to oldest. File 2 holds 1203 sent, so the read stops there: File 1’s older 1203 new is never read.",
      focus: ["app", "mem", "sst"],
      frame: ["app", "wal", "mem", "sst"],
      facts: [["Found in", "File 2"], ["Not read", "File 1"]],
      changes: ["~ 1203 sent found in File 2", "~ File 1 not read"],
      metrics: { reads: 1 },
      events: [
        // one message through the memtable to the files, so a still picture rests one pill per cable
        { type: "packet", path: ["app", "mem", "sst"], label: "GET 1203" },
        { type: "note", node: "mem", text: "no 1203", with: true },
        { type: "read", log: "f2", at: 0 },
        { type: "record", log: "f1", at: 0, tone: "quiet", with: true },
        { type: "packet", path: ["sst", "mem", "app"], label: "1203 sent", kind: "response", with: true },
      ],
    },
    {
      title: "A delete writes a tombstone",
      short: "Delete",
      text: "Deleting 4410 edits no file: a tombstone goes into the WAL at offset 2 and into the memtable. A read of 4410 meets the tombstone first and answers not found. File 1 still holds 4410 new, now hidden.",
      focus: ["app", "wal", "mem", "sst"],
      changes: ["+ Tombstone for 4410 at WAL offset 2", "~ 4410 reads as not found", "~ File 1’s 4410 new hidden"],
      metrics: { reads: 0 },
      events: [
        { type: "state", node: "wal", opts: { items: 1 } },
        { type: "append", log: "wal", from: "app", records: [{ text: "4410 del", key: "4410", tomb: true }], with: true },
        { type: "state", node: "mem", opts: { level: 0.3 } },
        { type: "append", log: "mem", from: "app", records: [{ text: "4410 del", key: "4410", tomb: true }], with: true },
        { type: "read", log: "mem", at: 2 },
        { type: "note", node: "mem", text: "not found", with: true },
        // a record a newer one shadows is drawn quiet until compaction drops it
        { type: "record", log: "f1", at: 1, tone: "quiet", with: true },
      ],
    },
    {
      title: "Bloom filters rule files out",
      short: "Bloom filters",
      text: "A lookup of 7702, never written, would read every file. Each file’s Bloom filter answers definitely absent or possibly present; here both say absent, so no file is read. At 10 bits per key a filter gives a false positive about 1% of the time: with 20 files, about 0.2 needless reads instead of 20.",
      focus: ["app", "mem", "bloom", "sst"],
      facts: [["Bits per key", "10"], ["False positives", "about 1%"], ["With 20 files", "0.2 reads, not 20"]],
      changes: ["+ A Bloom filter per file", "~ 7702 ruled out, no file read"],
      metrics: { reads: 0 },
      events: [
        { type: "show", nodes: ["bloom"], at: { sst: [1, 1] } },
        { type: "packet", path: ["app", "mem", "bloom"], label: "GET 7702" },
        { type: "note", node: "mem", text: "no 7702", with: true },
        { type: "state", node: "bloom", light: "work", readout: "definitely absent" },
      ],
    },
    {
      title: "Compaction merges files",
      short: "Compaction",
      text: "The memtable flushes again as File 3, holding the tombstone. Compaction merges Files 1 to 3 into one, keeping each key’s newest record. 1203 new is overwritten, so it goes; the tombstone hides 4410 new, and with no older file beneath them, both go.",
      focus: ["mem", "sst"],
      frame: ["app", "wal", "mem", "bloom", "sst"],
      facts: [["Kept", "1203 sent, 8841 sent"], ["Overwritten", "1203 new"], ["Deleted", "4410 new + tombstone"]],
      changes: ["+ File 3: the 4410 tombstone", "+ Merged: 1203 sent, 8841 sent", "− Files 1 to 3", "− WAL offset 2"],
      metrics: { files: 1, reads: "—" },
      events: [
        { type: "state", node: "bloom", light: "idle", readout: "" },
        { type: "state", node: "sst", opts: { count: 3 }, with: true },
        { type: "state", node: "mem", opts: { level: 0 }, with: true },
        { type: "flush", from: "mem", to: "f3", with: true },
        // the WAL's tombstone is covered by File 3 now, and compacting the WAL drops it
        { type: "state", node: "wal", opts: { items: 0 }, gap: 160 },
        { type: "compact", log: "wal", with: true },
        // a log's own appear doesn't bring it on, nor does a compaction into it: an empty flush shows the merged row
        { type: "flush", from: "mem", to: "merged", gap: 160 },
        { type: "state", node: "sst", opts: { count: 1 }, gap: 160 },
        { type: "compact", log: "merged", merge: ["f1", "f2", "f3"], with: true },
      ],
    },
    {
      title: "Writes that outrun compaction pile up",
      short: "Falling behind",
      text: "Compaction costs disk bandwidth, CPU and free space while it merges. When writes outrun it, flushed files pile up and reads slow, since each has more files to check; engines such as RocksDB then throttle incoming writes until compaction catches up.",
      focus: ["app", "mem", "sst"],
      frame: ["app", "wal", "mem", "bloom", "sst"],
      changes: ["+ File 4 and File 5, not merged yet", "~ Reads check more files", "~ Writes throttled"],
      metrics: { files: { n: 3, tone: "hot" } },
      events: [
        { type: "stream", every: 240, routes: [{ path: ["app", "wal"] }, { path: ["app", "mem"] }] },
        // the writes ride the stream; the memtable fills and flushes twice while compaction lags
        { type: "state", node: "mem", opts: { level: 0.6 } },
        { type: "append", log: "mem", records: [{ text: "2210 new", key: "2210" }, { text: "6620 new", key: "6620" }], with: true },
        { type: "state", node: "sst", opts: { count: 2 }, gap: 200 },
        { type: "state", node: "mem", opts: { level: 0 }, with: true },
        { type: "flush", from: "mem", to: "f4", with: true },
        { type: "state", node: "mem", opts: { level: 0.6 }, gap: 200 },
        { type: "append", log: "mem", records: [{ text: "1450 new", key: "1450" }, { text: "9013 new", key: "9013" }], with: true },
        { type: "state", node: "sst", opts: { count: 3 }, light: "hot", tone: "hot", gap: 200 },
        { type: "state", node: "mem", opts: { level: 0 }, with: true },
        { type: "flush", from: "mem", to: "f5", with: true },
        { type: "state", node: "app", light: "hot", tone: "hot" },
        { type: "note", node: "app", text: "writes throttled", tone: "hot", with: true },
      ],
    },
  ],
};
