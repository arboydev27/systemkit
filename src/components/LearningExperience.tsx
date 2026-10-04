"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Layers3,
  Menu,
  RotateCcw,
  X,
} from "lucide-react";
import { steps, questions } from "@/content/chapter";
import { ArchitectureDiagram } from "./ArchitectureDiagram";

const LessonDiagram = memo(ArchitectureDiagram);

const STORAGE_KEY = "systemkit:chapter-one:v1";

type Progress = {
  completed: string[];
  answers: Record<string, number>;
  scenarioDrafts: Record<string, string>;
  revealedScenarios: string[];
  activeStepId?: string;
};

const emptyProgress: Progress = { completed: [], answers: {}, scenarioDrafts: {}, revealedScenarios: [] };

function readProgress(): Progress {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyProgress;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return emptyProgress;
    const value = parsed as Partial<Progress>;
    return {
      completed: Array.isArray(value.completed)
        ? value.completed.filter((id): id is string => typeof id === "string")
        : [],
      answers:
        value.answers && typeof value.answers === "object" && !Array.isArray(value.answers)
          ? Object.fromEntries(
              Object.entries(value.answers).filter(
                (entry): entry is [string, number] =>
                  typeof entry[1] === "number" && Number.isInteger(entry[1]),
              ),
            )
          : {},
      scenarioDrafts:
        value.scenarioDrafts && typeof value.scenarioDrafts === "object" && !Array.isArray(value.scenarioDrafts)
          ? Object.fromEntries(
              Object.entries(value.scenarioDrafts).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            )
          : {},
      revealedScenarios: Array.isArray(value.revealedScenarios)
        ? value.revealedScenarios.filter((id): id is string => typeof id === "string")
        : [],
      activeStepId: typeof value.activeStepId === "string" ? value.activeStepId : undefined,
    };
  } catch {
    return emptyProgress;
  }
}

function padded(index: number) {
  return String(index + 1).padStart(2, "0");
}

