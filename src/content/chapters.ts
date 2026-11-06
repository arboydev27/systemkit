import { questions as scalingQuestions, steps as scalingSteps } from "./chapter";
import { frameworkQuestions, frameworkSteps } from "./framework";
import { estimationQuestions, estimationSteps } from "./estimation";
import { urlQuestions, urlSteps } from "./url-shortener";
import { chatQuestions, chatSteps } from "./chat";
import { youtubeQuestions, youtubeSteps } from "./youtube";
import { notificationQuestions, notificationSteps } from "./notifications";
import { rateLimiterQuestions, rateLimiterSteps } from "./rate-limiter";
import { feedQuestions, feedSteps } from "./news-feed";
import { autocompleteQuestions, autocompleteSteps } from "./autocomplete";
import { keyValueQuestions, keyValueSteps } from "./key-value";
import { hashingQuestions, hashingSteps } from "./consistent-hashing";
import { uniqueIdQuestions, uniqueIdSteps } from "./unique-id";
import { driveQuestions, driveSteps } from "./google-drive";
import { crawlerQuestions, crawlerSteps } from "./web-crawler";
import { ordinaryScaleQuestions, ordinaryScaleSteps } from "./ordinary-scale";
import { storageEnginesQuestions, storageEnginesSteps } from "./storage-engines";
import { replicationQuestions, replicationSteps } from "./replication";
import { transactionsQuestions, transactionsSteps } from "./transactions";
import { consensusQuestions, consensusSteps } from "./consensus";
import { streamsQuestions, streamsSteps } from "./streams";
import { patternsQuestions, patternsSteps } from "./patterns";
import type { Question, Step } from "./chapter";

export const coursePartTitles = ["Think like a designer", "How data behaves", "Keeping systems healthy", "Design real products"] as const;
const [method, data, health, products] = coursePartTitles;

export type Chapter = {
  id: "framework" | "scaling" | "estimation" | "url" | "chat" | "youtube" | "notification" | "rate-limiter" | "news-feed" | "autocomplete" | "key-value" | "consistent-hashing" | "unique-id" | "google-drive" | "web-crawler" | "ordinary-scale" | "storage-engines" | "replication" | "transactions" | "consensus" | "streams" | "patterns";
  number: string;
  part: (typeof coursePartTitles)[number];
  title: string;
  /** What someone would search for, used as the chapter page title. */
  seoTitle: string;
  /** Two or three sentences for the chapter page: what it covers and why it matters. */
  summary: string;
  lessonLabel: string;
  diagramHeading: string;
  diagramHint: string;
  storageKey: string;
  steps: Step[];
  questions: Question[];
};

