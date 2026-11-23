import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Use multiple tokens per physical node": the ring after D joined (A 40%, C 30%, B and D 15%) re-dealt as three
// tokens per machine (A 24, B 25, C 26, D 25%); C fails and three successors share its slices (A 34, B 33, D 33%); E joins
// with three tokens and takes 6, 9 and 9 from three donors (E 24, A 28, B 24, D 24%); then what every token costs.
// Each drum fills to the share of the ring it owns, so the balance reads off the parts as well as the ring.
export const hashVnodesStage: StageScene = {
  id: "hash-vnodes",
  layout: "ring",
  intro: "Watch four machines swap one token each for three, then follow the slices a failure and a join move.",
  ring: {
    size: 100,
    marks: [0, 25, 50, 75],
    tokens: [
      { id: "A", node: "a", at: 20, label: "A" },
      { id: "D", node: "d", at: 35, label: "D" },
      { id: "B", node: "b", at: 50, label: "B" },
      { id: "C", node: "c", at: 80, label: "C" },
    ],
  },
  metrics: [
    { id: "largest", label: "Largest share" },
    { id: "smallest", label: "Smallest share" },
    { id: "tokens", label: "Tokens" },
  ],
  nodes: [
    { id: "a", role: "database", label: "Node A", detail: "1 token", at: [20, 1] },
    { id: "b", role: "database", label: "Node B", detail: "1 token", at: [50, 1] },
    { id: "c", role: "database", label: "Node C", detail: "1 token", at: [80, 1] },
    { id: "d", role: "database", label: "Node D", detail: "1 token", at: [35, 1] },
    { id: "e", role: "database", label: "Node E", detail: "3 tokens", at: [66, 1], appear: 3 },
  ],
  links: [],
  steps: [
    {
      title: "One token each splits the ring unevenly",
      short: "One token",
      text: "This is the ring after D joined, one token per machine. Keys spread evenly, so each machine holds what its stretch covers: A owns 81 to 20, 40% of the ring, C 30%, and B and D only 15% each.",
      metrics: { largest: { n: 40, unit: "%" }, smallest: { n: 15, unit: "%" }, tokens: 4 },
      facts: [["Shares", "A 40 · B 15 · C 30 · D 15%"], ["A’s stretch", "81–20"], ["10 machines", "largest ≈ 3× average"]],
      changes: ["+ 40 keys"],
      events: [
        { type: "scatter", count: 40, seed: 7 },
        { type: "state", node: "a", meter: 0.4 },
        { type: "state", node: "b", meter: 0.15, with: true },
        { type: "state", node: "c", meter: 0.3, with: true },
        { type: "state", node: "d", meter: 0.15, with: true },
      ],
    },
    {
      title: "Three tokens each even out the shares",
      short: "Three tokens",
      text: "Each machine now holds three tokens, so its stretches are scattered round the ring and their sizes average out: A owns 24%, B 25%, C 26%, D 25%. With random positions it takes more tokens: the spread shrinks with the square root of tokens per machine.",
      metrics: { largest: { n: 26, unit: "%" }, smallest: { n: 24, unit: "%" }, tokens: 12 },
      facts: [["Shares", "A 24 · B 25 · C 26 · D 25%"], ["16 tokens each", "spread ≈ 25% of mean"], ["100 tokens each", "spread ≈ 10% of mean"]],
      changes: ["+ 3 tokens per machine", "~ Largest share 40% → 26%", "~ Smallest share 15% → 24%"],
      events: [
        // the single tokens go and the twelve are dealt in one go: a new layout to compare, not data moving. A part's
        // change runs first in a group, since a token event that ends later would play over it
        { type: "token", remove: ["A", "B", "C", "D"] },
        { type: "state", nodes: ["a", "b", "c", "d"], detail: "3 tokens" },
        {
          type: "token",
          with: true,
          add: [
            { id: "A1", node: "a", at: 20, label: "A1" }, { id: "A2", node: "a", at: 57, label: "A2" }, { id: "A3", node: "a", at: 86, label: "A3" },
            { id: "B1", node: "b", at: 50, label: "B1" }, { id: "B2", node: "b", at: 9, label: "B2" }, { id: "B3", node: "b", at: 91, label: "B3" },
            { id: "C1", node: "c", at: 80, label: "C1" }, { id: "C2", node: "c", at: 4, label: "C2" }, { id: "C3", node: "c", at: 28, label: "C3" },
            { id: "D1", node: "d", at: 35, label: "D1" }, { id: "D2", node: "d", at: 70, label: "D2" }, { id: "D3", node: "d", at: 96, label: "D3" },
          ],
        },
        { type: "state", node: "a", meter: 0.24 },
        { type: "state", node: "b", meter: 0.25, with: true },
        { type: "state", node: "c", meter: 0.26, with: true },
        { type: "state", node: "d", meter: 0.25, with: true },
      ],
    },
    {
      title: "C fails: three machines share its slices",
      short: "C fails",
      text: "Node C fails, and all three of its tokens go with it: they are aliases for one machine, not replicas. Each slice passes to the next token clockwise: C2’s 97–4 to B2, C3’s 21–28 to D1, C1’s 71–80 to A3. A ends with 34%, B and D with 33%.",
      metrics: { largest: { n: 34, unit: "%" }, smallest: { n: 33, unit: "%" }, tokens: 9 },
      facts: [["C’s 26%", "A +10 · B +8 · D +8"], ["With one token", "all 30% to A"], ["10 machines", "10% → 9 × 1.1%"]],
      changes: ["− Node C and its 3 tokens", "~ A 34% · B 33% · D 33%"],
      events: [
        { type: "state", node: "c", down: true, meter: null },
        { type: "token", remove: ["C1", "C2", "C3"], with: true },
        // each slice is marked with the token it leaves and the one that owns it now, one after another: a ring event
        // keeps the model it started from, so it must be the last of a group and only one per group
        { type: "state", node: "a", meter: 0.34 },
        { type: "state", node: "b", meter: 0.33, with: true },
        { type: "state", node: "d", meter: 0.33, with: true },
        { type: "arc", id: "s1", from: 96, to: 4, label: "C2 → B2", tone: "work", with: true },
        { type: "arc", id: "s2", from: 20, to: 28, label: "C3 → D1", tone: "work", gap: 80 },
        { type: "arc", id: "s3", from: 70, to: 80, label: "C1 → A3", tone: "work", gap: 80 },
      ],
    },
    {
      title: "E joins and takes small slices from three",
      short: "E joins",
      text: "Node E joins with tokens at 15, 44 and 66. Each takes a small slice from a different donor: 10–15 from A, 36–44 from B, 58–66 from D. E owns 24%; A drops to 28%, B and D to 24%.",
      metrics: { largest: { n: 28, unit: "%" }, smallest: { n: 24, unit: "%" }, tokens: 12 },
      facts: [["E1 at 15", "6 from A1"], ["E2 at 44", "9 from B1"], ["E3 at 66", "9 from D2"]],
      changes: ["+ Node E: 3 tokens, 24%", "~ A 28% · B 24% · D 24%"],
      events: [
        // E arrives holding nothing yet, its readout already in place so it doesn't shift when it fills
        { type: "hide", nodes: ["c"] },
        { type: "state", node: "e", meter: 0, with: true },
        { type: "show", nodes: ["e"], with: true },
        { type: "arc", id: "s1", remove: true, with: true },
        { type: "arc", id: "s2", remove: true, gap: 0 },
        { type: "arc", id: "s3", remove: true, gap: 0 },
        { type: "token", add: [{ id: "E1", node: "e", at: 15, label: "E1" }, { id: "E2", node: "e", at: 44, label: "E2" }, { id: "E3", node: "e", at: 66, label: "E3" }] },
        { type: "state", node: "e", meter: 0.24 },
        { type: "state", node: "a", meter: 0.28, with: true },
        { type: "state", node: "b", meter: 0.24, with: true },
        { type: "state", node: "d", meter: 0.24, with: true },
      ],
    },
    {
      title: "Each token is one more entry to track",
      short: "The cost",
      text: "Every token is a ring entry that routing, membership updates and repair must track: A alone has three. 1,000 machines with 256 tokens each make 256,000, while balance improves only with the square root. Cassandra cut its default from 256 to 16 in 4.0.",
      focus: ["a"],
      facts: [["1,000 × 256 tokens", "256,000 ring entries"], ["Cassandra 4.0", "256 → 16 tokens"], ["A1 · A2 · A3", "1 machine, no copies"]],
      events: [
        { type: "note", node: "a", text: "3 ring entries, 1 machine" },
      ],
    },
  ],
};
