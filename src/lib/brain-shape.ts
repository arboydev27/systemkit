// The shape the course map is drawn on: a brain, as a smooth union of a few ellipsoids. Two hemispheres with a
// fissure between them, each with a frontal, parietal, occipital and temporal bulge, a cerebellum tucked under the
// back, and the brainstem. Pure arithmetic, shared by the layout at build time, the first paint, the live map and
// the dive, so all of them agree on where the surface is.
//
// Axes: x runs from the left hemisphere to the right, y up, and z toward the front. Distances are signed: negative
// inside. The whole brain fits inside the unit sphere, which is what the map's camera frames.

export type Vec3 = [number, number, number];

/** The pieces drawn as separate bodies, so a nearer one can cover a farther one's outline. */
export const PIECES = ["left", "right", "cerebellum", "stem"] as const;
export type Piece = (typeof PIECES)[number];

// Anatomical units: the origin is the middle of the cerebrum and one unit is half its length. The shapes are fitted to
// the MNI152 average adult brain, then the whole is moved and scaled to fit the unit sphere.
const CENTER: Vec3 = [0, -0.175, -0.005];
const SCALE = 0.95;
const GAP = 0.012; // Half the width of the longitudinal fissure.

/** An ellipsoid, optionally tipped: first in the x–z plane, then in the y–z plane, by angles in radians. */
type Ellipsoid = { c: Vec3; r: Vec3; xz?: number; yz?: number };
const MAIN: Ellipsoid = { c: [0.2, 0.08, -0.08], r: [0.59, 0.38, 0.79] };
const CROWN: Ellipsoid = { c: [0.15, 0.28, -0.1], r: [0.5, 0.43, 0.7] };
const FRONTAL: Ellipsoid = { c: [0.15, -0.09, 0.54], r: [0.48, 0.42, 0.45] };
const OCCIPITAL: Ellipsoid = { c: [0.22, -0.18, -0.73], r: [0.33, 0.24, 0.27] };
const TEMPORAL: Ellipsoid = { c: [0.47, -0.3, -0.09], r: [0.32, 0.3, 0.65], xz: -0.15, yz: -0.44 };
const CEREBELLAR: Ellipsoid = { c: [0.25, -0.61, -0.51], r: [0.37, 0.25, 0.33], yz: -0.33 };
const VERMIS: Ellipsoid = { c: [0, -0.38, -0.45], r: [0.2, 0.17, 0.19] };
const PONS: Ellipsoid = { c: [0, -0.53, -0.13], r: [0.22, 0.22, 0.19] };
const STEM_TOP: Vec3 = [0, -0.32, -0.17];
const STEM_END: Vec3 = [0, -0.97, -0.31];

