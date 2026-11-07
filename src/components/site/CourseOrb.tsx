"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref, lessonHref } from "@/lib/links";
import type { OrbGraph } from "@/lib/orb-layout";
import type { OrbScene } from "@/lib/orb-scene";
import { chapterOfLesson, lessonsInOrder, ORB_RADIUS, posterMarks } from "@/lib/orb-view";
import { emptyProgress, type OutlineChapter, type Progress } from "@/lib/progress";
import styles from "./CourseOrb.module.css";
import type { OrbCanvasProps } from "./OrbCanvas";

// The drawing code loads only once the orb is close to the screen. If it can't load, the list takes over.
const OrbCanvas = dynamic<OrbCanvasProps>(
  () => import("./OrbCanvas").catch(() => ({ default: OrbUnavailable })),
  { ssr: false },
);

function OrbUnavailable({ onFail }: Pick<OrbCanvasProps, "onFail">) {
  useEffect(() => onFail(), [onFail]);
  return null;
}

const POSTER_SIZE = 1000;

/** The same orb the canvas draws first, so nothing shifts or pops in when it takes over. */
function OrbPoster({ graph, hidden }: { graph: OrbGraph; hidden: boolean }) {
  const marks = useMemo(() => posterMarks(graph, POSTER_SIZE), [graph]);
  return <svg className={`${styles.poster} ${hidden ? styles.posterGone : ""}`} viewBox={`0 0 ${POSTER_SIZE} ${POSTER_SIZE}`} aria-hidden="true" focusable="false">
    <radialGradient id="orb-rim">
      <stop offset=".6" stopColor="currentColor" stopOpacity="0" />
      <stop offset=".945" stopColor="currentColor" stopOpacity=".03" />
      <stop offset=".99" stopColor="currentColor" stopOpacity=".065" />
      <stop offset="1" stopColor="currentColor" stopOpacity="0" />
    </radialGradient>
    <circle cx={POSTER_SIZE / 2} cy={POSTER_SIZE / 2} r={POSTER_SIZE * ORB_RADIUS * 1.015} fill="url(#orb-rim)" />
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {marks.lines.map((line) => <g key={line.linkOpacity}>
        <path d={line.link} strokeWidth="1.5" opacity={line.linkOpacity} />
        <path d={line.chapter} strokeWidth="2" opacity={line.chapterOpacity} />
      </g>)}
    </g>
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {marks.dots.map((dot) => <path key={`${dot.width}/${dot.opacity}`} d={dot.path} strokeWidth={dot.width} opacity={dot.opacity} />)}
    </g>
    <circle cx={marks.start.x.toFixed(1)} cy={marks.start.y.toFixed(1)} r={marks.start.r.toFixed(1)} fill="currentColor" />
    <circle cx={marks.start.x.toFixed(1)} cy={marks.start.y.toFixed(1)} r={(marks.start.r + 8).toFixed(1)} fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>;
}

export type CourseOrbProps = {
  graph: OrbGraph;
  chapters: (OutlineChapter & { lessonCount: number })[];
  /** Chapter indexes in the order to walk them. */
  order: number[];
  /** True while a goal has reordered the course, which draws its path through the orb. */
  ordered: boolean;
  goalChanges: number;
  progress: Record<string, Progress>;
  next: { chapterId: string; stepId: string } | null;
  started: boolean;
  onFail: () => void;
};

