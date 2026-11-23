import { flowLesson } from "./flow-lesson";

export const ordinaryScaleTeachingContent = {
  "os-traffic": flowLesson("os-traffic", {
    kind: "flow",
    semanticIds: ["monthly-users", "workday-users", "daily-requests", "peak-rate"],
    points: [
      { title: "Start from who shows up", description: "Of 20,000 monthly active users, this example assumes 30% appear on a workday. That is 6,000 people, not 20,000.", items: [0, 1] },
      { title: "Turn people into a rate", description: "At an assumed 40 requests each, 6,000 people cause 240,000 requests a day. Over 28,800 working seconds that is about 8.3 per second, and an assumed factor of 3 gives 25 at peak.", items: [1, 2, 3] },
    ],
    prediction: {
      prompt: "A new page polls for updates, so each person now causes 120 requests a day instead of 40. With the other numbers in this diagram unchanged, what happens to the peak?",
      options: [
        "It stays at 25 requests per second, because user count has not changed",
        "It reaches 225 requests per second, because the peak factor applies again",
        "It reaches 75 requests per second, because the daily total triples",
        "It reaches 105 requests per second, because 80 extra requests are added",
      ],
      correctIndex: 2,
      explanation: "6,000 people × 120 = 720,000 requests a day. ÷ 28,800 seconds = 25 per second on average, and × 3 = 75 at peak. Tripling one input triples the result, even with the same users.",
      items: [2, 3],
    },
  }),
  "os-database": flowLesson("os-database", {
    kind: "comparison",
    semanticIds: ["index", "connection-limit", "long-transaction", "memory-pressure"],
    points: [
      { title: "Slower as data grows", description: "A missing index forces a scan that takes longer as rows accumulate. When data outgrows memory, more reads have to go to disk.", items: [0, 3] },
      { title: "Waiting, not working", description: "A connection limit or a long transaction can stall requests while CPU looks healthy, because they are waiting rather than working.", items: [1, 2] },
    ],
    prediction: {
      prompt: "A report page has slowed steadily for a year as one table grew. Connections, lock waits, and memory all look normal. Which limit fits best?",
      options: [
        "The connection limit, since waiting requests build up over time",
        "A missing index, so a scan takes longer as rows accumulate",
        "A long transaction, since its locks slow down that one table",
        "Memory pressure, since a table this large forces reads onto disk",
      ],
      correctIndex: 1,
      explanation: "Steady slowing tied to one table’s growth points to a scan. Connections, lock waits, and memory were checked and look normal, which removes the other three.",
      items: [0],
    },
  }),
  "os-monolith": flowLesson("os-monolith", {
    kind: "comparison",
    semanticIds: ["team-coordination", "deploy-conflicts", "independent-scaling", "failure-isolation"],
    points: [
      { title: "Pressure between people", description: "Team coordination and deploy conflicts slow delivery even while CPU and latency look healthy, so a load dashboard will not show them.", items: [0, 1] },
      { title: "Pressure between components", description: "Independent scaling and failure isolation apply when one part needs very different resources or keeps taking down unrelated features.", items: [2, 3] },
    ],
    prediction: {
      prompt: "Reports hog CPU at month end, so you run them in a separate worker pool from the same codebase, and the web app recovers. Has independent scaling now justified a service?",
      options: [
        "Yes, reports now scale separately, so they are in effect a service",
        "Yes, a module with its own scaling pattern needs its own deploy",
        "No, month-end load is too brief to justify a service in any case",
        "No, a separate pool met the need without a network boundary",
      ],
      correctIndex: 3,
      explanation: "The signal is that one part needs different resources and a separate worker pool was not enough. Here it was enough, so a service would add network calls and a contract without relieving any remaining pressure.",
      items: [2],
    },
  }),
  "os-cache-queue": flowLesson("os-cache-queue", {
    kind: "flow",
    semanticIds: ["query-fix", "index", "summary-table", "cache"],
    points: [
      { title: "Cheapest fixes first", description: "Fixing a query and adding an index require no new infrastructure, and either can cure a slow page.", items: [0, 1] },
      { title: "Then store computed results", description: "A summary table keeps precomputed totals inside the database. A cache adds a separate copy with staleness and invalidation to manage, so it needs measured evidence.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A monthly revenue chart aggregates millions of rows and stays slow even with the right index. It can safely be a day out of date. Which step fits next?",
      options: [
        "A second index on the same columns, which speeds up the aggregation",
        "A summary table refreshed nightly, which the chart reads directly",
        "A cache filled on first load with no expiry, so the chart stays fast",
        "A message queue, so that the chart request returns while the work runs",
      ],
      correctIndex: 1,
      explanation: "The total can be a day old and aggregation is the slow part, so precompute it once a day. A duplicate index adds nothing, a cache with no expiry goes stale indefinitely, and a queue leaves the same work to be done.",
      items: [2],
    },
  }),
  "os-availability": flowLesson("os-availability", {
    kind: "comparison",
    semanticIds: ["target-99", "target-99-5", "target-99-9", "target-99-99"],
    points: [
      { title: "Each nine divides the budget by ten", description: "Going from 99% to 99.9% to 99.99% cuts the monthly budget from 432 minutes to 43.2 and then to 4.32.", items: [0, 2, 3] },
      { title: "Compare the budget to a real restore", description: "An example 500 GB restore at 100 MB/s takes about 83 minutes, nearly twice what 99.9% allows in a month.", items: [2] },
    ],
    prediction: {
      prompt: "A contract moves from 99.9% to 99.99%, and your on-call engineer usually starts working on an alert about 10 minutes after it fires. What does that imply?",
      options: [
        "The target is met as long as engineers acknowledge every alert within 4 minutes",
        "The budget carries over from quiet months, so one 10-minute response still fits",
        "One paged response can use up the month’s budget, so failover must be automatic",
        "A second region is required, because one region cannot reach this availability",
      ],
      correctIndex: 2,
      explanation: "99.99% allows 4.32 minutes in a 30-day month, so a 10-minute response is over budget before any repair starts. Acknowledging is not recovering, a monthly budget does not carry over, and automated failover does not by itself require a second region.",
      items: [3],
    },
  }),
  "os-reversible": flowLesson("os-reversible", {
    kind: "comparison",
    semanticIds: ["data-model", "public-api", "data-ownership", "cache-or-broker"],
    points: [
      { title: "Expensive to change later", description: "The data model touches every table and query, a public API is a promise to customers, and shared ownership produces records that disagree.", items: [0, 1, 2] },
      { title: "Fine to add on evidence", description: "A cache or broker can usually be added later with little damage, because the change is mostly internal. Write down the evidence that would trigger it.", items: [3] },
    ],
    prediction: {
      prompt: "Your team has spent three weeks debating a job table or a broker for nightly reminder emails, with no measured problem yet. What should happen next?",
      options: [
        "Adopt the broker now, because moving later would mean rewriting each job",
        "Run a month-long benchmark of both, so the choice rests fully on evidence",
        "Hold a team vote and rule out revisiting it, so that no more time is lost",
        "Choose the job table, write down what would trigger a revisit, and move on",
      ],
      correctIndex: 3,
      explanation: "This choice is reversible and nightly reminders are a light load, so more debate buys little. A written trigger keeps the decision open to evidence without blocking the work now.",
      items: [3],
    },
  }),
};
