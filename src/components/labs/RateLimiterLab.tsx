"use client";

import { useId, useState } from "react";
import { histogram, limiterAlgorithms, runLimiters, type LimiterAlgorithm, type TrafficShape } from "@/lib/labs/rate-limiter";
import { Assumptions, LabHeader, Prediction, Segments, Slider, useContainerWidth, useLabLink, useLabReveal, Verdict } from "./lab-shared";
import styles from "./Lab.module.css";

const BUCKETS = 60;
const defaults = { limit: 100, windowSeconds: 60, traffic: "edge-burst" as TrafficShape };
const shapes: { value: TrafficShape; label: string }[] = [
  { value: "edge-burst", label: "Burst at a boundary" },
  { value: "spike", label: "Sudden spike" },
  { value: "steady", label: "Steady overload" },
];
const shapeWords: Record<TrafficShape, string> = {
  "edge-burst": "a full allowance just before a window boundary, then another just after it",
  spike: "background traffic plus a one-second burst of three times the limit",
  steady: "constant traffic at one and a half times the limit",
};
const costs: Record<LimiterAlgorithm, string> = {
  "fixed-window": "It stores one counter per key, the cheapest option, but a boundary lets twice the limit through in a short span.",
  "sliding-log": "It is exact, but it keeps a timestamp for every admitted request, which gets expensive at high limits.",
  "sliding-counter": "It stores two counters and estimates the rest, so it is cheap and close to exact when traffic is fairly even.",
  "token-bucket": "It stores a token count and a time, and it allows a burst up to the bucket size by design. That is often what you want.",
};

function Bars({ arrivals, admitted, span, windowMs, width, tallest }: {
  arrivals: number[]; admitted?: number[]; span: number; windowMs: number; width: number; tallest: number;
}) {
  const height = 46;
  const gap = width < 420 ? 1 : 2;
  const barWidth = Math.max(1, width / BUCKETS - gap);
  const x = (index: number) => (index * width) / BUCKETS;
  const y = (count: number) => (count / tallest) * (height - 2);
  const coming = histogram(arrivals, 0, span, BUCKETS);
  const passing = admitted ? histogram(admitted, 0, span, BUCKETS) : null;
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    {[1, 2].map((boundary) => {
      const position = ((boundary * windowMs) / span) * width;
      return <line key={boundary} className={styles.boundary} x1={position} x2={position} y1={0} y2={height} />;
    })}
    {coming.map((count, index) => count ? <rect key={`a${index}`} className={styles.arrivalBar} x={x(index)} width={barWidth} y={height - y(count)} height={y(count)} rx={1} /> : null)}
    {passing?.map((count, index) => count ? <rect key={`p${index}`} className={styles.admittedBar} x={x(index)} width={barWidth} y={height - y(count)} height={y(count)} rx={1} /> : null)}
  </svg>;
}

