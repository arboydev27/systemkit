import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Treat the log as the backbone": an orders topic split into 6 partitions keyed by order ID. Order 812's events
// land in partition 3 at offsets 1041-1043, a billing group gives each partition one consumer, a search-indexing group
// reads the same records at its own offsets, order holds within a partition only, and a replacement consumer resumes
// from the last committed offset, so uncommitted work runs again.
export const stLogStage: StageScene = {
  id: "st-log",
  intro: "Follow order 812's events into one partition of an orders topic, then watch two consumer groups read them at their own pace.",
  metrics: [
    { id: "billing", label: "Billing lag", derive: { lag: ["p3", "billing"] } },
    { id: "search", label: "Search lag", derive: { lag: ["p3", "search"] } },
  ],
  // One part at a time talks to the topic, from the same spot: in front of it on a wide screen, below its strips and
  // clear of their side, and beside it on a phone, where the row holds two parts with room between them for the
  // messages and the topic's strips lie under both.
  nodes: [
    { id: "checkout", role: "web", label: "Checkout", detail: "producer", at: [1, 1.65] },
    { id: "topic", role: "broker", label: "Orders topic", detail: "6 partitions", at: [1, 0], opts: { count: 6, items: 3 } },
    { id: "billing", role: "consumer", label: "Billing", detail: "6 consumers", at: [1, 1.65], appear: 2, opts: { count: 4 } },
    { id: "search", role: "consumer", label: "Search", detail: "indexing group", at: [1, 1.65], appear: 3, opts: { count: 2 } },
  ],
  links: [{ from: "checkout", to: "topic" }, { from: "topic", to: "billing" }, { from: "topic", to: "search" }],
  logs: [
    { id: "p0", node: "topic", label: "P0", start: 988, records: [{ text: "806 new", key: "806" }, { text: "806 paid", key: "806" }, { text: "814 new", key: "814" }] },
    { id: "p1", node: "topic", label: "P1", start: 1102, records: [{ text: "807 new", key: "807" }, { text: "807 paid", key: "807" }, { text: "810 new", key: "810" }] },
    { id: "p2", node: "topic", label: "P2", start: 954, records: [{ text: "805 new", key: "805" }, { text: "805 paid", key: "805" }] },
    { id: "p3", node: "topic", label: "P3", start: 1038, records: [{ text: "809 paid", key: "809" }, { text: "811 new", key: "811" }, { text: "809 sent", key: "809" }] },
    { id: "p4", node: "topic", label: "P4", start: 1011, records: [{ text: "808 new", key: "808" }, { text: "808 paid", key: "808" }] },
    { id: "p5", node: "topic", label: "P5", start: 976, records: [{ text: "815 new", key: "815" }, { text: "815 paid", key: "815" }, { text: "816 new", key: "816" }] },
  ],
  steps: [
    {
      title: "A record joins the end of its partition",
      short: "Append",
      text: "Checkout publishes order 812's first event, keyed by order ID. The key's hash picks partition 3, and the record lands at its end with the next offset, 1041. Nothing before it moves.",
      focus: ["checkout", "topic"],
      facts: [["Partitions", "6"], ["Key", "order ID"], ["Offset", "1041"]],
      changes: ["+ 812 new at partition 3, offset 1041", "~ Key 812 hashes to partition 3"],
      events: [
        { type: "note", node: "topic", text: "hash(812) → P3" },
        { type: "state", node: "topic", opts: { mark: 3 }, with: true },
        { type: "append", log: "p3", from: "checkout", records: [{ text: "812 new", key: "812" }] },
      ],
    },
    {
      title: "One key stays in one partition",
      short: "Same key",
      text: "Order 812 is paid, then shipped. The same key hashes to the same partition, so those events land in order at 1042 and 1043. Order 813 hashes to partition 1 and gets that partition's next offset.",
      focus: ["checkout", "topic"],
      changes: ["+ 812 paid at 1042, 812 sent at 1043", "+ 813 new at partition 1, offset 1105", "~ Each partition counts its own offsets"],
      events: [
        { type: "append", log: "p3", from: "checkout", records: [{ text: "812 paid", key: "812" }] },
        { type: "append", log: "p1", from: "checkout", records: [{ text: "813 new", key: "813" }] },
        { type: "append", log: "p3", from: "checkout", records: [{ text: "812 sent", key: "812" }] },
      ],
    },
    {
      title: "A group gives each partition one reader",
      short: "Consumer group",
      text: "A billing group of 6 consumers takes one partition each; a seventh would sit idle. Billing's consumer for partition 3 reads 1041 and commits, so its offset moves on to 1042. The record stays in the log.",
      focus: ["topic", "billing"],
      facts: [["Consumers", "6, one per partition"], ["A seventh", "idle"]],
      changes: ["+ Billing group, a consumer on each partition", "+ Billing commits offset 1042", "~ 1041 stays in the log"],
      events: [
        { type: "hide", nodes: ["checkout"] },
        { type: "show", nodes: ["billing"] },
        // the group spreads over the partitions, one consumer each
        { type: "cursor", log: "p0", id: "billing", at: "end", label: "billing" },
        { type: "cursor", log: "p1", id: "billing", at: 1105, label: "billing", gap: 40 },
        { type: "cursor", log: "p2", id: "billing", at: "end", label: "billing", gap: 40 },
        { type: "cursor", log: "p3", id: "billing", at: 1041, label: "billing", gap: 40 },
        { type: "cursor", log: "p4", id: "billing", at: "end", label: "billing", gap: 40 },
        { type: "cursor", log: "p5", id: "billing", at: "end", label: "billing", gap: 40 },
        { type: "read", log: "p3", at: 1041, to: "billing" },
        { type: "cursor", log: "p3", id: "billing", at: 1042 },
      ],
    },
    {
      title: "Another group keeps its own offset",
      short: "Second group",
      text: "A search-indexing group reads the same records with its own committed offset. It indexes 1041 and 1042 while billing's position stays where it was: reading a log takes nothing out of it.",
      focus: ["topic", "search"],
      changes: ["+ Search indexer, its own group", "+ Search commits offset 1043", "~ Billing still at 1042"],
      events: [
        { type: "hide", nodes: ["billing"] },
        { type: "show", nodes: ["search"] },
        { type: "cursor", log: "p3", id: "search", at: 1041, label: "search", tone: "work" },
        { type: "read", log: "p3", at: 1041, to: "search" },
        { type: "read", log: "p3", at: 1042, to: "search" },
        { type: "cursor", log: "p3", id: "search", at: 1043 },
      ],
    },
    {
      title: "Order holds within a partition only",
      short: "Ordering",
      text: "Billing reads partition 3 in order, so 812 is paid before it ships. Partition 1 has its own consumer, and 813's event can be read before or after 812's. Choose the key whose events must stay in order.",
      focus: ["topic", "billing"],
      changes: ["~ 812 paid before 812 sent", "~ 813 and 812 can interleave"],
      events: [
        { type: "hide", nodes: ["search"] },
        { type: "show", nodes: ["billing"] },
        { type: "read", log: "p1", at: 1105, to: "billing" },
        { type: "cursor", log: "p1", id: "billing", at: 1106 },
        { type: "read", log: "p3", at: 1042, to: "billing" },
        { type: "cursor", log: "p3", id: "billing", at: 1043 },
      ],
    },
    {
      title: "A replacement resumes from the commit",
      short: "Crash",
      text: "Billing's consumer reads 1043 and records the shipment, then crashes before committing. Its replacement starts from the last committed offset, 1043, so that work runs again before it commits 1044. Its effect must tolerate a repeat.",
      focus: ["topic", "billing"],
      changes: ["− Consumer crashes before its commit", "+ Replacement starts at 1043, then commits 1044", "~ 812 sent is processed twice"],
      events: [
        { type: "read", log: "p3", at: 1043, to: "billing" },
        { type: "state", node: "billing", light: "hot", tone: "hot", down: true },
        { type: "record", log: "p3", at: 1043, tone: "hot" },
        { type: "pause", ms: 600 },
        { type: "state", node: "billing", detail: "replacement", light: "on", tone: "", down: false },
        { type: "read", log: "p3", at: 1043, to: "billing", label: "812 sent again" },
        { type: "cursor", log: "p3", id: "billing", at: "end" },
      ],
    },
  ],
};
