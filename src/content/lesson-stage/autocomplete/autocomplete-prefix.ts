import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Find candidates by prefix": the Query API walks a Trie to “ca” in two edges, O(p). With example counts car 900,
// card 700, cat 600, care 400 and cup 100, “ca” has four descendants and the top two are car and card. In a catalog of 50
// million terms, “s” is one edge away but has millions below it to sort on every keystroke. A Prefix cache of top-10
// lists per prefix makes that one lookup of ten ready candidates, for 20 million prefixes × 10 × 40 bytes = 8 GB before
// overhead, rebuilt when counts change. “york” follows at most four edges and never finds “new york”: a trie (and the
// cache, keyed the same way) matches only from the start. Last, a small catalog can use a Terms table, a B-tree on the
// lowercased term, read from “ca” up to “cb”: 4 rows, car, card, care and cat, back to the Client.
export const autocompletePrefixStage: StageScene = {
  id: "autocomplete-prefix",
  intro: "Watch a trie find the prefix “ca” cheaply, then see why choosing the best terms below a short prefix is the expensive part.",
  // Short labels, so all three chips fit a phone's width, "1,000,000+" included.
  metrics: [
    { id: "edges", label: "Edges" },
    { id: "scanned", label: "Scanned" },
    { id: "memory", label: "List memory" },
  ],
  // The Trie stands alone in tier 2 until the Prefix cache arrives beside it (cache in lane −1, the Trie steps to lane
  // +1); in the last step the Terms table takes the cache's place. On a phone tier 2 is one row of two.
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "search box", at: [0, 0] },
    { id: "api", role: "web", label: "Query API", detail: "validates, filters", at: [1, 0] },
    { id: "trie", role: "tree", label: "Trie", detail: "prefix tree", at: [2, 0], opts: { count: 3 } },
    { id: "cache", role: "cache", label: "Prefix cache", detail: "top 10 per prefix", at: [2, -1], appear: 3 },
    { id: "table", role: "database", label: "Terms table", detail: "B-tree on term", at: [2, -1], appear: 6 },
  ],
  links: [
    { from: "client", to: "api" },
    { from: "api", to: "trie" },
    { from: "api", to: "cache" },
    { from: "api", to: "table" },
  ],
  steps: [
    {
      title: "The trie walks one edge per letter",
      short: "Trie walk",
      text: "The Client types “ca”, and the Query API walks the Trie one edge per character, so terms that share a prefix share a path. Reaching “ca” costs O(p), two edges here. A terminal marker tells a submitted query such as “car” from a mere prefix.",
      focus: ["api", "trie"],
      frame: ["client", "api", "trie"],
      facts: [["Prefix", "“ca”"], ["Cost", "O(p), p = 2"]],
      metrics: { edges: 2 },
      changes: ["+ “ca” sent", "+ Trie reaches “ca” in 2 edges"],
      events: [
        { type: "packet", path: ["client", "api", "trie"], label: "“ca”" },
        { type: "state", node: "trie", light: "on", opts: { mark: 0 } },
        { type: "note", node: "trie", text: "c → a: 2 edges", with: true },
      ],
    },
    {
      title: "Ranking the terms below is a separate cost",
      short: "Top two",
      text: "With example counts car 900, card 700, cat 600, care 400 and cup 100, the node for “ca” has four descendants, and the top two, car and card, go back to the Client. At this size, ranking is easy.",
      facts: [["Below “ca”", "4 terms"], ["Top two", "car, card"]],
      metrics: { scanned: 4 },
      changes: ["+ 4 terms ranked below “ca”", "+ Top two: car, card"],
      events: [
        { type: "note", node: "trie", text: "car, card, cat, care" },
        { type: "state", node: "trie", light: "work", with: true },
        { type: "packet", path: ["trie", "api"], label: "car, card", kind: "response" },
        { type: "packet", path: ["api", "client"], label: "top 2", kind: "response" },
        { type: "note", node: "client", text: "shows car, card", tone: "work" },
      ],
    },
    {
      title: "A broad prefix has millions below it",
      short: "Broad prefix",
      text: "In a catalog of 50 million terms, the node for “s” may have millions of descendants. The Trie still reaches it in one edge; scanning and sorting all of them on every keystroke is what costs too much.",
      focus: ["api", "trie"],
      frame: ["client", "api", "trie"],
      facts: [["Catalog", "50 million terms"], ["Below “s”", "millions"]],
      metrics: { edges: 1, scanned: { n: 1000000, unit: "+", tone: "hot" } },
      changes: ["+ “s” sent", "~ 1 edge to reach, millions to sort"],
      events: [
        { type: "packet", path: ["client", "api", "trie"], label: "“s”" },
        { type: "state", node: "trie", light: "hot", tone: "hot", opts: { mark: undefined } },
        { type: "note", node: "trie", text: "millions to sort", tone: "hot", with: true },
      ],
    },
    {
      title: "Store a short ranked list per prefix",
      short: "Top-K list",
      text: "Store a bounded top-K list at selected nodes, or materialize a prefix-to-top-K map: the Prefix cache keeps ten ranked candidates per prefix. A read of “s” is now one lookup of ten ready candidates, with nothing to sort.",
      focus: ["api", "cache"],
      frame: ["client", "api", "cache", "trie"],
      facts: [["Per prefix", "top 10, ranked"]],
      metrics: { edges: "—", scanned: 10 },
      changes: ["+ Prefix cache: top 10 per prefix", "~ “s” read from a stored list"],
      events: [
        { type: "show", nodes: ["cache"], at: { trie: [2, 1] } },
        { type: "state", node: "trie", light: "idle", tone: "", with: true },
        { type: "packet", path: ["client", "api", "cache"], label: "“s”" },
        { type: "state", node: "cache", light: "work" },
        { type: "note", node: "cache", text: "top 10 for “s”", tone: "work", with: true },
        { type: "packet", path: ["cache", "api", "client"], label: "top 10", kind: "response" },
      ],
    },
    {
      title: "Fast reads cost 8 GB of memory",
      short: "Memory cost",
      text: "The trade is memory and build work for fast reads: 20 million prefixes × 10 candidates × 40 bytes is 8 GB in the Prefix cache before overhead. Every list also has to be rebuilt when counts change.",
      focus: ["cache"],
      frame: ["client", "api", "cache", "trie"],
      facts: [["Prefixes", "20 million"], ["Per list", "10 × 40 bytes"], ["Memory", "8 GB + overhead"]],
      metrics: { memory: "8 GB" },
      changes: ["~ Prefix cache holds 8 GB", "~ Lists rebuilt when counts change"],
      events: [
        { type: "state", node: "cache", light: "work", readout: "8 GB" },
        { type: "note", node: "cache", text: "20M × 10 × 40 B", tone: "work", with: true },
      ],
    },
    {
      title: "A trie matches only from the start",
      short: "Prefix only",
      text: "The Client types “york”, looking for “new york”. The Trie follows “york” from the root, at most four edges, and never reaches “new york” under “n”. Matching a word inside a term means indexing each word or using n-grams, at more memory.",
      focus: ["client", "api", "trie"],
      frame: ["client", "api", "cache", "trie"],
      facts: [["Not found", "“new york”"], ["Fix", "index each word, n-grams"]],
      metrics: { edges: "≤ 4", scanned: "—" },
      changes: ["+ “york” sent", "~ “new york” not found"],
      events: [
        { type: "packet", path: ["client", "api", "trie"], label: "“york”" },
        { type: "state", node: "trie", light: "on", opts: { mark: 1 } },
        { type: "note", node: "trie", text: "prefixes only", with: true },
        { type: "packet", path: ["trie", "api", "client"], label: "“york…” terms only", kind: "quiet" },
        { type: "note", node: "client", text: "no “new york”" },
      ],
    },
    {
      title: "A small catalog can use a B-tree range",
      short: "B-tree range",
      text: "For a small catalog, a B-tree on the lowercased term in Postgres may suffice. The Query API reads the Terms table from “ca” up to “cb” and gets car, card, care and cat. A compressed trie or a sparse map may fit better, depending on vocabulary size, update rate and language.",
      focus: ["api", "table"],
      frame: ["client", "api", "table", "trie"],
      facts: [["Range", "ca ≤ term < cb"], ["Index", "B-tree on lower(term)"]],
      metrics: { edges: "—", scanned: 4, memory: "no lists" },
      changes: ["~ Terms table in place of the Prefix cache", "+ B-tree on the lowercased term", "+ 4 rows read from “ca” up to “cb”"],
      // One request rides all the way to the table and the reply all the way back, so with reduced motion each rests on
      // its own cable: “ca” on the short API–table cable, the four rows on the long Client–API one.
      events: [
        { type: "hide", nodes: ["cache"] },
        { type: "state", node: "trie", light: "idle", opts: { mark: undefined }, with: true },
        { type: "show", nodes: ["table"] },
        { type: "packet", path: ["client", "api", "table"], label: "“ca”" },
        { type: "state", node: "table", light: "work", readout: "4 rows" },
        { type: "note", node: "table", text: "“ca” up to “cb”", tone: "work", with: true },
        { type: "packet", path: ["table", "api", "client"], label: "4 rows", kind: "response" },
      ],
    },
  ],
};
