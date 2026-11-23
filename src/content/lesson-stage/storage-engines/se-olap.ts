import type { StageScene } from "../../../lib/lesson-stage/types";

// Placeholder while the lesson's stage is written.
export const seOlapStage: StageScene = {
  id: "se-olap",
  intro: "Placeholder.",
  nodes: [{ id: "a", role: "web", label: "Placeholder", at: [0, 0] }],
  links: [],
  steps: [
    { title: "One", short: "One", text: "Placeholder.", events: [{ type: "note", node: "a", text: "one" }] },
    { title: "Two", short: "Two", text: "Placeholder.", events: [{ type: "note", node: "a", text: "two" }] },
    { title: "Three", short: "Three", text: "Placeholder.", events: [{ type: "note", node: "a", text: "three" }] },
  ],
};
