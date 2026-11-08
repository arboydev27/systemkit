import type { OrbGraph } from "./orb-layout";
import { arcPoint, foldPoint } from "./orb-motion";
import { arcControl, CAMERA, foldHandles, foldNeighbors } from "./orb-view";

// The way in when the home page scrolls from Milo to the game. The camera dives into his eye and follows real links,
// lesson to lesson, from the visitor's next lesson to a lesson about scaling. Pure arithmetic, so the route and the
// timing can be tested without a browser.

/** The flight, as fractions of the way from Milo to the game. Everything on screen is a function of this one number. */
export const FLIGHT = {
  /** The eye takes the strain: it swells and its pupil opens, and the camera draws back. */
  pull: 0.08,
  /** The camera has gone through the eye. */
  through: 0.28,
  /** The inside of the eye fills the screen, so the page beneath can move freely. */
  covered: 0.26,
  /** The last lesson on the route has been reached and the far end opens. */
  open: 0.84,
  /** The opening has passed the corners of the screen. */
  clear: 0.985,
};

const PULL_BACK = 0.16; // Orb radii the camera draws back before it lunges.
const PAST = 0.8; // How far the camera keeps going through the last dot while it opens.
const BRAKE = 0.72; // How hard the camera slows at each lesson: the signal jumps from node to node.
const SPACING = 0.035;
const SMOOTHING = 6;
const ARC_STEPS = 12;
const FOLD_STEPS = 6;

export type Vec = [number, number, number];

/** The lessons turned to an angle, in the course sphere's own view, where the viewer stands on +z. */
export function turnPoints(source: ArrayLike<number>, yaw: number, pitch: number, out = new Float32Array(source.length)) {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  for (let index = 0; index < source.length; index += 3) {
    const x = source[index];
    const y = source[index + 1];
    const z = source[index + 2];
    const flat = -x * sinYaw + z * cosYaw;
    out[index] = x * cosYaw + z * sinYaw;
    out[index + 1] = y * cosPitch - flat * sinPitch;
    out[index + 2] = y * sinPitch + flat * cosPitch;
  }
  return out;
}

type Edge = { to: number; related: boolean; cost: number };

function edgesOf(graph: Pick<OrbGraph, "titles" | "links" | "chapterStarts" | "positions">) {
  const edges: Edge[][] = graph.titles.map(() => []);
  const at = (lesson: number) => graph.positions.slice(lesson * 3, lesson * 3 + 3);
  for (let chapter = 0; chapter < graph.chapterStarts.length - 1; chapter++) {
    for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1] - 1; lesson++) {
      edges[lesson].push({ to: lesson + 1, related: false, cost: 1.3 });
      edges[lesson + 1].push({ to: lesson, related: false, cost: 1.3 });
    }
  }
  for (let index = 0; index < graph.links.length; index += 2) {
    const from = graph.links[index];
    const to = graph.links[index + 1];
    const a = at(from);
    const b = at(to);
    // Long links dive deepest through the middle, which is the way through the brain worth taking.
    const cost = 1.1 - Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 0.35;
    edges[from].push({ to, related: true, cost });
    edges[to].push({ to: from, related: true, cost });
  }
  return edges;
}

export type Routes = {
  /** The next lesson on the cheapest way to an exit, or -1 at an exit. */
  toward: Int16Array;
  hops: Int16Array;
  /** Of those hops, how many dive along a related link rather than along a chapter's thread. */
  dives: Int16Array;
  related: (a: number, b: number) => boolean;
};

/** The cheapest way from every lesson to any of the exits, preferring links that dive through the middle. */
export function routesTo(graph: Pick<OrbGraph, "titles" | "links" | "chapterStarts" | "positions">, exits: number[]): Routes {
  const count = graph.titles.length;
  const edges = edgesOf(graph);
  const cost = new Float64Array(count).fill(Infinity);
  const toward = new Int16Array(count).fill(-1);
  const hops = new Int16Array(count).fill(-1);
  const dives = new Int16Array(count);
  const done = new Uint8Array(count);
  for (const exit of exits) { cost[exit] = 0; hops[exit] = 0; }
  for (;;) {
    let lesson = -1;
    for (let index = 0; index < count; index++) if (!done[index] && cost[index] < Infinity && (lesson < 0 || cost[index] < cost[lesson])) lesson = index;
    if (lesson < 0) break;
    done[lesson] = 1;
    for (const edge of edges[lesson]) {
      const through = cost[lesson] + edge.cost;
      if (through < cost[edge.to] - 1e-9) {
        cost[edge.to] = through;
        toward[edge.to] = lesson;
        hops[edge.to] = hops[lesson] + 1;
        dives[edge.to] = dives[lesson] + (edge.related ? 1 : 0);
      }
    }
  }
  const pairs = new Set<number>();
  for (let index = 0; index < graph.links.length; index += 2) {
    pairs.add(graph.links[index] * count + graph.links[index + 1]);
    pairs.add(graph.links[index + 1] * count + graph.links[index]);
  }
  return { toward, hops, dives, related: (a, b) => pairs.has(a * count + b) };
}

