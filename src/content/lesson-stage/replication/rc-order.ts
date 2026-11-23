import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Keep reads moving forward and in order": a timeline in seconds, telling the lesson's two anomalies one after
// the other on the same four lifelines.
// Monotonic reads: the leader commits a comment at position 4,210 at 0 s; Follower A, 1 s behind, applies it at 1 s,
// and Follower B, 5 s behind, at 5 s. A load balancer sends each read to either follower: the reader's first read goes
// to A, which answers at 3 s with 1 comment; the refresh at 4 s goes to B, which answers 0 comments (the read went
// backward). Replayed with the reader pinned to A by a hash of the user ID, the refresh shows 1 comment too. Replayed once
// more with A failing at 3.5 s: the reader moves to B, which is further behind, but the refresh carries 4,210, the last
// position it saw, so B holds the read until it applies 4,210 at 5 s and answers 1 comment at 5.5 s.
// Consistent prefix (after a rewind, the lifelines relabelled): order 77 is created on the orders shard at 0 s and
// its refund goes to the payments shard at 1 s; the orders follower is 4 s behind and the payments follower current,
// so it has the refund at once (its leader adds nothing, so the payments shard is drawn as its follower alone). Payments
// answers the support dashboard with the refund at 2 s, and the dashboard asks the orders follower for order 77 at 3 s:
// a refund for an order that doesn't exist, since order 77 reaches that follower only at 4 s. Replayed with both writes
// keyed on order ID 77, they share the orders shard's log and its follower applies them in order (the order at 4 s, the
// refund at 5 s), so a read at 4 s shows the order without its refund: stale, a consistent prefix, never reversed.
// Lifelines run Leader, Follower B, Reader, Follower A (top to bottom; left to right on a phone), so every read and
// reply goes between neighbours, as does the long lagging copy to B (Orders); only the 1 s copy to A crosses two rails,
// before anything else happens. The leader is on top so its marks rest above the first rail, clear of the time axis.
// Reads take 0.5 s each way, and a lagging copy is drawn as one long message from its commit to its arrival, alongside
// the step's last reply once the read has beaten it there, so the story keeps time order. A replay redraws the telling
// it repeats all at once, so only what is new takes time. The failover leaves B's long copy out (it alone held the
// replay for about 4 s): B's wait is the "waits" span, whose start carries the clock from 4.5 to 5 s as it grows, and
// it ends with a "4,210" mark on B at 5 s, the leader's words, as the reply leaves with it. The "fails" mark carries
// the clock to 4 s, so the refresh leaves without the clock catching up first; the step plays in about 8 s. Labels are
// short enough to rest between two neighbouring rails on a phone ("4,210", "none", "no order", "seen 4,210"): the
// leader's mark is the bare position, since a wider flag can't sit between the Leader and Follower B rails at 375 px
// and lands on the time axis; in the last step the leader's marks drop the 77 that the two copies' labels carry. The
// payments mark moves the clock to 1.5 s so the now line where that step stops passes clear of its flag (resting over
// the last rail, off the time axis).
export const rcOrderStage: StageScene = {
  id: "rc-order",
  layout: "timeline",
  timeline: { ticks: [0, 1, 2, 3, 4, 5], unit: "s" },
  intro: "Watch a comment vanish when a refresh lands on a slower follower, then a refund show up before its order, and the fix for each.",
  metrics: [{ id: "from", label: "Read from" }, { id: "shows", label: "Page shows" }],
  nodes: [
    { id: "leader", role: "database", label: "Leader", detail: "takes every write", at: [0, 0], opts: { lead: true } },
    { id: "b", role: "database", label: "Follower B", detail: "5 s behind", at: [1, 0], opts: { replica: true } },
    { id: "reader", role: "client", label: "Reader", detail: "reads a thread", at: [2, 0] },
    { id: "a", role: "database", label: "Follower A", detail: "1 s behind", at: [3, 0], opts: { replica: true } },
  ],
  links: [],
  steps: [
    {
      title: "Each follower lags by a different amount",
      short: "Lag differs",
      text: "Someone posts a comment, and the leader commits it at position 4,210 at 0 s. Follower A, 1 s behind, has it at 1 s. Follower B, 5 s behind, won’t have it until 5 s. A load balancer sends each read to either follower.",
      facts: [["Follower A", "1 s behind"], ["Follower B", "5 s behind"]],
      changes: ["+ Leader commits 4,210", "+ Follower A has it at 1 s"],
      events: [
        { type: "mark", node: "leader", text: "4,210", tone: "work", t: 0, dur: 0 },
        { type: "packet", path: ["leader", "a"], label: "comment", t: 0, dur: 1 },
      ],
    },
    {
      title: "Follower A shows the comment at 3 s",
      short: "Sees it",
      text: "A reader opens the thread, and the load balancer sends the read to Follower A. A has had the comment since 1 s, so at 3 s it answers with 1 comment.",
      metrics: { from: "Follower A", shows: { n: 1, unit: " comment" } },
      changes: ["+ Read goes to Follower A", "~ Page shows 1 comment"],
      events: [
        { type: "packet", path: ["reader", "a"], label: "read", t: 2.5, dur: 0.5 },
        { type: "packet", path: ["a", "reader"], label: "1 comment", kind: "response", t: 3, dur: 0.5, gap: 0 },
      ],
    },
    {
      title: "The refresh shows an older thread",
      short: "Goes backward",
      text: "At 4 s the reader refreshes, and the load balancer picks Follower B. B hasn’t applied 4,210, which reaches it only at 5 s, so the page shows 0 comments. The reader saw newer data, then older.",
      metrics: { from: "Follower B", shows: { n: 0, unit: " comments", tone: "hot" } },
      facts: [["At 3 s, from A", "1 comment"], ["At 4 s, from B", "0 comments"]],
      changes: ["+ Refresh goes to Follower B", "~ Page shows 0 comments", "+ B has 4,210 at 5 s"],
      events: [
        { type: "packet", path: ["reader", "b"], label: "refresh", t: 4, dur: 0.5 },
        { type: "packet", path: ["b", "reader"], label: "none", kind: "hot", t: 4.5, dur: 0.5, gap: 0 },
        { type: "packet", path: ["leader", "b"], label: "comment", t: 0, dur: 5, with: true },
      ],
    },
    {
      title: "Pin each reader to one follower",
      short: "Pin the reader",
      text: "Replay it with each reader pinned to one follower by a hash of the user ID. This reader maps to Follower A, so the refresh at 4 s goes there too and still shows 1 comment. That’s monotonic reads: maybe stale, never backward.",
      metrics: { from: "Follower A", shows: { n: 1, unit: " comment" } },
      facts: [["Pinned by", "hash of user ID"], ["Reads", "never go backward"]],
      changes: ["~ Reader pinned to Follower A", "~ Refresh shows 1 comment"],
      events: [
        { type: "rewind" },
        { type: "state", node: "reader", detail: "pinned to A", gap: 0 },
        { type: "mark", node: "leader", text: "4,210", tone: "work", t: 0, dur: 0, gap: 0 },
        { type: "packet", path: ["leader", "a"], label: "comment", t: 0, dur: 1, with: true },
        { type: "packet", path: ["reader", "a"], label: "read", t: 2.5, dur: 0.5, with: true },
        { type: "packet", path: ["a", "reader"], label: "1 comment", kind: "response", t: 3, dur: 0.5, with: true },
        { type: "packet", path: ["reader", "a"], label: "refresh", t: 4, dur: 0.5 },
        { type: "packet", path: ["a", "reader"], label: "1 comment", kind: "response", t: 4.5, dur: 0.5, gap: 0 },
      ],
    },
    {
      title: "Carry the position through a failover",
      short: "Failover",
      text: "Replay it with Follower A failing at 3.5 s. The reader moves to Follower B, which is further behind and would show 0 comments. But the refresh carries 4,210, the last position the reader saw, so B holds the read until it applies 4,210 at 5 s, then answers 1 comment.",
      metrics: { from: "Follower B", shows: { n: 1, unit: " comment" } },
      facts: [["Refresh carries", "position 4,210"], ["Without it", "0 comments"]],
      changes: ["− Follower A fails", "~ Reader moves to Follower B", "+ B holds the read until 4,210"],
      events: [
        { type: "rewind" },
        { type: "mark", node: "leader", text: "4,210", tone: "work", t: 0, dur: 0, gap: 0 },
        { type: "packet", path: ["leader", "a"], label: "comment", t: 0, dur: 1, with: true },
        { type: "packet", path: ["reader", "a"], label: "read", t: 2.5, dur: 0.5, with: true },
        { type: "packet", path: ["a", "reader"], label: "1 comment", kind: "response", t: 3, dur: 0.5, with: true },
        { type: "mark", node: "a", text: "fails", tone: "hot", t: 3.5, dur: 0.5 },
        { type: "state", node: "a", down: true, gap: 0 },
        { type: "state", node: "reader", detail: "moved to B", with: true },
        { type: "packet", path: ["reader", "b"], label: "seen 4,210", t: 4, dur: 0.5, gap: 0 },
        { type: "span", id: "hold", node: "b", label: "waits", tone: "quiet", t: 4.5, dur: 0.5, gap: 0 },
        { type: "span", id: "hold", end: true, t: 5, gap: 0 },
        { type: "mark", node: "b", text: "4,210", tone: "work", t: 5, dur: 0, gap: 0 },
        { type: "packet", path: ["b", "reader"], label: "1 comment", kind: "response", t: 5, dur: 0.5, with: true },
      ],
    },
    {
      title: "Two shards keep two separate logs",
      short: "Two shards",
      text: "Now take two shards, each with its own log. Order 77 is created on the orders shard at 0 s, and its refund goes to the payments shard at 1 s. The orders follower is 4 s behind; the payments follower is current.",
      metrics: { from: "—", shows: "—" },
      facts: [["Order 77", "orders shard"], ["Its refund", "payments shard"]],
      changes: ["+ Order 77 on the orders shard", "+ Its refund on the payments shard"],
      events: [
        { type: "rewind" },
        { type: "state", node: "reader", label: "Dashboard", detail: "support team", gap: 0 },
        { type: "state", node: "a", label: "Payments", detail: "follower, current", down: false, with: true },
        { type: "state", node: "b", label: "Orders", detail: "follower, 4 s behind", with: true },
        { type: "state", node: "leader", label: "Orders leader", detail: "orders shard", with: true },
        { type: "mark", node: "leader", text: "order 77", tone: "work", t: 0, dur: 0 },
        { type: "mark", node: "a", text: "refund 77", tone: "work", t: 1, dur: 0.5 },
      ],
    },
    {
      title: "The refund shows before its order",
      short: "Effect first",
      text: "Payments answers the support dashboard with the refund at 2 s, then the dashboard asks the orders follower for order 77 at 3 s. That follower applies order 77 only at 4 s, so the dashboard shows a refund for an order that doesn’t exist.",
      metrics: { from: "Both shards", shows: { n: 1, unit: " refund, 0 orders", tone: "hot" } },
      facts: [["From Payments", "refund for 77"], ["From Orders", "no order 77"]],
      changes: ["+ Dashboard reads both shards", "~ Refund shows, order doesn’t", "+ Order 77 arrives at 4 s"],
      events: [
        { type: "packet", path: ["reader", "a"], label: "read", t: 1.5, dur: 0.5 },
        { type: "packet", path: ["a", "reader"], label: "refund", kind: "response", t: 2, dur: 0.5, gap: 0 },
        { type: "packet", path: ["reader", "b"], label: "read", t: 3, dur: 0.5 },
        { type: "packet", path: ["b", "reader"], label: "no order", kind: "hot", t: 3.5, dur: 0.5, gap: 0 },
        { type: "packet", path: ["leader", "b"], label: "order 77", t: 0, dur: 4, with: true },
      ],
    },
    {
      title: "Key both on order ID to share one log",
      short: "One log",
      text: "Replay it with both writes keyed on order ID 77, so they share the orders shard’s log, applied in order. A read at 4 s shows the order without its refund. That’s a consistent prefix: maybe stale, never effect before cause. Otherwise, track dependencies or read cross-shard snapshots, as Spanner does, at a coordination cost.",
      focus: ["reader", "b", "leader"],
      metrics: { from: "Orders", shows: { n: 1, unit: " order, 0 refunds" } },
      facts: [["Order 77", "applied at 4 s"], ["Its refund", "applied at 5 s"]],
      changes: ["~ Both keyed on order ID 77", "~ One log, applied in order", "~ Dashboard: order, no refund yet"],
      events: [
        { type: "rewind" },
        { type: "mark", node: "leader", text: "order", tone: "work", t: 0, dur: 0, gap: 0 },
        { type: "packet", path: ["leader", "b"], label: "order 77", t: 0, dur: 4, with: true },
        { type: "mark", node: "leader", text: "refund", tone: "work", t: 1, dur: 0, with: true },
        { type: "packet", path: ["leader", "b"], label: "refund 77", t: 1, dur: 4, with: true },
        { type: "packet", path: ["reader", "b"], label: "read", t: 4, dur: 0.5 },
        { type: "packet", path: ["b", "reader"], label: "order", kind: "response", t: 4.5, dur: 0.5, gap: 0 },
      ],
    },
  ],
};
