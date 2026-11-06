import type { DesignChallengeContent } from "../design-challenge";

export const invoicingSaasChallenge: DesignChallengeContent = {
  id: "invoicing-saas",
  chapterId: "ordinary-scale",
  stepId: "os-reversible",
  minutes: 30,
  adaptationTitle: "The large customer",
  title: "Design invoicing software for 500 small businesses",
  summary: "Size an ordinary B2B product honestly, keep the design as small as the numbers allow, then see which new demand actually changes it.",
  brief: "Small businesses use your product to create invoices, email them as PDFs, record payments, and see what is overdue. You have 500 customers and a team of 3 engineers, with no dedicated operations staff. Card processing, tax calculation across countries, and a public API are outside this exercise.",
  assumptions: [
    "Each customer has 4 staff users. On a working day half of all users are active, and each causes 100 requests within an 8-hour day. Peak is 3 times that day’s average.",
    "Each customer issues 200 invoices a month. Half of all invoices go out in the last 2 working days of the month, 8 hours each.",
    "An invoice is about 5 KB of database rows plus a 200 KB PDF, and rendering a PDF takes 2 CPU-seconds. Use decimal units. Keep invoices for 7 years.",
    "Targets: 99.9% availability in a 30-day month, an RPO of 5 minutes, and an RTO of 30 minutes. Assume a database restores at 100 MB/s. Nobody is paged overnight, so a night-time failure must recover on its own.",
    "An issued invoice is a financial record. Corrections happen through a new document, such as a credit note, and never by editing the old one.",
  ],
  change: "A large customer signs on. It will issue 30,000 invoices in one run on the last working day of each month, all of them out within 2 hours. Its auditors also require a record of who created or changed each invoice, when, and what changed, kept for 7 years, with evidence that the record was not edited afterward. Size the run, decide what has to change, and say which demand would have been harder to add late.",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and assumptions. Estimate peak requests per second, month-end invoice and PDF-rendering rates, and 7-year storage for rows and PDFs. Say which number, if any, could actually hurt you.",
      placeholder: "I would support…\nPeak requests per second = …\nMonth-end invoices per second = …\nCPU cores for rendering = …\nStorage over 7 years = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the fewest components you can defend and what each stores or does. Trace issuing one invoice from the click to the emailed PDF. Note the data-model decisions that would be hard to undo.",
      placeholder: "Components: …\nIssue: user → …\nHard to undo: …",
    },
    {
      id: "resilience",
      title: "Recovery and failure",
      prompt: "Explain how you meet the RPO and RTO, and check them against the 99.9% budget. Say what happens if a worker crashes mid-render, and how you know your backups work.",
      placeholder: "99.9% allows…\nIf a worker crashes…\nI would test restores by…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the large customer below. Size the 2-hour run first, then say what you would change for capacity and for the audit record, and name one cost of your choice.",
      placeholder: "The run needs…\nFor capacity I would…\nFor audit I would…\nThe cost is…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I show units, use working hours for business traffic, separate the average from month-end, and say which number could actually hurt." },
    { id: "earned", title: "Each component earns its place.", detail: "For anything beyond an app, a database, and object storage, I name the evidence that justifies it or would trigger it later." },
    { id: "undo", title: "The hard-to-undo parts got the most care.", detail: "I cover customer ownership on every row, immutable issued invoices, and how money is stored." },
    { id: "recovery", title: "Recovery numbers are tested, not assumed.", detail: "I state how I meet the RPO and RTO, how a restore is timed, and how the night-time case recovers with nobody paged." },
    { id: "change", title: "The change got a specific answer.", detail: "I size the 2-hour run, write audit records in the same transaction as each change, explain why they can be trusted, and name one cost." },
  ],
  estimateGuide: "Traffic: 500 × 4 = 2,000 users; half active = 1,000; × 100 = 100,000 requests/day; ÷ 28,800 s ≈ 3.5 requests/s; × 3 ≈ 10 requests/s at peak. Invoices: 500 × 200 = 100,000/month; half in the last 2 working days = 50,000 ÷ 57,600 s ≈ 0.87 invoices/s, or about 1.7 CPU cores of rendering at 2 CPU-seconds each. Storage at today’s volume: rows are 500 MB/month, 6 GB/year, and 42 GB over 7 years; PDFs are 20 GB/month, 240 GB/year, and 1.68 TB over 7 years, before indexes and copies. Availability: 99.9% of 43,200 minutes allows 43.2 minutes a month. Restoring 42 GB at 100 MB/s takes 420 s, or 7 minutes, before log replay, which fits a 30-minute RTO if a drill confirms it. The large customer: 30,000 ÷ 7,200 s ≈ 4.2 invoices/s, about 8.3 cores. With the regular month-end load, that is about 5 invoices/s and 10 cores for the 2-hour window, and its PDFs add 6 GB/month, or 72 GB/year. Rendering CPU is the number to plan for; nothing here suggests more than one database, though a benchmark should confirm that.",
  solutions: [
    {
      id: "simple",
      title: "One app, one database, and a job table",
      approach: "Run a modular monolith on a managed platform: 2 app instances (for deploys and machine failure, not throughput), one managed Postgres with an automatic-failover standby in a second zone and point-in-time recovery, object storage for PDFs, and worker processes from the same codebase reading a job table. Every table carries a customer ID, money is stored as integer minor units such as cents, and issued invoices are immutable. There is no cache and no broker, because nothing in the estimates calls for them.",
      paths: [
        "Issue: in one transaction, the API takes the next number from a per-customer counter row, writes the invoice and line items as issued, and inserts a render job. It responds once that commits.",
        "Render and send: a worker claims the job with FOR UPDATE SKIP LOCKED and a lease (a claim that expires after a deadline), renders the PDF to object storage under a key built from the invoice ID, records that, and inserts an email job. A retry renders the same invoice to the same key.",
        "Read: list pages use an index on (customer_id, status, issued_at) with pagination. PDFs download through short-lived signed object-storage URLs, so the app does not carry the bytes.",
      ],
      failure: "A crashed worker’s lease expires and another worker retries the render, which is safe to repeat. An email can still go out twice if a worker crashes between sending and recording it, so pass an idempotency key if the provider supports one and accept a rare duplicate otherwise. Automatic failover to the standby covers machine and zone loss with nobody paged. Point-in-time recovery covers bad writes and scripts, provided the write-ahead log is archived at least every 5 minutes to meet the RPO (check your provider’s interval), and a monthly timed restore checks the 30-minute RTO. Watch the oldest job’s age, p95 latency, database CPU, and connections.",
      adaptation: "The run is about 4.2 invoices/s and, with regular month-end load, about 10 CPU cores of rendering for 2 hours. Start extra worker instances for that window, load-test the run on a copy first, and cap how many jobs one customer can have running so small customers are not starved. For audit, write an append-only invoice_events row in the same transaction as every change, deny the app’s database role UPDATE and DELETE on that table, and export events daily to object storage with a retention lock (S3 Object Lock is one example). Audit is the harder demand to add late, because history you did not record cannot be recreated; here the customer is new, so recording can start before its first invoice.",
      tradeoff: "Three people can run this, and the database is the one component that needs close attention. Workers share that database with user traffic, so a month-end run can slow the app unless you watch and cap it. Events that have not yet been exported rest on trusting whoever administers the database. Revisit if job queries rank among your costliest or user latency slips during the run.",
    },
    {
      id: "machinery",
      title: "The same core, plus a managed queue and a separate audit store",
      approach: "Keep the modular monolith, managed Postgres, and object storage. Add a managed queue (SQS is one example) between the app and rendering, autoscaled render workers as their own deployable, a read replica for reports and exports, and an audit store outside the primary database. This buys isolation: rendering and job polling leave the primary database, and render workers cost little outside the month-end window. It does not buy throughput these estimates need.",
      paths: [
        "Issue: in one transaction, the API writes the invoice, its line items, an audit event, and an outbox row (a record of a message still to publish). A dispatcher publishes outbox rows to the queue and marks them sent. A crash can publish a row twice, so consumers deduplicate on invoice ID.",
        "Render and send: workers scale with queue depth, render to the same deterministic key, and record the result through the app, which queues the email. After repeated failures a job moves to a dead-letter queue (a holding area for messages that keep failing) for someone to inspect.",
        "Read: normal pages read the primary through the same indexes. Reports and audit exports read the replica and accept its replication lag.",
      ],
      failure: "If the queue is unavailable, the outbox holds the work and the dispatcher retries, so the database remains the record of what should exist. A reconciliation job finds invoices issued but not rendered after a deadline. Database recovery works as in the simple design, and the replica is not a backup. There is more to watch: queue age, dead-letter count, dispatcher lag, replica lag, and autoscaling failures, each with an alert someone understands.",
      adaptation: "Queue depth takes render workers to about 10 cores for the run and back down afterward, and a separate queue for the large customer keeps small customers’ invoices moving. For audit, copy each event from the outbox to retention-locked object storage with a hash chain (each event includes a hash of the one before it), so auditors can check for later edits without trusting whoever administers the primary database. Audit is still the harder demand to add late, since unrecorded history cannot be recreated.",
      tradeoff: "Render load is isolated from user traffic, idle workers cost little, and the audit evidence is stronger. In return, three people run several more components and handle repeated delivery everywhere. At about 5 invoices/s, throughput alone does not justify this. It becomes the better design if load tests show the run hurting users, or if auditors reject evidence held in the application’s own database.",
    },
  ],
};
