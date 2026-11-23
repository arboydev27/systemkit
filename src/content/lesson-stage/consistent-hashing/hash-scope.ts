import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Know what the mapping must preserve": app servers hash a key to its cache node without asking anyone, on a
// membership view they share; 100 million keys sit 25 million to a node, yet a viral post's 1,000 keys pull 30% of reads
// onto Node C, which serves 47.5% against 17.5% elsewhere; so measure bytes and request rate too, and placement alone
// neither copies data nor notices a failed node.
// Places: the nodes stand 1.25 lanes apart, as hash-modulo's caches do, so a phone's row of four fits. Unlike there,
// every node carries a pill, and a pill over Node C bends its link round the top of the app servers on a phone if they
// sit off the middle lane; so the app servers stay at lane 0 and the nodes stand 1.4 tiers out, which on a wide screen
// lets Node A's link run straight into it instead of hooking round its tag. App→A still runs under the note above the
// app servers there; raising them enough to clear it (about half a lane) bends Node C's link on a phone, so they stay.
// Monitoring has a link from every node and stands at [3, 1], far enough right of Node D that on a wide screen all four
// reach it from behind and meet there: a link into its front would run under its wide tag. Its readout takes over from
// the node pills, which step 5 clears: each sits up-right of its node, in the way of those links.
export const hashScopeStage: StageScene = {
  id: "hash-scope",
  intro: "Watch app servers hash keys to four cache nodes, then see equal key counts hide very unequal work.",
  metrics: [{ id: "keys", label: "Node C’s keys" }, { id: "reads", label: "Node C’s reads" }],
  nodes: [
    { id: "app", role: "web", label: "App servers", detail: "hash(key) → node", at: [0, 0], opts: { many: true } },
    { id: "a", role: "cache", label: "Node A", at: [1.4, -1.875] },
    { id: "b", role: "cache", label: "Node B", at: [1.4, -0.625] },
    { id: "c", role: "cache", label: "Node C", at: [1.4, 0.625] },
    { id: "d", role: "cache", label: "Node D", at: [1.4, 1.875] },
    { id: "mon", role: "monitor", label: "Monitoring", detail: "keys · bytes · req/s", at: [3, 1], appear: 4 },
  ],
  links: [
    { from: "app", to: "a" },
    { from: "app", to: "b" },
    { from: "app", to: "c" },
    { from: "app", to: "d" },
    // drawn only while Monitoring is on the stage
    { from: "a", to: "mon" },
    { from: "b", to: "mon" },
    { from: "c", to: "mon" },
    { from: "d", to: "mon" },
  ],
  steps: [
    {
      title: "Hash the key to find its owner",
      short: "Placement",
      text: "A cache spreads its keys over four nodes. To read user:7, an app server runs a placement function: it hashes the key, gets Node B, and asks Node B directly. No central service is asked; Memcached clients work this way, and its servers don’t know about each other.",
      focus: ["app", "b"],
      frame: ["app", "a", "b", "c", "d"],
      facts: [["Rule", "hash(key) → node"], ["Asks", "no central service"]],
      changes: ["+ user:7 → Node B", "~ Clients decide, not a service"],
      events: [
        { type: "note", node: "app", text: "hash(user:7) → Node B" },
        { type: "packet", path: ["app", "b"], label: "GET user:7" },
        { type: "state", node: "b", light: "on" },
        { type: "packet", path: ["b", "app"], label: "value", kind: "response" },
        { type: "state", node: "b", light: "work" },
      ],
    },
    {
      title: "Share one view; move few keys on change",
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
      facts: [["Viral keys", "1,000 on Node C"], ["Node C", "30% + 17.5% = 47.5%"], ["Keys per node", "still 25 million"]],
      changes: ["+ 1,000 viral keys draw 30%", "~ Node C serves 47.5%", "~ Others serve 17.5% each"],
      events: [
        // The pills keep "25M keys": equal key counts beside unequal work is the point. Node C's light, the hot traffic
        // and the reads chip carry the skew; a hot tone would turn its "25M keys" pill orange, as if the keys were wrong.
        { type: "state", node: "c", light: "hot" },
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
        // Monitoring now reports for the nodes, so their pills give way to its readout
        { type: "state", nodes: ["a", "b", "c", "d"], readout: "", with: true },
        {
          type: "stream", every: 220, with: true, routes: [
            { path: ["app", "c"], w: 12, kind: "hot" },
            { path: ["app", "a"], w: 7 }, { path: ["app", "b"], w: 7 }, { path: ["app", "c"], w: 7 }, { path: ["app", "d"], w: 7 },
          ],
        },
        // every node is wired to Monitoring; only Node C's report stands out, so only it travels (four labels piled up
        // where the links meet)
        { type: "packet", path: ["c", "mon"], label: "47.5%", kind: "hot" },
        { type: "state", node: "mon", light: "work", readout: "keys even · C 47.5% reads", tone: "hot" },
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
