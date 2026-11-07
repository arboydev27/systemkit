"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref, lessonHref } from "@/lib/links";
import type { OrbGraph } from "@/lib/orb-layout";
import { ACTIVE_CHAPTER_KEY, completedCount, emptyProgress, GOAL_KEY, mainAction, nextLessonInOrder, readProgress, type OutlineChapter, type Progress } from "@/lib/progress";
import { CourseOrb } from "./CourseOrb";
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

/** Search engines and screen readers read this list while the orb is showing. It only leaves the screen and the tab order, and it takes over whenever the orb can't run. */
export function CourseList({ path }: { path: ReturnType<typeof useCoursePath> }) {
  return <div className={!path.orbFailed ? "sr-only" : undefined} data-course-list>
    {path.groups.map((group) => <div key={group.title} className={styles.part}>
      <h3 className={styles.partTitle}>{group.title}</h3>
      <ol className={styles.rows}>{group.chapters.map((chapter) => <ChapterRow key={chapter.id} chapter={chapter} done={completedCount(chapter.stepIds, path.progress[chapter.storageKey] ?? emptyProgress)} tucked={!path.orbFailed && path.hydrated} />)}</ol>
    </div>)}
  </div>;
}

/** The learning path page: the goal, then the orb with its lesson panel. */
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
      />
    </div> : null}
    <CourseList path={path} />
    <noscript><style>{"[data-course-orb]{display:none}[data-course-list]{position:static;width:auto;height:auto;margin:0;overflow:visible;clip-path:none;white-space:normal}"}</style></noscript>
  </>;
}
