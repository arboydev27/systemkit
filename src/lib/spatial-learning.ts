import { chapters } from "../content/chapters";
import { createTeachingContent } from "../content/spatial-learning";
import { getSpatialScene } from "./spatial-scenes";
import { layoutSpatialScene, validateSpatialLesson } from "./spatial-layout";
import type { DiagramPrediction, LearningScene, RelationMeaning, SpatialLesson } from "./spatial-learning-types";

export const relationshipLabels: Record<RelationMeaning, string> = {
  request: "Request", response: "Response", read: "Read", write: "Write", replication: "Replication",
  publish: "Publish work", delivery: "Deliver work", acknowledgement: "Acknowledge", decision: "Decision", connection: "Connection",
};

export function getSpatialLesson(chapterId: string, diagramId: string): SpatialLesson {
  const chapter = chapters.find(item => item.id === chapterId);
  const lesson = chapter?.steps.find(item => item.diagramId === diagramId);
  if (!lesson) throw new Error("Unknown spatial lesson");
  const base = getSpatialScene(chapterId, diagramId);
  const content = createTeachingContent(chapterId, diagramId, base);
  const result = { scene: layoutSpatialScene(chapterId, lesson.id, base, content), content };
  validateSpatialLesson(result);
  return result;
}

export type LessonChanges = { retained: number; added: string[]; removed: string[]; previousTitle: string };
export function compareSpatialLessons(previous: LearningScene, current: LearningScene): LessonChanges | null {
  if (previous.chapterId !== current.chapterId || previous.lessonId === current.lessonId) return null;
  const oldIds = new Set(previous.nodes.map(node => node.semanticId));
  const newIds = new Set(current.nodes.map(node => node.semanticId));
  return {
    retained: current.nodes.filter(node => oldIds.has(node.semanticId)).length,
    added: current.nodes.filter(node => !oldIds.has(node.semanticId)).map(node => node.title),
    removed: previous.nodes.filter(node => !newIds.has(node.semanticId)).map(node => node.title),
    previousTitle: previous.title,
  };
}

// Session memory keeps lesson changes separate from saved assessment progress.
const chapterScenes = new Map<string, { current: LearningScene; changes: LessonChanges | null }>();
export function rememberSpatialLesson(scene: LearningScene): LessonChanges | null {
  const existing = chapterScenes.get(scene.chapterId);
  if (existing?.current.lessonId === scene.lessonId) return existing.changes;
  const changes = existing ? compareSpatialLessons(existing.current, scene) : null;
  chapterScenes.set(scene.chapterId, { current: scene, changes });
  if (chapterScenes.size > 15) chapterScenes.delete(chapterScenes.keys().next().value!);
  return changes;
}

export type DiagramAttempt = { choice: number; revealed: boolean };
export function decodeDiagramAttempts(value: string | null, predictions: DiagramPrediction[]): Record<string, DiagramAttempt> {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = predictions.flatMap(prediction => {
      const attempt = (parsed as Record<string, unknown>)[prediction.id];
      if (!attempt || typeof attempt !== "object") return [];
      const { choice, revealed } = attempt as Partial<DiagramAttempt>;
      if (typeof choice !== "number" || !Number.isInteger(choice) || choice < 0 || choice >= prediction.options.length) return [];
      return [[prediction.id, { choice, revealed: revealed === true }]] as [string, DiagramAttempt][];
    });
    return Object.fromEntries(entries);
  } catch { return {}; }
}
