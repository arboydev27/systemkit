import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Store analytics by column": the App's small reads by key against a row store, then "revenue per region last
// quarter" (3 of 60 columns, nearly every one of 1 billion rows of 500 B) reading about 500 GB there and 24 GB in a
// column store; a region column of 30 values under one byte a row; one row spread over 60 column files, so new rows
// merge in batches; a warehouse's pipeline, delay and bill; and a read replica to start with.
export const seOlapStage: StageScene = {
  id: "se-olap",
  intro: "Watch one revenue report scan 1 billion rows in a row store, then in a column store, and weigh what a warehouse costs.",
  metrics: [
    { id: "rows", label: "Rows read" },
    { id: "cols", label: "Columns read" },
    { id: "data", label: "Data read" },
  ],
  // The App, the Database and the column store run left to right, with Reports between the two stores. The pipeline
  // arrives down the diagonal, low enough to keep its pill clear of the Reports and Warehouse tags, and copies from the
  // Database to the column store. The read replica arrives up the diagonal beside the Database and takes over the
  // Database's link to Reports. Steps 6 and 7 focus and frame everything but the App, so the wide camera keeps the
  // tags full size and apart, and a phone frames three rows at most; each option of step 7 shows only its own way of
  // reading (replica, or pipeline and warehouse), so the replica on the left and the pipeline on the right never share
  // a phone's width. The App, out of view since step 3, leaves as step 6 starts, so step 7's wide frame, pulled up-left
  // by the replica, never brings it back in cut at the edge.
  nodes: [
    { id: "app", role: "web", label: "App", detail: "small reads, writes", at: [0, 0] },
    { id: "db", role: "database", label: "Database", detail: "row store, 60 cols", at: [1, 0] },
    { id: "reports", role: "monitor", label: "Reports", detail: "revenue per region", at: [2, 0], appear: 1 },
    { id: "columns", role: "columns", label: "Column store", detail: "a file per column", at: [3, 0], appear: 2, opts: { count: 6 } },
    { id: "pipeline", role: "worker", label: "Pipeline", detail: "copies in batches", at: [2.2, 1.9], appear: 5 },
    { id: "replica", role: "database", label: "Read replica", detail: "row store copy", at: [1, -1.4], appear: 6, opts: { replica: true } },
  ],
  links: [
    { from: "app", to: "db" },
    { from: "db", to: "reports", unless: "replica" },
    { from: "reports", to: "columns" },
    { from: "db", to: "pipeline" },
    { from: "pipeline", to: "columns" },
    { from: "db", to: "replica" },
    { from: "replica", to: "reports" },
  ],
  steps: [
    {
      title: "OLTP: many small reads and writes by key",
      short: "OLTP by key",
      text: "The App does online transaction processing: many small reads and writes, each by key, at low latency. Fetching order 9001 reads one row from the Database, a row store that keeps all 60 of a row’s values together: 500 bytes.",
      facts: [["OLTP", "many small reads, writes"], ["Each", "by key, low latency"]],
      metrics: { rows: 1, cols: { n: 60, unit: " of 60" }, data: { n: 500, unit: " B" } },
      changes: ["+ Small reads and writes by key", "+ One row: 60 values, 500 B"],
      events: [
        { type: "packet", path: ["app", "db"], label: "GET order 9001" },
        { type: "state", node: "db", light: "on", readout: "by key, low latency" },
        { type: "packet", path: ["db", "app"], label: "1 row, 500 B", kind: "response" },
        { type: "stream", every: 260, routes: [{ path: ["app", "db"] }] },
      ],
    },
    {
      title: "A report scans every row for 3 columns",
      short: "Row scan",
      text: "Reports asks for revenue per region last quarter: online analytical processing. It needs 3 of the 60 columns, but nearly every one of 1 billion rows. The row store keeps each row’s values together, so the scan drags all 60 columns through memory: about 500 GB.",
      focus: ["reports", "db"],
      frame: ["app", "db", "reports"],
      facts: [["Query", "revenue per region"], ["Needs", "3 of 60 columns"], ["Rows", "1 billion × 500 B"]],
      metrics: { rows: { n: 1, unit: " billion" }, cols: { n: 60, unit: " of 60" }, data: { n: 500, unit: " GB", tone: "hot" } },
      changes: ["+ Reports: revenue per region", "~ Row store reads about 500 GB"],
      events: [
        { type: "state", node: "db", light: "idle", readout: "" },
        { type: "packet", path: ["reports", "db"], label: "revenue per region" },
        { type: "state", node: "db", light: "hot" },
        { type: "note", node: "db", text: "500 GB scan", tone: "hot", with: true },
        { type: "note", node: "reports", text: "needs 3 of 60 columns", with: true },
      ],
    },
    {
      title: "A column store reads only 3 columns",
      short: "Column store",
      text: "A column store keeps each column in its own files and reads only what the query names. Three columns of 8 bytes across 1 billion rows is 24 GB, against 500 GB for the row store. Snowflake, BigQuery, ClickHouse and Parquet store data by column.",
      focus: ["reports", "columns"],
      frame: ["db", "reports", "columns"],
      facts: [["Reads", "3 columns × 8 B"], ["Row store", "500 GB"], ["Column store", "24 GB"]],
      metrics: { cols: { n: 3, unit: " of 60" }, data: { n: 24, unit: " GB" } },
      changes: ["+ Column store", "~ Reads 3 columns: 24 GB"],
      events: [
        { type: "state", node: "db", light: "idle" },
        { type: "packet", path: ["reports", "columns"], label: "revenue per region" },
        { type: "state", node: "columns", light: "work", opts: { count: 6, items: 3 }, readout: "3 columns: 24 GB" },
      ],
    },
    {
      title: "Alike values compress to under a byte",
      short: "Compress columns",
      text: "Values in one column look alike, so they compress well. The region column holds just 30 distinct values, so dictionary codes store each row’s region in under one byte: under 1 GB instead of 8 GB. The scan drops below 17 GB, and sorted by region the region column shrinks far more.",
      focus: ["columns"],
      frame: ["reports", "columns"],
      facts: [["Region", "30 distinct values"], ["Dictionary codes", "under 1 B per row"], ["Sorted by region", "far less"]],
      metrics: { data: "< 17 GB" },
      changes: ["~ Region column: 8 GB → under 1 GB", "~ Scan under 17 GB"],
      events: [
        { type: "note", node: "columns", text: "region: 30 distinct values" },
        { type: "state", node: "columns", readout: "region: under 1 GB", gap: 600 },
      ],
    },
    {
      title: "One row is spread over 60 column files",
      short: "Single rows",
      text: "The cost falls on writes and single-row reads. When Reports drills into order 9001, the whole row means opening all 60 column files, and inserting a row writes to every one of them. So column stores buffer new rows and merge them in batches.",
      focus: ["reports", "columns"],
      frame: ["db", "reports", "columns"],
      facts: [["One row", "in 60 column files"], ["New rows", "buffered, merged in batches"]],
      metrics: { rows: 1, cols: { n: 60, unit: " files", tone: "hot" }, data: { n: 500, unit: " B" } },
      changes: ["~ One row reads all 60 column files", "+ New rows buffered, merged in batches"],
      events: [
        { type: "state", node: "columns", light: "on", opts: { count: 6, items: 0 }, readout: "" },
        { type: "packet", path: ["reports", "columns"], label: "drill into 9001" },
        { type: "state", node: "columns", light: "hot", opts: { count: 6, items: 6 }, readout: "60 files for 1 row", tone: "hot" },
      ],
    },
    {
      title: "A warehouse adds a pipeline and a delay",
      short: "Add a warehouse",
      text: "Run as a separate warehouse, the column store still answers Reports under 17 GB. But a Pipeline must copy new rows from the Database in batches, so the data is minutes or hours behind, with one more system to run and another bill.",
      focus: ["db", "reports", "pipeline", "columns"],
      frame: ["db", "reports", "pipeline", "columns"],
      facts: [["Pipeline", "one more to run"], ["Data", "minutes or hours behind"], ["Cost", "another bill"]],
      metrics: { rows: { n: 1, unit: " billion" }, cols: { n: 3, unit: " of 60" }, data: "< 17 GB" },
      changes: ["+ Pipeline", "~ Column store becomes the Warehouse", "+ Data minutes or hours behind"],
      events: [
        { type: "hide", nodes: ["app"] },
        { type: "state", node: "columns", label: "Warehouse", detail: "column store", light: "on", opts: { count: 6, items: 0 }, readout: "", tone: "" },
        { type: "packet", path: ["reports", "columns"], label: "revenue per region" },
        { type: "state", node: "columns", light: "work", opts: { count: 6, items: 3 }, readout: "3 columns: < 17 GB" },
        // new rows rest on the long Database–Pipeline cable; on a 375 phone the Pipeline–Warehouse one has no room
        { type: "packet", path: ["db", "pipeline"], label: "new rows", kind: "work" },
        { type: "state", node: "pipeline", light: "work", readout: "minutes–hours behind" },
      ],
    },
    {
      title: "Start with a read replica",
      short: "Replica first",
      text: "Start by pointing Reports at a read replica: no pipeline, but the same 500 GB row scan. Choose Warehouse to see when one earns its keep: data from several systems, long history production shouldn’t carry, or scans too slow for the replica.",
      focus: ["db", "replica", "reports", "pipeline", "columns"],
      frame: ["db", "replica", "reports", "pipeline", "columns"],
      facts: [["Start with", "a read replica"], ["Warehouse for", "many sources, long history"]],
      changes: ["+ Read replica", "~ Reports read the replica"],
      events: [
        { type: "state", node: "pipeline", light: "on", readout: "" },
        { type: "state", node: "columns", light: "on", opts: { count: 6, items: 0 }, readout: "", with: true },
        { type: "state", node: "replica", light: "on", with: true },
      ],
      control: {
        label: "Reports read from",
        options: [
          {
            label: "Read replica",
            metrics: { rows: { n: 1, unit: " billion" }, cols: { n: 60, unit: " of 60" }, data: { n: 500, unit: " GB" } },
            events: [
              { type: "hide", nodes: ["pipeline", "columns"] },
              { type: "packet", path: ["reports", "replica"], label: "revenue per region" },
              { type: "state", node: "replica", light: "work", readout: "500 GB row scan" },
              { type: "note", node: "replica", text: "start here", tone: "work", with: true },
            ],
          },
          {
            label: "Warehouse",
            metrics: { rows: { n: 1, unit: " billion" }, cols: { n: 3, unit: " of 60" }, data: "< 17 GB" },
            events: [
              { type: "hide", nodes: ["replica"] },
              { type: "state", node: "columns", light: "work", opts: { count: 6, items: 3 }, readout: "3 columns: < 17 GB" },
              { type: "note", node: "reports", text: "many sources, long history", tone: "work", with: true },
            ],
          },
        ],
      },
    },
  ],
};
