import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "State CAP honestly": three regions A, B and C run one store that commits a purchase once a majority, 2 of 3,
// has stored it. Healthy, seat 9 sells through A once B has stored it. At 14:00 region C is cut off (everything sent
// across its links is lost); A and B are still 2 of 3 and sell seat 14, while C's copy still says it is free. A buyer at
// C asks for seat 14: C can reach only 1 of 3 and refuses, so the purchase is stored nowhere and C's buyers see errors
// (or, the other choice, C sells it alone and seat 14 has two owners). The choice can differ per request: C still
// refuses purchases but serves its seat map, which shows seat 14 free though A sold it (Cassandra's ONE and QUORUM).
// With the links back, the everyday trade is latency against freshness: with an example 80 ms round trip, a synchronous
// write waits about 80 ms for B; an asynchronous one answers in a few ms with the sale on A alone.
// Tiers; the cut is a link state, shown by lost messages (×). Each link carries at most one message pill a step, so the
// stills that reduced motion shows keep every label clear; what a reply would say is a note, a readout or a metric.
export const csCapStage: StageScene = {
  id: "cs-cap",
  intro: "Watch three regions sell seats through one store that needs a majority, then cut one region off and see what it can still do.",
  metrics: [{ id: "stored", label: "Stored on" }, { id: "seat", label: "Seat 14" }, { id: "wait", label: "Write waits" }],
  // Three tiers, so a phone shows three rows and its labels stay readable: A’s buyers over two columns, the majority
  // (A over B) on the left and C’s side (C’s buyers over C) on the right, the cut running between them. On a wide screen
  // the same places put the majority on the back row (A, B) and C’s side on the front row (C’s buyers, C): A’s buyers–A
  // and A–C run straight along the floor's axes; A–B, B–C and C’s buyers–C bend round. Tags carry names only (C’s
  // gains a line while it is cut off), which leaves the message pills room between them.
  nodes: [
    { id: "buyers", role: "crowd", label: "A’s buyers", at: [0, 0.03] },
    { id: "a", role: "database", label: "Region A", at: [1, -0.9], opts: { replica: true } },
    { id: "b", role: "database", label: "Region B", at: [2, -0.9], opts: { replica: true } },
    { id: "c", role: "database", label: "Region C", at: [2, 0.9], opts: { replica: true } },
    { id: "buyersC", role: "crowd", label: "C’s buyers", at: [1, 0.9] },
  ],
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
      text: "Regions A, B and C run one store that commits a purchase once a majority, 2 of 3, has stored it. A buyer takes seat 9 through A, and once B has stored it too, it commits. C’s copy follows. While the network is healthy, answers are both current and available.",
      metrics: { stored: { n: 2, unit: " of 3" }, seat: "free" },
      facts: [["Regions", "A, B, C"], ["Commit needs", "2 of 3"]],
      changes: ["+ Seat 9 sold through A", "+ Stored on A and B: committed"],
      events: [
        { type: "packet", path: ["buyers", "a"], label: "buy seat 9" },
        { type: "state", node: "a", light: "on" },
        // B's copy is the one the commit waits for: B and A turn blue with the commit. C's copy goes after it, muted,
        // and C stays ink, so the picture agrees with "2 of 3".
        { type: "packet", path: ["a", "b"], label: "store seat 9" },
        { type: "state", node: "b", light: "work" },
        { type: "note", node: "a", text: "2 of 3: commit", tone: "work" },
        { type: "state", node: "a", light: "work", with: true },
        { type: "packet", path: ["a", "c"], label: "store seat 9", kind: "quiet" },
        { type: "state", node: "c", light: "on" },
      ],
    },
    {
      title: "At 14:00 region C is cut off",
      short: "Partition",
      text: "At 14:00 the links between region C and the others fail. C keeps running and its buyers still reach it, but nothing crosses to A or B. No design opts out of partitions; the choice is what a cut-off node does.",
      facts: [["Cut off", "C, at 14:00"], ["C can reach", "1 of 3: itself"]],
      changes: ["− Links from C to A and B", "~ C still running"],
      events: [
        { type: "state", node: "c", light: "on", detail: "can’t reach A or B" },
        { type: "packet", path: ["c", "a"], label: "heartbeat", kind: "hot", lost: true },
        { type: "packet", path: ["c", "b"], label: "heartbeat", kind: "hot", lost: true, with: true },
        { type: "note", node: "c", text: "cut off at 14:00" },
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
        // Only A and C carry seat 14's state, the two copies that come to disagree. C's shows from the start, so the
        // camera and the links settle once as the step begins rather than shifting mid-step.
        { type: "state", node: "c", readout: "14: free" },
        { type: "packet", path: ["buyers", "a"], label: "buy seat 14" },
        { type: "packet", path: ["a", "b"], label: "store seat 14" },
        { type: "packet", path: ["a", "c"], label: "store seat 14", kind: "hot", lost: true, with: true },
        { type: "state", node: "a", readout: "14: sold", with: true },
        { type: "stream", every: 420, routes: [{ path: ["buyers", "a", "b"], kind: "work" }] },
      ],
    },
    {
      title: "C refuses what it can’t commit",
      short: "C refuses",
      text: "A buyer at C asks for seat 14. C can’t reach a majority, so it refuses and answers stay linearizable. C’s buyers see errors until traffic moves: the store gives up CAP’s availability, though most buyers are served. Try Sell anyway: C stays available, but two buyers own seat 14 and someone must refund and apologize.",
      focus: ["a", "b", "c", "buyersC"],
      facts: [["CAP’s consistency", "linearizable"], ["CAP’s availability", "every node answers"]],
      changes: ["+ Purchase of seat 14 at C", "~ C can’t reach a majority"],
      // C's copies to A and B are sent in each option rather than in the step: choosing an option replays only that
      // option's messages, so the step's own lost ×s would vanish from the picture after a switch. No reply rides the
      // link to C's buyers, which already carries the request: a note on them, or C's readout, says the answer.
      events: [
        // A's buyers play no part in steps 4 and 5; hidden, they don't peek clipped under a phone's metric chips.
        { type: "hide", nodes: ["buyers"] },
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
      // No purchase here, so nothing is "stored on" a count of regions.
      metrics: { stored: "—", seat: { n: 1, unit: " owner" } },
      facts: [["Purchases at C", "refused"], ["Seat map at C", "may be stale"], ["Cassandra", "ONE or QUORUM"]],
      changes: ["~ Purchases at C refused", "+ Seat map served from C"],
      events: [
        // Back to the refusing C whichever option step 4 left; the refusal itself played there, so only the read plays
        // here, and C's readout says what the map it serves shows rather than a reply on the short link.
        { type: "state", node: "c", light: "on", readout: "14: free", tone: "" },
        { type: "packet", path: ["c", "a"], label: "heartbeat", kind: "hot", lost: true, with: true },
        { type: "packet", path: ["c", "b"], label: "heartbeat", kind: "hot", lost: true, with: true },
        { type: "packet", path: ["buyersC", "c"], label: "GET seat map" },
        // C's pill now reads as the map it serves: seat 14 free, beside A's "14: sold". The refusal sits on the buyers,
        // where step 4's errors landed, so nothing between the read and its map reads as the read being refused.
        { type: "state", node: "c", readout: "map: 14 free" },
        { type: "note", node: "buyersC", text: "sales refused", with: true },
      ],
    },
    {
      title: "Healthy, writes trade latency for freshness",
      short: "Latency",
      text: "The links return, and an everyday trade remains. With an example 80 ms round trip, a synchronous write waits about 80 ms for B. Try Asynchronous: A answers in a few ms, but a sale only A holds is lost if A fails. PACELC adds this trade; CAP doesn’t.",
      metrics: { seat: { n: 1, unit: " owner" } },
      facts: [["Round trip", "80 ms (example)"], ["Framing", "PACELC"]],
      changes: ["+ Links to C restored", "~ A write waits, or risks a loss"],
      events: [
        // Links back: every region is running (ink), and only a region holding seat 20 turns blue.
        { type: "show", nodes: ["buyers"] },
        { type: "state", nodes: ["a", "b", "c"], light: "on", detail: "", readout: "", tone: "", with: true },
        { type: "packet", path: ["buyers", "a"], label: "buy seat 20" },
        { type: "state", node: "a", light: "work" },
      ],
      control: {
        label: "Write",
        options: [
          {
            label: "Synchronous",
            metrics: { stored: { n: 2, unit: " of 3" }, wait: { n: 80, unit: " ms" } },
            events: [
              // As in step 1: B's copy is waited for, C's follows after the answer.
              { type: "packet", path: ["a", "b"], label: "store seat 20" },
              { type: "state", node: "b", light: "work" },
              { type: "note", node: "a", text: "waited 80 ms for B", tone: "work" },
              { type: "packet", path: ["a", "c"], label: "store seat 20", kind: "quiet" },
            ],
          },
          {
            label: "Asynchronous",
            metrics: { stored: { n: 1, unit: " of 3", tone: "hot" }, wait: "a few ms" },
            events: [
              // A has answered at once (the metric says how soon); the copy to B follows later.
              { type: "packet", path: ["a", "b"], label: "store seat 20", kind: "quiet" },
              { type: "note", node: "a", text: "lost if A fails", tone: "hot", with: true },
            ],
          },
        ],
      },
    },
  ],
};