export function routeFrom(routes: Routes, start: number) {
  const route = [start];
  for (let lesson = routes.toward[start]; lesson >= 0 && route.length < 40; lesson = routes.toward[lesson]) route.push(lesson);
  return route;
}

export type FlightPath = {
  count: number;
  spacing: number;
  /** Points along the way, then two directions square to it that turn as little as possible. */
  x: Float32Array; y: Float32Array; z: Float32Array;
  nx: Float32Array; ny: Float32Array; nz: Float32Array;
  bx: Float32Array; by: Float32Array; bz: Float32Array;
  /** How far along the path each lesson on the route sits. */
  stops: number[];
  route: number[];
  length: number;
};

/** The camera's path: from where the viewer stands, into the first dot, along each real link in turn, and on through the last. */
export function buildFlightPath(graph: Pick<OrbGraph, "chapterStarts">, turned: ArrayLike<number>, route: number[], routes: Pick<Routes, "related">): FlightPath {
  const at = (lesson: number): Vec => [turned[lesson * 3], turned[lesson * 3 + 1], turned[lesson * 3 + 2]];
  const points: Vec[] = [[0, 0, CAMERA], at(route[0])];
  const marks = [1];
  for (let index = 1; index < route.length; index++) {
    const from = route[index - 1];
    const to = route[index];
    const a = at(from);
    const b = at(to);
    const thread = Math.abs(from - to) === 1 && !routes.related(from, to);
    if (thread) {
      const low = Math.min(from, to);
      let chapter = 0;
      while (graph.chapterStarts[chapter + 1] <= low) chapter++;
      const { before, after } = foldNeighbors(graph.chapterStarts[chapter], graph.chapterStarts[chapter + 1], low);
      const [first, second] = foldHandles(at(before), at(low), at(low + 1), at(after));
      for (let step = 1; step <= FOLD_STEPS; step++) {
        const t = from < to ? step / FOLD_STEPS : 1 - step / FOLD_STEPS;
        points.push(foldPoint(at(low), first, second, at(low + 1), t));
      }
    } else {
      const control = arcControl(a, b);
      for (let step = 1; step <= ARC_STEPS; step++) points.push(arcPoint(a, control, b, step / ARC_STEPS));
    }
    marks.push(points.length - 1);
  }
  const last = points[points.length - 1];
  const before = points[points.length - 2];
  const out = normalize([last[0] - before[0], last[1] - before[1], last[2] - before[2]]);
  points.push([last[0] + out[0] * (PAST + 0.4), last[1] + out[1] * (PAST + 0.4), last[2] + out[2] * (PAST + 0.4)]);

  // Even steps along the way, keeping each lesson on a sample.
  const lengths = [0];
  for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1] + distance(points[index - 1], points[index]));
  const total = lengths[lengths.length - 1];
  const count = Math.max(2, Math.ceil(total / SPACING) + 1);
  const spacing = total / (count - 1);
  const xs = new Float32Array(count);
  const ys = new Float32Array(count);
  const zs = new Float32Array(count);
  for (let sample = 0, segment = 0; sample < count; sample++) {
    const along = sample * spacing;
    while (segment < points.length - 2 && lengths[segment + 1] < along) segment++;
    const span = lengths[segment + 1] - lengths[segment] || 1;
    const t = Math.min(1, Math.max(0, (along - lengths[segment]) / span));
    const a = points[segment];
    const b = points[segment + 1];
    xs[sample] = a[0] + (b[0] - a[0]) * t;
    ys[sample] = a[1] + (b[1] - a[1]) * t;
    zs[sample] = a[2] + (b[2] - a[2]) * t;
  }
  const stops = marks.map((mark) => Math.round(lengths[mark] / spacing));
  // The first dot falls between two samples, so the nearer one is moved onto it: the camera goes through it exactly.
  xs[stops[0]] = points[1][0];
  ys[stops[0]] = points[1][1];
  zs[stops[0]] = points[1][2];

  // Round off the corners at each lesson so the camera swings rather than snapping, keeping the first dot exact.
  const pinned = new Set([0, stops[0], count - 1]);
  for (let pass = 0; pass < SMOOTHING; pass++) {
    for (const values of [xs, ys, zs]) {
      let previous = values[0];
      for (let index = 1; index < count - 1; index++) {
        const current = values[index];
        if (!pinned.has(index)) values[index] = previous * 0.25 + current * 0.5 + values[index + 1] * 0.25;
        previous = current;
      }
    }
  }

  // Directions square to the path that turn as little as possible, so the view doesn't spin on its own.
  const nx = new Float32Array(count); const ny = new Float32Array(count); const nz = new Float32Array(count);
  const bx = new Float32Array(count); const by = new Float32Array(count); const bz = new Float32Array(count);
  let normal: Vec = [0, 1, 0];
  for (let index = 0; index < count; index++) {
    const a = Math.max(0, index - 1);
    const b = Math.min(count - 1, index + 1);
    const tangent = normalize([xs[b] - xs[a], ys[b] - ys[a], zs[b] - zs[a]]);
    const along = dot(normal, tangent);
    normal = normalize([normal[0] - tangent[0] * along, normal[1] - tangent[1] * along, normal[2] - tangent[2] * along]);
    const side = cross(tangent, normal);
    nx[index] = normal[0]; ny[index] = normal[1]; nz[index] = normal[2];
    bx[index] = side[0]; by[index] = side[1]; bz[index] = side[2];
  }

  return { count, spacing, x: xs, y: ys, z: zs, nx, ny, nz, bx, by, bz, stops: stops.map((stop) => stop * spacing), route, length: (count - 1) * spacing };
}