// Listed in teaching order: building blocks come before the products that use them.
// Storage keys and ids never change with this order, so saved progress and links keep working.
const course: Omit<Chapter, "number">[] = [
  {
    id: "framework",
    part: method,
    title: "System Design Framework",
    seoTitle: "System design framework: how to approach any design",
    summary: "A repeatable method for turning a vague request into a design you can defend: scope, requirements, rough numbers, a blueprint, and a deep dive where the risk is. It works in an interview and in a design review at work.",
    lessonLabel: "THE DESIGN METHOD",
    diagramHeading: "The decision path",
    diagramHint: "Follow how each decision narrows and strengthens the design.",
    storageKey: "systemkit:framework:v1",
    steps: frameworkSteps,
    questions: frameworkQuestions,
  },
  {
    id: "estimation",
    part: method,
    title: "Estimating a System",
    seoTitle: "Back-of-the-envelope estimation for system design",
    summary: "Rough numbers decide more designs than clever diagrams do. Learn to turn users into requests, storage, and bandwidth with visible units, then use the result to make a real decision.",
    lessonLabel: "MAKE THE NUMBERS USEFUL",
    diagramHeading: "The calculation",
    diagramHint: "Follow the units from assumptions to a capacity decision.",
    storageKey: "systemkit:estimation:v1",
    steps: estimationSteps,
    questions: estimationQuestions,
  },
  {
    id: "scaling",
    part: method,
    title: "Scale to a Million Users",
    seoTitle: "How to scale a web app from one server to millions of users",
    summary: "Grow one system step by step: split tiers, add load balancing, replication, caching, a CDN, queues, and sharding. Each step answers a specific pressure and brings a new cost, and the chapter ends with a full design of your own.",
    lessonLabel: "THE ARCHITECTURE",
    diagramHeading: "The architecture",
    diagramHint: "Follow each connection from the user to the data layer.",
    storageKey: "systemkit:chapter-one:v1",
    steps: scalingSteps,
    questions: scalingQuestions,
  },
  {
    id: "ordinary-scale",
    part: method,
    title: "Design at Ordinary Scale",
    seoTitle: "Do you need it? System design for ordinary scale",
    summary: "Most systems are smaller than the examples in books. Work out how big yours really is, how far one database goes, and when a cache, a queue, or a second service earns its keep. It also covers what evidence should change your mind.",
    lessonLabel: "DO YOU NEED THIS AT ALL?",
    diagramHeading: "The decision",
    diagramHint: "Compare the simple option with what the extra machinery would buy.",
    storageKey: "systemkit:ordinary-scale:v1",
    steps: ordinaryScaleSteps,
    questions: ordinaryScaleQuestions,
  },
  {
    id: "storage-engines",
    part: data,
    title: "Storage Engines",
    seoTitle: "LSM trees vs B-trees: how database storage engines work",
    summary: "What actually happens to your data on disk. Start from a simple log, build up to LSM trees and B-trees, compare them by read, write, and space amplification, and see why analytics needs a different layout.",
    lessonLabel: "INSIDE THE DATABASE",
    diagramHeading: "The write path",
    diagramHint: "Follow data from a write to where it finally rests on disk.",
    storageKey: "systemkit:storage-engines:v1",
    steps: storageEnginesSteps,
    questions: storageEnginesQuestions,
  },
  {
    id: "replication",
    part: data,
    title: "Replication and Read Consistency",
    seoTitle: "Database replication: lag, failover, and read consistency",
    summary: "Copies are how databases survive failure, and also why users see stale data. Covers synchronous and asynchronous replication, read-your-writes, failover and split brain, and how to choose among single-leader, multi-leader, and leaderless designs.",
    lessonLabel: "KEEPING COPIES",
    diagramHeading: "The replication path",
    diagramHint: "Follow a write to each copy, and see what a read can miss.",
    storageKey: "systemkit:replication:v1",
    steps: replicationSteps,
    questions: replicationQuestions,
  },
  {
    id: "consistent-hashing",
    part: data,
    title: "Consistent Hashing",
    seoTitle: "Consistent hashing explained, with virtual nodes",
    summary: "How to place data across nodes so that adding or losing one moves as little as possible. Covers the hash ring, virtual nodes, replica placement, and what balance really means when some keys are far hotter than others.",
    lessonLabel: "DATA PLACEMENT STUDY",
    diagramHeading: "The placement map",
    diagramHint: "Compare how each placement rule assigns keys to nodes.",
    storageKey: "systemkit:consistent-hashing:v1",
    steps: hashingSteps,
    questions: hashingQuestions,
  },
  {
    id: "key-value",
    part: data,
    title: "Key-Value Store",
    seoTitle: "Design a distributed key-value store",
    summary: "Build up a Dynamo-style store: partitioning, replication, quorums, versioning, failure detection, and repair. It puts the tradeoffs between consistency and availability into concrete read and write paths.",
    lessonLabel: "DISTRIBUTED STORAGE STUDY",
    diagramHeading: "The storage path",
    diagramHint: "Trace placement, replication, consistency, and repair.",
    storageKey: "systemkit:key-value:v1",
    steps: keyValueSteps,
    questions: keyValueQuestions,
  },
  {
    id: "transactions",
    part: data,
    title: "Transactions and Isolation",
    seoTitle: "Transactions and isolation levels, explained with examples",
    summary: "What a transaction really promises, and what each isolation level still lets through. Walk through dirty reads, lost updates, and write skew using money movement and seat booking, then learn how to choose a level on purpose.",
    lessonLabel: "CONCURRENCY WITHOUT SURPRISES",
    diagramHeading: "The interleaving",
    diagramHint: "Follow two transactions step by step to see where they collide.",
    storageKey: "systemkit:transactions:v1",
    steps: transactionsSteps,
    questions: transactionsQuestions,
  },
  {
    id: "consensus",
    part: data,
    title: "Consensus, CAP, and Ordering",
    seoTitle: "Consensus, CAP, and linearizability without the hand-waving",
    summary: "How machines agree when clocks drift and networks fail. Covers what linearizability means, CAP stated honestly, logical clocks, leader election with fencing tokens, and when to use a coordination service rather than build your own.",
    lessonLabel: "GETTING MACHINES TO AGREE",
    diagramHeading: "The agreement path",
    diagramHint: "Follow how nodes reach, or fail to reach, one agreed answer.",
    storageKey: "systemkit:consensus:v1",
    steps: consensusSteps,
    questions: consensusQuestions,
  },
  {
    id: "streams",
    part: data,
    title: "Streams and Schema Evolution",
    seoTitle: "Stream processing, change data capture, and schema evolution",
    summary: "Moving data between systems without losing or corrupting it. Covers logs and consumer groups, what exactly-once really means, change data capture, event time and late data, and how to change a schema without breaking anyone.",
    lessonLabel: "DATA IN MOTION",
    diagramHeading: "The data flow",
    diagramHint: "Follow an event from where it is produced to everything that consumes it.",
    storageKey: "systemkit:streams:v1",
    steps: streamsSteps,
    questions: streamsQuestions,
  },
  {
    id: "unique-id",
    part: data,
    title: "Unique ID Generator",
    seoTitle: "Design a unique ID generator: Snowflake and UUIDv7",
    summary: "Generate IDs across many machines without a bottleneck. Compare central sequences, leased ranges, UUIDs, and time-ordered layouts, and see what happens when a clock moves backward.",
    lessonLabel: "DISTRIBUTED IDENTITY STUDY",
    diagramHeading: "The ID path",
    diagramHint: "Follow the bit budget and failure rules behind unique IDs.",
    storageKey: "systemkit:unique-id:v1",
    steps: uniqueIdSteps,
    questions: uniqueIdQuestions,
  },
  {
    id: "patterns",
    part: health,
    title: "Reliability Patterns",
    seoTitle: "Reliability patterns: idempotency, outbox, retries, backpressure",
    summary: "The handful of techniques that recur across almost every system: idempotency keys, the transactional outbox, retries with backoff and jitter, circuit breakers, backpressure, and cache stampede protection. Learn each by the failure it prevents.",
    lessonLabel: "PATTERNS THAT RECUR",
    diagramHeading: "The failure path",
    diagramHint: "Follow the failure, then see where the pattern interrupts it.",
    storageKey: "systemkit:patterns:v1",
    steps: patternsSteps,
    questions: patternsQuestions,
  },
  {
    id: "rate-limiter",
    part: health,
    title: "Rate Limiter",
    seoTitle: "Design a rate limiter: token bucket and sliding window",
    summary: "Protect a service from overload and abuse. Compare token bucket and window algorithms, keep counters correct under concurrency, and decide what should happen when the limiter itself fails.",
    lessonLabel: "TRAFFIC CONTROL DESIGN STUDY",
    diagramHeading: "The decision path",
    diagramHint: "Trace the quota decision before a request reaches the API.",
    storageKey: "systemkit:rate-limiter:v1",
    steps: rateLimiterSteps,
    questions: rateLimiterQuestions,
  },
  {
    id: "url",
    part: products,
    title: "URL Shortener",
    seoTitle: "Design a URL shortener",
    summary: "A small system with real decisions: how to generate short codes, which redirect status to return, how to serve heavy reads, and how to stop abuse. A good first full design.",
    lessonLabel: "FIRST DESIGN STUDY",
    diagramHeading: "The system",
    diagramHint: "Trace creation and redirect paths before adding scale.",
    storageKey: "systemkit:url-shortener:v1",
    steps: urlSteps,
    questions: urlQuestions,
  },
  {
    id: "notification",
    part: products,
    title: "Notification System",
    seoTitle: "Design a notification system",
    summary: "Deliver push, email, and SMS reliably across providers that fail in different ways. Covers queues, retries, deduplication, user preferences, and what you can and cannot promise about delivery.",
    lessonLabel: "DELIVERY DESIGN STUDY",
    diagramHeading: "The delivery path",
    diagramHint: "Follow a notification from event to channel delivery and recovery.",
    storageKey: "systemkit:notification:v1",
    steps: notificationSteps,
    questions: notificationQuestions,
  },
  {
    id: "chat",
    part: products,
    title: "Chat System",
    seoTitle: "Design a chat system like WhatsApp or Slack",
    summary: "Keep connections open, persist a message before claiming it was sent, deliver to online and offline devices, and recover after a gateway fails. Also covers ordering, group fanout, and presence.",
    lessonLabel: "REAL-TIME DESIGN STUDY",
    diagramHeading: "The message path",
    diagramHint: "Follow connection, delivery, and recovery as separate steps.",
    storageKey: "systemkit:chat:v1",
    steps: chatSteps,
    questions: chatQuestions,
  },
  {
    id: "news-feed",
    part: products,
    title: "News Feed",
    seoTitle: "Design a news feed: fan-out on write vs read",
    summary: "Decide when a post reaches its readers. Compare fan-out on write and on read, handle accounts with millions of followers, and paginate a feed that keeps changing underneath the reader.",
    lessonLabel: "FANOUT DESIGN STUDY",
    diagramHeading: "The feed path",
    diagramHint: "Compare how posts reach readers through fanout and retrieval.",
    storageKey: "systemkit:news-feed:v1",
    steps: feedSteps,
    questions: feedQuestions,
  },
  {
    id: "autocomplete",
    part: products,
    title: "Search Autocomplete",
    seoTitle: "Design search autocomplete with a trie",
    summary: "Answer every keystroke within milliseconds. Covers prefix lookups, precomputed suggestions, the pipeline that builds them from query logs, and how to keep the results fresh and safe.",
    lessonLabel: "SEARCH DESIGN STUDY",
    diagramHeading: "The suggestion path",
    diagramHint: "Follow a prefix from request to ranked suggestions.",
    storageKey: "systemkit:autocomplete:v1",
    steps: autocompleteSteps,
    questions: autocompleteQuestions,
  },
  {
    id: "youtube",
    part: products,
    title: "YouTube",
    seoTitle: "Design YouTube: video upload, transcoding, and streaming",
    summary: "Upload and playback are very different workloads. Work through resumable uploads, a transcoding pipeline, adaptive streaming, and CDN delivery, along with the costs that shape the design.",
    lessonLabel: "VIDEO DESIGN STUDY",
    diagramHeading: "The video path",
    diagramHint: "Trace upload, processing, and playback through the system.",
    storageKey: "systemkit:youtube:v1",
    steps: youtubeSteps,
    questions: youtubeQuestions,
  },
  {
    id: "google-drive",
    part: products,
    title: "Google Drive",
    seoTitle: "Design Google Drive: file sync and conflict handling",
    summary: "Keep files in sync across devices without losing anyone's work. Covers chunked uploads, metadata, change logs and sync cursors, conflict copies, and sharing.",
    lessonLabel: "FILE SYNC DESIGN STUDY",
    diagramHeading: "The file path",
    diagramHint: "Trace upload, metadata, sync, sharing, and recovery.",
    storageKey: "systemkit:google-drive:v1",
    steps: driveSteps,
    questions: driveQuestions,
  },
  {
    id: "web-crawler",
    part: products,
    title: "Web Crawler",
    seoTitle: "Design a web crawler: URL frontier and politeness",
    summary: "Fetch the web without overwhelming it. Covers the URL frontier, politeness per host, robots.txt, deduplication, freshness, and the traps that catch a naive crawler.",
    lessonLabel: "WEB DISCOVERY DESIGN STUDY",
    diagramHeading: "The crawl path",
    diagramHint: "Follow a URL from scheduling through fetching and discovery.",
    storageKey: "systemkit:web-crawler:v1",
    steps: crawlerSteps,
    questions: crawlerQuestions,
  },
];

