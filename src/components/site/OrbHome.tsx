"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref } from "@/lib/links";
import type { OrbGraph } from "@/lib/orb-layout";
import type { OrbScene } from "@/lib/orb-scene";
import { chapterOfLesson } from "@/lib/orb-view";
import { completedCount, emptyProgress } from "@/lib/progress";
import { CourseList, CourseState, useCoursePath, type CourseChapter, type GoalOption } from "./CourseMap";
import { ChapterLessons, nextIsOutOfSight, OrbStage, useCourseOrb } from "./CourseOrb";
import type { NeuronFlightProps } from "./NeuronFlight";
import { DueReviewBadge } from "./SiteClient";
import styles from "./OrbHome.module.css";
import siteStyles from "./Site.module.css";

// The dive from the orb to the game loads after the first screen, on the first sign of a visitor or the first quiet moment.
// Until then, and if it can't load, the page scrolls with the plain fade the stylesheet gives it.
const NeuronFlight = dynamic<NeuronFlightProps>(() => import("./NeuronFlight").catch(() => ({ default: () => null })), { ssr: false });

const GOAL_NAMES: Record<string, string> = { interview: "An interview", work: "Work", foundations: "Fundamentals" };
const lessons = (count: number) => `${count} ${count === 1 ? "lesson" : "lessons"}`;

// When the orb can't run, or without JavaScript, everything below it lies flat in the page and the chapter list shows.
const FLAT_PAGE = "[data-home-orb],[data-home-goal]{display:none!important}"
  + "[data-home-stage]{position:relative!important;height:auto!important;min-height:0!important;display:block!important;padding:24px clamp(16px,4vw,40px)!important}"
  + "[data-home-words],[data-home-foot]{position:static!important;width:auto!important;max-width:none!important;margin:0 0 16px!important}"
  + "[data-home-moons]{position:static!important;display:flex!important;flex-wrap:wrap!important;width:auto!important;height:auto!important;gap:8px!important;padding:76px clamp(16px,4vw,40px) 0!important;background:none!important;border:0!important;box-shadow:none!important}"
  + "[data-home-moons] a{position:static!important;transform:none!important;width:auto!important;padding-inline:14px!important}"
  + "[data-home-foot]>a{margin-right:16px}"
  + "[data-course-list]{position:static;width:auto;height:auto;margin:0;padding:0 clamp(16px,4vw,40px);overflow:visible;clip-path:none;white-space:normal}";

