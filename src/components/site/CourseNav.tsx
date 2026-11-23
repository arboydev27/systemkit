"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { lessonHref } from "@/lib/links";
import type { OrbGraph } from "@/lib/orb-layout";
import { chapterOfLesson, lessonsInOrder } from "@/lib/orb-view";
import { emptyProgress, type OutlineChapter, type Progress } from "@/lib/progress";
import styles from "./CourseNav.module.css";

export type CourseNavProps = {
  graph: OrbGraph;
  chapters: (OutlineChapter & { lessonCount: number })[];
  /** Chapter indexes in the order to walk them. */
  order: number[];
  /** True while a goal has reordered the course. */
  ordered: boolean;
  goalChanges: number;
  progress: Record<string, Progress>;
  next: { chapterId: string; stepId: string } | null;
  started: boolean;
  onFail: () => void;
};

/** What's selected on the course line and how to move around it, shared by the learning path page and the home page. */
export function useCourseNav({ graph, chapters, order, goalChanges, progress, next, started }: CourseNavProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [part, setPart] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [tapped, setTapped] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
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
    setSpoken(describe(lesson));
  }, [describe, graph]);

  const clear = useCallback(() => {
    setTapped(false);
    setSelected(null);
    setPart(null);
    setPreview(null);
    setActive(null);
  }, []);

  const showChapter = useCallback((index: number) => {
    setTapped(false);
    setSelected(index);
    setPreview(null);
    setActive(null);
  }, []);

  const showPart = useCallback((index: number) => {
    setTapped(false);
    setSelected(null);
    setPart(index);
    setPreview(null);
    setActive(null);
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

  // A new goal reorders the course, so whatever was open belongs to the old order.
  const lastGoalChange = useRef(goalChanges);
  useEffect(() => {
    if (goalChanges === lastGoalChange.current) return;
    lastGoalChange.current = goalChanges;
    setSelected(null);
    setPart(null);
    setActive(null);
  }, [goalChanges]);

  return {
    selected, part, preview, active, tapped, hovered, spoken, finished, nextLesson, nextLabel, shownChapter,
    lessonAt, hrefOf, clear, showChapter, showPart, stepChapter, open, onHover, onTap, onKeyDown, setActive, setTapped, setPreview,
    prefetch: (lesson: number) => router.prefetch(hrefOf(lesson)),
  };
}

export type CourseNavState = ReturnType<typeof useCourseNav>;

/** The lessons of one chapter as rows, which point at their ticks on the course line. */
export function ChapterLessons({ nav, graph, chapter, index }: { nav: CourseNavState; graph: OrbGraph; chapter: CourseNavProps["chapters"][number]; index: number }) {
  return <ol className={styles.lessons}>
    {chapter.stepIds.map((stepId, step) => {
      const lesson = nav.lessonAt(index, step);
      const isNext = lesson === nav.nextLesson;
      return <li key={stepId}>
        <Link
          href={lessonHref(chapter.id, stepId)}
          prefetch={false}
          className={`${styles.lesson} ${nav.active === lesson ? styles.lessonActive : ""} ${isNext ? styles.lessonNext : ""}`}
          onClick={() => trackEvent("orb_open_row")}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") { nav.prefetch(lesson); nav.setTapped(false); nav.setActive(lesson); } }}
          onPointerLeave={(event) => { if (event.pointerType === "mouse") nav.setActive(null); }}
          onFocus={() => { nav.prefetch(lesson); nav.setTapped(false); nav.setActive(lesson); }}
          onBlur={() => nav.setActive(null)}
        >
          <span className={styles.lessonNumber}>{step + 1}</span>
          <span className={styles.lessonTitle}>{graph.titles[lesson]}</span>
          {nav.finished[lesson] ? <span className={styles.lessonDone}><Check size={13} aria-hidden="true" /> Done</span>
            : isNext ? <span className={styles.lessonGo}>{nav.nextLabel} <ArrowRight size={14} aria-hidden="true" /></span> : null}
        </Link>
      </li>;
    })}
  </ol>;
}

/** Finished rows can push the next lesson off a phone screen, and another chapter hides it altogether. */
export function nextIsOutOfSight(nav: CourseNavState, graph: OrbGraph) {
  return nav.nextLesson !== null && (chapterOfLesson(graph, nav.nextLesson) !== nav.shownChapter || nav.nextLesson - graph.chapterStarts[nav.shownChapter] > 2);
}
