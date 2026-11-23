import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Serve a predictable read path": the Query API turns “foot” into the versioned key v812:en-GB:GB:foot and answers
// a top 5 from the Prefix cache; a miss on “footw” (an example rarer prefix) reads the Snapshot store and fills the cache.
// At an example 5,600 reads a second a 95% hit rate leaves the store 280 a second; after a cold restart nearly all 5,600
// reach a store sized for 1,000 a second and it falls over. Warming broad prefixes (“f”, “s”) before taking traffic brings
// the 95% back, and coalescing three simultaneous misses on “footb” makes one store read instead of three. Last, the key
// must carry prefix, locale, region and version: keyed by “foot” alone, a GB reader gets the list cached for a US reader.
// Seven steps (the plan's warm-and-coalesce step is split, one mechanism each). The chips count single reads in steps 1, 2,
// 6 and 7 and the example busy hour in steps 3 to 5.
// The api–cache hop is short, so it carries one message per step: the prefix rides client → api → cache as one packet
// (the API's note shows the key it reads), and a fill is the cache lighting blue with a note, not a second message.
// Two pills there pile up in the reduced-motion stills.
export const autocompleteServeStage: StageScene = {
  id: "autocomplete-serve",
  intro: "Watch a prefix become a versioned cache key, see what reaches the Snapshot store when the cache misses or restarts cold, then key the cache by prefix alone.",
  metrics: [
    { id: "reads", label: "Reads" },
    { id: "hit", label: "Hit rate" },
    { id: "store", label: "Store reads" },
  ],
  // The cache.ts shape: the serving lane (Prefix cache) at −1, the build output (Snapshot store) at +1. Fills go through
  // the Query API, so there is no cache–store link. On a phone tier 2 is one row of two.
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "types “foot”", at: [0, 0] },
    { id: "api", role: "web", label: "Query API", detail: "replicated nodes", at: [1, 0], opts: { many: true } },
    { id: "cache", role: "cache", label: "Prefix cache", detail: "top-K per prefix", at: [2, -1] },
    { id: "snapshots", role: "storage", label: "Snapshot store", detail: "versioned snapshots", at: [2, 1] },
  ],
  links: [
    { from: "client", to: "api" },
    { from: "api", to: "cache" },
    { from: "api", to: "snapshots" },
  ],
  steps: [
    {
      title: "A prefix becomes a versioned cache key",
      short: "Read path",
      text: "The Client types “foot”. The Query API checks length and context, then reads the entry at key v812:en-GB:GB:foot from the Prefix cache, in memory or a shared Redis. It filters the entry and returns a top 5. Replicated query nodes keep the path available.",
      focus: ["client", "api", "cache"],
      frame: ["client", "api", "cache", "snapshots"],
      facts: [["Key", "v812:en-GB:GB:foot"], ["Returns", "top 5"]],
      metrics: { reads: 1, store: 0 },
      changes: ["+ “foot” sent", "+ Key v812:en-GB:GB:foot", "~ Prefix cache hit, top 5 returned"],
      events: [
        { type: "packet", path: ["client", "api", "cache"], label: "“foot”" },
        { type: "state", node: "api", light: "on", with: true },
        { type: "note", node: "api", text: "v812:en-GB:GB:foot", with: true },
        { type: "state", node: "cache", light: "work" },
        { type: "note", node: "cache", text: "hit", tone: "work", with: true },
        { type: "packet", path: ["cache", "api", "client"], label: "top 5", kind: "response" },
        { type: "state", node: "api", light: "work" },
      ],
    },
    {
      title: "A miss reads the snapshot, then fills",
      short: "Miss",
      text: "The next reader types “footw”, an example of a rarer prefix, and its key misses. On a miss, the Query API reads the v812 list from the persistent Snapshot store and fills the Prefix cache, so the next reader of “footw” hits.",
      focus: ["api", "cache", "snapshots"],
      frame: ["client", "api", "cache", "snapshots"],
      facts: [["Prefix", "“footw”"], ["Cache", "miss, then filled"]],
      metrics: { reads: 2, store: 1 },
      changes: ["+ “footw” misses", "+ 1 Snapshot store read", "+ “footw” list in the Prefix cache"],
      events: [
        { type: "state", node: "client", detail: "types “footw”" },
        { type: "state", nodes: ["api", "cache"], light: "idle", with: true },
        { type: "packet", path: ["client", "api", "cache"], label: "“footw”" },
        { type: "note", node: "cache", text: "miss" },
        { type: "packet", path: ["api", "snapshots"], label: "v812 · “footw”" },
        { type: "state", node: "snapshots", light: "on" },
        { type: "packet", path: ["snapshots", "api"], label: "top 5", kind: "response" },
        // the fill: the cache lights blue and the API says it, while the list goes back to the Client
        { type: "state", node: "cache", light: "work" },
        { type: "note", node: "api", text: "cache filled", tone: "work", with: true },
        { type: "packet", path: ["api", "client"], label: "top 5", kind: "response", with: true },
      ],
    },
    {
      title: "95% hits leave the store 280 reads/s",
      short: "Hit rate",
      text: "At an example 5,600 reads a second, a 95% hit rate answers 19 of every 20 reads from the Prefix cache. The Snapshot store sees the other 5%, 280 reads a second, well under the 1,000 a second it is sized for.",
      frame: ["client", "api", "cache", "snapshots"],
      facts: [["Reads", "5,600/s"], ["Hit rate", "95%"], ["Store sized for", "1,000/s"]],
      metrics: { reads: { n: 5600, unit: "/s" }, hit: { n: 95, unit: "%" }, store: { n: 280, unit: "/s" } },
      changes: ["~ 5,600 reads a second", "~ 95% answered by the Prefix cache", "+ 280 store reads a second"],
      events: [
        { type: "state", node: "client", detail: "5,600 reads/s", opts: { many: true } },
        { type: "state", node: "api", light: "on", with: true },
        { type: "state", node: "cache", light: "work", with: true },
        { type: "state", node: "snapshots", light: "on", readout: "280/s", meter: 0.28, with: true },
        {
          type: "stream", every: 170, routes: [
            { path: ["client", "api", "cache"], w: 19, kind: "work" },
            { path: ["client", "api", "snapshots"], w: 1 },
          ],
        },
        { type: "note", node: "cache", text: "19 of 20 hit", tone: "work" },
      ],
    },
    {
      title: "A cold cache sends the store nearly 5,600/s",
      short: "Cold restart",
      text: "The Prefix cache restarts empty, so nearly every read misses at once: a cache stampede. Almost all 5,600 reads a second fall through to the Snapshot store, sized for 1,000 a second, and it falls over.",
      focus: ["api", "cache", "snapshots"],
      frame: ["client", "api", "cache", "snapshots"],
      facts: [["Store sized for", "1,000/s"], ["Arriving", "nearly 5,600/s"]],
      metrics: { hit: { n: 0, unit: "%", tone: "hot" }, store: { n: 5600, unit: "/s", tone: "hot" } },
      changes: ["− Prefix cache restarts empty", "~ Nearly every read misses", "− Snapshot store overloaded, down"],
      events: [
        { type: "state", node: "cache", light: "idle" },
        { type: "note", node: "cache", text: "restarted empty", with: true },
        { type: "stream", every: 170, routes: [{ path: ["client", "api", "snapshots"], kind: "hot" }] },
        { type: "state", node: "snapshots", light: "hot", tone: "hot", readout: "5,600/s", meter: 1 },
        { type: "pause", ms: 1100 },
        { type: "state", node: "snapshots", down: true },
        { type: "note", node: "snapshots", text: "sized for 1,000/s", tone: "hot", with: true },
      ],
    },
    {
      title: "Warm broad prefixes before taking traffic",
      short: "Warm first",
      text: "Instead, warm the restarted Prefix cache before it takes traffic: load broad prefixes such as “f” and “s” from the Snapshot store, which keeps the last-good snapshot. Reads then start near the 95% hit rate, and the store sees about 280 a second.",
      frame: ["client", "api", "cache", "snapshots"],
      facts: [["Warmed", "“f”, “s” …"], ["Store reads", "about 280/s"]],
      metrics: { hit: { n: 95, unit: "%" }, store: { n: 280, unit: "/s" } },
      changes: ["+ Broad prefixes loaded before traffic", "~ Hit rate back near 95%", "~ Snapshot store stays up"],
      events: [
        { type: "state", node: "snapshots", light: "on", tone: "", down: false, readout: "", meter: null },
        { type: "state", node: "api", light: "idle", with: true },
        { type: "packet", path: ["snapshots", "api", "cache"], label: "warm", kind: "work" },
        { type: "state", node: "cache", light: "work" },
        { type: "note", node: "cache", text: "“f”, “s” warmed", tone: "work", with: true },
        { type: "state", node: "api", light: "on" },
        { type: "state", node: "snapshots", readout: "280/s", meter: 0.28, with: true },
        {
          type: "stream", every: 170, routes: [
            { path: ["client", "api", "cache"], w: 19, kind: "work" },
            { path: ["client", "api", "snapshots"], w: 1 },
          ],
        },
      ],
    },
    {
      title: "Coalesce misses so one request fetches",
      short: "Coalesce",
      text: "Three readers miss on “footb” at the same moment. The Query API coalesces the misses: one request fetches the list from the Snapshot store and fills the Prefix cache while the other two wait, so the store gets one read instead of three.",
      focus: ["api", "cache", "snapshots"],
      frame: ["client", "api", "cache", "snapshots"],
      facts: [["Misses on “footb”", "3 at once"], ["Fetches", "1, two wait"]],
      // Three reads of one rare prefix, not the busy hour: the chips count this moment, as in step 2.
      metrics: { reads: 3, hit: "—", store: 1 },
      changes: ["+ 3 misses on “footb” at once", "~ 1 store read, 2 requests wait", "+ “footb” list in the Prefix cache"],
      events: [
        { type: "state", node: "client", detail: "3 readers, “footb”" },
        { type: "state", node: "snapshots", readout: "", meter: null, with: true },
        // as in step 2, the cache rests grey until the one fetch fills it
        { type: "state", node: "cache", light: "idle", with: true },
        // one pill for the three requests: the hop fits about 7 characters; the cache's note and the reply say three
        { type: "packet", path: ["client", "api", "cache"], label: "“footb”" },
        { type: "note", node: "cache", text: "3 misses at once" },
        { type: "note", node: "api", text: "one fetches, two wait", tone: "work", with: true },
        { type: "packet", path: ["api", "snapshots"], label: "v812 · “footb”" },
        { type: "packet", path: ["snapshots", "api"], label: "top 5", kind: "response" },
        { type: "state", node: "cache", light: "work" },
        { type: "state", node: "api", light: "work", with: true },
        { type: "packet", path: ["api", "client"], label: "top 5 × 3", kind: "response", with: true },
      ],
    },
    {
      title: "The key carries what changes the answer",
      short: "Cache key",
      text: "Include prefix, locale, region and version where each changes the answer; each splits the cache and lowers its hit rate. Try both keys: the full key returns the GB list, while “foot” alone gives a GB reader the US list. Personal lists need private caching or none.",
      focus: ["client", "api", "cache"],
      frame: ["client", "api", "cache", "snapshots"],
      facts: [["Full key", "v812:en-GB:GB:foot"], ["Prefix only", "foot"]],
      metrics: { reads: 1, hit: "—", store: 0 },
      changes: ["~ Key: prefix, locale, region, version", "~ Personal lists stay out of shared caches"],
      events: [],
      control: {
        label: "Cache key",
        options: [
          {
            label: "Full key",
            events: [
              { type: "state", node: "client", detail: "GB reader", opts: { many: false } },
              { type: "state", nodes: ["api", "cache", "snapshots"], light: "idle", tone: "", with: true },
              { type: "packet", path: ["client", "api", "cache"], label: "“foot”" },
              { type: "note", node: "api", text: "v812:en-GB:GB:foot", with: true },
              { type: "state", node: "cache", light: "work" },
              { type: "note", node: "cache", text: "GB entry: hit", tone: "work", with: true },
              { type: "packet", path: ["cache", "api", "client"], label: "GB top 5", kind: "response" },
              { type: "note", node: "client", text: "GB list", tone: "work" },
            ],
          },
          {
            label: "Prefix only",
            events: [
              { type: "state", node: "client", detail: "GB reader", opts: { many: false } },
              { type: "state", nodes: ["api", "cache", "snapshots"], light: "idle", tone: "", with: true },
              { type: "packet", path: ["client", "api", "cache"], label: "“foot”" },
              { type: "note", node: "api", text: "key: foot", with: true },
              { type: "state", node: "cache", light: "hot", tone: "hot" },
              { type: "note", node: "cache", text: "foot → US list", tone: "hot", with: true },
              { type: "packet", path: ["cache", "api", "client"], label: "US top 5", kind: "hot" },
              { type: "note", node: "client", text: "US list, GB reader", tone: "hot" },
            ],
          },
        ],
      },
    },
  ],
};
