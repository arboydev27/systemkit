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
import type { Question, Step } from "./chapter";

export type Chapter = {
  id: "framework" | "scaling" | "estimation" | "url" | "chat" | "youtube" | "notification" | "rate-limiter" | "news-feed" | "autocomplete";
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
];
