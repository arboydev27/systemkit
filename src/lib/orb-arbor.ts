// Each lesson on the orb drawn as a neuron, the way Golgi's stain shows them: a pyramidal cell body with its apical
// dendrite reaching out toward the surface and a skirt of basal dendrites tapering as they fork, and only some cells
// stained in full. A lesson you finish stains in full, so the brain fills in as you learn. Related links are the
// axons, which don't taper and carry small beads where they make contact. Pure arithmetic, shared by the live orb
// and by the dive's copy of it, so the dive takes over without a seam.

/** One neuron's dendrites as straight segments in the orb's own space, with what's needed to grow and stain them. */
export type Arbors = {
  /** Two points a segment, x, y, z each. */
  ends: Float32Array;
  /** The lesson each segment belongs to, and where each lesson's segments start (one more entry than lessons). */
  owner: Uint16Array;
  starts: Int32Array;
  /** 0 for a trunk, 1 for a branch, 2 for a twig: each step down is thinner. */
  rank: Uint8Array;
  /** When the segment grows, as shares of its neuron's growth from the cell body out. */
  from: Float32Array;
  to: Float32Array;
  /** The first stretch of each dendrite, which an unstained cell still shows faintly. */
  stub: Uint8Array;
  /** Each lesson's outward direction, which its cell body points along. */
  apex: Float32Array;
  /** Where the beads sit along each related link, as shares of its length, three a link. */
  beads: Float32Array;
};

/** Thinner at each fork, close to Rall's rule of about 0.63 for two equal daughters. */
export const RANK_WIDTH = [1.45, 0.95, 0.62];
/** Of an unstained cell, how much of each first stretch shows, and how strongly. */
export const STUB_REACH = 0.45;
export const STUB_INK = 0.32;
export const BEADS_PER_LINK = 3;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type V = [number, number, number];
const add = (a: V, b: V, s = 1): V => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Turns a direction toward another by an angle, staying in the plane the two make. */
function bend(dir: V, toward: V, angle: number): V {
  const along = dir[0] * toward[0] + dir[1] * toward[1] + dir[2] * toward[2];
  const side = norm([toward[0] - dir[0] * along, toward[1] - dir[1] * along, toward[2] - dir[2] * along]);
  return norm(add([dir[0] * Math.cos(angle), dir[1] * Math.cos(angle), dir[2] * Math.cos(angle)], side, Math.sin(angle)));
}

/**
 * Grows every lesson's dendrites. Sizes are in the orb's units, where it has a radius of 1 and lessons are about 0.28
 * apart, so a cell's field stays inside half the gap to its neighbours and the orb never turns to felt.
 */
