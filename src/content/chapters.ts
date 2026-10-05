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
import type { Question, Step } from "./chapter";

export type Chapter = {
  id: "framework" | "scaling" | "estimation" | "url" | "chat" | "youtube" | "notification" | "rate-limiter" | "news-feed" | "autocomplete" | "key-value" | "consistent-hashing" | "unique-id" | "google-drive" | "web-crawler";
  number: string;
  title: string;
  lessonLabel: string;
  diagramHeading: string;
  diagramHint: string;
  storageKey: string;
  steps: Step[];
  questions: Question[];
};

export const chapters: Chapter[] = [
  {
    id: "framework",
    number: "01",
    title: "System Design Framework",
    lessonLabel: "THE DESIGN METHOD",
    diagramHeading: "The decision path",
    diagramHint: "Follow how each decision narrows and strengthens the design.",
    storageKey: "systemkit:framework:v1",
    steps: frameworkSteps,
    questions: frameworkQuestions,
  },
  {
    id: "scaling",
    number: "02",
    title: "Scale to a Million Users",
    lessonLabel: "THE ARCHITECTURE",
    diagramHeading: "The architecture",
    diagramHint: "Follow each connection from the user to the data layer.",
    storageKey: "systemkit:chapter-one:v1",
    steps: scalingSteps,
    questions: scalingQuestions,
  },
  {
    id: "estimation",
    number: "03",
    title: "Estimating a System",
    lessonLabel: "MAKE THE NUMBERS USEFUL",
    diagramHeading: "The calculation",
    diagramHint: "Follow the units from assumptions to a capacity decision.",
    storageKey: "systemkit:estimation:v1",
    steps: estimationSteps,
    questions: estimationQuestions,
  },
  {
    id: "url",
    number: "04",
    title: "URL Shortener",
    lessonLabel: "FIRST DESIGN STUDY",
    diagramHeading: "The system",
    diagramHint: "Trace creation and redirect paths before adding scale.",
    storageKey: "systemkit:url-shortener:v1",
    steps: urlSteps,
    questions: urlQuestions,
  },
  {
    id: "chat",
    number: "05",
    title: "Chat System",
    lessonLabel: "REAL-TIME DESIGN STUDY",
    diagramHeading: "The message path",
    diagramHint: "Follow connection, delivery, and recovery as separate steps.",
    storageKey: "systemkit:chat:v1",
    steps: chatSteps,
    questions: chatQuestions,
  },
  {
    id: "youtube",
    number: "06",
    title: "YouTube",
    lessonLabel: "VIDEO DESIGN STUDY",
    diagramHeading: "The video path",
    diagramHint: "Trace upload, processing, and playback through the system.",
    storageKey: "systemkit:youtube:v1",
    steps: youtubeSteps,
    questions: youtubeQuestions,
  },
  {
    id: "notification",
    number: "07",
    title: "Notification System",
    lessonLabel: "DELIVERY DESIGN STUDY",
    diagramHeading: "The delivery path",
    diagramHint: "Follow a notification from event to channel delivery and recovery.",
    storageKey: "systemkit:notification:v1",
    steps: notificationSteps,
    questions: notificationQuestions,
  },
  {
    id: "rate-limiter",
    number: "08",
    title: "Rate Limiter",
    lessonLabel: "TRAFFIC CONTROL DESIGN STUDY",
    diagramHeading: "The decision path",
    diagramHint: "Trace the quota decision before a request reaches the API.",
    storageKey: "systemkit:rate-limiter:v1",
    steps: rateLimiterSteps,
    questions: rateLimiterQuestions,
  },
  {
    id: "news-feed",
    number: "09",
    title: "News Feed",
    lessonLabel: "FANOUT DESIGN STUDY",
    diagramHeading: "The feed path",
    diagramHint: "Compare how posts reach readers through fanout and retrieval.",
    storageKey: "systemkit:news-feed:v1",
    steps: feedSteps,
    questions: feedQuestions,
  },
  {
    id: "autocomplete",
    number: "10",
    title: "Search Autocomplete",
    lessonLabel: "SEARCH DESIGN STUDY",
    diagramHeading: "The suggestion path",
    diagramHint: "Follow a prefix from request to ranked suggestions.",
    storageKey: "systemkit:autocomplete:v1",
    steps: autocompleteSteps,
    questions: autocompleteQuestions,
  },
  {
    id: "key-value",
    number: "11",
    title: "Key-Value Store",
    lessonLabel: "DISTRIBUTED STORAGE STUDY",
    diagramHeading: "The storage path",
    diagramHint: "Trace placement, replication, consistency, and repair.",
    storageKey: "systemkit:key-value:v1",
    steps: keyValueSteps,
    questions: keyValueQuestions,
  },
  {
    id: "consistent-hashing",
    number: "12",
    title: "Consistent Hashing",
    lessonLabel: "DATA PLACEMENT STUDY",
    diagramHeading: "The placement map",
    diagramHint: "See how keys move as membership changes.",
    storageKey: "systemkit:consistent-hashing:v1",
    steps: hashingSteps,
    questions: hashingQuestions,
  },
  {
    id: "unique-id",
    number: "13",
    title: "Unique ID Generator",
    lessonLabel: "DISTRIBUTED IDENTITY STUDY",
    diagramHeading: "The ID path",
    diagramHint: "Follow the bit budget and failure rules behind unique IDs.",
    storageKey: "systemkit:unique-id:v1",
    steps: uniqueIdSteps,
    questions: uniqueIdQuestions,
  },
  {
    id: "google-drive",
    number: "14",
    title: "Google Drive",
    lessonLabel: "FILE SYNC DESIGN STUDY",
    diagramHeading: "The file path",
    diagramHint: "Trace upload, metadata, sync, sharing, and recovery.",
    storageKey: "systemkit:google-drive:v1",
    steps: driveSteps,
    questions: driveQuestions,
  },
  {
    id: "web-crawler",
    number: "15",
    title: "Web Crawler",
    lessonLabel: "WEB DISCOVERY DESIGN STUDY",
    diagramHeading: "The crawl path",
    diagramHint: "Follow a URL from scheduling through fetching and discovery.",
    storageKey: "systemkit:web-crawler:v1",
    steps: crawlerSteps,
    questions: crawlerQuestions,
  },
];
