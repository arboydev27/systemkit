import type { ReviewVariation } from "../../lib/review";

export const streamsReview: Record<string, ReviewVariation> = {
  "streams/st-batch-stream": {
    prompts: ["A factory wants overheating alarms and a yearly audit of its sensor logs. Which work suits a stream, which a batch job, and why?", "Before turning a working weekly attendance report into a live stream, what question would you ask, and what costs would you weigh?"],
    answer: "Batch fits input with a known end, so a job can finish and rerun; a stream fits decisions that lose value if late. Ask what decision changes if the number arrives sooner. A stream costs nonstop compute, state that survives crashes, out-of-order data, and harder reprocessing.",
  },
  "streams/st-log": {
    prompts: ["Moves in each game match must be read in order. How would you key a partitioned topic, and what order is not guaranteed?", "An alerting team and an analytics team both read one sensor stream. Why does one team’s lag not slow the other’s reading?"],
    answer: "Key by what must stay in sequence, the match, since order holds only inside a partition and different matches can interleave. Records stay until retention ends and each consumer group keeps its own offsets, so groups read independently. Partition count caps one group’s parallelism.",
  },
  "streams/st-delivery": {
    prompts: ["A fitness app consumes heart-rate samples and subscription renewals. Should each commit its offset before or after doing the work, and why?", "A vendor claims its pipeline delivers each message exactly once. What does that really mean, and where does the promise stop?"],
    answer: "Committing first can lose a record, which suits harmless samples; working first can repeat one, which suits records you cannot lose. Exactly once really means at-least-once delivery plus an idempotent or transactional effect. External calls sit outside that, needing the provider’s own idempotency or an accepted risk.",
  },
  "streams/st-cdc": {
    prompts: ["A clinic app updates its appointments table and then writes to a calendar cache. What can go wrong, and what would you build instead?", "A partner team asks to consume raw row changes from your reservations tables. Why might you refuse, and what would you offer instead?"],
    answer: "Dual writes can disagree after a crash or reach each copy in different orders. CDC follows committed changes in the database’s own log, keyed by primary key so each row stays in order. Raw events couple consumers to your tables, so give other teams designed outbox events.",
  },
  "streams/st-event-time": {
    prompts: ["Wildlife cameras upload sightings hours after they happen. Which timestamp should hourly counts use, and what new problem does that create?", "An ad-click counter closes each minute’s window after a 10-second wait. What does a longer wait trade, and why is none perfect?"],
    answer: "Use event time, when the thing happened, since processing time misplaces delayed data. That requires a watermark, an estimate that a window is complete. Waiting longer gives more complete but later results, yet stragglers still arrive, so choose a policy: drop and count, update the result, or a side output.",
  },
  "streams/st-schema": {
    prompts: ["A flight-status event changes so that new readers handle old records but old readers choke on new ones. Which side do you upgrade first?", "A weather-data producer shipped a new record format, consumers broke, and rolling the producer back did not stop the failures. Why?"],
    answer: "Backward compatible means new readers handle old data, forward compatible the reverse. A backward-only change needs consumers upgraded first; a forward-only change needs producers first. Rolling back a producer leaves what it wrote in the log until retention expires, so consumers keep reading those records.",
  },
};
