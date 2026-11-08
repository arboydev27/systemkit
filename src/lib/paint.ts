/**
 * The paint on the wall behind Milo: a spill of the site's orange coming over the top of the wall, with a few runs
 * leaving it and ending in rounded heads. Everything is in wall units, about a pixel when Milo is 600px tall, with the
 * top of the wall at y = 0 and the middle of the spill at x = 0. The spill's sheet goes on up out of sight, and each
 * run starts up inside the sheet, so a run that creeps simply slides down out of it.
 */

/** One run of paint. */
export type Run = {
  /** Where it leaves the sheet, across. */
  x: number;
  /** The stream's half-width just above its head, and the head's half-width. */
  width: number;
  head: number;
  /** How far its neck (where the stream meets the head) is below the top of the wall, and how long the head hangs. */
  reach: number;
  length: number;
  /** Which run this is, for the little swells and wanders that make it look poured rather than drawn. */
  seed: number;
};

/** The sheet the runs leave: how far across it goes each way, and how far down the wall its lower edge comes. */
export type Spill = { left: number; right: number; edge: number; seed: number; runs: Run[] };

/** How far above the top of the wall the sheet goes, and where in it the runs start. */
export const ABOVE = 240;
export const RUN_TOP = -140;

/**
 * The spills, each a short sheet of paint over the top of the wall and the runs that leave it. A wide screen's hangs
 * between the words and Milo; a phone's comes down the right-hand edge, past the words and behind his thought, to
 * beside him. The longest run in each is still coming down: it slides `creep` units further over a minute.
 */
export const SPILLS: { name: "wide" | "narrow"; spill: Spill; creep: number }[] = [
  {
    name: "wide",
    creep: 46,
    spill: {
      left: -44, right: 40, edge: 16, seed: 3,
      runs: [
        { x: -27, width: 3.2, head: 5.4, reach: 128, length: 15, seed: 4 },
        { x: -6, width: 4.2, head: 6.8, reach: 330, length: 19, seed: 7 },
        { x: 13, width: 2.5, head: 4.4, reach: 58, length: 12, seed: 2 },
        { x: 27, width: 3.4, head: 5.8, reach: 214, length: 16, seed: 9 },
      ],
    },
  },
  {
    name: "narrow",
    creep: 60,
    spill: {
      left: -34, right: 34, edge: 18, seed: 5,
      runs: [
        { x: -20, width: 3.4, head: 5.8, reach: 200, length: 16, seed: 11 },
        { x: 0, width: 4.2, head: 7, reach: 600, length: 19, seed: 7 },
        { x: 19, width: 2.8, head: 4.8, reach: 80, length: 13, seed: 2 },
      ],
    },
  },
];

/** The longest run in a spill is the one that's still creeping. */
export const creeperOf = (spill: Spill) => spill.runs.reduce((best, run, index) => run.reach > spill.runs[best].reach ? index : best, 0);

