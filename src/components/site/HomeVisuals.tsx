import { modelCacheReads } from "@/lib/cache-model";
import { modelQuorum } from "@/lib/labs/quorum";
import { limiterAlgorithms, runLimiters } from "@/lib/labs/rate-limiter";
import { RETRY_DEFAULTS, simulateRetries } from "@/lib/labs/retry-storm";
import styles from "./HomeVisuals.module.css";

// Small charts for the home page. Each lab's chart runs that lab's own model with its usual settings, so the shape
// is what the lab really shows. They draw themselves while on screen, and sit finished without motion or JavaScript.

const round = (value: number) => Math.round(value * 10) / 10;
const line = (points: [number, number][]) => points.map(([x, y], index) => `${index ? "L" : "M"}${round(x)} ${round(y)}`).join("");

export function RetryChart() {
  const { ticks } = simulateRetries(RETRY_DEFAULTS);
  const width = 300;
  const height = 120;
  const tallest = Math.max(...ticks.map((tick) => tick.offered));
  const x = (time: number) => (time / ticks[ticks.length - 1].time) * width;
  const y = (value: number) => height - 4 - (value / tallest) * (height - 12);
  const sampled = ticks.filter((_, index) => index % 6 === 0);
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="After a short outage, retries push offered load far above capacity and stay there, while successful work falls away.">
    <path className={styles.reference} d={`M0 ${y(ticks[0].capacity)}H${width}`} />
    <path className={`${styles.draw} ${styles.ink}`} pathLength={1} d={line(sampled.map((tick) => [x(tick.time), y(tick.goodput)]))} />
    <path className={`${styles.draw} ${styles.hot}`} pathLength={1} d={line(sampled.map((tick) => [x(tick.time), y(tick.offered)]))} />
  </svg>;
}

export function LimiterChart() {
  const limit = 100;
  const { results } = runLimiters({ limit, windowSeconds: 60, traffic: "edge-burst" });
  const width = 300;
  const height = 120;
  const tallest = Math.max(...results.map((result) => result.peakInWindow), limit);
  const y = (count: number) => (count / tallest) * (height - 8);
  const barWidth = 34;
  const gap = (width - barWidth * results.length) / (results.length + 1);
  const over = results.filter((result) => result.peakInWindow > limit).map((result) => limiterAlgorithms.find(({ id }) => id === result.algorithm)?.name).join(" and ");
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`The most requests each of four rate limiting algorithms lets through in one window, given the same burst. ${over} go${over.includes(" and ") ? "" : "es"} over the limit.`}>
    {results.map((result, index) => {
      const x = gap + index * (barWidth + gap);
      const within = y(Math.min(result.peakInWindow, limit));
      const beyond = y(Math.max(0, result.peakInWindow - limit));
      return <g key={result.algorithm} className={styles.bar} style={{ "--i": index * 4 } as React.CSSProperties}>
        <rect className={styles.barFront} x={round(x)} y={round(height - within)} width={barWidth} height={round(within)} rx={2} />
        {beyond > 0 ? <rect className={styles.barOver} x={round(x)} y={round(height - within - beyond)} width={barWidth} height={round(beyond)} rx={2} /> : null}
      </g>;
    })}
    <path className={styles.reference} d={`M0 ${round(height - y(limit))}H${width}`} />
  </svg>;
}

export function QuorumChart() {
  // Three replicas take the write and a read asks two: with nothing forcing them to overlap, it can miss the write.
  const n = 5;
  const { holders, overlap } = modelQuorum({ n, w: 3, r: 2, down: [] });
  const center = { x: 150, y: 60 };
  const place = (index: number) => {
    const angle = (index / n) * Math.PI * 2 - Math.PI / 2;
    return { x: center.x + Math.cos(angle) * 84, y: center.y + Math.sin(angle) * 46 };
  };
  const missed = Array.from({ length: n }, (_, index) => index).filter((index) => !holders.includes(index));
  return <svg className={styles.chart} viewBox="0 0 300 120" role="img" aria-label={`Five replicas. A write reaches three, and a read asks the other two${overlap ? "" : ", so it misses the write"}.`}>
    <g className={styles.quorumWrite}>{holders.map((index) => <path key={index} className={styles.wire} d={`M${center.x} ${center.y}L${round(place(index).x)} ${round(place(index).y)}`} />)}</g>
    <g className={styles.quorumRead}>{missed.map((index) => <path key={index} className={styles.wireHot} d={`M${center.x} ${center.y}L${round(place(index).x)} ${round(place(index).y)}`} />)}</g>
    <circle className={styles.quorumCenter} cx={center.x} cy={center.y} r={4} />
    {Array.from({ length: n }, (_, index) => <circle key={index} className={holders.includes(index) ? styles.replicaHolder : styles.replicaMiss} cx={round(place(index).x)} cy={round(place(index).y)} r={10} />)}
  </svg>;
}