/** The field of soft light behind the home page, which gives the glass something to bend. One light follows a mouse. */
export function FluidField() {
  const light = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        light.current?.style.setProperty("transform", `translate(${x}px, ${y}px)`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return <div className={styles.field} aria-hidden="true">
    <i className={styles.blobA} />
    <i className={styles.blobB} />
    <i className={styles.blobC} />
    <i ref={light} className={styles.blobLight} />
  </div>;
}

/** Holds on to the last real value, so a panel keeps its contents while it fades away. */
function useLast<T>(value: T | null) {
  const last = useRef(value);
  if (value !== null) last.current = value;
  return last.current;
}

/**
 * The opening of the home page, where the orb is the navigation. The glass in its middle starts the next lesson.
 * The names on its rim, and any dot, open the course where they point. The site's four sections sit on an orbit
 * around it, then dock in a row once the page has scrolled past.
 */
export function OrbHome({ chapters, goals, graph, words, foot, start, counts }: {
  chapters: CourseChapter[];
  goals: GoalOption[];
  graph: OrbGraph;
  words: ReactNode;
  foot: ReactNode;
  start: { href: string; label: string };
  counts: { labs: number; challenges: number };
}) {
  const path = useCoursePath(chapters, goals);
  const orb = useCourseOrb({
    graph, chapters, order: path.order, ordered: Boolean(path.goal), goalChanges: path.goalChanges,
    progress: path.progress, next: path.next, started: path.started, onFail: () => path.setOrbFailed(true),
  });
  const [docked, setDocked] = useState(false);
  const [dive, setDive] = useState(false);
  const orbScene = useRef<OrbScene | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const focusHeading = useRef(false);

  const open = orb.selected !== null || orb.part !== null;
  const partNow = orb.selected !== null ? graph.chapterParts[orb.selected] : orb.part;
  const view = useLast(open ? { chapter: orb.selected, part: partNow ?? 0 } : null);
  const { action, finished, total } = path.courseState;
  const nextPart = orb.nextLesson !== null ? graph.chapterParts[chapterOfLesson(graph, orb.nextLesson)] : 0;
  const clear = orb.clear;

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const watcher = new IntersectionObserver(([entry]) => setDocked(!entry.isIntersecting));
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  useEffect(() => { if (docked) clear(); }, [docked, clear]);

  useEffect(() => {
    if (dive || path.orbFailed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wake = ["wheel", "touchstart", "keydown", "scroll", "pointermove"] as const;
    const go = () => setDive(true);
    for (const name of wake) window.addEventListener(name, go, { passive: true, once: true });
    const idle = "requestIdleCallback" in window ? window.requestIdleCallback(go, { timeout: 4000 }) : 0;
    const timer = idle ? 0 : window.setTimeout(go, 2500);
    return () => {
      for (const name of wake) window.removeEventListener(name, go);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [dive, path.orbFailed]);

  // The dive comes out at a lesson about scaling, since that's what the game is about.
  const exits = useMemo(() => {
    const index = Math.max(0, chapters.findIndex((chapter) => chapter.id === "scaling"));
    const lessons: number[] = [];
    for (let lesson = graph.chapterStarts[index]; lesson < graph.chapterStarts[index + 1]; lesson++) lessons.push(lesson);
    return lessons;
  }, [chapters, graph]);

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [orb.selected, orb.part]);

  function browse(part: number) {
    opener.current = document.activeElement as HTMLElement | null;
    focusHeading.current = true;
    trackEvent("orb_open_part");
    orb.showPart(part);
  }

  function openLearn(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || path.orbFailed) return;
    event.preventDefault();
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
    browse(nextPart);
  }

  function close() {
    orb.clear();
    opener.current?.focus({ preventScroll: true });
    opener.current = null;
  }

  function showChapter(index: number) {
    focusHeading.current = true;
    orb.showChapter(index);
  }

  function backToPart() {
    focusHeading.current = true;
    orb.showPart(view?.part ?? 0);
  }

  const startLink = <Link className={siteStyles.primaryLink} href={action?.href ?? start.href} onClick={() => trackEvent("home_start_button")}>
    {action?.label ?? start.label} <ArrowRight size={17} aria-hidden="true" />
  </Link>;

  const partChapters = view ? chapters.flatMap((chapter, index) => graph.chapterParts[index] === view.part ? [{ chapter, index }] : []) : [];
  const partLessons = partChapters.reduce((sum, { chapter }) => sum + chapter.lessonCount, 0);
  const partDone = partChapters.reduce((sum, { chapter }) => sum + completedCount(chapter.stepIds, path.progress[chapter.storageKey] ?? emptyProgress), 0);
  const shown = view && view.chapter !== null ? chapters[view.chapter] : null;
  const shownDone = shown ? completedCount(shown.stepIds, path.progress[shown.storageKey] ?? emptyProgress) : 0;
  const walkPlace = view && view.chapter !== null ? path.order.indexOf(view.chapter) : -1;

  return <CourseState.Provider value={path.courseState}>
    {path.orbFailed ? <style>{FLAT_PAGE}</style> : <noscript><style>{FLAT_PAGE}</style></noscript>}
    <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />

    <nav className={`${styles.moons} ${docked ? styles.docked : ""}`} aria-label="Main" data-home-moons>
      <Link className={styles.moon} href="/learn/" onClick={openLearn}>Learn <span className={styles.moonCount}>{total || graph.titles.length}</span></Link>
      <Link className={styles.moon} href="/labs/">Labs <span className={styles.moonCount}>{counts.labs}</span></Link>
      <Link className={styles.moon} href="/practice/">Practice <span className={styles.moonCount}>{counts.challenges}</span></Link>
      <Link className={styles.moon} href="/review/">Review <DueReviewBadge /></Link>
    </nav>

    <div id="path" className={`${styles.stage} ${open ? styles.exploring : ""}`} data-home-stage>
      <div className={styles.words} data-home-words>{words}</div>

      <div className={styles.orbWrap} data-home-orb>
        <div className={styles.orbArrive}>
          <span className={styles.sphere} aria-hidden="true" />
          <svg className={`${styles.orbit} ${docked ? styles.orbitGone : ""}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <circle cx="50" cy="50" r="49.7" pathLength="360" strokeDasharray="110 360" transform="rotate(-72 50 50)" />
          </svg>
          {path.orbFailed ? null : <OrbStage
            orb={orb}
            graph={graph}
            chapters={chapters}
            onFail={() => path.setOrbFailed(true)}
            navigation
            resting={docked}
            onPart={browse}
            sceneRef={orbScene}
            className={styles.orbStage}
            tooltipClassName={styles.orbTooltip}
          />}
          <Link className={styles.lens} href={action?.href ?? start.href} onClick={() => trackEvent("home_start_button")} inert={open || undefined}>
            <svg className={styles.lensRing} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <circle className={styles.lensTrack} cx="50" cy="50" r="49" pathLength="100" />
              {finished > 0 ? <circle className={styles.lensDone} cx="50" cy="50" r="49" pathLength="100" strokeDasharray={`${Math.max(1, (finished / total) * 100)} 100`} /> : null}
            </svg>
            <Play className={styles.lensIcon} size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            <span>{action?.label ?? start.label}</span>
          </Link>
        </div>
      </div>

      <div className={styles.foot} data-home-foot>
        {foot}
        {path.orbFailed ? startLink : <noscript>{startLink}</noscript>}
      </div>

      <div className={styles.goalBlock} data-home-goal>
        <p className={styles.goalNote}>
          <span className={styles.hintPointer}>Drag to turn it. Every dot is a lesson.</span>
          <span className={styles.hintTouch}>Swipe to turn it. Tap a dot to see its chapter.</span>
        </p>
        <p className="sr-only" role="status">{path.goal?.detail}</p>
        <fieldset className={styles.goal}>
          <legend>What are you here for?</legend>
          <div className={styles.goalOptions}>
            {goals.map((option) => <label key={option.id} className={path.goalId === option.id ? styles.goalOn : undefined}>
              <input type="radio" name="home-goal" checked={path.goalId === option.id} onChange={() => path.choose(option.id)} />
              <span>{GOAL_NAMES[option.id] ?? option.label}</span>
            </label>)}
          </div>
        </fieldset>
      </div>

      <aside
        className={`${styles.panel} ${open ? styles.panelOn : ""}`}
        aria-label="Browse the course"
        inert={!open || undefined}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}
      >
        {view ? <>
          <div className={styles.panelBar}>
            {shown
              ? <button type="button" className={styles.panelBack} onClick={backToPart}><ArrowLeft size={15} aria-hidden="true" /> {graph.partTitles[view.part]}</button>
              : <span className={styles.panelPlace}>Part {view.part + 1} of {graph.partTitles.length}</span>}
            <div className={styles.panelTools}>
              {shown ? <>
                <button type="button" onClick={() => orb.stepChapter(-1)} aria-label="Previous chapter"><ChevronLeft size={17} aria-hidden="true" /></button>
                <button type="button" onClick={() => orb.stepChapter(1)} aria-label="Next chapter"><ChevronRight size={17} aria-hidden="true" /></button>
              </> : <>
                <button type="button" onClick={() => orb.showPart((view.part + graph.partTitles.length - 1) % graph.partTitles.length)} aria-label="Previous part"><ChevronLeft size={17} aria-hidden="true" /></button>
                <button type="button" onClick={() => orb.showPart((view.part + 1) % graph.partTitles.length)} aria-label="Next part"><ChevronRight size={17} aria-hidden="true" /></button>
              </>}
              <button type="button" onClick={close} aria-label="Close and go back to the orb"><X size={17} aria-hidden="true" /></button>
            </div>
          </div>

          <div key={shown ? `chapter-${view.chapter}` : `part-${view.part}`} className={styles.panelBody}>
            {shown && view.chapter !== null ? <>
              <h2 ref={heading} tabIndex={-1} className={styles.panelTitle}>{shown.title}</h2>
              <p className={styles.panelFacts}>
                {shownDone > 0 ? `${shownDone} of ${lessons(shown.lessonCount)} finished` : lessons(shown.lessonCount)}
                {path.goal && walkPlace >= 0 ? <> · step {walkPlace + 1} of {path.order.length} in your order</> : null}
              </p>
              {nextIsOutOfSight(orb, graph) && orb.nextLesson !== null ? <Link className={styles.nextUp} href={orb.hrefOf(orb.nextLesson)} onClick={() => trackEvent("orb_open_row")}>
                <span>{orb.nextLabel}: {graph.titles[orb.nextLesson]}</span> <ArrowRight size={15} aria-hidden="true" />
              </Link> : null}
              <ChapterLessons orb={orb} graph={graph} chapter={shown} index={view.chapter} />
              <Link className={styles.panelLink} href={chapterHref(shown.id)} onClick={() => trackEvent("orb_open_chapter")}>About this chapter</Link>
            </> : <>
              <h2 ref={heading} tabIndex={-1} className={styles.panelTitle}>{graph.partTitles[view.part]}</h2>
              <p className={styles.panelFacts}>
                {partChapters.length} {partChapters.length === 1 ? "chapter" : "chapters"} · {partDone > 0 ? `${partDone} of ${lessons(partLessons)} finished` : lessons(partLessons)}
              </p>
              <ol className={styles.chapterRows}>
                {partChapters.map(({ chapter, index }) => {
                  const done = completedCount(chapter.stepIds, path.progress[chapter.storageKey] ?? emptyProgress);
                  return <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => showChapter(index)}
                      onPointerEnter={(event) => { if (event.pointerType === "mouse") orb.setPreview(index); }}
                      onPointerLeave={(event) => { if (event.pointerType === "mouse") orb.setPreview(null); }}
                      onFocus={() => orb.setPreview(index)}
                      onBlur={() => orb.setPreview(null)}
                    >
                      <span className={styles.chapterTitle}>{chapter.title}</span>
                      <span className={`${styles.chapterMeta} ${done === chapter.lessonCount ? styles.chapterDone : ""}`}>
                        {done === chapter.lessonCount ? <><Check size={13} aria-hidden="true" /> Done</> : done > 0 ? `${done} of ${chapter.lessonCount}` : chapter.lessonCount}
                      </span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </li>;
                })}
              </ol>
            </>}
          </div>
        </> : null}
      </aside>
    </div>

    {dive && !path.orbFailed ? <NeuronFlight graph={graph} exits={exits} orb={orbScene} finished={orb.finished} chapters={chapters} /> : null}

    <h2 className="sr-only">The learning path</h2>
    <CourseList path={path} />
    <p className="sr-only" aria-live="polite">{orb.spoken}</p>
  </CourseState.Provider>;
}
