"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { StageScene } from "@/lib/lesson-stage/types";
import { LessonStage } from "./LessonStage";

type Props = { title?: string };
const ArchitectureDiagram = dynamic(() => import("../ArchitectureDiagram").then((module) => module.ArchitectureDiagram));

function played(scene: StageScene | null): ComponentType<Props> {
  return function Scene({ title }: Props) {
    return scene ? <LessonStage scene={scene} title={title ?? scene.id} /> : null;
  };
}

// One chunk per lesson: a lesson page loads the player and only its own scene, and still renders on the server.
const scenes: Record<string, ComponentType<Props>> = {
  "single-server": dynamic(() => import("@/content/lesson-stage/scaling/single-server").then((module) => played(module.singleServerStage))),
  "split-tiers": dynamic(() => import("@/content/lesson-stage/scaling/split-tiers").then((module) => played(module.splitTiersStage))),
  "scale-web": dynamic(() => import("@/content/lesson-stage/scaling/scale-web").then((module) => played(module.scaleWebStage))),
  "replication": dynamic(() => import("@/content/lesson-stage/scaling/replication").then((module) => played(module.replicationStage))),
  "cache": dynamic(() => import("@/content/lesson-stage/scaling/cache").then((module) => played(module.cacheStage))),
  "cdn": dynamic(() => import("@/content/lesson-stage/scaling/cdn").then((module) => played(module.cdnStage))),
  "stateless": dynamic(() => import("@/content/lesson-stage/scaling/stateless").then((module) => played(module.statelessStage))),
  "multi-dc": dynamic(() => import("@/content/lesson-stage/scaling/multi-dc").then((module) => played(module.multiDcStage))),
  "queue": dynamic(() => import("@/content/lesson-stage/scaling/queue").then((module) => played(module.queueStage))),
  "observability": dynamic(() => import("@/content/lesson-stage/scaling/observability").then((module) => played(module.observabilityStage))),
  "sharding": dynamic(() => import("@/content/lesson-stage/scaling/sharding").then((module) => played(module.shardingStage))),
  "synthesis": dynamic(() => import("@/content/lesson-stage/scaling/synthesis").then((module) => played(module.synthesisStage))),
};

/** "Scale to a Million Users": each lesson's animated scene, or the static drawing for an unknown id. */
export function ScalingStage({ id, title }: { id: string; title?: string }) {
  const Scene = scenes[id];
  return Scene ? <Scene key={id} title={title} /> : <ArchitectureDiagram id={id} />;
}
