"use client";

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref } from "@/lib/links";
import { gaze, lean, nearestLesson, nextBlink, type Ledge } from "@/lib/milo";
import { MILO } from "@/lib/milo-figure";
import type { OrbGraph } from "@/lib/orb-layout";
import { chapterOfLesson } from "@/lib/orb-view";
import type { CourseNavProps, CourseNavState } from "./CourseNav";
import styles from "./Milo.module.css";

const { width: W, height: H } = MILO;
const IDLE_MS = 45000;

/** A place on screen Milo should look at instead of the pointer, such as the lesson being pointed at on the line. */
export type MiloFocus = { x: number; y: number } | null;

function Layer({ name, sizes, priority }: { name: "body" | "head"; sizes: string; priority: boolean }) {
  const set = (theme: string) => `/milo/${theme}-${name}-s.webp ${MILO.small}w, /milo/${theme}-${name}.webp ${W}w`;
  return <picture>
    <source media="(prefers-color-scheme: dark)" srcSet={set("dark")} sizes={sizes} />
    <img
      className={styles.layer}
      src={`/milo/light-${name}.webp`}
      srcSet={set("light")}
      sizes={sizes}
      width={W}
      height={H}
      alt=""
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      data-milo-layer={name}
    />
  </picture>;
}

/**
 * Milo: rendered in Blender as two layers, his body and his head, with his face's screen left blank so his eyes can be
 * drawn here, where they blink, follow what's going on and, for the dive, open onto the neuron. What the server sends
 * is exactly what the page goes on to animate, so nothing shifts or swaps when it comes to life.
 */
export function MiloFigure({ figureRef, className = "", sizes, priority = false }: {
  figureRef: RefObject<HTMLDivElement | null>;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const glow = `milo-glow-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return <div ref={figureRef} className={`${styles.figure} ${className}`} data-milo aria-hidden="true">
    <Layer name="body" sizes={sizes} priority={priority} />
    <div className={styles.head} data-milo-head>
      <div className={styles.breath}>
        <Layer name="head" sizes={sizes} priority={priority} />
        <svg className={styles.eyes} viewBox={`0 0 ${W} ${H}`} focusable="false">
          <defs>
            <filter id={glow} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          <g className={styles.gaze}>
            {MILO.eyes.map((eye, index) => <g key={index} className={styles.eye} data-milo-eye={index}>
              <ellipse className={styles.eyeGlow} cx={eye.x * W} cy={eye.y * H} rx={eye.rx * W + 4} ry={eye.ry * H + 4} filter={`url(#${glow})`} />
              <ellipse className={styles.eyeShape} cx={eye.x * W} cy={eye.y * H} rx={eye.rx * W} ry={eye.ry * H} />
            </g>)}
          </g>
        </svg>
      </div>
    </div>
  </div>;
}

/**
 * Milo's idle life: he breathes, blinks, and looks at the pointer or whatever the page points him at, leaning his head
 * a little after his eyes. It all stops when he's off screen or nothing has happened for a while, and never runs for
 * anyone who prefers reduced motion.
 */