/** What's selected on the orb and how to move around it, shared by the learning path page and the home page. */
export function useCourseOrb({ graph, chapters, order, ordered, goalChanges, progress, next, started }: CourseOrbProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [part, setPart] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [faceActive, setFaceActive] = useState(false);
  const [tapped, setTapped] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [hold, setHold] = useState(false);
  const [spoken, setSpoken] = useState("");

  const finished = useMemo(() => chapters.flatMap((chapter) => {
    const saved = progress[chapter.storageKey] ?? emptyProgress;
    return chapter.stepIds.map((id) => saved.completed.includes(id));
  }), [chapters, progress]);

  const lessonAt = useCallback((chapter: number, step: number) => graph.chapterStarts[chapter] + step, [graph]);
  const nextLesson = useMemo(() => {
    if (!next) return null;
    const chapter = chapters.findIndex((item) => item.id === next.chapterId);
    const step = chapters[chapter]?.stepIds.indexOf(next.stepId) ?? -1;
    return chapter < 0 || step < 0 ? null : lessonAt(chapter, step);
  }, [chapters, next, lessonAt]);

  const nextLabel = started ? "Next" : "Start here";
  const walkOrder = useMemo(() => lessonsInOrder(graph, order), [graph, order]);
  const threadOrder = useMemo(() => ordered ? order : null, [ordered, order]);

  const shownChapter = selected ?? (nextLesson !== null ? chapterOfLesson(graph, nextLesson) : order[0]);

  const hrefOf = useCallback((lesson: number) => {
    const owner = chapterOfLesson(graph, lesson);
    return lessonHref(chapters[owner].id, chapters[owner].stepIds[lesson - graph.chapterStarts[owner]]);
  }, [chapters, graph]);

  const describe = useCallback((lesson: number) => {
    const owner = chapterOfLesson(graph, lesson);
    const place = lesson - graph.chapterStarts[owner] + 1;
    const state = finished[lesson] ? ", finished" : lesson === nextLesson ? `, ${nextLabel.toLowerCase()}` : "";
    return `${graph.titles[lesson]}. ${chapters[owner].title}, lesson ${place} of ${chapters[owner].lessonCount}${state}.`;
  }, [chapters, finished, graph, nextLabel, nextLesson]);

  const moveTo = useCallback((lesson: number) => {
    setTapped(false);
    setSelected(chapterOfLesson(graph, lesson));
    setActive(lesson);
    setFaceActive(true);
    setSpoken(describe(lesson));
  }, [describe, graph]);

  const clear = useCallback(() => {
    setTapped(false);
    setSelected(null);
    setPart(null);
    setPreview(null);
    setActive(null);
    setFaceActive(false);
  }, []);

  const showChapter = useCallback((index: number) => {
    setTapped(false);
    setSelected(index);
    setPreview(null);
    setActive(null);
    setFaceActive(false);
  }, []);

  const showPart = useCallback((index: number) => {
    setTapped(false);
    setSelected(null);
    setPart(index);
    setPreview(null);
    setActive(null);
    setFaceActive(false);
  }, []);

  const stepChapter = (change: number) => {
    const place = order.indexOf(shownChapter);
    showChapter(order[(place + change + order.length) % order.length]);
  };

  const open = useCallback((lesson: number, inNewTab: boolean) => {
    trackEvent("orb_open_dot");
    if (inNewTab) window.open(hrefOf(lesson), "_blank", "noopener");
    else router.push(hrefOf(lesson));
  }, [hrefOf, router]);

  const onHover = useCallback((lesson: number | null) => {
    setHovered(lesson);
    if (lesson !== null) router.prefetch(hrefOf(lesson));
  }, [hrefOf, router]);

  const onTap = useCallback((lesson: number | null) => {
    if (lesson === null) {
      clear();
      return;
    }
    setTapped(true);
    setSelected(chapterOfLesson(graph, lesson));
    setActive(lesson);
    setFaceActive(false);
  }, [clear, graph]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const current = active ?? nextLesson ?? walkOrder[0];
    const place = walkOrder.indexOf(current);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const change = event.key === "ArrowRight" ? 1 : -1;
      moveTo(active === null ? current : walkOrder[(place + change + walkOrder.length) % walkOrder.length]);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const change = event.key === "ArrowDown" ? 1 : -1;
      const owner = order.indexOf(chapterOfLesson(graph, current));
      moveTo(graph.chapterStarts[order[(owner + change + order.length) % order.length]]);
    } else if (event.key === "Enter" || event.key === " ") {
      if (active === null) {
        event.preventDefault();
        moveTo(current);
      } else {
        event.preventDefault();
        open(active, event.metaKey || event.ctrlKey);
      }
    } else if (event.key === "Escape" && (active !== null || selected !== null || part !== null)) {
      clear();
    }
  };

  // A new goal, or finishing the first look, restarts the signal from the lesson to do next.
  const [announcement, setAnnouncement] = useState<{ lesson: number; id: number } | null>(null);
  const lastGoalChange = useRef(goalChanges);
  useEffect(() => {
    if (goalChanges === lastGoalChange.current) return;
    lastGoalChange.current = goalChanges;
    setSelected(null);
    setPart(null);
    setActive(null);
    if (nextLesson !== null) setAnnouncement({ lesson: nextLesson, id: goalChanges });
  }, [goalChanges, nextLesson]);

  const focus = useMemo(() => ({ chapter: selected, lesson: active, faceLesson: faceActive, part, preview }), [selected, active, faceActive, part, preview]);

  return {
    selected, part, active, tapped, hovered, spoken, hold, focus, announcement, finished, nextLesson, nextLabel, threadOrder, shownChapter,
    lessonAt, hrefOf, clear, showChapter, showPart, stepChapter, open, onHover, onTap, onKeyDown, setActive, setFaceActive, setTapped, setHold, setPreview,
    prefetch: (lesson: number) => router.prefetch(hrefOf(lesson)),
  };
}

