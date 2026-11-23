import { retryFix, type HomeFix } from "@/content/home-fixes";
import { RETRY_DEFAULTS, type RetryResult } from "@/lib/labs/retry-storm";
import styles from "./HomeFixes.module.css";

// Pictures for the home page's "Every lesson fixes something" tiles. Each one draws a lesson's own worked example:
// first what goes wrong, in the labs' orange, then the lesson's fix, in ink. Drawn finished, they show the fix with a
// faint trace of the problem, which is how they sit without JavaScript, with reduced motion, and once they've played.

const round = (value: number) => Math.round(value * 10) / 10;
const line = (points: [number, number][]) => points.map(([x, y], index) => `${index ? "L" : "M"}${round(x)} ${round(y)}`).join("");

function Box({ x, y, width, label, className = "" }: { x: number; y: number; width: number; label: string; className?: string }) {
  return <g className={`${styles.box} ${className}`}>
    <rect x={x} y={y} width={width} height={34} rx={10} />
    <text x={x + width / 2} y={y + 21.5}>{label}</text>
  </g>;
}

function EdgePicture() {
  const far = "M41 104C92 52 160 30 226 33";
  return <svg className={styles.picture} viewBox="0 8 320 140" role="img" aria-label="A visitor in Sydney waits about 200 milliseconds for each round trip to a server in Virginia. An edge server nearby answers in about 20.">
    <path className={`${styles.wire} ${styles.ghost}`} strokeDasharray="3 5" d={far} />
    <path className={`${styles.wire} ${styles.hotLine} ${styles.hotDraw}`} pathLength={1} d={far} />
    <Box x={226} y={16} width={86} label="Virginia" />
    <path className={`${styles.wire} ${styles.draw}`} pathLength={1} d="M41 110H96" />
    <Box x={96} y={93} width={70} label="Edge" className={styles.pop} />
    <circle className={styles.dot} cx={34} cy={110} r={7} />
    <text className={styles.label} x={34} y={140}>Sydney</text>
  </svg>;
}

function WalletPicture() {
  const first = "M94 39C150 39 158 66 214 68";
  const second = "M94 111C150 111 158 84 214 82";
  return <svg className={styles.picture} viewBox="0 12 320 126" role="img" aria-label="Two payments, 30 and 50 dollars, leave a wallet that holds 100. If both read 100 at once, one is lost and the balance shows 50. When the second waits for the first, it shows 20.">
    <path className={`${styles.wire} ${styles.hotLine} ${styles.hotDraw}`} pathLength={1} d={first} />
    <path className={`${styles.wire} ${styles.hotLine} ${styles.hotDraw}`} pathLength={1} d={second} />
    <text className={`${styles.hotText} ${styles.hotShow}`} x={150} y={79}>both read $100</text>
    <path className={`${styles.wire} ${styles.draw}`} pathLength={1} d={first} />
    <path className={`${styles.wire} ${styles.drawLate}`} pathLength={1} d={second} />
    <Box x={8} y={22} width={86} label="−$30" />
    <Box x={8} y={94} width={86} label="−$50" />
    <g className={styles.box}>
      <rect x={214} y={52} width={98} height={46} rx={12} />
      <text x={263} y={79.5}>Wallet</text>
    </g>
    <rect className={`${styles.hotLine} ${styles.hotShowLate}`} x={214} y={52} width={98} height={46} rx={12} fill="none" strokeWidth={2} />
    <g className={`${styles.pill} ${styles.pop}`}>
      <rect x={128} y={87} width={52} height={20} rx={10} />
      <text x={154} y={101}>waits</text>
    </g>
  </svg>;
}