/** A point on the path, carried on in a straight line before its start and after its end. */
export function pathPoint(path: FlightPath, along: number, out: Vec): Vec {
  const place = along / path.spacing;
  const index = Math.min(path.count - 2, Math.max(0, Math.floor(place)));
  const t = place - index;
  out[0] = path.x[index] + (path.x[index + 1] - path.x[index]) * t;
  out[1] = path.y[index] + (path.y[index + 1] - path.y[index]) * t;
  out[2] = path.z[index] + (path.z[index + 1] - path.z[index]) * t;
  return out;
}

export function pathIndex(path: FlightPath, along: number) {
  return Math.min(path.count - 1, Math.max(0, Math.round(along / path.spacing)));
}

const smooth = (t: number) => t * t * (3 - 2 * t);
export const ramp = (from: number, to: number, value: number) => smooth(Math.min(1, Math.max(0, (value - from) / (to - from))));

/** An ease from 0 to 1 that leaves at one speed and arrives at another, relative to going straight across. Monotone up to 3. */
export function hermite(t: number, leave: number, arrive: number) {
  return (leave + arrive - 2) * t * t * t + (3 - 2 * leave - arrive) * t * t + leave * t;
}

/**
 * How far along the path the camera is at a point in the flight. It draws back, lunges into the dot faster and faster
 * and carries that speed through it, then jumps lesson to lesson, quick between them and braking at each, and
 * punches on through the last one.
 */
export function flightDistance(path: Pick<FlightPath, "stops">, progress: number) {
  const { stops } = path;
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (progress <= FLIGHT.pull) return -PULL_BACK * Math.sin((Math.max(0, progress) / FLIGHT.pull) * Math.PI / 2);
  if (progress < FLIGHT.through) {
    const t = (progress - FLIGHT.pull) / (FLIGHT.through - FLIGHT.pull);
    return -PULL_BACK + (first + PULL_BACK) * t * t;
  }
  const end = FLIGHT.open + 0.02;
  if (progress < end) {
    const hops = Math.max(1, stops.length - 1);
    const place = ((progress - FLIGHT.through) / (end - FLIGHT.through)) * hops;
    const hop = Math.min(hops - 1, Math.floor(place));
    const from = stops[Math.min(hop, stops.length - 1)];
    const to = stops[Math.min(hop + 1, stops.length - 1)];
    return from + (to - from) * hermite(place - hop, hop === 0 ? 3 : 1 - BRAKE, 1 - BRAKE);
  }
  return last + PAST * Math.sin(((Math.min(1, progress) - end) / (1 - end)) * Math.PI / 2);
}

/** Where to settle once scrolling stops partway: on through with the smallest push, back with the smallest pull. */
export function settleTo(progress: number, direction: number, nudge = 0.05) {
  if (direction > 0) return progress >= nudge ? 1 : 0;
  if (direction < 0) return progress <= 1 - nudge ? 0 : 1;
  return progress < 0.5 ? 0 : 1;
}

function normalize(v: Vec): Vec {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const distance = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