export type CourseOrbState = ReturnType<typeof useCourseOrb>;

/** The orb itself: the first paint, the canvas once it's close to the screen, and the label that follows a lesson. */
export function OrbStage({ orb, graph, chapters, onFail, navigation = false, resting = false, onPart, sceneRef, className = "", tooltipClassName = "" }: {
  orb: CourseOrbState;
  graph: OrbGraph;
  chapters: CourseOrbProps["chapters"];
  onFail: () => void;
  navigation?: boolean;
  resting?: boolean;
  onPart?: (part: number) => void;
  sceneRef?: RefObject<OrbScene | null>;
  className?: string;
  tooltipClassName?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const watcher = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        watcher.disconnect();
      }
    }, { rootMargin: "600px 0px" });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const shownLesson = orb.active ?? orb.hovered;
  const tooltipFacts = shownLesson === null ? "" : `${chapters[chapterOfLesson(graph, shownLesson)].title}${orb.finished[shownLesson] ? " · Finished" : shownLesson === orb.nextLesson ? ` · ${orb.nextLabel}` : ""}`;

  return <div
    ref={stage}
    className={`${styles.stage} ${className}`}
    role="application"
    tabIndex={0}
    aria-label={`Map of ${graph.titles.length} lessons. Left and right arrows move between lessons, up and down between chapters, and Enter opens a lesson.`}
    onKeyDown={orb.onKeyDown}
    onFocus={(event) => { if (event.target === event.currentTarget && event.currentTarget.matches(":focus-visible")) orb.setHold(true); }}
    onBlur={() => orb.setHold(false)}
  >
    <OrbPoster graph={graph} hidden={ready} />
    {near ? <OrbCanvas
      graph={graph}
      finished={orb.finished}
      next={orb.nextLesson}
      nextLabel={orb.nextLabel}
      order={orb.threadOrder}
      focus={orb.focus}
      hold={orb.hold}
      announcement={orb.announcement}
      tooltip={tooltip}
      onHover={orb.onHover}
      onTap={orb.onTap}
      onOpen={orb.open}
      onPart={onPart}
      onReady={() => setReady(true)}
      onFail={onFail}
      navigation={navigation}
      resting={resting}
      sceneRef={sceneRef}
    /> : null}
    <div ref={tooltip} className={`${styles.tooltip} ${tooltipClassName} ${shownLesson !== null ? styles.tooltipOn : ""} ${orb.tapped ? styles.tooltipTapped : ""}`} aria-hidden="true">
      {shownLesson === null ? null : orb.tapped ? <Link href={orb.hrefOf(shownLesson)} tabIndex={-1} onClick={() => trackEvent("orb_open_dot")}>
        <strong>{graph.titles[shownLesson]} <ArrowRight size={13} aria-hidden="true" /></strong>
        <span>{tooltipFacts}</span>
      </Link> : <>
        <strong>{graph.titles[shownLesson]}</strong>
        <span>{tooltipFacts}</span>
      </>}
    </div>
    <p className={styles.keyHint} aria-hidden="true">Arrow keys move through the lessons. Enter opens one.</p>
  </div>;
}

