import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Keep routing trustworthy during change": B copies 21–35 to D (2 TB at 100 MB/s, about 5.6 hours) before map
// v42 gives it to D; App 1 on v42 writes key 30 = 8 to D, App 2 on v41 reads the old 7 from B until B redirects it;
// then what to watch, and the fixed map as the simpler choice.
// Places: on a wide screen App 1 → D, App 2 → B and B → D each lie along one of the floor's axes, so those links run
// straight; only App 2 → D bends. Monitoring stands in D's tier on a phone (bottom left) so step 6 doesn't zoom out.
export const hashOperateStage: StageScene = {
  id: "hash-operate",
  intro: "Watch Node D take over part of Node B’s range while two app servers route by different versions of the map.",
  metrics: [{ id: "map", label: "Ring map" }, { id: "stale", label: "Apps on old map" }, { id: "copy", label: "Copy" }],
  nodes: [
    { id: "map", role: "registry", label: "Ring map", detail: "version 41", at: [0, -1.48] },
    { id: "app1", role: "web", label: "App 1", detail: "routes by v41", at: [1.29, -2.59] },
    { id: "app2", role: "web", label: "App 2", detail: "routes by v41", at: [0.85, 0] },
    { id: "d", role: "database", label: "Node D", detail: "joins at 35", at: [2.71, 0], appear: 1 },
    { id: "b", role: "database", label: "Node B", detail: "owns 21–50", at: [1.48, 1.05] },
    { id: "mon", role: "monitor", label: "Monitoring", detail: "versions, copy, skew", at: [2.8, -2.5], appear: 5 },
  ],
  links: [
    { from: "map", to: "app1" },
    { from: "map", to: "app2" },
    { from: "app1", to: "d" },
    { from: "app2", to: "b" },
    { from: "app2", to: "d" },
    { from: "b", to: "d" },
  ],
  steps: [
    {
      title: "Map v41: key 30 lives on Node B",
      short: "Map v41",
      text: "Both app servers route by version 41 of the ring map, which gives positions 21 to 50 to Node B. Key 30 hashes into that range, so App 2 reads it from Node B and gets 7.",
      facts: [["Map v41", "21–50 → Node B"], ["Key 30", "7, on Node B"]],
      metrics: { map: "v41", stale: { n: 0, unit: " of 2" } },
      changes: ["+ Both apps on v41", "+ Key 30 = 7 on Node B"],
      events: [
        { type: "state", node: "map", light: "on" },
        { type: "state", nodes: ["app1", "app2"], light: "on", with: true },
        { type: "packet", path: ["app2", "b"], label: "GET key 30" },
        { type: "state", node: "b", light: "on" },
        { type: "packet", path: ["b", "app2"], label: "key 30 = 7", kind: "response" },
        { type: "note", node: "app2", text: "key 30 = 7", tone: "work" },
      ],
    },
    {
      title: "Copy 21–35 to D, at a capped rate",
      short: "Copy first",
      text: "Node D joins to take 21 to 35, so Node B first copies that range, 2 TB, to D. The copy is capped at 100 MB/s so it doesn’t starve App 2’s reads, and takes about 5.6 hours, long enough that a node can fail mid-copy: plan for it.",
      focus: ["app2", "b", "d"],
      frame: ["map", "app1", "app2", "b", "d"],
      facts: [["Range", "21–35 · 2 TB"], ["Cap", "100 MB/s"], ["Takes", "about 5.6 hours"]],
      metrics: { copy: "5.6 h" },
      changes: ["+ Node D", "+ Copy of 21–35, 2 TB"],
      events: [
        { type: "state", node: "d", detail: "copying 21–35", light: "on", readout: "copy at 100 MB/s" },
        {
          type: "stream", every: 230, routes: [
            { path: ["app2", "b"], w: 2 },
            { path: ["b", "d"], w: 1, kind: "work" },
          ],
        },
      ],
    },
    {
      title: "v42 gives 21–35 to D; App 2 misses it",
      short: "Map v42",
      text: "With the copy done, the ring map moves to version 42, which gives 21 to 35 to Node D. App 1 picks up v42, but the update hasn’t reached App 2, which still routes by v41. The two apps now disagree about who owns key 30.",
      facts: [["Map v42", "21–35 → Node D"], ["App 1", "v42"], ["App 2", "v41"]],
      metrics: { map: "v42", stale: { n: 1, unit: " of 2", tone: "hot" }, copy: "done" },
      changes: ["~ Ring map: v41 → v42", "~ App 1 on v42", "~ App 2 misses v42"],
      events: [
        { type: "state", node: "d", readout: "", detail: "owns 21–35" },
        { type: "state", node: "b", detail: "owns 36–50", with: true },
        { type: "state", node: "map", detail: "version 42", light: "work", with: true },
        { type: "packet", path: ["map", "app1"], label: "map v42", kind: "work" },
        { type: "state", node: "app1", detail: "routes by v42", light: "work" },
        { type: "packet", path: ["map", "app2"], label: "map v42", kind: "work", lost: true },
        { type: "note", node: "app2", text: "still on v41", tone: "hot" },
      ],
    },
    {
      title: "App 2 reads the old value from Node B",
      short: "Stale read",
      text: "App 1 routes by v42 and writes key 30 = 8 to Node D. App 2 routes by v41, reads key 30 from Node B and gets 7, the old value. Nothing tells App 2 it asked the wrong node.",
      focus: ["app1", "app2", "b", "d"],
      frame: ["map", "app1", "app2", "b", "d"],
      changes: ["+ Key 30 = 8 on Node D", "~ App 2 reads 7 from Node B"],
      events: [
        { type: "packet", path: ["app1", "d"], label: "SET key 30 = 8" },
        { type: "state", node: "d", light: "work" },
        { type: "note", node: "d", text: "key 30 = 8", tone: "work", with: true },
        { type: "packet", path: ["app2", "b"], label: "GET key 30" },
        { type: "packet", path: ["b", "app2"], label: "key 30 = 7", kind: "hot" },
        { type: "state", node: "app2", light: "hot", tone: "hot" },
        { type: "note", node: "app2", text: "read 7: the old value", tone: "hot", with: true },
      ],
    },
    {
      title: "B refuses a range it no longer owns",
      short: "B redirects",
      text: "With a versioned map the mismatch shows: App 2’s read carries v41. Under v42 Node B no longer owns 21 to 35, so it refuses with a redirect, as Redis Cluster’s MOVED and ASK do. The redirect corrects App 2’s map, and it reads 8 from Node D.",
      focus: ["app2", "b", "d"],
      frame: ["map", "app1", "app2", "b", "d"],
      metrics: { stale: { n: 0, unit: " of 2" } },
      changes: ["+ B refuses 21–35", "~ App 2 on v42", "~ App 2 reads 8 from D"],
      events: [
        { type: "state", node: "app2", light: "on", tone: "" },
        { type: "packet", path: ["app2", "b"], label: "GET key 30 · v41" },
        { type: "packet", path: ["b", "app2"], label: "MOVED → Node D", kind: "quiet" },
        { type: "note", node: "b", text: "21–35 → D" },
        { type: "state", node: "app2", detail: "routes by v42", light: "work", with: true },
        { type: "packet", path: ["app2", "d"], label: "GET key 30" },
        { type: "packet", path: ["d", "app2"], label: "key 30 = 8", kind: "response" },
        { type: "note", node: "app2", text: "key 30 = 8", tone: "work" },
      ],
    },
    {
      title: "Watch map versions, copy progress and skew",
      short: "What to watch",
      text: "Monitoring tracks what goes wrong during change: apps on an old map version, migration progress, and skew in keys, bytes and requests per node. Where partitions are stable and centrally managed, a fixed map may be simpler: Redis Cluster assigns 16,384 hash slots explicitly.",
      facts: [["Watch", "versions · copy · skew"], ["Fixed map", "16,384 slots"]],
      changes: ["+ Monitoring", "~ Traffic split over B and D"],
      events: [
        { type: "show", nodes: ["mon"] },
        { type: "state", node: "mon", light: "work" },
        { type: "note", node: "mon", text: "0 apps on old map", tone: "work", with: true },
        { type: "state", nodes: ["app1", "app2", "b", "d"], light: "work", with: true },
        {
          type: "stream", every: 240, routes: [
            { path: ["app1", "d"], w: 1 },
            { path: ["app2", "d"], w: 1 },
            { path: ["app2", "b"], w: 1 },
          ],
        },
      ],
    },
  ],
};
