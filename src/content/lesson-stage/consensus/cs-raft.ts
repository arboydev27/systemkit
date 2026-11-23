import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Agree through a majority log": the lesson's worked example on five lifelines, N1 to N5, with the clock left to
// run (terms, not seconds, are the point). N1 leads term 7 and copies entry 42 to N2 and N3, which store it and reply:
// three of five, a majority, so N1 commits it and acknowledges the client; N4 and N5 lag behind. A partition then
// isolates N1 and N2 (N1 keeps term 7 on its span), and N1's retry of 42 to N4 is lost. The election is retold after
// a rewind, from the partition on (N1 and N2 cut off from the top, N3 holding 42): N4 stands in term 8; N3 refuses
// because N4's log lacks 42, so N4 has only two votes (itself and N5). N3 stands in term 9 and wins with three
// (itself, N4, N5), so entry 42 survives. Then, after another rewind, only the term check: the partition has healed,
// N1 (still leading term 7 in its view) sends to N3, N3 (leading term 9) rejects it and replies with term 9, and N1
// steps down. Last, after a third rewind: with N4 and N5 crashed (their heads crossed out, their rails dimmed), entry
// 43 still commits on three of five after a round trip and a disk flush; facts give three nodes surviving one
// failure, a sixth node adding none (the majority rises to four), and writes pausing about a second during an
// election. The "Stored on" chip counts entry 42 until the last telling, then entry 43.
// Lifelines run in node order, so the partition falls between N2's and N3's rails and every vote goes between
// neighbours or across one rail; the one lost retry (N1 → N4) stops short between N2 and N3, where the cut is. A
// phone hangs a mark's pill beside or under its dot, so mark texts stay short ("has 42" ends clear of the next rail)
// and the marks that need it take time of their own (`dur`: the stores, the commit, the refusal, the flushes) so what
// follows starts below the pill; the order down the screen stays the order of events. Notes are kept for what the text
// already says (N1 appends, the ack, N1 steps down). Four tellings keep each under eight beats (the scale follows the
// longest, the last at 7.75), which a 375×667 phone needs: one long run gave a beat 15 px there, and its pills landed
// on each other, on rails and on arrowheads.
export const csRaftStage: StageScene = {
  id: "cs-raft",
  layout: "timeline",
  intro: "Watch five nodes commit entry 42 on a majority, lose their leader to a partition, and elect one that still holds it.",
  metrics: [
    { id: "term", label: "Term" },
    { id: "stored", label: "Stored on" },
    { id: "votes", label: "Votes" },
  ],
  nodes: [
    // the leader's cap is plain with the flag and a follower's carries the replica ring, as in the replication chapter,
    // so the ring and the flag change hands together when N3 wins and N1 steps down
    { id: "n1", role: "database", label: "N1", detail: "leader", at: [0, 0], opts: { lead: true } },
    { id: "n2", role: "database", label: "N2", detail: "follower", at: [1, 0], opts: { replica: true } },
    { id: "n3", role: "database", label: "N3", detail: "follower", at: [2, 0], opts: { replica: true } },
    { id: "n4", role: "database", label: "N4", detail: "follower", at: [3, 0], opts: { replica: true } },
    { id: "n5", role: "database", label: "N5", detail: "follower", at: [4, 0], opts: { replica: true } },
  ],
  links: [],
  steps: [
    {
      title: "N1 leads term 7 and copies entry 42",
      short: "Copy 42",
      text: "Five nodes keep one log. N1 leads term 7: it appends each command and copies it to the followers. A client’s write becomes entry 42, and N2 and N3 store it and reply. N4 and N5 lag behind and don’t have it yet.",
      metrics: { term: 7, stored: { n: 3, unit: " of 5" } },
      changes: ["+ Entry 42 on N1", "+ N2 and N3 store it"],
      events: [
        { type: "span", id: "t7", node: "n1", label: "leads t7", tone: "work" },
        // a state change waits for the figure's events before it, which would otherwise undo it as they finish
        { type: "state", node: "n1", light: "on" },
        { type: "note", node: "n1", text: "appends 42", with: true },
        { type: "packet", path: ["n1", "n2"], label: "42" },
        { type: "packet", path: ["n1", "n3"], label: "42", with: true },
        // plain (no tone dot), so on a 375 px phone N2's pill ends short of N3's rail and reads as N2's; each node
        // stores the entry, then replies a beat later, which gives N2's pill room by its dot on a wide screen and a
        // 390 px phone (with less, it rests between N2's and N3's rows, or above the dot, as if before the entry came)
        { type: "mark", node: "n2", text: "has 42", dur: 1 },
        { type: "mark", node: "n3", text: "has 42", dur: 1, with: true },
        { type: "packet", path: ["n2", "n1"], label: "ack", kind: "response" },
        { type: "packet", path: ["n3", "n1"], label: "ack", kind: "response", with: true },
      ],
    },
    {
      title: "Three of five hold it, so it commits",
      short: "Commit 42",
      text: "N1, N2 and N3 now hold entry 42: three of five, a majority. Only now does N1 apply it and acknowledge the client. Any later majority must include one of these three, so the entry is safe.",
      facts: [["Majority of 5", "3"], ["Holding 42", "N1, N2, N3"]],
      changes: ["+ Entry 42 committed", "+ Client acknowledged"],
      events: [
        // the commit has a stretch of its own, so on a phone its pill sits above the partition that follows; the text
        // names the entry, so the mark stays short enough to end clear of N2's rail
        { type: "mark", node: "n1", text: "commits", tone: "work", dur: 2 },
        { type: "state", node: "n1", light: "work" },
        { type: "note", node: "n1", text: "ack sent", tone: "work", with: true },
      ],
    },
    {
      title: "A partition cuts off N1 and N2",
      short: "Cut off N1, N2",
      text: "A partition now isolates N1 and N2 from the other three. N1’s retry of entry 42 to N4 is lost, so N4 and N5 still lack it. N1 still thinks it leads term 7, but it can’t reach a majority, so nothing new commits.",
      changes: ["+ N1 and N2 cut off", "+ Retry to N4 lost"],
      events: [
        { type: "span", id: "t7", end: true },
        { type: "span", id: "cut2", node: "n2", label: "cut off", tone: "hot", with: true },
        // half a beat before the retry leaves, so on a phone N2's "cut off" rests right of its sleeve, above the retry
        { type: "span", id: "cut1", node: "n1", label: "t7 · cut off", tone: "hot", with: true, dur: 0.5 },
        { type: "state", nodes: ["n1", "n2"], light: "hot" },
        // one retry only: a lost message stops at 62% of its way, so N1 → N4's × lands between N2 and N3, on the cut;
        // its pill stays "42": on a phone a pill naming N4 is too wide, and rests on the × or on N1's sleeve
        { type: "packet", path: ["n1", "n4"], label: "42", kind: "hot", lost: true, dur: 0.75 },
      ],
    },
    {
      title: "N4 can’t win without entry 42",
      short: "N4 refused",
      text: "Hearing from no leader, N4 stands in term 8 and votes for itself. N5 votes yes, but N3 refuses: N4’s log lacks entry 42, so it is behind N3’s. That refusal is the protection working. Two votes of five aren’t a majority.",
      focus: ["n3", "n4", "n5"],
      metrics: { term: 8, votes: { n: 2, unit: " of 5" } },
      facts: [["N4’s votes", "N4, N5"], ["N3 refuses", "N4 lacks 42"]],
      changes: ["+ N4 stands in term 8", "+ N3 refuses N4"],
      events: [
        // the election is retold from the partition on, so no telling runs much past eight beats: N1 and N2 are cut
        // off from the top, and N3 holds entry 42 while N4 and N5 lack it
        { type: "rewind" },
        { type: "span", id: "cut1b", node: "n1", label: "t7 · cut off", tone: "hot", gap: 160 },
        { type: "span", id: "cut2b", node: "n2", label: "cut off", tone: "hot", with: true },
        { type: "mark", node: "n3", text: "has 42", with: true, dur: 1 },
        { type: "state", node: "n4", detail: "candidate", light: "on" },
        { type: "packet", path: ["n4", "n3"], label: "vote? t8" },
        { type: "packet", path: ["n4", "n5"], label: "vote? t8", with: true },
        { type: "packet", path: ["n3", "n4"], label: "no", kind: "response" },
        { type: "packet", path: ["n5", "n4"], label: "yes", kind: "response", with: true },
      ],
    },
    {
      title: "N3 wins term 9, and entry 42 survives",
      short: "N3 wins",
      text: "N3 stands in term 9. N4 and N5 vote yes, since N3’s log is at least as complete as theirs, and with its own vote N3 has three: a majority. N3 leads term 9 and holds entry 42, so the committed entry survives.",
      focus: ["n3", "n4", "n5"],
      metrics: { term: 9, votes: { n: 3, unit: " of 5" } },
      facts: [["N3’s votes", "N3, N4, N5"], ["Entry 42", "kept"]],
      changes: ["+ N3 leads term 9", "~ Entry 42 kept"],
      events: [
        { type: "state", node: "n3", detail: "candidate", light: "on" },
        // N3 stands a beat and a quarter after N4's replies arrive (at 3), so on a phone "vote? t9" rests clear under
        // step 4's "no"; if step 4's timing changes, keep this t that far past its end
        { type: "packet", path: ["n3", "n4"], label: "vote? t9", t: 4.25 },
        { type: "packet", path: ["n3", "n5"], label: "vote? t9", with: true },
        { type: "packet", path: ["n4", "n3"], label: "yes", kind: "response" },
        { type: "packet", path: ["n5", "n3"], label: "yes", kind: "response", with: true },
        { type: "state", node: "n4", detail: "follower", light: "idle" },
        { type: "state", node: "n3", opts: { lead: true, replica: false }, detail: "leader", light: "work", with: true },
        // a beat of leading, so on a phone the label and the "yes" pill rest above the now line, clear of the replies'
        // arrival
        { type: "span", id: "t9", node: "n3", label: "leads t9", tone: "work", dur: 1 },
      ],
    },
    {
      title: "Term 9 turns the old leader away",
      short: "Step down",
      text: "The partition heals, and N1, still sure it leads term 7, sends to N3. N3 has seen term 9, so it refuses and replies with its term. That term check is the protection working: N1 learns of term 9 and steps down to follow N3.",
      focus: ["n1", "n2", "n3"],
      metrics: { votes: "—" },
      facts: [["N1’s term", "7 < 9"]],
      changes: ["− N1 and N2 cut off", "+ N3 refuses term 7", "~ N1 follows N3"],
      events: [
        // retold from 0 with only the term check: both nodes start by leading, each in its own term, and the lead flags
        // (N1's still up) say the same
        { type: "rewind" },
        { type: "state", nodes: ["n1", "n2"], light: "idle", gap: 160 },
        { type: "span", id: "old7", node: "n1", label: "leads t7", tone: "work", gap: 160 },
        // a beat of both leading before the append leaves, so its pill keeps clear of the two span labels
        { type: "span", id: "new9", node: "n3", label: "leads t9", tone: "work", with: true, dur: 1 },
        { type: "packet", path: ["n1", "n3"], label: "append · t7" },
        // the refusal stays on N3's lifeline, and the reply leaves a beat below it, so on a phone the two pills, each
        // wider than the gap between rails, rest one above the other over N2's idle rail
        // blue, as cs-fencing's and rc-failover's refusals of a stale write are: the protection working
        { type: "mark", node: "n3", text: "rejects", tone: "work", dur: 1 },
        { type: "packet", path: ["n3", "n1"], label: "no · t9", kind: "response" },
        // N1 stops leading as the reply lands; half a beat on to now, so on a phone the reply's pill rests clear of the
        // now line, over N2's idle rail rather than over the arrowhead
        { type: "span", id: "old7", end: true, dur: 0.5 },
        { type: "state", node: "n1", opts: { lead: false, replica: true }, detail: "follower" },
        { type: "note", node: "n1", text: "steps down", with: true },
      ],
    },
    {
      title: "Five nodes ride out two failures",
      short: "Two failures",
      text: "Say N4 and N5 crash. N1, N2 and N3 are still three of five, so entry 43 commits, paying what every write pays: a majority round trip and a disk flush. A sixth node would add no tolerance, as the majority rises to four.",
      focus: ["n1", "n2", "n3"],
      metrics: { stored: { n: 3, unit: " of 5" } },
      facts: [["5 or 6 nodes", "survive 2 failures"], ["3 nodes", "survive 1"], ["Elections", "writes pause ~1 s"]],
      changes: ["+ N4 and N5 down", "+ Entry 43 committed"],
      events: [
        { type: "rewind" },
        // the crash shows on the heads (crossed out, names struck) and focus dims their rails; the chip counts entry 43
        { type: "state", nodes: ["n4", "n5"], down: true, detail: "crashed", gap: 160 },
        { type: "span", id: "t9b", node: "n3", label: "leads t9", tone: "work", gap: 160 },
        { type: "packet", path: ["n3", "n2"], label: "43", gap: 160 },
        { type: "packet", path: ["n3", "n1"], label: "43", with: true },
        // each flush takes its time before the ack leaves, so a commit visibly waits on a majority's flush
        { type: "mark", node: "n2", text: "flush", tone: "work", dur: 2.5, gap: 0 },
        { type: "mark", node: "n1", text: "flush", tone: "work", dur: 2.5, with: true },
        { type: "packet", path: ["n2", "n3"], label: "ack", kind: "response", gap: 120 },
        { type: "packet", path: ["n1", "n3"], label: "ack", kind: "response", with: true },
        // the acks arrive at 4.5; the commit follows them a little later, so its dot lands below their shared pill,
        // and its time runs on long enough that a phone hangs its pill above the now line
        { type: "mark", node: "n3", text: "commit 43", tone: "work", t: 5.25, dur: 2.5, gap: 0 },
      ],
    },
  ],
};