export function CacheChart() {
  const workload = { requestsPerSecond: 10_000, hitRatePercent: 90, databaseCapacity: 3_000 };
  const healthy = modelCacheReads({ ...workload, cacheAvailable: true });
  const gone = modelCacheReads({ ...workload, cacheAvailable: false });
  const height = 120;
  const y = (value: number) => (value / gone.databaseReads) * (height - 10);
  const capacity = height - y(workload.databaseCapacity);
  return <svg className={styles.chart} viewBox={`0 0 300 ${height}`} role="img" aria-label="With the cache up, the database sits well under its capacity. When the cache goes, demand jumps to more than three times what it can take.">
    <circle className={styles.cacheDot} cx={46} cy={66} r={16} />
    <path className={styles.cacheStroke} d="M62 66H118" />
    <rect className={styles.cacheFull} x={168} y={height - y(gone.databaseReads)} width={60} height={y(gone.databaseReads)} rx={3} />
    <rect className={styles.cacheQuiet} x={168} y={height - y(healthy.databaseReads)} width={60} height={y(healthy.databaseReads)} rx={3} />
    <path className={styles.reference} d={`M132 ${round(capacity)}H264`} />
  </svg>;
}

const REVIEW_GAPS = [1, 3, 7, 14, 30]; // The same intervals review.ts schedules.
const STABILITY = [1.2, 3, 8, 18, 40, 90];

export function ForgettingChart() {
  const width = 520;
  const height = 330;
  const top = 12;
  const bottom = 30;
  const lastDay = 70;
  const x = (day: number) => Math.sqrt(day / lastDay) * (width - 16) + 8;
  const y = (kept: number) => top + (1 - kept) * (height - top - bottom);
  const reviews = REVIEW_GAPS.reduce<number[]>((days, gap) => [...days, days[days.length - 1] + gap], [0]);
  const stretches = reviews.map((start, index) => ({ start, end: reviews[index + 1] ?? lastDay, hold: STABILITY[index] }));
  const curve = stretches.flatMap(({ start, end, hold }) => Array.from({ length: 9 }, (_, step): [number, number] => {
    const day = start + ((end - start) * step) / 8;
    return [x(day), y(Math.exp(-(day - start) / hold))];
  }));
  const unreviewed = Array.from({ length: 14 }, (_, step): [number, number] => {
    const day = (lastDay * step * step) / (13 * 13);
    return [x(day), y(Math.exp(-day / STABILITY[0]))];
  });
  return <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="An illustration of memory fading. Without review it falls away within days. Each review at 1, 3, 7, 14, and 30 days brings it back, and it fades more slowly each time.">
    <path className={styles.reference} d={line(unreviewed)} />
    <text className={styles.chartNote} x={width - 8} y={y(0) - 10}>Without review</text>
    <path className={`${styles.drawOnce} ${styles.ink}`} pathLength={1} d={line(curve)} />
    {reviews.slice(1).map((day, index) => <g key={day} className={styles.reviewPoint} style={{ "--at": `${(x(day) / width) * 3.2}s` } as React.CSSProperties}>
      <circle cx={round(x(day))} cy={y(1)} r={4.5} />
      <text x={round(x(day))} y={height - 6}>{REVIEW_GAPS[index]}d</text>
    </g>)}
  </svg>;
}

export function DesignChart({ minutes }: { minutes: number }) {
  const box = (x: number, y: number, label: string, className: string) => <g className={className}>
    <rect x={x} y={y} width={88} height={44} rx={10} />
    <text x={x + 44} y={y + 27}>{label}</text>
  </g>;
  return <svg className={styles.chart} viewBox="0 0 440 180" role="img" aria-label={`A ${minutes}-minute timer runs while a design grows from client to API to storage, until a new requirement arrives and adds a queue.`}>
    <g className={styles.timer}>
      <circle className={styles.timerTrack} cx={58} cy={90} r={54} />
      <circle className={styles.timerRun} cx={58} cy={90} r={54} pathLength={1} />
      <text className={styles.timerValue} x={58} y={96}>{minutes}</text>
      <text className={styles.timerUnit} x={58} y={114}>minutes</text>
    </g>
    {box(132, 24, "Client", styles.sketch1)}
    <path className={`${styles.sketch2} ${styles.sketchLine}`} d="M220 46H238" />
    {box(238, 24, "API", styles.sketch2)}
    <path className={`${styles.sketch3} ${styles.sketchLine}`} d="M326 46H344" />
    {box(344, 24, "Storage", styles.sketch3)}
    <path className={`${styles.sketch4} ${styles.sketchLineHot}`} d="M282 68V112" />
    {box(238, 112, "Queue", `${styles.sketch4} ${styles.sketchHot}`)}
    <text className={`${styles.sketch4} ${styles.sketchTag}`} x={338} y={131}>New</text>
    <text className={`${styles.sketch4} ${styles.sketchTag}`} x={338} y={148}>requirement</text>
  </svg>;
}
