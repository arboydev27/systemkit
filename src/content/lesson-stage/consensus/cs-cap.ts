import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "State CAP honestly": three regions A, B and C run one store that commits a purchase once a majority, 2 of 3,
// has stored it. Healthy, seat 9 sells through A once B confirms. At 14:00 region C is cut off (everything sent across
// its links is lost); A and B are still 2 of 3 and sell seat 14, while C's copy still says it is free. A buyer at C asks
// for seat 14: C can reach only 1 of 3 and refuses, so the purchase is stored nowhere and C's buyers see errors (or, the
// other choice, C sells it alone and seat 14 has two owners). The choice can differ per request: C still refuses purchases but serves its seat
// map, which shows seat 14 free though A sold it (Cassandra's ONE and QUORUM). With the links back, the everyday trade is
// latency against freshness: with an example 80 ms round trip, a synchronous write waits about 80 ms for B; an
// asynchronous one answers in a few ms with the sale on A alone.
// Tiers: A’s buyers, A, B, C and C’s buyers, the majority side first; the cut is a link state, shown by lost messages (×).
export const csCapStage: StageScene = {
  id: "cs-cap",
  intro: "Watch three regions sell seats through one store that needs a majority, then cut one region off and see what it can still do.",
  metrics: [{ id: "stored", label: "Stored on" }, { id: "seat", label: "Seat 14" }, { id: "wait", label: "Write waits" }],
  nodes: [
    { id: "buyers", role: "crowd", label: "A’s buyers", detail: "routed to region A", at: [-0.08, 1] },
    { id: "a", role: "database", label: "Region A", detail: "copy of seat store", at: [1, 0], opts: { replica: true } },
    { id: "b", role: "database", label: "Region B", detail: "copy of seat store", at: [1.51, 1], opts: { replica: true } },
    { id: "c", role: "database", label: "Region C", detail: "copy of seat store", at: [2.59, 0], opts: { replica: true } },
    { id: "buyersC", role: "crowd", label: "C’s buyers", detail: "routed to region C", at: [3.16, 1] },
  ],
  // A diamond on the floor: A–B and B–C run straight along the floor's axes, A–C bends round the back, and each crowd
  // hangs off its region. On a phone it runs down the screen: A’s buyers, A with B beside it, then C and its buyers. C’s
// buyers stand a little further on (3.16) so the note over them in step 4 clears C’s tag on a 375 px phone.
  links: [
    { from: "buyers", to: "a" },
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "a", to: "c" },
    { from: "c", to: "buyersC" },
  ],
  steps: [
    {
      title: "A sale commits once 2 of 3 store it",
      short: "Healthy",
      text: "Regions A, B and C run one store that commits a purchase once a majority, 2 of 3, has stored it. A buyer takes seat 9 through A, and when B confirms, it commits. While the network is healthy, answers are both current and available.",
      metrics: { stored: { n: 2, unit: " of 3" }, seat: "free" },
      facts: [["Regions", "A, B, C"], ["Commit needs", "2 of 3"]],
      changes: ["+ Seat 9 sold through A", "+ Stored on A and B: committed"],
      events: [
        { type: "packet", path: ["buyers", "a"], label: "buy seat 9" },
        { type: "state", node: "a", light: "on" },
        { type: "packet", path: ["a", "b"], label: "store seat 9" },
        { type: "packet", path: ["a", "c"], label: "store seat 9", with: true },
        { type: "state", nodes: ["b", "c"], light: "on" },
        { type: "packet", path: ["b", "a"], label: "stored", kind: "response" },
        { type: "note", node: "a", text: "2 of 3 stored: commit", tone: "work" },
        { type: "state", nodes: ["a", "b", "c"], light: "work", with: true },
        { type: "packet", path: ["a", "buyers"], label: "seat 9 is yours", kind: "response" },
      ],
    },
    {
      title: "At 14:00 region C is cut off",
      short: "Partition",
      text: "At 14:00 the links between region C and the others fail. C keeps running and its buyers still reach it, but nothing crosses to A or B. No design opts out of partitions; the choice is what a cut-off node does.",
      facts: [["Cut off", "C, at 14:00"], ["C can reach", "1 of 3: itself"]],
      changes: ["− Links from C to A and B", "~ C still running"],
      events: [
        { type: "state", node: "c", light: "on", detail: "cut off at 14:00" },
        { type: "packet", path: ["c", "a"], label: "heartbeat", kind: "hot", lost: true },
        { type: "packet", path: ["c", "b"], label: "heartbeat", kind: "hot", lost: true, with: true },
        { type: "note", node: "c", text: "can’t reach A or B" },
      ],
    },
    {
      title: "A and B are still a majority",
      short: "A and B sell",
      text: "A and B are two of three, so they keep selling and their buyers notice nothing. A buyer takes seat 14 through A: B stores it and the sale commits, but the copy sent to C is lost, so C’s copy still shows seat 14 free.",
      focus: ["buyers", "a", "b", "c"],
      metrics: { stored: { n: 2, unit: " of 3" }, seat: { n: 1, unit: " owner" } },
      facts: [["Majority", "A and B"], ["Seat 14", "sold through A"]],
      changes: ["+ Seat 14 sold through A", "~ C’s copy still says free"],
      events: [
        { type: "packet", path: ["buyers", "a"], label: "buy seat 14" },
        { type: "packet", path: ["a", "b"], label: "store seat 14" },
        { type: "packet", path: ["a", "c"], label: "store seat 14", kind: "hot", lost: true, with: true },
        { type: "packet", path: ["b", "a"], label: "stored", kind: "response" },
        { type: "note", node: "a", text: "2 of 3 stored: commit", tone: "work" },
        // Only A and C carry seat 14's state: on a wide screen B's pill would sit on the B–C link, by C's tag.
        { type: "state", node: "a", readout: "14: sold", with: true },
        { type: "state", node: "c", readout: "14: free", with: true },
        { type: "packet", path: ["a", "buyers"], label: "seat 14 is yours", kind: "response" },
        { type: "stream", every: 420, routes: [{ path: ["buyers", "a", "b"], kind: "work" }] },
      ],
    },
    {
      title: "C refuses what it can’t commit",
      short: "C refuses",
      text: "A buyer at C asks for seat 14. C can’t reach a majority, so it refuses: answers stay linearizable, but C’s buyers see errors until traffic moves. Try Sell anyway: C stays available and sells seat 14 alone, so two buyers own it and someone must refund and apologize.",
      focus: ["a", "b", "c", "buyersC"],
      facts: [["CAP’s consistency", "linearizable"], ["CAP’s availability", "every node answers"]],
      changes: ["+ Purchase of seat 14 at C", "~ C can’t reach a majority"],
      // C's copies to A and B are sent in each option rather than in the step: choosing an option replays only that
      // option's messages, so the step's own lost ×s would vanish from the picture after a switch.
      events: [
        { type: "packet", path: ["buyersC", "c"], label: "buy seat 14" },
      ],
      control: {
        label: "Region C",
        options: [
          {
            label: "Refuse",
            // Refused, the purchase is stored nowhere and seat 14 keeps its one owner.
            metrics: { stored: { n: 0, unit: " of 3" }, seat: { n: 1, unit: " owner" } },
            events: [
              { type: "packet", path: ["c", "a"], label: "store seat 14", kind: "hot", lost: true },
              { type: "packet", path: ["c", "b"], label: "store seat 14", kind: "hot", lost: true, with: true },
              { type: "packet", path: ["c", "buyersC"], label: "error: no majority" },
              { type: "note", node: "c", text: "refused" },
              // The cost of refusing lands on C's buyers: the error is what CAP's availability gives up.
              { type: "note", node: "buyersC", text: "see errors", with: true },
            ],
          },
          {
            label: "Sell anyway",
            metrics: { stored: { n: 1, unit: " of 3", tone: "hot" }, seat: { n: 2, unit: " owners", tone: "hot" } },
            events: [
              { type: "packet", path: ["c", "a"], label: "store seat 14", kind: "hot", lost: true },
              { type: "packet", path: ["c", "b"], label: "store seat 14", kind: "hot", lost: true, with: true },
              { type: "packet", path: ["c", "buyersC"], label: "seat 14 is yours", kind: "hot" },
              { type: "state", node: "c", light: "hot", readout: "14: sold", tone: "hot" },
              { type: "note", node: "c", text: "two owners", tone: "hot" },
            ],
          },
        ],
      },
    },
    {
      title: "Refuse purchases, still serve the map",
      short: "Per request",
      text: "The choice need not be global. C keeps refusing purchases but still serves its seat map, slightly stale: it shows seat 14 free though A sold it. Cassandra exposes this per query through consistency levels such as ONE and QUORUM.",
      focus: ["a", "b", "c", "buyersC"],
      metrics: { stored: { n: 0, unit: " of 3" }, seat: { n: 1, unit: " owner" } },
      facts: [["Purchases at C", "refused"], ["Seat map at C", "may be stale"], ["Cassandra", "ONE or QUORUM"]],
      changes: ["~ Purchases at C refused", "+ Seat map served from C"],
      events: [
        // Back to the refusing C whichever option step 4 left; the refusal itself played there, so only the read plays
        // here (a still with reduced motion keeps every message's pill, and four on this short link pile up on C's tag).
        { type: "state", node: "c", light: "on", readout: "14: free", tone: "" },
        { type: "packet", path: ["c", "a"], label: "heartbeat", kind: "hot", lost: true, with: true },
        { type: "packet", path: ["c", "b"], label: "heartbeat", kind: "hot", lost: true, with: true },
        { type: "packet", path: ["buyersC", "c"], label: "GET seat map" },
        { type: "packet", path: ["c", "buyersC"], label: "map: 14 free", kind: "quiet" },
        // C's pill now reads as the map it serves: seat 14 free, beside A's "14: sold".
        { type: "state", node: "c", readout: "map: 14 free" },
        { type: "note", node: "c", text: "purchases refused", with: true },
      ],
    },
    {
      title: "Healthy: latency against freshness",
      short: "Latency",
      text: "The links return, and an everyday trade remains. With an example 80 ms round trip, a synchronous write waits about 80 ms for B. Try Asynchronous: A answers in a few ms, but a sale only A holds is lost if A fails. PACELC adds this trade; CAP doesn’t.",
      metrics: { seat: { n: 1, unit: " owner" } },
      facts: [["Round trip", "80 ms (example)"], ["Framing", "PACELC"]],
      changes: ["+ Links to C restored", "~ Writes trade latency for freshness"],
      events: [
        { type: "state", node: "c", light: "work", detail: "copy of seat store", readout: "", tone: "" },
        { type: "state", nodes: ["a", "b"], light: "work", readout: "", with: true },
        { type: "packet", path: ["buyers", "a"], label: "buy seat 20" },
      ],
      control: {
        label: "Write",
        options: [
          {
            label: "Synchronous",
            metrics: { stored: { n: 2, unit: " of 3" }, wait: { n: 80, unit: " ms" } },
            events: [
              { type: "packet", path: ["a", "b"], label: "store seat 20" },
              { type: "packet", path: ["a", "c"], label: "store seat 20", with: true },
              { type: "packet", path: ["b", "a"], label: "stored", kind: "response" },
              { type: "packet", path: ["a", "buyers"], label: "seat 20 · 80 ms", kind: "response" },
              { type: "note", node: "a", text: "waited 80 ms for B", tone: "work", with: true },
            ],
          },
          {
            label: "Asynchronous",
            metrics: { stored: { n: 1, unit: " of 3", tone: "hot" }, wait: "a few ms" },
            events: [
              { type: "packet", path: ["a", "buyers"], label: "seat 20 · a few ms", kind: "response" },
              { type: "packet", path: ["a", "b"], label: "store seat 20", kind: "quiet" },
              { type: "note", node: "a", text: "lost if A fails first", tone: "hot", with: true },
            ],
          },
        ],
      },
    },
  ],
};
