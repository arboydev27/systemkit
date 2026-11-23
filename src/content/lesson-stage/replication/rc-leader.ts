import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Send every write through one leader": a payments ledger with one Leader and two followers, Follower 1 1 ms
// away and Follower 2 90 ms away. The Leader records each payment in its replication log (positions 203 onwards) and
// the followers apply it in the same order, their applied positions shown as cursors on the log. Then the ack rules in
// turn: asynchronous confirms $60 and $15 at 205 and 206 on the Leader alone, and a crash loses both (they stay orange
// past both cursors); synchronous waits for both followers, at least 90 ms a commit, and Follower 2's stalled disk hangs
// the $18 payment at 206; semi-synchronous needs any one, so Follower 1's ack (about 1 ms) releases it; and MySQL's
// fallback to asynchronous waits out a timeout, then confirms the $9 payment at 207 with one copy, which monitoring
// has to catch.
//
// Follower 1 and Follower 2 share tier 2 on separate lanes, up and down from the Leader, so the two cables leave the
// Leader separately and a phone shows the followers side by side. Monitoring stands above the Leader in its tier (a
// phone puts it beside the Leader) and has no cable: no message rides one, and every place a cable could take into
// the Leader ran alongside Follower 1's or the Client's. Each step focuses on two rows' worth of parts, which keeps a
// phone's labels full size; steps 5, 6 and 8 leave the Client out, so their payments join the log without a message
// from it (a message to or from a part out of frame would rest under the chips on a phone) and the Client's detail
// says the rest.
export const rcLeaderStage: StageScene = {
  id: "rc-leader",
  intro: "Watch one leader put every payment in a single log, then see what each rule for confirming a write costs.",
  metrics: [{ id: "wait", label: "Commit waits" }, { id: "copies", label: "Copies when acked" }],
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "sends payments", at: [0, 0] },
    { id: "leader", role: "database", label: "Leader", detail: "takes writes", at: [1, 0], opts: { lead: true } },
    { id: "f1", role: "database", label: "Follower 1", detail: "1 ms away", at: [2, -1], opts: { replica: true } },
    { id: "f2", role: "database", label: "Follower 2", detail: "90 ms away", at: [2, 0.9], opts: { replica: true } },
    { id: "monitor", role: "monitor", label: "Monitoring", detail: "watches ack mode", at: [1, -1.4], appear: 7 },
  ],
  links: [
    { from: "client", to: "leader" },
    { from: "leader", to: "f1" },
    { from: "leader", to: "f2" },
  ],
  logs: [
    { id: "log", node: "leader", label: "Log", side: "below", start: 203, records: [{ text: "$8" }] },
  ],
  steps: [
    {
      title: "One leader takes every write",
      short: "One leader",
      text: "The leader is the only node that accepts writes. It records the client’s $25 payment at position 204 of its replication log, right after 203, which both followers have already applied.",
      focus: ["client", "leader"],
      facts: [["Takes writes", "the leader only"]],
      changes: ["+ $25 at position 204"],
      events: [
        { type: "cursor", log: "log", id: "f1", at: 203, label: "Follower 1" },
        // two changes to one log run one after the other: started together, only one survives the play
        { type: "cursor", log: "log", id: "f2", at: 203, label: "Follower 2", gap: 0 },
        { type: "append", log: "log", from: "client", records: [{ text: "$25" }] },
        // a state event never runs alongside a log event: the log's end would undo it
        { type: "state", node: "leader", light: "on", gap: 0 },
        { type: "note", node: "leader", text: "the only writer", with: true },
      ],
    },
    {
      title: "Followers apply the log in order",
      short: "Apply in order",
      text: "Follower 1 and Follower 2 apply the log in the leader’s order, 204 after 203, so all three copies converge on the same state. The cost: every write still passes through one node.",
      focus: ["leader", "f1", "f2"],
      facts: [["Every write", "through one node"]],
      changes: ["~ Both followers at 204", "~ Three copies agree"],
      events: [
        // a copy shipped to a follower is ink, as in every lesson of the chapter (a log read defaults to a blue reply);
        // the follower's ack is the blue reply
        { type: "read", log: "log", at: 204, to: "f1", kind: "request" },
        { type: "read", log: "log", at: 204, to: "f2", kind: "request", with: true },
        { type: "cursor", log: "log", id: "f1", at: 204 },
        { type: "cursor", log: "log", id: "f2", at: 204, gap: 0 },
      ],
    },
    {
      title: "Asynchronous: answer after its own commit",
      short: "Asynchronous",
      text: "With asynchronous replication the leader answers as soon as it commits. The $60 and $15 payments are confirmed at 205 and 206 while both followers still sit at 204, to catch up later.",
      focus: ["client", "leader"],
      metrics: { wait: { n: 0, unit: " ms" }, copies: 1 },
      changes: ["+ $60 at 205, $15 at 206", "~ Both confirmed at once", "~ Followers still at 204"],
      events: [
        { type: "append", log: "log", from: "client", records: [{ text: "$60" }, { text: "$15" }] },
        { type: "packet", path: ["leader", "client"], label: "OK", kind: "response" },
        { type: "state", node: "client", detail: "got OK 205, 206" },
      ],
    },
    {
      title: "A crash loses what hasn’t shipped",
      short: "Leader crash",
      text: "The leader crashes before shipping 205 and 206. The client was told both payments succeeded, but no follower has them, so whichever follower takes over has never seen them.",
      focus: ["leader"],
      metrics: { copies: { n: 1, tone: "hot" } },
      changes: ["− Leader crashes", "− $60 and $15, confirmed but lost"],
      events: [
        { type: "record", log: "log", at: 205, tone: "hot" },
        { type: "record", log: "log", at: 206, tone: "hot", gap: 0 },
        { type: "state", node: "leader", down: true, light: "idle" },
        { type: "note", node: "leader", text: "205, 206 never shipped", tone: "hot" },
      ],
    },
    {
      title: "Synchronous: commits wait 90 ms",
      short: "Synchronous",
      text: "Replay it with synchronous replication: the leader answers only after both followers confirm. Follower 1 confirms the $30 payment at 205 within 1 ms, but Follower 2 is 90 ms away, so every commit waits at least 90 ms.",
      focus: ["leader", "f1", "f2"],
      metrics: { wait: { n: 90, unit: " ms" }, copies: 3 },
      changes: ["+ $30 at 205", "~ Both followers confirm", "~ The answer waits for Follower 2"],
      events: [
        // the replay starts from 204, the history both followers share
        { type: "state", node: "leader", down: false, light: "on" },
        { type: "state", node: "client", detail: "sends payments", with: true },
        { type: "truncate", log: "log", after: 204 },
        { type: "append", log: "log", records: [{ text: "$30" }] },
        { type: "read", log: "log", at: 205, to: "f1", kind: "request" },
        { type: "cursor", log: "log", id: "f1", at: 205, with: true },
        { type: "read", log: "log", at: 205, to: "f2", kind: "request", with: true },
        { type: "state", node: "f1", readout: "ack in 1 ms", gap: 0 },
        // the Leader still waits on the follower 90 ms away
        { type: "pause", ms: 700, gap: 0 },
        { type: "state", node: "f2", readout: "ack in 90 ms", gap: 0 },
        { type: "cursor", log: "log", id: "f2", at: 205, gap: 0 },
        { type: "packet", path: ["f2", "leader"], label: "ack", kind: "response", with: true },
        { type: "state", node: "client", detail: "got OK 205" },
      ],
    },
    {
      title: "One stalled follower stalls every write",
      short: "Stalled",
      text: "Follower 2’s disk stalls. The $18 payment at 206 reaches both followers and Follower 1 confirms it, but the leader must also wait for Follower 2, so this commit hangs, and every one after it.",
      focus: ["leader", "f1", "f2"],
      metrics: { wait: "stalled" },
      changes: ["~ Follower 2 stalls", "+ $18 at 206", "− No answer for the client"],
      events: [
        { type: "state", node: "f2", light: "hot", tone: "hot", readout: "disk stalled" },
        { type: "append", log: "log", records: [{ text: "$18" }] },
        { type: "read", log: "log", at: 206, to: "f1", kind: "request" },
        { type: "cursor", log: "log", id: "f1", at: 206, with: true },
        { type: "read", log: "log", at: 206, to: "f2", kind: "request", with: true },
        { type: "state", node: "client", detail: "waiting for OK 206" },
      ],
    },
    {
      title: "Semi-synchronous: wait for any one",
      short: "Semi-sync",
      text: "Switch to semi-synchronous: the leader waits for any one follower. Follower 1 confirmed 206 within 1 ms, which is now enough, so the leader confirms the payment while Follower 2 stays stalled. It survives the leader’s death as long as Follower 1 survives.",
      focus: ["client", "leader"],
      metrics: { wait: { n: 1, unit: " ms" }, copies: 2 },
      changes: ["~ Waits for any one follower", "+ OK for 206", "~ Follower 2 no longer blocks writes"],
      events: [
        { type: "packet", path: ["leader", "client"], label: "OK 206", kind: "response" },
        { type: "state", node: "client", detail: "got OK 206" },
        // the Client's detail is hidden on a phone, so a note says why the answer could go
        { type: "note", node: "leader", text: "1 ack is enough now", tone: "work" },
      ],
    },
    {
      title: "The fallback to async is quiet",
      short: "Fallback",
      text: "With Follower 2 still stalled, Follower 1 drops off the network. The $9 payment at 207 waits out a timeout, then MySQL’s semi-synchronous mode falls back to asynchronous and confirms it with only the leader’s copy. Monitor for that switch.",
      focus: ["monitor", "leader", "f1"],
      metrics: { wait: "the timeout", copies: { n: 1, tone: "hot" } },
      changes: ["+ $9 at 207", "− No follower confirms", "~ Back to asynchronous", "+ Monitoring alerts"],
      events: [
        { type: "state", node: "f1", down: true, light: "idle", readout: "" },
        { type: "append", log: "log", records: [{ text: "$9" }] },
        { type: "packet", path: ["leader", "f1"], label: "$9", kind: "hot", lost: true },
        // the Leader waits out the timeout, then answers the Client (out of focus) with its own copy only
        { type: "pause", ms: 600 },
        { type: "record", log: "log", at: 207, tone: "hot" },
        { type: "state", node: "client", detail: "got OK 207" },
        // the note sits by Follower 1, in the gap between a phone's rows: over Monitoring it would push the phone's
        // camera out and shrink its labels under 10 px at 375×667
        { type: "note", node: "f1", text: "no ack: semi-sync is off" },
        { type: "state", node: "monitor", light: "work", detail: "alert: semi-sync off", with: true },
      ],
    },
  ],
};
