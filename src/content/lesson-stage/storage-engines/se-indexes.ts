import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Pay for every index on every write": prototype.
export const seIndexesStage: StageScene = {
  id: "se-indexes",
  intro: "Watch one customer's orders found by a scan, then by an index, then see what every index costs each insert.",
  metrics: [{ id: "rows", label: "Rows read" }, { id: "changes", label: "Page changes" }],
  nodes: [
    { id: "app", role: "web", label: "App", detail: "order pages", at: [0, 0] },
    { id: "index", role: "index", label: "Index", detail: "customer, date", at: [0.9, -0.9], appear: 1 },
    { id: "table", role: "database", label: "Orders table", detail: "rows in insert order", at: [0.9, 1.2] },
  ],
  links: [{ from: "app", to: "table" }, { from: "app", to: "index" }, { from: "index", to: "table" }],
  logs: [
    {
      id: "rows", node: "table", label: "Table", records: [
        { text: "42 May 1", key: "o1" }, { text: "17 May 2", key: "o2" }, { text: "42 May 2", key: "o3" },
        { text: "58 May 2", key: "o4" }, { text: "42 May 3", key: "o5" },
      ],
    },
    {
      id: "entries", node: "index", label: "Index", sorted: true, appear: 1, records: [
        { text: "42 May 1", key: "42-1" }, { text: "17 May 2", key: "17-2" }, { text: "42 May 2", key: "42-2" },
        { text: "58 May 2", key: "58-2" }, { text: "42 May 3", key: "42-3" },
      ],
    },
  ],
  steps: [
    {
      title: "Without an index, every row is read",
      short: "Table scan",
      text: "The App asks for customer 42's orders. Without an index the engine scans the orders table.",
      metrics: { rows: 5 },
      events: [
        { type: "packet", path: ["app", "table"], label: "customer_id = 42" },
        { type: "read", log: "rows", at: 0 },
        { type: "read", log: "rows", at: 1, gap: 60 },
        { type: "read", log: "rows", at: 2, gap: 60 },
        { type: "read", log: "rows", at: 3, gap: 60 },
        { type: "read", log: "rows", at: 4, gap: 60 },
        { type: "packet", path: ["table", "app"], label: "3 orders", kind: "response" },
      ],
    },
    {
      title: "An index finds them, then fetches",
      short: "Secondary index",
      text: "Index.",
      events: [
        { type: "show", nodes: ["index"] },
        { type: "packet", path: ["app", "index"], label: "customer_id = 42" },
        { type: "read", log: "entries", at: 0 },
        { type: "read", log: "entries", at: 2, with: true },
        { type: "read", log: "entries", at: 4, with: true },
        { type: "read", log: "rows", at: 0, to: "app" },
      ],
    },
    {
      title: "Three",
      short: "Three",
      text: "Three.",
      events: [{ type: "append", log: "rows", from: "app", records: [{ text: "42 May 4", key: "o6" }] }, { type: "append", log: "entries", from: "table", records: [{ text: "42 May 4", key: "42-4" }] }],
    },
  ],
};
