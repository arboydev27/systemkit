import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Ask whether the input ever ends": yesterday's order files are a closed log the nightly job reads to its end
// and exits (seller payouts at 02:00 over 6 million orders, 20 minutes), then reruns over the same files after a bug;
// card payments are a log that keeps growing past the stream job's cursor, whose running count per card stops card
// 4417's five orders in two minutes; then what streaming costs, and the test (what changes if the number arrives an
// hour sooner) tried on payouts, the ledger report, a stolen card and a live dashboard.
export const stBatchStreamStage: StageScene = {
  id: "st-batch-stream",
  intro: "Watch a nightly job read a closed day of order files and exit, then a stream job that never finishes, because card payments keep arriving.",
  metrics: [
    { id: "orders", label: "Orders read" },
    { id: "unread", label: "Unread payments", derive: { lag: ["pay", "stream"] } },
  ],
  // Two pipelines, one above the other on a wide screen: each job on the left reading its input on the right. The closed
  // day's short strip runs on to the right; the payments' strip lies under its pair, where eight records and the open
  // slot fit without shrinking the stage (to the right it pushes the camera out). On a phone the jobs share the top row,
  // the inputs the row under it, and the inputs' strips stack below them, so no link crosses a strip.
  nodes: [
    { id: "nightly", role: "worker", label: "Nightly job", detail: "seller payouts", at: [0, 0] },
    { id: "files", role: "storage", label: "Order files", detail: "yesterday, in S3", at: [1.15, 0] },
    { id: "stream", role: "worker", label: "Stream job", detail: "fraud check", at: [0, 2], appear: 2 },
    { id: "payments", role: "queue", label: "Card payments", detail: "arriving now", at: [1.15, 2], appear: 2, opts: { items: 3 } },
  ],
  links: [
    { from: "files", to: "nightly" },
    { from: "payments", to: "stream" },
  ],
  logs: [
    // a closed day: kept in order with no open end, since nothing more will be written to it
    {
      id: "day", node: "files", sorted: true,
      records: [{ text: "00–06h" }, { text: "06–12h" }, { text: "12–18h" }, { text: "18–24h" }],
    },
    // card payments, each shown by its card's last four digits
    {
      id: "pay", node: "payments", side: "below", start: 48201, appear: 2,
      records: [{ text: "•2093" }, { text: "•8150" }, { text: "•6634" }],
    },
  ],
  steps: [
    {
      title: "A batch job reads to the end and exits",
      short: "Bounded input",
      text: "Order files holds yesterday’s 6 million completed orders, and nothing more will be added: the input has a known end. At 02:00 the nightly job reads it from the first file to the last, computes seller payouts and exits after 20 minutes.",
      focus: ["files", "nightly"],
      facts: [["Starts", "02:00"], ["Input", "6 million orders"], ["Runs", "20 minutes"]],
      metrics: { orders: 6000000 },
      changes: ["+ Payouts for 6 million orders", "~ Nightly job exits at 02:20"],
      events: [
        // in a group, a part's state goes before the log event: a log event's change lands when its motion ends
        { type: "state", node: "nightly", light: "on", readout: "02:00" },
        { type: "bracket", log: "day", id: "day", from: 0, to: 3, label: "yesterday", with: true },
        { type: "cursor", log: "day", id: "nightly", at: 0, label: "nightly job" },
        { type: "read", log: "day", at: 0 },
        { type: "packet", path: ["files", "nightly"], label: "6M orders", kind: "response", with: true },
        { type: "cursor", log: "day", id: "nightly", at: 1, gap: 80 },
        { type: "read", log: "day", at: 1, with: true },
        { type: "cursor", log: "day", id: "nightly", at: 2, gap: 80 },
        { type: "read", log: "day", at: 2, with: true },
        { type: "cursor", log: "day", id: "nightly", at: 3, gap: 80 },
        { type: "read", log: "day", at: 3, with: true },
        // past the last file there is nothing to wait for: the job is done
        { type: "state", node: "nightly", light: "idle", readout: "exited 02:20" },
        { type: "cursor", log: "day", id: "nightly", at: null, with: true },
        { type: "note", node: "nightly", text: "read to the end", tone: "work", with: true },
      ],
    },
    {
      title: "A bad run is repaired by rerunning it",
      short: "Rerun to repair",
      text: "A bug paid some sellers the wrong amounts. Fix it and rerun the nightly job over the same files: the input hasn’t changed, so the new payouts replace the old. A closed day is also a complete input, which the finance ledger report needs.",
      focus: ["files", "nightly"],
      facts: [["Input", "the same files"], ["Output", "replaced"]],
      changes: ["− Wrong payouts", "~ Same files read again", "+ Corrected payouts"],
      events: [
        { type: "state", node: "nightly", light: "hot", tone: "hot", readout: "wrong payouts" },
        { type: "pause", ms: 500 },
        { type: "state", node: "nightly", light: "on", tone: "", readout: "rerun" },
        { type: "note", node: "nightly", text: "bug fixed: rerun", with: true },
        { type: "cursor", log: "day", id: "nightly", at: 0, label: "nightly job", with: true },
        { type: "read", log: "day", at: 0 },
        { type: "packet", path: ["files", "nightly"], label: "the same 6M orders", kind: "response", with: true },
        { type: "cursor", log: "day", id: "nightly", at: 1, gap: 80 },
        { type: "read", log: "day", at: 1, with: true },
        { type: "cursor", log: "day", id: "nightly", at: 2, gap: 80 },
        { type: "read", log: "day", at: 2, with: true },
        { type: "cursor", log: "day", id: "nightly", at: 3, gap: 80 },
        { type: "read", log: "day", at: 3, with: true },
        { type: "state", node: "nightly", light: "work", readout: "payouts replaced" },
        { type: "cursor", log: "day", id: "nightly", at: null, with: true },
      ],
    },
    {
      title: "Card payments never reach an end",
      short: "Unbounded input",
      text: "Card payments are still being written, so their log has no last record. The stream job reads each payment as it lands, and new ones keep landing past its cursor. It never finishes, so it carries running state across restarts and decides when each result is ready.",
      focus: ["payments", "stream"],
      frame: ["files", "nightly", "payments", "stream"],
      changes: ["+ Card payments, a log still growing", "+ Stream job, reading as payments land", "~ No last record"],
      events: [
        // the two parts arrive with their strip, a payment landing on it and the stream job's cursor on the first payment
        // it hasn't read
        { type: "state", node: "nightly", light: "idle", readout: "", with: true },
        { type: "state", node: "stream", light: "on", with: true },
        { type: "append", log: "pay", records: [{ text: "•5521" }], with: true },
        { type: "cursor", log: "pay", id: "stream", at: 48203, label: "stream job", with: true },
        // each time the job takes a payment and moves on, another lands past its cursor
        { type: "read", log: "pay", at: 48203, to: "stream", gap: 200 },
        { type: "cursor", log: "pay", id: "stream", at: 48204, with: true },
        { type: "append", log: "pay", records: [{ text: "•7702" }], with: true },
        { type: "read", log: "pay", at: 48204, to: "stream", gap: 200 },
        { type: "cursor", log: "pay", id: "stream", at: 48205, with: true },
        { type: "append", log: "pay", records: [{ text: "•3378" }], with: true },
        { type: "note", node: "payments", text: "no last record", with: true },
      ],
    },
    {
      title: "Running state stops a stolen card",
      short: "Stolen card",
      text: "A stolen card ending 4417 places five orders in two minutes. The stream job keeps a running count per card, sees the fifth and stops the orders before they ship. The nightly job would see them only in its next run, up to a day late.",
      focus: ["payments", "stream", "nightly"],
      frame: ["files", "nightly", "payments", "stream"],
      facts: [["Card 4417", "5 orders in 2 min"], ["Nightly job", "up to a day late"]],
      changes: ["+ 5 orders on card 4417", "~ Running count for 4417 reaches 5", "~ Orders stopped before they ship"],
      events: [
        // the stream job catches up on the two payments left from the step before
        { type: "read", log: "pay", at: 48205 },
        { type: "read", log: "pay", at: 48206, with: true },
        { type: "cursor", log: "pay", id: "stream", at: "end", with: true },
        { type: "append", log: "pay", records: [{ text: "•4417" }, { text: "•4417" }], gap: 200 },
        { type: "state", node: "stream", readout: "•4417: 2", gap: 200 },
        { type: "cursor", log: "pay", id: "stream", at: "end", with: true },
        { type: "append", log: "pay", records: [{ text: "•4417" }, { text: "•4417" }, { text: "•4417" }], gap: 200 },
        { type: "state", node: "stream", readout: "•4417: 5", gap: 200 },
        { type: "cursor", log: "pay", id: "stream", at: "end", with: true },
        // the fifth trips the check, and the stream job stops all five orders inside the two minutes. The count moves from
        // the readout into the note, since the engine stacks a note right over a part's readout and the two would crowd;
        // the note stays short because on a phone the stream job sits at the stage's right edge
        { type: "state", node: "stream", light: "work", readout: "", gap: 160 },
        { type: "record", log: "pay", at: 48211, tone: "hot", with: true },
        { type: "bracket", log: "pay", id: "card", from: 48207, to: 48211, label: "2 minutes", tone: "hot", gap: 120 },
        { type: "note", node: "stream", text: "count 5: stopped", tone: "work", with: true },
        { type: "note", node: "nightly", text: "up to a day late", with: true },
      ],
    },
    {
      title: "Streaming pays for its freshness",
      short: "The cost",
      text: "The nightly job runs 20 minutes a day; the stream job never stops. Its running state must survive crashes, payments can arrive out of order, and reprocessing past data is harder than rerunning over closed files.",
      frame: ["files", "nightly", "payments", "stream"],
      facts: [["Nightly job", "20 min a day"], ["Stream job", "never stops"]],
      changes: ["~ Compute that never stops", "+ State that must survive crashes", "~ Out-of-order events, harder reprocessing"],
      events: [
        { type: "state", node: "nightly", light: "idle", readout: "20 min a day" },
        // the stream job's traffic shows it never stopping; a readout beside it would run into the note over Card payments
        { type: "state", node: "stream", light: "on", readout: "", with: true },
        { type: "bracket", log: "pay", id: "card", remove: true, with: true },
        { type: "record", log: "pay", at: 48211, tone: "", gap: 0 },
        { type: "stream", every: 520, routes: [{ path: ["payments", "stream"], kind: "work" }] },
        { type: "append", log: "pay", records: [{ text: "•9020" }] },
        { type: "cursor", log: "pay", id: "stream", at: "end" },
        { type: "append", log: "pay", records: [{ text: "•1186" }], gap: 200 },
        { type: "append", log: "pay", records: [{ text: "•3051" }], gap: 200 },
        { type: "note", node: "stream", text: "needs durable state", with: true },
        { type: "note", node: "payments", text: "can be out of order", with: true },
      ],
    },
    {
      title: "Ask what changes an hour sooner",
      short: "An hour sooner",
      text: "Ask what decision changes if the number arrives an hour sooner. Try each number: payouts and the ledger gain nothing, so they stay nightly; fraud on a stolen card and a live ops dashboard labeled provisional need the stream. Many systems run both, the nightly job keeping the number of record.",
      frame: ["files", "nightly", "payments", "stream"],
      facts: [["Nightly job", "the number of record"], ["Stream job", "early, provisional"]],
      changes: ["~ Payouts and ledger stay nightly", "~ Stolen cards and dashboards stream", "+ Both run, batch keeps the record"],
      events: [
        { type: "state", node: "nightly", light: "idle", readout: "", detail: "number of record" },
        // the stream job keeps running beside the nightly one; an option lights the job its number needs. Each option
        // carries the payments' traffic, since choosing another option doesn't restart a stream of the step's own
        { type: "state", node: "stream", light: "on", readout: "", detail: "early, provisional", with: true },
      ],
      control: {
        label: "Number",
        options: [
          {
            label: "Payout",
            events: [
              { type: "state", node: "nightly", light: "work" },
              { type: "note", node: "nightly", text: "paid once a day", with: true },
              { type: "stream", every: 900, routes: [{ path: ["payments", "stream"], kind: "work" }], with: true },
            ],
          },
          {
            label: "Ledger",
            events: [
              { type: "state", node: "nightly", light: "work" },
              { type: "note", node: "nightly", text: "needs a closed day", with: true },
              { type: "stream", every: 900, routes: [{ path: ["payments", "stream"], kind: "work" }], with: true },
            ],
          },
          {
            label: "Fraud",
            events: [
              { type: "state", node: "stream", light: "work" },
              { type: "note", node: "stream", text: "act before shipping", with: true },
              { type: "stream", every: 900, routes: [{ path: ["payments", "stream"], kind: "work" }], with: true },
            ],
          },
          {
            label: "Live ops",
            events: [
              { type: "state", node: "stream", light: "work" },
              { type: "note", node: "stream", text: "labeled provisional", with: true },
              { type: "stream", every: 900, routes: [{ path: ["payments", "stream"], kind: "work" }], with: true },
            ],
          },
        ],
      },
    },
  ],
};
