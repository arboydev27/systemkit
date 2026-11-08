import type { OrbGraph } from "./orb-layout";
import { MILO } from "./milo-figure";

// The home page's course line, the ledge Milo sits on, and where Milo looks. Pure arithmetic, so it can be tested
// without a browser and the server draws exactly what the browser will.

/** The gap between two parts, as a share of the whole line. */
export const PART_GAP = 0.03;
/** Extra room between two chapters, in lesson steps. */
const CHAPTER_GAP = 1.4;
/** Room at each end of a part, as a share of the part. */
const PART_PAD = 0.04;

export type Ledge = {
  /** Each lesson's place on the line, from 0 to 1, in course order. */
  lessons: number[];
  /** Each part's stretch of the line. Parts share it equally, so every name has room, however many lessons it has. */
  parts: { start: number; end: number }[];
};

export function ledgeOf(graph: Pick<OrbGraph, "chapterStarts" | "chapterParts" | "partTitles">): Ledge {
  const partCount = graph.partTitles.length;
  const share = (1 - PART_GAP * (partCount - 1)) / partCount;
  const lessons: number[] = [];
  const parts = graph.partTitles.map((_, part) => ({ start: part * (share + PART_GAP), end: part * (share + PART_GAP) + share }));
  graph.partTitles.forEach((_, part) => {
    const chapters = graph.chapterParts.flatMap((owner, chapter) => owner === part ? [chapter] : []);
    let unit = 0;
    const units: number[] = [];
    chapters.forEach((chapter, index) => {
      if (index > 0) unit += CHAPTER_GAP;
      for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1]; lesson++) {
        units[lesson] = unit;
        unit += 1;
      }
    });
    const span = Math.max(1e-9, unit - 1);
    const { start, end } = parts[part];
    const inner = (end - start) * (1 - 2 * PART_PAD);
    for (const chapter of chapters) {
      for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1]; lesson++) {
        lessons[lesson] = unit <= 1 ? (start + end) / 2 : start + (end - start) * PART_PAD + (units[lesson] / span) * inner;
      }
    }
  });
  return { lessons, parts };
}

/** The lesson whose tick is nearest a place on the line. */
export function nearestLesson(lessons: number[], at: number) {
  let low = 0;
  let high = lessons.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (lessons[middle] <= at) low = middle;
    else high = middle;
  }
  return Math.abs(lessons[low] - at) <= Math.abs(lessons[high] - at) ? low : high;
}

/** Where Milo's seat goes on the line, in pixels: over his lesson, but never hanging off either end. */
export function seatX(lessonAt: number, line: { left: number; width: number }, figureWidth: number, bounds: { left: number; right: number }) {
  const want = line.left + lessonAt * line.width;
  const half = figureWidth / 2;
  const least = bounds.left + half;
  const most = bounds.right - half;
  return most < least ? (least + most) / 2 : Math.min(most, Math.max(least, want));
}

/** How far the eyes can travel across his screen, as fractions of the figure, before they'd touch its edge. */
export const GAZE_REACH = {
  x: (MILO.display.rx - MILO.eyes[0].rx) * 0.42,
  y: (MILO.display.ry - MILO.eyes[0].ry) * 0.62,
};

/**
 * Where his eyes sit for a target, given as an offset from the middle of his screen in figure widths (x) and heights (y).
 * They follow it fully up to `near` away, then ease toward the edge of the screen and stay on it.
 */
export function gaze(dx: number, dy: number, near = 0.9) {
  // Height is measured in widths so a target the same distance away pulls the same in any direction.
  const ry = dy * (MILO.height / MILO.width);
  const length = Math.hypot(dx, ry);
  if (length < 1e-6) return { x: 0, y: 0 };
  const pull = Math.tanh(length / near);
  return { x: (dx / length) * pull * GAZE_REACH.x, y: (ry / length) * pull * GAZE_REACH.y };
}

/**
 * Where he turns for a target his eyes are looking at (as `gaze` gives it): the head carries most of the turn, up to the
 * last of its rendered frames, and the torso follows with a fraction of it. Degrees toward the image's right (yaw,
 * twist) and down (nod).
 */
export function turnFor(eyes: { x: number; y: number }, frames: { yaws: readonly number[]; nods: readonly number[]; twists: readonly number[] }) {
  const sideways = Math.max(-1, Math.min(1, eyes.x / GAZE_REACH.x));
  // His eyes reach less far up and down than across, so a nod takes less of their reach.
  const down = Math.max(-1, Math.min(1, (eyes.y / GAZE_REACH.y) * 1.4));
  const yaw = sideways * frames.yaws[frames.yaws.length - 1];
  const nod = down > 0 ? down * frames.nods[frames.nods.length - 1] : -down * frames.nods[0];
  return { yaw, nod, twist: (yaw / frames.yaws[frames.yaws.length - 1]) * frames.twists[frames.twists.length - 1] * 0.9 };
}

