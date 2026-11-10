"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref } from "@/lib/links";
import { bubbleSide, ledgeOf, seatX } from "@/lib/milo";
import type { OrbGraph } from "@/lib/orb-layout";
import { chapterOfLesson } from "@/lib/orb-view";
import { completedCount, emptyProgress } from "@/lib/progress";
import { CourseList, CourseState, useCoursePath, type CourseChapter, type GoalOption } from "./CourseMap";
import { ChapterLessons, nextIsOutOfSight, useCourseNav } from "./CourseNav";
import { CourseLedge, MiloFigure, partLessons, useMiloLife, type MiloFocus } from "./Milo";
import type { NeuronFlightProps } from "./NeuronFlight";
import { DueReviewBadge } from "./SiteClient";
import { PaintDab, WallPaint } from "./WallPaint";
import styles from "./MiloHome.module.css";
import siteStyles from "./Site.module.css";

// The dive from Milo's eye to the game loads after the first screen, on the first sign of a visitor or the first quiet
// moment. Until then, and if it can't load, the page scrolls with the plain fade the stylesheet gives it.
const NeuronFlight = dynamic<NeuronFlightProps>(() => import("./NeuronFlight").catch(() => ({ default: () => null })), { ssr: false });

const GOAL_NAMES: Record<string, string> = { interview: "An interview", work: "Work", foundations: "Fundamentals" };
const lessons = (count: number) => `${count} ${count === 1 ? "lesson" : "lessons"}`;
// How much of the figure's width his body takes up at the line, which is what has to stay on the stage.
// His head is the widest part of him, and it all has to stay on the stage and clear of the words.
const HEAD_SHARE = 0.42;
// His width on screen: his height times 1340/1841, from the stage's --milo-h on each layout.
const FIGURE_SIZES = "(min-width: 960px) and (min-height: 600px) min(48vh, 34vw), (max-height: 599px) and (min-width: 640px) min(61vh, 32vw), min(31vh, 73vw, 320px)";

// When the course line can't run, or without JavaScript, everything below the words lies flat and the chapter list shows.
const FLAT_PAGE = "[data-home-scene],[data-home-wall],[data-home-goal],[data-home-bubble]{display:none!important}"
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
 * The opening of the home page: Milo, sitting on the course, on a ledge in front of a wall with orange paint running
 * down it. The ledge's front edge is every lesson in order, he sits at the visitor's next one, and what he says starts it. The four parts under the line open the course where they point,
 * and scrolling dives in through his eye.
 */
