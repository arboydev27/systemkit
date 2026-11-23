import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Move only affected ranges": D joins at 35 and takes only 21–35 from B, after the range is copied; then C
// leaves and its stretch goes on to A.
export const hashMembershipStage: StageScene = {
  id: "hash-membership",
  layout: "ring",
  intro: "Watch a node join and another leave, and see which keys change owner each time.",
  ring: {
    size: 100,
    marks: [0, 25, 50, 75],
    tokens: [{ id: "A", node: "a", at: 20, label: "A" }, { id: "B", node: "b", at: 50, label: "B" }, { id: "C", node: "c", at: 80, label: "C" }],
  },
  metrics: [{ id: "moved", label: "Keys moved", derive: { moved: true } }, { id: "expected", label: "Expected" }, { id: "a", label: "A owns", derive: { share: "a" } }],
  nodes: [
    { id: "a", role: "database", label: "Node A", detail: "token at 20", at: [20, 1] },
    { id: "b", role: "database", label: "Node B", detail: "token at 50", at: [50, 1] },
    { id: "c", role: "database", label: "Node C", detail: "token at 80", at: [80, 1] },
    { id: "d", role: "database", label: "Node D", detail: "joins at 35", at: [35, 1], appear: 1 },
  ],
  links: [],
  steps: [
    {
      title: "Each token owns one stretch",
      short: "Who owns what",
      text: "Forty keys are spread round the ring. A owns 81 to 20, the 40 positions back to C. B owns 21 to 50 and C owns 51 to 80, 30 each.",
      facts: [["A", "81–20 · 40%"], ["B", "21–50 · 30%"], ["C", "51–80 · 30%"]],
      changes: ["+ 40 keys"],
      events: [{ type: "scatter", count: 40, seed: 7 }],
    },
    {
      title: "D at 35 will take 21–35 from B",
      short: "D arrives",
      text: "Node D, a new node, hashes to 35, between A at 20 and B at 50. Once it joins it will own 21 to 35, which B owns today. Nothing has moved yet.",
      focus: ["d", "b"],
      changes: ["+ Node D, not yet on the ring"],
      events: [{ type: "arc", id: "take", from: 20, to: 35, label: "21–35 → D", tone: "work" }],
    },
    {
      title: "Copy the range before the switch",
      short: "Copy first",
      text: "In a durable store, routing must not flip before D has the data. D streams 21 to 35 from B and takes new writes for it, but serves no reads until streaming finishes.",
      focus: ["d", "b"],
      changes: ["~ B still serves 21–35", "+ D holds a copy"],
      events: [
        { type: "arc", id: "take", label: "copy → D" },
        { type: "note", node: "d", text: "no reads yet" },
      ],
    },
    {
      title: "Flip ownership: only 21–35 moves",
      short: "D joins",
      text: "D’s token goes live. Only 21 to 35 changes owner, 15% of the ring, against the 25% an equal new node takes on average. A and C keep every key, and A still owns 40%.",
      focus: ["d", "b"],
      metrics: { expected: { n: 25, unit: "%" } },
      changes: ["+ D owns 21–35", "~ B keeps 36–50", "~ A and C untouched"],
      events: [
        // the copy's mark stays while the slice flips under it, then fades
        { type: "token", add: [{ id: "D", node: "d", at: 35, label: "D" }] },
        { type: "arc", id: "take", remove: true },
      ],
    },
    {
      title: "C leaves: its stretch goes on to A",
      short: "C leaves",
      text: "When C leaves, 51 to 80 passes to the next token clockwise, A at 20 past the top. Nothing else moves, but A now owns 70%. Hashing only says where keys live: A needs C’s data, or a replica, first.",
      focus: ["a"],
      metrics: { expected: { n: 25, unit: "%" } },
      changes: ["− Node C", "~ A owns 51–20"],
      events: [
        { type: "hide", nodes: ["c"] },
        { type: "token", remove: ["C"], with: true },
      ],
    },
  ],
};
