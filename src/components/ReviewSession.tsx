"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Layers3, RotateCcw } from "lucide-react";
import { chapters } from "@/content/chapters";
import { reviewCards } from "@/content/review";
import {
  browserReviewStorage, buildReviewSession, DAY, emptyReviewState, importLegacyStudy,
  lessonKey, markStudied, readReviewState, recordRecall, saveReviewState, type ReviewState,
} from "@/lib/review";
import styles from "./ReviewSession.module.css";

type Session = ReturnType<typeof buildReviewSession>;

export function ReviewSession() {
  const [state, setState] = useState<ReviewState>(emptyReviewState);
  const [session, setSession] = useState<Session>([]);
  const [ready, setReady] = useState(false);
  const [canSave, setCanSave] = useState(true);
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState("");
  const [revisit, setRevisit] = useState<Session>([]);
  const [pickerChapter, setPickerChapter] = useState(chapters[0].id);
  const [pickerStep, setPickerStep] = useState(chapters[0].steps[0].id);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const storage = browserReviewStorage();
    const saved = importLegacyStudy(readReviewState(storage), storage, chapters, Date.now());
    setState(saved);
    setSession(buildReviewSession(reviewCards, saved, Date.now()));
    setCanSave(saveReviewState(storage, saved));
    setReady(true);
  }, []);

  function focusHeading() {
    window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  }

  function start(cards: Session) {
    setSession(cards);
    setIndex(0);
    setRevealed(false);
    setDraft("");
    setRevisit([]);
    setPhase("running");
    focusHeading();
  }

  function rate(recalled: boolean) {
    const item = session[index];
    if (!item || !revealed) return;
    const next = recordRecall(state, item.card.id, recalled, Date.now());
    setState(next);
    setCanSave(saveReviewState(browserReviewStorage(), next));
    if (!recalled) setRevisit((current) => [...current, item]);
    setRevealed(false);
    setDraft("");
    if (index + 1 === session.length) setPhase("done");
    else setIndex((current) => current + 1);
    focusHeading();
  }

  function reviewChosenLesson() {
    const next = markStudied(state, pickerChapter, pickerStep, Date.now() - DAY);
    setState(next);
    setCanSave(saveReviewState(browserReviewStorage(), next));
    const chosen = reviewCards.filter((card) => card.id === lessonKey(pickerChapter, pickerStep));
    start(buildReviewSession(chosen, next, Date.now(), true));
  }

  const eligible = reviewCards.filter((card) => state.studied[card.id] !== undefined);
  const nextDue = eligible.length ? Math.min(...eligible.map((card) =>
    state.recalls[card.id]?.dueAt ?? state.studied[card.id] + DAY)) : undefined;
  const item = session[index];
  const chosenChapter = chapters.find((chapter) => chapter.id === pickerChapter) ?? chapters[0];

  return (
    <div className={styles.page}>
      <a className="skip-link" href="#review-content">Skip to review</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="SystemKit learning library">
          <span><Layers3 size={19} aria-hidden="true" /></span>SystemKit
        </Link>
        <Link href="/" className={styles.back}><ArrowLeft size={15} aria-hidden="true" /> Learning library</Link>
      </header>
      <main id="review-content" className={styles.main}>
        <div className={styles.eyebrow}>A LITTLE PRACTICE, OVER TIME</div>
        <h1>Five minutes.<br />Keep the ideas close.</h1>
        <p className={styles.lede}>Recall decisions from lessons you’ve studied. A short review helps you find what needs another look.</p>
        {ready && !canSave ? <p className={styles.notice} role="status">This browser can’t save review progress. You can still review here; your schedule will last for this visit.</p> : null}

        {!ready ? <div className={styles.card} role="status">Preparing your review…</div> : phase === "running" && item ? (
          <section className={styles.card} aria-labelledby="review-heading">
            <div className={styles.cardMeta}><span>{item.card.chapterTitle}</span><span>{index + 1} / {session.length}</span></div>
            <div className={styles.track} role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={session.length} aria-valuenow={index}>
              <span style={{ width: `${index / session.length * 100}%` }} />
            </div>
            <span className={styles.lesson}>{item.card.lessonTitle}</span>
            <h2 ref={headingRef} id="review-heading" tabIndex={-1}>{item.prompt.prompt}</h2>
            <label className={styles.draftLabel} htmlFor="review-draft">Your recall <span>Optional; answer in your head or jot down a few words.</span></label>
            <textarea id="review-draft" className={styles.draft} value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} maxLength={1200} placeholder="How would you explain it?" />
            <button className={styles.primary} type="button" onClick={() => setRevealed((current) => !current)} aria-expanded={revealed} aria-controls="review-answer">{revealed ? "Hide guidance" : "Compare your reasoning"} <ChevronDown size={16} aria-hidden="true" /></button>
            <div id="review-answer" className={styles.answer} role="region" aria-label="Review guidance" aria-live="polite" hidden={!revealed}><strong>Look for these ideas</strong><p>{item.prompt.answer}</p><Link href={`/learn/${item.card.chapterId}/${item.card.stepId}/`}>Revisit the lesson <ArrowRight size={14} aria-hidden="true" /></Link></div>
            {revealed ? (
              <>
                <p className={styles.selfCheck}>How did your explanation compare? This is your self-check, not a score.</p>
                <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => rate(false)}><RotateCcw size={16} aria-hidden="true" /> Needs another look</button><button className={styles.primary} type="button" onClick={() => rate(true)}><Check size={16} aria-hidden="true" /> Recalled the key ideas</button></div>
              </>
            ) : null}
          </section>
        ) : phase === "done" ? (
          <section className={styles.card} aria-labelledby="review-heading">
            <span className={styles.lesson}>REVIEW FINISHED</span>
            <h2 ref={headingRef} id="review-heading" tabIndex={-1}>A good place to pause.</h2>
            <p>You reviewed {session.length} {session.length === 1 ? "idea" : "ideas"}. Ideas that need another look return tomorrow; recalled ideas get more time before the next review.</p>
            {revisit.length ? <div className={styles.revisit}><h3>Worth another look</h3><ul>{revisit.map(({ card }) => <li key={card.id}><Link href={`/learn/${card.chapterId}/${card.stepId}/`}>{card.lessonTitle}<ArrowRight size={15} aria-hidden="true" /></Link></li>)}</ul></div> : null}
            <Link href="/" className={styles.primary}>Continue learning <ArrowRight size={16} aria-hidden="true" /></Link>
            <p className={styles.footnote}>Review reflects your self-checks. It doesn’t certify understanding.</p>
          </section>
        ) : (
          <section className={styles.card} aria-labelledby="review-heading">
            <span className={styles.lesson}>{session.length ? "READY WHEN YOU ARE" : "YOUR REVIEW SPACE"}</span>
            <h2 ref={headingRef} id="review-heading" tabIndex={-1}>{session.length ? `${session.length} ${session.length === 1 ? "idea" : "ideas"} to come back to.` : eligible.length ? "Nothing due right now." : "Start with a lesson."}</h2>
            <p>{session.length ? "Try to explain each idea before revealing the guidance. Earlier mistakes get a place near the front, and the prompts change across reviews." : eligible.length ? `Your next review is ${nextDue ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(nextDue) : "coming up"}. You can practise now if you prefer.` : "Answer a checkpoint or write a Decision Point reflection in any lesson. It will become available here, with your first review scheduled for the next day."}</p>
            {session.length ? <button className={styles.primary} type="button" onClick={() => start(session)}>Start review <ArrowRight size={16} aria-hidden="true" /></button> : eligible.length ? <button className={styles.primary} type="button" onClick={() => start(buildReviewSession(reviewCards, state, Date.now(), true))}>Practise studied ideas <ArrowRight size={16} aria-hidden="true" /></button> : <Link href="/" className={styles.primary}>Explore the lessons <ArrowRight size={16} aria-hidden="true" /></Link>}
            <p className={styles.footnote}>Up to five ideas. No timer, no streak to protect. Progress stays on this device.</p>
            <details className={styles.manual}><summary>Choose a lesson I’ve already studied</summary><p>If you read without answering a checkpoint, you can add that lesson to review yourself.</p><label htmlFor="review-chapter">Chapter</label><select id="review-chapter" value={pickerChapter} onChange={(event) => { const chapter = chapters.find((entry) => entry.id === event.target.value); if (chapter) { setPickerChapter(chapter.id); setPickerStep(chapter.steps[0].id); } }}>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select><label htmlFor="review-lesson">Lesson</label><select id="review-lesson" value={pickerStep} onChange={(event) => setPickerStep(event.target.value)}>{chosenChapter.steps.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}</select><button className={styles.secondary} type="button" onClick={reviewChosenLesson}>Review this lesson <ArrowRight size={15} aria-hidden="true" /></button></details>
          </section>
        )}
        <footer className={styles.footer}>Learn the decisions behind the diagram.</footer>
      </main>
    </div>
  );
}
