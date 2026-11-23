import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Partition a growing database": one database outgrows its machine, the rows split by user_id % 3,
// one user routed by the key, hot spots, the cost of going to four shards, and Finance’s report that has to ask every shard.
// The data tier stands at 2.2, not 2, so on a short phone the database's and shards' load pills clear the web server's name; from
// step 5 the four shards sit at 2.1, far enough out for the link to Shard 0 to clear its name on a wide screen, close enough for their
// names to fit side by side on a phone. Finance takes the users' place for its report (two clients side by side ran Finance's link
// behind the web server's name on a wide screen).
export const shardingStage: StageScene = {
  id: "sharding",
  intro: "Watch one database split into shards by user ID, then meet hot spots and resharding.",
  metrics: [{ id: "shards", label: "Shards" }, { id: "queried", label: "Shards per query" }, { id: "moved", label: "Users moved" }],
  nodes: [
    { id: "users", role: "crowd", label: "Users", detail: "each has a user_id", at: [0, 0] },
    { id: "finance", role: "client", label: "Finance", detail: "daily report", at: [0, 0], appear: 5 },
    { id: "app", role: "web", label: "Web server", detail: "runs the app", at: [1, 0] },
    { id: "db", role: "database", label: "Database", detail: "every user", at: [2.2, 0] },
    { id: "s0", role: "database", label: "Shard 0", at: [2.2, -1.4], appear: 1 },
    { id: "s1", role: "database", label: "Shard 1", at: [2.2, 0], appear: 1 },
    { id: "s2", role: "database", label: "Shard 2", at: [2.2, 1.4], appear: 1 },
    { id: "s3", role: "database", label: "Shard 3", at: [2.1, 1.8], appear: 4 },
  ],
  links: [
    { from: "users", to: "app" },
    { from: "finance", to: "app" },
    { from: "app", to: "db" },
    { from: "app", to: "s0" },
    { from: "app", to: "s1" },
    { from: "app", to: "s2" },
    { from: "app", to: "s3" },
  ],
  steps: [
    {
      title: "One database holds every user",
      short: "One database",
      text: "Every user’s rows live on one database. Sharding is for when that one machine can no longer reasonably hold or handle the workload.",
      metrics: { shards: 1, queried: 1, moved: 0 },
      changes: ["+ One database for every user", "~ The workload outgrows it"],
      events: [
        { type: "stream", every: 260, routes: [{ path: ["users", "app", "db"] }] },
        { type: "state", nodes: ["app", "db"], light: "on" },
        { type: "state", node: "db", meter: 0.6, readout: "filling" },
        { type: "pause", ms: 900 },
        { type: "state", node: "db", light: "hot", meter: 1, readout: "at its limit", tone: "hot" },
      ],
    },
    {
      title: "Split the rows by a key",
      short: "Split by key",
      text: "Replication makes copies; sharding gives different servers different slices of the data. A sharding key decides which slice holds a record. Here the rule is user_id % 3, across three shards.",
      focus: ["app", "s0", "s1", "s2"],
      frame: ["users", "app", "s0", "s1", "s2"],
      metrics: { shards: 3 },
      changes: ["+ Shards 0, 1 and 2", "~ No longer one database for everyone", "~ Rule: user_id % 3"],
      events: [
        { type: "hide", nodes: ["db"] },
        { type: "show", nodes: ["s0", "s1", "s2"], with: true },
        { type: "state", nodes: ["s0", "s1", "s2"], opts: { level: 0.4 } },
        { type: "state", node: "app", light: "idle", detail: "shard = user_id % 3" },
      ],
    },
    {
      title: "Route each query by its key",
      short: "Route",
      text: "Every operation must know the user ID to reach the right shard. For user 7, 7 % 3 leaves 1, so the query goes to shard 1 and nowhere else.",
      focus: ["users", "app", "s1"],
      metrics: { queried: 1 },
      changes: ["+ User 7 → shard 1", "~ Shards 0 and 2 not asked"],
      events: [
        { type: "packet", path: ["users", "app"], label: "GET /users/7" },
        { type: "state", node: "app", light: "on" },
        { type: "note", node: "app", text: "7 % 3 = 1" },
        { type: "packet", path: ["app", "s1"], label: "SELECT … user 7" },
        { type: "state", node: "s1", light: "on" },
        { type: "packet", path: ["s1", "app"], label: "rows", kind: "response" },
        { type: "packet", path: ["app", "users"], label: "200 OK", kind: "response" },
        { type: "state", node: "s1", light: "work", with: true },
      ],
    },
    {
      title: "Spread traffic, not only data",
      short: "Hot spots",
      text: "A key should spread both data and traffic. A celebrity or other hot key can overload one shard even when the data is balanced, and uneven growth can exhaust one. Fixes may move data or split a hot partition.",
      changes: ["~ A hot key overloads one shard", "~ Uneven growth fills one shard"],
      events: [
        { type: "state", nodes: ["app", "s0", "s1", "s2"], light: "on" },
      ],
      control: {
        label: "Keys",
        options: [
          {
            label: "Hot key",
            events: [
              { type: "state", nodes: ["s0", "s1"], light: "on", meter: null, readout: "", tone: "", opts: { level: 0.4 } },
              { type: "state", node: "s2", light: "hot", meter: null, readout: "hot key", tone: "hot", opts: { level: 0.4 } },
              { type: "stream", every: 220, routes: [{ path: ["users", "app", "s2"], w: 6, kind: "hot" }, { path: ["users", "app", "s0"], w: 1 }, { path: ["users", "app", "s1"], w: 1 }] },
            ],
          },
          {
            label: "Uneven growth",
            events: [
              { type: "state", nodes: ["s1", "s2"], light: "on", meter: null, readout: "", tone: "", opts: { level: 0.3 } },
              { type: "state", node: "s0", light: "hot", meter: 1, readout: "full", tone: "hot" },
              { type: "stream", every: 260, routes: [{ path: ["users", "app", "s0"] }, { path: ["users", "app", "s1"] }, { path: ["users", "app", "s2"] }] },
            ],
          },
          {
            label: "Even",
            events: [
              { type: "state", nodes: ["s0", "s1", "s2"], light: "work", meter: null, readout: "", tone: "", opts: { level: 0.4 } },
              { type: "stream", every: 260, routes: [{ path: ["users", "app", "s0"] }, { path: ["users", "app", "s1"] }, { path: ["users", "app", "s2"] }] },
            ],
          },
        ],
      },
    },
    {
      title: "A fourth shard moves most users",
      short: "Reshard",
      text: "Going from three shards to four under a modulo rule moves about three quarters of all users, since user_id % 3 and user_id % 4 agree for only a quarter of IDs. User 7 moves from shard 1 to shard 3. Consistent hashing and fixed logical shards mapped onto machines exist largely to reduce that movement.",
      metrics: { shards: 4, moved: "about ¾" },
      changes: ["+ Shard 3", "~ Rule: user_id % 3 → % 4", "~ About ¾ of users move"],
      events: [
        { type: "state", nodes: ["s0", "s1", "s2"], light: "idle", meter: null, readout: "", tone: "", opts: { level: 0.4 } },
        { type: "show", nodes: ["s3"], at: { s0: [2.1, -1.8], s1: [2.1, -0.6], s2: [2.1, 0.6], s3: [2.1, 1.8] }, with: true },
        { type: "state", node: "app", detail: "shard = user_id % 4", with: true },
        { type: "state", node: "s3", detail: "7 % 4 = 3" },
        { type: "packet", path: ["s1", "app", "s3"], label: "user 7’s rows", kind: "work" },
        { type: "state", nodes: ["s0", "s1", "s2", "s3"], light: "on", opts: { level: 0.3 } },
        { type: "stream", every: 240, routes: [
          { path: ["s0", "app", "s1"], kind: "work" }, { path: ["s1", "app", "s3"], kind: "work" }, { path: ["s2", "app", "s0"], kind: "work" },
          { path: ["s0", "app", "s3"], kind: "work" }, { path: ["s1", "app", "s2"], kind: "work" }, { path: ["s2", "app", "s3"], kind: "work" },
        ] },
      ],
    },
    {
      title: "Some queries must ask every shard",
      short: "Cross-shard",
      text: "No single shard sees all the data, so cross-shard joins and transactions get harder. A report across all users has no one user ID, so it asks every shard and merges the answers.",
      metrics: { queried: 4 },
      changes: ["+ Finance asks for a report", "+ Fan out to all 4 shards", "~ Merge the results"],
      events: [
        { type: "state", nodes: ["s0", "s1", "s2", "s3"], light: "idle", detail: "" },
        { type: "hide", nodes: ["users"], with: true },
        { type: "show", nodes: ["finance"], with: true },
        { type: "packet", path: ["finance", "app"], label: "report: all users" },
        { type: "state", node: "app", light: "on" },
        // Four messages leave the web server together, so only one carries a label; it goes last so it draws on top of the bare ones.
        { type: "packet", path: ["app", "s1"], label: "" },
        { type: "packet", path: ["app", "s2"], label: "", with: true },
        { type: "packet", path: ["app", "s3"], label: "", with: true },
        { type: "packet", path: ["app", "s0"], label: "SELECT …", with: true },
        { type: "state", nodes: ["s0", "s1", "s2", "s3"], light: "on" },
        { type: "packet", path: ["s1", "app"], label: "", kind: "response" },
        { type: "packet", path: ["s2", "app"], label: "", kind: "response", with: true },
        { type: "packet", path: ["s3", "app"], label: "", kind: "response", with: true },
        { type: "packet", path: ["s0", "app"], label: "part", kind: "response", with: true },
        { type: "state", node: "app", light: "work", detail: "merges 4 answers" },
        { type: "packet", path: ["app", "finance"], label: "report", kind: "response" },
      ],
    },
    {
      title: "Shard as a late step",
      short: "Shard last",
      text: "Sharding adds routing, rebalancing, hotspot and query complexity. Choose a key for access patterns as well as even data. Before sharding, try indexes, read replicas, caching, a larger machine and archiving old rows.",
      metrics: { queried: 1 },
      changes: ["~ A key that fits the access pattern", "~ Sharding comes last, after simpler fixes"],
      events: [
        { type: "hide", nodes: ["finance"] },
        { type: "show", nodes: ["users"], with: true },
        { type: "state", node: "app", light: "on", detail: "shard = user_id % 4" },
        { type: "state", nodes: ["s0", "s1", "s2", "s3"], light: "work", with: true },
        { type: "stream", every: 240, routes: [
          { path: ["users", "app", "s0"] }, { path: ["users", "app", "s1"] }, { path: ["users", "app", "s2"] }, { path: ["users", "app", "s3"] },
        ] },
      ],
    },
  ],
};
