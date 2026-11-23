import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Pay for every index on every write": customer 7's orders by a table scan, by a (customer_id, created_at) index and its row fetches, and by a covering index; then one insert changing the table and 6 indexes (14,000 page changes/s at 2,000 inserts/s), and 8,000 after dropping 3 unused.
export const seIndexesStage: StageScene = {
  id: "se-indexes",
  intro: "Watch the database engine find customer 7’s orders by a scan, then by an index, then count what six indexes cost every insert.",
  metrics: [{ id: "rows", label: "Rows read" }, { id: "changes", label: "Page changes" }],
  // The Database engine is the hub, as in the lesson's text: it reads and changes the Customer index (up and right),
  // whose keys lie to its right, and the Orders table (down and right), whose rows lie under it. An entry leads to its
  // row through the engine. The other indexes arrive with the inserts, up and left of the engine. On a laptop the parts
  // stand far enough apart that every cable leaves the engine from the back of its base and reaches a part from behind,
  // clear of every tag, and nothing floats over the engine. For the scan the engine stands up and left, so its one cable
  // to the table runs straight, and it steps into place as the index arrives. On a phone: the other indexes, the
  // engine, then the index and the table side by side over their strips (lanes ±0.75 are the most a phone's row of two
  // tags takes at full size), and the engine's step is a short slide along its row, so the camera holds still.
  nodes: [
    { id: "more", role: "index", label: "5 more indexes", detail: "other columns", at: [-0.8, -0.7], appear: 5 },
    { id: "engine", role: "worker", label: "Database engine", at: [0, -0.7] },
    { id: "index", role: "index", label: "Customer index", detail: "customer, created_at", at: [1.3, -0.75], appear: 1 },
    { id: "table", role: "database", label: "Orders table", detail: "rows in insert order", at: [1.3, 0.75] },
  ],
  links: [
    { from: "engine", to: "index" },
    { from: "engine", to: "table" },
    { from: "engine", to: "more" },
  ],
  logs: [
    {
      id: "rows", node: "table", label: "Rows", side: "below", records: [
        { text: "7 Mon" }, { text: "3 Tue" }, { text: "9 Tue" }, { text: "7 Wed" },
      ],
    },
    {
      id: "keys", node: "index", label: "Keys", sorted: true, records: [
        { text: "3 Tue", key: "3-2" }, { text: "7 Mon", key: "7-1" }, { text: "7 Wed", key: "7-3" }, { text: "9 Tue", key: "9-2" },
      ],
    },
  ],
  steps: [
    {
      title: "Without an index, every row is read",
      short: "Table scan",
      text: "A page asks for customer 7’s orders. The Orders table finds rows by primary key, not by customer, so the Database engine scans every row: 4 rows read to return 2. The scan grows with the table, however few rows match.",
      facts: [["Query", "customer_id = 7"], ["Read", "4 rows for 2 orders"]],
      changes: ["+ A scan of every row", "~ 2 rows match customer 7"],
      metrics: { rows: 4 },
      events: [
        { type: "packet", path: ["engine", "table"], label: "customer_id = 7" },
        { type: "read", log: "rows", at: 0 },
        { type: "read", log: "rows", at: 1, gap: 60 },
        { type: "read", log: "rows", at: 2, gap: 60 },
        { type: "read", log: "rows", at: 3, gap: 60 },
        { type: "record", log: "rows", at: 0, tone: "work" },
        { type: "record", log: "rows", at: 3, tone: "work", with: true },
        { type: "note", node: "table", text: "4 rows read, 2 match", tone: "work", with: true },
        { type: "packet", path: ["table", "engine"], label: "2 orders", kind: "response" },
      ],
    },
    {
      title: "A sorted index keeps one customer together",
      short: "Secondary index",
      text: "A secondary index is a separate sorted structure. The Customer index sorts its keys by customer_id, then date, so customer 7’s 2 entries sit side by side: the engine reads just those 2 entries, and no row yet.",
      focus: ["engine", "index"],
      frame: ["engine", "index", "table"],
      facts: [["Index on", "(customer_id, created_at)"], ["Entries read", "2"]],
      changes: ["+ Customer index, sorted", "+ 2 entries read for customer 7"],
      metrics: { rows: 0 },
      events: [
        // the engine steps into place as the index arrives with its keys, so both cables reach their parts from behind
        { type: "show", nodes: ["index"], at: { engine: [0, 0] } },
        { type: "record", log: "rows", at: 0, tone: "", gap: 0 },
        { type: "record", log: "rows", at: 3, tone: "", with: true },
        { type: "packet", path: ["engine", "index"], label: "customer_id = 7" },
        { type: "read", log: "keys", at: 1 },
        { type: "read", log: "keys", at: 2, gap: 60 },
        { type: "bracket", log: "keys", id: "c7", from: 1, to: 2, label: "customer 7" },
      ],
    },
    {
      title: "Each entry leads the engine to its row",
      short: "Row fetch",
      text: "Each entry points to its row, so the engine fetches customer 7’s 2 rows from the Orders table, one at each end. In Postgres an entry holds the row’s location; in InnoDB it holds the primary key, so each fetch walks a second tree.",
      frame: ["engine", "index", "table"],
      facts: [["Postgres", "entry → row’s location"], ["InnoDB", "entry → primary key"]],
      changes: ["+ 2 row fetches", "~ InnoDB: a second tree walk each"],
      metrics: { rows: 2 },
      events: [
        { type: "read", log: "keys", at: 1 },
        { type: "read", log: "keys", at: 2, with: true },
        { type: "packet", path: ["index", "engine"], label: "2 row pointers", kind: "response", with: true },
        { type: "packet", path: ["engine", "table"], label: "fetch 2 rows" },
        { type: "read", log: "rows", at: 0 },
        { type: "read", log: "rows", at: 3, with: true },
      ],
    },
    {
      title: "Column order decides which queries it serves",
      short: "Column order",
      text: "The keys sort by customer_id first, so the index serves one customer’s orders by date. One date’s orders sit apart, one per customer: Tuesday’s 2 entries lie at either end. So it doesn’t serve all customers’ orders on one date.",
      focus: ["index"],
      frame: ["engine", "index", "table"],
      facts: [["Serves", "one customer, by date"], ["Not", "one date, every customer"]],
      changes: ["~ Customer 7’s entries together", "~ Tuesday’s entries apart"],
      metrics: { rows: "—" },
      events: [
        { type: "read", log: "keys", at: 0 },
        { type: "read", log: "keys", at: 3, with: true },
        { type: "note", node: "index", text: "Tue entries apart", with: true },
      ],
    },
    {
      title: "A covering index answers without fetching",
      short: "Covering index",
      text: "The order page lists a customer’s 20 newest orders with totals. The Customer index now stores total too, so it answers alone: no row fetched, up to 20 fetches avoided. The price is a bigger index that changes whenever total does.",
      focus: ["engine", "index"],
      frame: ["engine", "index", "table"],
      facts: [["Page of 20", "up to 20 fetches saved"], ["Price", "bigger, changes with total"]],
      changes: ["+ total stored in each entry", "− 2 row fetches", "~ A bigger index"],
      metrics: { rows: 0 },
      events: [
        { type: "state", node: "index", detail: "also stores total" },
        { type: "note", node: "index", text: "0 row fetches", tone: "work", with: true },
        { type: "read", log: "keys", at: 2 },
        { type: "read", log: "keys", at: 1, gap: 60 },
        { type: "packet", path: ["index", "engine"], label: "2 orders + totals", kind: "response" },
      ],
    },
    {
      title: "An insert changes the table and every index",
      short: "Write cost",
      text: "Customer 7 orders again. The engine adds a row to the Orders table and an entry to each of 6 secondary indexes: 7 page changes, each logged. At 2,000 inserts a second, that is about 14,000 page changes a second.",
      frame: ["more", "engine", "index", "table"],
      facts: [["Inserts", "2,000/s"], ["Each insert", "1 row + 6 entries"]],
      changes: ["+ 5 more indexes", "+ 7 Thu: a row and 6 entries", "~ 14,000 page changes/s"],
      metrics: { rows: "—", changes: { n: 14000, unit: "/s" } },
      events: [
        { type: "bracket", log: "keys", id: "c7", remove: true },
        { type: "state", node: "engine", light: "work", detail: "7 pages per insert", with: true },
        // every insert's page changes, by where they land: the row, the Customer index's entry, the other 5 entries
        { type: "stream", every: 170, routes: [{ path: ["engine", "table"], kind: "work" }, { path: ["engine", "index"], kind: "work" }, { path: ["engine", "more"], w: 5, kind: "work" }], with: true },
        { type: "append", log: "rows", records: [{ text: "7 Thu" }], gap: 600 },
        { type: "append", log: "keys", records: [{ text: "7 Thu", key: "7-4" }], with: true },
        { type: "state", nodes: ["table", "index", "more"], light: "work", with: true },
      ],
    },
    {
      title: "Dropping 3 unused indexes cuts it to 8,000",
      short: "Drop unused",
      text: "Usage counts in pg_stat_user_indexes show 3 indexes nothing scans, so they go: each insert now changes 4 pages, about 8,000 a second. Index for queries you have measured, and skip indexes on tiny tables and for queries that read most rows anyway.",
      frame: ["more", "engine", "index", "table"],
      facts: [["Usage", "pg_stat_user_indexes"], ["Each insert", "1 row + 3 entries"], ["Also costs", "disk space, memory"]],
      changes: ["− 3 unused indexes", "− 6,000 page changes/s"],
      metrics: { changes: { n: 8000, unit: "/s" } },
      events: [
        { type: "state", node: "more", label: "2 more indexes", detail: "3 unused dropped" },
        { type: "state", node: "engine", detail: "4 pages per insert", with: true },
        // the same inserts now change 4 pages each, not 7
        { type: "stream", every: 300, routes: [{ path: ["engine", "table"], kind: "work" }, { path: ["engine", "index"], kind: "work" }, { path: ["engine", "more"], w: 2, kind: "work" }], with: true },
      ],
    },
  ],
};
