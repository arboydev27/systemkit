import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Place keys and nodes on a ring": a ring of 100 positions, three nodes' tokens, and four keys finding their
// owner clockwise, one of them past the top and one exactly on a token.
export const hashRingStage: StageScene = {
  id: "hash-ring",
  layout: "ring",
  intro: "Watch keys find their owner on a ring of 100 positions, where each node holds one token.",
  ring: { size: 100, marks: [0, 25, 50, 75] },
  metrics: [{ id: "key", label: "Key hash" }, { id: "owner", label: "Owner" }],
  nodes: [
    { id: "app", role: "client", label: "App", detail: "hashes each key", at: [0, 0] },
    { id: "a", role: "cache", label: "Node A", detail: "token at 20", at: [20, 1] },
    { id: "b", role: "cache", label: "Node B", detail: "token at 50", at: [50, 1] },
    { id: "c", role: "cache", label: "Node C", detail: "token at 80", at: [80, 1] },
  ],
  links: [],
  steps: [
    {
      title: "Bend the hash space into a ring",
      short: "The ring",
      text: "Hash positions run from 0 to 99, and 99 sits next to 0. Each node hashes its name to a token: A lands at 20, B at 50, C at 80. A token owns the stretch back to the token before it.",
      facts: [["Positions", "0–99"], ["Tokens", "A 20 · B 50 · C 80"]],
      changes: ["+ 3 tokens on the ring"],
      events: [{ type: "token", add: [{ id: "A", node: "a", at: 20, label: "A" }, { id: "B", node: "b", at: 50, label: "B" }, { id: "C", node: "c", at: 80, label: "C" }] }],
    },
    {
      title: "A key walks clockwise to its owner",
      short: "Key 15",
      text: "The app hashes a key to 15 and walks clockwise from there. The first token it meets is A at 20, so node A owns the key.",
      focus: ["app", "a"],
      metrics: { key: 15, owner: "A" },
      changes: ["+ Key 15 on node A"],
      events: [{ type: "key", id: "k15", at: 15, label: "15", from: "app" }],
    },
    {
      title: "The next token clockwise wins",
      short: "Key 63",
      text: "A key at 63 sits between B at 50 and C at 80. Walking clockwise it meets C first, so C owns it, even though B is nearer the other way.",
      focus: ["app", "c"],
      metrics: { key: 63, owner: "C" },
      changes: ["+ Key 63 on node C"],
      events: [{ type: "key", id: "k63", at: 63, label: "63", from: "app" }],
    },
    {
      title: "Past the top, the walk wraps round",
      short: "Key 91",
      text: "A key at 91 is past the last token. The walk carries on past 99 to 0 and meets A at 20, the lowest token, so A owns it too.",
      focus: ["app", "a"],
      metrics: { key: 91, owner: "A" },
      changes: ["+ Key 91 on node A"],
      events: [{ type: "key", id: "k91", at: 91, label: "91", from: "app" }],
    },
    {
      title: "A token owns its own position",
      short: "Key 50",
      text: "A key hashing to exactly 50 lands on B’s token. Under the common rule a token owns its own position, so B takes it. Every client must break ties the same way.",
      focus: ["app", "b"],
      metrics: { key: 50, owner: "B" },
      changes: ["+ Key 50 on node B"],
      events: [{ type: "key", id: "k50", at: 50, label: "50", from: "app" }],
    },
    {
      title: "Find the successor by binary search",
      short: "Binary search",
      text: "The app never steps through positions. It keeps the tokens sorted, 20, 50, 80, and binary-searches for the first one at or after the hash. For 63 it checks the middle token, 50, which is too low, then 80. That is about 10 comparisons for 1,000 tokens.",
      focus: ["app", "c"],
      metrics: { key: 63, owner: "C" },
      facts: [["Sorted tokens", "20, 50, 80"], ["1,000 tokens", "≈ 10 comparisons"]],
      events: [
        // the search jumps straight to the tokens it compares: the middle one first, then the half it leaves
        { type: "note", node: "app", text: "[20, 50, 80]" },
        { type: "pause", ms: 500 },
        { type: "arc", id: "probe1", from: 49, to: 50, label: "50 < 63", tone: "quiet" },
        { type: "arc", id: "probe2", from: 79, to: 80, label: "80 ≥ 63", tone: "work" },
      ],
    },
  ],
};
