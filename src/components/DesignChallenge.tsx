"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, RotateCcw } from "lucide-react";
import {
  challengeAnswerLimit,
  challengeStorageKey,
  critiquePrompt,
  emptyChallengeDraft,
  formatChallengeDraft,
  hasChallengeAttempt,
  interviewerPrompt,
  parseChallengeDraft,
  type ChallengeFieldId,
  type DesignChallengeContent,
} from "@/content/design-challenge";
import { requestDurableStorage } from "@/lib/progress";
import { trackEvent, trackOnce } from "@/lib/analytics";
import styles from "./DesignChallenge.module.css";

// In a timed attempt the requirement change arrives here, as it would partway through an interview.
const CHANGE_AT = 0.6;

function clock(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function DesignChallenge({ challenge, headingLevel = 2 }: { challenge: DesignChallengeContent; headingLevel?: 1 | 2 }) {
  const storageKey = challengeStorageKey(challenge.id);
  const [draft, setDraft] = useState(emptyChallengeDraft);
  const [ready, setReady] = useState(false);
  const [changed, setChanged] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const [now, setNow] = useState(0);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasAttempt = hasChallengeAttempt(draft, challenge);
  const showReview = hasAttempt && draft.reviewed;
  const hasDraft = Object.values(draft.answers).some((answer) => answer.trim());
  const Heading = headingLevel === 1 ? "h1" : "h2";

  useEffect(() => {
    try {
      setDraft(parseChallengeDraft(window.localStorage.getItem(storageKey), challenge));
    } catch {
      setStorageAvailable(false);
    }
    setReady(true);
    setNow(Date.now());
  }, [challenge, storageKey]);

  useEffect(() => {
    if (!ready || !changed) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
      setStorageAvailable(true);
      requestDurableStorage();
    } catch {
      setStorageAvailable(false);
    }
  }, [draft, ready, changed, storageKey]);

  const timer = draft.timer;
  const duration = timer ? timer.minutes * 60_000 : 0;
  const elapsed = timer ? now - timer.startedAt : 0;
  const timeUp = Boolean(timer) && elapsed >= duration;
  const timerRunning = Boolean(timer) && !timeUp;
  const changeVisible = !timer || elapsed >= duration * CHANGE_AT;

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  function updateAnswer(id: ChallengeFieldId, value: string) {
    setChanged(true);
    setDraft((current) => {
      const next = { ...current, answers: { ...current.answers, [id]: value.slice(0, challengeAnswerLimit) } };
      return hasChallengeAttempt(next, challenge) ? next : { ...next, reviewed: false };
    });
    setCopyStatus("");
    trackOnce(`challenge_started_${challenge.id}`);
  }

  function reviewDesign() {
    if (!hasAttempt) return;
    setChanged(true);
    setDraft((current) => ({ ...current, reviewed: true }));
    trackEvent("challenge_reviewed");
    window.requestAnimationFrame(() => reviewHeadingRef.current?.focus());
  }

  function toggleCheck(id: string) {
    setChanged(true);
    setCopyStatus("");
    setDraft((current) => ({
      ...current,
      checked: current.checked.includes(id) ? current.checked.filter((item) => item !== id) : [...current.checked, id],
    }));
  }

  function startTimer() {
    const startedAt = Date.now();
    setChanged(true);
    setNow(startedAt);
    setDraft((current) => ({ ...current, timer: { startedAt, minutes: challenge.minutes } }));
    trackEvent("challenge_timed");
  }

  function stopTimer() {
    setChanged(true);
    setDraft((current) => {
      const next = { ...current };
      delete next.timer;
      return next;
    });
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(done);
    } catch {
      setCopyStatus("Copy is unavailable in this browser. You can select and copy your responses directly.");
    }
  }

  return (
    <section className={styles.challenge} aria-labelledby={`design-challenge-${challenge.id}`}>
      <Heading id={`design-challenge-${challenge.id}`} className={styles.title}>{challenge.title}</Heading>
      <p className={styles.intro}>{challenge.summary}</p>

      <div className={styles.workspace}>
        <div className={styles.brief}>
          <h3>The brief</h3>
          <p>{challenge.brief}</p>
          <ul>{challenge.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        </div>

        <div className={styles.timer} role="group" aria-label="Timed attempt">
          {timer ? (
            <>
              <strong className={timeUp ? styles.timeUp : undefined} role="timer">
                <Clock3 size={15} aria-hidden="true" /> {timeUp ? "Time’s up" : `${clock(duration - elapsed)} left`}
              </strong>
              <p>{timeUp ? "Finish your thought, then compare your design below." : changeVisible ? "The requirement has changed. Work it into your design." : "Try saying your reasoning out loud as you write. A requirement will change partway through."}</p>
              <button type="button" className={styles.textAction} onClick={stopTimer}><RotateCcw size={13} aria-hidden="true" /> {timeUp ? "Clear the timer" : "Stop the timer"}</button>
            </>
          ) : (
            <>
              <p>Reading a design isn’t the same as producing one under a clock. Try it timed: the requirement change stays hidden until partway through.</p>
              <button type="button" className={styles.secondaryButton} onClick={startTimer} disabled={!ready}><Clock3 size={14} aria-hidden="true" /> Start a {challenge.minutes}-minute attempt</button>
            </>
          )}
        </div>

        <p className={styles.storage} role="status">
          {!ready ? "Loading your draft…" : storageAvailable ? "Your writing stays on this device. Changes save automatically." : "Device storage is unavailable. Keep this page open or copy your draft before leaving."}
        </p>

        <div className={styles.responses}>
          {challenge.fields.map((field, index) => (
            <div key={field.id} className={styles.response}>
              <label htmlFor={`challenge-${challenge.id}-${field.id}`}><span>{index + 1}.</span> {field.title}</label>
              <p id={`challenge-${challenge.id}-${field.id}-prompt`}>{field.prompt}</p>
              {field.id === "adaptation" ? (changeVisible
                ? <p className={styles.change}><strong>The requirement changes</strong>{challenge.change}</p>
                : <p className={styles.change}><strong>The requirement changes partway through</strong>It appears here when {clock(duration * (1 - CHANGE_AT))} remain.</p>) : null}
              <textarea
                id={`challenge-${challenge.id}-${field.id}`}
                aria-describedby={`challenge-${challenge.id}-${field.id}-prompt challenge-${challenge.id}-${field.id}-limit`}
                value={draft.answers[field.id]}
                onChange={(event) => updateAnswer(field.id, event.target.value)}
                placeholder={field.placeholder}
                rows={6}
                maxLength={challengeAnswerLimit}
                disabled={!ready}
              />
              <span id={`challenge-${challenge.id}-${field.id}-limit`} className={styles.limit}>{draft.answers[field.id].length.toLocaleString("en-US")} / {challengeAnswerLimit.toLocaleString("en-US")} characters</span>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={reviewDesign} disabled={!hasAttempt || showReview} aria-describedby={`challenge-${challenge.id}-review-hint`}>{showReview ? "Self-review is open" : "Compare my design"}</button>
          <button type="button" className={styles.secondaryButton} onClick={() => copy(formatChallengeDraft(draft, challenge), "Your draft and self-review were copied.")} disabled={!hasDraft}>Copy my draft</button>
        </div>
        <p id={`challenge-${challenge.id}-review-hint`} className={styles.hint}>{showReview ? "Refine your responses as you compare. These examples are alternatives, not a single correct answer." : "Write an initial response in all four sections to unlock the checklist and two worked approaches."}</p>

        <div className={styles.feedback}>
          <h3>Get critiqued, or get interviewed</h3>
          <p>SystemKit doesn’t read your answers: they stay in this browser. To get feedback from an AI, copy one of these prompts into a chatbot you already use. Treat what it says as a second opinion, and check anything that sounds too confident.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={!hasAttempt} onClick={() => { void copy(critiquePrompt(draft, challenge), "Critique prompt copied. Paste it into your chatbot."); trackEvent("prompt_copied_critique"); }}>Copy critique prompt</button>
            <button type="button" className={styles.secondaryButton} onClick={() => { void copy(interviewerPrompt(challenge), "Interviewer prompt copied. Paste it into your chatbot, and answer out loud if you can."); trackEvent("prompt_copied_interviewer"); }}>Copy interviewer prompt</button>
          </div>
          <p className={styles.copyStatus} role="status">{copyStatus}</p>
        </div>

        {showReview ? (
          <div className={styles.review}>
            <h3 ref={reviewHeadingRef} tabIndex={-1}>Review your reasoning</h3>
            <p>Check the statements your design supports. An unchecked item is a useful place to revise; this checklist does not certify mastery.</p>
            <fieldset className={styles.rubric}>
              <legend>Your self-check</legend>
              {challenge.rubric.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={draft.checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
                  <span><strong>{item.title}</strong><span>{item.detail}</span></span>
                </label>
              ))}
            </fieldset>
            <div className={styles.estimates}><h4>Check the scale</h4><p>{challenge.estimateGuide}</p></div>
            <h4 className={styles.solutionsHeading}>Two defensible approaches</h4>
            <p>Both would need load testing and tested recovery. Compare why you would choose one and when you would change it.</p>
            {challenge.solutions.map((solution) => (
              <details key={solution.id} className={styles.solution}>
                <summary>{solution.title}</summary>
                <div>
                  <p>{solution.approach}</p>
                  <h5>Request paths</h5>
                  <ol>{solution.paths.map((path) => <li key={path}>{path}</li>)}</ol>
                  <h5>Failure and scaling</h5><p>{solution.failure}</p>
                  <h5>{challenge.adaptationTitle}</h5><p>{solution.adaptation}</p>
                  <h5>The tradeoff</h5><p>{solution.tradeoff}</p>
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
