import type { StageScene } from "../../../lib/lesson-stage/types";

const webs = ["web", "web2", "web3"];
const through = (to: string, kind?: "work" | "hot") => webs.map((id) => ({ path: ["lb", id, to], kind }));

// Lesson "Scale in response to evidence": one illustrative history, each signal answered by one change, then the cost of what was added.
// On a phone, step 3 frames the database so it isn’t half under the play bar, and Users leave the stage from step 4 (the chip keeps their count) so they don’t peek out under the chips.
export const synthesisStage: StageScene = {
  id: "synthesis",
  intro: "Watch a site grow to a million daily users in one illustrative history, each change answering one signal.",
  metrics: [{ id: "users", label: "Daily users" }, { id: "signal", label: "Evidence" }, { id: "parts", label: "Parts" }],
  nodes: [
    { id: "users", role: "crowd", label: "Users", detail: "5,000 a day", at: [0, 0] },
    { id: "lb", role: "balancer", label: "Load balancer", detail: "web redundancy", at: [1, 0], appear: 2 },
    { id: "web", role: "web", label: "Server", detail: "app + database", at: [1, 0] },
    { id: "web2", role: "web", label: "Web server", detail: "stateless", at: [2, 0], appear: 2 },
    { id: "web3", role: "web", label: "Web server", detail: "stateless", at: [2, 1.7], appear: 2 },
    { id: "cache", role: "cache", label: "Cache", detail: "repeated reads", at: [3.1, -1.7], appear: 3 },
    { id: "db", role: "database", label: "Database", detail: "its own server", at: [2, 0], appear: 1 },
    { id: "replicas", role: "database", label: "Replicas", detail: "two, for reads", at: [3.1, 1.7], appear: 3, opts: { replica: true } },
  ],
  links: [
    { from: "users", to: "web", unless: "lb" },
    { from: "users", to: "lb" },
    ...webs.map((id) => ({ from: "lb", to: id })),
    ...webs.map((id) => ({ from: id, to: "db" })),
    ...webs.map((id) => ({ from: id, to: "cache" })),
    ...webs.map((id) => ({ from: id, to: "replicas" })),
    { from: "db", to: "replicas" },
  ],
  steps: [
    {
      title: "5,000 users: nothing changes",
      short: "5,000 users",
      text: "At 5,000 daily users, one server runs both the app and the database and still has headroom. There’s no pressure to answer, so nothing changes.",
      metrics: { users: 5000, signal: "headroom", parts: 1 },
      changes: ["~ One server runs app and database", "~ No signal, so no change"],
      events: [
        { type: "packet", path: ["users", "web"], label: "GET /" },
        { type: "state", node: "web", light: "on", readout: "headroom" },
        { type: "packet", path: ["web", "users"], label: "200 OK", kind: "response" },
      ],
    },
    {
      title: "50,000 users: move the database out",
      short: "Move database",
      text: "At 50,000 daily users, the application and the database compete for memory on that one server. So the database moves out to a server of its own.",
      focus: ["users", "web", "db"],
      metrics: { users: 50000, signal: "RAM contention", parts: 2 },
      changes: ["+ Database server", "~ Web server runs only the app"],
      events: [
        { type: "state", node: "users", detail: "50,000 a day" },
        { type: "packet", path: ["users", "web"], label: "GET /" },
        { type: "state", node: "web", readout: "RAM contention" },
        { type: "pause", ms: 700 },
        { type: "show", nodes: ["db"] },
        { type: "state", node: "web", label: "Web server", detail: "runs the app", readout: "" },
        { type: "packet", path: ["web", "db"], label: "SELECT …" },
        { type: "state", node: "db", light: "on" },
        { type: "packet", path: ["db", "web"], label: "rows", kind: "response" },
        { type: "packet", path: ["web", "users"], label: "200 OK", kind: "response" },
      ],
    },
    {
      title: "200,000 users: add servers and a balancer",
      short: "Add web servers",
      text: "At 200,000, web CPU peaks at 85% and a single failure would mean an outage. A load balancer arrives and the web tier grows to three servers, which forces sessions out of server memory.",
      focus: ["users", "lb", "web", "web2", "web3"],
      frame: ["users", "lb", ...webs, "db"],
      metrics: { users: 200000, signal: "web CPU 85%", parts: 5 },
      changes: ["+ Load balancer", "+ 2 more web servers", "~ Sessions leave server memory"],
      events: [
        { type: "state", node: "users", detail: "200,000 a day" },
        { type: "packet", path: ["users", "web"], label: "GET /" },
        { type: "state", node: "web", readout: "CPU 85%", meter: 0.85 },
        { type: "pause", ms: 900 },
        { type: "show", nodes: ["lb", "web2", "web3"], at: { users: [0.15, 0], web: [2, -1.7], db: [3.1, 0] } },
        { type: "state", node: "web", detail: "stateless", readout: "", meter: null },
        { type: "state", nodes: ["lb", "web2", "web3"], light: "on" },
        { type: "note", node: "web", text: "no sessions kept" },
        { type: "stream", every: 260, routes: webs.map((id) => ({ path: ["users", "lb", id] })) },
      ],
    },
    {
      title: "1 million users: cache and replicate",
      short: "Cache, replicas",
      text: "At one million, database reads hit 70% of capacity while writes stay low. So a cache and two read replicas follow: both take reads, and the primary keeps the writes and copies them out.",
      focus: ["lb", ...webs, "cache", "db", "replicas"],
      metrics: { users: 1000000, signal: "DB reads 70%", parts: 8 },
      changes: ["+ Cache", "+ 2 replicas copy the primary", "~ Primary keeps the writes"],
      events: [
        { type: "hide", nodes: ["users"] },
        { type: "packet", path: ["web2", "db"], label: "SELECT …" },
        { type: "state", node: "db", readout: "reads 70%", meter: 0.7 },
        { type: "pause", ms: 900 },
        { type: "show", nodes: ["cache", "replicas"] },
        { type: "state", node: "db", label: "Primary", detail: "takes every write", readout: "", meter: null },
        { type: "packet", path: ["web", "cache"], label: "GET …" },
        { type: "packet", path: ["web3", "replicas"], label: "SELECT …", with: true },
        { type: "state", node: "cache", light: "work" },
        { type: "state", node: "replicas", light: "on", with: true },
        { type: "packet", path: ["cache", "web"], label: "hit", kind: "response", with: true },
        { type: "packet", path: ["replicas", "web3"], label: "rows", kind: "response", with: true },
        { type: "packet", path: ["web2", "db"], label: "INSERT …" },
        { type: "packet", path: ["db", "web2"], label: "committed", kind: "response" },
        { type: "packet", path: ["db", "replicas"], label: "copy" },
      ],
    },
    {
      title: "Every part has a running cost",
      short: "Running cost",
      text: "With no new signal, nothing else is added. Each part is another system to patch, monitor and reason about during an outage, and another way for data to be stale or lost.",
      focus: ["lb", ...webs, "cache", "db", "replicas"],
      metrics: { signal: "no new signal" },
      changes: ["~ 8 parts to patch and monitor", "~ More ways for data to go stale"],
      events: [
        { type: "state", nodes: ["lb", ...webs, "db"], detail: "patch · monitor" },
        { type: "state", nodes: ["cache", "replicas"], detail: "can be stale", gap: 700 },
      ],
    },
    {
      title: "Match the remedy to the symptom",
      short: "Match symptom",
      text: "If reads are slow, inspect query and cache behavior. If writes overload the primary, read replicas alone won’t fix it. Observe, choose one bottleneck, and test the change.",
      focus: ["lb", ...webs, "cache", "db", "replicas"],
      events: [
        { type: "state", node: "lb", detail: "web redundancy" },
        { type: "state", nodes: webs, detail: "stateless", with: true },
        { type: "state", node: "db", detail: "takes every write", with: true },
      ],
      control: {
        label: "Symptom",
        // Option events play on top of each other and notes don't clear between them, so each option labels parts through their detail and readout, and clears the other's.
        options: [
          {
            label: "Slow reads",
            metrics: { signal: "slow reads" },
            events: [
              { type: "state", node: "cache", light: "work", detail: "inspect behavior" },
              { type: "state", node: "replicas", light: "on", detail: "inspect queries", readout: "slow reads", with: true },
              { type: "state", node: "db", light: "on", readout: "", meter: null, tone: "", with: true },
              {
                type: "stream", every: 220,
                routes: [...through("cache", "work").map((r) => ({ ...r, w: 2 })), ...through("replicas").map((r) => ({ ...r, w: 1 }))],
              },
            ],
          },
          {
            label: "Write overload",
            metrics: { signal: "write overload" },
            events: [
              { type: "state", node: "cache", detail: "repeated reads", readout: "" },
              { type: "state", node: "replicas", detail: "reads only", readout: "", with: true },
              { type: "state", node: "db", light: "hot", readout: "overloaded", meter: 1, tone: "hot", with: true },
              { type: "stream", every: 200, routes: through("db", "hot") },
            ],
          },
        ],
      },
    },
  ],
};
