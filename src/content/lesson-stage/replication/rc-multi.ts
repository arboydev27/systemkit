import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Accept writes in more than one place": a timeline in ms with four lifelines, Ana, Region A (Virginia),
// Region B (Sydney) and Ben, the regions in the middle so the bookings and the replication go between neighbours. First
// a single leader in Region A: Ben's write from Sydney crosses Region B's rail to Virginia and back, 100 ms each way, the
// lesson's 200 ms round trip. Replayed with a leader in each region, the hotel has one room left: Region A sells it to
// Ana at t=0 (25 ms each way to her own region, 50 ms in all) and Region B sells it to Ben half a second later, at 500 ms,
// before Ana's booking arrives; both are told yes. Replication forwards each booking asynchronously, 575 ms in both
// directions (longer than the half second, so it lands after Ben's sale): Ana's reaches Region B at 600 ms and Ben's
// reaches Region A at 1,100 ms, a conflict in each, too late to reject either. Last-write-wins keeps Ben's (the later
// timestamp, 525 against 25) in both and silently drops Ana's, a mark on her lifeline at 1,100 ms when the last copy
// goes, worded "dropped, not told" so it can't read as Ana being told; CRDTs and keeping both versions are named in the
// text and facts. The 575 ms is replication lag, not travel time (step 1 crosses the same path in 100 ms), and step 4
// says so. Replayed once more with Region A as the room's
// home region: Ben's booking travels there at 500 ms, Region A answers sold out (blue: the rule working) and Ben pays the
// 200 ms round trip; Region B is dimmed, as Ben's booking passes it by.
// The median message is the 100 ms far hop, so a beat is 100 ms and the hotel telling runs about 11 beats; its local
// messages are short, so it carries no commit marks (on a phone they crowded Region B's rail between 525 and 600 ms),
// and the people's tags are names only, so Ana's pills at t=0 keep clear of her tag. The result of last-write-wins is a
// mark, not head readouts or notes: a readout pill sits where the t=0 pills rest, and a note over a head at the stage's
// left edge is clipped on a phone. Ticks are 0, 500 and 1,000, since 750 and 1000 run together at 375 px. The replay
// retells Ana's booking briskly (gaps of 0 and 60 ms) and sends "already sold" with the reply, to keep the step short.
export const rcMultiStage: StageScene = {
  id: "rc-multi",
  layout: "timeline",
  timeline: { ticks: [0, 500, 1000], unit: "ms" },
  intro: "Watch two regions each take bookings locally and sell the last hotel room twice, then replay it with one home region that sells it once.",
  metrics: [{ id: "told", label: "Told yes" }, { id: "wait", label: "Ben waits" }],
  nodes: [
    { id: "ana", role: "client", label: "Ana", at: [0, 0] },
    { id: "a", role: "database", label: "Region A", detail: "Virginia", at: [1, 0], opts: { lead: true } },
    { id: "b", role: "database", label: "Region B", detail: "Sydney", at: [2, 0], opts: { replica: true } },
    { id: "ben", role: "client", label: "Ben", at: [3, 0] },
  ],
  links: [],
  steps: [
    {
      title: "Every write travels to one leader",
      short: "One leader",
      text: "A single leader sits in Region A, in Virginia; Region B in Sydney only copies. Ben’s write from Sydney crosses the world and back, a round trip of about 200 ms on every write, and if Virginia goes dark, writes stop.",
      focus: ["a", "b", "ben"],
      metrics: { wait: { n: 200, unit: " ms" } },
      facts: [["Sydney to Virginia", "about 200 ms"], ["Virginia goes dark", "writes stop"]],
      changes: ["+ Ben’s write goes to Virginia", "+ 200 ms round trip"],
      events: [
        { type: "packet", path: ["ben", "a"], label: "write", t: 0, dur: 100 },
        { type: "mark", node: "a", text: "commit", tone: "work" },
        { type: "packet", path: ["a", "ben"], label: "committed", kind: "response", t: 100, dur: 100 },
      ],
    },
    {
      title: "Each region’s leader takes local writes",
      short: "Two leaders",
      text: "Replay it with a leader in each region: each takes its own region’s writes and forwards them to the other asynchronously. The hotel has one room left. Region A sells it to Ana and confirms in 50 ms, without asking Region B.",
      focus: ["ana", "a", "b"],
      frame: ["ana", "a", "b", "ben"],
      metrics: { told: { n: 1, unit: " for 1 room" }, wait: "—" },
      facts: [["Each region", "takes local writes"], ["Forwarding", "asynchronous"], ["Ana to Region A", "50 ms round trip"]],
      changes: ["+ Region B leads too", "+ Region A sells the room to Ana", "+ Ana told yes"],
      events: [
        { type: "rewind" },
        { type: "state", node: "b", opts: { lead: true, replica: false }, gap: 0 },
        { type: "packet", path: ["ana", "a"], label: "book room", t: 0, dur: 25 },
        { type: "packet", path: ["a", "ana"], label: "confirmed", kind: "response", t: 25, dur: 25 },
      ],
    },
    {
      title: "Region B sells the same room to Ben",
      short: "Ben books",
      text: "Half a second later, Ben books the room in Region B. Ana’s booking hasn’t arrived there yet, so Region B sees the room free, sells it and confirms in 50 ms, with no trip to Virginia. Both guests have been told yes.",
      focus: ["b", "ben"],
      frame: ["ana", "a", "b", "ben"],
      metrics: { told: { n: 2, unit: " for 1 room", tone: "hot" }, wait: { n: 50, unit: " ms" } },
      facts: [["Ben books", "500 ms after Ana"], ["Region B has", "no booking yet"]],
      changes: ["+ Region B sells the room to Ben", "+ Ben told yes", "~ One room, two guests"],
      events: [
        { type: "packet", path: ["ben", "b"], label: "book room", t: 500, dur: 25 },
        { type: "packet", path: ["b", "ben"], label: "confirmed", kind: "response", t: 525, dur: 25 },
      ],
    },
    {
      title: "The conflict surfaces too late",
      short: "Conflict",
      text: "Asynchronous replication runs behind, here 575 ms: Ana’s booking reaches Region B at 600 ms and Ben’s reaches Region A at 1,100 ms. Each region now holds two bookings for one room, and both guests were already told yes, too late to reject either.",
      focus: ["a", "b"],
      frame: ["ana", "a", "b", "ben"],
      facts: [["Replication lag", "575 ms"], ["Ana’s reaches B", "600 ms"], ["Ben’s reaches A", "1,100 ms"]],
      changes: ["+ Ana’s booking reaches Region B", "+ Ben’s booking reaches Region A", "+ A conflict in each"],
      events: [
        { type: "packet", path: ["a", "b"], label: "Ana’s booking", t: 25, dur: 575 },
        { type: "mark", node: "b", text: "conflict", tone: "hot" },
        { type: "packet", path: ["b", "a"], label: "Ben’s booking", t: 525, dur: 575, gap: 160 },
        { type: "mark", node: "a", text: "conflict", tone: "hot" },
      ],
    },
    {
      title: "Last-write-wins drops Ana’s booking",
      short: "Last-write-wins",
      text: "Last-write-wins keeps the higher timestamp, Ben’s, in both regions and silently drops Ana’s; clock skew can make it drop the newer one. CRDTs merge counters and sets, or both versions wait for the app or a user to choose. All act after both guests heard yes.",
      metrics: { told: { n: 2, unit: " for 1 room", tone: "hot" } },
      facts: [["Last-write-wins", "drops a write"], ["CRDTs", "merge counters, sets"], ["Keep both", "app or user picks"]],
      changes: ["~ Both regions keep Ben’s booking", "− Ana’s booking, silently"],
      events: [
        { type: "mark", node: "ana", text: "dropped, not told", tone: "hot", t: 1100 },
      ],
    },
    {
      title: "A home region sells the room once",
      short: "Home region",
      text: "Replay it with a home region: Region A takes every write for this room, so Ben’s booking travels there and Region A, which sold it to Ana, answers sold out. The conflict never happens. Ben pays the 200 ms round trip; only a single owner can enforce “sell this room once”.",
      focus: ["ana", "a", "ben"],
      frame: ["ana", "a", "b", "ben"],
      metrics: { told: { n: 1, unit: " for 1 room" }, wait: { n: 200, unit: " ms" } },
      facts: [["Room’s home", "Region A"], ["Ben pays", "200 ms round trip"], ["Moving the home", "reopens the risk"]],
      changes: ["~ Region A owns the room", "+ Ben’s booking refused", "~ One guest told yes"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["ana", "a"], label: "book room", t: 0, dur: 25, gap: 0 },
        { type: "packet", path: ["a", "ana"], label: "confirmed", kind: "response", t: 25, dur: 25, gap: 60 },
        { type: "packet", path: ["ben", "a"], label: "book room", t: 500, dur: 100, gap: 120 },
        { type: "packet", path: ["a", "ben"], label: "sold out", kind: "response", t: 600, dur: 100, gap: 160 },
        // blue, as rc-failover's fence refusing a stale write: the rule working
        { type: "mark", node: "a", text: "already sold", tone: "work", t: 600, dur: 0, with: true },
      ],
    },
  ],
};
