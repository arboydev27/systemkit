import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Separate web and data": one machine runs both jobs, they compete, the database moves out, every query now pays for the network between them, each tier grows on its own, and the queries decide what kind of store it is.
export const splitTiersStage: StageScene = {
  id: "split-tiers",
  intro: "Watch the database move to its own machine, see what that buys and costs, then choose its type.",
  metrics: [{ id: "machines", label: "Machines" }, { id: "queries", label: "Queries per page" }, { id: "network", label: "Network time" }],
  nodes: [
    { id: "visitor", role: "client", label: "Visitor", detail: "browser", at: [0, 0] },
    { id: "web", role: "web", label: "Server", detail: "app + database", at: [1, 0] },
    { id: "db", role: "database", label: "Database", detail: "data tier", at: [2, 0], appear: 2 },
  ],
  links: [{ from: "visitor", to: "web" }, { from: "web", to: "db" }],
  steps: [
    {
      title: "One machine runs both jobs",
      short: "One machine",
      text: "At first, the application code and its database share one machine. A visitor asks for a page, and every query the page needs stays on that machine.",
      metrics: { machines: 1, network: { n: 0, unit: " ms" } },
      changes: ["+ App and database on one machine", "~ No network between code and data"],
      events: [
        { type: "packet", path: ["visitor", "web"], label: "GET /" },
        { type: "state", node: "web", light: "on" },
        { type: "note", node: "web", text: "queries stay local", tone: "work" },
        { type: "state", node: "web", light: "work" },
        { type: "packet", path: ["web", "visitor"], label: "200 OK", kind: "response" },
      ],
    },
    {
      title: "The two jobs compete",
      short: "Jobs compete",
      text: "As demand grows, both jobs fight over the same machine. A slow report can starve page rendering of CPU, while the application’s memory use squeezes the database’s cache.",
      changes: ["~ Slow report starves pages of CPU", "~ App memory squeezes the DB cache"],
      events: [
        { type: "state", node: "web", light: "hot", readout: "slow report", tone: "hot" },
        { type: "packet", path: ["visitor", "web"], label: "GET /" },
        { type: "note", node: "web", text: "page waits for CPU", tone: "hot" },
        { type: "state", node: "web", readout: "CPU + memory contested", tone: "hot" },
      ],
    },
    {
      title: "Give the database its own machine",
      short: "Split tiers",
      text: "Move the database to its own machine. A tier is a group of machines doing one job, so there is now a web tier and a data tier, and they stop competing for CPU and memory.",
      metrics: { machines: 2, network: "—" },
      changes: ["+ Database on its own machine", "+ A web tier and a data tier", "~ CPU and memory no longer shared"],
      events: [
        { type: "state", node: "web", light: "idle", readout: "", tone: "", label: "Web server", detail: "web tier" },
        { type: "show", nodes: ["db"] },
        { type: "state", nodes: ["web", "db"], light: "work" },
        { type: "note", node: "web", text: "CPU free for pages", tone: "work" },
        { type: "note", node: "db", text: "memory for its cache", tone: "work", with: true },
      ],
    },
    {
      title: "Every query crosses the network",
      short: "Network hop",
      text: "Each query now travels between machines. A round trip inside one data center is very roughly 0.5 ms, so a page that makes 20 queries gains about 10 ms, and one with 500 accidental queries gains 250 ms.",
      focus: ["web", "db"],
      changes: ["+ One network round trip per query", "~ Page time grows with query count"],
      events: [],
      control: {
        label: "Queries per page",
        options: [
          {
            label: "20",
            metrics: { queries: 20, network: { n: 10, unit: " ms" } },
            events: [
              { type: "state", node: "web", readout: "20 queries/page", tone: "" },
              { type: "packet", path: ["web", "db"], label: "SELECT …" },
              { type: "packet", path: ["db", "web"], label: "rows", kind: "response" },
              { type: "note", node: "db", text: "≈0.5 ms per round trip" },
              { type: "stream", every: 300, routes: [{ path: ["web", "db"] }, { path: ["db", "web"], kind: "response" }] },
            ],
          },
          {
            label: "500",
            metrics: { queries: 500, network: { n: 250, unit: " ms" } },
            events: [
              { type: "state", node: "web", readout: "500 queries/page", tone: "" },
              { type: "packet", path: ["web", "db"], label: "SELECT …" },
              { type: "packet", path: ["db", "web"], label: "rows", kind: "response" },
              { type: "note", node: "db", text: "≈0.5 ms per round trip" },
              { type: "stream", every: 110, routes: [{ path: ["web", "db"] }, { path: ["db", "web"], kind: "response" }] },
            ],
          },
        ],
      },
    },
    {
      title: "The link can fail on its own",
      short: "Link fails",
      text: "The network between the tiers can fail by itself, even with both machines healthy. There are also two machines to patch and secure; managed services such as Amazon RDS take over some of that work for a fee.",
      focus: ["web", "db"],
      changes: ["+ A network link that can fail", "+ Two machines to patch and secure"],
      events: [
        { type: "state", node: "web", readout: "", tone: "" },
        { type: "packet", path: ["web", "db"], label: "SELECT …" },
        { type: "packet", path: ["db", "web"], label: "rows", kind: "hot", lost: true },
        { type: "state", node: "web", readout: "no reply from DB", tone: "", detail: "web tier, healthy" },
        { type: "state", node: "db", detail: "data tier, healthy", with: true },
        { type: "note", node: "db", text: "patch + secure it too" },
      ],
    },
    {
      title: "Each tier scales on its own",
      short: "Scale apart",
      text: "Web traffic can now grow without forcing a database upgrade, and database capacity can change without resizing the web tier. Each tier scales for its own workload.",
      changes: ["~ Traffic grows: only the web tier grows", "~ Data grows: only the data tier grows"],
      events: [
        { type: "state", node: "web", readout: "", tone: "", light: "work" },
        { type: "state", node: "db", light: "work", with: true },
      ],
      control: {
        label: "What grows",
        options: [
          {
            label: "Traffic",
            events: [
              { type: "state", node: "visitor", label: "Visitors", detail: "traffic grows", opts: { many: true } },
              { type: "state", node: "db", detail: "data tier, unchanged", opts: { big: false }, with: true },
              {
                type: "stream", every: 240, routes: [
                  { path: ["visitor", "web"], w: 2 }, { path: ["web", "db"], w: 1 },
                  { path: ["db", "web"], w: 1, kind: "response" }, { path: ["web", "visitor"], w: 2, kind: "response" },
                ],
              },
              { type: "state", node: "web", detail: "web tier, larger", opts: { big: true } },
              { type: "note", node: "web", text: "grows with traffic", tone: "work" },
            ],
          },
          {
            label: "Data",
            events: [
              { type: "state", node: "visitor", label: "Visitor", detail: "browser", opts: { many: false } },
              { type: "state", node: "web", detail: "web tier, unchanged", opts: { big: false }, with: true },
              {
                type: "stream", every: 320, routes: [
                  { path: ["visitor", "web"] }, { path: ["web", "db"] },
                  { path: ["db", "web"], kind: "response" }, { path: ["web", "visitor"], kind: "response" },
                ],
              },
              { type: "state", node: "db", detail: "data tier, larger", opts: { big: true } },
              { type: "note", node: "db", text: "grows with stored data", tone: "work" },
            ],
          },
        ],
      },
    },
    {
      title: "Choose the store from the queries",
      short: "Pick a store",
      text: "A relational database such as Postgres or MySQL is a practical default when records relate and queries need joins. Cassandra is built for very high write volumes read by a known key, but has no joins. Real queries decide, not scale alone.",
      focus: ["web", "db"],
      changes: ["~ Related records and joins: relational", "~ Writes read by a known key: Cassandra"],
      events: [{ type: "state", node: "web", detail: "web tier" }],
      control: {
        label: "Data shape",
        options: [
          {
            label: "Related records",
            events: [
              { type: "state", node: "db", label: "Postgres", detail: "relational, joins" },
              { type: "packet", path: ["web", "db"], label: "SELECT … JOIN …" },
              { type: "packet", path: ["db", "web"], label: "rows", kind: "response" },
              { type: "stream", every: 300, routes: [{ path: ["web", "db"] }, { path: ["db", "web"], kind: "response" }] },
            ],
          },
          {
            label: "Readings by key",
            events: [
              { type: "state", node: "db", label: "Cassandra", detail: "by key, no joins" },
              { type: "packet", path: ["web", "db"], label: "INSERT reading" },
              { type: "stream", every: 150, routes: [{ path: ["web", "db"] }] },
              { type: "packet", path: ["web", "db"], label: "SELECT … by device ID" },
              { type: "packet", path: ["db", "web"], label: "rows", kind: "response" },
            ],
          },
        ],
      },
    },
  ],
};
