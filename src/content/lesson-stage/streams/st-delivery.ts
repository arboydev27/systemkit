import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Get one effect from repeated delivery": a consumer reads offset 500 of a payments topic, "credit account 9
// by $20", credits Postgres (the work, $100 → $120) and commits offset 501. The record is then replayed through a crash
// between the two: commit first loses it ($100), work first repeats it ($140), an event ID under a unique constraint
// makes the repeat change nothing ($120), and keeping the offset in Postgres commits both together. A third-party email
// API sits outside both fixes and sends the receipt twice. Postgres's rows lie beside it as a strip, one per key; a
// transaction's rows land in one append (a sorted log replaces each key's row), so they change together.
export const stDeliveryStage: StageScene = {
  id: "st-delivery",
  intro: "Watch a consumer handle one payment, credit account 9 by $20, then replay it with a crash in the middle to see it lost, doubled and applied once.",
  metrics: [
    { id: "delivered", label: "Delivered" },
    { id: "credited", label: "Credited" },
  ],
  // The consumer stands between its two jobs: the topic it commits to above it and Postgres, where the work lands,
  // below it, their strips side by side on the right, far enough out that a message resting on the consumer's link to
  // the topic keeps clear of the topic's tag. On a phone the consumer has the top row and the topic and Postgres share
  // the next, their strips stacked under them. At the end the topic steps aside and the Email API takes its place, so
  // a small phone still holds three parts and one strip at a readable size (four parts and two strips would not). Its
  // tag is about as wide as the topic's ("third-party service"; a phone shows names only), so on a wide screen the
  // link to Postgres keeps the low route it takes under the topic and a message riding it passes under the tag (with
  // "third party" the link climbs toward the tag and "credit + offset 501" covers it).
  // A strip's change finishes before the next one starts (two at once would undo each other while playing), so each
  // replay rewinds one log at a time, the record read alongside.
  nodes: [
    { id: "consumer", role: "consumer", label: "Consumer", detail: "credits accounts", at: [0, 0], opts: { count: 1 } },
    { id: "topic", role: "broker", label: "Payments topic", detail: "partition 0", at: [1.6, -1], opts: { count: 3, items: 4, mark: 0 } },
    { id: "db", role: "database", label: "Postgres", detail: "accounts", at: [1.6, 1] },
    { id: "email", role: "external", label: "Email API", detail: "third-party service", at: [1.6, -1], appear: 5 },
  ],
  links: [{ from: "topic", to: "consumer" }, { from: "consumer", to: "db" }, { from: "consumer", to: "email" }],
  logs: [
    {
      id: "p0", node: "topic", label: "P0", start: 498,
      records: [{ text: "acct 5 +$15" }, { text: "acct 2 +$50" }, { text: "acct 9 +$20" }, { text: "acct 7 +$30" }],
    },
    // Postgres's rows, one per key: account 9's balance (key a), then the event ID or the stored offset (key b). Each
    // append takes the next offset: a@0; step 4 a@1 b@2; step 5 a@3 b@4, then a@5 b@6; step 6 a@7 b@8, then a@9 b@10.
    { id: "rows", node: "db", label: "Rows", sorted: true, records: [{ text: "acct 9 $100", key: "a" }] },
  ],
  steps: [
    {
      title: "Each record needs work and a commit",
      short: "Two jobs",
      text: "The consumer reads offset 500, credit account 9 by $20, and does two things: the work, crediting Postgres from $100 to $120, and the commit, moving its offset on to 501. A crash can land between the two, and their order decides what breaks.",
      focus: ["topic", "consumer", "db"],
      facts: [["Work", "credit in Postgres"], ["Commit", "next offset, 501"]],
      metrics: { delivered: { n: 1, unit: "×" }, credited: { n: 1, unit: "×" } },
      changes: ["~ Account 9: $100 → $120", "~ Committed offset 500 → 501"],
      events: [
        { type: "cursor", log: "p0", id: "consumer", at: 500, label: "committed" },
        { type: "read", log: "p0", at: 500, to: "consumer", with: true },
        { type: "packet", path: ["consumer", "db"], label: "credit acct 9 +$20" },
        { type: "record", log: "rows", at: 0, text: "acct 9 $120", tone: "work" },
        { type: "note", node: "db", text: "1 · the work", tone: "work", with: true },
        { type: "packet", path: ["consumer", "topic"], label: "commit 501" },
        { type: "cursor", log: "p0", id: "consumer", at: 501 },
        { type: "note", node: "topic", text: "2 · the commit", with: true },
      ],
    },
    {
      title: "Commit first, and a crash loses the record",
      short: "At most once",
      text: "Replay 500, committing first: at-most-once. The consumer commits 501, then crashes before the credit. Its replacement resumes at 501, so account 9 stays at $100: the $20 is lost, never repeated. That suits high-volume telemetry, where a missing sample is harmless.",
      focus: ["topic", "consumer", "db"],
      facts: [["Order", "commit, then work"], ["Account 9", "$100, not $120"]],
      metrics: { delivered: { n: 1, unit: "×" }, credited: { n: 0, unit: "×", tone: "hot" } },
      changes: ["~ Commit 501 before the credit", "− Consumer crashes", "− $20 credit lost"],
      events: [
        { type: "cursor", log: "p0", id: "consumer", at: 500 },
        { type: "record", log: "rows", at: 0, text: "acct 9 $100", tone: "", gap: 120 },
        { type: "read", log: "p0", at: 500, to: "consumer", with: true },
        { type: "packet", path: ["consumer", "topic"], label: "commit 501" },
        { type: "cursor", log: "p0", id: "consumer", at: 501 },
        { type: "state", node: "consumer", light: "hot", tone: "hot", down: true },
        { type: "pause", ms: 300, gap: 0 },
        { type: "state", node: "consumer", detail: "replacement", light: "on", tone: "", down: false, gap: 120 },
        // on the topic, where the replacement reads from: a note on the consumer sits where its messages rest
        { type: "note", node: "topic", text: "resumes at 501", with: true },
        { type: "record", log: "p0", at: 500, tone: "hot" },
        { type: "note", node: "db", text: "$20 lost", tone: "hot", with: true },
      ],
    },
    {
      title: "Work first, and a crash repeats the record",
      short: "At least once",
      text: "Replay 500, working first: at-least-once. The consumer credits account 9, $100 → $120, and crashes before committing. Its replacement resumes at 500 and credits another $20: $140. Redelivery can’t be designed away: after a crash, the sender can’t tell whether the work finished.",
      focus: ["topic", "consumer", "db"],
      facts: [["Order", "work, then commit"], ["Should be", "$120"], ["Is", "$140"]],
      metrics: { delivered: { n: 2, unit: "×" }, credited: { n: 2, unit: "×", tone: "hot" } },
      changes: ["~ Credit before the commit", "− Crash before the commit", "+ Second $20 credit: $140"],
      events: [
        { type: "state", node: "consumer", detail: "credits accounts" },
        { type: "cursor", log: "p0", id: "consumer", at: 500, with: true },
        { type: "record", log: "p0", at: 500, tone: "", gap: 120 },
        { type: "read", log: "p0", at: 500, to: "consumer", with: true },
        { type: "packet", path: ["consumer", "db"], label: "credit acct 9 +$20", gap: 160 },
        { type: "record", log: "rows", at: 0, text: "acct 9 $120", tone: "work", gap: 120 },
        { type: "state", node: "consumer", light: "hot", tone: "hot", down: true },
        { type: "pause", ms: 300, gap: 0 },
        { type: "state", node: "consumer", detail: "replacement", light: "on", tone: "", down: false, gap: 120 },
        { type: "read", log: "p0", at: 500, to: "consumer", label: "500 again", with: true },
        { type: "packet", path: ["consumer", "db"], label: "credit acct 9 +$20", kind: "hot", gap: 160 },
        { type: "record", log: "rows", at: 0, text: "acct 9 $140", tone: "hot", gap: 120 },
        { type: "note", node: "db", text: "+$20 twice", tone: "hot", with: true },
      ],
    },
    {
      title: "An event ID makes the repeat change nothing",
      short: "Idempotent fix",
      text: "“Exactly once” in practice is at-least-once delivery plus an effect that lands once. Replay 500: one transaction credits account 9 and inserts event ID 500 under a unique constraint. After the same crash, the repeat’s insert conflicts and changes nothing: $120.",
      focus: ["topic", "consumer", "db"],
      facts: [["Unique key", "event ID"], ["Account 9", "$120"], ["Cost", "IDs kept past the longest replay"]],
      metrics: { delivered: { n: 2, unit: "×" }, credited: { n: 1, unit: "×" } },
      changes: ["+ evt 500 in the credit’s transaction", "~ Repeat conflicts: still $120"],
      events: [
        { type: "state", node: "consumer", detail: "credits accounts" },
        { type: "record", log: "rows", at: 0, text: "acct 9 $100", tone: "", with: true },
        { type: "read", log: "p0", at: 500, to: "consumer", with: true },
        { type: "packet", path: ["consumer", "db"], label: "credit + evt 500", gap: 160 },
        // one transaction: the credit and the event ID land together
        { type: "append", log: "rows", records: [{ text: "acct 9 $120", key: "a", tone: "work" }, { text: "evt 500", key: "b", tone: "work" }], gap: 120 },
        { type: "state", node: "consumer", light: "hot", tone: "hot", down: true },
        { type: "pause", ms: 300, gap: 0 },
        { type: "state", node: "consumer", detail: "replacement", light: "on", tone: "", down: false, gap: 120 },
        { type: "read", log: "p0", at: 500, to: "consumer", label: "500 again", with: true },
        { type: "packet", path: ["consumer", "db"], label: "credit + evt 500", gap: 160 },
        { type: "read", log: "rows", at: 2, gap: 120 },
        { type: "note", node: "db", text: "evt 500 seen", tone: "work", with: true },
      ],
    },
    {
      title: "Commit the offset with the credit",
      short: "Transactional fix",
      text: "Or make the effect transactional: keep the offset in Postgres. Replay 500: one transaction writes $120 and offset 501, so a crash leaves both or neither; here the replacement reads 501 and moves on. Kafka transactions do the same when output and offsets both live in Kafka.",
      focus: ["topic", "consumer", "db"],
      facts: [["One transaction", "credit + offset"], ["Resume from", "501, in Postgres"]],
      metrics: { delivered: { n: 1, unit: "×" }, credited: { n: 1, unit: "×" } },
      changes: ["~ Offset kept in Postgres", "+ $120 and offset 501 commit together", "~ Replacement resumes at 501"],
      events: [
        { type: "state", node: "consumer", detail: "credits accounts" },
        { type: "cursor", log: "p0", id: "consumer", at: 500, label: "in Postgres", with: true },
        { type: "append", log: "rows", records: [{ text: "acct 9 $100", key: "a" }, { text: "offset 500", key: "b" }], gap: 120 },
        { type: "read", log: "p0", at: 500, to: "consumer", with: true },
        { type: "packet", path: ["consumer", "db"], label: "credit + offset 501", gap: 160 },
        { type: "append", log: "rows", records: [{ text: "acct 9 $120", key: "a", tone: "work" }, { text: "offset 501", key: "b", tone: "work" }], gap: 120 },
        { type: "state", node: "consumer", light: "hot", tone: "hot", down: true },
        { type: "pause", ms: 300, gap: 0 },
        { type: "state", node: "consumer", detail: "replacement", light: "on", tone: "", down: false, gap: 120 },
        { type: "packet", path: ["db", "consumer"], label: "resume at 501", kind: "response", with: true },
        { type: "cursor", log: "p0", id: "consumer", at: 501, gap: 120 },
        { type: "note", node: "topic", text: "resumes at 501", with: true },
      ],
    },
    {
      title: "An outside API still sends twice",
      short: "Outside call",
      text: "Neither fix reaches a third-party Email API. Replay 500: the consumer sends account 9’s receipt, then crashes before its transaction commits. The replacement resumes from offset 500 in Postgres and redoes both: one credit, but a second email. Use the provider’s own idempotency support, or accept the risk.",
      focus: ["consumer", "db", "email"],
      facts: [["Account 9", "$120, credited once"], ["Emails sent", "2"]],
      metrics: { delivered: { n: 2, unit: "×" }, credited: { n: 1, unit: "×" } },
      changes: ["+ Email API", "− Crash after the email, before the commit", "+ Second receipt sent"],
      events: [
        // the topic steps aside: the offset to resume from now lives in Postgres, and the Email API rises in its place.
        // Started together, the Email API still waits for the topic to go, and its link is drawn once (shown first, the
        // two parts' tags would cross and its link would draw twice).
        { type: "hide", nodes: ["topic"] },
        { type: "show", nodes: ["email"], with: true },
        { type: "state", node: "consumer", detail: "credits, emails", gap: 120 },
        { type: "append", log: "rows", records: [{ text: "acct 9 $100", key: "a" }, { text: "offset 500", key: "b" }], with: true },
        { type: "packet", path: ["consumer", "email"], label: "receipt", gap: 160 },
        { type: "state", node: "email", light: "on", readout: "1 email", gap: 120 },
        { type: "state", node: "consumer", light: "hot", tone: "hot", down: true },
        { type: "pause", ms: 300, gap: 0 },
        { type: "state", node: "consumer", detail: "replacement", light: "on", tone: "", down: false, gap: 120 },
        // on Postgres, where the offset it resumes from now lives
        { type: "note", node: "db", text: "resumes from 500", with: true },
        // it redoes the same work in the same order: the receipt, then the transaction, which commits this time (the
        // email has to go before the commit, or the first crash would have come after it). One message at a time: on a
        // phone both links leave the consumer down one trunk.
        { type: "packet", path: ["consumer", "email"], label: "receipt", kind: "hot", gap: 120 },
        { type: "state", node: "email", light: "hot", tone: "hot", readout: "2 emails", gap: 120 },
        { type: "packet", path: ["consumer", "db"], label: "credit + offset 501", with: true },
        { type: "append", log: "rows", records: [{ text: "acct 9 $120", key: "a", tone: "work" }, { text: "offset 501", key: "b", tone: "work" }], gap: 120 },
      ],
    },
  ],
};
