"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Link as LinkIcon, RotateCcw, TriangleAlert } from "lucide-react";
import { trackOnce } from "@/lib/analytics";
import styles from "./Lab.module.css";

/** Keeps a lab's settings in its own page's address, so a setup can be shared as a link. */
export function useLabLink(labId: string, standalone: boolean, query: string, apply: (params: URLSearchParams) => void) {
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (standalone) apply(new URLSearchParams(window.location.search));
  });
  useEffect(() => {
    if (standalone && applied.current) window.history.replaceState(null, "", `?${query}`);
  }, [query, standalone]);
  return `/labs/${labId}/?${query}`;
}

export function LabHeader({ id, title, intro, link, onReset, headingLevel = 2 }: {
  id: string; title: string; intro: string; link: string; onReset: () => void; headingLevel?: 1 | 2;
}) {
  const [copied, setCopied] = useState(false);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(link, window.location.origin).href);
      setCopied(true);
    } catch {
      window.location.assign(link);
    }
  }
  return <>
    <div className={styles.heading}>
      <Heading id={id}>{title}</Heading>
      <div className={styles.headingActions}>
        <button type="button" onClick={copy}>{copied ? <Check size={14} aria-hidden="true" /> : <LinkIcon size={14} aria-hidden="true" />} {copied ? "Link copied" : "Copy this setup"}</button>
        <button type="button" onClick={() => { setCopied(false); onReset(); }}><RotateCcw size={14} aria-hidden="true" /> Reset</button>
      </div>
    </div>
    <p className={styles.intro}>{intro}</p>
  </>;
}

export function Prediction<T extends string>({ legend, options, value, onChange, onReveal, name }: {
  legend: string; options: { value: T; label: string }[]; value: T | null;
  onChange: (value: T) => void; onReveal: () => void; name: string;
}) {
  return <div className={styles.prediction}>
    <fieldset>
      <legend>{legend}</legend>
      <div className={styles.choices}>
        {options.map((option) => <label key={option.value}>
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
          <span>{option.label}</span>
        </label>)}
      </div>
    </fieldset>
    <div className={styles.predictionActions}>
      <p>Commit to an answer first. Being wrong here is the useful part.</p>
      <button type="button" className={styles.primary} disabled={!value} onClick={onReveal}>Run it</button>
    </div>
  </div>;
}

export function Verdict({ correct, children }: { correct: boolean | null; children: ReactNode }) {
  return <p className={styles.verdict} role="status">
    {correct === null ? null : correct ? <Check size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
    <span>{correct === null ? null : <strong>{correct ? "Your prediction matches the model. " : "Not what you predicted. "}</strong>}{children}</span>
  </p>;
}

export function Segments<T extends string>({ legend, options, value, onChange, name }: {
  legend: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; name: string;
}) {
  return <fieldset className={styles.segmentField}>
    <legend>{legend}</legend>
    <div className={styles.segments}>
      {options.map((option) => <label key={option.value} className={value === option.value ? styles.segmentOn : undefined}>
        <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

export function Slider({ id, label, value, display, min, max, step, onChange, hint }: {
  id: string; label: string; value: number; display: string; min: number; max: number; step: number;
  onChange: (value: number) => void; hint?: string;
}) {
  return <div className={styles.slider}>
    <div className={styles.sliderHeading}><label htmlFor={id}>{label}</label><output htmlFor={id}>{display}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={display} onChange={(event) => onChange(Number(event.target.value))} />
    {hint ? <p className={styles.hint}>{hint}</p> : null}
  </div>;
}

export function Assumptions({ items, children }: { items: string[]; children?: ReactNode }) {
  return <details className={styles.assumptions}>
    <summary>What this model assumes</summary>
    <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    {children}
  </details>;
}

export function useLabReveal(labId: string) {
  const [revealed, setRevealed] = useState(false);
  return { revealed, setRevealed, reveal() { setRevealed(true); trackOnce(`lab_run_${labId}`); } };
}

/** Width of a chart's container, so labels stay readable on phones instead of scaling down with an SVG. */
export function useContainerWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(240, element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
