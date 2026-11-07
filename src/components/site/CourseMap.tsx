"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, List, Waypoints } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref, lessonHref } from "@/lib/links";
import type { OrbGraph } from "@/lib/orb-layout";
import { ACTIVE_CHAPTER_KEY, COURSE_VIEW_KEY, completedCount, emptyProgress, GOAL_KEY, mainAction, nextLessonInOrder, readProgress, type OutlineChapter, type Progress } from "@/lib/progress";
import { CourseOrb } from "./CourseOrb";
import styles from "./Site.module.css";

export type CourseChapter = OutlineChapter & { summary: string; lessonCount: number };
export type GoalOption = { id: string; label: string; detail: string; order: string[] };

const CourseState = createContext<{ action: { href: string; label: string } | null; finished: number; total: number }>({ action: null, finished: 0, total: 0 });

/** The home page's main button. It sits beside the orb, so it offers the lesson the orb is pointing at. */
export function StartLink({ href, label }: { href: string; label: string }) {
  const { action } = useContext(CourseState);
  return <Link className={styles.primaryLink} href={action?.href ?? href} onClick={() => trackEvent("home_start_button")}>
    {action?.label ?? label} <ArrowRight size={17} aria-hidden="true" />
  </Link>;
}

/** What the course offers, until there's progress worth reporting and a reason to back it up. */
export function CourseScope({ children }: { children: ReactNode }) {
  const { finished, total } = useContext(CourseState);
  return <p className={styles.scope}>{finished > 0
    ? <><strong>You’ve finished {finished} of {total} lessons.</strong> They’re saved in this browser, so <Link href="/progress/">keep a backup</Link>.</>
    : children}</p>;
}

function ChapterRow({ chapter, done, tucked, prefetch }: { chapter: CourseChapter; done: number; tucked: boolean; prefetch: boolean }) {
  return <li className={styles.row}>
    <Link href={chapterHref(chapter.id)} tabIndex={tucked ? -1 : undefined} prefetch={prefetch ? undefined : false} onClick={() => trackEvent("path_open_list_chapter")}>
      <span className={styles.rowNumber}>{chapter.number}</span>
      <span className={styles.rowTitle}>{chapter.title}</span>
      <span className={`${styles.rowMeta} ${done === chapter.lessonCount ? styles.rowDone : ""}`}>
        {done === chapter.lessonCount ? <><Check size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Done</> : done > 0 ? `${done} of ${chapter.lessonCount} lessons` : `${chapter.lessonCount} lessons`}
      </span>
      <span className={styles.rowDetail}>{chapter.summary}</span>
    </Link>
  </li>;
}

/** With `lead`, this opens the page: `lead` and the path's controls down the left, and the orb or the list on the right. */
export function CourseMap({ chapters, goals, orb, lead }: { chapters: CourseChapter[]; goals: GoalOption[]; orb: OrbGraph; lead?: ReactNode }) {
  const [goalId, setGoalId] = useState<string | null>(null);
  const [goalChanges, setGoalChanges] = useState(0);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [view, setView] = useState<"orb" | "list">("orb");
  const [orbFailed, setOrbFailed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GOAL_KEY);
      if (goals.some((goal) => goal.id === saved)) setGoalId(saved);
      setActiveChapter(window.localStorage.getItem(ACTIVE_CHAPTER_KEY));
      if (window.localStorage.getItem(COURSE_VIEW_KEY) === "list") setView("list");
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

  function switchView(next: "orb" | "list") {
    if (next === view) return;
    setView(next);
    trackEvent(next === "list" ? "path_switch_list" : "path_switch_orb");
    try { window.localStorage.setItem(COURSE_VIEW_KEY, next); } catch { /* The choice still applies for this visit. */ }
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

  const showOrb = view === "orb" && !orbFailed;

  const goalChooser = <fieldset className={styles.goal}>
    <legend>What are you here for?</legend>
    <div className={styles.goalOptions}>
      {goals.map((option) => <label key={option.id} className={goalId === option.id ? styles.goalOn : undefined}>
        <input type="radio" name="course-goal" checked={goalId === option.id} onChange={() => choose(option.id)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
  const viewSwitch = orbFailed ? null : <div className={styles.viewSwitch} role="group" aria-label="How to show the learning path" data-course-switch>
    <button type="button" aria-pressed={view === "orb"} onClick={() => switchView("orb")}><Waypoints size={15} aria-hidden="true" /> Map</button>
    <button type="button" aria-pressed={view === "list"} onClick={() => switchView("list")}><List size={15} aria-hidden="true" /> List</button>
  </div>;
  const goalNote = <p className={styles.goalDetail} role="status">{goal?.detail ?? "Choose one and the course will reorder to suit it. You can change your mind at any time."}</p>;
  const courseOrb = (between?: ReactNode) => <div className={lead ? styles.leadOrb : undefined} data-course-orb>
    <CourseOrb
      graph={orb}
      chapters={chapters}
      order={order}
      ordered={Boolean(goal)}
      goalChanges={goalChanges}
      progress={progress}
      next={next}
      started={started}
      onFail={() => setOrbFailed(true)}
      lead={Boolean(lead)}
      between={between}
    />
  </div>;
  // Search engines and screen readers read this list in either view; it only leaves the screen and the tab order.
  const courseList = <div className={showOrb ? "sr-only" : lead ? styles.leadList : undefined} data-course-list>
    {groups.map((group) => <div key={group.title} className={styles.part}>
      <h3 className={styles.partTitle}>{group.title}</h3>
      <ol className={styles.rows}>{group.chapters.map((chapter) => <ChapterRow key={chapter.id} chapter={chapter} done={completedCount(chapter.stepIds, progress[chapter.storageKey] ?? emptyProgress)} tucked={showOrb && hydrated} prefetch={!showOrb} />)}</ol>
    </div>)}
  </div>;
  const noScript = <noscript><style>{"[data-course-orb],[data-course-switch]{display:none}[data-course-list]{position:static;width:auto;height:auto;margin:0;overflow:visible;clip-path:none;white-space:normal}"}</style></noscript>;

  if (lead) {
    const chooser = <div className={styles.leadGoal}>{goalChooser}{goalNote}</div>;
    return <CourseState.Provider value={courseState}>
      <div className={styles.lead}>
        <div className={`${styles.leadRail} ${showOrb ? "" : styles.leadRailStuck}`}>
          <div className={styles.leadIntro}>{lead}</div>
          <div id="path" className={styles.pathHead}>
            <h2>The learning path</h2>
            {viewSwitch}
          </div>
          {showOrb ? null : chooser}
        </div>
        {showOrb ? courseOrb(chooser) : null}
        {courseList}
        {noScript}
      </div>
    </CourseState.Provider>;
  }

  return <>
    <div className={styles.pathControls}>
      {goalChooser}
      {viewSwitch}
    </div>
    {goalNote}
    {showOrb ? courseOrb() : null}
    {courseList}
    {noScript}
  </>;
}