/** How far the eyes come back toward the middle of his screen once the head has turned toward what they look at. */
export const EYES_GIVE_BACK = 0.55;

/**
 * The rendered frame a turn should come to rest on: the nearest one, but it only moves on once the turn is well past
 * the middle between two frames, so a target near that middle doesn't flick him back and forth.
 */
export function detent(values: readonly number[], resting: number, want: number, stick = 0.18) {
  let nearest = values[0];
  for (const value of values) if (Math.abs(value - want) < Math.abs(nearest - want)) nearest = value;
  const index = values.indexOf(resting);
  if (nearest === resting || index < 0) return nearest;
  const neighbour = values[Math.max(0, Math.min(values.length - 1, index + (want > resting ? 1 : -1)))];
  const gap = Math.abs(neighbour - resting);
  return Math.abs(want - resting) > gap * (0.5 + stick) ? nearest : resting;
}

/**
 * The two frames either side of a turn and how far it is from the first to the second, eased so most of the way the
 * nearer frame shows, and two frames crossfade only around the middle, where they'd otherwise show doubled edges.
 */
export function between(values: readonly number[], at: number) {
  const last = values.length - 1;
  if (at <= values[0]) return { from: 0, to: 0, t: 0 };
  if (at >= values[last]) return { from: last, to: last, t: 0 };
  let from = 0;
  while (from < last - 1 && values[from + 1] <= at) from++;
  const t = (at - values[from]) / (values[from + 1] - values[from]);
  const eased = t < 0.5 ? 0.5 * Math.pow(2 * t, 1.7) : 1 - 0.5 * Math.pow(2 * (1 - t), 1.7);
  return { from, to: from + 1, t: eased };
}

/** The frames of a grid (rows of `nods` by columns of `yaws`, in row order) that show for a turn, and how much of each. */
export function headWeights(yaws: readonly number[], nods: readonly number[], yaw: number, nod: number) {
  const across = between(yaws, yaw);
  const down = between(nods, nod);
  const weights = new Map<number, number>();
  const add = (row: number, column: number, weight: number) => {
    if (weight < 0.004) return;
    const cell = row * yaws.length + column;
    weights.set(cell, (weights.get(cell) ?? 0) + weight);
  };
  add(down.from, across.from, (1 - across.t) * (1 - down.t));
  add(down.from, across.to, across.t * (1 - down.t));
  add(down.to, across.from, (1 - across.t) * down.t);
  add(down.to, across.to, across.t * down.t);
  return normalized(weights);
}

/** The frames of a row that show for a turn, and how much of each. */
export function rowWeights(values: readonly number[], at: number) {
  const { from, to, t } = between(values, at);
  const weights = new Map<number, number>();
  if (1 - t >= 0.004) weights.set(from, 1 - t);
  if (t >= 0.004) weights.set(to, (weights.get(to) ?? 0) + t);
  return normalized(weights);
}

function normalized(weights: Map<number, number>) {
  let sum = 0;
  for (const weight of weights.values()) sum += weight;
  for (const [cell, weight] of weights) weights.set(cell, weight / sum);
  return weights;
}

/** A mix of 2D affine maps (SVG matrices), weighted. */
export function mixAffine(maps: readonly (readonly number[])[], weights: Map<number, number>) {
  const out = [0, 0, 0, 0, 0, 0];
  for (const [cell, weight] of weights) for (let i = 0; i < 6; i++) out[i] += maps[cell][i] * weight;
  return out;
}

/** Milliseconds until the next blink: mostly every few seconds, now and then a quick second one. */
export function nextBlink(random: number, justBlinked: boolean) {
  if (justBlinked && random < 0.18) return 180;
  return 2600 + random * 4200;
}

/** The side of his head the speech bubble goes, toward the roomier side of the stage. */
export function bubbleSide(seat: number, stage: { left: number; right: number }) {
  return seat - stage.left > stage.right - seat ? "left" : "right";
}

/** The 2D affine map (as an SVG matrix: a, b, c, d, e, f) that carries three points onto three others. */
export function affineFrom(from: number[][], to: number[][]) {
  const [[x1, y1], [x2, y2], [x3, y3]] = from;
  const det = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
  if (Math.abs(det) < 1e-9) return [1, 0, 0, 1, 0, 0];
  const solve = (v1: number, v2: number, v3: number) => [
    (v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / det,
    (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / det,
    (v1 * (x2 * y3 - x3 * y2) + v2 * (x3 * y1 - x1 * y3) + v3 * (x1 * y2 - x2 * y1)) / det,
  ];
  const [a, c, e] = solve(to[0][0], to[1][0], to[2][0]);
  const [b, d, f] = solve(to[0][1], to[1][1], to[2][1]);
  return [a, b, c, d, e, f];
}