function ellipsoid(x: number, y: number, z: number, { c, r, xz, yz }: Ellipsoid) {
  let px = x - c[0];
  let py = y - c[1];
  let pz = z - c[2];
  if (xz) {
    const cos = Math.cos(xz), sin = Math.sin(xz);
    const nx = cos * px - sin * pz;
    pz = sin * px + cos * pz;
    px = nx;
  }
  if (yz) {
    const cos = Math.cos(yz), sin = Math.sin(yz);
    const ny = cos * py - sin * pz;
    pz = sin * py + cos * pz;
    py = ny;
  }
  // Square roots rather than Math.hypot, which is several times slower and this runs a few hundred thousand times.
  const ax = px / r[0], ay = py / r[1], az = pz / r[2];
  const bx = ax / r[0], by = ay / r[1], bz = az / r[2];
  const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
  const k1 = Math.sqrt(bx * bx + by * by + bz * bz);
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

/**
 * The lobes, as regions rather than shapes: each point of the cerebrum leans toward the nearest of these, which is how
 * the parts of the course are given their lobes. The frontal lobe takes the front and top as far back as the central
 * sulcus, the parietal the crown behind it, the occipital the back, and the temporal the side below the Sylvian fissure.
 */
export const LOBES = ["frontal", "parietal", "occipital", "temporal"] as const;
export type Lobe = (typeof LOBES)[number];
const LOBE_SHAPES: Record<Lobe, Ellipsoid> = {
  frontal: { c: [0.2, 0.12, 0.5], r: [0.55, 0.6, 0.55] },
  parietal: { c: [0.25, 0.5, -0.35], r: [0.5, 0.4, 0.5] },
  occipital: { c: [0.22, -0.12, -0.8], r: [0.4, 0.4, 0.35] },
  temporal: TEMPORAL,
};

/** Converts a point in the unit sphere to the anatomical units the shapes are written in. */
const toAnatomy = (x: number, y: number, z: number): Vec3 => [x / SCALE + CENTER[0], y / SCALE + CENTER[1], z / SCALE + CENTER[2]];
export const fromAnatomy = (p: Vec3): Vec3 => [(p[0] - CENTER[0]) * SCALE, (p[1] - CENTER[1]) * SCALE, (p[2] - CENTER[2]) * SCALE];

function hemisphere(x: number, y: number, z: number) {
  const lx = Math.abs(x);
  let d = smin(ellipsoid(lx, y, z, MAIN), ellipsoid(lx, y, z, CROWN), 0.2);
  d = smin(d, ellipsoid(lx, y, z, FRONTAL), 0.2);
  d = smin(d, ellipsoid(lx, y, z, OCCIPITAL), 0.2);
  // A tighter blend keeps the crease of the Sylvian fissure above the temporal lobe.
  d = smin(d, ellipsoid(lx, y, z, TEMPORAL), 0.06);
  return smax(d, GAP - lx, 0.03);
}

function cerebellum(x: number, y: number, z: number) {
  return smin(ellipsoid(Math.abs(x), y, z, CEREBELLAR), ellipsoid(x, y, z, VERMIS), 0.13);
}

function stem(x: number, y: number, z: number) {
  const ax = STEM_END[0] - STEM_TOP[0];
  const ay = STEM_END[1] - STEM_TOP[1];
  const az = STEM_END[2] - STEM_TOP[2];
  const t = Math.min(1, Math.max(0, ((x - STEM_TOP[0]) * ax + (y - STEM_TOP[1]) * ay + (z - STEM_TOP[2]) * az) / (ax * ax + ay * ay + az * az)));
  // Narrower toward the spinal cord.
  const dx = x - STEM_TOP[0] - ax * t, dy = y - STEM_TOP[1] - ay * t, dz = z - STEM_TOP[2] - az * t;
  const capsule = Math.sqrt(dx * dx + dy * dy + dz * dz) - (0.125 - 0.025 * t);
  return smin(capsule, ellipsoid(x, y, z, PONS), 0.04);
}

/** Signed distance to one piece, in the unit sphere's units. */
export function pieceField(piece: Piece, x: number, y: number, z: number) {
  const [ax, ay, az] = toAnatomy(x, y, z);
  const d = piece === "stem" ? stem(ax, ay, az)
    : piece === "cerebellum" ? cerebellum(ax, ay, az)
      : (piece === "left" ? ax <= 0 : ax >= 0) ? hemisphere(ax, ay, az) : hemisphere(ax, ay, az) + Math.abs(ax) * 2;
  return d * SCALE;
}

/** Signed distance to the cerebrum, both hemispheres and the fissure between them. */
export function cerebrumField(x: number, y: number, z: number) {
  const [ax, ay, az] = toAnatomy(x, y, z);
  return hemisphere(ax, ay, az) * SCALE;
}

/** Signed distance to the whole brain. */
export function brainField(x: number, y: number, z: number) {
  const [ax, ay, az] = toAnatomy(x, y, z);
  return Math.min(hemisphere(ax, ay, az), cerebellum(ax, ay, az), stem(ax, ay, az)) * SCALE;
}

/** How much a point prefers one lobe over others: negative where it's nearer the first. */
export function lobePreference(point: Vec3, lobe: Lobe, others: Lobe[]) {
  const [x, y, z] = toAnatomy(point[0], point[1], point[2]);
  const lx = Math.abs(x);
  const own = ellipsoid(lx, y, z, LOBE_SHAPES[lobe]);
  return own - Math.min(...others.map((other) => ellipsoid(lx, y, z, LOBE_SHAPES[other])));
}

type Field = (x: number, y: number, z: number) => number;

/** The outward direction of a field's surface at a point. */
export function normalOf(field: Field, p: ArrayLike<number>, out: Vec3 = [0, 0, 0]): Vec3 {
  const e = 0.004;
  const x = p[0];
  const y = p[1];
  const z = p[2];
  out[0] = field(x + e, y, z) - field(x - e, y, z);
  out[1] = field(x, y + e, z) - field(x, y - e, z);
  out[2] = field(x, y, z + e) - field(x, y, z - e);
  const length = Math.sqrt(out[0] * out[0] + out[1] * out[1] + out[2] * out[2]) || 1;
  out[0] /= length;
  out[1] /= length;
  out[2] /= length;
  return out;
}

/** Moves a point onto a field's surface, along the way the field falls fastest. The last direction is left in `normal`. */
export function ontoSurface(field: Field, p: Vec3, steps = 6, normal: Vec3 = [0, 0, 0]): Vec3 {
  for (let step = 0; step < steps; step++) {
    const d = field(p[0], p[1], p[2]);
    normalOf(field, p, normal);
    if (Math.abs(d) < 1e-5) break;
    p[0] -= normal[0] * d;
    p[1] -= normal[1] * d;
    p[2] -= normal[2] * d;
  }
  return p;
}

/** Evenly turned directions on the unit sphere. */
export function fibonacci(count: number, out: Vec3[] = []): Vec3[] {
  const turn = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    const y = 1 - (2 * index + 1) / count;
    const ring = Math.sqrt(1 - y * y);
    out.push([Math.cos(turn * index) * ring, y, Math.sin(turn * index) * ring]);
  }
  return out;
}

