"use client";

import { useId, useState } from "react";
import { ArrowDown, Check, Database, HardDrive, RotateCcw, Server, TriangleAlert } from "lucide-react";
import { modelCacheReads, type CacheModelInput } from "@/lib/cache-model";
import styles from "./CacheLab.module.css";

const initialInput: CacheModelInput = {
  requestsPerSecond: 1000,
  hitRatePercent: 90,
  cacheAvailable: false,
  databaseCapacity: 300,
};
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
type Prediction = "within" | "above";

export function CacheLab() {
  const id = useId();
  const [input, setInput] = useState(initialInput);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [predictionCorrect, setPredictionCorrect] = useState<boolean | null>(null);
  const model = modelCacheReads(input);
  const format = (value: number) => number.format(value);
  const reads = (value: number) => `${format(value)} reads/s`;
  const capacityLabel = model.exceedsCapacity ? "Above example capacity" : model.spareCapacity === 0 ? "At example capacity" : "Within example capacity";

  function updateInput(patch: Partial<CacheModelInput>) {
    setInput((current) => ({ ...current, ...patch }));
    setPredictionCorrect(null);
    if (!revealed) setPrediction(null);
  }

  function revealOutcome() {
    if (!prediction) return;
    setPredictionCorrect((prediction === "above") === model.exceedsCapacity);
    setRevealed(true);
  }

  function reset() {
    setInput(initialInput);
    setPrediction(null);
    setRevealed(false);
    setPredictionCorrect(null);
  }

  return (
    <section className={styles.lab} aria-labelledby={`${id}-heading`}>
      <div className={styles.heading}>
        <div>
          <span className="section-kicker">TRY THE SYSTEM</span>
          <h2 id={`${id}-heading`}>When the cache disappears.</h2>
        </div>
        <button className={styles.reset} type="button" onClick={reset}>
          <RotateCcw size={14} aria-hidden="true" /> Reset lab
        </button>
      </div>
      <p className={styles.intro}>A cache reduces database reads. What happens to that protection when it goes offline? Set the workload, predict the result, then explore.</p>

      <div className={styles.workspace}>
        <div className={styles.controls}>
          <div className={styles.control}>
            <div className={styles.controlHeading}>
              <label htmlFor={`${id}-traffic`}>Incoming read requests</label>
              <output htmlFor={`${id}-traffic`}>{format(input.requestsPerSecond)}<span> /s</span></output>
            </div>
            <input id={`${id}-traffic`} type="range" min="100" max="5000" step="100" value={input.requestsPerSecond}
              aria-valuetext={`${format(input.requestsPerSecond)} read requests per second`}
              onChange={(event) => updateInput({ requestsPerSecond: Number(event.target.value) })} />
            <div className={styles.rangeEnds} aria-hidden="true"><span>100 /s</span><span>5,000 /s</span></div>
          </div>

          <div className={styles.control}>
            <div className={styles.controlHeading}>
              <label htmlFor={`${id}-hit-rate`}>Healthy-cache hit rate</label>
              <output htmlFor={`${id}-hit-rate`}>{input.hitRatePercent}<span>%</span></output>
            </div>
            <input id={`${id}-hit-rate`} type="range" min="0" max="100" step="1" value={input.hitRatePercent}
              aria-valuetext={`${input.hitRatePercent} percent cache hits when healthy`}
              aria-describedby={`${id}-hit-hint`}
              onChange={(event) => updateInput({ hitRatePercent: Number(event.target.value) })} />
            <p id={`${id}-hit-hint`} className={styles.hint}>Applies while the cache is healthy. An unavailable cache serves no hits.</p>
          </div>

          <fieldset className={styles.cacheState}>
            <legend>Cache state</legend>
            <div className={styles.segmented}>
              {[{ label: "Healthy", available: true }, { label: "Unavailable", available: false }].map(({ label, available }) => (
                <label key={label} className={input.cacheAvailable === available ? styles.selectedSegment : undefined}>
                  <input type="radio" name={`${id}-cache-state`} checked={input.cacheAvailable === available}
                    onChange={() => updateInput({ cacheAvailable: available })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className={styles.capacityNote}>Example database capacity <strong>{reads(input.databaseCapacity)}</strong></p>
        </div>

        <div className={styles.system}>
          <div className={styles.application}>
            <Server size={19} aria-hidden="true" />
            <span>Application</span>
            <strong>{reads(input.requestsPerSecond)}</strong>
          </div>
          <div className={styles.branches}>
            <div className={`${styles.branch} ${!input.cacheAvailable ? styles.unavailable : ""}`}>
              <ArrowDown className={styles.pathArrow} size={17} aria-hidden="true" />
              <div className={styles.node}>
                <HardDrive size={18} aria-hidden="true" />
                <span className={styles.nodeName}>Cache</span>
                <strong>{revealed ? reads(model.cacheReads) : "? reads/s"}</strong>
                <span className={styles.nodeDetail}>{input.cacheAvailable ? "Served from cache" : "Unavailable · no hits"}</span>
              </div>
            </div>
            <div className={styles.branch}>
              <ArrowDown className={styles.pathArrow} size={17} aria-hidden="true" />
              <div className={`${styles.node} ${revealed && model.exceedsCapacity ? styles.overCapacity : ""}`}>
                <Database size={18} aria-hidden="true" />
                <span className={styles.nodeName}>Database</span>
                <strong>{revealed ? reads(model.databaseReads) : "? reads/s"}</strong>
                <span className={styles.nodeDetail}>Requested from database</span>
              </div>
            </div>
          </div>
          <p className={styles.pathCaption}>The application checks the cache and handles database reads on a miss or fallback.</p>
        </div>
      </div>

      {!revealed ? (
        <div className={styles.prediction}>
          <fieldset>
            <legend>With these settings, where will database demand land?</legend>
            <div className={styles.predictionChoices}>
              {[{ label: "Within the example capacity", value: "within" }, { label: "Above the example capacity", value: "above" }].map(({ label, value }) => (
                <label key={value}>
                  <input type="radio" name={`${id}-prediction`} value={value} checked={prediction === value}
                    onChange={() => setPrediction(value as Prediction)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.predictionActions}>
            <p id={`${id}-prediction-hint`}>Make a prediction to reveal the database load.</p>
            <button type="button" className={styles.reveal} disabled={!prediction} onClick={revealOutcome} aria-describedby={`${id}-prediction-hint`}>Reveal outcome</button>
          </div>
        </div>
      ) : (
        <div className={styles.outcome}>
          {predictionCorrect !== null ? (
            <p className={styles.predictionFeedback}>
              {predictionCorrect ? <Check size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
              {predictionCorrect ? "Your prediction matches the model." : "Compare your prediction with the read path."}
            </p>
          ) : null}
          <div className={styles.resultHeading}>
            <strong className={model.exceedsCapacity ? styles.overCapacityText : undefined}>{capacityLabel}</strong>
            <span>{format(model.capacityRatio * 100)}% of example capacity</span>
          </div>
          <div className={styles.capacityTrack} aria-hidden="true"><span style={{ width: `${Math.min(model.capacityRatio * 100, 100)}%` }} className={model.exceedsCapacity ? styles.excessFill : undefined} /></div>
          <p className={styles.formula}>
            {input.cacheAvailable
              ? `${format(input.requestsPerSecond)} × (1 − ${input.hitRatePercent}%) = ${reads(model.databaseReads)} at the database.`
              : `Cache unavailable: all ${reads(input.requestsPerSecond)} are requested from the database.`}
          </p>
          <p className={styles.explanation}>
            {!input.cacheAvailable ? `A healthy cache at ${input.hitRatePercent}% would leave ${reads(model.healthyDatabaseReads)} for the database. ` : `${reads(model.cacheReads)} are served from the cache. `}
            {model.exceedsCapacity
              ? `Demand is ${reads(model.excessReads)} above the example limit. Falling back to the database alone cannot absorb this workload within that limit.`
              : model.spareCapacity === 0
                ? "Demand exactly reaches the example limit, leaving no spare capacity for a burst."
                : `The database has ${reads(model.spareCapacity)} of spare capacity in this example.`}
          </p>
          <p className={styles.nextExperiment}>Try restoring the cache or changing the workload. In a real system, protect fallback with limits, tested spare capacity, or stale data where the product permits it.</p>
        </div>
      )}

      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {revealed ? `Database demand: ${reads(model.databaseReads)}. ${capacityLabel}. Example capacity: ${reads(input.databaseCapacity)}.` : ""}
      </span>
      <details className={styles.assumptions}>
        <summary>Model assumptions and source</summary>
        <ul>
          <li>Each request is a read. Each cache miss or fallback causes one database read request. The result shows demand, not completed reads.</li>
          <li>The hit rate is a steady-state average. An unavailable cache serves zero hits.</li>
          <li>The {reads(input.databaseCapacity)} limit is chosen for this exercise. It is not a measured database capacity or latency prediction.</li>
          <li>Writes, retries, request coalescing, queues, cache warmup, and the cost of individual queries are outside this model.</li>
        </ul>
        <p>Amazon describes how cache outages can surge traffic to dependencies and why fallback needs safeguards. <a href="https://aws.amazon.com/builders-library/caching-challenges-and-strategies/" target="_blank" rel="noreferrer">Read Caching challenges and strategies <span className={styles.srOnly}>(opens in a new tab)</span>↗</a></p>
      </details>
    </section>
  );
}
