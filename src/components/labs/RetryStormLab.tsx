"use client";

import { useId, useState } from "react";
import { RETRY_DEFAULTS, simulateRetries, type Backoff, type RetryResult } from "@/lib/labs/retry-storm";
import { type LabHeadingLevel, Assumptions, LabHeader, Prediction, Segments, Slider, useContainerWidth, useLabLink, useLabReveal, Verdict } from "./lab-shared";
import styles from "./Lab.module.css";

type Outcome = "quick" | "slow" | "stuck";
const QUICK_SECONDS = 60;
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const backoffs: { value: Backoff; label: string }[] = [
  { value: "none", label: "Immediate" },
  { value: "exponential", label: "Exponential" },
  { value: "jitter", label: "With jitter" },
];

const backoffWords: Record<Backoff, string> = {
  none: "immediately after a timeout",
  exponential: "waiting twice as long each time",
  jitter: "with randomized, growing waits",
};

function outcomeOf(result: RetryResult): Outcome {
  if (result.recoveryAfter === null) return "stuck";
  return result.recoveryAfter <= QUICK_SECONDS ? "quick" : "slow";
}

function linePath(values: number[], x: (index: number) => number, y: (value: number) => number) {
  return values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join("");
}

function RetryChart({ result }: { result: RetryResult }) {
  const { ref, width } = useContainerWidth(640);
  const [hover, setHover] = useState<number | null>(null);
  const height = 250;
  const showLabels = width >= 480;
  const margin = { top: 12, right: showLabels ? 104 : 12, bottom: 26, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const { ticks } = result;
  const top = Math.max(...ticks.map((tick) => Math.max(tick.offered, tick.capacity)), 1) * 1.08;
  const tickStep = [50, 100, 200, 250, 500, 1000, 2000].find((step) => top / step <= 5) ?? 5000;
  const roundedTop = Math.ceil(top / tickStep) * tickStep;
  const x = (index: number) => margin.left + (index / (ticks.length - 1)) * innerWidth;
  const y = (value: number) => margin.top + innerHeight - (value / roundedTop) * innerHeight;
  const gridValues = Array.from({ length: Math.round(roundedTop / tickStep) + 1 }, (_, index) => index * tickStep);
  const last = ticks[ticks.length - 1];
  const hovered = hover === null ? null : ticks[hover];
  let workLabel = y(last.goodput), offeredLabel = y(last.offered);
  if (Math.abs(workLabel - offeredLabel) < 16) {
    if (workLabel >= offeredLabel) workLabel = offeredLabel + 16; else offeredLabel = workLabel + 16;
  }
  const clampIndex = (value: number) => Math.min(ticks.length - 1, Math.max(0, value));
  return <div ref={ref} className={styles.chart}>
    <ul className={styles.legend}>
      <li><span className={styles.key} style={{ background: "var(--series-work)" }} /> Successful work</li>
      <li><span className={styles.key} style={{ background: "var(--series-offered)" }} /> Offered load, with retries</li>
      <li><span className={styles.keyDashed} /> Capacity</li>
    </ul>
    <p className={styles.axisCaption}>Requests per second</p>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" tabIndex={0}
      aria-label={`Requests per second over ${ticks.length} seconds. ${result.recoveryAfter === null ? "Successful work does not recover after the outage." : `Successful work recovers ${result.recoveryAfter} seconds after the outage ends.`} Use the left and right arrow keys to read values.`}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setHover(clampIndex(Math.round(((event.clientX - bounds.left - margin.left) / innerWidth) * (ticks.length - 1))));
      }}
      onPointerLeave={() => setHover(null)}
      onBlur={() => setHover(null)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        setHover((current) => clampIndex((current ?? result.outageEnd) + (event.key === "ArrowRight" ? 5 : -5)));
      }}>
      <rect className={styles.outageBand} x={x(result.outageStart)} y={margin.top} width={Math.max(0, x(result.outageEnd) - x(result.outageStart))} height={innerHeight} />
      {result.outageEnd > result.outageStart ? <text className={styles.axisText} x={x(result.outageStart) + 4} y={margin.top + 12}>Outage</text> : null}
      {gridValues.map((value) => <g key={value}>
        <line className={styles.gridLine} x1={margin.left} x2={margin.left + innerWidth} y1={y(value)} y2={y(value)} />
        <text className={styles.axisText} x={margin.left - 7} y={y(value) + 4} textAnchor="end">{number.format(value)}</text>
      </g>)}
      {[0, 60, 120, 180, 239].map((tick) => <text key={tick} className={styles.axisText} x={x(tick)} y={height - 8} textAnchor={tick === 239 ? "end" : tick === 0 ? "start" : "middle"}>{tick === 239 ? "240 s" : `${tick} s`}</text>)}
      <path className={styles.capacityLine} d={linePath(ticks.map((tick) => tick.capacity), x, y)} />
      <path className={styles.offeredLine} d={linePath(ticks.map((tick) => tick.offered), x, y)} />
      <path className={styles.workLine} d={linePath(ticks.map((tick) => tick.goodput), x, y)} />
      {showLabels ? <>
        <text className={styles.seriesLabel} x={margin.left + innerWidth + 8} y={workLabel + 4}>Successful</text>
        <text className={styles.seriesLabel} x={margin.left + innerWidth + 8} y={offeredLabel + 4}>Offered</text>
      </> : null}
      {hover !== null ? <line className={styles.crosshair} x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + innerHeight} /> : null}
    </svg>
    {hovered ? <div className={styles.tooltip} style={x(hover!) > width / 2 ? { right: width - x(hover!) + 10 } : { left: x(hover!) + 10 }}>
      <span>{hovered.time} seconds</span>
      <span className={styles.tooltipRow}><span className={styles.key} style={{ background: "var(--series-work)" }} /><strong>{number.format(hovered.goodput)}/s</strong> successful</span>
      <span className={styles.tooltipRow}><span className={styles.key} style={{ background: "var(--series-offered)" }} /><strong>{number.format(hovered.offered)}/s</strong> offered</span>
      <span className={styles.tooltipRow}><span className={styles.keyDashed} /><strong>{number.format(hovered.capacity)}/s</strong> capacity</span>
      <span><strong>{number.format(hovered.queue)}</strong> queued</span>
    </div> : null}
    <details className={styles.tableDetails}>
      <summary>Show these values as a table</summary>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th scope="col">Time</th><th scope="col">Offered/s</th><th scope="col">Successful/s</th><th scope="col">Wasted/s</th><th scope="col">Capacity/s</th><th scope="col">Queued</th></tr></thead>
        <tbody>{ticks.filter((tick) => tick.time % 20 === 0).map((tick) => <tr key={tick.time}>
          <td>{tick.time} s</td><td>{number.format(tick.offered)}</td><td>{number.format(tick.goodput)}</td><td>{number.format(tick.wasted)}</td><td>{number.format(tick.capacity)}</td><td>{number.format(tick.queue)}</td>
        </tr>)}</tbody>
      </table></div>
    </details>
  </div>;
}