export function buildArbors(positions: ArrayLike<number>, degrees: number[], links: ArrayLike<number> = []): Arbors {
  const count = degrees.length;
  const ends: number[] = [];
  const owner: number[] = [];
  const rank: number[] = [];
  const from: number[] = [];
  const to: number[] = [];
  const stub: number[] = [];
  const starts = new Int32Array(count + 1);
  const apex = new Float32Array(count * 3);

  for (let lesson = 0; lesson < count; lesson++) {
    starts[lesson] = owner.length;
    const rng = random(lesson * 9973 + 17);
    const soma: V = [positions[lesson * 3], positions[lesson * 3 + 1], positions[lesson * 3 + 2]];
    const out = norm(soma);
    const t1 = norm(cross(out, Math.abs(out[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const t2 = cross(out, t1);
    const pieces: { a: V; b: V; rank: number; start: number; end: number; stub: boolean }[] = [];
    // A branch in three pieces that curl gently one way, as dendrites do, and thin toward the tip.
    const branch = (start: V, dir: V, length: number, level: number, at: number, first: boolean) => {
      const curl = norm(add(add(dir, t1, (rng() - 0.5) * 4), t2, (rng() - 0.5) * 4));
      const bendBy = 0.12 + rng() * 0.16;
      let point = start;
      let heading = dir;
      for (let piece = 0; piece < 3; piece++) {
        heading = norm(add(heading, curl, bendBy * (piece === 0 ? 0.4 : 1)));
        const next = add(point, heading, length / 3);
        const thinner = level === 0 ? (piece === 2 ? 1 : 0) : piece === 2 ? 1 : 0;
        pieces.push({ a: point, b: next, rank: Math.min(2, level + thinner), start: at + (length * piece) / 3, end: at + (length * (piece + 1)) / 3, stub: first && piece === 0 });
        point = next;
      }
      return { end: point, dir: heading, at: at + length };
    };

    // The apical dendrite, out toward the surface, with obliques off it and a small tuft at its end.
    const lean = norm(add(add(out, t1, (rng() - 0.5) * 0.3), t2, (rng() - 0.5) * 0.3));
    const reach = 0.09 * (0.8 + 0.4 * rng());
    const trunk = branch(soma, lean, reach, 0, 0, true);
    const obliques = 1 + Math.floor(rng() * 2);
    for (let index = 0; index < obliques; index++) {
      const share = 0.35 + 0.3 * index + rng() * 0.1;
      const base = add(soma, lean, reach * share);
      const sideways = rng() < 0.5 ? t1 : t2;
      const dir = bend(lean, rng() < 0.5 ? sideways : [-sideways[0], -sideways[1], -sideways[2]], (55 + rng() * 20) * (Math.PI / 180));
      branch(base, dir, 0.026 + rng() * 0.014, 2, reach * share, false);
    }
    for (const side of [-1, 1]) {
      const dir = bend(trunk.dir, side < 0 ? t1 : [-t1[0], -t1[1], -t1[2]], (28 + rng() * 14) * (Math.PI / 180));
      branch(trunk.end, dir, 0.019 + rng() * 0.01, 2, trunk.at, false);
    }

    // The basal dendrites, three to five, fanning around the cell's foot and forking once or twice.
    const basal = 3 + Math.floor(rng() * 3);
    const turn = rng() * Math.PI * 2;
    for (let index = 0; index < basal; index++) {
      const angle = turn + (index / basal) * Math.PI * 2 + (rng() - 0.5) * 0.7;
      const dir = norm(add(add([t1[0] * Math.cos(angle), t1[1] * Math.cos(angle), t1[2] * Math.cos(angle)], t2, Math.sin(angle)), out, -0.35));
      const first = branch(soma, dir, 0.032 + rng() * 0.014, 0, 0, true);
      // The first fork is the widest, and later ones narrow.
      const spread = (24 + rng() * 14) * (Math.PI / 180);
      for (const side of [-1, 1]) {
        const across = cross(out, first.dir);
        const child = branch(first.end, bend(first.dir, side < 0 ? across : [-across[0], -across[1], -across[2]], spread), 0.024 + rng() * 0.012, 1, first.at, false);
        if (rng() < 0.45) {
          const twig = cross(out, child.dir);
          branch(child.end, bend(child.dir, rng() < 0.5 ? twig : [-twig[0], -twig[1], -twig[2]], spread * 0.75), 0.014 + rng() * 0.007, 2, child.at, false);
        }
      }
    }

    const longest = pieces.reduce((most, piece) => Math.max(most, piece.end), 0) || 1;
    for (const piece of pieces) {
      ends.push(piece.a[0], piece.a[1], piece.a[2], piece.b[0], piece.b[1], piece.b[2]);
      owner.push(lesson);
      rank.push(piece.rank);
      from.push(piece.start / longest);
      to.push(piece.end / longest);
      stub.push(piece.stub ? 1 : 0);
    }
    apex.set(lean, lesson * 3);
  }
  starts[count] = owner.length;

  // Beads at random spacing along each axon, never right at its ends.
  const linkCount = links.length / 2;
  const beads = new Float32Array(linkCount * BEADS_PER_LINK);
  for (let link = 0; link < linkCount; link++) {
    const rng = random(link * 7919 + 3);
    let at = 0.12 + rng() * 0.12;
    for (let index = 0; index < BEADS_PER_LINK; index++) {
      beads[link * BEADS_PER_LINK + index] = Math.min(0.9, at);
      at += 0.16 + rng() * 0.22;
    }
  }

  return {
    ends: Float32Array.from(ends),
    owner: Uint16Array.from(owner),
    starts,
    rank: Uint8Array.from(rank),
    from: Float32Array.from(from),
    to: Float32Array.from(to),
    stub: Uint8Array.from(stub),
    apex,
    beads,
  };
}

const built = new WeakMap<object, Arbors>();

/** The arbors for a course's orb, grown once and shared by the orb and the dive through it. */
export function arborsFor(positions: ArrayLike<number> & object, degrees: number[], links: ArrayLike<number> = []) {
  let arbors = built.get(positions);
  if (!arbors) {
    arbors = buildArbors(positions, degrees, links);
    built.set(positions, arbors);
  }
  return arbors;
}

/** The cells the stain takes before any are finished: about one in five, always the same ones, so the orb is sparse but alive. */
export function stainedAtFirst(lesson: number) {
  return random(lesson * 31 + 5)() < 0.2;
}

/**
 * How strongly a stretch of dendrite is drawn, and how wide, at a depth from 0 at the back to 1 at the front. Behind,
 * a stretch is wider and fainter by the same factor, which reads as out of focus without blurring anything.
 */
export function strokeOf(depth: number, rank: number, ink: number, hair: number) {
  const soft = depth < 0.5 ? 1 + (0.5 - depth) * 2.6 : 1;
  return {
    alpha: (ink * (0.14 + 0.86 * depth * depth)) / soft,
    width: RANK_WIDTH[rank] * hair * (0.75 + 0.25 * depth) * soft,
  };
}

/**
 * A cell body: round, with a point toward its apical dendrite as long as the cell has grown into it. With no point it's
 * exactly the dot the poster draws, so the orb can land on the poster and grow from there.
 */
export function somaPath(path: Path2D | CanvasRenderingContext2D, x: number, y: number, r: number, ux: number, uy: number, tip: number) {
  if (tip < 0.05 * r) {
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  const angle = Math.atan2(uy, ux);
  const spread = 1.05;
  const tipX = x + ux * (r + tip);
  const tipY = y + uy * (r + tip);
  path.moveTo(tipX, tipY);
  const leftX = x + Math.cos(angle + spread) * r;
  const leftY = y + Math.sin(angle + spread) * r;
  path.quadraticCurveTo(x + Math.cos(angle + 0.45) * r * 1.05, y + Math.sin(angle + 0.45) * r * 1.05, leftX, leftY);
  path.arc(x, y, r, angle + spread, angle - spread + Math.PI * 2);
  path.quadraticCurveTo(x + Math.cos(angle - 0.45) * r * 1.05, y + Math.sin(angle - 0.45) * r * 1.05, tipX, tipY);
  path.closePath();
}