/** An ellipsoid around each piece, with its middle inside the piece, that surface points walk in from. */
const HULLS: Record<Piece, { c: Vec3; r: Vec3 }> = {
  right: { c: fromAnatomy([0.38, 0.02, -0.04]), r: [0.5 * SCALE, 0.84 * SCALE, 1.08 * SCALE] },
  left: { c: fromAnatomy([-0.38, 0.02, -0.04]), r: [0.5 * SCALE, 0.84 * SCALE, 1.08 * SCALE] },
  cerebellum: { c: fromAnatomy([0, -0.56, -0.48]), r: [0.7 * SCALE, 0.48 * SCALE, 0.46 * SCALE] },
  stem: { c: fromAnatomy([0, -0.62, -0.2]), r: [0.26 * SCALE, 0.46 * SCALE, 0.26 * SCALE] },
};

/**
 * Points over a piece's surface, pulled in by `inset` so that discs of that radius around them cover exactly the
 * piece's outline on screen. Each starts on a box around the piece and walks straight in to the first place it meets
 * the surface, which is quick enough to do in the browser as the page loads.
 */
export function pieceSamples(piece: Piece, count: number, inset: number) {
  const { c, r } = HULLS[piece];
  const out = new Float32Array(count * 3);
  const directions = fibonacci(count);
  const STRIDES = 10;
  for (let index = 0; index < count; index++) {
    const d = directions[index];
    const fx = c[0] + d[0] * r[0];
    const fy = c[1] + d[1] * r[1];
    const fz = c[2] + d[2] * r[2];
    const at = (t: number) => pieceField(piece, fx + (c[0] - fx) * t, fy + (c[1] - fy) * t, fz + (c[2] - fz) * t);
    // Coarse steps in from outside until the walk is inside, then halving the last step.
    let outside = 0;
    let inside = 1;
    for (let stride = 1; stride <= STRIDES; stride++) {
      if (at(stride / STRIDES) < 0) { inside = stride / STRIDES; break; }
      outside = stride / STRIDES;
    }
    for (let halving = 0; halving < 7; halving++) {
      const middle = (outside + inside) / 2;
      if (at(middle) < 0) inside = middle; else outside = middle;
    }
    const length = Math.hypot(c[0] - fx, c[1] - fy, c[2] - fz) || 1;
    const t = Math.min(1, (outside + inside) / 2 + inset / length);
    out[index * 3] = fx + (c[0] - fx) * t;
    out[index * 3 + 1] = fy + (c[1] - fy) * t;
    out[index * 3 + 2] = fz + (c[2] - fz) * t;
  }
  return out;
}