export function useMiloLife(figure: RefObject<HTMLDivElement | null>, focus: RefObject<MiloFocus>, paused = false) {
  const wakeRef = useRef<() => void>(() => {});
  useEffect(() => {
    const node = figure.current;
    if (!node || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el: HTMLDivElement = node;
    const fine = window.matchMedia("(pointer: fine)").matches;
    let pointer: { x: number; y: number } | null = null;
    let wander: { x: number; y: number; until: number } | null = null;
    let eyes = { x: 0, y: 0 };
    let head = { tilt: 0, x: 0, y: 0 };
    let frame = 0;
    let last = 0;
    let visible = true;
    let lastInput = performance.now();
    let blinkTimer = 0;
    let wanderTimer = 0;
    let still = false;

    function setStill(value: boolean) {
      if (value === still) return;
      still = value;
      if (value) el.dataset.still = "";
      else delete el.dataset.still;
      if (value) {
        window.clearTimeout(blinkTimer);
        window.clearTimeout(wanderTimer);
      } else {
        scheduleBlink(false);
        scheduleWander();
      }
    }

    function scheduleBlink(justBlinked: boolean) {
      window.clearTimeout(blinkTimer);
      blinkTimer = window.setTimeout(() => {
        if (still) return;
        el.dataset.blink = "";
        window.setTimeout(() => { delete el.dataset.blink; }, 120);
        scheduleBlink(true);
      }, nextBlink(Math.random(), justBlinked));
    }

    // Without a mouse to follow, he glances about now and then: at the line, the words, then back at the visitor.
    function scheduleWander() {
      if (fine) return;
      window.clearTimeout(wanderTimer);
      wanderTimer = window.setTimeout(() => {
        if (still) return;
        const box = el.getBoundingClientRect();
        const pick = Math.random();
        const x = box.left + box.width * (pick < 0.4 ? -0.4 : pick < 0.8 ? 1.4 : 0.5);
        const y = box.top + box.height * (pick < 0.8 ? 0.9 : 0.42);
        wander = { x, y, until: performance.now() + 1400 + Math.random() * 1200 };
        wake();
        scheduleWander();
      }, 3800 + Math.random() * 4200);
    }

    function loop(now: number) {
      frame = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (now - lastInput > IDLE_MS) setStill(true);
      if (wander && now > wander.until) wander = null;
      const box = el.getBoundingClientRect();
      const target = focus.current ?? (wander ? { x: wander.x, y: wander.y } : pointer);
      let want = { x: 0, y: 0 };
      if (target && box.width > 0) {
        const cx = box.left + MILO.display.x * box.width;
        const cy = box.top + MILO.display.y * box.height;
        want = gaze((target.x - cx) / box.width, (target.y - cy) / box.height);
      }
      // The eyes dart, the head follows more slowly.
      const quick = 1 - Math.exp(-dt / 0.07);
      const slow = 1 - Math.exp(-dt / 0.4);
      eyes = { x: eyes.x + (want.x - eyes.x) * quick, y: eyes.y + (want.y - eyes.y) * quick };
      const lean_ = lean(want);
      head = { tilt: head.tilt + (lean_.tilt - head.tilt) * slow, x: head.x + (lean_.x - head.x) * slow, y: head.y + (lean_.y - head.y) * slow };
      el.style.setProperty("--gx", `${(eyes.x * W).toFixed(2)}px`);
      el.style.setProperty("--gy", `${(eyes.y * H).toFixed(2)}px`);
      el.style.setProperty("--tilt", `${head.tilt.toFixed(3)}deg`);
      el.style.setProperty("--hx", `${(head.x * 100).toFixed(3)}%`);
      el.style.setProperty("--hy", `${(head.y * 100).toFixed(3)}%`);
      const moving = Math.abs(want.x - eyes.x) * W > 0.05 || Math.abs(want.y - eyes.y) * H > 0.05 || Math.abs(lean_.tilt - head.tilt) > 0.01;
      if (moving && visible) frame = requestAnimationFrame(loop);
      else last = 0;
    }

    function wake() {
      if (!frame && visible) frame = requestAnimationFrame(loop);
    }
    wakeRef.current = wake;

    const onInput = () => {
      lastInput = performance.now();
      if (visible) setStill(false);
      wake();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") pointer = { x: event.clientX, y: event.clientY };
      onInput();
    };
    const onLeave = () => { pointer = null; wake(); };
    const watcher = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      setStill(!visible);
      if (visible) wake();
    });
    watcher.observe(el);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    for (const name of ["keydown", "touchstart", "wheel", "scroll"] as const) window.addEventListener(name, onInput, { passive: true });
    scheduleBlink(false);
    scheduleWander();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(blinkTimer);
      window.clearTimeout(wanderTimer);
      watcher.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      for (const name of ["keydown", "touchstart", "wheel", "scroll"] as const) window.removeEventListener(name, onInput);
      wakeRef.current = () => {};
      delete el.dataset.still;
      delete el.dataset.blink;
    };
  }, [figure, focus, paused]);
  return wakeRef;
}

