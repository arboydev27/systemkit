import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Order events without trusting clocks": the lifelines run in real time, in ms from 12:00:00.065, so the real
// order reads along them while the stamps on the marks and pills say otherwise. Each client sits outside its own node
// (Client 1, Node A, Node B, Client 2), so the nodes swap writes between neighbours and only Client 2's read of A crosses
// a rail. Node A's clock runs 30 ms fast: Client 1's price = 90 reaches A at t=5 (real .070) and is stamped .100. Client 2
// reads that 90 and writes price = 80 through Node B, whose accurate clock stamps it .085 at t=20, 15 ms later. The nodes
// swap writes (t=22 to 32) and last-write-wins keeps 90 on both: the later, better-informed 80 vanishes with no error.
// Replayed at the same times with Lamport counters (A at 7, B at 5): A stamps the write 8, Client 2 reads 90 · 8 and
// carries the 8 to B, B sets max(5, 8) + 1 = 9, and 80 wins on both; receiving moves both counters to 10. Then the
// limits: later, Client 1 and Client 2 claim the username ada at the same moment through A (counter 11, stamp 12) and B
// (counter 14, stamp 15); the stamps order the claims though neither saw the other. Each node says yes from what it has
// seen, and A's claim reaches B only afterwards, its lower stamp showing it came first. Deciding now takes agreement.
export const csOrderingStage: StageScene = {
  id: "cs-ordering",
  layout: "timeline",
  timeline: { ticks: [0, 10, 20, 30], unit: "ms" },
  intro: "Watch two writes to one price in real time, stamped by clocks that disagree, then replay them with counters that travel with messages.",
  metrics: [
    { id: "sa", label: "A’s stamp" },
    { id: "sb", label: "B’s stamp" },
    { id: "kept", label: "Price kept" },
  ],
  nodes: [
    { id: "c1", role: "client", label: "Client 1", detail: "writes 90", at: [0, 0] },
    { id: "a", role: "database", label: "Node A", detail: "replica", at: [1, 0], opts: { replica: true } },
    { id: "b", role: "database", label: "Node B", detail: "replica", at: [2, 0], opts: { replica: true } },
    { id: "c2", role: "client", label: "Client 2", detail: "reads 90, writes 80", at: [3, 0] },
  ],
  links: [],
  steps: [
    {
      title: "A fast clock stamps the first write .100",
      short: "Fast clock",
      text: "Nodes A and B settle conflicts with last-write-wins: the highest timestamp counts as the latest write. But clocks drift, and A’s runs 30 ms fast. Client 1 writes price = 90 through A at 12:00:00.070, and A stamps it .100.",
      metrics: { sa: ".100" },
      facts: [["A’s clock", "30 ms fast"], ["Real time", ".070"], ["A’s stamp", ".100"]],
      changes: ["+ A’s clock 30 ms fast", "+ 90 stamped .100"],
      events: [
        { type: "state", node: "a", readout: "30 ms fast" },
        { type: "state", node: "b", readout: "accurate", with: true },
        { type: "packet", path: ["c1", "a"], label: "price = 90", t: 0, dur: 5 },
        { type: "mark", node: "a", text: "stamp .100", t: 5, dur: 0 },
      ],
    },
    {
      title: "The later write gets the lower stamp",
      short: "Lower stamp",
      text: "Client 2 reads that 90, then writes price = 80 through B, 15 ms after A’s write. B’s clock is accurate, so it stamps .085. The later write, made after seeing 90, carries the lower stamp.",
      metrics: { sb: ".085" },
      facts: [["A’s write", "at .070, stamp .100"], ["B’s write", "at .085, stamp .085"]],
      changes: ["+ Client 2 reads 90", "+ 80 stamped .085"],
      events: [
        { type: "packet", path: ["c2", "a"], label: "read", t: 5, dur: 5 },
        { type: "packet", path: ["a", "c2"], label: "90", kind: "response", t: 10, dur: 5 },
        { type: "packet", path: ["c2", "b"], label: "price = 80", t: 15, dur: 5 },
        { type: "mark", node: "b", text: "stamp .085", t: 20, dur: 0 },
      ],
    },
    {
      title: "Last-write-wins drops the later write",
      short: "80 vanishes",
      text: "The nodes swap writes, and each keeps the one with the higher stamp. .100 beats .085, so both keep 90. The later, better-informed write disappears, and nobody gets an error.",
      metrics: { kept: { n: 90, tone: "hot" } },
      facts: [["Real order", "90, then 80"], ["By stamp", "80, then 90"]],
      changes: ["~ Both nodes keep 90", "− Client 2’s 80"],
      events: [
        { type: "packet", path: ["b", "a"], label: "80 · .085", t: 22, dur: 5 },
        { type: "mark", node: "a", text: "keeps 90", tone: "hot", dur: 0 },
        { type: "packet", path: ["a", "b"], label: "90 · .100", dur: 5 },
        { type: "mark", node: "b", text: "80 → 90", tone: "hot", dur: 0 },
      ],
    },
    {
      title: "Count events instead of reading clocks",
      short: "Lamport counter",
      text: "Replay it with a Lamport clock. Each node keeps a counter, adds one on every event, and attaches it to every message. A’s counter is at 7, so Client 1’s write becomes event 8: stamp 8, whatever A’s clock says.",
      metrics: { sa: 8, sb: "—", kept: "—" },
      facts: [["Each event", "counter + 1"], ["A’s write", "stamp 8"]],
      changes: ["~ Stamps from counters", "+ 90 stamped 8"],
      events: [
        { type: "rewind" },
        { type: "state", node: "a", readout: "counter 7" },
        { type: "state", node: "b", readout: "counter 5", with: true },
        { type: "packet", path: ["c1", "a"], label: "price = 90", t: 0, dur: 5 },
        { type: "state", node: "a", readout: "counter 8" },
        { type: "mark", node: "a", text: "stamp 8", t: 5, dur: 0, with: true },
      ],
    },
    {
      title: "B’s write gets 9, past the 8 it saw",
      short: "Carry the stamp",
      text: "Client 2 reads 90 with its stamp 8 and carries the 8 to B with its write. B sets its counter to the larger of its own 5 and that 8, plus one, so the write gets stamp 9.",
      metrics: { sb: 9 },
      facts: [["On receiving", "max(own, stamp) + 1"], ["B’s counter", "max(5, 8) + 1 = 9"]],
      changes: ["+ Client 2 carries 8", "+ 80 stamped 9"],
      events: [
        { type: "packet", path: ["c2", "a"], label: "read", t: 5, dur: 5 },
        { type: "packet", path: ["a", "c2"], label: "90 · 8", kind: "response", t: 10, dur: 5 },
        { type: "packet", path: ["c2", "b"], label: "80 · saw 8", t: 15, dur: 5 },
        { type: "state", node: "b", readout: "counter 9" },
        { type: "mark", node: "b", text: "stamp 9", t: 20, dur: 0, with: true },
      ],
    },
    {
      title: "The later write wins: 9 beats 8",
      short: "80 wins",
      text: "The nodes swap writes again. 9 beats 8, so both keep 80, the write made after seeing 90. If one event could have caused another, the cause has the lower stamp. Each receipt also moves a counter on, to 10.",
      metrics: { kept: 80 },
      facts: [["Real order", "90, then 80"], ["By stamp", "90, then 80"]],
      changes: ["~ Both nodes keep 80", "~ Both counters at 10"],
      events: [
        { type: "packet", path: ["b", "a"], label: "80 · 9", t: 22, dur: 5 },
        { type: "state", node: "a", readout: "counter 10" },
        { type: "mark", node: "a", text: "90 → 80", tone: "work", t: 27, dur: 0, with: true },
        { type: "packet", path: ["a", "b"], label: "90 · 8", t: 27, dur: 5 },
        { type: "state", node: "b", readout: "counter 10" },
        { type: "mark", node: "b", text: "keeps 80", tone: "work", t: 32, dur: 0, with: true },
      ],
    },
    {
      title: "Unrelated claims still get an order",
      short: "Concurrent claims",
      text: "Later, Clients 1 and 2 claim the username ada at the same moment, through A and B. A stamps 12; B, having counted more events, 15. Neither saw the other, yet the stamps order them: a lower stamp doesn’t prove a cause. Spotting concurrency takes version vectors.",
      metrics: { sa: 12, sb: 15 },
      facts: [["By stamp", "12 before 15"], ["Real time", "the same moment"], ["Spots this", "version vectors"]],
      changes: ["+ ada claimed at A, 12", "+ ada claimed at B, 15"],
      events: [
        { type: "rewind" },
        { type: "state", nodes: ["c1", "c2"], detail: "claims ada" },
        { type: "state", node: "a", readout: "counter 11", with: true },
        { type: "state", node: "b", readout: "counter 14", with: true },
        { type: "packet", path: ["c1", "a"], label: "claim ada", t: 5, dur: 5 },
        { type: "packet", path: ["c2", "b"], label: "claim ada", t: 5, dur: 5, with: true },
        { type: "state", node: "a", readout: "counter 12" },
        { type: "state", node: "b", readout: "counter 15", with: true },
        { type: "mark", node: "a", text: "stamp 12", t: 10, dur: 0, with: true },
        { type: "mark", node: "b", text: "stamp 15", t: 10, dur: 0, with: true },
      ],
    },
    {
      title: "Stamps can’t decide what’s free now",
      short: "Deciding now",
      text: "Each node answers from what it has seen, so both clients hear yes. B can’t rule out a lower-stamped claim it hasn’t heard of: A’s, stamp 12, arrives afterwards and came first. Stamps order history after the fact; deciding now takes agreement.",
      facts: [["Stamps give", "order afterwards"], ["Deciding now", "takes agreement"]],
      changes: ["+ Both clients told yes", "~ A’s claim came first"],
      events: [
        { type: "packet", path: ["a", "c1"], label: "ada is yours", kind: "response", t: 10, dur: 5 },
        { type: "packet", path: ["b", "c2"], label: "ada is yours", kind: "hot", t: 10, dur: 5, with: true },
        { type: "packet", path: ["a", "b"], label: "ada · 12", t: 15, dur: 5 },
        { type: "mark", node: "b", text: "12 came first", tone: "hot", t: 20, dur: 0 },
      ],
    },
  ],
};
