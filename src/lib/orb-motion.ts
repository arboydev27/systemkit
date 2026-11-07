import type { OrbGraph } from "./orb-layout";
import { lessonsInOrder } from "./orb-view";

// How the live orb moves and answers the pointer. Kept apart from orb-view.ts so it loads with the canvas.

export type Rotation = { yaw: number; pitch: number };

export function foldPoint(a: number[], first: number[], second: number[], b: number[], t: number): [number, number, number] {
  const u = 1 - t;
  const [w0, w1, w2, w3] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [
    w0 * a[0] + w1 * first[0] + w2 * second[0] + w3 * b[0],
    w0 * a[1] + w1 * first[1] + w2 * second[1] + w3 * b[1],
    w0 * a[2] + w1 * first[2] + w2 * second[2] + w3 * b[2],
  ];
}

export function arcPoint(a: number[], control: number[], b: number[], t: number): [number, number, number] {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * control[0] + t * t * b[0],
    u * u * a[1] + 2 * u * t * control[1] + t * t * b[1],
    u * u * a[2] + 2 * u * t * control[2] + t * t * b[2],
  ];
}

/** The angle that brings a point to the center of the view. */
export function faceAngles(x: number, y: number, z: number): Rotation {
  return { yaw: Math.atan2(-x, z), pitch: Math.atan2(y, Math.hypot(x, z)) };
}

/** The equivalent of an angle nearest to the current one, so a turn takes the short way around. */
export function nearestAngle(current: number, target: number) {
  const turn = Math.PI * 2;
  return target + Math.round((current - target) / turn) * turn;
}

/** A critically damped spring: no overshoot, and it can be retargeted at any moment without a jump. */
export function springStep(value: number, velocity: number, target: number, response: number, dt: number) {
  const omega = (Math.PI * 2) / response;
  const offset = value - target;
  const c = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return {
    value: target + (offset + c * dt) * decay,
    velocity: (c - omega * (offset + c * dt)) * decay,
  };
}

/** Past the limit, a drag gives less and less. */
export function rubberBand(value: number, limit: number, give = 0.35) {
  const over = Math.abs(value) - limit;
  return over <= 0 ? value : Math.sign(value) * (limit + (over * give) / (1 + over * give));
}

export type HitPoint = { x: number; y: number; depth: number };

/** The lesson under a pointer: nearest first, with front dots winning ties over the ones behind them. */
export function hitLesson(points: HitPoint[], x: number, y: number, reach: number) {
  let found = -1;
  let best = Infinity;
  points.forEach((point, index) => {
    const away = Math.hypot(point.x - x, point.y - y);
    if (away > reach || point.depth < 0.3) return;
    const score = away - point.depth * reach * 0.5;
    if (score < best) { best = score; found = index; }
  });
  return found;
}

/** Hops along the real links from one lesson to every other, which times the signal that runs through the orb. */
export function hopsFrom(graph: Pick<OrbGraph, "titles" | "links" | "chapterStarts">, start: number) {
  const next: number[][] = graph.titles.map(() => []);
  for (let chapter = 0; chapter < graph.chapterStarts.length - 1; chapter++) {
    for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1] - 1; lesson++) {
      next[lesson].push(lesson + 1);
      next[lesson + 1].push(lesson);
    }
  }
  for (let index = 0; index < graph.links.length; index += 2) {
    next[graph.links[index]].push(graph.links[index + 1]);
    next[graph.links[index + 1]].push(graph.links[index]);
  }
  const hops = graph.titles.map(() => Infinity);
  hops[start] = 0;
  for (const queue = [start]; queue.length;) {
    const lesson = queue.shift() as number;
    for (const neighbor of next[lesson]) if (hops[neighbor] === Infinity) {
      hops[neighbor] = hops[lesson] + 1;
      queue.push(neighbor);
    }
  }
  return hops;
}

/** The route still ahead when walking this order: from the next lesson, around to anything unfinished before it. */
export function routeAhead(graph: Pick<OrbGraph, "chapterStarts">, order: number[], finished: boolean[], next: number | null) {
  if (next === null) return [];
  const lessons = lessonsInOrder(graph, order);
  const start = Math.max(0, lessons.indexOf(next));
  return [...lessons.slice(start), ...lessons.slice(0, start)].filter((lesson) => !finished[lesson]);
}

/**
 * Two part names can turn onto the same stretch of rim. The one nearer the viewer keeps it, and the other fades out as they close.
 * Angles are around the rim, negative above the orb and positive below it, and `half` is half the name's length as an angle.
 */
export function rimNameFades(names: { angle: number; half: number; depth: number }[], margin: number) {
  return names.map((name) => names.reduce((fade, other) => {
    if (other === name || other.depth <= name.depth || Math.sign(other.angle) !== Math.sign(name.angle)) return fade;
    const gap = Math.abs(other.angle - name.angle) - other.half - name.half;
    return Math.min(fade, Math.max(0, Math.min(1, gap / margin)));
  }, 1));
}