export function RateLimiterLab({ standalone = false, headingLevel = 2 }: { standalone?: boolean; headingLevel?: 1 | 2 }) {
  const id = useId();
  const [limit, setLimit] = useState(defaults.limit);
  const [windowSeconds, setWindowSeconds] = useState(defaults.windowSeconds);
  const [traffic, setTraffic] = useState(defaults.traffic);
  const [prediction, setPrediction] = useState<LimiterAlgorithm | null>(null);
  const [predictedFor, setPredictedFor] = useState("");
  const { revealed, setRevealed, reveal } = useLabReveal("rate-limiters");
  const { ref, width } = useContainerWidth(640);
  const query = `limit=${limit}&window=${windowSeconds}&traffic=${traffic}`;
  const link = useLabLink("rate-limiters", standalone, query, (params) => {
    const nextLimit = Number(params.get("limit"));
    const nextWindow = Number(params.get("window"));
    const nextTraffic = params.get("traffic");
    if (nextLimit >= 20 && nextLimit <= 300) setLimit(Math.round(nextLimit / 10) * 10);
    if ([10, 30, 60].includes(nextWindow)) setWindowSeconds(nextWindow);
    if (shapes.some((shape) => shape.value === nextTraffic)) setTraffic(nextTraffic as TrafficShape);
  });

  const { arrivals, results } = runLimiters({ limit, windowSeconds, traffic });
  const windowMs = windowSeconds * 1000;
  const span = windowMs * 3;
  const tallest = Math.max(...histogram(arrivals, 0, span, BUCKETS), 1);
  const highest = Math.max(...results.map((result) => result.peakInWindow));
  const leaders = results.filter((result) => result.peakInWindow === highest);
  const leaderNames = leaders.map((leader) => limiterAlgorithms.find((item) => item.id === leader.algorithm)!.name);
  const stillPredicted = predictedFor === query;
  const correct = revealed && stillPredicted && prediction ? leaders.some((leader) => leader.algorithm === prediction) : null;

  return <section className={styles.lab} aria-labelledby={`${id}-heading`}>
    <LabHeader id={`${id}-heading`} headingLevel={headingLevel} title="Which rate limiter lets the burst through?" link={link}
      intro="Four common algorithms, all given the same limit and the same traffic. Every request below is really run through each algorithm, so what you see is what it would do."
      onReset={() => { setLimit(defaults.limit); setWindowSeconds(defaults.windowSeconds); setTraffic(defaults.traffic); setPrediction(null); setRevealed(false); setPredictedFor(""); }} />

    <div className={styles.controls}>
      <Segments legend="Traffic" name={`${id}-traffic`} options={shapes} value={traffic} onChange={setTraffic} />
      <Slider id={`${id}-limit`} label="Limit" value={limit} min={20} max={300} step={10} onChange={setLimit} display={`${limit} requests`} />
      <Segments legend="Per window of" name={`${id}-window`} value={String(windowSeconds) as "10" | "30" | "60"} onChange={(value) => setWindowSeconds(Number(value))}
        options={[{ value: "10", label: "10 s" }, { value: "30", label: "30 s" }, { value: "60", label: "60 s" }]} />
    </div>

    <div ref={ref} className={styles.results} style={{ borderTop: 0, paddingTop: 0 }}>
      <div className={styles.multipleLabel}>Requests arriving <span>{arrivals.length} requests: {shapeWords[traffic]}</span></div>
      <Bars arrivals={arrivals} span={span} windowMs={windowMs} width={width} tallest={tallest} />
    </div>

    {!revealed ? <Prediction<LimiterAlgorithm> name={`${id}-prediction`} value={prediction} onChange={setPrediction}
      legend={`Which algorithm lets the most requests through inside any one ${windowSeconds}-second span?`}
      options={limiterAlgorithms.map((item) => ({ value: item.id, label: item.name }))}
      onReveal={() => { setPredictedFor(query); reveal(); }} /> : <div className={styles.results}>
        <Verdict correct={correct}>
          {leaderNames.join(" and ")} let {highest} requests through in one {windowSeconds}-second span{highest > limit ? `, ${(highest / limit).toFixed(1)} times the limit of ${limit}` : `, within the limit of ${limit}`}.
        </Verdict>
        <ul className={styles.legend}>
          <li><span className={styles.key} style={{ height: 8, background: "var(--arrivals)" }} /> Rejected</li>
          <li><span className={styles.key} style={{ height: 8, background: "var(--series-work)" }} /> Admitted</li>
          <li><span className={styles.keyDashed} style={{ borderTopWidth: 1, borderColor: "var(--line-strong)" }} /> Window boundary</li>
        </ul>
        <div className={styles.multiples}>
          {results.map((result) => {
            const item = limiterAlgorithms.find((entry) => entry.id === result.algorithm)!;
            return <div key={result.algorithm}>
              <div className={styles.multipleLabel}>{item.name} <span>peak {result.peakInWindow} in any window</span></div>
              <Bars arrivals={arrivals} admitted={result.allowed} span={span} windowMs={windowMs} width={width} tallest={tallest} />
            </div>;
          })}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Algorithm</th><th scope="col">Admitted</th><th scope="col">Rejected</th><th scope="col">Peak in any window</th><th scope="col">Against the limit</th></tr></thead>
            <tbody>{results.map((result) => <tr key={result.algorithm}>
              <td>{limiterAlgorithms.find((entry) => entry.id === result.algorithm)!.name}</td>
              <td>{result.allowed.length}</td><td>{result.rejected}</td><td>{result.peakInWindow}</td><td>{(result.peakInWindow / limit).toFixed(2)}×</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className={styles.explain}>{leaders.map((leader) => costs[leader.algorithm]).join(" ")} Change the traffic and watch which algorithm leads. There is no single winner: the right choice depends on whether you are protecting a fragile service or just being fair to callers.</p>
      </div>}

    <Assumptions items={[
      "Each request costs one unit and arrives at an exact, repeatable time, with no randomness.",
      "A single limiter sees every request. A real distributed limiter also has to keep shared counters correct under concurrency.",
      "The token bucket holds as many tokens as the limit and refills at the limit divided by the window. Other sizes change how large a burst it allows.",
      "“Peak in any window” is the most requests admitted in any span one window long, which is what the protected service experiences.",
    ]} />
  </section>;
}
