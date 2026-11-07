import { FLIGHT, hermite, MOST_PASSED, ramp, stopsFor } from "./neuron-route";

// The inside of the dive as a film: one neuron, from the cell body the camera enters, down its axon past a node of
// Ranvier for each lesson on the route, to the terminal that opens on the game. Everything here is arithmetic shared by
// the shader that draws it and the page that captions it, so a lesson's caption arrives with its node.

/** Where the film starts and how its parts sit along the axon, in axon radii. */
export const FILM = {
  /** The camera's first place, just outside the cell's membrane, which it punches through. */
  enter: -5.2,
  membrane: -3.0,
  /** Where the camera holds inside the cell body, with the nucleus ahead to one side and the hillock beyond. */
  soma: -1.7,
  /** The hillock, where the cell body has narrowed into the axon, and where each signal starts. */
  axon: 2.6,
  /** From one node of Ranvier to the next: much shorter than a real internode, which would take minutes at this speed. */
  internode: 5.4,
  /** How far short of a node the camera holds, so its ring of channels is in view as it fires. */
  short: 1.15,
  /** In the last hop, the share of it the camera takes to reach the terminal, where it rests while the end opens. */
  arrive: 0.68,
};

export type Film = {
  /** Lesson names: one per node, then the terminal's. */
  names: string[];
  /** Where each node of Ranvier sits. */
  nodes: number[];
  /** Side branches at each node: the lesson's other real links, up to three. */
  branches: number[];
  /** The cell membrane the camera enters through. */
  membrane: number;
  /** The terminal swells from here, and its membrane closes it there. */
  swell: number;
  end: number;
  /** The axon's winding, from the route itself, so each dive is its own. */
  wind: [number, number, number, number];
  phase: [number, number, number, number];
  /** The stops on the flight, from the orb to the game, and how deep the camera is at each. */
  stops: number[];
  holds: number[];
};

export type Shot = {
  /** Where the camera is along the axon, and the signal ahead of it. */
  depth: number;
  signal: number;
  position: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
  forward: [number, number, number];
  /** Pixels from the lens to the screen, and the point on screen straight ahead. */
  focal: number;
  centerX: number;
  centerY: number;
  /** How fast the camera is going, 0 to 1, for the blur. */
  rush: number;
  /** How still the camera is, 1 while it holds at a stop: the cell goes on living around it. */
  rest: number;
  /** The vesicles in the terminal releasing, and the membrane opening. */
  release: number;
  hole: number;
  /** How far the cell membrane has torn open around the camera. */
  tear: number;
};

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The film for one route through the orb: the lessons it passes, and how many other links each has. */
export function makeFilm(route: number[], titles: string[], degrees: number[]): Film {
  const passed = route.slice(1, -1).slice(0, MOST_PASSED);
  // A route of one hop still passes a node: the axon needs one to read as an axon, so it's left unnamed.
  const nodeCount = Math.max(1, passed.length);
  const nodes = Array.from({ length: nodeCount }, (_, index) => FILM.axon + FILM.internode * (index + 1));
  const last = nodes[nodes.length - 1];
  const swell = last + FILM.internode * 0.7;
  const end = swell + 3.2;
  const seed = route.reduce((sum, lesson, index) => sum + lesson * (index + 1) * 7.13, 0);
  return {
    names: [...nodes.map((_, index) => (passed[index] !== undefined ? titles[passed[index]] : "")), titles[route[route.length - 1]]],
    nodes,
    branches: nodes.map((_, index) => (passed[index] !== undefined ? Math.max(0, Math.min(3, degrees[passed[index]] - 1)) : 1)),
    membrane: FILM.membrane,
    swell,
    end,
    wind: [0.32 + hash(seed) * 0.22, 0.21 + hash(seed + 1) * 0.08, 0.12 + hash(seed + 2) * 0.1, 0.47 + hash(seed + 3) * 0.12],
    phase: [hash(seed + 4) * 6.28, hash(seed + 5) * 6.28, hash(seed + 6) * 6.28, hash(seed + 7) * 6.28],
    stops: stopsFor(nodeCount),
    holds: [FILM.enter, FILM.soma, ...nodes.map((node) => node - FILM.short), end - 2],
  };
}

/** The axon's center line at a depth. The shader has the same function. */
export function axisAt(film: Pick<Film, "wind" | "phase">, z: number): [number, number] {
  const [a1, f1, a2, f2] = film.wind;
  const [p1, p2, p3, p4] = film.phase;
  return [
    a1 * Math.sin(z * f1 + p1) + a2 * Math.sin(z * f2 + p2),
    a1 * 0.7 * Math.sin(z * f1 * 0.83 + p3) + a2 * 0.8 * Math.cos(z * f2 * 1.21 + p4),
  ];
}

/** Which hop of the flight a point is in, and how far through it, 0 to 1. */
function hopAt(stops: number[], progress: number) {
  let hop = 0;
  while (hop < stops.length - 2 && progress > stops[hop + 1]) hop++;
  return { hop, t: Math.min(1, Math.max(0, (progress - stops[hop]) / (stops[hop + 1] - stops[hop]))) };
}

/**
 * How far down the neuron the camera is at a point in the flight. It drifts outside the cell while the dot opens,
 * punches through the membrane and comes to rest inside the cell body, then glides node to node, resting short of
 * each, and runs on to the terminal, where it rests while the end opens.
 */
export function filmDepth(film: Pick<Film, "stops" | "holds">, progress: number) {
  const { stops, holds } = film;
  const { hop, t } = hopAt(stops, progress);
  const from = holds[hop];
  const to = holds[hop + 1];
  if (hop === 0) return from + (to - from) * hermite(Math.min(1, Math.max(0, (progress - 0.04) / (stops[1] - 0.04))), 0, 0);
  if (hop === stops.length - 2) return from + (to - from) * (0.93 * hermite(Math.min(1, t / FILM.arrive), 0, 0) + 0.07 * t);
  return from + (to - from) * hermite(t, 0, 0);
}

