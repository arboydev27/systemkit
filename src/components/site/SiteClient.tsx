"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Check } from "lucide-react";
import { lessonHref } from "@/lib/links";
import { completedCount, readProgress, resumeStepInChapter, type OutlineChapter } from "@/lib/progress";
import { browserReviewStorage, countDue, readReviewState } from "@/lib/review";
import styles from "./Site.module.css";

export function DueReviewBadge() {
  const [due, setDue] = useState(0);
  useEffect(() => setDue(countDue(readReviewState(browserReviewStorage()), Date.now())), []);
  return due > 0 ? <span className={styles.due}>{due}<span className="sr-only"> due</span></span> : null;
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

/** The lab on the home page. Its title can't give the answer away, because this is where a new visitor first gets asked for one. */
export function HomeLab({ className }: { className?: string }) {
  const Lab = labLoaders["retry-storm"];
  return <Lab standalone={false} headingLevel={3} title="The outage is over. Now what?" className={className} />;
}