/** Each piece's samples, worked out once. The disc radius that covers them is SAMPLE_REACH. */
export const SAMPLE_REACH = 0.075;
const SAMPLE_COUNTS: Record<Piece, number> = { left: 700, right: 700, cerebellum: 260, stem: 120 };
let samples: Record<Piece, Float32Array> | null = null;
export function bodySamples() {
  samples ??= {
    left: pieceSamples("left", SAMPLE_COUNTS.left, SAMPLE_REACH * 0.72),
    right: pieceSamples("right", SAMPLE_COUNTS.right, SAMPLE_REACH * 0.72),
    cerebellum: pieceSamples("cerebellum", SAMPLE_COUNTS.cerebellum, SAMPLE_REACH * 0.72),
    stem: pieceSamples("stem", SAMPLE_COUNTS.stem, SAMPLE_REACH * 0.72),
  };
  return samples;
}

/** The middle of each piece, which sets the order the pieces are drawn in. */
export const PIECE_CENTERS: Record<Piece, Vec3> = {
  left: fromAnatomy([-0.4, 0.02, -0.04]),
  right: fromAnatomy([0.4, 0.02, -0.04]),
  cerebellum: fromAnatomy([0, -0.6, -0.5]),
  stem: fromAnatomy([0, -0.62, -0.2]),
};

/**
 * The outline of a set of discs on screen: one closed loop of points per separate patch, smoothed. Points come as
 * x, y pairs with one radius each, in any unit; `cell` is the grid's spacing in the same unit, which sets how fine
 * the outline is. A marching-squares trace over the summed coverage of the discs, so it's the same shape every time.
 */