function random(seed: number) {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const f = (value: number) => (Math.abs(value) < 0.005 ? "0" : value.toFixed(2));

/** A smooth path through points, as Catmull-Rom curves turned into cubic Béziers. */
function through(points: [number, number][], start: boolean) {
  let d = start ? `M${f(points[0][0])} ${f(points[0][1])}` : `L${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** A run's stream, from up in the sheet to its neck: its centre and half-width every few units. */
export function streamOf(run: Run) {
  const next = random(run.seed);
  const span = run.reach - RUN_TOP;
  // Where the paint paused on its way down and gathered a little, and how it wanders from side to side.
  const swells = [0, 1].map(() => ({ at: run.reach - span * (0.2 + 0.6 * next()), size: 0.08 + 0.16 * next(), spread: 10 + 26 * next() }));
  const wander = { by: 0.2 + 0.35 * next(), every: 40 + 70 * next(), from: next() * Math.PI * 2 };
  const samples: { y: number; x: number; half: number }[] = [];
  const steps = Math.max(8, Math.ceil(span / 10));
  for (let i = 0; i <= steps; i++) {
    const y = RUN_TOP + (span * i) / steps;
    // A run thickens a little toward its head, where the paint is still coming down.
    const near = Math.exp((y - run.reach) / 90);
    let half = run.width * (0.8 + 0.2 * near);
    for (const swell of swells) half += run.width * swell.size * Math.exp(-((y - swell.at) ** 2) / (2 * swell.spread ** 2));
    const x = run.x + wander.by * run.width * (Math.sin(y / wander.every + wander.from) - Math.sin(run.reach / wander.every + wander.from)) * (1 - near);
    samples.push({ y, x, half });
  }
  return samples;
}

/** The outline of a run: down the left of its stream, round its head, and back up the right. */
export function runPath(run: Run) {
  const samples = streamOf(run);
  const { x, half: w } = samples[samples.length - 1];
  const { head, length, reach: y } = run;
  const left = samples.map((s) => [s.x - s.half, s.y] as [number, number]);
  const right = samples.map((s) => [s.x + s.half, s.y] as [number, number]).reverse();
  // The head swells out of the stream and hangs as a rounded drop, fullest a little above its bottom.
  const widest = y + length * 0.6;
  const drop = `C${f(x - w)} ${f(y + length * 0.18)} ${f(x - head)} ${f(y + length * 0.26)} ${f(x - head)} ${f(widest)}`
    + `C${f(x - head)} ${f(y + length * 0.86)} ${f(x - head * 0.56)} ${f(y + length)} ${f(x)} ${f(y + length)}`
    + `C${f(x + head * 0.56)} ${f(y + length)} ${f(x + head)} ${f(y + length * 0.86)} ${f(x + head)} ${f(widest)}`
    + `C${f(x + head)} ${f(y + length * 0.26)} ${f(x + w)} ${f(y + length * 0.18)} ${f(x + w)} ${f(y)}`;
  return `${through(left, true)}${drop}${through(right, false)}Z`;
}

/** Where the sheet's lower edge is, across: a slow wave, sagging into a short tooth where each run leaves it, and
 *  curving up out of sight at both ends. */
export function edgeAt(spill: Spill, x: number) {
  const { left, right, edge, seed } = spill;
  let y = edge + 2.2 * Math.sin(x / 13 + seed) + 1.4 * Math.sin(x / 5.3 + seed * 2.1);
  for (const run of spill.runs) {
    const away = Math.abs(x - run.x);
    const t = Math.min(1, Math.max(0, (away - run.width) / (run.width * 2.4)));
    y += run.width * 2.6 * (1 - t * t * (3 - 2 * t));
  }
  const round = Math.min(18, (right - left) / 4);
  const end = Math.max(0, (left + round - x) / round, (x - (right - round)) / round);
  if (end > 0) y -= (y + 24) * (1 - Math.sqrt(Math.max(0, 1 - end * end)));
  return y;
}

/** The sheet's outline: across the top out of sight, down one end, along its lower edge and up the other end. */
export function sheetPath(spill: Spill) {
  const points: [number, number][] = [];
  const steps = Math.ceil((spill.right - spill.left) / 2);
  for (let i = 0; i <= steps; i++) {
    const x = spill.left + ((spill.right - spill.left) * i) / steps;
    points.push([x, edgeAt(spill, x)]);
  }
  return `M${f(spill.left)} ${-ABOVE}L${f(spill.left)} ${f(points[0][1])}${through(points, false)}L${f(spill.right)} ${-ABOVE}Z`;
}

/** How far down the spill comes, to its lowest head. */
export function depthOf(spill: Spill) {
  return Math.max(...spill.runs.map((run) => run.reach + run.length), spill.edge + 10);
}

/** The glint down a run, where the light catches it: a line a little left of its middle, from below the sheet to its head. */
export function glintPath(run: Run, from = 24) {
  const samples = streamOf(run).filter(({ y }) => y > from && y < run.reach + run.length * 0.12);
  if (samples.length < 2) return "";
  return through(samples.map(({ x, y, half }) => [x - half * 0.4, y] as [number, number]), true);
}
