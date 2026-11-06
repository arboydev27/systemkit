import type { OrbGraph } from "./orb-layout";

// How the orb looks from a given angle. Pure arithmetic, shared by the first paint and the live canvas so one
// lands exactly on the other. What only the live canvas needs is in orb-motion.ts, which loads with it.

export const ORB_RADIUS = 0.44; // Of the stage's width, leaving a margin for the part names around the rim.
const CAMERA = 3.1;
const FIT = Math.sqrt(1 - 1 / (CAMERA * CAMERA));

/** How near a depth of -1 to 1 is to the viewer, from 0 at the back to 1 at the front. */
export const nearness = (z: number) => Math.min(1, Math.max(0, (z + 1) / 2));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Screen position of a point already turned to face its angle. Screen y runs down. */
export function projectPoint(x: number, y: number, z: number, center: number, radius: number, zoom = 1) {
  const scale = (CAMERA / (CAMERA - z)) * FIT * radius * zoom;
  return { x: center + x * scale, y: center - y * scale };
}

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

export const CHAPTER_LINE = 0.5;
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

const whole = Math.round;
const compact = (path: string) => path.replaceAll(" -", "-");

/** The orb drawn from the front as static marks for the first paint, in as few bytes as the page can spare. */
export function posterMarks(graph: OrbGraph, size: number) {
  const center = size / 2;
  const radius = size * ORB_RADIUS;
  const point = (lesson: number) => graph.positions.slice(lesson * 3, lesson * 3 + 3);
  const screen = (p: number[]) => projectPoint(p[0], p[1], p[2], center, radius);
  const degrees = linkDegrees(graph);
  const bands = [0.12, 0.32, 0.55, 0.85];
  const band = (depth: number) => depth < 0.3 ? 0 : depth < 0.5 ? 1 : depth < 0.72 ? 2 : 3;
  const chapterPaths = bands.map(() => "");
  const linkPaths = bands.map(() => "");

  for (let chapter = 0; chapter < graph.chapterStarts.length - 1; chapter++) {
    const start = graph.chapterStarts[chapter];
    const end = graph.chapterStarts[chapter + 1];
    for (let lesson = start; lesson < end - 1; lesson++) {
      const a = point(lesson);
      const b = point(lesson + 1);
      const { before, after } = foldNeighbors(start, end, lesson);
      const [first, second] = foldHandles(point(before), a, b, point(after));
      const [from, one, two, to] = [a, first, second, b].map(screen);
      const x = whole(from.x);
      const y = whole(from.y);
      chapterPaths[band(nearness((a[2] + b[2]) / 2))] += `M${x} ${y}c${whole(one.x - x)} ${whole(one.y - y)} ${whole(two.x - x)} ${whole(two.y - y)} ${whole(to.x - x)} ${whole(to.y - y)}`;
    }
  }
  for (let index = 0; index < graph.links.length; index += 2) {
    const a = point(graph.links[index]);
    const b = point(graph.links[index + 1]);
    const control = arcControl(a, b);
    const [from, bend, to] = [a, control, b].map(screen);
    linkPaths[band(nearness(control[2]))] += `M${whole(from.x)} ${whole(from.y)}Q${whole(bend.x)} ${whole(bend.y)} ${whole(to.x)} ${whole(to.y)}`;
  }

  // A zero-length line with round caps is a dot, so all the dots of one size and shade fit in one path.
  const dotGroups = new Map<string, { path: string; width: number; opacity: string; depth: number }>();
  graph.titles.forEach((_, lesson) => {
    const p = point(lesson);
    const depth = nearness(p[2]);
    const { x, y } = screen(p);
    const width = whole(dotRadius(depth, degrees[lesson], false, radius) * 2);
    const opacity = dotAlpha([0.15, 0.4, 0.62, 0.85][band(depth)], false).toFixed(2);
    const key = `${width}/${opacity}`;
    const group = dotGroups.get(key) ?? { path: "", width, opacity, depth: band(depth) };
    group.path += `M${whole(x)} ${whole(y)}h0`;
    dotGroups.set(key, group);
  });

  return {
    lines: bands.map((depth, index) => ({
      chapter: compact(chapterPaths[index]), chapterOpacity: lineAlpha(depth, CHAPTER_LINE).toFixed(3),
      link: linkPaths[index], linkOpacity: lineAlpha(depth, RELATED_LINE).toFixed(3),
    })),
    dots: [...dotGroups.values()].sort((a, b) => a.depth - b.depth),
    start: { ...screen(point(0)), r: dotRadius(nearness(graph.positions[2]), degrees[0], true, radius) },
  };
}
