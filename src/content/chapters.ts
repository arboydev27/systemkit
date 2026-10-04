import { questions as scalingQuestions, steps as scalingSteps } from "./chapter";
import { frameworkQuestions, frameworkSteps } from "./framework";
import type { Question, Step } from "./chapter";

export type Chapter = {
  id: "framework" | "scaling";
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
];
