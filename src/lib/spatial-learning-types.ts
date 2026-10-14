import type { Point, SpatialLink, SpatialNode, SpatialScene } from "./spatial-model";

export type RelationMeaning = "request" | "response" | "read" | "write" | "replication" | "publish" | "delivery" | "acknowledgement" | "decision" | "connection";
export type DiagramStatus = "unavailable" | "under-pressure" | "active";
export type LearningNode = SpatialNode & { semanticId: string; lane: number; status?: DiagramStatus; members?: string[]; introduced?: boolean };
export type LearningLink = SpatialLink & {
  meaning: RelationMeaning; condition: string; explanation: string; origins: string[];
};
export type LearningGroup = SpatialScene["groups"][number] & { id: string; members: string[]; description: string };
export type LearningScene = Omit<SpatialScene, "nodes" | "links" | "groups"> & {
  chapterId: string; lessonId: string; nodes: LearningNode[]; links: LearningLink[]; groups: LearningGroup[];
  guidePath?: Point[];
};

export type ExplanationScene = {
  id: string; title: string; description: string;
  nodeIds: string[]; linkIds: string[];
  revealNodeIds?: string[]; viewId?: string; statuses?: Record<string, DiagramStatus>;
};
export type TeachingView = { id: string; title: string; description: string; members: string[]; linkIds?: string[]; layout: "pipeline" | "peers" };
export type DiagramPrediction = {
  id: string; title: string; prompt: string; options: string[]; correctIndex: number;
  explanation: string; reveal: ExplanationScene;
};
export type TeachingContent = {
  layout: "tiers" | "pipeline" | "peers" | "authored";
  nodeRoles?: Record<string, { lane: number; order?: number; semanticId?: string }>;
  relationships?: Record<string, { source?: string; target?: string; meaning: RelationMeaning; condition: string; explanation: string }>;
  groups: { id: string; title: string; description: string; members: string[] }[];
  scenes: ExplanationScene[]; views: TeachingView[]; predictions: DiagramPrediction[];
};
export type SpatialLesson = { scene: LearningScene; content: TeachingContent };
export type PresentationOptions = { collapsed: string[]; viewId?: string; explanation?: ExplanationScene; filter?: RelationMeaning | "all" };
export type ScenePresentation = { scene: LearningScene; omittedNodes: number; omittedLinks: number; title: string; description: string };
