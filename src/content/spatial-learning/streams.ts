import { flowLesson } from "./flow-lesson";

export const streamsTeachingContent = {
  "st-batch-stream": flowLesson("st-batch-stream", {
    kind: "comparison",
    semanticIds: ["seller-payouts", "ledger-report", "card-check", "live-dashboard"],
    points: [
      { title: "Batch suits a closed input", description: "Payouts and the ledger report act on a complete day, and a bad run can simply be repeated.", items: [0, 1] },
      { title: "A stream suits a decision that cannot wait", description: "A stolen card must be stopped before orders ship, and a dashboard is useful even while its numbers are provisional.", items: [2, 3] },
    ],
    prediction: {
      prompt: "Buyers review restock suggestions every Monday morning. An engineer proposes computing them from a stream. Which mode fits, and why?",
      options: [
        "Stream, because suggestions built from fresher data are worth the extra cost",
        "Stream, because any job that takes over 20 minutes is too slow to run in batch",
        "Batch, because the people acting on the result look at it once a week",
        "Batch, because stream processors cannot join sales with stock levels",
      ],
      correctIndex: 2,
      explanation: "Freshness matters only when someone can act on it. A weekly review gives a stream nothing to improve, and a batch job is cheaper and easy to rerun.",
      items: [0, 1],
    },
  }),
  "st-log": flowLesson("st-log", {
    kind: "flow",
    semanticIds: ["producer", "partition", "consumer-group", "committed-offset"],
    points: [
      { title: "The key picks the partition", description: "The producer hashes the key, so records with one key stay together at rising offsets.", items: [0, 1] },
      { title: "Each partition has one reader in a group", description: "A group assigns each partition to one member, so partition count caps its parallelism.", items: [1, 2] },
      { title: "Commits mark where to resume", description: "A replacement consumer starts at the last committed offset, so work not yet committed runs again.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A hotel chain keys a bookings topic by hotel ID, and one large hotel produces half of all events. What do you expect to see?",
      options: [
        "Kafka moves part of that hotel’s events to less busy partitions on its own",
        "One partition lags while the consumers of other partitions are mostly idle",
        "Every partition lags equally, since the group shares work across all of them",
        "That hotel’s events lose order, since a busy partition overflows into the next",
      ],
      correctIndex: 1,
      explanation: "A key maps to one partition, and that partition goes to one consumer, so one hot key cannot spread out. Kafka does not rebalance records by load.",
      items: [0, 1, 2],
    },
  }),
  "st-delivery": flowLesson("st-delivery", {
    kind: "comparison",
    semanticIds: ["at-most-once", "at-least-once", "idempotent-effect", "transactional-effect"],
    points: [
      { title: "Commit order picks the failure", description: "Committing before the work can lose a record. Working before the commit can repeat it.", items: [0, 1] },
      { title: "Two ways to land an effect once", description: "An idempotent effect makes a repeat harmless. A transactional effect commits the result and the offset together.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A consumer writes each product’s full document to a search index, keyed by product ID. A rebalance replays 200 events. Should you add a deduplication table?",
      options: [
        "Yes: any replay under at-least-once delivery duplicates documents in the index",
        "No: a rebalance cannot replay events once a consumer has read them",
        "No: writing a full document under its own ID is already idempotent",
        "Yes: Kafka transactions need a table of event IDs before they can commit",
      ],
      correctIndex: 2,
      explanation: "Replaying a full write under the same ID leaves one document. The index can briefly show an older version during the replay, then it converges on the latest.",
      items: [1, 2],
    },
  }),
  "st-cdc": flowLesson("st-cdc", {
    kind: "flow",
    semanticIds: ["database-commit", "log-connector", "change-topic", "derived-copies"],
    points: [
      { title: "The log already holds the change", description: "A committed update enters the replication log, and a connector reads it from there.", items: [0, 1] },
      { title: "Keys keep each row in order", description: "Events keyed by primary key keep one row’s changes in order for every consumer.", items: [1, 2] },
      { title: "Copies apply the change and lag", description: "The index upserts and the cache deletes, each behind the database by the pipeline’s delay.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A new team wants its own copy of a 2 TB products table, built from a CDC topic that keeps 7 days of changes. Will reading the topic be enough?",
      options: [
        "Yes: the connector republishes old rows whenever a new consumer group joins",
        "Yes: the write-ahead log keeps each change since the table was first created",
        "No: a CDC topic can be read by one consumer group at a time",
        "No: rows unchanged for 7 days are missing, so a snapshot has to come first",
      ],
      correctIndex: 3,
      explanation: "The topic holds changes, not the table. A row last edited a month ago appears nowhere in it, so the copy starts from a snapshot and then follows changes.",
      items: [1, 2],
    },
  }),
  "st-event-time": flowLesson("st-event-time", {
    kind: "flow",
    semanticIds: ["open-window", "watermark", "window-result", "late-event"],
    points: [
      { title: "A window waits for its data", description: "The window from 12:00 to 12:01 stays open until the watermark says it is probably complete.", items: [0, 1] },
      { title: "The watermark closes it", description: "An event at 12:01:30 moves a 30-second watermark to 12:01:00, so the window emits its count.", items: [1, 2] },
      { title: "Late data still arrives", description: "An event stamped 12:00:50 comes after the close, so it needs a policy.", items: [2, 3] },
    ],
    prediction: {
      prompt: "Smart meters report hourly readings and can be offline for a day. A billing job closes each hour with a 5-minute watermark delay. What must you add?",
      options: [
        "A side output or update path for readings that arrive after the hour closes",
        "A shorter watermark delay, so that offline meters no longer count as late",
        "Processing-time windows, so that each reading is billed for the correct hour",
        "More partitions, so that each offline meter’s readings can catch up sooner",
      ],
      correctIndex: 0,
      explanation: "A day-late reading will arrive long after any practical watermark, and billing cannot lose it. Closing the window is not the end of the data, so late readings need a path to correct the result.",
      items: [2, 3],
    },
  }),
  "st-schema": flowLesson("st-schema", {
    kind: "flow",
    semanticIds: ["removed-field", "consumer-upgrade", "producer-upgrade", "retention-expiry"],
    points: [
      { title: "Removal is backward compatible only", description: "A new reader skips the field in old records, but an old reader fails on a record without it.", items: [0, 1] },
      { title: "Readers go before writers", description: "Upgrading consumers first means no old reader is left to meet a record that omits the field.", items: [1, 2] },
      { title: "Old records remain for a while", description: "Records with the field stay in the log until retention expires, and new readers skip it.", items: [2, 3] },
    ],
    prediction: {
      prompt: "You are retiring an Avro field with no default. One consumer on the old schema runs only once a month. When can producers stop writing the field?",
      options: [
        "As soon as the always-on consumers have upgraded and look healthy",
        "Right away, since the monthly job can reread the older records it needs",
        "After that monthly consumer has been upgraded, even if that takes weeks",
        "After retention expires, since old records must leave the log first",
      ],
      correctIndex: 2,
      explanation: "Any reader on the old schema fails on a record without the field, including one that runs rarely. Producers wait for every reader. Retention concerns old records, which new readers handle already.",
      items: [1, 2],
    },
  }),
};
