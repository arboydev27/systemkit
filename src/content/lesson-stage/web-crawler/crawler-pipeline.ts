import type { StageScene } from "../../../lib/lesson-stage/types";

// PLACEHOLDER: its author replaces this whole scene.
export const crawlerPipelineStage: StageScene = {
  id: "crawler-pipeline",
  intro: "Placeholder scene.",
  nodes: [
    { id: "client", role: "client", label: "Client", at: [0, 0] },
    { id: "api", role: "web", label: "Server", at: [1, 0] },
  ],
  links: [{ from: "client", to: "api" }],
  steps: [
    { title: "One", short: "One", text: "Placeholder.", events: [{ type: "packet", path: ["client", "api"], label: "request" }] },
    { title: "Two", short: "Two", text: "Placeholder.", events: [{ type: "packet", path: ["api", "client"], label: "reply", kind: "response" }] },
    { title: "Three", short: "Three", text: "Placeholder.", events: [{ type: "note", node: "api", text: "placeholder" }] },
  ],
};