/** The lessons of one chapter as rows, which point at their dots on the orb. */
export function ChapterLessons({ orb, graph, chapter, index }: { orb: CourseOrbState; graph: OrbGraph; chapter: CourseOrbProps["chapters"][number]; index: number }) {
  return <ol className={styles.lessons}>
    {chapter.stepIds.map((stepId, step) => {
      const lesson = orb.lessonAt(index, step);
      const isNext = lesson === orb.nextLesson;
      return <li key={stepId}>
        <Link
          href={lessonHref(chapter.id, stepId)}
          prefetch={false}
          className={`${styles.lesson} ${orb.active === lesson ? styles.lessonActive : ""} ${isNext ? styles.lessonNext : ""}`}
          onClick={() => trackEvent("orb_open_row")}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") { orb.prefetch(lesson); orb.setTapped(false); orb.setActive(lesson); orb.setFaceActive(true); } }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") orb.setActive(null); }}
          onFocus={() => { orb.prefetch(lesson); orb.setTapped(false); orb.setActive(lesson); orb.setFaceActive(true); }}
          onBlur={() => orb.setActive(null)}
        >
          <span className={styles.lessonNumber}>{step + 1}</span>
          <span className={styles.lessonTitle}>{graph.titles[lesson]}</span>
          {orb.finished[lesson] ? <span className={styles.lessonDone}><Check size={13} aria-hidden="true" /> Done</span>
            : isNext ? <span className={styles.lessonGo}>{orb.nextLabel} <ArrowRight size={14} aria-hidden="true" /></span> : null}
        </Link>
      </li>;
    })}
  </ol>;
}

/** Finished rows can push the next lesson off a phone screen, and another chapter hides it altogether. */
export function nextIsOutOfSight(orb: CourseOrbState, graph: OrbGraph) {
  return orb.nextLesson !== null && (chapterOfLesson(graph, orb.nextLesson) !== orb.shownChapter || orb.nextLesson - graph.chapterStarts[orb.shownChapter] > 2);
}

export function CourseOrb(props: CourseOrbProps) {
  const { graph, chapters, order, ordered, onFail } = props;
  const orb = useCourseOrb(props);
  const chapter = chapters[orb.shownChapter];
  const orderPlace = order.indexOf(orb.shownChapter);
  const doneInChapter = chapter.stepIds.filter((_, step) => orb.finished[orb.lessonAt(orb.shownChapter, step)]).length;

  return <>
    <div className={styles.orb}>
      <OrbStage orb={orb} graph={graph} chapters={chapters} onFail={onFail} />

      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>{chapter.title}</h3>
        <p className={styles.panelFacts}>
          {chapter.part} · {doneInChapter > 0 ? `${doneInChapter} of ${chapter.lessonCount} lessons finished` : `${chapter.lessonCount} lessons`}
          {ordered ? <> · step {orderPlace + 1} of {order.length} in your order</> : null}
        </p>
        {nextIsOutOfSight(orb, graph) && orb.nextLesson !== null ? <Link className={styles.nextUp} href={orb.hrefOf(orb.nextLesson)} onClick={() => trackEvent("orb_open_row")}>
          <span>{orb.nextLabel}: {graph.titles[orb.nextLesson]}</span> <ArrowRight size={15} aria-hidden="true" />
        </Link> : null}
        <ChapterLessons orb={orb} graph={graph} chapter={chapter} index={orb.shownChapter} />
        <div className={styles.panelFoot}>
          <Link className={styles.chapterLink} href={chapterHref(chapter.id)} onClick={() => trackEvent("orb_open_chapter")}>About this chapter</Link>
          <div className={styles.steppers}>
            <button type="button" onClick={() => orb.stepChapter(-1)} aria-label="Previous chapter"><ChevronLeft size={17} aria-hidden="true" /></button>
            <button type="button" onClick={() => orb.stepChapter(1)} aria-label="Next chapter"><ChevronRight size={17} aria-hidden="true" /></button>
          </div>
        </div>
        {orb.nextLesson === null ? <p className={styles.allDone}>You’ve finished all {graph.titles.length} lessons. <Link href="/review/">Keep them fresh in review</Link>.</p> : null}
      </div>
    </div>

    <div className={styles.key}>
      <p>Each dot is a lesson, gathered by chapter into four parts. Lines link lessons that build on each other, and the larger dots have more links. <span className={styles.hintPointer}>Drag to turn it, and click a dot to open its lesson.</span><span className={styles.hintTouch}>Swipe sideways to turn it, and tap a region to see its lessons.</span></p>
      <ul>
        <li><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2" opacity=".65" /></svg> Not started</li>
        <li><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.2" /></svg> Finished</li>
        <li><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" /></svg> {orb.nextLabel}</li>
        {ordered ? <li><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 9c2-7 5 3 10-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg> Your order, fading as it goes</li> : null}
      </ul>
    </div>
    <p className="sr-only" aria-live="polite">{orb.spoken}</p>
  </>;
}
