"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Check, Download, Upload } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { collectBackup, completedLessons, LAST_BACKUP_KEY, parseBackup, restoreBackup, type Backup } from "@/lib/backup";
import { chapterHref, lessonHref } from "@/lib/links";
import { ACTIVE_CHAPTER_KEY, completedCount, GOAL_KEY, readProgress, resumeLesson, resumeStepInChapter, type OutlineChapter } from "@/lib/progress";
import { browserReviewStorage, countDue, readReviewState } from "@/lib/review";
import styles from "./Site.module.css";

export function DueReviewBadge() {
  const [due, setDue] = useState(0);
  useEffect(() => setDue(countDue(readReviewState(browserReviewStorage()), Date.now())), []);
  return due > 0 ? <span className={styles.due}>{due}<span className="sr-only"> due</span></span> : null;
}

export function ContinueLink({ outline, firstHref, firstLabel }: { outline: OutlineChapter[]; firstHref: string; firstLabel: string }) {
  const [resume, setResume] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => {
    let active: string | null = null;
    try { active = window.localStorage.getItem(ACTIVE_CHAPTER_KEY); } catch { /* A new visitor starts at the beginning. */ }
    const target = resumeLesson(outline, active, readProgress);
    const chapter = outline.find((item) => item.id === target?.chapterId);
    if (target && chapter) setResume({ href: lessonHref(target.chapterId, target.stepId), label: `Continue ${chapter.title}` });
  }, [outline]);
  return <Link className={styles.primaryLink} href={resume?.href ?? firstHref}>{resume?.label ?? firstLabel} <ArrowRight size={17} aria-hidden="true" /></Link>;
}

export type CourseChapter = OutlineChapter & { summary: string; lessonCount: number };
export type GoalOption = { id: string; label: string; detail: string; order: string[] };

function ChapterRow({ chapter, done }: { chapter: CourseChapter; done: number }) {
  return <li className={styles.row}>
    <Link href={chapterHref(chapter.id)}>
      <span className={styles.rowNumber}>{chapter.number}</span>
      <span className={styles.rowTitle}>{chapter.title}</span>
      <span className={`${styles.rowMeta} ${done === chapter.lessonCount ? styles.rowDone : ""}`}>
        {done === chapter.lessonCount ? <><Check size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Done</> : done > 0 ? `${done} of ${chapter.lessonCount} lessons` : `${chapter.lessonCount} lessons`}
      </span>
      <span className={styles.rowDetail}>{chapter.summary}</span>
    </Link>
  </li>;
}

export function CourseMap({ chapters, goals }: { chapters: CourseChapter[]; goals: GoalOption[] }) {
  const [goalId, setGoalId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GOAL_KEY);
      if (goals.some((goal) => goal.id === saved)) setGoalId(saved);
    } catch { /* The full path shows without a saved goal. */ }
    setDone(Object.fromEntries(chapters.map((chapter) => [chapter.id, completedCount(chapter.stepIds, readProgress(chapter.storageKey))])));
  }, [chapters, goals]);

  function choose(id: string) {
    setGoalId(id);
    trackEvent(`goal_${id}`);
    try { window.localStorage.setItem(GOAL_KEY, id); } catch { /* The choice still applies for this visit. */ }
  }

  const goal = goals.find((item) => item.id === goalId);
  const groups = useMemo(() => {
    if (goal) {
      const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
      return [{ title: "Suggested order", chapters: goal.order.flatMap((id) => byId.get(id) ?? []) }];
    }
    return chapters.reduce<{ title: string; chapters: CourseChapter[] }[]>((all, chapter) => {
      const last = all[all.length - 1];
      if (last?.title === chapter.part) last.chapters.push(chapter);
      else all.push({ title: chapter.part, chapters: [chapter] });
      return all;
    }, []);
  }, [chapters, goal]);

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
    <p className={styles.goalDetail} role="status">{goal?.detail ?? "Choose one and the chapters below will reorder to suit it. You can change your mind at any time."}</p>
    {groups.map((group) => <div key={group.title} className={styles.part}>
      <h3 className={styles.partTitle}>{group.title}</h3>
      <ol className={styles.rows}>{group.chapters.map((chapter) => <ChapterRow key={chapter.id} chapter={chapter} done={done[chapter.id] ?? 0} />)}</ol>
    </div>)}
  </>;
}

