"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, List, Waypoints } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref } from "@/lib/links";
import type { OrbGraph } from "@/lib/orb-layout";
import { ACTIVE_CHAPTER_KEY, COURSE_VIEW_KEY, completedCount, emptyProgress, GOAL_KEY, nextLessonInOrder, readProgress, type OutlineChapter, type Progress } from "@/lib/progress";
import { CourseOrb } from "./CourseOrb";
import styles from "./Site.module.css";

export type CourseChapter = OutlineChapter & { summary: string; lessonCount: number };
export type GoalOption = { id: string; label: string; detail: string; order: string[] };

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

export function CourseMap({ chapters, goals, orb }: { chapters: CourseChapter[]; goals: GoalOption[]; orb: OrbGraph }) {
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

  return <>
    <div className={styles.pathControls}>
      <fieldset className={styles.goal}>
        <legend>What are you here for?</legend>
        <div className={styles.goalOptions}>
          {goals.map((option) => <label key={option.id} className={goalId === option.id ? styles.goalOn : undefined}>
            <input type="radio" name="course-goal" checked={goalId === option.id} onChange={() => choose(option.id)} />
            <span>{option.label}</span>
          </label>)}
        </div>
      </fieldset>
      {orbFailed ? null : <div className={styles.viewSwitch} role="group" aria-label="How to show the learning path" data-course-switch>
        <button type="button" aria-pressed={view === "orb"} onClick={() => switchView("orb")}><Waypoints size={15} aria-hidden="true" /> Map</button>
        <button type="button" aria-pressed={view === "list"} onClick={() => switchView("list")}><List size={15} aria-hidden="true" /> List</button>
      </div>}
    </div>
    <p className={styles.goalDetail} role="status">{goal?.detail ?? "Choose one and the course will reorder to suit it. You can change your mind at any time."}</p>
    {showOrb ? <div data-course-orb>
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
    {/* Search engines and screen readers read this list in either view; it only leaves the screen and the tab order. */}
    <div className={showOrb ? "sr-only" : undefined} data-course-list>
      {groups.map((group) => <div key={group.title} className={styles.part}>
        <h3 className={styles.partTitle}>{group.title}</h3>
        <ol className={styles.rows}>{group.chapters.map((chapter) => <ChapterRow key={chapter.id} chapter={chapter} done={completedCount(chapter.stepIds, progress[chapter.storageKey] ?? emptyProgress)} tucked={showOrb && hydrated} />)}</ol>
      </div>)}
    </div>
    <noscript><style>{"[data-course-orb],[data-course-switch]{display:none}[data-course-list]{position:static;width:auto;height:auto;margin:0;overflow:visible;clip-path:none;white-space:normal}"}</style></noscript>
  </>;
}
