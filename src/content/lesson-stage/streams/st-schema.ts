import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Change a schema while old data exists": Checkout writes Avro order records to partition 3 of the Orders
// topic, schema v1 with a coupon field that has no default, and v2 removes it. Billing upgrades first and skips coupon
// in an old record (backward compatible); Checkout ships v2 before Search upgrades, and Search's v1 reader fails on
// 819 at 1043 (not forward compatible). Rolling Checkout back leaves 819 in the log; Search upgrades and catches up,
// and only then does Checkout write v2 again.
export const stSchemaStage: StageScene = {
  id: "st-schema",
  intro: "Watch an order schema lose its coupon field while old and new records share one log, and see why consumers must upgrade before producers.",
  metrics: [
    { id: "checkout", label: "Checkout" },
    { id: "billing", label: "Billing" },
    { id: "search", label: "Search" },
  ],
  // Writer to readers, left to right on a wide screen and top to bottom on a phone: Checkout, then the topic with its
  // strip lying below it, then Billing, with the registry it asks behind it. Search stands in the topic's tier, behind
  // the topic. So a phone has three rows of at most two parts: Checkout; Search and the topic, with the strip under
  // them; the registry and Billing. The topic's tag, the widest, shares its row: while a step plays, the engine spaces
  // a phone's columns for the widest tag in any row, and at the end only for rows of two, so a lone wide tag would
  // shift the parts once each step ends. On a wide screen Search stands 2.1 lanes back and Billing's tier a little past
  // tier 2, so Search's link and the registry's keep apart and the strip's far end, seven records at the last step,
  // stays under Billing's tag. The registry's link reaches it past its tag, so the registry takes a detail line, the
  // versions it holds, only from step 3, after the step whose reply rides that link: a two-line tag reaches down to
  // where the reply rides. Every step frames all five parts, so a phone's camera holds still.
  nodes: [
    { id: "checkout", role: "web", label: "Checkout", detail: "producer", at: [0, 0] },
    { id: "topic", role: "broker", label: "Orders topic", detail: "6 partitions", at: [1, 0], opts: { count: 6, items: 3, mark: 3 } },
    { id: "search", role: "consumer", label: "Search", at: [1, -2.1], opts: { count: 2 } },
    { id: "billing", role: "consumer", label: "Billing", at: [2.2, 0], opts: { count: 4 } },
    { id: "registry", role: "doc", label: "Registry", at: [2.2, -1.7], opts: { count: 1 } },
  ],
  links: [
    { from: "checkout", to: "topic" },
    { from: "topic", to: "billing" },
    { from: "billing", to: "registry" },
    { from: "topic", to: "search" },
  ],
  logs: [
    { id: "p3", node: "topic", label: "P3", side: "below", start: 1039, records: [{ text: "809 v1" }, { text: "811 v1" }] },
  ],
  steps: [
    {
      title: "Records are written with schema v1",
      short: "Schema v1",
      text: "Checkout writes order records to the Orders topic in Avro, and Billing and Search read them. Schema v1, kept in the registry, has a coupon field with no default. Order 812 lands in partition 3 at offset 1041.",
      focus: ["checkout", "topic", "registry"],
      frame: ["checkout", "topic", "search", "billing", "registry"],
      facts: [["Encoding", "Avro"], ["Schema v1", "coupon, no default"]],
      metrics: { checkout: "writes v1", billing: "reads v1", search: "reads v1" },
      changes: ["+ 812 v1 at offset 1041"],
      events: [
        { type: "note", node: "registry", text: "v1 has coupon" },
        { type: "state", node: "registry", light: "on", with: true },
        { type: "append", log: "p3", from: "checkout", records: [{ text: "812 v1" }] },
      ],
    },
    {
      title: "A reader needs the writer's schema",
      short: "Writer's schema",
      text: "Avro writes no tags: to read 812, Billing fetches the writer's schema, v1, from the registry and matches fields by name. JSON instead repeats field names in every record and checks nothing without a validator; Protobuf writes numeric tags, and a retired tag must never be reused.",
      focus: ["topic", "search", "billing", "registry"],
      frame: ["checkout", "topic", "search", "billing", "registry"],
      facts: [["JSON", "names in every record"], ["Protobuf", "numeric tags"], ["Avro", "the writer's schema"]],
      changes: ["+ Billing and Search read 812", "+ Billing fetches schema v1", "~ Fields matched by name"],
      events: [
        { type: "cursor", log: "p3", id: "billing", at: 1041, label: "billing" },
        { type: "cursor", log: "p3", id: "search", at: 1041, label: "search", with: true },
        { type: "read", log: "p3", at: 1041, to: "billing" },
        { type: "read", log: "p3", at: 1041, to: "search", with: true },
        { type: "state", node: "registry", light: "work" },
        { type: "note", node: "registry", text: "writer's schema v1", tone: "work", with: true },
        { type: "packet", path: ["registry", "billing"], label: "v1", kind: "response", with: true },
        { type: "note", node: "billing", text: "matched by name", tone: "work" },
        { type: "cursor", log: "p3", id: "billing", at: "end", with: true },
        { type: "cursor", log: "p3", id: "search", at: "end", with: true },
      ],
    },
    {
      title: "A new reader skips coupon in old records",
      short: "Backward",
      text: "Schema v2, without coupon, is added to the registry. Billing upgrades first while Checkout still writes v1: during a rollout old and new versions run side by side. Billing's v2 reader skips coupon in order 817 at 1042, so the change is backward compatible: new readers read old data.",
      facts: [["Change", "v2 drops coupon"], ["Backward", "new reads old: yes"]],
      metrics: { billing: "reads v2" },
      changes: ["+ Schema v2, no coupon", "~ Billing reads with v2", "+ 817 v1 at 1042, coupon skipped"],
      events: [
        { type: "state", node: "registry", opts: { count: 2 }, detail: "v1 and v2" },
        { type: "note", node: "registry", text: "v2: no coupon", with: true },
        { type: "state", node: "billing", light: "work" },
        { type: "append", log: "p3", from: "checkout", records: [{ text: "817 v1" }] },
        { type: "read", log: "p3", at: 1042, to: "billing" },
        { type: "read", log: "p3", at: 1042, to: "search", with: true },
        { type: "note", node: "billing", text: "skips coupon", tone: "work" },
        { type: "cursor", log: "p3", id: "billing", at: "end", with: true },
        { type: "cursor", log: "p3", id: "search", at: "end", with: true },
      ],
    },
    {
      title: "An old reader fails on the first new record",
      short: "Not forward",
      text: "Checkout ships v2 before Search upgrades, and order 819 lands at 1043 without coupon. Billing reads it. Search's v1 reader finds no value for coupon and fails: the change is not forward compatible, since old readers can't read new data.",
      facts: [["Forward", "old reads new: no"], ["Search", "stuck at 1043"]],
      metrics: { checkout: "writes v2" },
      changes: ["~ Checkout writes v2", "+ 819 v2 at 1043, no coupon", "− Search fails on 819"],
      events: [
        { type: "append", log: "p3", from: "checkout", records: [{ text: "819 v2" }] },
        { type: "read", log: "p3", at: 1043, to: "billing" },
        { type: "cursor", log: "p3", id: "billing", at: "end" },
        { type: "read", log: "p3", at: 1043, to: "search", kind: "hot" },
        { type: "state", node: "search", light: "hot", tone: "hot" },
        { type: "record", log: "p3", at: 1043, tone: "hot", with: true },
        { type: "note", node: "search", text: "read fails", tone: "hot", with: true },
      ],
    },
    {
      title: "Rolling back leaves 819 in the log",
      short: "Rollback",
      text: "Rolling Checkout back to v1 doesn't help. Order 822 is written with v1 at 1044, but 819 stays in the log until retention expires, and Search fails on it again at every retry, falling further behind while Billing reads on.",
      focus: ["checkout", "topic", "search", "billing"],
      frame: ["checkout", "topic", "search", "billing", "registry"],
      facts: [["819 stays", "until retention expires"]],
      metrics: { checkout: "writes v1" },
      changes: ["~ Checkout back to v1", "+ 822 v1 at 1044", "~ 819 still there: Search fails again"],
      events: [
        { type: "append", log: "p3", from: "checkout", records: [{ text: "822 v1" }] },
        { type: "read", log: "p3", at: 1044, to: "billing" },
        { type: "cursor", log: "p3", id: "billing", at: "end" },
        { type: "read", log: "p3", at: 1043, to: "search", kind: "hot" },
        { type: "note", node: "search", text: "fails again", tone: "hot" },
      ],
    },
    {
      title: "Upgrade every consumer first",
      short: "Consumers first",
      text: "The safe order is consumers first, then producers. Search upgrades to v2, reads 819, skips coupon in 822 and catches up. Until every consumer reads v2, no producer should write it.",
      focus: ["topic", "search"],
      frame: ["checkout", "topic", "search", "billing", "registry"],
      facts: [["Order", "consumers, then producers"]],
      metrics: { search: "reads v2" },
      changes: ["~ Search reads with v2", "~ 819 read, 822's coupon skipped", "~ Search caught up"],
      events: [
        { type: "state", node: "search", light: "work", tone: "" },
        { type: "record", log: "p3", at: 1043, tone: "", with: true },
        { type: "read", log: "p3", at: 1043, to: "search" },
        { type: "read", log: "p3", at: 1044, to: "search" },
        { type: "cursor", log: "p3", id: "search", at: "end" },
        { type: "note", node: "search", text: "caught up", tone: "work", with: true },
      ],
    },
    {
      title: "Then the producer ships v2",
      short: "Producers next",
      text: "With both readers on v2, Checkout ships v2 again: order 824 lands at 1045 and both read it. Coupon leaves the log only as retention expires the v1 records. A change that is only forward compatible reverses the order: producers first.",
      facts: [["Backward only", "consumers first"], ["Forward only", "producers first"]],
      metrics: { checkout: "writes v2" },
      changes: ["~ Checkout writes v2", "+ 824 v2 at 1045", "+ Billing and Search read 824"],
      events: [
        { type: "append", log: "p3", from: "checkout", records: [{ text: "824 v2" }] },
        { type: "read", log: "p3", at: 1045, to: "billing" },
        { type: "read", log: "p3", at: 1045, to: "search", with: true },
        { type: "cursor", log: "p3", id: "billing", at: "end" },
        { type: "cursor", log: "p3", id: "search", at: "end", with: true },
      ],
    },
  ],
};
