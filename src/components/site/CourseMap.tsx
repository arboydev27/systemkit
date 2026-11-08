"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref, lessonHref } from "@/lib/links";
import type { OrbGraph } from "@/lib/orb-layout";
import { ledgeOf, seatX } from "@/lib/milo";
import { ACTIVE_CHAPTER_KEY, completedCount, emptyProgress, GOAL_KEY, mainAction, nextLessonInOrder, readProgress, type OutlineChapter, type Progress } from "@/lib/progress";
import { ChapterLessons, nextIsOutOfSight, useCourseNav, type CourseNavProps } from "./CourseNav";
import navStyles from "./CourseNav.module.css";
import { CourseLedge, MiloFigure, useMiloLife, type MiloFocus } from "./Milo";
import styles from "./Site.module.css";

export type CourseChapter = OutlineChapter & { summary: string; lessonCount: number };
export type GoalOption = { id: string; label: string; detail: string; order: string[] };
export type CourseStateValue = { action: { href: string; label: string } | null; finished: number; total: number };

export const CourseState = createContext<CourseStateValue>({ action: null, finished: 0, total: 0 });

/** What the course offers, until there's progress worth reporting and a reason to back it up. */
export function CourseScope({ children }: { children: ReactNode }) {
  const { finished, total } = useContext(CourseState);
  return <p className={styles.scope}>{finished > 0
    ? <><strong>You’ve finished {finished} of {total} lessons.</strong> <Link href="/progress/">Keep a backup</Link>.</>
    : children}</p>;
}

function ChapterRow({ chapter, done, tucked }: { chapter: CourseChapter; done: number; tucked: boolean }) {
  return <li className={styles.row}>
    <Link href={chapterHref(chapter.id)} tabIndex={tucked ? -1 : undefined} prefetch={tucked ? false : undefined} onClick={() => trackEvent("path_open_list_chapter")}>
      <span className={styles.rowNumber}>{chapter.number}</span>
      <span className={styles.rowTitle}>{chapter.title}</span>
      <span className={`${styles.rowMeta} ${done === chapter.lessonCount ? styles.rowDone : ""}`}>
        {done === chapter.lessonCount ? <><Check size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Done</> : done > 0 ? `${done} of ${chapter.lessonCount} lessons` : `${chapter.lessonCount} lessons`}
      </span>
      <span className={styles.rowDetail}>{chapter.summary}</span>
    </Link>
  </li>;
}

/** Where the learner is in the course and the order they've chosen, read from this browser. */
export function useCoursePath(chapters: CourseChapter[], goals: GoalOption[]) {
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalChanges, setGoalChanges] = useState(0);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [orbFailed, setOrbFailed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GOAL_KEY);
      if (goals.some((goal) => goal.id === saved)) setGoalId(saved);
      setActiveChapter(window.localStorage.getItem(ACTIVE_CHAPTER_KEY));
    } catch { /* The full path shows without a saved goal. */ }
    setProgress(Object.fromEntries(chapters.map((chapter) => [chapter.storageKey, readProgress(chapter.storageKey)])));
    if (window.matchMedia("(forced-colors: active)").matches) setOrbFailed(true);
    setHydrated(true);
  }, [chapters, goals]);

  function choose(id: string) {
    setGoalId(id);
    setGoalChanges((count) => count + 1);
    trackEvent(`goal_${id}`);
    try { window.localStorage.setItem(GOAL_KEY, id); } catch { /* The choice still applies for this visit. */ }
  }

  const goal = goals.find((item) => item.id === goalId);
  const walk = useMemo(() => {
    if (!goal) return chapters;
    const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    return goal.order.flatMap((id) => byId.get(id) ?? []);
  }, [chapters, goal]);
  const order = useMemo(() => walk.map((chapter) => chapters.indexOf(chapter)), [chapters, walk]);
  const next = useMemo(() => nextLessonInOrder(walk, activeChapter, (key) => progress[key] ?? emptyProgress), [walk, activeChapter, progress]);
  const started = useMemo(() => Object.values(progress).some((saved) => saved.completed.length > 0), [progress]);

  const courseState = useMemo(() => {
    const read = (key: string) => progress[key] ?? emptyProgress;
    const finished = chapters.reduce((sum, chapter) => sum + completedCount(chapter.stepIds, read(chapter.storageKey)), 0);
    const total = chapters.reduce((sum, chapter) => sum + chapter.lessonCount, 0);
    const lesson = mainAction(walk, activeChapter, read);
    let action = null;
    if (hydrated && !lesson && finished === total) action = { href: "/review/", label: "Keep them fresh in review" };
    else if (hydrated && lesson && (lesson.resuming || lesson.stepId !== chapters[0].stepIds[0])) {
      action = { href: lessonHref(lesson.chapterId, lesson.stepId), label: `${lesson.resuming ? "Continue" : "Start with"} ${lesson.title}` };
    }
    return { action, finished, total };
  }, [hydrated, walk, activeChapter, progress, chapters]);

  const groups = useMemo(() => {
    if (goal) return [{ title: "Suggested order", chapters: walk }];
    return chapters.reduce<{ title: string; chapters: CourseChapter[] }[]>((all, chapter) => {
      const last = all[all.length - 1];
      if (last?.title === chapter.part) last.chapters.push(chapter);
      else all.push({ title: chapter.part, chapters: [chapter] });
      return all;
    }, []);
  }, [chapters, goal, walk]);

  return { goalId, goal, choose, goalChanges, walk, order, next, started, progress, courseState, groups, orbFailed, setOrbFailed, hydrated };
}

