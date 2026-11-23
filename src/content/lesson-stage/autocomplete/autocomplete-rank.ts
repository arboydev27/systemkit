import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Rank the top few": a U of five parts, the build side (Term counts → Index builder) feeding the serving side
// (Prefix cache → Policy filter → Client). Under “cam”, with example terms: on lifetime counts camping's 10,000 lead
// camera's 3,000, and equal scores break alphabetically (camel and cameo at 500 each, camel first). With an example
// half-life of 7 days, camping's 10,000 from two weeks ago score 2,500 against camera's 3,000 today, so camera leads.
// The builder stores exactly 5 per prefix, none spare; the Policy filter blocks 1 and the Client gets 4 of its 5 slots.
// Storing 20, filtering, then taking 5 fills the list, at 4× the list storage of 5.
export const autocompleteRankStage: StageScene = {
  id: "autocomplete-rank",
  intro: "Watch counts become a ranked list for “cam”, then see why a list of exactly five can’t survive one blocked term.",
  metrics: [
    { id: "leader", label: "Top of “cam”" },
    { id: "stored", label: "Stored" },
    { id: "shown", label: "Shown" },
  ],
  // Serving side in lane −1, build side in lane +1, joined at tier 2: on a phone the Client sits alone on top, then
  // Policy filter | Term counts, then Prefix cache | Index builder, and the story runs down the right and up the left.
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "5 slots", at: [0, -1] },
    { id: "filter", role: "gate", label: "Policy filter", detail: "denylist, at serve", at: [1, -1], opts: { open: true } },
    { id: "cache", role: "cache", label: "Prefix cache", detail: "top-K per prefix", at: [2, -1] },
    { id: "counts", role: "database", label: "Term counts", detail: "term × window", at: [1, 1] },
    { id: "builder", role: "worker", label: "Index builder", detail: "scores, ranks", at: [2, 1] },
  ],
  links: [
    { from: "client", to: "filter" },
    { from: "filter", to: "cache" },
    { from: "cache", to: "builder" },
    { from: "builder", to: "counts" },
  ],
  steps: [
    {
      title: "Rank by count, break ties A to Z",
      short: "Count and ties",
      text: "The Index builder ranks completed searches by count. With example counts under “cam”, camping’s 10,000 lifetime searches lead camera’s 3,000. Equal scores break alphabetically, so camel and cameo, at 500 each, always come out camel first and the list doesn’t flicker between builds.",
      focus: ["counts", "builder"],
      frame: ["client", "filter", "cache", "counts", "builder"],
      facts: [["camping", "10,000 lifetime"], ["camera", "3,000 lifetime"], ["Tie", "camel = cameo, 500"]],
      metrics: { leader: "camping" },
      changes: ["+ Ranked by count", "~ camping leads “cam”", "+ Ties: camel before cameo"],
      events: [
        { type: "packet", path: ["counts", "builder"], label: "counts for “cam”", kind: "work" },
        { type: "state", node: "builder", light: "on" },
        { type: "note", node: "builder", text: "ties break A to Z", with: true },
      ],
    },
    {
      title: "Older searches lose half their weight a week",
      short: "Time decay",
      text: "Lifetime counts go stale, so a time-decayed score shrinks older counts. With an example half-life of seven days, camping’s 10,000 searches two weeks ago, and none since, score 2,500. Camera’s 3,000 today score 3,000, so camera now ranks higher.",
      focus: ["counts", "builder"],
      frame: ["client", "filter", "cache", "counts", "builder"],
      facts: [["Half-life", "7 days"], ["camping", "10,000 → 2,500"], ["camera", "3,000 → 3,000"]],
      metrics: { leader: "camera" },
      changes: ["~ Older counts shrink with age", "~ camping scores 2,500", "~ camera leads “cam”"],
      events: [
        { type: "packet", path: ["counts", "builder"], label: "counts by window", kind: "work" },
        { type: "state", node: "builder", light: "work" },
        { type: "note", node: "counts", text: "camera 3,000 today", with: true },
        { type: "note", node: "builder", text: "camping → 2,500", tone: "work" },
      ],
    },
    {
      title: "The builder stores exactly five per prefix",
      short: "Store five",
      text: "A scheduled job writes the decayed scores into the serving lists; Elasticsearch’s completion suggester, for one, takes a per-entry weight. Here the Index builder stores exactly five candidates for “cam”: one for each visible slot, and none spare.",
      focus: ["builder", "cache"],
      frame: ["client", "filter", "cache", "counts", "builder"],
      facts: [["Stored", "5 for “cam”"], ["Slots", "5"]],
      metrics: { stored: 5 },
      changes: ["+ top 5 for “cam” in the Prefix cache", "~ Scores written as weights"],
      events: [
        { type: "packet", path: ["builder", "cache"], label: "top 5 for “cam”", kind: "work" },
        { type: "state", node: "cache", light: "work" },
        { type: "note", node: "cache", text: "5 stored", tone: "work", with: true },
        { type: "state", node: "builder", light: "idle", with: true },
      ],
    },
    {
      title: "One blocked term leaves only four",
      short: "Short list",
      text: "The Client types “cam”. The Prefix cache returns its five stored candidates, and the Policy filter blocks one that is on the denylist. The visible list has five slots, but the Client gets only four.",
      focus: ["client", "filter", "cache"],
      frame: ["client", "filter", "cache", "counts", "builder"],
      facts: [["Stored", "5"], ["Blocked", "1"], ["Shown", "4 of 5"]],
      metrics: { shown: { n: 4, tone: "hot" } },
      changes: ["+ 1 term blocked by policy", "~ Client gets 4, not 5"],
      events: [
        { type: "packet", path: ["client", "filter", "cache"], label: "“cam”" },
        { type: "packet", path: ["cache", "filter"], label: "top 5", kind: "response" },
        { type: "state", node: "filter", light: "on", opts: { open: "half" } },
        { type: "note", node: "filter", text: "1 blocked", with: true },
        { type: "packet", path: ["filter", "client"], label: "top 4", kind: "hot" },
        { type: "state", node: "client", light: "hot" },
        { type: "note", node: "client", text: "only 4 shown", tone: "hot", with: true },
      ],
    },
    {
      title: "Filter 20 candidates, then take five",
      short: "Filter first",
      text: "Keep more candidates than slots. The Index builder stores the top 20 for “cam”. The Policy filter removes the blocked term from the 20, then takes the first five, so the Client’s list is full again.",
      focus: ["client", "filter", "cache", "counts", "builder"],
      frame: ["client", "filter", "cache", "counts", "builder"],
      facts: [["Stored", "20"], ["Blocked", "1 of 20"], ["Shown", "5 of 5"]],
      metrics: { stored: 20, shown: 5 },
      changes: ["~ 20 stored for “cam”", "+ Filter first, then take 5", "~ Client gets all 5"],
      events: [
        { type: "state", node: "client", light: "idle" },
        { type: "state", node: "filter", light: "idle", with: true },
        { type: "packet", path: ["builder", "cache"], label: "top 20", kind: "work" },
        { type: "state", node: "cache", light: "work" },
        { type: "note", node: "cache", text: "20 stored", tone: "work", with: true },
        { type: "packet", path: ["client", "filter", "cache"], label: "“cam”" },
        { type: "packet", path: ["cache", "filter"], label: "top 20", kind: "response" },
        { type: "state", node: "filter", light: "on" },
        { type: "note", node: "filter", text: "1 of 20 blocked", with: true },
        { type: "packet", path: ["filter", "client"], label: "top 5", kind: "response" },
        { type: "state", node: "client", light: "work" },
        { type: "note", node: "client", text: "5 shown", tone: "work", with: true },
      ],
    },
    {
      title: "Spare candidates take four times the space",
      short: "Cost",
      text: "Twenty candidates instead of five quadruple the list storage, so size the spare from how often filters actually remove entries. Personal search history is a different product again: it needs account-aware access and private caching.",
      focus: ["cache", "filter"],
      frame: ["client", "filter", "cache", "counts", "builder"],
      facts: [["Stored", "20 vs 5"], ["Storage", "4×"]],
      changes: ["~ List storage ×4", "~ Size the spare from block rates"],
      events: [
        // a note, not a load pill: on a phone a pill over the cache sends its link to the builder round the back
        { type: "state", node: "cache", light: "on" },
        { type: "note", node: "cache", text: "4× list storage", with: true },
      ],
    },
  ],
};