/**
 * Where the signal is. It starts at the hillock and jumps ahead from node to node, the way it really travels down a
 * myelinated axon, and the camera follows: at each stop the node ahead is lit, and as the camera leaves, it leaps on.
 */
export function signalDepth(film: Pick<Film, "stops" | "nodes" | "end">, progress: number) {
  const targets = [FILM.axon + 0.6, ...film.nodes, film.end - 0.3];
  const { hop, t } = hopAt(film.stops, progress);
  if (hop === 0) return targets[0];
  const from = targets[hop - 1];
  const to = targets[Math.min(targets.length - 1, hop)];
  return from + (to - from) * ramp(0.02, 0.35, t);
}

/** How still the camera is at a point in the flight: 1 at a stop inside the neuron, falling away as it moves on. */
export function restAt(film: Pick<Film, "stops">, progress: number) {
  const { stops } = film;
  let rest = 0;
  for (let stop = 1; stop < stops.length - 1; stop++) {
    const span = Math.min(stops[stop] - stops[stop - 1], stops[stop + 1] - stops[stop]);
    rest = Math.max(rest, 1 - ramp(0, 0.22, Math.abs(progress - stops[stop]) / span));
  }
  return rest;
}

/**
 * The camera for one frame, looking down the axon ahead of it, banking into its turns. Time sets the slow drift it
 * makes while it rests at a stop, and pace, in flight per second, how fast it's going, for the blur.
 */
export function shoot(film: Film, progress: number, width: number, height: number, centerX: number, centerY: number, time = 0, pace = 0): Shot {
  const depth = filmDepth(film, progress);
  const rest = restAt(film, progress);
  // At rest it breathes, the way a hand-held camera does, so the cell never looks frozen.
  const sway = rest * Math.min(1, Math.max(0, (depth - FILM.membrane) / 1.2));
  const ahead = depth + 1.6 + sway * 0.12 * Math.sin(time * 0.31);
  // A quarter of the way off the axis, so the wall reads as a lit surface and not a tunnel's vanishing point.
  const [cx, cy] = axisAt(film, depth);
  const drift = 0.8 + depth * 0.12 + sway * 0.35 * Math.sin(time * 0.17);
  // Back nearer the axis at each node, where the axon narrows and the microtubules crowd in.
  const nearest = film.nodes.reduce((gap, node) => Math.min(gap, Math.abs(depth - node)), Infinity);
  const off = 0.22 * Math.min(1, Math.max(0, (depth - FILM.membrane) / 2)) * (1 - 0.8 * Math.exp(-nearest * nearest * 1.5));
  const x = cx + Math.cos(drift) * off + sway * 0.05 * Math.sin(time * 0.53);
  const y = cy + Math.sin(drift) * off + sway * 0.04 * Math.sin(time * 0.41 + 1);
  const [lx, ly] = axisAt(film, ahead);
  const forward = normalize([lx - x, ly - y, ahead - depth]);
  // Bank against the way the axon bends, as anything rushing down a winding tube would.
  const [bx] = axisAt(film, depth + 3.2);
  const roll = Math.max(-0.5, Math.min(0.5, (bx - 2 * lx + x) * 0.9)) + 0.18 * Math.sin(depth * 0.37) + sway * 0.04 * Math.sin(time * 0.23);
  const flatRight = normalize([forward[2], 0, -forward[0]]);
  const flatUp = cross(forward, flatRight);
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const right: [number, number, number] = [flatRight[0] * cos + flatUp[0] * sin, flatRight[1] * cos + flatUp[1] * sin, flatRight[2] * cos + flatUp[2] * sin];
  const up: [number, number, number] = [flatUp[0] * cos - flatRight[0] * sin, flatUp[1] * cos - flatRight[1] * sin, flatUp[2] * cos - flatRight[2] * sin];
  const slope = (filmDepth(film, Math.min(1, progress + 0.003)) - filmDepth(film, Math.max(0, progress - 0.003))) / 0.006;
  const rush = Math.min(1, Math.max(0, (Math.abs(slope * pace) - 1.5) / 9));
  // The view widens as the camera picks up speed.
  const focal = 0.55 * Math.hypot(width, height) * (1 - 0.22 * rush);
  return {
    depth,
    signal: signalDepth(film, progress),
    position: [x, y, depth],
    right,
    up,
    forward,
    focal,
    centerX,
    centerY,
    rush,
    rest,
    release: ramp(FLIGHT.release, FLIGHT.open, progress),
    hole: ramp(FLIGHT.open, FLIGHT.clear, progress),
    tear: Math.max(0, (depth - FILM.membrane + 0.35) * 4),
  };
}

/** Where a point in the neuron lands on screen, or null behind the camera. */
export function onFilm(shot: Shot, point: [number, number, number]) {
  const dx = point[0] - shot.position[0];
  const dy = point[1] - shot.position[1];
  const dz = point[2] - shot.position[2];
  const z = dx * shot.forward[0] + dy * shot.forward[1] + dz * shot.forward[2];
  if (z < 0.05) return null;
  const s = shot.focal / z;
  return {
    x: shot.centerX + (dx * shot.right[0] + dy * shot.right[1] + dz * shot.right[2]) * s,
    y: shot.centerY - (dx * shot.up[0] + dy * shot.up[1] + dz * shot.up[2]) * s,
    z,
    scale: s,
  };
}

function normalize(v: [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
const cross = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