function RetriesPicture({ before, after }: { before: RetryResult; after: RetryResult }) {
  const width = 320;
  const top = 18;
  const bottom = 112;
  const end = before.ticks[before.ticks.length - 1].time;
  const tallest = Math.max(...[...before.ticks, ...after.ticks].map((tick) => tick.goodput), RETRY_DEFAULTS.arrivalRate);
  const x = (time: number) => (time / end) * width;
  const y = (value: number) => bottom - (value / tallest) * (bottom - top);
  const path = (result: RetryResult) => line(result.ticks.filter((tick, index) => index % 3 === 0 || tick.time === end).map((tick) => [x(tick.time), y(tick.goodput)]));
  const lastBefore = y(before.ticks[before.ticks.length - 1].goodput);
  const lastAfter = y(after.ticks[after.ticks.length - 1].goodput);
  const band = { from: x(before.outageStart), to: x(before.outageEnd) };
  return <svg className={styles.picture} viewBox="0 4 320 140" role="img" aria-label={`Requests served over four minutes. After a ${before.outageEnd - before.outageStart}-second outage, clients that retry at once keep the service down. With backoff, jitter, and a retry budget it recovers ${after.recoveryAfter} seconds later.`}>
    <rect className={styles.band} x={round(band.from)} y={top - 6} width={round(band.to - band.from)} height={bottom - top + 6} />
    <text className={styles.label} x={round((band.from + band.to) / 2)} y={136}>outage</text>
    <path className={styles.axis} d={`M0 ${bottom}H${width}`} />
    <path className={`${styles.wire} ${styles.ghost}`} strokeDasharray="3 5" d={path(before)} />
    <path className={`${styles.wire} ${styles.hotLine} ${styles.hotDraw}`} pathLength={1} d={path(before)} />
    <text className={`${styles.label} ${styles.end} ${styles.hotText} ${styles.hotShowLate}`} x={width} y={round(lastBefore - 9)}>stays down</text>
    <text className={`${styles.label} ${styles.end} ${styles.ghost}`} x={width} y={round(lastBefore - 9)}>stays down</text>
    <path className={`${styles.wire} ${styles.draw}`} pathLength={1} d={path(after)} />
    <text className={`${styles.label} ${styles.end} ${styles.fixIn}`} x={width} y={round(lastAfter + 19)}>recovers</text>
  </svg>;
}

function UploadPicture() {
  const bar = { x: 8, y: 46, width: 304, height: 24 };
  const drop = bar.x + bar.width * 0.75; // The connection drops after part 150 of 200.
  return <svg className={styles.picture} viewBox="0 10 320 96" role="img" aria-label="A 2 GB video goes up in 200 parts, and the connection drops after part 150. A plain upload starts again from nothing. A resumable one keeps the 150 parts and sends only the last 50, 500 MB.">
    <defs><clipPath id="home-upload-bar"><rect {...bar} rx={7} /></clipPath></defs>
    <text className={`${styles.label} ${styles.start}`} x={bar.x} y={28}>2 GB video</text>
    <g clipPath="url(#home-upload-bar)">
      <rect className={styles.track} {...bar} />
      <rect className={`${styles.ghost} ${styles.kept}`} x={bar.x} y={bar.y} width={drop - bar.x} height={bar.height} />
      <rect className={`${styles.resent} ${styles.grow}`} x={drop} y={bar.y} width={bar.x + bar.width - drop} height={bar.height} />
      <rect className={styles.uploadHot} {...bar} />
    </g>
    <path className={`${styles.marker} ${styles.fixIn}`} d={`M${drop} ${bar.y - 8}V${bar.y + bar.height + 8}`} />
    <path className={`${styles.marker} ${styles.hotLine} ${styles.hotShowLate}`} d={`M${drop} ${bar.y - 8}V${bar.y + bar.height + 8}`} />
    <text className={`${styles.label} ${styles.fixIn}`} x={drop} y={96}>part 150</text>
    <text className={`${styles.label} ${styles.hotText} ${styles.hotShowLate}`} x={drop} y={96}>drops here</text>
    <text className={`${styles.label} ${styles.end}`} x={bar.x + bar.width} y={96}>200</text>
    <text className={`${styles.label} ${styles.start} ${styles.hotText} ${styles.hotShowLate}`} x={bar.x} y={96}>starts over</text>
  </svg>;
}

export function FixPicture({ picture }: { picture: HomeFix["picture"] }) {
  if (picture === "edge") return <EdgePicture />;
  if (picture === "wallet") return <WalletPicture />;
  if (picture === "upload") return <UploadPicture />;
  const { before, after } = retryFix();
  return <RetriesPicture before={before} after={after} />;
}

/** The fix's number beside the problem's, struck through. While it plays, the problem's number has its moment first. */
export function FixReadout({ now, was, unit }: { now: string; was: string; unit: string }) {
  return <p className={styles.readout}>
    <span className="sr-only">{`${now} ${unit}, instead of ${was}.`}</span>
    <b className={styles.now} aria-hidden="true">{now}</b>
    <s className={styles.was} aria-hidden="true">{was}</s>
    <span className={styles.unit} aria-hidden="true">{unit}</span>
  </p>;
}
