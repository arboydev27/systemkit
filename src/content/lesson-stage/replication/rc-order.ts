import type { StageScene } from "../../../lib/lesson-stage/types";

// STUB: replaced by the lesson's scene.
export const rcOrderStage: StageScene = {
  id: "rc-order",
  intro: "This lesson stage is being written.",
  nodes: [{ id: "a", role: "client", label: "Placeholder", at: [0, 0] }],
  links: [],
  steps: [
    { title: "One", short: "One", text: "Placeholder step.", events: [{ type: "note", node: "a", text: "one" }] },
    { title: "Two", short: "Two", text: "Placeholder step.", events: [{ type: "note", node: "a", text: "two" }] },
    { title: "Three", short: "Three", text: "Placeholder step.", events: [{ type: "note", node: "a", text: "three" }] },
  ],
};