export function discOutline(points: ArrayLike<number>, radii: ArrayLike<number>, cell: number): number[][] {
  const count = radii.length;
  if (!count) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let index = 0; index < count; index++) {
    const x = points[index * 2];
    const y = points[index * 2 + 1];
    const r = radii[index];
    if (x - r < minX) minX = x - r;
    if (y - r < minY) minY = y - r;
    if (x + r > maxX) maxX = x + r;
    if (y + r > maxY) maxY = y + r;
  }
  minX -= cell * 2; minY -= cell * 2; maxX += cell * 2; maxY += cell * 2;
  const columns = Math.ceil((maxX - minX) / cell) + 1;
  const rows = Math.ceil((maxY - minY) / cell) + 1;
  // Each disc adds a smooth bump, so the outline runs where the discs have covered the plane and stays round.
  const grid = new Float32Array(columns * rows);
  for (let index = 0; index < count; index++) {
    const x = points[index * 2];
    const y = points[index * 2 + 1];
    const r = radii[index];
    const reach = r * 1.25;
    const fromColumn = Math.max(0, Math.floor((x - reach - minX) / cell));
    const toColumn = Math.min(columns - 1, Math.ceil((x + reach - minX) / cell));
    const fromRow = Math.max(0, Math.floor((y - reach - minY) / cell));
    const toRow = Math.min(rows - 1, Math.ceil((y + reach - minY) / cell));
    const inverse = 1 / (r * r);
    for (let row = fromRow; row <= toRow; row++) {
      const dy = minY + row * cell - y;
      for (let column = fromColumn; column <= toColumn; column++) {
        const dx = minX + column * cell - x;
        const t = 1 - (dx * dx + dy * dy) * inverse * 0.64;
        if (t > 0) grid[row * columns + column] += t * t * t;
      }
    }
  }
  const LEVEL = 0.3;
  // Where the outline crosses each grid edge: horizontal edges first, then vertical ones.
  const crossing = (a: number, b: number) => (LEVEL - a) / (b - a);
  const edgePoint = (edge: number): [number, number] => {
    if (edge < columns * rows) {
      const row = Math.floor(edge / columns);
      const column = edge % columns;
      const t = crossing(grid[row * columns + column], grid[row * columns + column + 1]);
      return [minX + (column + t) * cell, minY + row * cell];
    }
    const vertical = edge - columns * rows;
    const row = Math.floor(vertical / columns);
    const column = vertical % columns;
    const t = crossing(grid[row * columns + column], grid[(row + 1) * columns + column]);
    return [minX + column * cell, minY + (row + t) * cell];
  };
  const next = new Map<number, number>();
  const horizontal = (row: number, column: number) => row * columns + column;
  const vertical = (row: number, column: number) => columns * rows + row * columns + column;
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = grid[row * columns + column] > LEVEL ? 1 : 0;
      const b = grid[row * columns + column + 1] > LEVEL ? 2 : 0;
      const c = grid[(row + 1) * columns + column + 1] > LEVEL ? 4 : 0;
      const d = grid[(row + 1) * columns + column] > LEVEL ? 8 : 0;
      const kind = a | b | c | d;
      if (kind === 0 || kind === 15) continue;
      const top = horizontal(row, column);
      const bottom = horizontal(row + 1, column);
      const left = vertical(row, column);
      const right = vertical(row, column + 1);
      // Each segment runs with the inside on its left, so the loops close the same way round.
      const link = (from: number, to: number) => next.set(from, to);
      switch (kind) {
        case 1: link(left, top); break;
        case 2: link(top, right); break;
        case 3: link(left, right); break;
        case 4: link(right, bottom); break;
        case 5: link(left, top); link(right, bottom); break;
        case 6: link(top, bottom); break;
        case 7: link(left, bottom); break;
        case 8: link(bottom, left); break;
        case 9: link(bottom, top); break;
        case 10: link(top, right); link(bottom, left); break;
        case 11: link(bottom, right); break;
        case 12: link(right, left); break;
        case 13: link(right, top); break;
        case 14: link(top, left); break;
      }
    }
  }
  const loops: number[][] = [];
  const seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: number[] = [];
    for (let edge: number | undefined = start; edge !== undefined && !seen.has(edge); edge = next.get(edge)) {
      seen.add(edge);
      const [x, y] = edgePoint(edge);
      loop.push(x, y);
    }
    if (loop.length >= 12) loops.push(smoothLoop(loop));
  }
  // Gaps between discs inside a patch trace loops that turn the other way round. They aren't outline, so they go.
  const turning = loops.map(signedArea);
  const outer = Math.sign(turning.reduce((most, area) => Math.abs(area) > Math.abs(most) ? area : most, 0));
  return loops.filter((_, index) => Math.sign(turning[index]) === outer);
}

function signedArea(loop: number[]) {
  let area = 0;
  for (let index = 0, count = loop.length / 2; index < count; index++) {
    const following = (index + 1) % count;
    area += loop[index * 2] * loop[following * 2 + 1] - loop[following * 2] * loop[index * 2 + 1];
  }
  return area / 2;
}

/** Rounds a closed loop's corners off, twice: each corner becomes two points a quarter of the way along its sides. */
function smoothLoop(loop: number[]) {
  let current = loop;
  for (let pass = 0; pass < 2; pass++) {
    const count = current.length / 2;
    const smoothed: number[] = [];
    for (let index = 0; index < count; index++) {
      const following = (index + 1) % count;
      const x0 = current[index * 2];
      const y0 = current[index * 2 + 1];
      const x1 = current[following * 2];
      const y1 = current[following * 2 + 1];
      smoothed.push(x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75);
    }
    current = smoothed;
  }
  return current;
}
