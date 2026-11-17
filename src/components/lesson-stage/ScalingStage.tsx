"use client";

import dynamic from "next/dynamic";
import { scalingStages } from "@/content/lesson-stage/scaling";
import { LessonStage } from "./LessonStage";

const ArchitectureDiagram = dynamic(() => import("../ArchitectureDiagram").then((module) => module.ArchitectureDiagram));

/** "Scale to a Million Users": each lesson's animated scene, or its static drawing until the scene exists. */
export function ScalingStage({ id, title }: { id: string; title?: string }) {
  const scene = scalingStages[id];
  if (!scene) return <ArchitectureDiagram id={id} />;
  return <LessonStage key={id} scene={scene} title={title ?? scene.id} />;
}