/** The learning path's map: Milo on the course line at the next lesson, with the shown chapter's lessons beside him. */
function CourseLine(props: CourseNavProps) {
  const { graph, chapters, order, ordered, onFail } = props;
  const nav = useCourseNav(props);
  const ledge = useMemo(() => ledgeOf(graph), [graph]);
  const scene = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const focus = useRef<MiloFocus>(null);
  const wake = useMiloLife(figure, focus);
  const chapter = chapters[nav.shownChapter];
  const orderPlace = order.indexOf(nav.shownChapter);
  const doneInChapter = chapter.stepIds.filter((_, step) => nav.finished[nav.lessonAt(nav.shownChapter, step)]).length;

  // His images are the map's only part that can fail to arrive; the list takes over if they do.
  useEffect(() => {
    const images = [...(figure.current?.querySelectorAll("img") ?? [])];
    const failed = () => onFail();
    for (const image of images) image.addEventListener("error", failed);
    return () => { for (const image of images) image.removeEventListener("error", failed); };
  }, [onFail]);

  const place = useCallback(() => {
    const node = scene.current;
    const line = node?.querySelector<HTMLElement>("[data-ledge]");
    if (!node || !line || !figure.current) return;
    const width = node.getBoundingClientRect().width;
    const x = seatX(ledge.lessons[nav.nextLesson ?? 0], { left: 0, width }, figure.current.offsetWidth * 0.84, { left: 0, right: width });
    node.style.setProperty("--seat-x", `${x.toFixed(1)}px`);
  }, [ledge, nav.nextLesson]);

  useEffect(() => {
    const node = scene.current;
    if (!node) return;
    place();
    const watcher = new ResizeObserver(place);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [place]);

  const onFocusLesson = useCallback((spot: MiloFocus) => {
    focus.current = spot;
    wake.current();
  }, [wake]);

  return <>
    <div className={navStyles.course}>
      <div ref={scene} className={navStyles.scene}>
        <i className={navStyles.horizon} aria-hidden="true" />
        <CourseLedge
          graph={graph}
          chapters={chapters}
          nav={nav}
          ledge={ledge}
          onPart={(part) => nav.showChapter(graph.chapterParts.indexOf(part))}
          onFocusLesson={onFocusLesson}
          highlight={{ from: graph.chapterStarts[nav.shownChapter], to: graph.chapterStarts[nav.shownChapter + 1] }}
          className={navStyles.ledgeBox}
          partsClassName={navStyles.partsBox}
        />
        <div className={navStyles.seat}>
          <MiloFigure figureRef={figure} className={navStyles.figure} sizes="clamp(169px, 22vw, 243px)" />
        </div>
      </div>

      <div className={navStyles.panel}>
        <h3 className={navStyles.panelTitle}>{chapter.title}</h3>
        <p className={navStyles.panelFacts}>
          {chapter.part} · {doneInChapter > 0 ? `${doneInChapter} of ${chapter.lessonCount} lessons finished` : `${chapter.lessonCount} lessons`}
          {ordered ? <> · step {orderPlace + 1} of {order.length} in your order</> : null}
        </p>
        {nextIsOutOfSight(nav, graph) && nav.nextLesson !== null ? <Link className={navStyles.nextUp} href={nav.hrefOf(nav.nextLesson)} onClick={() => trackEvent("orb_open_row")}>
          <span>{nav.nextLabel}: {graph.titles[nav.nextLesson]}</span> <ArrowRight size={15} aria-hidden="true" />
        </Link> : null}
        <ChapterLessons nav={nav} graph={graph} chapter={chapter} index={nav.shownChapter} />
        <div className={navStyles.panelFoot}>
          <Link className={navStyles.chapterLink} href={chapterHref(chapter.id)} onClick={() => trackEvent("orb_open_chapter")}>About this chapter</Link>
          <div className={navStyles.steppers}>
            <button type="button" onClick={() => nav.stepChapter(-1)} aria-label="Previous chapter"><ChevronLeft size={17} aria-hidden="true" /></button>
            <button type="button" onClick={() => nav.stepChapter(1)} aria-label="Next chapter"><ChevronRight size={17} aria-hidden="true" /></button>
          </div>
        </div>
        {nav.nextLesson === null ? <p className={navStyles.allDone}>You’ve finished all {graph.titles.length} lessons. <Link href="/review/">Keep them fresh in review</Link>.</p> : null}
      </div>
    </div>

    <div className={navStyles.key}>
      <p>Each tick on the line is a lesson, in course order, gathered into chapters and four parts. Milo sits at your next one, which is lit. <span className={navStyles.hintPointer}>Point along the line to read a lesson&rsquo;s name, and click to open it.</span><span className={navStyles.hintTouch}>Each tick is a chapter on a phone. Tap one to see its lessons.</span></p>
      <ul>
        <li><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v6" stroke="currentColor" strokeOpacity=".3" /></svg> Not started</li>
        <li><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v6" stroke="currentColor" /></svg> Finished</li>
        <li><svg viewBox="0 0 12 12" aria-hidden="true"><path className={navStyles.keyNext} d="M6 1v10" strokeWidth="2" /></svg> {nav.nextLabel}</li>
      </ul>
    </div>
    <p className="sr-only" aria-live="polite">{nav.spoken}</p>
  </>;
}

/** Search engines and screen readers read this list while the course line is showing. It only leaves the screen and the tab order, and it takes over whenever the line can't run. */
export function CourseList({ path }: { path: ReturnType<typeof useCoursePath> }) {
  return <div className={!path.orbFailed ? "sr-only" : undefined} data-course-list>
    {path.groups.map((group) => <div key={group.title} className={styles.part}>
      <h3 className={styles.partTitle}>{group.title}</h3>
      <ol className={styles.rows}>{group.chapters.map((chapter) => <ChapterRow key={chapter.id} chapter={chapter} done={completedCount(chapter.stepIds, path.progress[chapter.storageKey] ?? emptyProgress)} tucked={!path.orbFailed && path.hydrated} />)}</ol>
    </div>)}
  </div>;
}

/** The learning path page: the goal, then Milo on the course line with its lesson panel. */
export function CourseMap({ chapters, goals, orb }: { chapters: CourseChapter[]; goals: GoalOption[]; orb: OrbGraph }) {
  const path = useCoursePath(chapters, goals);
  const { goal, goalId, choose, goalChanges, order, next, started, progress, orbFailed, setOrbFailed } = path;

  return <>
    <fieldset className={styles.goal}>
      <legend>What are you here for?</legend>
      <div className={styles.goalOptions}>
        {goals.map((option) => <label key={option.id} className={goalId === option.id ? styles.goalOn : undefined}>
          <input type="radio" name="course-goal" checked={goalId === option.id} onChange={() => choose(option.id)} />
          <span>{option.label}</span>
        </label>)}
      </div>
    </fieldset>
    <p className={styles.goalDetail} role="status">{goal?.detail ?? "Choose one and the course will reorder to suit it. You can change your mind at any time."}</p>
    {!orbFailed ? <div data-course-orb>
      <CourseLine
        graph={orb}
        chapters={chapters}
        order={order}
        ordered={Boolean(goal)}
        goalChanges={goalChanges}
        progress={progress}
        next={next}
        started={started}
        onFail={() => setOrbFailed(true)}
      />
    </div> : null}
    <CourseList path={path} />
    <noscript><style>{"[data-course-orb]{display:none}[data-course-list]{position:static;width:auto;height:auto;margin:0;overflow:visible;clip-path:none;white-space:normal}"}</style></noscript>
  </>;
}
