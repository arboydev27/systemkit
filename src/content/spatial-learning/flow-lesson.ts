import type { TeachingContent } from "../../lib/spatial-learning-types";

export type FlowLessonSource = {
  /** Stable identities, one per diagram item. Reuse an identity when the same thing recurs across lessons. */
  semanticIds: string[];
  /** Flow diagrams connect each item to the next; comparison diagrams have no connections. */
  kind: "flow" | "comparison";
  points: { title: string; description: string; items: number[] }[];
  prediction: { prompt: string; options: string[]; correctIndex: number; explanation: string; items: number[] };
};

/** Teaching data for a diagram from a chapter's scene file, without hand-written node and relation IDs. */
export function flowLesson(diagramId: string, source: FlowLessonSource): TeachingContent {
  const node = (index: number) => `${diagramId}:node:${index}`;
  const relation = (index: number) => `${diagramId}:relation:${index}`;
  const count = source.semanticIds.length;
  const relationCount = source.kind === "flow" ? count - 1 : 0;
  const linksBetween = (items: number[]) => Array.from({ length: relationCount }, (_, index) => index)
    .filter((index) => items.includes(index) && items.includes(index + 1))
    .map(relation);
  const subset = source.points.findIndex((point) => point.items.length < count);

  return {
    layout: "pipeline",
    nodeRoles: Object.fromEntries(source.semanticIds.map((semanticId, index) => [node(index), { lane: index, order: 2, semanticId }])),
    relationships: Object.fromEntries(Array.from({ length: relationCount }, (_, index) => [relation(index), {
      meaning: "decision" as const,
      condition: "",
      explanation: `${source.points.find((point) => point.items.includes(index) && point.items.includes(index + 1))?.description ?? "This step leads to the next one."}`,
    }])),
    groups: [],
    scenes: source.points.map((point, index) => ({
      id: `${diagramId}:explain:${index + 1}`,
      title: point.title,
      description: point.description,
      nodeIds: point.items.map(node),
      linkIds: linksBetween(point.items),
      ...(index === subset ? { viewId: `${diagramId}:view:point-${index + 1}` } : {}),
    })),
    views: subset >= 0 ? [{
      id: `${diagramId}:view:point-${subset + 1}`,
      title: source.points[subset].title,
      description: source.points[subset].description,
      members: source.points[subset].items.map(node),
      layout: "pipeline",
    }] : [],
    predictions: [{
      id: `${diagramId}:predict:1`,
      title: "Predict the design consequence",
      prompt: source.prediction.prompt,
      options: source.prediction.options,
      correctIndex: source.prediction.correctIndex,
      explanation: source.prediction.explanation,
      reveal: {
        id: `${diagramId}:reveal:1`,
        title: "Why this choice follows",
        description: source.prediction.explanation,
        nodeIds: source.prediction.items.map(node),
        linkIds: linksBetween(source.prediction.items),
      },
    }],
  };
}