export function RetryStormLab({ standalone = false, headingLevel = 2, title = "When retries keep a service down" }: { standalone?: boolean; headingLevel?: LabHeadingLevel; title?: string }) {
  const id = useId();
  const [input, setInput] = useState(RETRY_DEFAULTS);
  const [prediction, setPrediction] = useState<Outcome | null>(null);
  const [predictedFor, setPredictedFor] = useState("");
  const { revealed, setRevealed, reveal } = useLabReveal("retry-storm");
  const update = (patch: Partial<typeof RETRY_DEFAULTS>) => setInput((current) => ({ ...current, ...patch }));
  const query = `retries=${input.maxRetries}&backoff=${input.backoff}&outage=${input.outageSeconds}&capacity=${input.capacity}${input.retryBudget ? "&budget=1" : ""}${input.shedExpired ? "&shed=1" : ""}`;
  const link = useLabLink("retry-storm", standalone, query, (params) => {
    const retries = Number(params.get("retries"));
    const outage = Number(params.get("outage"));
    const capacity = Number(params.get("capacity"));
    const backoff = params.get("backoff");
    update({
      ...(params.has("retries") && retries >= 0 && retries <= 5 ? { maxRetries: Math.round(retries) } : {}),
      ...(outage >= 5 && outage <= 60 ? { outageSeconds: Math.round(outage / 5) * 5 } : {}),
      ...(capacity >= 110 && capacity <= 300 ? { capacity: Math.round(capacity / 10) * 10 } : {}),
      ...(backoffs.some((item) => item.value === backoff) ? { backoff: backoff as Backoff } : {}),
      retryBudget: params.get("budget") === "1",
      shedExpired: params.get("shed") === "1",
    });
  });

  const result = simulateRetries(input);
  const outcome = outcomeOf(result);
  const correct = revealed && predictedFor === query && prediction ? prediction === outcome : null;
  const controlPanel = (
    <div className={styles.controls}>
      <Slider id={`${id}-retries`} label="Retries per request" value={input.maxRetries} display={String(input.maxRetries)} min={0} max={5} step={1} onChange={(maxRetries) => update({ maxRetries })} />
      <Slider id={`${id}-outage`} label="Outage length" value={input.outageSeconds} display={`${input.outageSeconds} s`} min={5} max={60} step={5} onChange={(outageSeconds) => update({ outageSeconds })} />
      <Slider id={`${id}-capacity`} label="Healthy capacity" value={input.capacity} display={`${input.capacity}/s`} min={110} max={300} step={10} onChange={(capacity) => update({ capacity })} hint={`${Math.round((input.arrivalRate / input.capacity) * 100)}% utilized when healthy.`} />
      <Segments legend="Backoff between retries" name={`${id}-backoff`} options={backoffs} value={input.backoff} onChange={(backoff) => update({ backoff })} />
      <fieldset className={styles.toggles}>
        <legend>Protections</legend>
        <label><input type="checkbox" checked={input.retryBudget} onChange={(event) => update({ retryBudget: event.target.checked })} /> Retry budget: retries limited to 10% of traffic</label>
        <label><input type="checkbox" checked={input.shedExpired} onChange={(event) => update({ shedExpired: event.target.checked })} /> Drop queued work whose client already gave up</label>
      </fieldset>
    </div>
  );

  return <section className={styles.lab} aria-labelledby={`${id}-heading`}>
    <LabHeader id={`${id}-heading`} headingLevel={headingLevel} title={title} link={link} actions={standalone || revealed}
      intro={`A service handling ${input.arrivalRate} requests per second loses most of its capacity for ${input.outageSeconds} seconds, then the capacity comes back. Clients give up after 5 seconds and retry. Predict whether it recovers.`}
      onReset={() => { setInput(RETRY_DEFAULTS); setPrediction(null); setRevealed(false); setPredictedFor(""); }} />

    {!revealed ? <>
      <p className={styles.scenarioLine}>Each client retries up to <strong>{input.maxRetries} {input.maxRetries === 1 ? "time" : "times"}</strong>, {backoffWords[input.backoff]}. Healthy capacity is <strong>{input.capacity} requests per second</strong>, so the service is comfortably keeping up before the outage.</p>
      <details className={styles.setup}>
        <summary>Change the setup</summary>
        {controlPanel}
      </details>
    </> : null}

    {!revealed ? <Prediction<Outcome> name={`${id}-prediction`} value={prediction} onChange={setPrediction}
      legend="Once the outage ends and capacity is back, what happens?"
      options={[
        { value: "quick", label: "Recovers within a minute" },
        { value: "slow", label: "Recovers, but slowly" },
        { value: "stuck", label: "Stays overloaded" },
      ]}
      onReveal={() => { setPredictedFor(query); reveal(); }} /> : <div className={styles.results}>
        <Verdict correct={correct}>
          {result.recoveryAfter === null
            ? "The outage ended, but the service never came back in this run. Retries and work nobody is waiting for keep it saturated."
            : result.recoveryAfter === 0
              ? "Successful work came back as soon as capacity did. The outage hurt while it lasted, but it didn’t outlive itself."
              : `Successful work returned ${result.recoveryAfter} seconds after capacity did.`}
        </Verdict>
        <dl className={styles.stats}>
          <div><dt>Attempts per request</dt><dd>{result.amplification.toFixed(1)}</dd></div>
          <div><dt>Requests served in time</dt><dd>{Math.round(result.successShare * 100)}%</dd></div>
          <div><dt>Longest queue</dt><dd>{number.format(result.peakQueue)}</dd></div>
        </dl>
        <RetryChart result={result} />
        <p className={styles.explain}>
          {result.recoveryAfter === null
            ? "Capacity alone doesn’t fix this: the service is now doing work for clients who have already timed out, and those timeouts produce more retries. This self-sustaining overload is sometimes called a metastable failure. Try jitter, a retry budget, or dropping expired work, and see which one actually breaks the loop."
            : "Compare this with immediate retries and no protections. A brief outage only becomes a long one when the system’s response to failure adds more load than it removes."}
        </p>
        <h3 className={styles.tryNext}>Now try to fix it</h3>
        {controlPanel}
      </div>}

    <Assumptions items={[
      "This is a simplified queue stepped once per simulated second, in one queue served first-in, first-out. It answers “does it recover, and roughly how?”, not “what will the latency be?”.",
      "Capacity falls to 20% during the outage. The 5-second client timeout is fixed.",
      "A timed-out request stays in the queue and still uses capacity unless dropped, and that is what makes the failure self-sustaining.",
      "Real systems add thread pools, connection limits, and autoscaling, which change the numbers. The shape of the failure is what carries over.",
    ]}>
      <p>For a real-world write-up of this failure mode, see Amazon’s <a href="https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/" rel="noreferrer">Timeouts, retries, and backoff with jitter</a>.</p>
    </Assumptions>
  </section>;
}
