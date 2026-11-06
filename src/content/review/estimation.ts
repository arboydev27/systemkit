import type { ReviewVariation } from "../../lib/review";

export const estimationReview: Record<string, ReviewVariation> = {
  "estimation/estimate-workload": {
    prompts: ["A teammate’s estimate for a language-learning app just says ‘3 million requests a day’. What should it show so you can challenge it?", "A tax filing service is busy for only a few weeks each year. Why would a typical day’s active users mislead your estimate?"],
    answer: "A useful estimate states active users rather than registered accounts, actions per active person, read-to-write mix, and item size, each with its unit. It also picks a fitting time window: a seasonal product should be sized from its busiest day, not a typical one.",
  },
  "estimation/estimate-traffic": {
    prompts: ["An online game releases an update at noon, and players rush in within a minute. Why might neither the daily average nor autoscaling protect it?", "Your finance lead asks why servers sit mostly idle overnight. How do you justify capacity well above the daily average request rate?"],
    answer: "Dividing a daily total by 86,400 gives only an average, and real traffic bunches into peaks. Plan for the worst burst the product must handle, plus room for a failed instance and growth; idle hours are the price. Autoscaling helps with slow climbs, but starting new instances can take minutes.",
  },
  "estimation/estimate-data": {
    prompts: ["A team sized disks for a software download site and says hosting is budgeted. Which separate estimate did they skip, and what drives it?", "A records archive keeps scanned documents for ten years, and storage costs keep climbing. What inputs drive that bill, and which lever would you pull?"],
    answer: "Storage follows new items, stored size, and retention, plus physical extras like replicas, renditions, and backups. Shifting older data to a colder tier cuts cost but can slow retrieval or make it pricier. Delivery is a separate sum: reads times bytes delivered per read, converted to bits for network links.",
  },
  "estimation/estimate-limits": {
    prompts: ["A booking request passes through five services, each with a 50 ms p95. Can you promise users a 250 ms p95? Explain.", "A manager asks for 99.95% uptime on an internal wiki. How would you make that request concrete and question it?"],
    answer: "No promise follows from the sum, because percentiles do not add and each service’s slow cases may not coincide; only an end-to-end measurement tells you. As time, 99.95% allows about 21.6 minutes in a 30-day month, and higher targets cost more, which an internal tool rarely justifies.",
  },
  "estimation/estimate-decisions": {
    prompts: ["Your capacity model has five guessed inputs and one week to check them. How do you choose which to measure first?", "Three instances peak at your 50% utilization target. What happens when one fails, and how do you decide whether to pay for a fourth?"],
    answer: "Losing one of three pushes the other two to 75%, above target but below the tested limit. A load test shows whether a spare, called N+1, is worth paying for. Measure first the guess whose doubling would change a component choice; cheap, reversible choices can wait.",
  },
};
