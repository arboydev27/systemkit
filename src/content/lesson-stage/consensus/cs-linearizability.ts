import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Make replicas look like one copy": a timeline from 0 to 60 ms of seat 14 on a leader and its follower, with the
// lesson's own intervals. Client A writes “sold” from t=10 to t=30 (the leader applies it at t=15 and acknowledges at
// t=30); Client B's read from t=15 to t=20 overlaps the write and returns “sold”, so every read that starts after t=20
// must return “sold” too. The follower copies writes later (it holds “free” until t=90, 50 ms after C's read and past
// the drawing, so t=90 lives in the text and facts), and Client C's read at t=40 from the follower returns “free”: a read
// that went back in time. Replayed, C's read goes to the leader, which first checks with a majority that it still leads
// (the follower's yes makes 2 of 2), and C gets “sold” at t=60: 20 ms against the stale read's 10, one extra 10 ms round
// trip (the extra 10 ms of the lesson's scenario). Replayed once more with the follower cut off at t=35, the check is
// lost and the leader refuses the read: the guarantee working (a blue reply, "no", the leader's answer to C as the
// follower's "yes" was to the leader; short so its pill fits between two rails on a 375 px phone and leaves the arrowhead
// at C in sight; the text gives the reason), at the price of an answer.
// Times: every hop between C, the leader and the follower takes 5 ms, so the extra round trip is plain; A's write and its
// ok take 5 ms each way, B's read 2.5. The lost check is drawn over 14 ms (it never arrives, so the time makes no claim)
// so its × lands clear of its pill on a phone.
// Lifelines run A, B, Leader, Follower, C, the brief's order: A and B sit together so their intervals compare, B's read
// and the stale read go between neighbours, and the messages that cross a rail (A's write and its ok over B, C's reads
// of the leader over the follower) cross it while that lifeline has nothing to say. The replays redraw A's write as its
// interval only (10 to 30, no messages), in one brisk sweep: the learner has seen it, the new part is C's read, and the
// interval is what shows C's read starts after the write finished. Each replay plays in about 8.5 s on a wide stage:
// the rewind takes 1.5 s, and C's read and its answer cross the follower's lifeline, so each takes about 1.2 s.
export const csLinearizabilityStage: StageScene = {
  id: "cs-linearizability",
  layout: "timeline",
  timeline: { ticks: [0, 10, 20, 30, 40, 50, 60], unit: "ms" },
  intro: "Watch one write and two reads of seat 14 on a millisecond clock, then replay the stale read with a check that keeps it current.",
  metrics: [
    { id: "time", label: "Time", derive: { clock: true } },
    { id: "must", label: "Reads must see" },
    { id: "stale", label: "Stale reads" },
  ],
  nodes: [
    { id: "a", role: "client", label: "Client A", detail: "buys seat 14", at: [0, 0] },
    { id: "b", role: "client", label: "Client B", detail: "reads seat 14", at: [1, 0] },
    { id: "leader", role: "database", label: "Leader", detail: "takes every write", at: [2, 0], opts: { replica: true, lead: true } },
    { id: "follower", role: "database", label: "Follower", detail: "copies writes later", at: [3, 0], opts: { replica: true } },
    { id: "c", role: "client", label: "Client C", detail: "reads seat 14", at: [4, 0] },
  ],
  links: [],
  steps: [
    {
      title: "A’s write is in progress",
      short: "A writes",
      text: "Seat 14 is free on both replicas. At t=10 Client A starts writing “sold”, and the leader applies it at t=15. Until A hears back, the write is in progress: it takes effect at one instant somewhere between its start and its finish.",
      metrics: { must: "free or sold", stale: 0 },
      facts: [["A’s write", "from t=10"], ["Leader applies it", "t=15"]],
      changes: ["+ A’s write starts at t=10", "~ Leader: seat 14 sold"],
      events: [
        { type: "state", nodes: ["leader", "follower"], readout: "14: free" },
        { type: "span", id: "aw", node: "a", t: 10 },
        { type: "packet", path: ["a", "leader"], label: "write", t: 10, dur: 5, with: true },
        { type: "state", node: "leader", readout: "14: sold" },
        { type: "mark", node: "leader", text: "applied", tone: "work", t: 15, dur: 0, with: true },
      ],
    },
    {
      title: "B’s read overlaps the write",
      short: "B reads",
      text: "Client B reads from t=15 to t=20, while A’s write is still in progress, so either answer would be acceptable. It returns “sold”. The write has now visibly taken effect, so every read that starts after t=20 must return “sold” too.",
      focus: ["a", "b", "leader"],
      metrics: { must: "sold" },
      facts: [["B’s read", "t=15 to 20"], ["Reads after t=20", "must see sold"]],
      changes: ["+ B’s read returns sold", "~ Later reads must see sold"],
      events: [
        { type: "span", id: "br", node: "b", t: 15 },
        { type: "packet", path: ["b", "leader"], label: "read", t: 15, dur: 2.5, with: true },
        { type: "packet", path: ["leader", "b"], label: "sold", kind: "response", dur: 2.5 },
        { type: "span", id: "br", end: true, t: 20 },
      ],
    },
    {
      title: "The write is acknowledged at t=30",
      short: "Write done",
      text: "The leader’s acknowledgment reaches A at t=30, and A’s write is complete: any read that starts now must return “sold”, whichever replica it asks. But the follower copies writes later. It still holds “free”, and catches up only at t=90.",
      focus: ["a", "leader", "follower"],
      facts: [["A’s write", "t=10 to 30"], ["Follower", "free until t=90"]],
      changes: ["+ A’s write acknowledged", "+ Follower behind"],
      events: [
        { type: "packet", path: ["leader", "a"], label: "ok", kind: "response", t: 25, dur: 5 },
        { type: "span", id: "aw", end: true, t: 30 },
        { type: "span", id: "lag", node: "follower", label: "behind", tone: "quiet", t: 15 },
      ],
    },
    {
      title: "C reads “free” after B saw “sold”",
      short: "Stale read",
      text: "At t=40, after the acknowledgment and after B saw “sold” at t=20, Client C reads from the follower and gets “free”. The read went back in time, so the guarantee is broken, and the follower catching up 50 ms later, at t=90, doesn’t undo it.",
      metrics: { stale: { n: 1, tone: "hot" } },
      facts: [["B’s read, t=20", "sold"], ["C’s read, t=40", "free"]],
      changes: ["+ C’s read returns free", "~ 1 stale read"],
      events: [
        { type: "span", id: "cr", node: "c", t: 40 },
        { type: "packet", path: ["c", "follower"], label: "read", t: 40, dur: 5, with: true },
        { type: "packet", path: ["follower", "c"], label: "free", kind: "hot", dur: 5 },
        { type: "span", id: "cr", end: true, t: 50 },
      ],
    },
    {
      title: "The leader confirms, then answers",
      short: "Confirmed read",
      text: "Replay it with C’s read sent to the leader. Before answering, the leader checks with a majority that it still leads: the follower’s yes makes 2 of 2, so no newer leader can hold writes it lacks. C gets “sold” at t=60: 20 ms, against the stale read’s 10.",
      focus: ["c", "leader", "follower"],
      metrics: { stale: 0 },
      facts: [["Read from the follower", "10 ms, stale"], ["Confirmed read", "20 ms"]],
      changes: ["~ C reads from the leader", "+ One extra round trip", "~ C’s read returns sold"],
      events: [
        // A's write again as its interval only, in one brisk sweep: the span's dur runs the clock on with it (10 → 30), and
        // its end's runs it on to C's read (30 → 40), so no idle catch-up follows. The readouts change on their own,
        // since a state event started alongside a timeline event is undone when that event ends.
        { type: "rewind" },
        { type: "state", node: "leader", readout: "14: free", gap: 0 },
        { type: "span", id: "aw", node: "a", t: 10, dur: 20, gap: 0 },
        { type: "state", node: "leader", readout: "14: sold", gap: 0 },
        { type: "span", id: "aw", end: true, t: 30, dur: 10, gap: 0 },
        { type: "span", id: "cr", node: "c", t: 40, gap: 0 },
        { type: "packet", path: ["c", "leader"], label: "read", t: 40, dur: 5, with: true },
        { type: "packet", path: ["leader", "follower"], label: "leader?", dur: 5, gap: 0 },
        { type: "packet", path: ["follower", "leader"], label: "yes", kind: "response", dur: 5, gap: 0 },
        // C's read is left open: it runs on to now, which ends at t=60 as "sold" lands, so it is drawn exactly as if
        // closed there, without a closing beat after the answer
        { type: "packet", path: ["leader", "c"], label: "sold", kind: "response", dur: 5, gap: 0 },
      ],
    },
    {
      title: "Cut off, the leader must refuse",
      short: "The cost",
      text: "Replay it with the follower cut off at t=35. The leader’s check gets no answer, so it can’t confirm a majority and refuses C’s read with a “no” rather than risk a stale one. Spend this where stale answers do harm: locks, leader election, unique usernames. A like counter rarely needs it.",
      focus: ["c", "leader", "follower"],
      facts: [["Worth it for", "locks, usernames"], ["Rarely for", "like counters"]],
      changes: ["+ Follower cut off", "~ C’s read refused"],
      events: [
        { type: "rewind" },
        { type: "state", node: "leader", readout: "14: free", gap: 0 },
        { type: "span", id: "aw", node: "a", t: 10, dur: 20, gap: 0 },
        { type: "state", node: "leader", readout: "14: sold", gap: 0 },
        { type: "span", id: "aw", end: true, t: 30, dur: 5, gap: 0 },
        { type: "span", id: "cut", node: "follower", label: "cut off", tone: "hot", t: 35, dur: 5, gap: 0 },
        { type: "span", id: "cr", node: "c", t: 40, gap: 0 },
        { type: "packet", path: ["c", "leader"], label: "read", t: 40, dur: 5, with: true },
        // lost to the cut, so orange, as every lost message in the chapter is
        { type: "packet", path: ["leader", "follower"], label: "leader?", kind: "hot", dur: 14, lost: true, gap: 0 },
        // the refusal is the guarantee working, so it is a reply (blue); the text gives its reason
        { type: "packet", path: ["leader", "c"], label: "no", kind: "response", t: 55, dur: 5, gap: 0 },
      ],
    },
  ],
};
