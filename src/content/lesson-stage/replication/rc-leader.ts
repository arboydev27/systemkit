import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Send every write through one leader": a payments ledger with one Leader and two followers, Follower 1 1 ms
// away and Follower 2 90 ms away. The Leader records each payment in its replication log (positions 202 onwards) and
// the followers apply it in the same order, their applied positions shown as cursors on the log. Then the ack rules in
// turn: asynchronous confirms $60 and $15 at 205 and 206 on the Leader alone, and a crash loses both; synchronous waits
// for both followers, at least 90 ms a commit, and Follower 2's stalled disk hangs the $18 payment at 206;
// semi-synchronous needs any one, so Follower 1's ack (about 1 ms) releases it; and MySQL's fallback to asynchronous
// after a timeout confirms the $9 payment at 207 with one copy, which monitoring has to catch.
export const rcLeaderStage: StageScene = {
  id: "rc-leader",
  intro: "Watch one leader put every payment in a single log, then see what each rule for confirming a write costs.",
  metrics: [{ id: "wait", label: "Commit waits" }, { id: "copies", label: "Copies when acked" }],
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "sends payments", at: [0, 0] },
    { id: "leader", role: "database", label: "Leader", detail: "takes every write", at: [1, 0], opts: { lead: true } },
    { id: "f1", role: "database", label: "Follower 1", detail: "1 ms away", at: [2, 0], opts: { replica: true } },
    { id: "f2", role: "database", label: "Follower 2", detail: "90 ms away", at: [2.7, 0.85], opts: { replica: true } },
    { id: "monitor", role: "monitor", label: "Monitoring", detail: "watches ack mode", at: [0, -1.5], appear: 7 },
  ],
  links: [
    { from: "client", to: "leader" },
    { from: "leader", to: "f1" },
    { from: "leader", to: "f2" },
    { from: "monitor", to: "leader" },
  ],
  logs: [
    { id: "log", node: "leader", label: "Log", side: "below", start: 202, records: [{ text: "$12" }, { text: "$8" }] },
  ],
  steps: [
    {
      title: "One leader takes every write",
      short: "One leader",
      text: "The Leader is the only node that accepts writes. It records the client’s $25 payment at position 204 of its replication log, right after 203, which both followers have already applied.",
      facts: [["Takes writes", "the Leader only"]],
      changes: ["+ $25 at position 204"],
      events: [
        { type: "cursor", log: "log", id: "f1", at: 203, label: "Follower 1" },
        { type: "cursor", log: "log", id: "f2", at: 203, label: "Follower 2", with: true },
        { type: "append", log: "log", from: "client", records: [{ text: "$25" }] },
        { type: "state", node: "leader", light: "on", with: true },
        { type: "note", node: "leader", text: "the only writer" },
      ],
    },
    {
      title: "Followers apply the log in order",
      short: "Apply in order",
      text: "Follower 1 and Follower 2 apply the log in the Leader’s order, 204 after 203, so all three copies converge on the same state. The cost: every write still passes through one node.",
      changes: ["~ Both followers at 204", "~ Three copies agree"],
      events: [
        { type: "read", log: "log", at: 204, to: "f1" },
        { type: "cursor", log: "log", id: "f1", at: 204 },
        { type: "read", log: "log", at: 204, to: "f2" },
        { type: "cursor", log: "log", id: "f2", at: 204 },
        { type: "note", node: "leader", text: "every write, one node" },
      ],
    },
    {
      title: "Asynchronous: answer after its own commit",
      short: "Asynchronous",
      text: "With asynchronous replication the Leader answers as soon as it commits. The $60 and $15 payments are confirmed at 205 and 206 while both followers still sit at 204, to catch up later.",
      metrics: { wait: { n: 0, unit: " ms" }, copies: 1 },
      changes: ["+ $60 at 205, $15 at 206", "~ Both confirmed at once", "~ Followers still at 204"],
      events: [
        { type: "append", log: "log", from: "client", records: [{ text: "$60" }] },
        { type: "packet", path: ["leader", "client"], label: "OK 205", kind: "response" },
        { type: "append", log: "log", from: "client", records: [{ text: "$15" }] },
        { type: "packet", path: ["leader", "client"], label: "OK 206", kind: "response" },
        { type: "note", node: "leader", text: "OK before any copy" },
      ],
    },
    {
      title: "A crash loses what hasn’t shipped",
      short: "Leader crash",
      text: "The Leader crashes before shipping 205 and 206. The client was told both payments succeeded, but no follower has them, so whichever follower takes over has never seen them.",
      metrics: { copies: { n: 1, tone: "hot" } },
      changes: ["− Leader crashes", "− $60 and $15, confirmed but lost"],
      events: [
        { type: "record", log: "log", at: 205, tone: "hot" },
        { type: "record", log: "log", at: 206, tone: "hot", with: true },
        { type: "state", node: "leader", down: true, light: "idle" },
        { type: "pause", ms: 500 },
        { type: "truncate", log: "log", after: 204 },
        { type: "note", node: "leader", text: "2 payments lost", tone: "hot" },
      ],
    },
    {
      title: "Synchronous: every commit waits 90 ms",
      short: "Synchronous",
      text: "Replay with synchronous replication: the Leader answers only after both followers confirm. Follower 1 confirms the $30 payment at 205 within 1 ms, but Follower 2 is 90 ms away, so every commit waits at least 90 ms.",
      metrics: { wait: { n: 90, unit: " ms" }, copies: 3 },
      changes: ["+ $30 at 205", "~ Both followers confirm", "~ The answer waits for Follower 2"],
      events: [
        { type: "state", node: "leader", down: false, light: "on" },
        { type: "append", log: "log", from: "client", records: [{ text: "$30" }] },
        { type: "read", log: "log", at: 205, to: "f2" },
        { type: "read", log: "log", at: 205, to: "f1", with: true },
        { type: "cursor", log: "log", id: "f1", at: 205 },
        { type: "cursor", log: "log", id: "f2", at: 205, with: true },
        { type: "packet", path: ["f2", "leader"], label: "ack 205", kind: "response" },
        { type: "packet", path: ["f1", "leader"], label: "ack 205", kind: "response", with: true },
        { type: "state", node: "f1", readout: "ack in 1 ms", with: true },
        { type: "state", node: "f2", readout: "ack in 90 ms", with: true },
        { type: "packet", path: ["leader", "client"], label: "OK 205", kind: "response" },
      ],
    },
    {
      title: "One stalled follower stalls every write",
      short: "Stalled",
      text: "Follower 2’s disk stalls. The $18 payment at 206 reaches both followers and Follower 1 confirms it, but the Leader must also wait for Follower 2, so this commit hangs, and every one after it.",
      metrics: { wait: "stalled" },
      changes: ["~ Follower 2 stalls", "+ $18 at 206", "− No answer for the client"],
      events: [
        { type: "state", node: "f2", light: "hot", tone: "hot", readout: "disk stalled" },
        { type: "append", log: "log", from: "client", records: [{ text: "$18" }] },
        { type: "read", log: "log", at: 206, to: "f2" },
        { type: "read", log: "log", at: 206, to: "f1", with: true },
        { type: "cursor", log: "log", id: "f1", at: 206 },
        { type: "packet", path: ["f1", "leader"], label: "ack 206", kind: "response", with: true },
        { type: "note", node: "leader", text: "holds the answer", tone: "hot" },
        { type: "state", node: "client", detail: "waiting…", with: true },
      ],
    },
    {
      title: "Semi-synchronous: wait for any one",
      short: "Semi-sync",
      text: "Switch to semi-synchronous: the Leader waits for any one follower. Follower 1 confirmed 206 within 1 ms, which is now enough, so the payment returns while Follower 2 stays stalled. It survives the Leader’s death as long as Follower 1 survives.",
      metrics: { wait: { n: 1, unit: " ms" }, copies: 2 },
      changes: ["~ Waits for any one follower", "+ OK for 206", "~ Follower 2 no longer blocks writes"],
      events: [
        { type: "packet", path: ["leader", "client"], label: "OK 206", kind: "response" },
        { type: "state", node: "client", detail: "sends payments", with: true },
        { type: "note", node: "f1", text: "has every acked write", tone: "work" },
      ],
    },
    {
      title: "The fallback to async is quiet",
      short: "Fallback",
      text: "Then Follower 1 drops off the network. MySQL’s semi-synchronous mode falls back to asynchronous after a timeout, so the $9 payment at 207 is confirmed with only the Leader’s copy. Monitor for that switch.",
      metrics: { wait: { n: 0, unit: " ms" }, copies: { n: 1, tone: "hot" } },
      changes: ["+ $9 at 207", "− No follower confirms", "~ Back to asynchronous", "+ Monitoring alerts"],
      events: [
        { type: "state", node: "f1", down: true, light: "idle", readout: "" },
        { type: "append", log: "log", from: "client", records: [{ text: "$9" }] },
        { type: "packet", path: ["leader", "f1"], label: "$9", kind: "work", lost: true },
        { type: "note", node: "leader", text: "timed out: async", tone: "hot" },
        { type: "packet", path: ["leader", "client"], label: "OK 207", kind: "response" },
        { type: "record", log: "log", at: 207, tone: "hot", with: true },
        { type: "note", node: "monitor", text: "alert: semi-sync is off", tone: "work" },
        { type: "state", node: "monitor", light: "work", with: true },
      ],
    },
  ],
};
