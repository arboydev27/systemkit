import { hermite, ramp } from "./neuron-route";

// The inside of the dive as a film: one neuron, from the cell body the camera enters, down its axon past a node of
// Ranvier for each lesson on the route, to the terminal that opens on the game. Everything here is arithmetic shared by
// the shader that draws it and the page that labels it, so a lesson's name lands on its node.

/** Where the film starts and how its parts sit along the axon, in axon radii. */
export const FILM = {
  /** The camera's first place, just outside the cell's membrane, which it punches through. */
  enter: -5.2,
  membrane: -3.0,
  /** The hillock, where the cell body has narrowed into the axon. */
  axon: 2.6,
  /** From one node of Ranvier to the next: much shorter than a real internode, which would take minutes at this speed. */
  internode: 5.4,
  /** The camera reaches the axon's first stretch here, after the dot has opened. */
  inside: 0.28,
  /** The last node is passed and the terminal comes up. */
  terminal: 0.8,
  /** The membrane at the end opens on the game. */
  open: 0.86,
  clear: 0.985,
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
  /** The camera's stops: the hillock, each node, then just short of the terminal's membrane. */
  stops: number[];
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

/** The film for one route through the course: the lessons it passes, and how many other links each has. */
export function makeFilm(route: number[], titles: string[], degrees: number[]): Film {
  const passed = route.slice(1, -1);
  // A route of one hop still passes a node: the axon needs one to read as an axon, so it's left unnamed.
  const nodeCount = Math.max(1, Math.min(4, passed.length));
  const nodes = Array.from({ length: nodeCount }, (_, index) => FILM.axon + FILM.internode * (index + 1));
  const last = nodes[nodes.length - 1];
  const swell = last + FILM.internode * 0.7;
  const end = swell + 3.2;
  const seed = route.reduce((sum, lesson, index) => sum + lesson * (index + 1) * 7.13, 0);
  return {
    names: [...Array.from({ length: nodeCount }, (_, index) => (passed[index] !== undefined ? titles[passed[index]] : "")), titles[route[route.length - 1]]],
    nodes,
    branches: nodes.map((_, index) => (passed[index] !== undefined ? Math.max(0, Math.min(3, degrees[passed[index]] - 1)) : 1)),
    membrane: FILM.membrane,
    swell,
    end,
    wind: [0.32 + hash(seed) * 0.22, 0.21 + hash(seed + 1) * 0.08, 0.12 + hash(seed + 2) * 0.1, 0.47 + hash(seed + 3) * 0.12],
    phase: [hash(seed + 4) * 6.28, hash(seed + 5) * 6.28, hash(seed + 6) * 6.28, hash(seed + 7) * 6.28],
    stops: [FILM.axon, ...nodes, end - 1.25],
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

/**
 * How far down the neuron the camera is at a point in the flight. It drifts in the cell body while the dot opens,
 * is drawn into the hillock, then runs node to node, braking through each as it lights, and eases up to the terminal.
 */
export function filmDepth(film: Pick<Film, "stops">, progress: number) {
  const { stops } = film;
  if (progress <= FILM.inside) {
    const t = Math.min(1, Math.max(0, (progress - 0.04) / (FILM.inside - 0.04)));
    return FILM.enter + (FILM.axon - FILM.enter) * t * t;
  }
  if (progress < FILM.terminal) {
    const hops = stops.length - 2;
    const place = ((progress - FILM.inside) / (FILM.terminal - FILM.inside)) * hops;
    const hop = Math.min(hops - 1, Math.floor(place));
    return stops[hop] + (stops[hop + 1] - stops[hop]) * hermite(place - hop, hop === 0 ? 2.2 : 0.45, 0.45);
  }
  const t = Math.min(1, (progress - FILM.terminal) / (1 - FILM.terminal));
  const from = stops[stops.length - 2];
  return from + (stops[stops.length - 1] - from) * hermite(t, 0.45, 0);
}

/**
 * Where the signal is. It jumps ahead from node to node, the way it really travels down a myelinated axon, and the
 * camera chases it: it waits at the next node, lit, until the camera is most of the way there, then leaps on.
 */
export function signalDepth(film: Pick<Film, "stops" | "end">, progress: number) {
  const { stops } = film;
  const targets = [...stops.slice(1, -1), film.end];
  if (progress <= FILM.inside) return targets[0];
  if (progress >= FILM.terminal) return film.end;
  const hops = stops.length - 2;
  const place = ((progress - FILM.inside) / (FILM.terminal - FILM.inside)) * hops;
  const hop = Math.min(hops - 1, Math.floor(place));
  const leap = ramp(0.62, 0.96, place - hop);
  const from = targets[hop];
  const to = targets[Math.min(targets.length - 1, hop + 1)];
  return from + (to - from) * leap;
}

/** The camera for one frame, looking down the axon ahead of it, banking into its turns. */
export function shoot(film: Film, progress: number, width: number, height: number, centerX: number, centerY: number): Shot {
  const depth = filmDepth(film, progress);
  const ahead = depth + 1.6;
  // A quarter of the way off the axis, so the wall reads as a lit surface and not a tunnel's vanishing point.
  const [cx, cy] = axisAt(film, depth);
  const drift = 0.8 + depth * 0.12;
  // Back on the axis through each node, where the axon narrows and the microtubules crowd in.
  const nearest = film.nodes.reduce((gap, node) => Math.min(gap, Math.abs(depth - node)), Infinity);
  const off = 0.22 * Math.min(1, Math.max(0, (depth - FILM.membrane) / 2)) * (1 - 0.8 * Math.exp(-nearest * nearest * 1.5));
  const x = cx + Math.cos(drift) * off;
  const y = cy + Math.sin(drift) * off;
  const [lx, ly] = axisAt(film, ahead);
  const forward = normalize([lx - x, ly - y, ahead - depth]);
  // Bank against the way the axon bends, as anything rushing down a winding tube would.
  const [bx] = axisAt(film, depth + 3.2);
  const roll = Math.max(-0.5, Math.min(0.5, (bx - 2 * lx + x) * 0.9)) + 0.18 * Math.sin(depth * 0.37);
  const flatRight = normalize([forward[2], 0, -forward[0]]);
  const flatUp = cross(forward, flatRight);
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const right: [number, number, number] = [flatRight[0] * cos + flatUp[0] * sin, flatRight[1] * cos + flatUp[1] * sin, flatRight[2] * cos + flatUp[2] * sin];
  const up: [number, number, number] = [flatUp[0] * cos - flatRight[0] * sin, flatUp[1] * cos - flatRight[1] * sin, flatUp[2] * cos - flatRight[2] * sin];
  const speed = (filmDepth(film, Math.min(1, progress + 0.005)) - filmDepth(film, Math.max(0, progress - 0.005))) / 0.01;
  const rush = Math.min(1, Math.max(0, speed / 34));
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
    release: ramp(FILM.terminal + 0.02, FILM.open, progress),
    hole: ramp(FILM.open, FILM.clear, progress),
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
