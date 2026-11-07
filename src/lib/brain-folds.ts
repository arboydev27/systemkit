import { brainField, cerebrumField, fromAnatomy, normalOf, ontoSurface, pieceField, type Vec3 } from "./brain-shape";
import type { OrbGraph } from "./orb-layout";
import { chapterOfLesson } from "./orb-view";

// The grooves on the brain, worked out from the course. Every chapter's thread runs along the crest of a gyrus, so a
// groove runs wherever two neighbouring lessons aren't joined by their chapter's thread: between chapters, between
// the bends of one chapter's fold, and deepest between parts (the lobes) and between the hemispheres. Nothing here is
// drawn at random: move a lesson to another chapter and the grooves move with it.

export type Folds = {
  /** Points along each groove, x, y, z each, on the surface. */
  points: Float32Array;
  /** The surface's outward direction at each point, which says whether that stretch faces the viewer. */
  normals: Float32Array;
  /** Where each groove's points start, with one more entry for the end. */
  starts: Int32Array;
  /** How deep each groove is: 1 within a chapter, 2 between chapters, 3 between parts, 4 the fissure, and 5 for the cerebellum's folia. */
  depth: Uint8Array;
};

export const FOLD_DEPTHS = 4;
export const FOLIA = 5;
const SMOOTHING = 3;
const LONGEST = 0.42;

/** Neighbouring lessons, as the triangles that join them over the surface with no other lesson inside their circle. */
export function surfaceTriangles(positions: ArrayLike<number>) {
  const count = positions.length / 3;
  const directions: Vec3[] = [];
  for (let lesson = 0; lesson < count; lesson++) {
    const x = positions[lesson * 3];
    const y = positions[lesson * 3 + 1];
    const z = positions[lesson * 3 + 2];
    const length = Math.hypot(x, y, z) || 1;
    directions.push([x / length, y / length, z / length]);
  }
  // Each lesson's nearest few, by direction, kept in order as they're found.
  const NEAREST = 16;
  const near = directions.map((a, index) => {
    const best: number[] = [];
    const closeness: number[] = [];
    for (let other = 0; other < count; other++) {
      if (other === index) continue;
      const b = directions[other];
      const gap = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      if (best.length === NEAREST && gap <= closeness[NEAREST - 1]) continue;
      let at = best.length === NEAREST ? NEAREST - 1 : best.length;
      while (at > 0 && closeness[at - 1] < gap) {
        best[at] = best[at - 1];
        closeness[at] = closeness[at - 1];
        at--;
      }
      best[at] = other;
      closeness[at] = gap;
    }
    return best;
  });
  const seen = new Set<number>();
  const triangles: number[] = [];
  for (let a = 0; a < count; a++) {
    const around = near[a];
    for (let i = 0; i < around.length; i++) for (let j = i + 1; j < around.length; j++) {
      const [p, q, r] = [a, around[i], around[j]].sort((m, n) => m - n);
      const key = (p * count + q) * count + r;
      if (seen.has(key)) continue;
      seen.add(key);
      const A = directions[p];
      const B = directions[q];
      const C = directions[r];
      const u: Vec3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const v: Vec3 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      let n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[0] * A[0] + n[1] * A[1] + n[2] * A[2] < 0) n = [-n[0], -n[1], -n[2]];
      // A lesson inside the triangle's circle would be one of these three's nearest.
      const offset = n[0] * A[0] + n[1] * A[1] + n[2] * A[2] + 1e-9;
      let empty = true;
      for (const list of [near[p], near[q], near[r]]) {
        for (let at = 0; at < list.length && empty; at++) {
          const m = list[at];
          if (m === p || m === q || m === r) continue;
          const D = directions[m];
          if (n[0] * D[0] + n[1] * D[1] + n[2] * D[2] > offset) empty = false;
        }
        if (!empty) break;
      }
      if (empty) triangles.push(p, q, r);
    }
  }
  return triangles;
}

