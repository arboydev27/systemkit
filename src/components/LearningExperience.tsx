"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  Layers3,
  Menu,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { chapterHref, lessonHref } from "@/lib/links";
import { LessonSearch } from "./LessonSearch";
import { CopyLessonLink } from "./CopyLessonLink";
import { DiagramView } from "./DiagramView";
import { InlineText } from "./InlineText";
import { optionOrder } from "@/lib/quiz";
import { browserReviewStorage, countDue, readReviewState, recordStoredLessonStudy, recordStoredQuizAttempt } from "@/lib/review";
import {
  completedCount,
  emptyProgress,
  MIN_REASONING_LENGTH,
  parseProgress,
  readProgress,
  rememberActiveChapter,
  requestDurableStorage,
  resumeStepInChapter,
  updateStoredProgress,
  type OutlineChapter,
  type Progress,
} from "@/lib/progress";
import { trackEvent, trackOnce } from "@/lib/analytics";
import type { Chapter } from "@/content/chapters";
import type { Question, Step } from "@/content/chapter";
import type { DesignChallengeContent } from "@/content/design-challenge";

// Each lesson loads only its own chapter's drawing code.
const diagrams: Record<string, ComponentType<{ id: string }>> = {
  framework: dynamic(() => import("./FrameworkDiagram").then((module) => module.FrameworkDiagram)),
  scaling: dynamic(() => import("./ArchitectureDiagram").then((module) => module.ArchitectureDiagram)),
  estimation: dynamic(() => import("./EstimationDiagram").then((module) => module.EstimationDiagram)),
  url: dynamic(() => import("./UrlShortenerDiagram").then((module) => module.UrlShortenerDiagram)),
  chat: dynamic(() => import("./ChatDiagram").then((module) => module.ChatDiagram)),
  youtube: dynamic(() => import("./YouTubeDiagram").then((module) => module.YouTubeDiagram)),
  notification: dynamic(() => import("./NotificationDiagram").then((module) => module.NotificationDiagram)),
  "rate-limiter": dynamic(() => import("./RateLimiterDiagram").then((module) => module.RateLimiterDiagram)),
  "news-feed": dynamic(() => import("./NewsFeedDiagram").then((module) => module.NewsFeedDiagram)),
  autocomplete: dynamic(() => import("./AutocompleteDiagram").then((module) => module.AutocompleteDiagram)),
  "key-value": dynamic(() => import("./KeyValueDiagram").then((module) => module.KeyValueDiagram)),
  "google-drive": dynamic(() => import("./GoogleDriveDiagram").then((module) => module.GoogleDriveDiagram)),
  "web-crawler": dynamic(() => import("./WebCrawlerDiagram").then((module) => module.WebCrawlerDiagram)),
};
const SceneDiagram = dynamic(() => import("./FoundationDiagram").then((module) => module.FoundationDiagram));

const lessonLabs: Record<string, ComponentType> = {
  "scaling/cache": dynamic(() => import("./CacheLab").then((module) => module.CacheLab)),
  "rate-limiter/rate-windows": dynamic(() => import("./labs/RateLimiterLab").then((module) => module.RateLimiterLab)),
  "key-value/kv-quorum": dynamic(() => import("./labs/QuorumLab").then((module) => module.QuorumLab)),
  "patterns/pt-retries": dynamic(() => import("./labs/RetryStormLab").then((module) => module.RetryStormLab)),
  "estimation/estimate-decisions": dynamic(() => import("./labs/EstimationDrill").then((module) => module.EstimationDrill)),
};
const DesignChallenge = dynamic(() => import("./DesignChallenge").then((module) => module.DesignChallenge));

export type LessonChapter = Pick<Chapter, "id" | "number" | "title" | "lessonLabel" | "diagramHeading" | "diagramHint" | "storageKey"> & {
  steps: { id: string; title: string }[];
};

function padded(index: number) {
  return String(index + 1).padStart(2, "0");
}

// A direct visit keeps the browser's default focus; moving between lessons starts at the new heading.
let hasOpenedLesson = false;

