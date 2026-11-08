"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import { ABOVE, SPILLS, creeperOf, depthOf, glintPath, runPath, sheetPath, type Spill } from "@/lib/paint";
import styles from "./MiloHome.module.css";

/** Room round a spill for its shadow on the wall, in wall units. */
const PAD = 8;

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
      {/* Thick paint: its outline softened into a rounded surface lit from up and to the left, with a soft shadow on
          the wall below and to the right. */}
      <filter id={id} filterUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h} colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="soft" />
        <feDiffuseLighting in="soft" surfaceScale="3" diffuseConstant="1" lightingColor="#fff" result="shade">
          <feDistantLight azimuth="235" elevation="62" />
        </feDiffuseLighting>
        <feComposite in="SourceGraphic" in2="shade" operator="arithmetic" k1="1.13" result="lit" />
        <feComposite in="lit" in2="SourceAlpha" operator="in" result="body" />
        <feSpecularLighting in="soft" surfaceScale="3" specularConstant="1.2" specularExponent="34" lightingColor="#fff" result="shine">
          <feDistantLight azimuth="235" elevation="40" />
        </feSpecularLighting>
        <feComposite in="shine" in2="SourceAlpha" operator="in" result="gloss" />
        <feComposite in="body" in2="gloss" operator="arithmetic" k2="1" k3=".7" result="paint" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blur" />
        <feOffset in="blur" dx="1.4" dy="2.4" result="drop" />
        <feFlood className={styles.spillShadow} />
        <feComposite in2="drop" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="paint" />
        </feMerge>
      </filter>
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