export function buildFolds(graph: Pick<OrbGraph, "positions" | "chapterStarts" | "chapterParts">): Folds {
  const { positions } = graph;
  const count = positions.length / 3;
  const at = (lesson: number): Vec3 => [positions[lesson * 3], positions[lesson * 3 + 1], positions[lesson * 3 + 2]];
  const chapterOf = Array.from({ length: count }, (_, lesson) => chapterOfLesson(graph, lesson));
  const triangles = surfaceTriangles(positions);
  const centers: Vec3[] = [];
  const centerNormals: Vec3[] = [];
  const edges = new Map<number, number[]>();
  for (let t = 0; t < triangles.length / 3; t++) {
    const [a, b, c] = [triangles[t * 3], triangles[t * 3 + 1], triangles[t * 3 + 2]];
    const A = at(a);
    const B = at(b);
    const C = at(c);
    const center = ontoSurface(brainField, [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3], 6);
    centers.push(center);
    centerNormals.push(normalOf(brainField, center));
    for (const [p, q] of [[a, b], [b, c], [a, c]]) {
      const key = Math.min(p, q) * count + Math.max(p, q);
      const list = edges.get(key);
      if (list) list.push(t); else edges.set(key, [t]);
    }
  }

  // Each groove runs between the middles of the two triangles either side of a pair of lessons.
  const around: number[][][] = Array.from({ length: FOLD_DEPTHS + 1 }, () => centers.map(() => []));
  for (const [key, sides] of edges) {
    if (sides.length !== 2) continue;
    const a = Math.floor(key / count);
    const b = key % count;
    if (b === a + 1 && chapterOf[a] === chapterOf[b]) continue; // Along a gyrus, not across one.
    const [from, to] = sides;
    if (Math.hypot(centers[from][0] - centers[to][0], centers[from][1] - centers[to][1], centers[from][2] - centers[to][2]) > LONGEST) continue;
    const pa = at(a);
    const pb = at(b);
    const across = Math.sign(pa[0]) !== Math.sign(pb[0]) && Math.min(Math.abs(pa[0]), Math.abs(pb[0])) < 0.2 && pa[1] > -0.3 && pb[1] > -0.3;
    const level = across ? 4 : graph.chapterParts[chapterOf[a]] !== graph.chapterParts[chapterOf[b]] ? 3 : chapterOf[a] !== chapterOf[b] ? 2 : 1;
    around[level][from].push(to);
    around[level][to].push(from);
  }

  // Grooves of one depth join end to end where nothing else meets them, so each reads as one long, winding line.
  const chains: { nodes: number[]; level: number }[] = [];
  const pair = (a: number, b: number) => Math.min(a, b) * centers.length + Math.max(a, b);
  for (let level = 1; level <= FOLD_DEPTHS; level++) {
    const used = new Set<number>();
    const links = around[level];
    const walk = (start: number, next: number) => {
      const nodes = [start];
      let previous = start;
      let current = next;
      for (;;) {
        used.add(pair(previous, current));
        nodes.push(current);
        if (links[current].length !== 2) break;
        const onward = links[current].find((node) => node !== previous && !used.has(pair(current, node)));
        if (onward === undefined) break;
        previous = current;
        current = onward;
      }
      return nodes;
    };
    const ends = centers.map((_, node) => node).filter((node) => links[node].length && links[node].length !== 2);
    for (const node of [...ends, ...centers.map((_, index) => index)]) {
      for (const next of links[node]) if (!used.has(pair(node, next))) chains.push({ nodes: walk(node, next), level });
    }
  }

  const points: number[] = [];
  const normals: number[] = [];
  const starts: number[] = [];
  const depth: number[] = [];
  const normal: Vec3 = [0, 0, 0];
  for (const { nodes, level } of chains) {
    // Rounded off, keeping its ends, so a groove winds rather than zigzags, then laid back on the surface. The fissure
    // runs between the two hemispheres' lessons in turn, so it's evened out first: it barely wavers.
    let line: number[][] = nodes.map((node) => [...centers[node], ...centerNormals[node]]);
    for (let pass = 0; pass < (level === FOLD_DEPTHS ? 3 : 0); pass++) {
      line = line.map((point, index) => index === 0 || index === line.length - 1 ? point : point.map((value, axis) => value * 0.5 + (line[index - 1][axis] + line[index + 1][axis]) * 0.25));
    }
    for (let pass = 0; pass < SMOOTHING; pass++) {
      const next: number[][] = [line[0]];
      for (let index = 0; index < line.length - 1; index++) {
        const a = line[index];
        const b = line[index + 1];
        if (index > 0) next.push(a.map((value, axis) => value * 0.75 + b[axis] * 0.25));
        if (index < line.length - 2) next.push(a.map((value, axis) => value * 0.25 + b[axis] * 0.75));
      }
      next.push(line[line.length - 1]);
      line = next;
    }
    if (line.length === 2) line = [line[0], line[0].map((value, axis) => (value + line[1][axis]) / 2), line[1]];
    starts.push(points.length / 3);
    depth.push(level);
    for (const [x, y, z] of line) {
      const p = ontoSurface(brainField, [x, y, z], 2, normal);
      points.push(p[0], p[1], p[2]);
      normals.push(normal[0], normal[1], normal[2]);
    }
  }
  starts.push(points.length / 3);
  return { points: Float32Array.from(points), normals: Float32Array.from(normals), starts: Int32Array.from(starts), depth: Uint8Array.from(depth) };
}