const TICK = { lesson: 5, chapter: 10, next: 15 };

function ticksPath(xs: number[], height: number) {
  return xs.map((x) => `M${(x * 1000).toFixed(1)} 0V${height}`).join("");
}

/**
 * The course as the line Milo sits on: a tick for every lesson (every chapter on a phone), the finished ones inked in,
 * the next one lit, and below it the four parts, which open the course where they point. Pointing along the line names
 * the lesson there, and the arrow keys walk it.
 */
export function CourseLedge({ graph, chapters, nav, ledge, onPart, onFocusLesson, highlight, className = "", partsClassName = "" }: {
  graph: OrbGraph;
  chapters: CourseNavProps["chapters"];
  nav: CourseNavState;
  ledge: Ledge;
  onPart?: (part: number) => void;
  /** Called with where on screen the lesson being pointed at is, or null. */
  onFocusLesson?: (spot: { x: number; y: number } | null) => void;
  /** Lessons to ink in for what the panel is showing. */
  highlight: { from: number; to: number } | null;
  className?: string;
  partsClassName?: string;
}) {
  const band = useRef<HTMLDivElement>(null);
  const pointerType = useRef("mouse");
  const [hoverPart, setHoverPart] = useState<number | null>(null);
  const firsts = useMemo(() => graph.chapterStarts.slice(0, -1), [graph]);
  const all = useMemo(() => ticksPath(ledge.lessons, TICK.lesson), [ledge]);
  const chapterTicks = useMemo(() => ticksPath(firsts.map((lesson) => ledge.lessons[lesson]), TICK.chapter), [firsts, ledge]);
  const done = useMemo(() => ticksPath(ledge.lessons.filter((_, lesson) => nav.finished[lesson]), TICK.lesson), [ledge, nav.finished]);
  const doneChapters = useMemo(() => ticksPath(firsts.flatMap((start, chapter) => {
    const end = graph.chapterStarts[chapter + 1];
    for (let lesson = start; lesson < end; lesson++) if (!nav.finished[lesson]) return [];
    return [ledge.lessons[start]];
  }), TICK.chapter), [firsts, graph, ledge, nav.finished]);
  const partRange = hoverPart !== null ? partLessons(graph, hoverPart) : null;
  const lit = highlight ?? partRange;
  const litPath = useMemo(() => lit ? ticksPath(ledge.lessons.slice(lit.from, lit.to), TICK.lesson) : "", [ledge, lit]);
  const shown = nav.active ?? nav.hovered;

  function spotOf(lesson: number) {
    const box = band.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: box.left + ledge.lessons[lesson] * box.width, y: box.top + box.height * 0.35 };
  }

  useEffect(() => {
    onFocusLesson?.(shown !== null ? spotOf(shown) : null);
    // Only the lesson matters: the band doesn't move while it's pointed at.
  }, [shown]);

  function lessonAt(event: ReactPointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return nearestLesson(ledge.lessons, (event.clientX - box.left) / box.width);
  }

  const facts = shown === null ? "" : `${chapters[chapterOfLesson(graph, shown)].title}${nav.finished[shown] ? " · Finished" : shown === nav.nextLesson ? ` · ${nav.nextLabel}` : ""}`;

  return <>
    <div className={`${styles.ledge} ${className}`} data-ledge>
      <svg className={styles.ticks} viewBox={`0 0 1000 ${TICK.next + 1}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className={styles.tickAll} d={all} />
        <path className={styles.tickChapter} d={chapterTicks} />
        <path className={styles.tickDone} d={done} />
        <path className={styles.tickDoneChapter} d={doneChapters} />
        {litPath ? <path className={styles.tickLit} d={litPath} /> : null}
        {nav.nextLesson !== null ? <path className={styles.tickNext} d={ticksPath([ledge.lessons[nav.nextLesson]], TICK.next)} /> : null}
        {shown !== null ? <path className={styles.tickShown} d={ticksPath([ledge.lessons[shown]], TICK.next)} /> : null}
      </svg>
      <div
        ref={band}
        className={styles.band}
        role="application"
        tabIndex={0}
        aria-label={`The course, ${graph.titles.length} lessons in a line. Left and right arrows move between lessons, up and down between chapters, and Enter opens a lesson.`}
        onKeyDown={(event) => nav.onKeyDown(event)}
        onPointerDown={(event) => { pointerType.current = event.pointerType; }}
        onPointerMove={(event) => { if (event.pointerType === "mouse") nav.onHover(lessonAt(event)); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") nav.onHover(null); }}
        onClick={(event) => {
          const lesson = lessonAt(event);
          // A mouse opens the lesson it's on; a tap shows its chapter first, since a finger can't point first.
          if (pointerType.current === "mouse" || event.detail === 0) nav.open(lesson, event.metaKey || event.ctrlKey);
          else nav.onTap(lesson);
        }}
      />
      <div className={`${styles.tooltip} ${shown !== null ? styles.tooltipOn : ""} ${nav.tapped ? styles.tooltipTapped : ""}`} style={shown !== null ? { left: `${ledge.lessons[shown] * 100}%`, transform: `translateX(-${(12 + 76 * ledge.lessons[shown]).toFixed(1)}%)` } : undefined} aria-hidden="true">
        {shown === null ? null : nav.tapped ? <Link href={nav.hrefOf(shown)} tabIndex={-1} onClick={() => trackEvent("orb_open_dot")}>
          <strong>{graph.titles[shown]} <ArrowRight size={13} aria-hidden="true" /></strong>
          <span>{facts}</span>
        </Link> : <>
          <strong>{graph.titles[shown]}</strong>
          <span>{facts}</span>
        </>}
      </div>
      <p className={styles.keyHint} aria-hidden="true">Arrow keys walk the course. Enter opens a lesson.</p>
    </div>
    <ol className={`${styles.parts} ${partsClassName}`} aria-label="The four parts of the course">
      {graph.partTitles.map((title, part) => {
        const { from, to } = partLessons(graph, part);
        const finished = nav.finished.slice(from, to).filter(Boolean).length;
        const first = graph.chapterParts.indexOf(part);
        const { start, end } = ledge.parts[part];
        return <li key={title} style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}>
          <Link
            href={chapterHref(chapters[first].id)}
            className={styles.part}
            onClick={(event) => {
              if (!onPart || event.metaKey || event.ctrlKey || event.shiftKey) return;
              event.preventDefault();
              onPart(part);
            }}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") setHoverPart(part); }}
            onPointerLeave={() => setHoverPart(null)}
            onFocus={() => setHoverPart(part)}
            onBlur={() => setHoverPart(null)}
          >
            <span className={styles.partTitle}>{title}</span>
            <span className={styles.partFacts}>{finished > 0 ? `${finished} of ${to - from}` : `${to - from} lessons`}</span>
          </Link>
        </li>;
      })}
    </ol>
  </>;
}

/** The lessons of one part, as a range of lesson indexes. */
export function partLessons(graph: Pick<OrbGraph, "chapterStarts" | "chapterParts">, part: number) {
  let from = Infinity;
  let to = -Infinity;
  graph.chapterParts.forEach((owner, chapter) => {
    if (owner !== part) return;
    from = Math.min(from, graph.chapterStarts[chapter]);
    to = Math.max(to, graph.chapterStarts[chapter + 1]);
  });
  return { from, to };
}
