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

/** The head leans toward what he looks at, a little: degrees of tilt and a shift in figure widths. */
export function lean(eyes: { x: number; y: number }) {
  const sideways = eyes.x / GAZE_REACH.x;
  const down = eyes.y / GAZE_REACH.y;
  return { tilt: sideways * 2.2, x: sideways * 0.006, y: down * 0.004 };
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