export function MiloHome({ chapters, goals, graph, words, foot, start, counts }: {
  chapters: CourseChapter[];
  goals: GoalOption[];
  graph: OrbGraph;
  words: ReactNode;
  foot: ReactNode;
  start: { href: string; label: string };
  counts: { labs: number; challenges: number };
}) {
  const path = useCoursePath(chapters, goals);
  const nav = useCourseNav({
    graph, chapters, order: path.order, ordered: Boolean(path.goal), goalChanges: path.goalChanges,
    progress: path.progress, next: path.next, started: path.started, onFail: () => path.setOrbFailed(true),
  });
  const ledge = useMemo(() => ledgeOf(graph), [graph]);
  const [dive, setDive] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const stage = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const focus = useRef<MiloFocus>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const focusHeading = useRef(false);
  const startLesson = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const open = nav.selected !== null || nav.part !== null;
  const partNow = nav.selected !== null ? graph.chapterParts[nav.selected] : nav.part;
  const view = useLast(open ? { chapter: nav.selected, part: partNow ?? 0 } : null);
  const { action, finished, total } = path.courseState;
  const clear = nav.clear;
  const nextPart = nav.nextLesson !== null ? graph.chapterParts[chapterOfLesson(graph, nav.nextLesson)] : 0;
  startLesson.current = nav.nextLesson ?? 0;

  const wake = useMiloLife(figure, focus, path.orbFailed);

  // Where Milo sits: over the next lesson, kept on the stage. Moving him is a transform, so it never shifts the layout.
  const place = useCallback(() => {
    const node = stage.current;
    const line = node?.querySelector<HTMLElement>("[data-ledge]");
    if (!node || !line || !figure.current) return;
    const box = node.getBoundingClientRect();
    const lineBox = line.getBoundingClientRect();
    // He and his thought are placed in the scene the line is in, which on a phone on its side starts partway across.
    const sceneBox = (line.offsetParent ?? node).getBoundingClientRect();
    const width = figure.current.offsetWidth;
    const lesson = nav.nextLesson ?? 0;
    const edge = parseFloat(getComputedStyle(node).getPropertyValue("--edge")) || 16;
    const lineLeft = lineBox.left - sceneBox.left;
    const right = box.right - edge - sceneBox.left;
    const x = seatX(ledge.lessons[lesson], { left: lineLeft, width: lineBox.width }, width * HEAD_SHARE * 2, { left: lineLeft, right });
    node.style.setProperty("--seat-x", `${x.toFixed(1)}px`);
    setSide(bubbleSide(x, { left: lineLeft, right }));
  }, [ledge, nav.nextLesson]);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    place();
    const watcher = new ResizeObserver(place);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [place]);

  useEffect(() => {
    if (dive || path.orbFailed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wakeUp = ["wheel", "touchstart", "keydown", "scroll", "pointermove"] as const;
    const go = () => setDive(true);
    for (const name of wakeUp) window.addEventListener(name, go, { passive: true, once: true });
    const idle = "requestIdleCallback" in window ? window.requestIdleCallback(go, { timeout: 4000 }) : 0;
    const timer = idle ? 0 : window.setTimeout(go, 2500);
    return () => {
      for (const name of wakeUp) window.removeEventListener(name, go);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [dive, path.orbFailed]);

  // The dive comes out at a lesson about scaling, since that's what the game is about.
  const exits = useMemo(() => {
    const index = Math.max(0, chapters.findIndex((chapter) => chapter.id === "scaling"));
    const found: number[] = [];
    for (let lesson = graph.chapterStarts[index]; lesson < graph.chapterStarts[index + 1]; lesson++) found.push(lesson);
    return found;
  }, [chapters, graph]);

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [nav.selected, nav.part]);

  // He looks at the lesson being pointed at on the line, and otherwise, while the panel is open, reads it with the visitor.
  const lessonSpot = useRef<MiloFocus>(null);
  const aim = useCallback(() => {
    const box = open ? panelRef.current?.getBoundingClientRect() : null;
    focus.current = lessonSpot.current ?? (box && box.width ? { x: box.left + box.width / 2, y: box.top + Math.min(box.height, 320) / 2 } : null);
    wake.current();
  }, [open, wake]);
  useEffect(() => {
    // The panel slides in, so wait for it to land before looking at it.
    const timer = window.setTimeout(aim, open ? 260 : 0);
    return () => window.clearTimeout(timer);
  }, [aim, open]);
  const onFocusLesson = useCallback((spot: MiloFocus) => {
    lessonSpot.current = spot;
    aim();
  }, [aim]);

  // Once the page has scrolled past the first screen, the panel closes.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const watcher = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) clear(); });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [clear]);

  function browse(part: number) {
    opener.current = document.activeElement as HTMLElement | null;
    focusHeading.current = true;
    trackEvent("orb_open_part");
    nav.showPart(part);
  }

  function openLearn(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || path.orbFailed) return;
    event.preventDefault();
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
    browse(nextPart);
  }

  function close() {
    nav.clear();
    opener.current?.focus({ preventScroll: true });
    opener.current = null;
  }

  function showChapter(index: number) {
    focusHeading.current = true;
    nav.showChapter(index);
  }

  function backToPart() {
    focusHeading.current = true;
    nav.showPart(view?.part ?? 0);
  }

  function setMood(mood: string | null) {
    const node = figure.current;
    if (!node) return;
    if (mood) node.dataset.mood = mood;
    else delete node.dataset.mood;
  }

  const actionHref = action?.href ?? start.href;
  const actionLabel = action?.label ?? start.label;
  const startLink = <Link className={siteStyles.primaryLink} href={actionHref} onClick={() => trackEvent("home_start_button")}>
    {actionLabel} <ArrowRight size={17} aria-hidden="true" />
  </Link>;

  const partChapters = view ? chapters.flatMap((chapter, index) => graph.chapterParts[index] === view.part ? [{ chapter, index }] : []) : [];
  const partLessonCount = partChapters.reduce((sum, { chapter }) => sum + chapter.lessonCount, 0);
  const partDone = partChapters.reduce((sum, { chapter }) => sum + completedCount(chapter.stepIds, path.progress[chapter.storageKey] ?? emptyProgress), 0);
  const shown = view && view.chapter !== null ? chapters[view.chapter] : null;
  const shownDone = shown ? completedCount(shown.stepIds, path.progress[shown.storageKey] ?? emptyProgress) : 0;
  const walkPlace = view && view.chapter !== null ? path.order.indexOf(view.chapter) : -1;
  const lit = nav.preview !== null ? { from: graph.chapterStarts[nav.preview], to: graph.chapterStarts[nav.preview + 1] }
    : !open ? null : nav.selected !== null ? { from: graph.chapterStarts[nav.selected], to: graph.chapterStarts[nav.selected + 1] } : partLessons(graph, nav.part ?? 0);
  const ring = total > 0 && finished > 0 ? Math.max(1, (finished / total) * 100) : 0;

  return <CourseState.Provider value={path.courseState}>
    {path.orbFailed ? <style>{FLAT_PAGE}</style> : <noscript><style>{FLAT_PAGE}</style></noscript>}
    <div ref={sentinel} className={styles.sentinel} aria-hidden="true" />

    <nav className={styles.moons} aria-label="Main" data-home-moons>
      <Link className={styles.moon} href="/learn/" onClick={openLearn}>Learn <span className={styles.moonCount}>{total || graph.titles.length}</span></Link>
      <Link className={styles.moon} href="/labs/">Labs <span className={styles.moonCount}>{counts.labs}</span></Link>
      <Link className={styles.moon} href="/practice/">Practice <span className={styles.moonCount}>{counts.challenges}</span></Link>
      <Link className={styles.moon} href="/review/">Review <DueReviewBadge /></Link>
    </nav>

    <div id="path" ref={stage} className={`${styles.stage} ${open ? styles.exploring : ""}`} data-home-stage>
      <WallPaint />
      <div className={styles.words} data-home-words>{words}</div>

      <div className={styles.scene} data-home-scene>
        <i className={styles.cast} aria-hidden="true" />
        <i className={styles.shelf} aria-hidden="true" />
        <Link
          className={`${styles.bubble} ${side === "left" ? styles.bubbleLeft : ""}`}
          href={actionHref}
          onClick={() => trackEvent("home_start_button")}
          onPointerEnter={() => setMood("happy")}
          onPointerLeave={() => setMood(null)}
          onFocus={() => setMood("happy")}
          onBlur={() => setMood(null)}
          data-home-bubble
        >
          <span className={styles.bubblePill}>
            <span className={styles.bubbleIcon} aria-hidden="true">
              <svg className={styles.bubbleRing} viewBox="0 0 36 36" focusable="false">
                <circle className={styles.bubbleTrack} cx="18" cy="18" r="16.5" pathLength="100" />
                {ring ? <circle className={styles.bubbleDone} cx="18" cy="18" r="16.5" pathLength="100" strokeDasharray={`${ring} 100`} /> : null}
              </svg>
              <Play size={12} fill="currentColor" strokeWidth={0} />
            </span>
            <span className={styles.bubbleLabel}>{actionLabel}</span>
          </span>
          {/* The trail of a thought, from his head up to what he's thinking. */}
          <span className={styles.bubbleTrail} aria-hidden="true"><i /><i /><i /></span>
        </Link>
        <CourseLedge
          graph={graph}
          chapters={chapters}
          nav={nav}
          ledge={ledge}
          onPart={browse}
          onFocusLesson={onFocusLesson}
          highlight={lit}
          nextMark={<PaintDab />}
          className={styles.ledge}
          partsClassName={styles.parts}
        />
        <div className={styles.seat}>
          <MiloFigure figureRef={figure} className={styles.figure} sizes={FIGURE_SIZES} priority />
        </div>
      </div>

      <div className={styles.foot} data-home-foot>
        {foot}
        {path.orbFailed ? startLink : <noscript>{startLink}</noscript>}
      </div>

      <div className={styles.goalBlock} data-home-goal>
        <p className={styles.goalNote}>
          <span className={styles.hintPointer}>Every tick on the line is a lesson. Milo sits at your next one.</span>
          <span className={styles.hintTouch}>Tap a tick on the line to see its chapter.</span>
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
        ref={panelRef}
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
                <button type="button" onClick={() => nav.stepChapter(-1)} aria-label="Previous chapter"><ChevronLeft size={17} aria-hidden="true" /></button>
                <button type="button" onClick={() => nav.stepChapter(1)} aria-label="Next chapter"><ChevronRight size={17} aria-hidden="true" /></button>
              </> : <>
                <button type="button" onClick={() => nav.showPart((view.part + graph.partTitles.length - 1) % graph.partTitles.length)} aria-label="Previous part"><ChevronLeft size={17} aria-hidden="true" /></button>
                <button type="button" onClick={() => nav.showPart((view.part + 1) % graph.partTitles.length)} aria-label="Next part"><ChevronRight size={17} aria-hidden="true" /></button>
              </>}
              <button type="button" onClick={close} aria-label="Close and go back to Milo"><X size={17} aria-hidden="true" /></button>
            </div>
          </div>

          <div key={shown ? `chapter-${view.chapter}` : `part-${view.part}`} className={styles.panelBody}>
            {shown && view.chapter !== null ? <>
              <h2 ref={heading} tabIndex={-1} className={styles.panelTitle}>{shown.title}</h2>
              <p className={styles.panelFacts}>
                {shownDone > 0 ? `${shownDone} of ${lessons(shown.lessonCount)} finished` : lessons(shown.lessonCount)}
                {path.goal && walkPlace >= 0 ? <> · step {walkPlace + 1} of {path.order.length} in your order</> : null}
              </p>
              {nextIsOutOfSight(nav, graph) && nav.nextLesson !== null ? <Link className={styles.nextUp} href={nav.hrefOf(nav.nextLesson)} onClick={() => trackEvent("orb_open_row")}>
                <span>{nav.nextLabel}: {graph.titles[nav.nextLesson]}</span> <ArrowRight size={15} aria-hidden="true" />
              </Link> : null}
              <ChapterLessons nav={nav} graph={graph} chapter={shown} index={view.chapter} />
              <Link className={styles.panelLink} href={chapterHref(shown.id)} onClick={() => trackEvent("orb_open_chapter")}>About this chapter</Link>
            </> : <>
              <h2 ref={heading} tabIndex={-1} className={styles.panelTitle}>{graph.partTitles[view.part]}</h2>
              <p className={styles.panelFacts}>
                {partChapters.length} {partChapters.length === 1 ? "chapter" : "chapters"} · {partDone > 0 ? `${partDone} of ${lessons(partLessonCount)} finished` : lessons(partLessonCount)}
              </p>
              <ol className={styles.chapterRows}>
                {partChapters.map(({ chapter, index }) => {
                  const done = completedCount(chapter.stepIds, path.progress[chapter.storageKey] ?? emptyProgress);
                  return <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => showChapter(index)}
                      onPointerEnter={(event) => { if (event.pointerType === "mouse") nav.setPreview(index); }}
                      onPointerLeave={(event) => { if (event.pointerType === "mouse") nav.setPreview(null); }}
                      onFocus={() => nav.setPreview(index)}
                      onBlur={() => nav.setPreview(null)}
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

    {dive && !path.orbFailed ? <NeuronFlight graph={graph} exits={exits} start={startLesson} finished={nav.finished} /> : null}

    <h2 className="sr-only">The learning path</h2>
    <CourseList path={path} />
    <p className="sr-only" aria-live="polite">{nav.spoken}</p>
  </CourseState.Provider>;
}
