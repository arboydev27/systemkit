"use client";

import { useId, useState } from "react";
import { clampQuorum, modelQuorum } from "@/lib/labs/quorum";
import { Assumptions, LabHeader, Prediction, Slider, useLabLink, useLabReveal, Verdict } from "./lab-shared";
import styles from "./Lab.module.css";

type Answer = "yes" | "no";
const defaults = { n: 3, w: 1, r: 1 };

export function QuorumLab({ standalone = false, headingLevel = 2 }: { standalone?: boolean; headingLevel?: 1 | 2 }) {
  const id = useId();
  const [settings, setSettings] = useState({ ...defaults, down: [] as number[] });
  const [prediction, setPrediction] = useState<Answer | null>(null);
  const [predictedFor, setPredictedFor] = useState("");
  const { revealed, setRevealed, reveal } = useLabReveal("quorum");
  const { n, w, r, down } = settings;
  const query = `n=${n}&w=${w}&r=${r}${down.length ? `&down=${down.join(".")}` : ""}`;
  const link = useLabLink("quorum", standalone, query, (params) => {
    setSettings(clampQuorum({
      n: Number(params.get("n")) || defaults.n,
      w: Number(params.get("w")) || defaults.w,
      r: Number(params.get("r")) || defaults.r,
      down: (params.get("down") ?? "").split(".").filter(Boolean).map(Number).filter(Number.isInteger),
    }));
  });
  const update = (patch: Partial<typeof settings>) => setSettings((current) => clampQuorum({ ...current, ...patch }));
  const toggleDown = (index: number) => update({ down: down.includes(index) ? down.filter((item) => item !== index) : [...down, index] });

  const result = modelQuorum(settings);
  const canBeStale = result.staleReadChance > 0;
  const correct = revealed && predictedFor === query && prediction ? (prediction === "yes") === canBeStale : null;

  return <section className={styles.lab} aria-labelledby={`${id}-heading`}>
    <LabHeader id={`${id}-heading`} headingLevel={headingLevel} title="Can this quorum return stale data?" link={link}
      intro="A write was just acknowledged by W replicas, and the others haven’t caught up yet. A read now asks R replicas. Set N, W, and R, take replicas down, and predict what the read can see."
      onReset={() => { setSettings({ ...defaults, down: [] }); setPrediction(null); setRevealed(false); setPredictedFor(""); }} />

    <div className={styles.controls}>
      <Slider id={`${id}-n`} label="Replicas (N)" value={n} display={String(n)} min={3} max={7} step={1} onChange={(value) => update({ n: value })} />
      <Slider id={`${id}-w`} label="Write quorum (W)" value={w} display={String(w)} min={1} max={n} step={1} onChange={(value) => update({ w: value })} />
      <Slider id={`${id}-r`} label="Read quorum (R)" value={r} display={String(r)} min={1} max={n} step={1} onChange={(value) => update({ r: value })} />
    </div>

    <p className={styles.subhead} id={`${id}-replicas`}>Select a replica to take it down or bring it back</p>
    <div className={styles.replicas} role="group" aria-labelledby={`${id}-replicas`}>
      {Array.from({ length: n }, (_, index) => {
        const isDown = down.includes(index);
        const holds = result.holders.includes(index);
        return <button key={index} type="button" aria-pressed={isDown} onClick={() => toggleDown(index)}
          className={`${styles.replica} ${isDown ? styles.replicaDown : holds ? styles.replicaHolder : ""}`}>
          <strong>Replica {index + 1}</strong>
          <span>{isDown ? "Down" : holds ? "Holds the latest write" : "Older copy"}</span>
        </button>;
      })}
    </div>

    {!revealed ? <Prediction<Answer> name={`${id}-prediction`} value={prediction} onChange={setPrediction}
      legend={`With N=${n}, W=${w}, R=${r}, can a read return the older value?`}
      options={[{ value: "yes", label: "Yes, it can" }, { value: "no", label: "No, it can’t" }]}
      onReveal={() => { setPredictedFor(query); reveal(); }} /> : <div className={styles.results}>
        <Verdict correct={correct}>
          {!result.canRead
            ? `Only ${result.up} replicas are reachable, so a read of ${r} can’t complete at all.`
            : canBeStale
              ? `A read of ${r} misses every replica holding the latest write ${Math.round(result.staleReadChance * 100)}% of the time.`
              : `Every possible read of ${r} reachable replicas includes one holding the latest write.`}
        </Verdict>
        <dl className={styles.stats}>
          <div><dt>W + R, against N = {n}</dt><dd>{w + r}</dd></div>
          <div><dt>Chance of a stale read</dt><dd>{result.canRead ? `${Math.round(result.staleReadChance * 100)}%` : "No read"}</dd></div>
          <div><dt>Failures writes survive</dt><dd>{result.writesSurvive}</dd></div>
          <div><dt>Failures reads survive</dt><dd>{result.readsSurvive}</dd></div>
        </dl>
        <p className={styles.explain}>
          {result.overlap
            ? `Because W + R is greater than N, the replicas a read asks must overlap the replicas that took the write. That guarantee has a price: `
            : `Because W + R is not greater than N, a read can land entirely on replicas that haven’t seen the write. In exchange, `}
          {result.overlap
            ? `writes stop working once more than ${result.writesSurvive} ${result.writesSurvive === 1 ? "replica is" : "replicas are"} down, and reads stop past ${result.readsSurvive}.`
            : `reads and writes stay fast and keep working through more failures: writes survive ${result.writesSurvive} down and reads survive ${result.readsSurvive}.`}
          {!result.canWrite ? ` Right now new writes would fail: they need ${w} replicas and only ${result.up} are up.` : ""}
          {" "}Try raising W or R by one and see what you trade away.
        </p>
      </div>}

    <Assumptions items={[
      "Worst case: exactly W replicas hold the write, and nothing has caught up yet. Real systems usually converge within moments through background replication and read repair.",
      "A read chooses R replicas evenly from those that are reachable.",
      "Replicas that fail keep whatever they had, and new writes in this model need W reachable replicas.",
      "An overlapping quorum isn’t the same as linearizability: concurrent writes, partial failures, and sloppy quorums can still produce surprises. See the Key-Value Store and Consensus chapters.",
    ]} />
  </section>;
}
