import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Start with an append-only log": parcel 8841 written "packed" at offset 0 and "shipped" at 4096 (offsets count
// bytes, a record every 4096), an in-memory hash index that maps 8841 to its newest offset, a read as one lookup and one
// disk read, the costs (every key in memory, no ranges, a rebuild after a restart, stale versions until compaction),
// then durability: two writes whose write() returned lie past the synced line, and either a power cut takes that tail
// or one fsync makes both durable (group commit).
export const seLogStage: StageScene = {
  id: "se-log",
  intro: "Follow parcel 8841 into a file that only grows, then see what the index, compaction and fsync each add.",
  metrics: [
    { id: "records", label: "Records" },
    { id: "keys", label: "Keys in memory" },
    { id: "unsynced", label: "Unsynced", derive: { lag: ["file", "fsync"] } },
  ],
  // The App reaches both stores along straight cables: the log file up and to the right with its strip beyond it, the
  // index down and to the right with its pill. On a phone the two share the row under the App, the strip beneath them.
  nodes: [
    { id: "app", role: "web", label: "App", detail: "parcel tracking", at: [0, 0] },
    { id: "disk", role: "disk", label: "Log file", detail: "on disk", at: [0.9, 1.75] },
    { id: "index", role: "index", label: "Hash index", detail: "in memory", at: [0.9, -0.83] },
  ],
  links: [{ from: "app", to: "disk" }, { from: "app", to: "index" }],
  logs: [{ id: "file", node: "disk", step: 4096 }],
  steps: [
    {
      title: "Every write goes on the end",
      short: "Append a record",
      text: "The App writes parcel 8841 as packed. The record goes on the end of the log file at offset 0, a sequential write, the cheapest kind on most storage. The hash index notes that 8841 lives at offset 0, so a read needn’t scan the file.",
      facts: [["Record", "8841 packed"], ["Offset", "0"]],
      changes: ["+ 8841 packed at offset 0", "+ Index: 8841 → 0"],
      metrics: { records: 1, keys: 1 },
      events: [
        { type: "append", log: "file", from: "app", records: [{ text: "8841 packed", key: "8841" }] },
        { type: "packet", path: ["app", "index"], label: "8841 → 0" },
        { type: "state", node: "index", light: "on", readout: "8841 → 0" },
      ],
    },
    {
      title: "An update is a newer record",
      short: "Newer record",
      text: "Parcel 8841 ships. Nothing in the file is edited: the update is a newer record at offset 4096, and 8841 packed stays where it was, now stale. The index moves 8841 to 4096, its newest version.",
      facts: [["Offset", "4096"], ["Index", "8841 → 4096"]],
      changes: ["+ 8841 shipped at offset 4096", "~ Index: 8841 → 4096", "~ 8841 packed is stale"],
      metrics: { records: 2 },
      events: [
        { type: "append", log: "file", from: "app", records: [{ text: "8841 shipped", key: "8841" }] },
        { type: "record", log: "file", at: 0, tone: "quiet" },
        { type: "packet", path: ["app", "index"], label: "8841 → 4096" },
        { type: "state", node: "index", readout: "8841 → 4096" },
      ],
    },
    {
      title: "A read is one lookup and one disk read",
      short: "Point read",
      text: "To read 8841, the App asks the hash index, which answers 4096 from memory, and one disk read at that offset returns 8841 shipped. Riak’s Bitcask works this way. A hash map has no order, though, so a range of parcels means scanning the file.",
      facts: [["Point read", "1 lookup, 1 disk read"], ["Range read", "scan the file"]],
      changes: ["~ Lookup: 8841 → 4096", "~ 1 disk read at offset 4096"],
      events: [
        { type: "packet", path: ["app", "index"], label: "where is 8841?" },
        { type: "state", node: "index", light: "work", opts: { mark: 4 } },
        { type: "note", node: "index", text: "1 lookup", tone: "work", with: true },
        { type: "packet", path: ["index", "app"], label: "4096", kind: "response" },
        { type: "read", log: "file", at: 4096, to: "app" },
        { type: "note", node: "disk", text: "1 disk read", tone: "work", with: true },
      ],
    },
    {
      title: "Every key lives in memory",
      short: "Rebuild on restart",
      text: "The hash index holds every key in memory, so all the keys must fit, and a restart empties it. The App rebuilds the map by reading the whole file from the start: 8841 maps to 0, then to 4096, as the later record wins.",
      facts: [["In memory", "every key"], ["After a restart", "read the whole file"]],
      changes: ["− Map emptied by a restart", "+ Rebuilt by reading the file", "~ 8841 → 4096 again"],
      events: [
        { type: "state", node: "index", light: "idle", readout: "empty", opts: { mark: undefined } },
        { type: "note", node: "app", text: "restart", with: true },
        { type: "cursor", log: "file", id: "app", at: 0, label: "rebuild" },
        { type: "read", log: "file", at: 0, to: "app" },
        { type: "packet", path: ["app", "index"], label: "8841 → 0" },
        // the scan reads on while the map takes the first entry
        { type: "state", node: "index", light: "on", readout: "8841 → 0" },
        { type: "cursor", log: "file", id: "app", at: 4096, with: true },
        { type: "read", log: "file", at: 4096, to: "app", with: true },
        { type: "packet", path: ["app", "index"], label: "8841 → 4096" },
        { type: "cursor", log: "file", id: "app", at: "end", with: true },
        { type: "state", node: "index", readout: "8841 → 4096" },
      ],
    },
    {
      title: "Compaction drops old versions",
      short: "Compact the log",
      text: "Every update leaves its old version behind, so the file only grows, and the rebuild read 8841 packed for nothing. A background job rewrites the log keeping each key’s newest record: 8841 packed goes, one record per key remains.",
      focus: ["disk"],
      frame: ["app", "disk", "index"],
      facts: [["Keeps", "newest per key"], ["Drops", "8841 packed"]],
      changes: ["− 8841 packed", "~ 1 record per key"],
      metrics: { records: 1 },
      events: [
        { type: "cursor", log: "file", id: "app", at: null },
        { type: "compact", log: "file" },
        { type: "note", node: "disk", text: "compacted", tone: "work" },
      ],
    },
    {
      title: "A returned write isn’t safe yet",
      short: "Not synced",
      text: "The App writes parcels 1203 and 5170, and write() returns for each. The records may only have reached the operating system’s cache, past the synced line; only fsync makes them safe. The same holds for the write-ahead log that protects larger engines.",
      focus: ["app", "disk"],
      frame: ["app", "disk", "index"],
      facts: [["Synced", "8841 shipped"], ["Not synced", "1203, 5170"]],
      changes: ["+ 1203 new, 5170 new", "~ Both past the synced line"],
      metrics: { records: 3, keys: 3 },
      events: [
        { type: "cursor", log: "file", id: "fsync", at: "end", label: "synced", line: true },
        { type: "append", log: "file", from: "app", records: [{ text: "1203 new", key: "1203" }] },
        { type: "packet", path: ["disk", "app"], label: "write() ok", kind: "response" },
        { type: "append", log: "file", from: "app", records: [{ text: "5170 new", key: "5170" }] },
        { type: "packet", path: ["disk", "app"], label: "write() ok", kind: "response" },
        { type: "note", node: "disk", text: "in OS cache" },
      ],
    },
    {
      title: "Only synced records survive a crash",
      short: "Crash or sync",
      text: "Try both. A power cut loses the tail past the line, 1203 and 5170, and 8841 shipped survives, since earlier records are never rewritten. With fsync first, one sync makes both durable before either is confirmed: engines group commits because a sync per commit is slow.",
      facts: [["Safe", "what is synced"], ["fsync calls", "1 for 2 commits"]],
      changes: ["− Power cut: the unsynced tail", "~ fsync: both durable at once"],
      events: [],
      control: {
        label: "First comes",
        options: [
          {
            label: "Power cut",
            metrics: { records: 1, keys: 0 },
            events: [
              { type: "state", node: "disk", light: "hot", tone: "hot" },
              { type: "note", node: "disk", text: "power cut", tone: "hot", with: true },
              { type: "state", node: "index", light: "idle", readout: "empty", with: true },
              { type: "truncate", log: "file", after: 4096 },
              { type: "note", node: "app", text: "1203, 5170 lost", tone: "hot" },
            ],
          },
          {
            label: "fsync",
            events: [
              { type: "packet", path: ["app", "disk"], label: "fsync" },
              { type: "cursor", log: "file", id: "fsync", at: "end" },
              { type: "packet", path: ["disk", "app"], label: "2 commits durable", kind: "response" },
              { type: "note", node: "app", text: "1 fsync, 2 commits", tone: "work", with: true },
            ],
          },
        ],
      },
    },
  ],
};
