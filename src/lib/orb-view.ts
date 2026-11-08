import type { OrbGraph } from "./orb-layout";

// The course as a sphere of lessons, which the dive draws inside when there's no WebGL, and the lookups the course
// line shares with it. Pure arithmetic.

export const ORB_RADIUS = 0.44; // The sphere's radius as a share of what the dive goes into, which sets the scale inside.
/** How far the viewer stands from the orb's center, in orb radii, and how much of the stage the orb fills from there. */
export const CAMERA = 3.1;
export const FIT = Math.sqrt(1 - 1 / (CAMERA * CAMERA));

/** How near a depth of -1 to 1 is to the viewer, from 0 at the back to 1 at the front. */
export const nearness = (z: number) => Math.min(1, Math.max(0, (z + 1) / 2));
const smooth = (t: number) => t * t * (3 - 2 * t);

export function dotRadius(depth: number, degree: number, finished: boolean, radius: number) {
  return radius * 0.0118 * (1 + 0.14 * Math.sqrt(degree)) * (0.45 + 0.8 * depth) * (finished ? 1.32 : 1);
}

/** Back dots fall away, as in an engraved globe. Finished lessons stay lit even there. */
export function dotAlpha(depth: number, finished: boolean) {
  const lit = smooth(depth);
  return finished ? 0.44 + 0.56 * lit : 0.1 + 0.62 * lit;
}

export function lineAlpha(depth: number, strength: number) {
  return strength * (0.1 + 0.9 * depth * depth);
}

export const CHAPTER_LINE = 0.42;
export const RELATED_LINE = 0.2;

/** Bezier handles that carry a chapter's thread smoothly through a lesson, so it winds like a fold in the cortex. */
export function foldHandles(before: number[], a: number[], b: number[], after: number[]): [number[], number[]] {
  return [
    [a[0] + (b[0] - before[0]) / 6, a[1] + (b[1] - before[1]) / 6, a[2] + (b[2] - before[2]) / 6],
    [b[0] - (after[0] - a[0]) / 6, b[1] - (after[1] - a[1]) / 6, b[2] - (after[2] - a[2]) / 6],
  ];
}

/** The lessons on either side of a stretch of a chapter's thread, repeating the ends. */
export function foldNeighbors(start: number, end: number, lesson: number) {
  return { before: Math.max(start, lesson - 1), after: Math.min(end - 1, lesson + 2) };
}

/** Links run through the orb rather than across its surface, and the longer they are the deeper they dive. */
export function arcControl(a: number[], b: number[]): [number, number, number] {
  const chord = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const keep = Math.max(0.05, 1 - chord * 0.62);
  return [(a[0] + b[0]) / 2 * keep, (a[1] + b[1]) / 2 * keep, (a[2] + b[2]) / 2 * keep];
}

export function chapterOfLesson(graph: Pick<OrbGraph, "chapterStarts">, lesson: number) {
  const { chapterStarts } = graph;
  let low = 0;
  let high = chapterStarts.length - 2;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (chapterStarts[middle] <= lesson) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** How many links touch each lesson, which sets the size of its dot. */
export function linkDegrees(graph: Pick<OrbGraph, "titles" | "links">) {
  const degrees = new Array<number>(graph.titles.length).fill(0);
  for (const lesson of graph.links) degrees[lesson]++;
  return degrees;
}

/** Every lesson in the order a goal suggests, chapter by chapter. */
export function lessonsInOrder(graph: Pick<OrbGraph, "chapterStarts">, order: number[]) {
  return order.flatMap((chapter) => {
    const lessons: number[] = [];
    for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1]; lesson++) lessons.push(lesson);
    return lessons;
  });
}


