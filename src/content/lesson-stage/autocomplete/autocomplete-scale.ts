import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Split hot and large indexes": shard only when one machine can't hold the index or replicas can't absorb the
// reads (an 8 GB index may need only replicas of one full copy). A Range map sends each prefix to Shard a–i, j–r or s–z,
// and “sa” goes to s–z. Of an example 5,600 reads a second, s–z takes 45%, 2,520/s, and the other two 1,540/s each,
// against 1,000/s a node, so every shard is over. Three replicas for s–z (840/s each) and two each for the others
// (770/s each) fix the heat without touching the ranges. When s–z outgrows a node's memory it splits into sa–sm and
// sn–sz under a versioned map (v1 → v2, an example), and “sa” now goes to Shard sa–sm. Then “s” spans both halves: the
// Query API asks both, merges their top-K lists (both from ranking version v812), and waits for the slower shard.
export const autocompleteScaleStage: StageScene = {
  id: "autocomplete-scale",
  intro: "Watch 5,600 reads a second spread over three prefix ranges, then see what replicas, a split and a spanning prefix each cost.",
  metrics: [
    { id: "reads", label: "Reads" },
    { id: "hot", label: "s–z reads" },
    { id: "asked", label: "Shards asked" },
  ],
  // The three shards first stand in one tier: down the diagonal on a wide screen, so each link fans straight out from
  // the Range map and each load pill has room of its own, and side by side on a phone. At the split they regroup two by
  // two: a–i and j–r stay in tier 2 (a tenth lower, so on a phone the replies resting under the map clear a–i), Shard
  // s–z keeps the sn–sz half and steps on into tier 3, and the new Shard sa–sm arrives beside it, so the four read in
  // alphabetical order row by row on a phone, with the trunk from the map running down between a–i and j–r. The lanes
  // are offset rather than mirrored so that on a wide screen every link has a run of its own and none crosses a part:
  // sa–sm sits up past a–i, so its link climbs over a–i rather than along a–i's link (and a–i can't go further up the
  // diagonal without standing in that link's way), and j–r sits low enough that the link to sn–sz passes between j–r
  // and sa–sm, crossing only j–r's link, which is out of focus then. Mirrored lanes either run a link through a shard
  // or under a tag, or stack a–i's tag on j–r. The Range map's detail shortens to "map v2" at the split, which keeps
  // its tag clear of the link to sn–sz. The Range map's chutes and each shard's wedges count the shards (3, then 4);
  // the map's mark is the chute a single read takes, cleared (mark: undefined) while reads go to several.
  nodes: [
    { id: "api", role: "web", label: "Query API", detail: "merges top-K", at: [0, 0] },
    { id: "map", role: "router", label: "Range map", detail: "prefix → shard", at: [1, 0], opts: { count: 3 } },
    { id: "aI", role: "shard", label: "Shard a–i", detail: "one node", at: [2, -1.5], opts: { count: 3, mark: 0 } },
    { id: "jR", role: "shard", label: "Shard j–r", detail: "one node", at: [2, 0], opts: { count: 3, mark: 1 } },
    { id: "sZ", role: "shard", label: "Shard s–z", detail: "one node", at: [2, 1.5], opts: { count: 3, mark: 2 } },
    { id: "sA", role: "shard", label: "Shard sa–sm", detail: "split from s–z", at: [3, -1.2], appear: 3, opts: { count: 4, mark: 2 } },
  ],
  links: [
    { from: "api", to: "map" },
    { from: "map", to: "aI" },
    { from: "map", to: "jR" },
    { from: "map", to: "sZ" },
    { from: "map", to: "sA" },
  ],
  steps: [
    {
      title: "A range map sends each prefix to a shard",
      short: "Route",
      text: "Shard only when one machine can’t hold the index or replicas can’t absorb the reads: an 8 GB index may need only replicas of one full copy. Otherwise a prefix range map assigns terms to shards, and “sa” goes to Shard s–z.",
      focus: ["api", "map", "sZ"],
      frame: ["api", "map", "aI", "jR", "sZ"],
      facts: [["8 GB index", "replicas may do"], ["Ranges", "a–i, j–r, s–z"]],
      metrics: { reads: 1, hot: 1, asked: 1 },
      changes: ["+ Range map: a–i, j–r, s–z", "+ “sa” → Shard s–z"],
      events: [
        { type: "packet", path: ["api", "map"], label: "“sa”" },
        { type: "state", node: "map", light: "on", opts: { mark: 2 } },
        { type: "note", node: "map", text: "“sa” → s–z", with: true },
        { type: "packet", path: ["map", "sZ"], label: "“sa”" },
        { type: "state", node: "sZ", light: "on" },
        { type: "packet", path: ["sZ", "map", "api"], label: "top 5", kind: "response" },
        { type: "state", node: "api", light: "work" },
      ],
    },
    {
      title: "Equal letter ranges carry unequal load",
      short: "Hot range",
      text: "Equal alphabet ranges are often unbalanced: common first letters draw more reads. Of an example 5,600 reads a second, s–z gets 45%, 2,520 a second, and a–i and j–r 1,540 each. A node handles 1,000, so every shard is over, s–z most.",
      facts: [["One node", "1,000/s"], ["s–z share", "45%"]],
      metrics: { reads: { n: 5600, unit: "/s" }, hot: { n: 2520, unit: "/s", tone: "hot" } },
      changes: ["~ 5,600 reads/s", "~ s–z: 2,520/s, 45% of reads", "~ a–i, j–r: 1,540/s each"],
      events: [
        { type: "state", node: "map", light: "on", opts: { mark: undefined } },
        { type: "state", node: "api", light: "on", readout: "5,600/s", with: true },
        { type: "state", node: "sZ", light: "idle", with: true },
        {
          type: "stream", every: 190, routes: [
            { path: ["api", "map", "aI"], w: 11 },
            { path: ["api", "map", "jR"], w: 11 },
            { path: ["api", "map", "sZ"], w: 18 },
          ],
        },
        { type: "pause", ms: 600 },
        { type: "state", nodes: ["aI", "jR"], light: "hot", readout: "1,540/s" },
        { type: "state", node: "sZ", light: "hot", tone: "hot", readout: "2,520/s", with: true },
        { type: "note", node: "sZ", text: "45% of reads", tone: "hot", with: true },
      ],
    },
    {
      title: "Replicas spread the reads, ranges unchanged",
      short: "Replicas",
      text: "Three replicas for s–z (840 a second each) and two each for a–i and j–r (770 each) keep every node under 1,000. If memory is fine, replicas fix the heat without touching the ranges. Measure bytes, request rate and CPU per range to choose.",
      facts: [["s–z", "3 replicas"], ["a–i, j–r", "2 replicas each"]],
      metrics: { hot: { n: 2520, unit: "/s" } },
      changes: ["+ s–z: 3 replicas, 840/s each", "+ a–i, j–r: 2 replicas, 770/s each", "~ Ranges unchanged"],
      events: [
        {
          type: "stream", every: 190, routes: [
            { path: ["api", "map", "aI"], w: 11 },
            { path: ["api", "map", "jR"], w: 11 },
            { path: ["api", "map", "sZ"], w: 18 },
          ],
        },
        { type: "state", node: "sZ", detail: "3 replicas", light: "work", tone: "", readout: "3 × 840/s" },
        { type: "state", nodes: ["aI", "jR"], detail: "2 replicas", light: "work", readout: "2 × 770/s", with: true },
        { type: "note", node: "map", text: "same ranges", tone: "work", with: true },
      ],
    },
    {
      title: "Split a range under a versioned map",
      short: "Split",
      text: "When a range outgrows one node’s memory, split it: here s–z becomes sa–sm and sn–sz. The routing map is versioned during the move, v1 to v2 in this example, so every read follows one consistent map. Under v2, “sa” goes to the new Shard sa–sm.",
      focus: ["api", "map", "sA", "sZ"],
      frame: ["api", "map", "aI", "jR", "sA", "sZ"],
      facts: [["Map", "v1 → v2 (example)"], ["s–z", "sa–sm and sn–sz"]],
      changes: ["+ Shard sa–sm", "~ Shard s–z → Shard sn–sz", "~ Range map v1 → v2"],
      events: [
        { type: "state", nodes: ["api", "aI", "jR"], light: "idle", readout: "" },
        { type: "state", node: "map", detail: "map v2", light: "on", opts: { count: 4 }, with: true },
        { type: "note", node: "map", text: "map v1 → v2", tone: "work", with: true },
        { type: "show", nodes: ["sA"], at: { aI: [2.1, -0.5], jR: [2.1, 1.3], sZ: [3, 0.9] } },
        { type: "state", node: "sZ", label: "Shard sn–sz", detail: "split from s–z", light: "idle", readout: "", opts: { count: 4, mark: 3 }, with: true },
        { type: "state", nodes: ["aI", "jR"], opts: { count: 4 }, with: true },
        { type: "packet", path: ["api", "map"], label: "“sa”" },
        { type: "state", node: "map", opts: { mark: 2 } },
        { type: "packet", path: ["map", "sA"], label: "“sa” · map v2" },
        { type: "state", node: "sA", light: "on" },
        { type: "note", node: "sA", text: "“sa” under v2", with: true },
      ],
    },
    {
      title: "A prefix across shards fans out and merges",
      short: "Fan out",
      text: "No one shard now holds every candidate for “s”, so the Query API asks both Shard sa–sm and Shard sn–sz and merges their top-K results, much as Elasticsearch merges across its shards. Both lists must come from the same ranking version, v812.",
      focus: ["api", "map", "sA", "sZ"],
      frame: ["api", "map", "aI", "jR", "sA", "sZ"],
      facts: [["“s” spans", "2 shards"], ["Ranking", "v812 on both"]],
      metrics: { asked: 2 },
      changes: ["+ “s” asked of 2 shards", "+ 2 top 5 lists merged into 1", "~ Both lists from v812"],
      events: [
        // One “s” leaves the Query API and parts at the Range map: the two requests ride the first hop as one pill, so a
        // still rests them on the map–shard hops and leaves the short api–map hop to the reply "2 × top 5". The map
        // carries no note here, since that reply rests by it; the two requests leaving together, the facts and the
        // metric say it asks 2 shards.
        { type: "state", nodes: ["sA", "sZ"], light: "idle" },
        { type: "state", node: "map", light: "on", opts: { mark: undefined }, with: true },
        { type: "packet", path: ["api", "map", "sA"], label: "“s”" },
        { type: "packet", path: ["api", "map", "sZ"], label: "“s”", with: true },
        { type: "state", nodes: ["sA", "sZ"], light: "on" },
        { type: "packet", path: ["sA", "map"], label: "top 5 · v812", kind: "response" },
        { type: "packet", path: ["sZ", "map"], label: "top 5 · v812", kind: "response", with: true },
        { type: "packet", path: ["map", "api"], label: "2 × top 5", kind: "response" },
        { type: "note", node: "api", text: "merge → top 5", tone: "work" },
        { type: "state", node: "api", light: "work", with: true },
      ],
    },
    {
      title: "The slowest shard sets the pace",
      short: "Fanout cost",
      text: "A fanned-out read is as slow as its slowest shard, here Shard sn–sz. Keeping a prefix’s descendants together avoids fanout but concentrates storage and traffic; precomputed lists for very short prefixes, in a small separate table, avoid it where it’s broadest.",
      focus: ["api", "map", "sA", "sZ"],
      frame: ["api", "map", "aI", "jR", "sA", "sZ"],
      facts: [["Merge waits for", "the slowest shard"], ["Short prefixes", "own small table"]],
      changes: ["~ Shard sa–sm answers first", "~ The merge waits for Shard sn–sz"],
      events: [
        // Each reply ends at the Range map and the pair goes on as one, as in the step before, so a still shows one
        // pill on the map–api hop rather than two stacked.
        { type: "state", nodes: ["api", "sA", "sZ"], light: "on" },
        { type: "note", node: "sZ", text: "slower", with: true },
        { type: "packet", path: ["sA", "map"], label: "top 5 · sa–sm", kind: "response" },
        { type: "state", node: "sA", light: "work" },
        { type: "note", node: "api", text: "waits for both", with: true },
        { type: "pause", ms: 700 },
        { type: "packet", path: ["sZ", "map"], label: "top 5 · sn–sz", kind: "response" },
        { type: "state", node: "sZ", light: "work" },
        { type: "packet", path: ["map", "api"], label: "2 × top 5", kind: "response" },
        { type: "state", node: "api", light: "work" },
      ],
    },
  ],
};
