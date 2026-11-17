// Loads the figures a scene draws, each from its own module, so lessons without a ring, a log or a timeline never
// download their code.
import type { FigureFactory } from "./figure";
import type { StageScene } from "./types";

export const needsFigures = (scene: StageScene) => scene.layout === "ring" || scene.layout === "timeline" || !!scene.logs?.length;

export async function loadFigures(scene: StageScene): Promise<FigureFactory[]> {
  // how the ring, logs and timeline change: the model needs it before anything plays
  await import("./figure-model");
  const wanted: Promise<FigureFactory>[] = [];
  if (scene.layout === "ring") wanted.push(import("./ring").then((m) => m.ringFigure));
  if (scene.layout === "timeline") wanted.push(import("./timeline").then((m) => m.timelineFigure));
  if (scene.logs?.length) wanted.push(import("./log").then((m) => m.logFigure));
  return Promise.all(wanted);
}
