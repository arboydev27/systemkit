"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { buildDrill, formatQuantity, gradeDrill, nextDrillId, parseQuantity, type DrillGrade } from "@/lib/estimation-drills";
import { trackOnce } from "@/lib/analytics";
import { LabHeader, Verdict } from "./lab-shared";
import styles from "./Lab.module.css";

const STATS_KEY = "systemkit:estimation-drills:v1";
const FIRST_DRILL = "qps.1";
const verdicts: Record<DrillGrade, string> = {
  "on-target": "On target: within 25% of the worked answer.",
  ballpark: "Right ballpark: within a factor of two. That’s often enough to choose a design, but check your steps.",
  off: "Off by more than a factor of two. Look for the step where the units or the zeros went astray.",
};

type Stats = { attempts: number; onTarget: number };

function readStats(): Stats {
  try {
    const value = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "null") as Partial<Stats> | null;
    if (value && Number.isInteger(value.attempts) && Number.isInteger(value.onTarget)) return { attempts: value.attempts!, onTarget: value.onTarget! };
  } catch { /* A drill works without stored totals. */ }
  return { attempts: 0, onTarget: 0 };
}

export function EstimationDrill({ standalone = false, headingLevel = 2 }: { standalone?: boolean; headingLevel?: 1 | 2 }) {
  const id = useId();
  const [drillId, setDrillId] = useState(FIRST_DRILL);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [grade, setGrade] = useState<DrillGrade | null>(null);
  const [stats, setStats] = useState<Stats>({ attempts: 0, onTarget: 0 });
  const drill = buildDrill(drillId) ?? buildDrill(FIRST_DRILL)!;

  useEffect(() => {
    setStats(readStats());
    if (!standalone) return;
    const fromLink = new URLSearchParams(window.location.search).get("drill");
    if (fromLink && buildDrill(fromLink)) setDrillId(fromLink);
  }, [standalone]);

  function check(event: FormEvent) {
    event.preventDefault();
    const given = parseQuantity(text, drill.unit);
    if (given === undefined) {
      setError(`Enter a number in ${drill.unit}, such as 1200, 1.2k, or 3 million.`);
      return;
    }
    const result = gradeDrill(drill.answer, given);
    setError("");
    setGrade(result);
    trackOnce("drill_answered");
    const next = { attempts: stats.attempts + 1, onTarget: stats.onTarget + (result === "on-target" ? 1 : 0) };
    setStats(next);
    try { window.localStorage.setItem(STATS_KEY, JSON.stringify(next)); } catch { /* Totals are a convenience. */ }
  }

  function another() {
    setDrillId(nextDrillId(drillId, Math.floor(Math.random() * 1_000_000)));
    setText("");
    setError("");
    setGrade(null);
  }

  return <section className={styles.lab} aria-labelledby={`${id}-heading`}>
    <LabHeader id={`${id}-heading`} headingLevel={headingLevel} title="Estimate it on paper, then check" link={`/practice/estimation/?drill=${drillId}`}
      intro="Estimation is the one design skill a machine can honestly check. Each drill has new numbers. Work it out with units before you answer: rough is fine, and you’ll be told how rough."
      onReset={() => { setDrillId(FIRST_DRILL); setText(""); setError(""); setGrade(null); }} />
    <p className={styles.drillPrompt}>{drill.prompt}</p>
    <form className={styles.drillForm} onSubmit={check}>
      <label className={styles.drillField} htmlFor={`${id}-answer`}>Your estimate, in {drill.unit}
        <input id={`${id}-answer`} value={text} onChange={(event) => setText(event.target.value)} inputMode="text" autoComplete="off" readOnly={grade !== null} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} />
      </label>
      {grade === null
        ? <button className={styles.primary} type="submit" disabled={!text.trim()}>Check</button>
        : <button className={styles.primary} type="button" onClick={another}>Next drill</button>}
    </form>
    {error ? <p id={`${id}-error`} className={styles.drillError} role="alert">{error}</p> : null}
    {grade !== null ? <div className={styles.results}>
      <Verdict correct={null}>{verdicts[grade]} The worked answer is about <strong>{formatQuantity(drill.answer)} {drill.unit}</strong>.</Verdict>
      <ol className={styles.drillSteps}>{drill.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    </div> : null}
    {stats.attempts ? <p className={styles.drillTally}>{stats.onTarget} of {stats.attempts} on target in this browser.</p> : null}
  </section>;
}
