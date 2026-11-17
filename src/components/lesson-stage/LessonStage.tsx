"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { createStage, type StageHandle, type StageStatus } from "@/lib/lesson-stage/engine";
import { formatMetric, metricsAt, type Choices } from "@/lib/lesson-stage/model";
import type { MetricValue, StageScene } from "@/lib/lesson-stage/types";
import styles from "./LessonStage.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number over the stage that counts to its new value when a step changes it. */
function MetricChip({ label, value }: { label: string; value: MetricValue | undefined }) {
  const [shown, setShown] = useState(() => formatMetric(value));
  const [flash, setFlash] = useState(false);
  const previous = useRef<MetricValue | undefined>(value);
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (JSON.stringify(from) === JSON.stringify(value)) return;
    const a = from === undefined || typeof from === "string" ? null : typeof from === "number" ? from : from.n;
    const b = value === undefined || typeof value === "string" ? null : typeof value === "number" ? value : value.n;
    let frame = 0;
    const unit = (v: MetricValue | undefined) => (v !== undefined && typeof v === "object" ? v.unit ?? "" : "");
    if (a === null || b === null || unit(from) !== unit(value) || reducedMotion()) setShown(formatMetric(value));
    else {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.max(0, Math.min(1, (now - start) / 900));
        setShown(formatMetric(value, a + (b - a) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    if (from !== undefined && value !== undefined) setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 900);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [value]);
  const tone = value !== undefined && typeof value === "object" ? value.tone : undefined;
  return <div className={`${styles.chip} ${flash ? styles.flash : ""}`} data-tone={tone || undefined}>
    <span className={styles.chipLabel}>{label}</span>
    <span className={styles.chipValue}>{shown}</span>
  </div>;
}

export function LessonStage({ scene, title }: { scene: StageScene; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StageHandle | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const scriptRef = useRef<HTMLDivElement>(null);
  const heads = useRef<(HTMLButtonElement | null)[]>([]);
  const refocus = useRef(false);
  const [status, setStatus] = useState<StageStatus>({ step: -1, total: scene.steps.length, playing: false, paused: false, ended: false, settled: true, hold: 0 });
  const [choices, setChoices] = useState<Choices>({});
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [direction, setDirection] = useState(1);
  const lastStep = useRef(-1);
  const total = scene.steps.length;
  const step = status.step;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stage = createStage(host, scene, { onStatus: setStatus, label: `${title}: the system, step by step` });
    stageRef.current = stage;
    setReady(true);
    const linked = /^#step-(\d+)$/.exec(window.location.hash);
    if (linked && +linked[1] >= 1 && +linked[1] <= scene.steps.length) stage.show(+linked[1] - 1);
    return () => { stage.destroy(); stageRef.current = null; };
  }, [scene, title]);

  useEffect(() => {
    if (!ready || step === lastStep.current) return;
    setDirection(step > lastStep.current ? 1 : -1);
    lastStep.current = step;
    const url = step >= 0 ? `#step-${step + 1}` : window.location.pathname + window.location.search;
    window.history.replaceState(window.history.state, "", url);
    // The step's words are already in the list beside the stage; announcing its title keeps up with autoplay.
    if (step >= 0) setAnnouncement(`Step ${step + 1} of ${total}: ${scene.steps[step].title}`);
    // Keep the current step in view inside the list (never scrolling the page itself).
    const panel = scriptRef.current, head = step >= 0 ? heads.current[step] : null;
    if (panel && head) {
      const item = head.closest("li");
      window.setTimeout(() => {
        if (!item || panel.scrollHeight <= panel.clientHeight) return;
        const top = item.offsetTop - panel.offsetTop, bottom = top + item.offsetHeight;
        if (top < panel.scrollTop + 8 || bottom > panel.scrollTop + panel.clientHeight - 8) {
          panel.scrollTo({ top: Math.max(0, Math.min(top - 12, bottom - panel.clientHeight + 12)), behavior: reducedMotion() ? "auto" : "smooth" });
        }
      }, 480);
    }
    if (refocus.current && head) { refocus.current = false; head.focus({ preventScroll: true }); }
  }, [ready, step, total, scene]);

  const stage = () => stageRef.current;
  /** A jump started from the list keeps keyboard focus in the list, on the step it landed on. */
  function jumpFromList(i: number) { refocus.current = true; stage()?.jump(i); }
  function choose(stepIndex: number, option: number) {
    setChoices((current) => ({ ...current, [stepIndex]: option }));
    stage()?.choose(stepIndex, option);
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select")) return;
    if ((event.key === " " || event.key === "Enter") && target.closest("button")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const s = stage();
    if (!s) return;
    if (event.key === " " || event.key === "k") { event.preventDefault(); s.toggle(); }
    else if (event.key === "ArrowRight") { event.preventDefault(); s.next(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); s.back(); }
    else if (event.key === "Escape") { event.preventDefault(); s.pause(); }
    else if (event.key === "Home") { event.preventDefault(); s.reset(); }
    else if (/^[1-9]$/.test(event.key) && +event.key <= total) s.jump(+event.key - 1);
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") swipe.current = { x: event.clientX, y: event.clientY };
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) stage()?.next(); else stage()?.back(); }
  }

  // The numbers change once the step has played what changes them.
  const shownStep = status.settled ? step : step - 1;
  const metrics = shownStep >= 0 ? metricsAt(scene, shownStep, choices) : {};
  const playLabel = status.playing ? "Pause" : status.ended ? "Replay" : "Play";
  const PlayIcon = status.playing ? Pause : status.ended ? RotateCw : Play;
  const next = step < total - 1 ? scene.steps[step + 1] : null;

  return <div className={styles.root} data-ready={ready || undefined} data-started={step >= 0 || undefined} onKeyDown={onKeyDown}>
    <div className={styles.stageCard}>
      <div
        ref={hostRef}
        className={styles.stage}
        tabIndex={0}
        role="group"
        aria-roledescription="lesson stage"
        aria-label={`${title}: the system, step by step`}
        aria-describedby={`${scene.id}-stage-keys`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipe.current = null; }}
      />
      {scene.metrics?.length ? <div className={styles.chips} aria-label="Numbers for this step" role="group">
        {scene.metrics.map((metric) => <MetricChip key={metric.id} label={metric.label} value={metrics[metric.id]} />)}
      </div> : null}
    </div>
    <div className={styles.transport} role="group" aria-label="Playback">
        <button type="button" className={styles.tool} onClick={() => stage()?.reset()} aria-label="Reset"><RotateCcw size={17} aria-hidden="true" /></button>
        <button type="button" className={styles.tool} onClick={() => stage()?.back()} aria-label="Previous step"><ChevronLeft size={19} aria-hidden="true" /></button>
        <button type="button" className={styles.play} onClick={() => stage()?.toggle()} aria-label={playLabel}>
          <PlayIcon size={16} aria-hidden="true" fill={status.playing || status.ended ? "none" : "currentColor"} /><span>{playLabel}</span>
        </button>
        <button type="button" className={styles.tool} onClick={() => stage()?.next()} aria-label={next ? `Next: ${next.title}` : "Next step"}><ChevronRight size={19} aria-hidden="true" /></button>
        <div className={styles.pips}>
          {scene.steps.map((s, i) => <button
            type="button"
            key={s.title}
            tabIndex={-1}
            className={`${styles.pip} ${i < step ? styles.pipDone : ""} ${i === step ? styles.pipCurrent : ""}`}
            aria-label={`Step ${i + 1}: ${s.title}`}
            aria-current={i === step ? "step" : undefined}
            data-holding={i === step && status.hold > 0 ? "" : undefined}
            data-paused={status.paused || undefined}
            style={i === step && status.hold > 0 ? ({ "--hold": `${status.hold}ms` } as CSSProperties) : undefined}
            onClick={() => stage()?.jump(i)}
          />)}
        </div>
        <span className={styles.count} aria-hidden="true">{step < 0 ? `${total} steps` : `${step + 1} / ${total}`}</span>
    </div>

    <div ref={scriptRef} className={`${styles.script} ${step < 0 ? styles.overview : ""}`}>
      <p className={styles.intro}>{scene.intro}</p>
      <ol className={styles.steps}>
        {scene.steps.map((s, i) => {
          const state = i < step ? "done" : i === step ? "current" : "todo";
          return <li key={s.title} className={styles.step} data-state={state} style={{ "--from": `${direction * 28}px` } as CSSProperties}>
            <button type="button" ref={(node) => { heads.current[i] = node; }} className={styles.stepHead} onClick={() => jumpFromList(i)} aria-current={i === step ? "step" : undefined}>
              <span className={styles.stepNumber}>{pad(i + 1)}<span className={styles.stepTotal}> / {total}</span></span>
              <span className={styles.stepTitle}>{s.title}</span>
            </button>
            <div className={styles.stepBody} inert={ready && i !== step ? true : undefined}><div>
              <p>{s.text}</p>
              {s.facts?.length ? <dl className={styles.facts}>{s.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
              {s.changes?.length ? <>
                <p className={styles.changesTitle}>What changed</p>
                <ul className={styles.changes}>{s.changes.map((c) => <li key={c} data-sign={c[0]}>{c.slice(2)}</li>)}</ul>
              </> : null}
              {s.control ? <div className={styles.control}>
                <span className={styles.controlLabel} id={`${scene.id}-control-${i}`}>{s.control.label}</span>
                <div className={styles.options} role="group" aria-labelledby={`${scene.id}-control-${i}`}>
                  {s.control.options.map((o, j) => <button
                    type="button"
                    key={o.label}
                    className={styles.option}
                    aria-pressed={(choices[i] ?? 0) === j}
                    onClick={() => choose(i, j)}
                  >{o.label}</button>)}
                </div>
              </div> : null}
              {i < total - 1 ? <button type="button" className={styles.nextStep} onClick={() => jumpFromList(i + 1)}>
                Next: {scene.steps[i + 1].short} <ArrowRight size={14} aria-hidden="true" />
              </button> : null}
            </div></div>
          </li>;
        })}
      </ol>
      <p className={styles.keys} id={`${scene.id}-stage-keys`}>
        <kbd>Space</kbd> plays · <kbd>←</kbd> <kbd>→</kbd> step · <kbd>Home</kbd> resets
      </p>
    </div>
    <p className={styles.srOnly} aria-live="polite">{announcement}</p>
  </div>;
}
