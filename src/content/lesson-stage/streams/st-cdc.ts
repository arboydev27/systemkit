import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Follow the database's own log": dual writes leave the search index and cache at product 7's old price 24
// after a crash; CDC instead follows Postgres's WAL, where UPDATE products SET price = 19 WHERE id = 7 sits at 882. A
// connector publishes it keyed by 7 to partition 2 of a change topic (offset 311), the search indexer upserts doc 7 and
// a cache consumer deletes product:7; a delete follows the same path in order, and search lags a record behind; then
// the costs: a snapshot for a new consumer, a stalled slot keeping 3 unread records (884-886) until the disk fills, and
// events that mirror columns, answered by an outbox row committed with its change (887 and 888). The lesson's outbox
// example is OrderPlaced; this products story names its own designed event, PriceChanged, so the other team, which
// reads product changes, gets a product event.
export const stCdcStage: StageScene = {
  id: "st-cdc",
  intro: "Watch one price change reach a search index and a cache, first by writing every copy, then by following Postgres's own log.",
  metrics: [
    { id: "writes", label: "App writes" },
    { id: "slot", label: "Slot lag", derive: { lag: ["wal", "connector"] } },
    { id: "search", label: "Search lag", derive: { lag: ["p2", "search"] } },
  ],
  // Phone rows: the App; Postgres and the connector, the WAL under them; the topic and the other team, partition 2
  // under them; the copies. Lanes stay within -1.05 to 1.75, so a phone frames both strips with 10px names. On a wide
  // screen the WAL lies along the back to Postgres's right, partition 2 below the topic's tag, the connector beside the
  // topic one tier before it, and the copies further out (tier 3.6). When the other team arrives (step 6) it stands
  // behind the topic, far enough forward that its note keeps 12px clear of the WAL; the connector steps back towards
  // Postgres, so the WAL's link to it keeps its one bend clear of the team and messages reach the topic from below the
  // team, and the topic steps forward, so the team's tag keeps clear of its posts (a detail line would reach them, so
  // the team has none). Search and the cache start in Postgres's tier (one phone row with it) and step aside when the
  // pipeline arrives. Record texts keep within 8 characters so a 375px phone's WAL still shows 3 records, the slot's
  // whole pile-up in step 7.
  nodes: [
    { id: "app", role: "web", label: "App", detail: "writes products", at: [0, 0.8] },
    { id: "db", role: "database", label: "Postgres", detail: "products table", at: [1, -1.05] },
    { id: "connector", role: "worker", label: "Connector", detail: "Debezium", at: [1, 1.2], appear: 1 },
    { id: "topic", role: "broker", label: "Change topic", detail: "Kafka, keyed by id", at: [2, 1.2], appear: 1, opts: { count: 3, items: 3 } },
    { id: "search", role: "index", label: "Search index", detail: "product documents", at: [1, 0.2] },
    { id: "cache", role: "cache", label: "Cache", detail: "product:<id> keys", at: [1, 1.3] },
    { id: "other", role: "consumer", label: "Other team", at: [2, 0.14], appear: 5, opts: { count: 2 } },
  ],
  links: [
    { from: "app", to: "db" },
    { from: "app", to: "search", unless: "connector" },
    { from: "app", to: "cache", unless: "connector" },
    { from: "db", to: "connector" },
    { from: "connector", to: "topic" },
    { from: "topic", to: "search" },
    { from: "topic", to: "cache" },
    { from: "topic", to: "other" },
  ],
  logs: [
    { id: "wal", node: "db", label: "WAL", start: 880, records: [{ text: "4 at 12" }, { text: "2 at 30" }] },
    { id: "p2", node: "topic", label: "P2", start: 310, side: "below", appear: 1, records: [{ text: "4 at 12", key: "4" }] },
  ],
  steps: [
    {
      title: "Two writes, and a crash between them",
      short: "Dual writes",
      text: "The app writes every copy itself. It commits price 19 for product 7 to Postgres, then crashes before updating the search index and the cache, which still say 24. Concurrent updates can also reach each copy in a different order.",
      facts: [["Postgres", "price 19"], ["Search, cache", "price 24"]],
      metrics: { writes: { n: 3, unit: " per change" } },
      changes: ["~ Postgres: product 7 at 19", "− App crashes before the next write", "~ Search and cache still at 24"],
      events: [
        { type: "state", nodes: ["search", "cache"], readout: "price 24" },
        { type: "append", log: "wal", from: "app", records: [{ text: "7 at 19" }] },
        { type: "note", node: "db", text: "committed", tone: "work", with: true },
        { type: "state", node: "app", light: "hot", tone: "hot", down: true },
        { type: "state", nodes: ["search", "cache"], light: "hot", tone: "hot" },
      ],
    },
    {
      title: "A connector follows the database's log",
      short: "Follow the WAL",
      text: "CDC reads the log Postgres already writes for replication, its write-ahead log (WAL). A connector such as Debezium reads the committed update at 882 and publishes it to a Kafka topic as an event keyed by primary key 7. The app writes only to Postgres.",
      focus: ["db", "connector", "topic"],
      facts: [["Log", "WAL; MySQL's binlog"], ["Event key", "primary key 7"]],
      metrics: { writes: { n: 1, unit: " per change" } },
      changes: ["+ Connector reads WAL 882", "+ Key 7 at partition 2, offset 311", "~ App writes Postgres only"],
      events: [
        { type: "show", nodes: ["connector", "topic"], at: { search: [3.6, 0.15], cache: [3.6, 1.75] } },
        { type: "state", node: "app", light: "idle", tone: "", down: false, with: true },
        { type: "state", nodes: ["search", "cache"], light: "idle", tone: "", with: true },
        { type: "read", log: "wal", at: 882, to: "connector" },
        { type: "cursor", log: "wal", id: "connector", at: "end", label: "slot" },
        { type: "state", node: "topic", opts: { mark: 2 }, with: true },
        { type: "append", log: "p2", records: [{ text: "7 at 19", key: "7" }], with: true },
        { type: "bracket", log: "p2", id: "key", from: 311, to: 311, label: "hash(7) → P2", with: true },
      ],
    },
    {
      title: "Each copy applies the change",
      short: "Copies follow",
      text: "The search indexer reads the event and upserts document 7 at price 19. A cache consumer deletes the key product:7, so the next read misses and loads 19 from Postgres. Every copy now agrees, and the app wrote once.",
      focus: ["topic", "search", "cache"],
      changes: ["~ Search: doc 7 at 19", "− product:7 deleted from the cache", "~ Every copy agrees with Postgres"],
      events: [
        { type: "bracket", log: "p2", id: "key", remove: true },
        { type: "cursor", log: "p2", id: "search", at: 311, label: "search", with: true },
        { type: "cursor", log: "p2", id: "cache", at: 311, label: "cache", with: true },
        { type: "read", log: "p2", at: 311, to: "search", label: "upsert doc 7" },
        { type: "state", node: "search", light: "work", readout: "price 19" },
        { type: "state", node: "cache", light: "work", readout: "", with: true },
        { type: "note", node: "cache", text: "DEL product:7", tone: "work", with: true },
        { type: "cursor", log: "p2", id: "search", at: "end" },
        { type: "cursor", log: "p2", id: "cache", at: "end", with: true },
      ],
    },
    {
      title: "A delete takes the same path, in order",
      short: "Delete in order",
      text: "Product 7 is deleted, a change that polling the table would miss. The delete commits at WAL 883 and takes the same path: keyed by 7, it lands in partition 2 at offset 312, right after the update, so no consumer can apply the two out of order.",
      focus: ["db", "connector", "topic"],
      facts: [["Partition 2", "update, then delete"], ["Polling the table", "misses hard deletes"]],
      changes: ["+ 7 deleted at WAL 883", "+ 7 deleted at partition 2, offset 312", "~ Right after 7's update"],
      events: [
        { type: "state", nodes: ["search", "cache"], light: "idle" },
        { type: "append", log: "wal", records: [{ text: "7 del", tomb: true }] },
        { type: "read", log: "wal", at: 883, to: "connector" },
        { type: "cursor", log: "wal", id: "connector", at: "end" },
        { type: "append", log: "p2", records: [{ text: "7 del", key: "7", tomb: true }], with: true },
        { type: "bracket", log: "p2", id: "key", from: 311, to: 312, label: "key 7 in order", with: true },
      ],
    },
    {
      title: "The copies lag behind the database",
      short: "Copies lag",
      text: "The cache consumer reads offset 312 and deletes product:7 at once. The search indexer hasn't reached it, so search still lists product 7. Every copy trails Postgres by however long this pipeline takes.",
      focus: ["topic", "search", "cache"],
      facts: [["Cache", "product:7 deleted"], ["Search", "1 record behind"]],
      changes: ["− product:7 deleted from the cache", "~ Search still lists product 7"],
      events: [
        { type: "bracket", log: "p2", id: "key", remove: true },
        { type: "read", log: "p2", at: 312, with: true },
        { type: "cursor", log: "p2", id: "cache", at: "end" },
        { type: "state", node: "cache", light: "work", with: true },
        { type: "note", node: "cache", text: "product:7 deleted", tone: "work", with: true },
        { type: "note", node: "search", text: "still lists 7" },
      ],
    },
    {
      title: "A new consumer starts from a snapshot",
      short: "Snapshot",
      text: "Another team's service starts reading product changes. The WAL holds only recent changes, not every product, so the connector first snapshots the table, every row through the topic, and the team then follows the log from there. Search has caught up.",
      focus: ["db", "connector", "topic", "other"],
      changes: ["+ Other team, a new consumer", "+ Snapshot of every product", "~ Search caught up: doc 7 removed"],
      events: [
        { type: "cursor", log: "p2", id: "search", at: "end" },
        { type: "state", node: "search", readout: "", with: true },
        { type: "show", nodes: ["other"], at: { connector: [1, 0.38], topic: [2, 1.38] } },
        { type: "bracket", log: "wal", id: "kept", from: 880, to: 883, label: "recent changes", with: true },
        { type: "packet", path: ["db", "connector", "topic"], label: "every row", kind: "work" },
        { type: "cursor", log: "p2", id: "other", at: "end", label: "other team" },
        { type: "note", node: "other", text: "snapshot, then the log", tone: "work", with: true },
      ],
    },
    {
      title: "A stalled connector fills the disk",
      short: "Stalled slot",
      text: "Postgres keeps WAL for a replication slot until its consumer has read it, so the connector can resume without gaps. When the connector stalls and writes go on, unread WAL piles up behind the slot, 3 records here, until it can fill the disk.",
      focus: ["app", "db", "connector"],
      changes: ["− Connector stalls", "+ 3 unread WAL records kept, 884–886", "~ Postgres disk filling"],
      events: [
        { type: "bracket", log: "wal", id: "kept", remove: true },
        { type: "state", node: "connector", light: "hot", tone: "hot", down: true },
        { type: "append", log: "wal", from: "app", records: [{ text: "2 at 28" }] },
        { type: "append", log: "wal", from: "app", records: [{ text: "5 at 11" }], gap: 120 },
        { type: "append", log: "wal", from: "app", records: [{ text: "3 at 40" }], gap: 120 },
        { type: "state", node: "db", light: "hot", tone: "hot", with: true },
        { type: "bracket", log: "wal", id: "slot", from: 884, to: 886, label: "unread, kept", tone: "hot", with: true },
        { type: "note", node: "db", text: "disk filling", tone: "hot", with: true },
      ],
    },
    {
      title: "Give other teams a designed event",
      short: "Outbox",
      text: "CDC events mirror table columns, so renaming one breaks the other team. For events others rely on, the app writes a designed event, PriceChanged, to an outbox table in the same transaction as its change (WAL 887 and 888), and the connector relays it. An outbox needs code in every writer; CDC also captures scripts.",
      focus: ["db", "connector", "topic", "other"],
      facts: [["CDC", "copies you own"], ["Outbox", "events others rely on"]],
      changes: ["~ Connector back, slot read", "+ Product 9 at 16 and outbox 9, one transaction", "~ Other team reads PriceChanged, not columns"],
      events: [
        { type: "state", node: "connector", light: "idle", tone: "", down: false },
        { type: "cursor", log: "wal", id: "connector", at: "end", with: true },
        { type: "bracket", log: "wal", id: "slot", remove: true, with: true },
        { type: "state", node: "db", light: "idle", tone: "", with: true },
        { type: "append", log: "wal", records: [{ text: "9 at 16" }, { text: "outbox 9" }] },
        { type: "bracket", log: "wal", id: "txn", from: 887, to: 888, label: "1 transaction", with: true },
        { type: "read", log: "wal", at: 888 },
        { type: "cursor", log: "wal", id: "connector", at: "end", with: true },
        { type: "packet", path: ["connector", "topic"], label: "outbox 9", kind: "work" },
        { type: "state", node: "other", light: "work" },
        { type: "note", node: "other", text: "PriceChanged, not columns", tone: "work", with: true },
      ],
    },
  ],
};
