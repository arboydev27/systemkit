import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Know what the mapping must preserve": app servers hash a key to its cache node without asking anyone, on a
// membership view they share; 100 million keys sit 25 million to a node, yet a viral post's 1,000 keys pull 30% of reads
// onto Node C, which serves 47.5% against 17.5% elsewhere; so measure bytes and request rate too, and placement alone
// neither copies data nor notices a failed node.
export const hashScopeStage: StageScene = {
  id: "hash-scope",
  intro: "Watch app servers hash keys to four cache nodes, then see equal key counts hide very unequal work.",
  metrics: [{ id: "keys", label: "Node C’s keys" }, { id: "reads", label: "Node C’s reads" }],
  nodes: [
    { id: "app", role: "web", label: "App servers", detail: "hash(key) → node", at: [0, 0], opts: { many: true } },
    { id: "a", role: "cache", label: "Node A", at: [1.2, -1.8] },
    { id: "b", role: "cache", label: "Node B", at: [1.2, -0.6] },
    { id: "c", role: "cache", label: "Node C", at: [1.2, 0.6] },
    { id: "d", role: "cache", label: "Node D", at: [1.2, 1.8] },
    { id: "mon", role: "monitor", label: "Monitoring", detail: "keys · bytes · req/s", at: [2.6, 0], appear: 4 },
  ],
  links: [
    { from: "app", to: "a" },
    { from: "app", to: "b" },
    { from: "app", to: "c" },
    { from: "app", to: "d" },
  ],
  steps: [
    {
      title: "Hash the key to find its owner",
      short: "Placement",
      text: "A cache spreads its keys over four nodes. To read user:7, an app server runs a placement function: it hashes the key, gets Node B, and asks Node B directly. No central service is asked; Memcached clients work this way, and its servers don’t know about each other.",
      focus: ["app", "b"],
      frame: ["app", "a", "b", "c", "d"],
      facts: [["Rule", "hash(key) → node"], ["Asks", "no central service"]],
      changes: ["+ user:7 → Node B", "~ No lookup on the path"],
      events: [
        { type: "note", node: "app", text: "hash(user:7) → Node B" },
        { type: "packet", path: ["app", "b"], label: "GET user:7" },
        { type: "state", node: "b", light: "on" },
        { type: "packet", path: ["b", "app"], label: "value", kind: "response" },
        { type: "state", node: "b", light: "work" },
      ],
    },
    {
      title: "Every app server needs the same view",
      short: "Same view",
      text: "The rule gives one answer only if every app server holds the same membership view, the current list of nodes: A, B, C, D. It should also move few keys when that list changes, since a moved cache entry costs a miss and a moved durable partition a bulk copy.",
      frame: ["app", "a", "b", "c", "d"],
      facts: [["Members", "A, B, C, D"], ["Moved cache key", "one miss"], ["Moved partition", "a bulk copy"]],
      changes: ["+ One membership view", "~ Goal: few keys move"],
      events: [
        { type: "note", node: "app", text: "members: A, B, C, D" },
        { type: "state", node: "a", light: "on" },
        { type: "state", node: "b", light: "on", gap: 140 },
        { type: "state", node: "c", light: "on", gap: 140 },
        { type: "state", node: "d", light: "on", gap: 140 },
      ],
    },
    {
      title: "Hashing balances the key counts",
      short: "Even keys",
      text: "Hashing makes key positions look uniform, so of the cache’s 100 million keys each node holds 25 million. With ordinary traffic each node also serves a quarter of the reads. By key count, the placement is balanced.",
      frame: ["app", "a", "b", "c", "d"],
      metrics: { keys: { n: 25, unit: "%" }, reads: { n: 25, unit: "%" } },
      facts: [["Keys", "100 million"], ["Per node", "25 million"]],
      changes: ["+ 25 million keys per node", "~ Reads spread evenly"],
      events: [
        { type: "state", nodes: ["a", "b", "c", "d"], light: "work", readout: "25M keys" },
        {
          type: "stream", every: 240, routes: [
            { path: ["app", "a"] }, { path: ["app", "b"] }, { path: ["app", "c"] }, { path: ["app", "d"] },
          ],
        },
      ],
    },
    {
      title: "A viral post skews the traffic",
      short: "Hot keys",
      text: "A viral post makes 1,000 keys on Node C draw 30% of all requests. The other 70% spreads evenly, 17.5% per node, so Node C serves 47.5% while the rest serve 17.5% each. Every node still holds 25 million keys.",
      frame: ["app", "a", "b", "c", "d"],
      // 47.5% would round to 48 as a number, so the half rides in the unit.
      metrics: { reads: { n: 47, unit: ".5%", tone: "hot" } },
      facts: [["Viral keys", "1,000 on Node C"], ["Node C", "30% + 17.5% = 47.5%"]],
      changes: ["+ 1,000 viral keys draw 30%", "~ Node C serves 47.5%", "~ Others serve 17.5% each"],
      events: [
        { type: "state", node: "c", light: "hot", tone: "hot", readout: "47.5%" },
        { type: "state", nodes: ["a", "b", "d"], light: "on", readout: "17.5%", with: true },
        { type: "note", node: "app", text: "1,000 viral keys → Node C", tone: "hot", with: true },
        {
          // 12 + 7 of 40 requests reach Node C (47.5%), 7 of 40 each other node (17.5%)
          type: "stream", every: 200, routes: [
            { path: ["app", "c"], w: 12, kind: "hot" },
            { path: ["app", "a"], w: 7 }, { path: ["app", "b"], w: 7 }, { path: ["app", "c"], w: 7 }, { path: ["app", "d"], w: 7 },
          ],
        },
      ],
    },
    {
      title: "Measure bytes and requests, not just keys",
      short: "Measure",
      text: "Key count alone called this cluster balanced. Monitoring that also tracks bytes and request rate on every node shows Node C at 47.5% of reads. Hot keys skew requests, and a few very large values can skew memory the same way.",
      frame: ["app", "a", "b", "c", "d", "mon"],
      facts: [["Watch", "keys · bytes · req/s"], ["Node C", "25% keys, 47.5% reads"]],
      changes: ["+ Monitoring per node", "~ Keys even, reads skewed"],
      events: [
        { type: "show", nodes: ["mon"] },
        { type: "state", node: "mon", light: "hot", readout: "reads skewed", tone: "hot" },
        {
          type: "stream", every: 220, routes: [
            { path: ["app", "c"], w: 12, kind: "hot" },
            { path: ["app", "a"], w: 7 }, { path: ["app", "b"], w: 7 }, { path: ["app", "c"], w: 7 }, { path: ["app", "d"], w: 7 },
          ],
        },
      ],
    },
    {
      title: "Placement only names an owner",
      short: "Limits",
      text: "Node B fails, and the function still sends user:7 to Node B. Placement copies no data, detects no failure and guarantees no availability; replicas and failure detection do that. And if one machine with a standby can hold your data, you may not need placement at all.",
      focus: ["app", "b"],
      frame: ["app", "a", "b", "c", "d"],
      changes: ["− Node B fails", "~ user:7 still goes to Node B"],
      events: [
        { type: "hide", nodes: ["mon"] },
        { type: "state", nodes: ["a", "c", "d"], light: "on", readout: "", tone: "", with: true },
        { type: "state", node: "b", light: "hot", tone: "hot", readout: "", down: true, with: true },
        { type: "note", node: "app", text: "hash(user:7) → Node B" },
        { type: "packet", path: ["app", "b"], label: "GET user:7", lost: true },
      ],
    },
  ],
};