/**
 * The cerebellum's folia: fine parallel ridges running across it from side to side, which is how a cerebellum is told
 * from the cortex at a glance. They're the shape's own shading rather than course data, drawn like the shallowest grooves.
 */
export function folia(lines = 11, steps = 22): Folds {
  const cerebellum = (x: number, y: number, z: number) => pieceField("cerebellum", x, y, z);
  const points: number[] = [];
  const normals: number[] = [];
  const starts: number[] = [];
  const depth: number[] = [];
  const normal: Vec3 = [0, 0, 0];
  const center = fromAnatomy([0, -0.6, -0.48]);
  let run: number[] = [];
  const close = () => {
    if (run.length >= 4 * 3) {
      starts.push(points.length / 3);
      depth.push(FOLIA);
      for (let index = 0; index < run.length; index += 3) {
        const p: Vec3 = [run[index], run[index + 1], run[index + 2]];
        normalOf(cerebellum, p, normal);
        points.push(p[0], p[1], p[2]);
        normals.push(normal[0], normal[1], normal[2]);
      }
    }
    run = [];
  };
  for (let line = 0; line < lines; line++) {
    // From high on the back, round under, to the underside, in the plane across the body.
    const angle = -0.55 + (line / (lines - 1)) * 2.1;
    const dy = -Math.sin(angle);
    const dz = -Math.cos(angle);
    for (let step = 0; step <= steps; step++) {
      const x = (step / steps - 0.5) * 1.2;
      const axis: Vec3 = [x, center[1], center[2]];
      const far: Vec3 = [x, center[1] + dy * 0.7, center[2] + dz * 0.7];
      let outside = 0;
      let inside = 1;
      const at = (t: number) => cerebellum(far[0] + (axis[0] - far[0]) * t, far[1] + (axis[1] - far[1]) * t, far[2] + (axis[2] - far[2]) * t);
      if (at(1) >= 0) { close(); continue; }
      for (let halving = 0; halving < 16; halving++) {
        const middle = (outside + inside) / 2;
        if (at(middle) < 0) inside = middle; else outside = middle;
      }
      const t = (outside + inside) / 2;
      const p: Vec3 = [far[0] + (axis[0] - far[0]) * t, far[1] + (axis[1] - far[1]) * t, far[2] + (axis[2] - far[2]) * t];
      // Under the occipital lobe a fold is hidden, so the line breaks there.
      if (cerebrumField(p[0], p[1], p[2]) < 0.02) { close(); continue; }
      run.push(p[0], p[1], p[2]);
    }
    close();
  }
  starts.push(points.length / 3);
  return { points: Float32Array.from(points), normals: Float32Array.from(normals), starts: Int32Array.from(starts), depth: Uint8Array.from(depth) };
}

/** Two sets of grooves drawn as one. */
function joined(a: Folds, b: Folds): Folds {
  const offset = a.points.length / 3;
  const starts = new Int32Array(a.starts.length + b.starts.length - 1);
  starts.set(a.starts.subarray(0, a.starts.length - 1));
  for (let index = 0; index < b.starts.length; index++) starts[a.starts.length - 1 + index] = b.starts[index] + offset;
  const points = new Float32Array(a.points.length + b.points.length);
  points.set(a.points);
  points.set(b.points, a.points.length);
  const normals = new Float32Array(a.normals.length + b.normals.length);
  normals.set(a.normals);
  normals.set(b.normals, a.normals.length);
  const depth = new Uint8Array(a.depth.length + b.depth.length);
  depth.set(a.depth);
  depth.set(b.depth, a.depth.length);
  return { points, normals, starts, depth };
}

const built = new WeakMap<object, Folds>();

/** The grooves for a course's brain, with the cerebellum's folia, worked out once and shared by the map and the dive. */
export function foldsFor(graph: Pick<OrbGraph, "positions" | "chapterStarts" | "chapterParts">) {
  let folds = built.get(graph.positions);
  if (!folds) {
    folds = joined(buildFolds(graph), folia());
    built.set(graph.positions, folds);
  }
  return folds;
}
