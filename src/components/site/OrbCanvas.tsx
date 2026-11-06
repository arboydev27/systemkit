"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { OrbGraph } from "@/lib/orb-layout";
import { createOrbScene, type OrbFocus, type OrbScene, type OrbSceneEvents } from "@/lib/orb-scene";
import styles from "./CourseOrb.module.css";

export type OrbCanvasProps = OrbSceneEvents & {
  graph: OrbGraph;
  finished: boolean[];
  next: number | null;
  nextLabel: string;
  order: number[] | null;
  focus: OrbFocus;
  hold: boolean;
  /** Changing this turns the orb to a lesson and sends a signal out from it. */
  announcement: { lesson: number; id: number } | null;
  tooltip: RefObject<HTMLDivElement | null>;
  onReady: () => void;
};

export default function OrbCanvas({ graph, finished, next, nextLabel, order, focus, hold, announcement, tooltip, onHover, onTap, onOpen, onReady, onFail }: OrbCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<OrbScene | null>(null);
  const handlers = useRef({ onHover, onTap, onOpen, onReady, onFail });
  useEffect(() => { handlers.current = { onHover, onTap, onOpen, onReady, onFail }; });

  useEffect(() => {
    if (!canvas.current) return;
    let created: OrbScene | null = null;
    try {
      created = createOrbScene(canvas.current, graph, tooltip.current, {
        onHover: (lesson) => handlers.current.onHover(lesson),
        onTap: (lesson) => handlers.current.onTap(lesson),
        onOpen: (lesson, inNewTab) => handlers.current.onOpen(lesson, inNewTab),
        onFail: () => handlers.current.onFail(),
      });
    } catch { /* Reported below, and the list takes over. */ }
    if (!created) {
      handlers.current.onFail();
      return;
    }
    scene.current = created;
    handlers.current.onReady();
    return () => {
      created.destroy();
      scene.current = null;
    };
  }, [graph, tooltip]);

  useEffect(() => scene.current?.setProgress(finished, next, nextLabel), [finished, next, nextLabel]);
  useEffect(() => scene.current?.setOrder(order), [order]);
  useEffect(() => scene.current?.setFocus(focus), [focus]);
  useEffect(() => scene.current?.setHold(hold), [hold]);
  useEffect(() => { if (announcement) scene.current?.announce(announcement.lesson); }, [announcement]);

  return <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />;
}
