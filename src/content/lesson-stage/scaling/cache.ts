import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Cache repeated work": one read the slow way, the same read from memory, then the hit rate at scale.
export const cacheStage: StageScene = {
  id: "cache",
  intro: "Watch one product page get answered twice: once the slow way, then from memory.",
  metrics: [{ id: "reads", label: "Reads" }, { id: "hits", label: "Cache hits" }, { id: "queries", label: "Database queries" }],
  nodes: [
    { id: "visitor", role: "client", label: "Visitor", detail: "browser", at: [0, 0] },
    { id: "web", role: "web", label: "Web server", detail: "runs the app", at: [1, 0] },
    { id: "cache", role: "cache", label: "Cache", detail: "in memory", at: [2, -1] },
    { id: "db", role: "database", label: "Database", detail: "source of truth", at: [2, 1] },
  ],
  links: [{ from: "visitor", to: "web" }, { from: "web", to: "cache" }, { from: "web", to: "db" }],
  steps: [
    {
      title: "A request arrives",
      short: "Request",
      text: "A visitor asks for a product page. The web server needs that product’s details before it can answer.",
      metrics: { reads: 1, hits: 0, queries: 0 },
      changes: ["+ GET /product/42"],
      events: [
        { type: "packet", path: ["visitor", "web"], label: "GET /product/42" },
        { type: "state", node: "web", light: "on" },
      ],
    },
    {
      title: "Check the cache first",
      short: "Check cache",
      text: "In the cache-aside pattern, the application looks in the cache before the database. This result isn’t stored yet, so the lookup is a miss.",
      focus: ["web", "cache"],
      frame: ["visitor", "web", "cache", "db"],
      changes: ["~ Cache lookup: miss"],
      events: [
        { type: "packet", path: ["web", "cache"], label: "GET product:42" },
        { type: "note", node: "cache", text: "miss" },
        { type: "packet", path: ["cache", "web"], label: "miss", kind: "quiet" },
      ],
    },
    {
      title: "Read from the database",
      short: "Read database",
      text: "On a miss, the application reads from the database, which still holds the source of truth.",
      focus: ["web", "db"],
      frame: ["visitor", "web", "cache", "db"],
      metrics: { queries: 1 },
      changes: ["+ 1 database query"],
      events: [
        { type: "packet", path: ["web", "db"], label: "SELECT … id = 42" },
        { type: "state", node: "db", light: "on" },
        { type: "packet", path: ["db", "web"], label: "row", kind: "response" },
        // The database rests once it has answered, here where it's in focus, not at the start of the next step.
        { type: "state", node: "db", light: "idle" },
      ],
    },
    {
      title: "Store it, then answer",
      short: "Store",
      text: "The application stores the result in the cache with an expiration time, then returns the page.",
      focus: ["visitor", "web", "cache"],
      frame: ["visitor", "web", "cache", "db"],
      changes: ["+ product:42 in the cache, with a TTL"],
      events: [
        { type: "packet", path: ["web", "cache"], label: "SET product:42" },
        { type: "note", node: "cache", text: "stored · TTL set", tone: "work" },
        { type: "state", node: "cache", light: "work" },
        { type: "packet", path: ["web", "visitor"], label: "200 OK", kind: "response" },
      ],
    },
    {
      title: "The next request hits",
      short: "Hit",
      text: "Another visitor asks for the same page. The cache returns the stored result, and the database isn’t queried at all.",
      focus: ["visitor", "web", "cache"],
      frame: ["visitor", "web", "cache", "db"],
      metrics: { reads: 2, hits: 1 },
      changes: ["+ Cache hit", "~ Database not queried"],
      events: [
        { type: "packet", path: ["visitor", "web"], label: "GET /product/42" },
        { type: "packet", path: ["web", "cache"], label: "GET product:42" },
        { type: "note", node: "cache", text: "hit", tone: "work" },
        { type: "packet", path: ["cache", "web"], label: "hit", kind: "response" },
        { type: "packet", path: ["web", "visitor"], label: "200 OK", kind: "response" },
        { type: "note", node: "db", text: "not queried", with: true },
      ],
    },
    {
      title: "Hit rate protects the database",
      short: "Hit rate",
      text: "At 10,000 reads a second, a 95% hit rate leaves the database 500 queries a second. At 90% it sees 1,000. If the cache fails, all 10,000 arrive at once.",
      events: [],
      control: {
        label: "Hit rate",
        options: [
          {
            label: "95%",
            metrics: { reads: { n: 10000, unit: "/s" }, hits: { n: 95, unit: "%" }, queries: { n: 500, unit: "/s" } },
            events: [
              { type: "state", node: "cache", light: "work", down: false },
              { type: "state", node: "db", light: "on", readout: "500 queries/s", meter: 0.05, tone: "" },
              { type: "stream", every: 170, routes: [{ path: ["visitor", "web", "cache"], w: 19, kind: "work" }, { path: ["visitor", "web", "db"], w: 1 }] },
            ],
          },
          {
            label: "90%",
            metrics: { reads: { n: 10000, unit: "/s" }, hits: { n: 90, unit: "%" }, queries: { n: 1000, unit: "/s" } },
            events: [
              { type: "state", node: "cache", light: "work", down: false },
              { type: "state", node: "db", light: "on", readout: "1,000 queries/s", meter: 0.1, tone: "" },
              { type: "stream", every: 170, routes: [{ path: ["visitor", "web", "cache"], w: 9, kind: "work" }, { path: ["visitor", "web", "db"], w: 1 }] },
            ],
          },
          {
            label: "Cache down",
            metrics: { reads: { n: 10000, unit: "/s" }, hits: { n: 0, unit: "%", tone: "hot" }, queries: { n: 10000, unit: "/s", tone: "hot" } },
            events: [
              { type: "state", node: "cache", down: true },
              { type: "state", node: "db", light: "hot", readout: "10,000 queries/s", meter: 1, tone: "hot" },
              { type: "stream", every: 170, routes: [{ path: ["visitor", "web", "db"], kind: "hot" }] },
            ],
          },
        ],
      },
    },
  ],
};
