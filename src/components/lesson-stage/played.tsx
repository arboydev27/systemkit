"use client";

import type { ComponentType } from "react";
import type { StageScene } from "@/lib/lesson-stage/types";
import { LessonStage } from "./LessonStage";

/** A chapter's staged lessons by diagram id, each a component that loads only its own scene. */
export type Players = Record<string, ComponentType<{ title: string }>>;

function isScene(value: unknown): value is StageScene {
  return typeof value === "object" && value !== null && "id" in value && "steps" in value && "nodes" in value;
}

/** Turns a loaded scene file into a component that plays its scene: the first export with an id, steps and nodes. */
export function played(module: Record<string, unknown>): ComponentType<{ title: string }> {
  const scene = Object.values(module).find(isScene);
  if (!scene) throw new Error(`A lesson stage file exports no scene (an object with id, steps and nodes). Its exports: ${Object.keys(module).join(", ") || "none"}.`);
  return function PlayedScene({ title }: { title: string }) {
    return <LessonStage scene={scene} title={title} />;
  };
}
