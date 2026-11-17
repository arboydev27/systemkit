import type { StageScene } from "../../../lib/lesson-stage/types";

const pool = (ids: string[]) => ids.map((id) => ({ path: ["visitors", "lb", id] }));

// Lesson "Grow the web tier": one server, made bigger, then a balancer and a pool that loses a machine and is sized for it.
export const scaleWebStage: StageScene = {
  id: "scale-web",
  intro: "Watch one server get bigger, then get help, then lose a machine.",
  metrics: [{ id: "peak", label: "Peak load" }, { id: "servers", label: "Healthy servers" }, { id: "each", label: "Per server" }],
  nodes: [
    { id: "visitors", role: "crowd", label: "Visitors", detail: "browsers", at: [0, 0] },
    { id: "lb", role: "balancer", label: "Load balancer", detail: "public address", at: [0.95, 0], appear: 2 },
    { id: "a", role: "web", label: "Web server", detail: "one machine", at: [1, 0] },
    { id: "b", role: "web", label: "Web B", at: [2.3, 0], appear: 2 },
    { id: "c", role: "web", label: "Web C", at: [2.3, 1], appear: 2 },
    { id: "d", role: "web", label: "Web D", at: [2.3, 1.5], appear: 5 },
  ],
  links: [
    { from: "visitors", to: "a", unless: "lb" },
    { from: "visitors", to: "lb" },
    { from: "lb", to: "a" },
    { from: "lb", to: "b" },
    { from: "lb", to: "c" },
    { from: "lb", to: "d" },
  ],
  steps: [
    {
      title: "One server takes every request",
      short: "One server",
      text: "Every visitor reaches the same web server. At modest load, that’s simple.",
      metrics: { peak: "modest", servers: { n: 1, unit: " / 1" }, each: "all requests" },
      changes: ["+ One web server"],
      events: [
        { type: "stream", every: 280, routes: [{ path: ["visitors", "a"] }] },
        { type: "state", node: "a", light: "on" },
      ],
    },
    {
      title: "Scale up: a bigger machine",
      short: "Scale up",
      text: "Vertical scaling adds CPU or memory to one server, with no code changes. But hardware has limits, the upgrade often means a restart, and the one server can still fail. For a small internal tool, that may still be the better trade.",
      changes: ["~ More CPU and memory", "− A restart to upgrade", "− Still one server to fail"],
      events: [
        { type: "note", node: "a", text: "upgrade · restart" },
        { type: "state", node: "a", down: true, light: "idle" },
        { type: "packet", path: ["visitors", "a"], label: "GET /", kind: "hot", lost: true },
        { type: "state", node: "a", down: false, light: "on", opts: { big: true }, detail: "more CPU, memory" },
        { type: "stream", every: 280, routes: [{ path: ["visitors", "a"] }] },
      ],
    },
    {
      title: "Scale out: a balancer and a pool",
      short: "Scale out",
      text: "As the peak grows to 900 requests a second, horizontal scaling adds servers of the same size to a pool instead of growing one machine. A load balancer takes public traffic and routes each request to a healthy server, usually on a private address. If each handles 300 requests a second, three are exactly enough.",
      metrics: { peak: { n: 900, unit: " req/s" }, servers: { n: 3, unit: " / 3" }, each: { n: 300, unit: " req/s" } },
      changes: ["~ Peak grows to 900 req/s", "+ Load balancer, Web B and Web C", "~ Web A, standard size like B and C"],
      events: [
        { type: "state", node: "a", opts: { big: false }, label: "Web A", detail: "" },
        // A slides into the pool still linked to the visitors; the balancer then takes its place between them.
        { type: "move", at: { a: [2.3, -1] } },
        { type: "show", nodes: ["lb", "b", "c"], at: { b: [2.3, 0], c: [2.3, 1] } },
        { type: "state", node: "lb", light: "on" },
        { type: "state", nodes: ["a", "b", "c"], light: "on", readout: "300 req/s", meter: 1 },
        { type: "stream", every: 220, routes: pool(["a", "b", "c"]) },
      ],
    },
    {
      title: "Health checks remove a dead server",
      short: "Health checks",
      text: "Web C dies. The balancer requests /healthz every 5 seconds and drops a server after two failures, so C still gets requests for about 10 seconds and clients need sensible retries.",
      metrics: { servers: { n: 2, unit: " / 3", tone: "hot" }, each: "—" },
      changes: ["− Web C fails two checks", "~ About 10 s of requests still sent to C"],
      events: [
        { type: "state", node: "c", down: true, light: "idle", readout: "", meter: null },
        // The 300 req/s pills no longer hold once C is gone; step 5 brings them back at 450.
        { type: "state", nodes: ["a", "b"], readout: "", meter: null, with: true },
        { type: "stream", every: 220, routes: [...pool(["a", "b"]), { path: ["visitors", "lb", "c"], kind: "hot" }] },
        { type: "packet", path: ["visitors", "lb", "c"], label: "GET /", kind: "hot", lost: true },
        { type: "packet", path: ["visitors", "lb", "a"], label: "retry GET /" },
        // First round: every server is checked, one at a time so no two labels share a hop.
        { type: "packet", path: ["lb", "a"], label: "GET /healthz" },
        { type: "packet", path: ["lb", "b"], label: "GET /healthz", gap: 150 },
        { type: "packet", path: ["lb", "c"], label: "GET /healthz", kind: "hot", lost: true, gap: 150 },
        { type: "packet", path: ["a", "lb"], label: "200 OK", kind: "response", gap: 150 },
        { type: "packet", path: ["b", "lb"], label: "200 OK", kind: "response", gap: 150 },
        // Second round, 5 seconds later: C fails again and is taken out.
        { type: "packet", path: ["lb", "a"], label: "GET /healthz", gap: 900 },
        { type: "packet", path: ["lb", "b"], label: "GET /healthz", gap: 150 },
        { type: "packet", path: ["lb", "c"], label: "GET /healthz", kind: "hot", lost: true, gap: 150 },
        { type: "packet", path: ["a", "lb"], label: "200 OK", kind: "response", gap: 150 },
        { type: "packet", path: ["b", "lb"], label: "200 OK", kind: "response", gap: 150 },
        { type: "note", node: "lb", text: "2 failures · C removed", tone: "hot" },
        { type: "stream", every: 220, routes: pool(["a", "b"]), with: true },
      ],
    },
    {
      title: "Two can’t carry the peak",
      short: "Overload",
      text: "A and B now take the whole 900 peak: 450 requests a second each, past the 300 each can handle. The balancer won’t start a replacement; it only routes to the servers it has.",
      focus: ["visitors", "lb", "a", "b"],
      metrics: { each: { n: 450, unit: " req/s", tone: "hot" } },
      changes: ["− A and B at 450 req/s, past 300", "~ The balancer doesn’t replace C"],
      events: [
        { type: "state", nodes: ["a", "b"], light: "hot", readout: "450 req/s", meter: 1, tone: "hot" },
        { type: "stream", every: 220, routes: pool(["a", "b"]).map((r) => ({ ...r, kind: "hot" as const })), with: true },
      ],
    },
    {
      title: "Size the pool for loss",
      short: "Size for loss",
      text: "With C back and D registered, four servers run at 225 each and rise to 300 after a failure. The balancer needs redundancy too.",
      changes: ["+ Web D, registered", "~ 225 req/s each, 300 after a loss"],
      events: [
        { type: "state", node: "c", down: false },
        { type: "show", nodes: ["d"], at: { a: [2.3, -1.5], b: [2.3, -0.5], c: [2.3, 0.5], d: [2.3, 1.5] } },
        { type: "note", node: "lb", text: "needs redundancy too" },
      ],
      control: {
        label: "Servers lost",
        options: [
          {
            label: "None",
            metrics: { servers: { n: 4, unit: " / 4" }, each: { n: 225, unit: " req/s" } },
            events: [
              { type: "state", nodes: ["a", "b", "c", "d"], down: false, light: "on", readout: "225 req/s", meter: 0.75, tone: "" },
              { type: "stream", every: 220, routes: pool(["a", "b", "c", "d"]) },
            ],
          },
          {
            label: "One",
            metrics: { servers: { n: 3, unit: " / 4" }, each: { n: 300, unit: " req/s" } },
            events: [
              { type: "state", node: "c", down: true, light: "idle", readout: "", meter: null, tone: "" },
              { type: "state", nodes: ["a", "b", "d"], down: false, light: "on", readout: "300 req/s", meter: 1, tone: "" },
              { type: "stream", every: 220, routes: pool(["a", "b", "d"]) },
            ],
          },
        ],
      },
    },
  ],
};
