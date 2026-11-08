"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import { ABOVE, DAB, SPILLS, creeperOf, dabPaths, depthOf, glintPath, runPath, sheetPath, type Spill } from "@/lib/paint";
import styles from "./MiloHome.module.css";

/** Room round a spill for its shadow on the wall, in wall units. */
const PAD = 8;

/**
 * Thick paint: its outline softened into a rounded surface lit from up and to the left, with a gloss where it faces the
 * light and a soft shadow on the wall below and to the right. `soft` is how far in from its edge the paint rounds off.
 */
function Lighting({ id, box, soft }: { id: string; box: { x: number; y: number; w: number; h: number }; soft: number }) {
  const scale = soft * 1.3;
  return <filter id={id} filterUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h} colorInterpolationFilters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation={soft} result="soft" />
    <feDiffuseLighting in="soft" surfaceScale={scale} diffuseConstant="1" lightingColor="#fff" result="shade">
      <feDistantLight azimuth="235" elevation="62" />
    </feDiffuseLighting>
    <feComposite in="SourceGraphic" in2="shade" operator="arithmetic" k1="1.13" result="lit" />
    <feComposite in="lit" in2="SourceAlpha" operator="in" result="body" />
    <feSpecularLighting in="soft" surfaceScale={scale} specularConstant="1.2" specularExponent="34" lightingColor="#fff" result="shine">
      <feDistantLight azimuth="235" elevation="40" />
    </feSpecularLighting>
    <feComposite in="shine" in2="SourceAlpha" operator="in" result="gloss" />
    <feComposite in="body" in2="gloss" operator="arithmetic" k2="1" k3=".7" result="paint" />
    <feGaussianBlur in="SourceAlpha" stdDeviation={soft * 0.67} result="blur" />
    <feOffset in="blur" dx={soft * 0.58} dy={soft} result="drop" />
    <feFlood className={styles.spillShadow} />
    <feComposite in2="drop" operator="in" result="shadow" />
    <feMerge>
      <feMergeNode in="shadow" />
      <feMergeNode in="paint" />
    </feMerge>
  </filter>;
}

function SpillArt({ name, spill, creep, id }: { name: string; spill: Spill; creep: number; id: string }) {
  const creeper = creeperOf(spill);
  const box = { x: spill.left - PAD, y: -ABOVE, w: spill.right - spill.left + PAD * 2, h: ABOVE + depthOf(spill) + creep + PAD };
  return <svg
    className={`${styles.spill} ${name === "wide" ? styles.spillWide : styles.spillNarrow}`}
    viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
    style={{ "--spill-w": box.w, "--spill-h": box.h, "--spill-above": ABOVE, "--spill-left": -box.x, "--creep": `${creep}px` } as CSSProperties}
    focusable="false"
  >
    <defs>
      <Lighting id={id} box={box} soft={2.4} />
    </defs>
    <g className={styles.paint} filter={`url(#${id})`}>
      <path d={sheetPath(spill)} />
      {spill.runs.map((run, index) => <path key={run.seed} className={index === creeper ? styles.creep : undefined} d={runPath(run)} />)}
    </g>
    {/* Wet paint: a sharp glint down each run where it faces the light, and a spark on each head. */}
    <g className={styles.wet}>
      {spill.runs.map((run, index) => <g key={run.seed} className={index === creeper ? styles.creep : undefined}>
        <path className={styles.glint} d={glintPath(run)} strokeWidth={run.width * 0.34} />
        <ellipse className={styles.spark} cx={(run.x - run.head * 0.34).toFixed(2)} cy={(run.reach + run.length * 0.48).toFixed(2)} rx={(run.head * 0.2).toFixed(2)} ry={(run.length * 0.15).toFixed(2)} />
      </g>)}
    </g>
  </svg>;
}

/**
 * The wall behind Milo: a spill of the site's orange paint coming over its top and running down it, which shows the
 * space above his ledge is a wall behind him. One run is still creeping down, unless the visitor prefers reduced
 * motion, and it waits while the wall is off screen.
 */
export function WallPaint() {
  const id = `paint-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const wall = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = wall.current;
    if (!node) return;
    const watcher = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) delete node.dataset.away;
      else node.dataset.away = "";
    });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);
  return <div ref={wall} className={styles.wall} aria-hidden="true" data-home-wall>
    {SPILLS.map(({ name, spill, creep }) => <SpillArt key={name} name={name} spill={spill} creep={creep} id={`${id}-${name}`} />)}
  </div>;
}

/** Room round the dab for its shadow, and how far up from the ledge's front edge it reaches. */
const DAB_BOX = { x: -10, y: -5, w: 20, h: 5 + DAB.run.reach + DAB.run.length + 3 };

/** The next lesson's mark on the ledge: a dab of the same paint on its front edge, with a short run down the face. */
export function PaintDab() {
  const id = `dab-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const { blob, run, glint } = dabPaths();
  const box = DAB_BOX;
  return <svg
    className={styles.dab}
    viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
    style={{ "--dab-w": box.w, "--dab-h": box.h, "--dab-left": -box.x, "--dab-top": -box.y } as CSSProperties}
    focusable="false"
    aria-hidden="true"
  >
    <defs><Lighting id={id} box={box} soft={0.9} /></defs>
    <g className={styles.paint} filter={`url(#${id})`}>
      <path d={blob} />
      <path d={run} />
    </g>
    <path className={styles.glint} d={glint} strokeWidth={DAB.run.width * 0.34} />
    <ellipse className={styles.spark} cx={-1.2} cy={-0.6} rx={1} ry={0.42} />
    <ellipse className={styles.spark} cx={DAB.run.x - DAB.run.head * 0.34} cy={DAB.run.reach + DAB.run.length * 0.48} rx={DAB.run.head * 0.2} ry={DAB.run.length * 0.15} />
  </svg>;
}
