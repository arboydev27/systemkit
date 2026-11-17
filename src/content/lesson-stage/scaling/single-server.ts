import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Begin with one server": DNS finds the address, HTTP carries the request, one machine does everything, and its loss stops the site.
export const singleServerStage: StageScene = {
  id: "single-server",
  intro: "Watch one request go from a domain name to a single server that runs everything.",
  metrics: [{ id: "users", label: "Users" }, { id: "served", label: "Requests served" }, { id: "up", label: "Servers up" }],
  nodes: [
    { id: "visitor", role: "client", label: "Visitor", detail: "browser", at: [0, 0] },
    { id: "dns", role: "dns", label: "DNS", detail: "domain → IP", at: [1, 0.8] },
    { id: "server", role: "web", label: "Server", detail: "app, DB, cache", at: [1, -0.8], opts: { big: true } },
  ],
  links: [{ from: "visitor", to: "dns" }, { from: "visitor", to: "server" }],
  steps: [
    {
      title: "Look up the name",
      short: "DNS lookup",
      text: "A visitor enters shop.example. DNS, the internet’s directory of names, resolves it to 203.0.113.10. The answer carries a time to live (TTL) of 300 seconds, which says how long it may be reused.",
      frame: ["visitor", "dns", "server"],
      focus: ["visitor", "dns"],
      metrics: { users: 1, served: 0, up: 1 },
      changes: ["+ shop.example → 203.0.113.10", "+ TTL 300 s"],
      events: [
        { type: "packet", path: ["visitor", "dns"], label: "shop.example?" },
        { type: "packet", path: ["dns", "visitor"], label: "203.0.113.10", kind: "response" },
        { type: "state", node: "dns", readout: "TTL 300 s" },
      ],
    },
    {
      title: "Send HTTP to that address",
      short: "HTTP request",
      text: "The browser connects to 203.0.113.10 and sends an HTTP request: GET /. DNS found the address; HTTP carries the request and its response.",
      frame: ["visitor", "dns", "server"],
      focus: ["visitor", "server"],
      changes: ["+ Connection to 203.0.113.10", "+ GET /"],
      events: [
        { type: "state", node: "dns", readout: "" },
        { type: "packet", path: ["visitor", "server"], label: "GET /" },
        { type: "state", node: "server", light: "on", readout: "203.0.113.10" },
      ],
    },
    {
      title: "One machine does all the work",
      short: "Local read",
      text: "The application reads a product list from the database on the same machine and sends back HTML. No network hop separates the code from its data, so the path stays short and easy to debug.",
      frame: ["visitor", "dns", "server"],
      focus: ["visitor", "server"],
      metrics: { served: 1 },
      changes: ["~ Database read on the same machine", "+ 200 OK with HTML"],
      events: [
        { type: "state", node: "server", light: "work", detail: "reads local DB" },
        { type: "packet", path: ["server", "visitor"], label: "200 OK · HTML", kind: "response" },
      ],
    },
    {
      title: "One server goes a long way",
      short: "Example load",
      text: "At an example 10,000 daily users making 20 requests each, the average is about 2.3 requests a second (200,000 ÷ 86,400), well within reach of one modest machine running Nginx and Postgres. More parts add operational work, so traffic alone isn’t a reason to deploy every scaling technique at once: first find the part that fails or slows down.",
      frame: ["visitor", "dns", "server"],
      focus: ["visitor", "server"],
      metrics: { users: { n: 10000, unit: "/day" }, served: "2.3/s" },
      changes: ["+ 10,000 users a day", "~ About 2.3 requests a second"],
      events: [
        { type: "state", node: "visitor", label: "Users", detail: "10,000 a day", opts: { many: true } },
        { type: "state", node: "server", light: "work", detail: "app, DB, cache", readout: "2.3 req/s", with: true },
        { type: "stream", every: 520, routes: [{ path: ["visitor", "server"], kind: "work" }] },
      ],
    },
    {
      title: "One machine, one point of failure",
      short: "Failure",
      text: "The cost is risk, not speed. This machine is a single point of failure: a crash or restart takes the site offline, and a dead disk can destroy the data unless backups live elsewhere. Move on once downtime becomes expensive or one resource runs out.",
      frame: ["visitor", "dns", "server"],
      focus: ["visitor", "server"],
      changes: ["− Server down", "− Site offline", "− Dead disk: data lost unless backups live elsewhere"],
      events: [],
      control: {
        label: "What fails",
        options: [
          {
            label: "Crash or restart",
            metrics: { served: { n: 0, unit: "/s", tone: "hot" }, up: { n: 0, tone: "hot" } },
            events: [
              { type: "state", node: "server", down: true, light: "hot", tone: "hot", detail: "down · site offline" },
              { type: "packet", path: ["visitor", "server"], label: "GET /", kind: "hot", lost: true },
            ],
          },
          {
            label: "Dead disk",
            metrics: { served: { n: 0, unit: "/s", tone: "hot" }, up: { n: 0, tone: "hot" } },
            events: [
              { type: "state", node: "server", down: true, light: "hot", tone: "hot", detail: "disk dead · data at risk" },
              { type: "packet", path: ["visitor", "server"], label: "GET /", kind: "hot", lost: true },
            ],
          },
        ],
      },
    },
  ],
};