export const chapters: Chapter[] = course.map((chapter, index) => ({
  ...chapter,
  number: String(index + 1).padStart(2, "0"),
}));

export const goalPaths: Record<"interview" | "work" | "foundations", { label: string; detail: string; order: Chapter["id"][] }> = {
  interview: {
    label: "A system design interview",
    detail: "The method and estimation first, then the product designs interviewers ask about most, then the data ideas that help you go deeper.",
    order: ["framework", "estimation", "scaling", "url", "rate-limiter", "chat", "news-feed", "notification", "key-value", "consistent-hashing", "unique-id", "autocomplete", "youtube", "google-drive", "web-crawler", "patterns", "replication", "transactions", "consensus", "storage-engines", "streams", "ordinary-scale"],
  },
  work: {
    label: "Better design decisions at work",
    detail: "Start with judgment about what your system actually needs, then the reliability and data ideas you are most likely to use this year.",
    order: ["ordinary-scale", "estimation", "patterns", "transactions", "replication", "storage-engines", "streams", "framework", "scaling", "rate-limiter", "consensus", "consistent-hashing", "key-value", "unique-id", "notification", "url", "chat", "news-feed", "autocomplete", "youtube", "google-drive", "web-crawler"],
  },
  foundations: {
    label: "Solid fundamentals, in order",
    detail: "The full path as written: how to think, how data behaves, how to keep systems healthy, then complete product designs.",
    order: ["framework", "estimation", "scaling", "ordinary-scale", "storage-engines", "replication", "consistent-hashing", "key-value", "transactions", "consensus", "streams", "unique-id", "patterns", "rate-limiter", "url", "notification", "chat", "news-feed", "autocomplete", "youtube", "google-drive", "web-crawler"],
  },
};