export function LearningExperience({ chapter, step, questions, outline, nextChapter, challenge }: {
  chapter: LessonChapter;
  step: Step;
  questions: Question[];
  outline: OutlineChapter[];
  nextChapter?: { id: string; title: string; firstStepId: string };
  challenge?: DesignChallengeContent;
}) {
  const { steps } = chapter;
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [resumeSteps, setResumeSteps] = useState<Record<string, string>>({});
  const [dueReviews, setDueReviews] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [shownAnswers, setShownAnswers] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const activeStepLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const saved = readProgress(chapter.storageKey);
    setProgress(saved);
    setResumeSteps(Object.fromEntries(outline.map((item) => [
      item.id, resumeStepInChapter(item.stepIds, readProgress(item.storageKey)) ?? item.stepIds[0],
    ])));
    setDueReviews(countDue(readReviewState(browserReviewStorage()), Date.now()));
    // Revisiting a finished lesson shouldn't move where "continue" returns to.
    if (!saved.completed.includes(step.id)) {
      const result = updateStoredProgress(chapter.storageKey, (current) => ({ ...current, activeStepId: step.id }));
      setProgress(result.progress);
      setSaveFailed(!result.saved);
      rememberActiveChapter(chapter.id);
    }
    setReady(true);
    if (hasOpenedLesson) headingRef.current?.focus({ preventScroll: true });
    hasOpenedLesson = true;
  }, [chapter.id, chapter.storageKey, outline, step.id]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === chapter.storageKey) setProgress(parseProgress(event.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [chapter.storageKey]);

  useEffect(() => {
    if (!ready) return;
    const navigation = sidebarRef.current;
    const activeLink = activeStepLinkRef.current;
    if (!navigation || !activeLink) return;
    const list = navigation.getBoundingClientRect();
    const active = activeLink.getBoundingClientRect();
    if (active.bottom > list.bottom - 16) {
      navigation.scrollTop += active.bottom - list.bottom + 16;
    } else if (active.top < list.top + 64) {
      navigation.scrollTop += active.top - list.top - 64;
    }
  }, [step.id, chapter.id, ready]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen((open) => {
        if (open) menuButtonRef.current?.focus();
        return false;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function update(change: (current: Progress) => Progress) {
    const result = updateStoredProgress(chapter.storageKey, change);
    setProgress(result.progress);
    setSaveFailed(!result.saved);
    requestDurableStorage();
  }

  const activeIndex = Math.max(0, steps.findIndex((item) => item.id === step.id));
  const question = questions[Math.min(questionIndex, questions.length - 1)];
  const selectedAnswer = question ? progress.answers[question.id] : undefined;
  const answered = selectedAnswer !== undefined;
  const correct = question ? selectedAnswer === question.correctIndex : false;
  const answerShown = question ? shownAnswers.includes(question.id) : false;
  const showCorrect = answered && (correct || answerShown);
  const finished = completedCount(steps.map((item) => item.id), progress);
  const completionPercentage = steps.length ? Math.round((finished / steps.length) * 100) : 0;
  const isComplete = progress.completed.includes(step.id);
  const correctCount = questions.filter((item) => progress.answers[item.id] === item.correctIndex).length;
  const scenarioDraft = progress.scenarioDrafts[step.id] ?? "";
  const scenarioRevealed = progress.revealedScenarios.includes(step.id);
  const needsReasoning = Boolean(step.scenarioAnswer);
  const reasoningWritten = !needsReasoning || scenarioDraft.trim().length >= MIN_REASONING_LENGTH;
  const canComplete = questions.length > 0 && correctCount === questions.length && reasoningWritten;
  const isLastLesson = activeIndex === steps.length - 1;
  const Lab = lessonLabs[`${chapter.id}/${step.id}`];
  const Diagram = diagrams[chapter.id] ?? SceneDiagram;

  function selectQuestion(index: number) {
    setQuestionIndex(index);
    window.requestAnimationFrame(() => questionHeadingRef.current?.focus());
  }

  function answer(index: number) {
    if (!question || answered) return;
    recordStoredQuizAttempt(chapter.id, step.id, question.id, index, question.correctIndex);
    if (index === question.correctIndex) trackOnce("activated");
    update((current) => ({ ...current, answers: { ...current.answers, [question.id]: index } }));
    window.requestAnimationFrame(() => feedbackRef.current?.focus({ preventScroll: true }));
  }

  function clearAnswer() {
    if (!question) return;
    setShownAnswers((current) => current.filter((id) => id !== question.id));
    update((current) => {
      const answers = { ...current.answers };
      delete answers[question.id];
      return { ...current, answers };
    });
    window.requestAnimationFrame(() => firstOptionRef.current?.focus());
  }

  function showAnswer() {
    if (!question) return;
    setShownAnswers((current) => [...current, question.id]);
    window.requestAnimationFrame(() => feedbackRef.current?.focus({ preventScroll: true }));
  }

  function toggleCompletion() {
    if (!isComplete) {
      recordStoredLessonStudy(chapter.id, step.id);
      trackEvent("lesson_completed");
    }
    update((current) => ({
      ...current,
      completed: current.completed.includes(step.id)
        ? current.completed.filter((id) => id !== step.id)
        : [...current.completed, step.id],
    }));
  }

  function updateScenarioDraft(value: string) {
    if (!scenarioDraft.trim() && value.trim()) recordStoredLessonStudy(chapter.id, step.id);
    const enough = value.trim().length >= MIN_REASONING_LENGTH;
    update((current) => ({
      ...current,
      scenarioDrafts: { ...current.scenarioDrafts, [step.id]: value },
      revealedScenarios: enough ? current.revealedScenarios : current.revealedScenarios.filter((id) => id !== step.id),
    }));
  }

  function toggleScenarioGuidance() {
    if (scenarioDraft.trim().length < MIN_REASONING_LENGTH) return;
    update((current) => ({
      ...current,
      revealedScenarios: current.revealedScenarios.includes(step.id)
        ? current.revealedScenarios.filter((id) => id !== step.id)
        : [...current.revealedScenarios, step.id],
    }));
  }

  const parts = outline.reduce<{ title: string; chapters: OutlineChapter[] }[]>((groups, item) => {
    const last = groups[groups.length - 1];
    if (last?.title === item.part) last.chapters.push(item);
    else groups.push({ title: item.part, chapters: [item] });
    return groups;
  }, []);

  const remaining = [
    correctCount < questions.length ? `${correctCount} of ${questions.length} checkpoints answered correctly` : "",
    !reasoningWritten ? "write your reasoning in the decision point above" : "",
  ].filter(Boolean).join("; ");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#lesson-content">Skip to lesson</a>

      <header className="topbar">
        <div className="topbar-brand">
          <button
            ref={menuButtonRef}
            className="icon-button menu-button"
            type="button"
            aria-label={menuOpen ? "Close chapter navigation" : "Open chapter navigation"}
            aria-expanded={menuOpen}
            aria-controls="chapter-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <Link href="/" className="brand-link" aria-label="SystemKit home">
            <span className="brand-mark" aria-hidden="true"><Layers3 size={19} strokeWidth={2.2} /></span>
            <span className="brand-word">SystemKit</span>
          </Link>
          <span className="brand-divider" aria-hidden="true" />
          <Link href="/learn/" className="brand-context">Learning path</Link>
        </div>
        <div className="topbar-right">
          <span className="topbar-chapter">Chapter {chapter.number} <span aria-hidden="true">/</span> {chapter.title}</span>
          {dueReviews > 0 ? <Link href="/review/" className="topbar-review">{dueReviews} to review</Link> : null}
          <span className="topbar-progress">{ready ? completionPercentage : 0}% complete</span>
        </div>
      </header>

      {menuOpen ? <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}

      <aside ref={sidebarRef} id="chapter-sidebar" className={`sidebar ${menuOpen ? "sidebar-open" : ""}`} aria-label="Chapter navigation">
        <div className="sidebar-inner">
          <div className="sidebar-head">
            <div className="sidebar-title"><BookOpen size={18} /> <span>System design</span></div>
            <p>A guided path from first principles to familiar systems.</p>
            <nav className="sidebar-links" aria-label="Practice">
              <Link href="/review/">Five-minute review{dueReviews > 0 ? <span className="sidebar-count">{dueReviews} due</span> : null}</Link>
              <Link href="/labs/">Labs</Link>
              <Link href="/practice/">Practice designs</Link>
            </nav>
          </div>

          <LessonSearch />

          <nav className="chapter-navigation" aria-label="Chapters and lessons">
            {parts.map((part) => (
              <div key={part.title} className="nav-part">
                <span className="nav-overline">{part.title}</span>
                {part.chapters.map((item) => {
                  const selected = item.id === chapter.id;
                  return (
                    <div key={item.id} className={`chapter-group ${selected ? "is-open" : ""}`}>
                      <Link href={lessonHref(item.id, selected ? step.id : resumeSteps[item.id] ?? item.stepIds[0])} prefetch={false} className={`chapter-link ${selected ? "is-active" : ""}`}
                        aria-current={selected ? "page" : undefined}
                        aria-expanded={selected}
                        aria-controls={selected ? `chapter-lessons-${item.id}` : undefined}
                        onClick={() => setMenuOpen(false)}>
                        <span className="chapter-link-number">{item.number}</span>
                        <span className="chapter-link-title">{item.title}</span>
                        <ChevronDown className="chapter-link-chevron" size={15} aria-hidden="true" />
                      </Link>
                      {selected ? (
                        <div className="chapter-inline-content">
                          <div className="chapter-inline-progress" aria-label={`${finished} of ${steps.length} lessons complete`}>
                            <span>{chapter.lessonLabel}</span><span>{finished} / {steps.length}</span>
                          </div>
                          <ol id={`chapter-lessons-${item.id}`} className="chapter-lessons">
                            {steps.map((lesson) => {
                              const active = lesson.id === step.id;
                              const complete = progress.completed.includes(lesson.id);
                              return (
                                <li key={lesson.id}>
                                  <Link href={lessonHref(chapter.id, lesson.id)} prefetch={false} ref={active ? activeStepLinkRef : undefined}
                                    className={`step-link ${active ? "is-active" : ""}`}
                                    aria-current={active ? "step" : undefined}
                                    aria-label={`${lesson.title}${complete ? ", completed" : ""}`}
                                    onClick={() => setMenuOpen(false)}>
                                    <span className="step-link-title">{lesson.title}</span>
                                    {complete ? <Check className="step-complete-icon" size={15} strokeWidth={2.5} aria-hidden="true" /> : null}
                                  </Link>
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={`sidebar-foot ${saveFailed ? "sidebar-foot-warning" : ""}`}>
            <span className="sidebar-foot-icon">{saveFailed ? <TriangleAlert size={13} /> : <Circle size={9} fill="currentColor" />}</span>
            <span>{saveFailed ? "This browser isn’t saving your progress" : <>Saved in this browser. <Link href="/#progress">Back it up</Link></>}</span>
          </div>
        </div>
      </aside>

      <main id="lesson-content" className="main-content" tabIndex={-1}>
        <div className="main-wrap">
          <div className="lesson-toolbar">
            <div className="breadcrumb">
              <Link href="/learn/">LEARN</Link><span aria-hidden="true">/</span>
              <Link href={chapterHref(chapter.id)}>{chapter.title.toUpperCase()}</Link><span aria-hidden="true">/</span>
              <strong>{padded(activeIndex)}</strong>
            </div>
            <CopyLessonLink path={lessonHref(chapter.id, step.id)} />
          </div>

          <div className="lesson-heading">
            <div className="lesson-heading-main">
              <span className="eyebrow"><span className="eyebrow-line" /> LESSON {padded(activeIndex)} <span className="eyebrow-dot">·</span> {step.eyebrow.replace(/^\d+\s*·\s*/, "")}</span>
              <h1 ref={headingRef} tabIndex={-1}>{step.title}</h1>
              <p className="lesson-summary">{step.summary}</p>
            </div>
            <div className="lesson-number" aria-hidden="true">{padded(activeIndex)}</div>
          </div>

          <DiagramView chapterId={chapter.id} diagramId={step.diagramId} heading={chapter.diagramHeading} hint={chapter.diagramHint}>
            <Diagram id={step.diagramId} />
          </DiagramView>

          {Lab ? <Lab /> : null}

          <div className="content-grid">
            <article className="lesson-article" aria-labelledby="concept-heading">
              <span className="section-kicker">THE IDEA</span>
              <h2 id="concept-heading">How it works</h2>
              <div className="body-copy">
                {step.body.map((paragraph, index) => <p key={`${step.id}-body-${index}`}><InlineText text={paragraph} /></p>)}
              </div>
              {step.scenario ? (
                <div className="scenario-card">
                  <div className="scenario-label"><span className="scenario-spark" aria-hidden="true">✳</span> DECISION POINT</div>
                  <p><InlineText text={step.scenario} /></p>
                  {step.scenarioAnswer ? (
                    <div className="scenario-reflection">
                      <label htmlFor={`scenario-draft-${step.id}`}>Your reasoning</label>
                      <textarea
                        id={`scenario-draft-${step.id}`}
                        value={scenarioDraft}
                        onChange={(event) => updateScenarioDraft(event.target.value)}
                        rows={4}
                        maxLength={1200}
                        aria-describedby={`scenario-hint-${step.id}`}
                        placeholder="What would you do, and why?"
                      />
                      <div className="scenario-controls">
                        <span id={`scenario-hint-${step.id}`}>{reasoningWritten ? "Your notes stay on this device." : "Write a sentence or two to unlock the guidance. Committing first is what makes it stick."}</span>
                        <button
                          type="button"
                          className="scenario-reveal"
                          onClick={toggleScenarioGuidance}
                          disabled={!reasoningWritten}
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
                        <p><InlineText text={step.scenarioAnswer} /></p>
                        <span>Use this as a guide for self review; written answers are not graded.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="takeaways">
                <h3>Keep in mind</h3>
                <ul>{step.takeaways.map((takeaway, index) => <li key={`${step.id}-takeaway-${index}`}><Check size={15} strokeWidth={2.3} aria-hidden="true" /><span><InlineText text={takeaway} /></span></li>)}</ul>
              </div>
            </article>

            <aside className="lesson-side" aria-label="Lesson details">
              <div className="chapter-card">
                <span className="chapter-card-label">IN THIS LESSON</span>
                <div className="chapter-card-index">{padded(activeIndex)} <span>/ {String(steps.length).padStart(2, "0")}</span></div>
                <p>{step.summary}</p>
                <div className="chapter-card-separator" />
                <span className="chapter-card-bottom">{questions.length} {questions.length === 1 ? "checkpoint" : "checkpoints"} <ChevronDown size={14} /></span>
              </div>
            </aside>
          </div>

          <section className="quiz-section" aria-labelledby="quiz-heading">
            <div className="quiz-intro">
              <div><span className="section-kicker">CHECK YOUR UNDERSTANDING</span><h2 id="quiz-heading">Put it into practice.</h2></div>
              <span className="quiz-count">{questions.length > 0 ? `${Math.min(questionIndex + 1, questions.length)} OF ${questions.length}` : "NO QUESTIONS"}</span>
            </div>
            {question ? (
              <div className="quiz-card" key={question.id}>
                <div className="question-meta"><span className="difficulty-tag">{question.difficulty}</span><span>QUESTION {padded(questionIndex)}</span></div>
                <h3 ref={questionHeadingRef} tabIndex={-1}><InlineText text={question.prompt} /></h3>
                <div className="option-list" role="group" aria-label="Answer choices">
                  {optionOrder(question.id, question.options.length).map((index, position) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrectAnswer = showCorrect && index === question.correctIndex;
                    return (
                      <button
                        type="button"
                        className={`option ${isSelected ? "is-selected" : ""} ${isCorrectAnswer ? "is-correct" : ""} ${isSelected && !correct ? "is-incorrect" : ""}`}
                        key={`${question.id}-option-${index}`}
                        ref={position === 0 ? firstOptionRef : undefined}
                        onClick={() => answer(index)}
                        disabled={answered}
                        aria-pressed={isSelected}
                      >
                        <span className="option-letter" aria-hidden="true">{String.fromCharCode(65 + position)}</span>
                        <span><InlineText text={question.options[index]} /></span>
                        {isCorrectAnswer ? <CheckCircle2 className="option-result" size={18} aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
                {answered ? (
                  <div ref={feedbackRef} tabIndex={-1} className={`answer-feedback ${correct ? "feedback-correct" : "feedback-incorrect"}`} role="status" aria-live="polite">
                    <strong>{correct ? "Exactly right." : answerShown ? "Here’s the answer, and why." : "Not quite. Give it another try."}</strong>
                    <p>{showCorrect ? <InlineText text={question.explanation} /> : "Reread the idea above and reason it through. The explanation appears once you get it, or if you ask for it."}</p>
                    <div className="feedback-actions">
                      <button className="text-button" type="button" onClick={clearAnswer}>{correct ? "Answer again" : "Try again"} <RotateCcw size={15} /></button>
                      {!showCorrect ? <button className="text-button" type="button" onClick={showAnswer}>Show the answer <Eye size={15} /></button> : null}
                      {showCorrect && questionIndex + 1 < questions.length ? <button className="text-button" type="button" onClick={() => selectQuestion(questionIndex + 1)}>Next question <ArrowRight size={16} /></button> : null}
                    </div>
                  </div>
                ) : <p className="quiz-hint">Choose an answer. You’ll see the explanation once you get it right.</p>}
                {questionIndex > 0 ? <button className="previous-question" type="button" onClick={() => selectQuestion(questionIndex - 1)}><ArrowLeft size={14} /> Previous question</button> : null}
              </div>
            ) : <div className="quiz-empty">A checkpoint for this lesson is being prepared.</div>}
          </section>

          {saveFailed ? <p className="save-warning" role="status"><TriangleAlert size={15} aria-hidden="true" /> This browser isn’t saving your progress, so it will last only while this tab stays open.</p> : null}

          {challenge ? <DesignChallenge challenge={challenge} /> : null}

          <div className="lesson-actions">
            <button className={`completion-button ${isComplete ? "completed" : ""}`} type="button" onClick={toggleCompletion} disabled={!isComplete && !canComplete} aria-describedby="completion-hint">
              {isComplete ? <RotateCcw size={17} /> : <Check size={17} />}
              {isComplete ? "Mark as incomplete" : "Mark lesson complete"}
            </button>
            {activeIndex + 1 < steps.length
              ? <Link className="next-button" href={lessonHref(chapter.id, steps[activeIndex + 1].id)} prefetch={false}>Next lesson <ArrowRight size={17} /></Link>
              : nextChapter
                ? <Link className="next-button" href={lessonHref(nextChapter.id, resumeSteps[nextChapter.id] ?? nextChapter.firstStepId)} prefetch={false}>Next chapter: {nextChapter.title} <ArrowRight size={17} /></Link>
                : <Link className="next-button" href="/practice/">Practice designs <ArrowRight size={17} /></Link>}
          </div>
          <p id="completion-hint" className="completion-hint">
            {isComplete ? "Lesson complete. You can answer any checkpoint again." : canComplete ? "Ready to mark complete." : `To finish this lesson: ${remaining}.`}
          </p>

          {isLastLesson && isComplete ? (
            <section className="chapter-end" aria-labelledby="chapter-end-heading">
              <h2 id="chapter-end-heading">{nextChapter ? `That’s ${chapter.title} done.` : "You’ve reached the end of the path."}</h2>
              <p>{finished === steps.length
                ? "Ideas fade unless you recall them. What you studied here comes back in a short review tomorrow, and the gaps grow as you get them right."
                : `${steps.length - finished} ${steps.length - finished === 1 ? "lesson" : "lessons"} in this chapter ${steps.length - finished === 1 ? "is" : "are"} still open.`}</p>
              <div className="chapter-end-links">
                <Link href={chapterHref(chapter.id)}>See the chapter overview <ArrowRight size={14} aria-hidden="true" /></Link>
                <Link href="/review/">Open your review <ArrowRight size={14} aria-hidden="true" /></Link>
                <Link href="/practice/">Practice a design <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
            </section>
          ) : null}

          <footer className="site-footer"><span>SystemKit</span><span>Learn the decisions behind the diagram.</span></footer>
        </div>
      </main>
    </div>
  );
}
