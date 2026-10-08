"use client";

import { useEffect, useRef, useState } from "react";
import {
  challengeAnswerLimit,
  designChallenge,
  emptyChallengeDraft,
  formatChallengeDraft,
  hasChallengeAttempt,
  parseChallengeDraft,
  type ChallengeFieldId,
} from "@/content/design-challenge";
import styles from "./DesignChallenge.module.css";

export function DesignChallenge() {
  const [draft, setDraft] = useState(emptyChallengeDraft);
  const [ready, setReady] = useState(false);
  const [changed, setChanged] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasAttempt = hasChallengeAttempt(draft);
  const showReview = hasAttempt && draft.reviewed;
  const hasDraft = Object.values(draft.answers).some((answer) => answer.trim());

  useEffect(() => {
    try {
      setDraft(parseChallengeDraft(window.localStorage.getItem(designChallenge.storageKey)));
    } catch {
      setStorageAvailable(false);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !changed) return;
    try {
      window.localStorage.setItem(designChallenge.storageKey, JSON.stringify(draft));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [draft, ready, changed]);

  function updateAnswer(id: ChallengeFieldId, value: string) {
    setChanged(true);
    setDraft((current) => {
      const next = { ...current, answers: { ...current.answers, [id]: value.slice(0, challengeAnswerLimit) } };
      return hasChallengeAttempt(next) ? next : { ...next, reviewed: false };
    });
    setCopyStatus("");
  }

  function reviewDesign() {
    if (!hasAttempt) return;
    setChanged(true);
    setDraft((current) => ({ ...current, reviewed: true }));
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

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(formatChallengeDraft(draft));
      setCopyStatus("Your draft and self-review were copied.");
    } catch {
      setCopyStatus("Copy is unavailable in this browser. You can select and copy your responses directly.");
    }
  }

  return (
    <section className={styles.challenge} aria-labelledby="design-challenge-heading">
      <span className={styles.kicker}>CHAPTER CHALLENGE</span>
      <h2 id="design-challenge-heading">{designChallenge.title}</h2>
      <p className={styles.intro}>{designChallenge.summary}</p>
      <details className={styles.disclosure}>
        <summary>{ready && hasDraft ? "Continue your design" : "Try the design challenge"}<span>About 20–30 minutes · Optional</span></summary>
        <div className={styles.workspace}>
          <div className={styles.brief}>
            <h3>The brief</h3>
            <p>{designChallenge.brief}</p>
            <ul>{designChallenge.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
          </div>

          <p className={styles.storage} role="status">
            {!ready ? "Loading your draft…" : storageAvailable ? "Your writing stays on this device. Changes save automatically." : "Device storage is unavailable. Keep this page open or copy your draft before leaving."}
          </p>

          <div className={styles.responses}>
            {designChallenge.fields.map((field, index) => (
              <div key={field.id} className={styles.response}>
                <label htmlFor={`challenge-${field.id}`}><span>{index + 1}.</span> {field.title}</label>
                <p id={`challenge-${field.id}-prompt`}>{field.prompt}</p>
                {field.id === "adaptation" ? <p className={styles.change}><strong>The requirement changes</strong>{designChallenge.change}</p> : null}
                <textarea
                  id={`challenge-${field.id}`}
                  aria-describedby={`challenge-${field.id}-prompt challenge-${field.id}-limit`}
                  value={draft.answers[field.id]}
                  onChange={(event) => updateAnswer(field.id, event.target.value)}
                  placeholder={field.placeholder}
                  rows={6}
                  maxLength={challengeAnswerLimit}
                  disabled={!ready}
                />
                <span id={`challenge-${field.id}-limit`} className={styles.limit}>{draft.answers[field.id].length.toLocaleString("en-US")} / {challengeAnswerLimit.toLocaleString("en-US")} characters</span>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={reviewDesign} disabled={!hasAttempt || showReview} aria-describedby="challenge-review-hint">{showReview ? "Self-review is open" : "Compare your design"}</button>
            <button type="button" className={styles.secondaryButton} onClick={copyDraft} disabled={!hasDraft}>Copy my draft</button>
          </div>
          <p id="challenge-review-hint" className={styles.hint}>{showReview ? "Refine your responses as you compare. These examples are alternatives, not a single correct answer." : "Write an initial response in each section to unlock the rubric and worked designs. Your writing is not automatically graded."}</p>
          <p className={styles.copyStatus} role="status">{copyStatus}</p>

          {showReview ? (
            <div className={styles.review}>
              <h3 ref={reviewHeadingRef} tabIndex={-1}>Review your reasoning</h3>
              <p>Check the statements your design supports. An unchecked item is a useful place to revise; this checklist does not certify mastery.</p>
              <fieldset className={styles.rubric}>
                <legend>Your self-check</legend>
                {designChallenge.rubric.map((item) => (
                  <label key={item.id}>
                    <input type="checkbox" checked={draft.checked.includes(item.id)} onChange={() => toggleCheck(item.id)} />
                    <span><strong>{item.title}</strong><span>{item.detail}</span></span>
                  </label>
                ))}
              </fieldset>
              <div className={styles.estimates}><h4>Check the scale</h4><p>{designChallenge.estimateGuide}</p></div>
              <h4 className={styles.solutionsHeading}>Two defensible approaches</h4>
              <p>Both need load testing and tested recovery. Compare why you would choose one and when you would change it.</p>
              {designChallenge.solutions.map((solution) => (
                <details key={solution.id} className={styles.solution}>
                  <summary>{solution.title}</summary>
                  <div>
                    <p>{solution.approach}</p>
                    <h5>Request paths</h5>
                    <ol>{solution.paths.map((path) => <li key={path}>{path}</li>)}</ol>
                    <h5>Failure and scaling</h5><p>{solution.failure}</p>
                    <h5>International traffic</h5><p>{solution.adaptation}</p>
                    <h5>The tradeoff</h5><p>{solution.tradeoff}</p>
                  </div>
                </details>
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