export function ProgressTools() {
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(LAST_BACKUP_KEY));
      if (saved > 0) setLastBackup(saved);
    } catch { /* Backups still download without this note. */ }
  }, []);

  function download() {
    try {
      const now = Date.now();
      window.localStorage.setItem(LAST_BACKUP_KEY, String(now));
      const backup = collectBackup(window.localStorage, now);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `systemkit-progress-${new Date(now).toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setLastBackup(now);
      setError("");
      setMessage(`Saved a backup with ${completedLessons(backup.items)} finished lessons.`);
      trackEvent("backup_downloaded");
    } catch {
      setError("This browser won’t allow access to saved progress, so there is nothing to back up.");
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseBackup(await file.text());
    setMessage("");
    if (parsed.ok) { setPending(parsed.backup); setError(""); }
    else { setPending(null); setError(parsed.error); }
  }

  function restore() {
    if (!pending) return;
    let restored = false;
    try { restored = restoreBackup(window.localStorage, pending); } catch { /* Reported below. */ }
    if (restored) {
      trackEvent("backup_restored");
      window.location.reload();
    } else {
      setPending(null);
      setError("This browser wouldn’t save the backup, so your existing progress was kept.");
    }
  }

  return <>
    <div className={styles.tools}>
      <button type="button" onClick={download}><Download size={15} aria-hidden="true" /> Download a backup</button>
      <label className={styles.fileButton}>
        <Upload size={15} aria-hidden="true" /> Restore from a backup
        <input type="file" accept="application/json,.json" onChange={chooseFile} />
      </label>
    </div>
    {pending ? <div className={styles.confirm} role="alertdialog" aria-label="Confirm restore">
      <p>This backup{pending.exportedAt ? ` from ${new Date(pending.exportedAt).toLocaleDateString()}` : ""} has {completedLessons(pending.items)} finished lessons. Restoring it replaces all SystemKit progress in this browser.</p>
      <div className={styles.tools}>
        <button type="button" className={styles.confirmDanger} onClick={restore}>Replace my progress</button>
        <button type="button" onClick={() => setPending(null)}>Keep what I have</button>
      </div>
    </div> : null}
    {error ? <p className={styles.toolsError} role="alert">{error}</p> : null}
    <p className={styles.toolsNote} role="status">{message || (lastBackup ? `Your last backup was on ${new Date(lastBackup).toLocaleDateString()}.` : "You haven’t made a backup in this browser yet.")}</p>
  </>;
}

export function ChapterStatus({ chapter }: { chapter: OutlineChapter }) {
  const [state, setState] = useState<{ done: number; resume?: string; firstTry?: { right: number; total: number } }>({ done: 0 });
  useEffect(() => {
    const progress = readProgress(chapter.storageKey);
    const attempts = Object.entries(readReviewState(browserReviewStorage()).firstAttempts)
      .filter(([key]) => key.startsWith(`${chapter.id}/`)).map(([, attempt]) => attempt);
    setState({
      done: completedCount(chapter.stepIds, progress),
      resume: resumeStepInChapter(chapter.stepIds, progress),
      firstTry: attempts.length ? { right: attempts.filter((attempt) => attempt.correct).length, total: attempts.length } : undefined,
    });
  }, [chapter]);
  const started = state.done > 0 || Boolean(state.firstTry);
  return <div className={styles.chapterStatus}>
    <Link className={styles.primaryLink} href={lessonHref(chapter.id, state.resume ?? chapter.stepIds[0])}>
      {!started ? "Start this chapter" : state.resume ? "Continue this chapter" : "Revisit this chapter"} <ArrowRight size={17} aria-hidden="true" />
    </Link>
    {started ? <p className={styles.chapterFacts}>
      {state.done} of {chapter.stepIds.length} lessons done{state.firstTry ? ` · ${state.firstTry.right} of ${state.firstTry.total} checkpoints right on the first try` : ""}
    </p> : null}
  </div>;
}

export function LessonRowStatus({ storageKey, stepId }: { storageKey: string; stepId: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => setDone(readProgress(storageKey).completed.includes(stepId)), [storageKey, stepId]);
  return done ? <span className={`${styles.rowMeta} ${styles.rowDone}`}><Check size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /> Done</span> : null;
}

// Each lab's code loads only on the page that shows it.
const labLoaders = {
  cache: dynamic(() => import("@/components/CacheLab").then((module) => module.CacheLab)),
  "rate-limiters": dynamic(() => import("@/components/labs/RateLimiterLab").then((module) => module.RateLimiterLab)),
  quorum: dynamic(() => import("@/components/labs/QuorumLab").then((module) => module.QuorumLab)),
  "retry-storm": dynamic(() => import("@/components/labs/RetryStormLab").then((module) => module.RetryStormLab)),
};

export function LabView({ id, standalone = true, headingLevel = 1 }: { id: keyof typeof labLoaders; standalone?: boolean; headingLevel?: 1 | 2 }) {
  const Lab = labLoaders[id];
  return <Lab standalone={standalone} headingLevel={headingLevel} />;
}
