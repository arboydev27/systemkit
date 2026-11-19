import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Agree through a majority log": the lesson's worked example on five lifelines, N1 to N5, with the clock left to
// run (terms, not seconds, are the point). N1 leads term 7 and copies entry 42 to N2 and N3, which store it and reply:
// three of five, a majority, so N1 commits it and acknowledges the client. A partition then isolates N1 and N2, and N1's
// copies of 42 to N4 and N5 are lost. N4 stands in term 8; N3 refuses because N4's log lacks 42, so N4 has only two
// votes (itself and N5). N3 stands in term 9 and wins with three (itself, N4, N5), so entry 42 survives. When the
// partition heals, N1 sends in term 7, N3 refuses it with term 9, and N1 steps down. Last, the cost, told after a
// rewind: N4 and N5 crash, and entry 43 still commits on three of five after a round trip and a disk flush; facts give
// three nodes surviving one failure, a sixth node adding none (the majority rises to four), and writes pausing about a
// second during an election. Lifelines run in node order, so the partition falls between N2's and N3's rails and every
// vote goes between neighbours or across one rail. Marks take no time, so each telling stays near nine beats.
export const csRaftStage: StageScene = {
  id: "cs-raft",
  layout: "timeline",
  intro: "Watch five nodes commit entry 42 on a majority, lose their leader to a partition, and elect one that still holds it.",
  metrics: [
    { id: "term", label: "Term" },
    { id: "has42", label: "Entry 42 on" },
    { id: "votes", label: "Votes" },
  ],
  nodes: [
    { id: "n1", role: "database", label: "N1", detail: "leader", at: [0, 0], opts: { replica: true, lead: true } },
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
      text: "Five nodes keep one log. N1 leads term 7: it appends each command and copies it to the followers. A client’s write becomes entry 42, and N2 and N3 store it and reply. N4 and N5 don’t have it yet.",
      metrics: { term: 7, has42: { n: 3, unit: " of 5" } },
      changes: ["+ Entry 42 on N1", "+ N2 and N3 store it"],
      events: [
        { type: "span", id: "t7", node: "n1", label: "leads t7", tone: "work" },
        { type: "state", node: "n1", light: "on", with: true },
        { type: "mark", node: "n1", text: "append 42", dur: 0 },
        { type: "packet", path: ["n1", "n2"], label: "42" },
        { type: "packet", path: ["n1", "n3"], label: "42", with: true },
        { type: "mark", node: "n2", text: "stores 42", tone: "work", dur: 0 },
        { type: "mark", node: "n3", text: "stores 42", tone: "work", dur: 0, with: true },
        { type: "packet", path: ["n2", "n1"], label: "ok", kind: "response" },
        { type: "packet", path: ["n3", "n1"], label: "ok", kind: "response", with: true },
      ],
    },
    {
      title: "Three of five hold it, so it commits",
      short: "Commit",
      text: "N1, N2 and N3 now hold entry 42: three of five, a majority. Only now does N1 apply it and acknowledge the client. Any later majority must include one of these three, so the entry is safe.",
      facts: [["Majority of 5", "3"], ["Holding 42", "N1, N2, N3"]],
      changes: ["+ Entry 42 committed", "+ Client acknowledged"],
      events: [
        { type: "mark", node: "n1", text: "commit 42", tone: "work", dur: 0 },
        { type: "state", node: "n1", light: "work", with: true },
        { type: "note", node: "n1", text: "ack sent", tone: "work", with: true },
      ],
    },
    {
      title: "A partition cuts off N1 and N2",
      short: "Partition",
      text: "A partition now isolates N1 and N2 from the other three. N1’s copies of entry 42 to N4 and N5 are lost, so they still lack it. N1 still thinks it leads, but it can’t reach a majority, so nothing new commits.",
      changes: ["+ N1 and N2 cut off", "− Copies to N4 and N5"],
      events: [
        { type: "span", id: "t7", end: true },
        { type: "span", id: "cut1", node: "n1", label: "cut off", tone: "hot", with: true },
        { type: "span", id: "cut2", node: "n2", label: "cut off", tone: "hot", with: true },
        { type: "state", nodes: ["n1", "n2"], light: "hot", with: true },
        { type: "packet", path: ["n1", "n4"], label: "42", kind: "hot", lost: true, dur: 0.5 },
        { type: "packet", path: ["n1", "n5"], label: "42", kind: "hot", lost: true, dur: 0.5, with: true },
      ],
    },
    {
      title: "N4 can’t win without entry 42",
      short: "N4 refused",
      text: "Hearing from no leader, N4 stands in term 8 and votes for itself. N5 votes yes, but N3 refuses: N4’s log lacks entry 42, so it is behind N3’s. That refusal is the protection working. Two votes of five aren’t a majority.",
      focus: ["n3", "n4", "n5"],
      metrics: { term: 8, votes: { n: 2, unit: " of 5" } },
      facts: [["N4’s votes", "N4, N5"], ["N3 refuses", "log behind"]],
      changes: ["+ N4 stands in term 8", "− N3’s vote"],
      events: [
        { type: "state", node: "n4", detail: "candidate", light: "on" },
        { type: "packet", path: ["n4", "n3"], label: "vote? t8" },
        { type: "packet", path: ["n4", "n5"], label: "vote? t8", with: true },
        { type: "mark", node: "n3", text: "N4 lacks 42", dur: 0 },
        { type: "packet", path: ["n3", "n4"], label: "no", kind: "response" },
        { type: "packet", path: ["n5", "n4"], label: "yes", kind: "response", with: true },
        { type: "mark", node: "n4", text: "2 votes", tone: "quiet", dur: 0.7 },
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
        { type: "packet", path: ["n3", "n4"], label: "vote? t9" },
        { type: "packet", path: ["n3", "n5"], label: "vote? t9", with: true },
        { type: "packet", path: ["n4", "n3"], label: "yes", kind: "response" },
        { type: "packet", path: ["n5", "n3"], label: "yes", kind: "response", with: true },
        { type: "state", node: "n4", detail: "follower", light: "idle", with: true },
        { type: "mark", node: "n3", text: "3 votes", tone: "work", dur: 0 },
        { type: "span", id: "t9", node: "n3", label: "leads t9", tone: "work", with: true },
        { type: "state", node: "n3", opts: { lead: true }, detail: "leader", light: "work", with: true },
      ],
    },
    {
      title: "Term 9 turns the old leader away",
      short: "Step down",
      text: "The partition heals, and N1, still leading term 7 in its own view, sends to N3. N3 has seen term 9, so it refuses the message and replies with its term. N1 learns of the higher term and steps down to follow N3.",
      focus: ["n1", "n2", "n3"],
      metrics: { votes: "—" },
      facts: [["N1’s term", "7 < 9"]],
      changes: ["− N1 and N2 cut off", "+ N3 refuses term 7", "~ N1 follows N3"],
      events: [
        { type: "span", id: "cut1", end: true },
        { type: "span", id: "cut2", end: true, with: true },
        { type: "state", nodes: ["n1", "n2"], light: "idle", with: true },
        { type: "packet", path: ["n1", "n3"], label: "append · t7" },
        { type: "packet", path: ["n3", "n1"], label: "no · t9", kind: "response" },
        { type: "mark", node: "n1", text: "steps down", dur: 0 },
        { type: "state", node: "n1", opts: { lead: false }, detail: "follower", with: true },
      ],
    },
    {
      title: "Five nodes ride out two failures",
      short: "The cost",
      text: "Each write costs a majority round trip and a disk flush. Say N4 and N5 now crash: N3, N2 and N1 are still three of five, so entry 43 commits. A sixth node would add no tolerance, as the majority rises to four.",
      facts: [["5 or 6 nodes", "survive 2 failures"], ["3 nodes", "survive 1"], ["Elections", "writes pause ~1 s"]],
      changes: ["+ N4 and N5 down", "+ Entry 43 committed"],
      events: [
        { type: "rewind" },
        { type: "span", id: "t9b", node: "n3", label: "leads t9", tone: "work" },
        { type: "mark", node: "n4", text: "crash", tone: "hot", dur: 0, with: true },
        { type: "mark", node: "n5", text: "crash", tone: "hot", dur: 0, with: true },
        { type: "state", nodes: ["n4", "n5"], down: true, detail: "crashed", with: true },
        { type: "packet", path: ["n3", "n2"], label: "43" },
        { type: "packet", path: ["n3", "n1"], label: "43", with: true },
        { type: "mark", node: "n2", text: "flush 43", tone: "work", dur: 0 },
        { type: "mark", node: "n1", text: "flush 43", tone: "work", dur: 0, with: true },
        { type: "packet", path: ["n2", "n3"], label: "ok", kind: "response" },
        { type: "packet", path: ["n1", "n3"], label: "ok", kind: "response", with: true },
        { type: "mark", node: "n3", text: "commit 43", tone: "work", dur: 0 },
      ],
    },
  ],
};