export function LearningExperience() {
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [activeStepId, setActiveStepId] = useState(steps[0]?.id ?? "");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = readProgress();
    setProgress(saved);
    if (saved.activeStepId && steps.some((step) => step.id === saved.activeStepId)) {
      setActiveStepId(saved.activeStepId);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...progress, activeStepId }));
    } catch {
      // The lesson stays usable in browsers that block local storage.
    }
  }, [progress, activeStepId, ready]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStepId));
  const step = steps[activeIndex];
  const stepQuestions = useMemo(
    () => questions.filter((question) => question.stepId === step?.id),
    [step?.id],
  );
  const question = stepQuestions[Math.min(questionIndex, stepQuestions.length - 1)];
  const selectedAnswer = question ? progress.answers[question.id] : undefined;
  const answered = selectedAnswer !== undefined;
  const correct = question ? selectedAnswer === question.correctIndex : false;
  const completedCount = steps.filter((item) => progress.completed.includes(item.id)).length;
  const completionPercentage = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;
  const isComplete = step ? progress.completed.includes(step.id) : false;
  const correctCount = stepQuestions.filter(
    (item) => progress.answers[item.id] === item.correctIndex,
  ).length;
  const canComplete = stepQuestions.length > 0 && correctCount === stepQuestions.length;
  const scenarioDraft = step ? progress.scenarioDrafts[step.id] ?? "" : "";
  const scenarioRevealed = step ? progress.revealedScenarios.includes(step.id) : false;

  function selectStep(id: string) {
    setActiveStepId(id);
    setQuestionIndex(0);
    setMenuOpen(false);
    window.requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });
  }

  function selectQuestion(index: number) {
    setQuestionIndex(index);
    window.requestAnimationFrame(() => questionHeadingRef.current?.focus());
  }

  function answer(index: number) {
    if (!question || answered) return;
    setProgress((current) => ({
      ...current,
      answers: { ...current.answers, [question.id]: index },
    }));
  }

  function toggleCompletion() {
    if (!step) return;
    setProgress((current) => ({
      ...current,
      completed: current.completed.includes(step.id)
        ? current.completed.filter((id) => id !== step.id)
        : [...current.completed, step.id],
    }));
  }

  function updateScenarioDraft(value: string) {
    if (!step) return;
    setProgress((current) => ({
      ...current,
      scenarioDrafts: { ...current.scenarioDrafts, [step.id]: value },
      revealedScenarios: value.trim()
        ? current.revealedScenarios
        : current.revealedScenarios.filter((id) => id !== step.id),
    }));
  }

  function toggleScenarioGuidance() {
    if (!step || !scenarioDraft.trim()) return;
    setProgress((current) => ({
      ...current,
      revealedScenarios: current.revealedScenarios.includes(step.id)
        ? current.revealedScenarios.filter((id) => id !== step.id)
        : [...current.revealedScenarios, step.id],
    }));
  }

  if (!step) return <main className="empty-chapter">Chapter content is coming soon.</main>;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#lesson-content">Skip to lesson</a>

      <header className="topbar">
        <div className="topbar-brand">
          <button
            className="icon-button menu-button"
            type="button"
            aria-label={menuOpen ? "Close chapter navigation" : "Open chapter navigation"}
            aria-expanded={menuOpen}
            aria-controls="chapter-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <span className="brand-mark" aria-hidden="true"><Layers3 size={19} strokeWidth={2.2} /></span>
          <span className="brand-word">SystemKit</span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-context">Learning library</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-chapter">Chapter 01 <span aria-hidden="true">/</span> Scale to a Million Users</span>
          <span className="topbar-progress">{ready ? completionPercentage : 0}% complete</span>
        </div>
      </header>

      {menuOpen ? <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}

      <aside id="chapter-sidebar" className={`sidebar ${menuOpen ? "sidebar-open" : ""}`} aria-label="Chapter navigation">
        <div className="sidebar-inner">
          <div className="sidebar-head">
            <span className="section-label">LEARNING PATH</span>
            <div className="sidebar-title"><BookOpen size={18} /> <span>From zero to scale</span></div>
            <p>Build the architecture one decision at a time.</p>
          </div>

          <div className="progress-block" aria-label={`${completedCount} of ${steps.length} lessons complete`}>
            <div className="progress-label"><span>Chapter progress</span><strong>{completedCount} / {steps.length}</strong></div>
            <div className="progress-track"><span style={{ width: `${completionPercentage}%` }} /></div>
          </div>

          <nav className="step-navigation" aria-label="Lessons">
            <span className="nav-overline">THE ARCHITECTURE</span>
            <ol>
              {steps.map((item, index) => {
                const active = item.id === step.id;
                const complete = progress.completed.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`step-link ${active ? "is-active" : ""}`}
                      aria-current={active ? "step" : undefined}
                      onClick={() => selectStep(item.id)}
                    >
                      <span className="step-index" aria-hidden="true">{complete ? <Check size={14} strokeWidth={2.5} /> : padded(index)}</span>
                      <span className="step-link-title">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="sidebar-foot">
            <span className="sidebar-foot-icon"><Circle size={9} fill="currentColor" /></span>
            <span>Progress is saved on this device</span>
          </div>
        </div>
      </aside>

      <main id="lesson-content" className="main-content" tabIndex={-1}>
        <div className="main-wrap">
          <div className="breadcrumb"><span>LEARN</span><span aria-hidden="true">/</span><span>SCALE TO A MILLION USERS</span><span aria-hidden="true">/</span><strong>{padded(activeIndex)}</strong></div>

          <div className="lesson-heading">
            <div className="lesson-heading-main">
              <span className="eyebrow"><span className="eyebrow-line" /> LESSON {padded(activeIndex)} <span className="eyebrow-dot">·</span> {step.eyebrow.replace(/^\d+\s*·\s*/, "")}</span>
              <h1 ref={headingRef} tabIndex={-1}>{step.title}</h1>
              <p className="lesson-summary">{step.summary}</p>
            </div>
            <div className="lesson-number" aria-hidden="true">{padded(activeIndex)}</div>
          </div>

          <section className="diagram-section" aria-labelledby="diagram-heading">
            <div className="section-heading-row">
              <div>
                <span className="section-kicker">SYSTEM VIEW</span>
                <h2 id="diagram-heading">The architecture</h2>
              </div>
              <span className="diagram-caption"><span className="caption-pulse" /> Explore the flow</span>
            </div>
            <div className="diagram-stage">
              <LessonDiagram id={step.diagramId} />
            </div>
            <div className="diagram-footnote"><span className="diagram-footnote-icon">↗</span> Follow each connection from the user to the data layer.</div>
          </section>

          <div className="content-grid">
            <article className="lesson-article" aria-labelledby="concept-heading">
              <span className="section-kicker">THE IDEA</span>
              <h2 id="concept-heading">How it works</h2>
              <div className="body-copy">
                {step.body.map((paragraph, index) => <p key={`${step.id}-body-${index}`}>{paragraph}</p>)}
              </div>
              {step.scenario ? (
                <div className="scenario-card">
                  <div className="scenario-label"><span className="scenario-spark" aria-hidden="true">✳</span> DECISION POINT</div>
                  <p>{step.scenario}</p>
                  {step.scenarioAnswer ? (
                    <div className="scenario-reflection">
                      <label htmlFor={`scenario-draft-${step.id}`}>Your reasoning</label>
                      <textarea
                        id={`scenario-draft-${step.id}`}
                        value={scenarioDraft}
                        onChange={(event) => updateScenarioDraft(event.target.value)}
                        rows={4}
                        maxLength={1200}
                        placeholder="What would you do, and why?"
                      />
                      <div className="scenario-controls">
                        <span>Your notes stay on this device.</span>
                        <button
                          type="button"
                          className="scenario-reveal"
                          onClick={toggleScenarioGuidance}
                          disabled={!scenarioDraft.trim()}
                          aria-expanded={scenarioRevealed}
                          aria-controls={`scenario-guidance-${step.id}`}
                        >
                          {scenarioRevealed ? "Hide guidance" : "Reveal guidance"}
                          <ChevronDown size={15} aria-hidden="true" />
                        </button>
                      </div>
                      <div
                        id={`scenario-guidance-${step.id}`}
                        className="scenario-guidance"
                        role="region"
                        aria-label="Self-check guidance"
                        aria-live="polite"
                        hidden={!scenarioRevealed}
                      >
                        <strong>Compare your reasoning</strong>
                        <p>{step.scenarioAnswer}</p>
                        <span>Use this as a guide for self review; written answers are not graded.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="takeaways">
                <h3>Keep in mind</h3>
                <ul>{step.takeaways.map((takeaway, index) => <li key={`${step.id}-takeaway-${index}`}><Check size={15} strokeWidth={2.3} aria-hidden="true" /><span>{takeaway}</span></li>)}</ul>
              </div>
            </article>

            <aside className="lesson-side" aria-label="Lesson details">
              <div className="chapter-card">
                <span className="chapter-card-label">IN THIS LESSON</span>
                <div className="chapter-card-index">{padded(activeIndex)} <span>/ {String(steps.length).padStart(2, "0")}</span></div>
                <p>{step.summary}</p>
                <div className="chapter-card-separator" />
                <span className="chapter-card-bottom">{stepQuestions.length} {stepQuestions.length === 1 ? "checkpoint" : "checkpoints"} <ChevronDown size={14} /></span>
              </div>
            </aside>
          </div>

          <section className="quiz-section" aria-labelledby="quiz-heading">
            <div className="quiz-intro">
              <div><span className="section-kicker">CHECK YOUR UNDERSTANDING</span><h2 id="quiz-heading">Put it into practice.</h2></div>
              <span className="quiz-count">{stepQuestions.length > 0 ? `${Math.min(questionIndex + 1, stepQuestions.length)} OF ${stepQuestions.length}` : "NO QUESTIONS"}</span>
            </div>
            {question ? (
              <div className="quiz-card" key={question.id}>
                <div className="question-meta"><span className="difficulty-tag">{question.difficulty}</span><span>QUESTION {padded(questionIndex)}</span></div>
                <h3 ref={questionHeadingRef} tabIndex={-1}>{question.prompt}</h3>
                <div className="option-list" role="group" aria-label="Answer choices">
                  {question.options.map((option, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrectAnswer = answered && index === question.correctIndex;
                    return (
                      <button
                        type="button"
                        className={`option ${isSelected ? "is-selected" : ""} ${isCorrectAnswer ? "is-correct" : ""} ${isSelected && !correct ? "is-incorrect" : ""}`}
                        key={`${question.id}-option-${index}`}
                        ref={index === 0 ? firstOptionRef : undefined}
                        onClick={() => answer(index)}
                        disabled={answered}
                        aria-pressed={isSelected}
                      >
                        <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                        <span>{option}</span>
                        {isCorrectAnswer ? <CheckCircle2 className="option-result" size={18} aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
                {answered ? (
                  <div className={`answer-feedback ${correct ? "feedback-correct" : "feedback-incorrect"}`} role="status" aria-live="polite">
                    <strong>{correct ? "Exactly right." : "Not quite. Here’s why."}</strong>
                    <p>{question.explanation}</p>
                    {!correct ? <button className="text-button" type="button" onClick={() => {
                      setProgress((current) => {
                        const answers = { ...current.answers };
                        delete answers[question.id];
                        return { ...current, answers };
                      });
                      window.requestAnimationFrame(() => firstOptionRef.current?.focus());
                    }}>Try again <RotateCcw size={15} /></button> : null}
                    {questionIndex + 1 < stepQuestions.length ? <button className="text-button next-question" type="button" onClick={() => selectQuestion(questionIndex + 1)}>Next question <ArrowRight size={16} /></button> : null}
                  </div>
                ) : <p className="quiz-hint">Choose an answer to see the explanation.</p>}
                {questionIndex > 0 ? <button className="previous-question" type="button" onClick={() => selectQuestion(questionIndex - 1)}><ArrowLeft size={14} /> Previous question</button> : null}
              </div>
            ) : <div className="quiz-empty">A checkpoint for this lesson is being prepared.</div>}
          </section>

          <div className="lesson-actions">
            <button className={`completion-button ${isComplete ? "completed" : ""}`} type="button" onClick={toggleCompletion} disabled={!isComplete && !canComplete} aria-describedby="completion-hint">
              {isComplete ? <RotateCcw size={17} /> : <Check size={17} />}
              {isComplete ? "Mark as incomplete" : "Mark lesson complete"}
            </button>
            {activeIndex + 1 < steps.length ? <button className="next-button" type="button" onClick={() => selectStep(steps[activeIndex + 1].id)}>Next lesson <ArrowRight size={17} /></button> : null}
          </div>
          <p id="completion-hint" className="completion-hint">
            {isComplete ? "Lesson complete. You can revisit any checkpoint." : `${correctCount} of ${stepQuestions.length} checkpoints answered correctly to complete this lesson.`}
          </p>

          <footer className="site-footer"><span>SystemKit</span><span>Learn the decisions behind the diagram.</span></footer>
        </div>
      </main>
    </div>
  );
}
