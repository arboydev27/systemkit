import type { Folds } from "./brain-folds";
import { bodySamples, discOutline, PIECE_CENTERS, PIECES, SAMPLE_REACH, type Piece } from "./brain-shape";
import { CAMERA, FIT, ORB_RADIUS, POSTER_SIZE, turned, VIEW } from "./orb-view";

// The brain's body on screen: each piece's outline at an angle, traced from points over its surface, then shaded the
// way the first paint shades it. The live map traces it every frame it turns, and the dive traces it from its own
// camera; the first paint gets it worked out at build time for the angle the brain rests at.

/** How finely the brain's outline is traced, in the map's radius. */
export const OUTLINE_CELL = 0.028;

/**
 * How the body is shaded, in both themes: a veil of the page's own colour, so a nearer piece hides the outline of one
 * behind it, a tone of ink that's lightest toward the upper left where the light comes from, and a fine even outline.
 * The first paint's stylesheet uses the same numbers.
 */
export const BODY = {
  veil: 0.86,
  tone: { light: [0.02, 0.1], dark: [0.09, 0.024] },
  outline: { light: 0.34, dark: 0.3 },
};

export type BodyPiece = { piece: Piece; loops: number[][]; depth: number };

/**
 * The brain's pieces as outlines at an angle, farthest first, so each nearer piece can cover the outline of one
 * behind it. Points are offsets from the center in units of the map's radius, with y running down.
 */
export function bodyOutlines(yaw: number, pitch: number, zoom = 1): BodyPiece[] {
  const samples = bodySamples();
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  return PIECES.map((piece) => {
    const points = samples[piece];
    const count = points.length / 3;
    const flat = new Float32Array(count * 2);
    const radii = new Float32Array(count);
    for (let index = 0; index < count; index++) {
      const x = points[index * 3];
      const y = points[index * 3 + 1];
      const z = points[index * 3 + 2];
      const ahead = -x * sinYaw + z * cosYaw;
      const scale = (CAMERA / (CAMERA - (y * sinPitch + ahead * cosPitch))) * FIT * zoom;
      flat[index * 2] = (x * cosYaw + z * sinYaw) * scale;
      flat[index * 2 + 1] = -(y * cosPitch - ahead * sinPitch) * scale;
      radii[index] = SAMPLE_REACH * scale;
    }
    const center = PIECE_CENTERS[piece];
    return { piece, loops: discOutline(flat, radii, OUTLINE_CELL * zoom), depth: turned(center[0], center[1], center[2], yaw, pitch)[2] };
  }).sort((a, b) => a.depth - b.depth);
}

/** Drops points from a closed loop that sit within a tolerance of the line through their neighbours. */
function simplify(loop: number[], tolerance: number) {
  const count = loop.length / 2;
  const keep = new Uint8Array(count);
  const stack: [number, number][] = [[0, count - 1]];
  keep[0] = 1;
  keep[count - 1] = 1;
  while (stack.length) {
    const [from, to] = stack.pop() as [number, number];
    const ax = loop[from * 2], ay = loop[from * 2 + 1], bx = loop[to * 2], by = loop[to * 2 + 1];
    const length = Math.hypot(bx - ax, by - ay) || 1;
    let far = -1;
    let most = tolerance;
    for (let index = from + 1; index < to; index++) {
      const gap = Math.abs((bx - ax) * (ay - loop[index * 2 + 1]) - (ax - loop[index * 2]) * (by - ay)) / length;
      if (gap > most) { most = gap; far = index; }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([from, far], [far, to]);
    }
  }
  const out: number[] = [];
  for (let index = 0; index < count; index++) if (keep[index]) out.push(loop[index * 2], loop[index * 2 + 1]);
  return out;
}

/** A piece's outline as SVG path data on a square of the given size, in whole units, each point relative to the last. */
export function outlinePath(loops: number[][], size: number) {
  const center = size / 2;
  const radius = size * ORB_RADIUS;
  return loops.map((loop) => {
    const points = simplify(loop.map((value) => center + value * radius), 0.6);
    let x = Math.round(points[0]);
    let y = Math.round(points[1]);
    let path = `M${x} ${y}`;
    for (let index = 2; index < points.length; index += 2) {
      const nx = Math.round(points[index]);
      const ny = Math.round(points[index + 1]);
      if (nx === x && ny === y) continue;
      path += `l${nx - x} ${ny - y}`;
      x = nx;
      y = ny;
    }
    return `${path}z`;
  }).join("").replaceAll(" -", "-");
}

/** The brain's outline at rest, farthest piece first, as SVG path data on the first paint's square. */
export function restingOutline() {
  return bodyOutlines(VIEW.yaw, VIEW.pitch).map(({ loops }) => outlinePath(loops, POSTER_SIZE));
}

/** A piece's loops as a path on screen, around a center and at a size in pixels. */
export function loopsPath(loops: number[][], centerX: number, centerY: number, radius: number) {
  const path = new Path2D();
  for (const loop of loops) {
    path.moveTo(centerX + loop[0] * radius, centerY + loop[1] * radius);
    for (let index = 2; index < loop.length; index += 2) path.lineTo(centerX + loop[index] * radius, centerY + loop[index + 1] * radius);
    path.closePath();
  }
  return path;
}

export type BodyTheme = { ink: string; canvas: string; dark: boolean };

/**
 * Shades the pieces, farthest first, as the first paint does: the light runs across the whole brain, from the upper
 * left of the square it sits in, so it falls the same way on every piece. Paths are in the transform already set.
 */
export function paintBody(ctx: CanvasRenderingContext2D, pieces: Path2D[], theme: BodyTheme, light: { x0: number; y0: number; x1: number; y1: number }, strength: number, hair: number) {
  if (strength <= 0.01) return;
  const [from, to] = theme.dark ? BODY.tone.dark : BODY.tone.light;
  const tone = ctx.createLinearGradient(light.x0, light.y0, light.x1, light.y1);
  const inkRgb = theme.dark ? "255 255 255" : "0 0 0";
  tone.addColorStop(0, `rgb(${inkRgb} / ${(from * 100).toFixed(2)}%)`);
  tone.addColorStop(1, `rgb(${inkRgb} / ${(to * 100).toFixed(2)}%)`);
  ctx.lineJoin = "round";
  for (const path of pieces) {
    ctx.globalAlpha = BODY.veil * strength;
    ctx.fillStyle = theme.canvas;
    ctx.fill(path);
    ctx.globalAlpha = strength;
    ctx.fillStyle = tone;
    ctx.fill(path);
    ctx.globalAlpha = (theme.dark ? BODY.outline.dark : BODY.outline.light) * strength;
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = hair;
    ctx.stroke(path);
  }
}

/** How each depth of groove is drawn: width in hairlines and strength. The fissure and the lobes' edges are the heaviest. */
export const FOLD_STYLE = [
  { width: 0, ink: 0 },
  { width: 0.7, ink: 0.34 },
  { width: 1, ink: 0.46 },
  { width: 1.45, ink: 0.56 },
  { width: 1.75, ink: 0.62 },
  { width: 0.55, ink: 0.3 },
];

/**
 * Collects the grooves into batches by width and strength, as stretches between points already placed on screen,
 * with how squarely each point faces the viewer. Grooves taper to points at their ends, and the shallowest show only
 * their middles, so they read as short broken strokes. A stretch turning away fades rather than switching off.
 */
export function collectFolds(folds: Folds, x: ArrayLike<number>, y: ArrayLike<number>, facing: ArrayLike<number>, strength: number, hair: number, add: (alpha: number, width: number, x1: number, y1: number, x2: number, y2: number) => void) {
  if (strength <= 0.01) return;
  for (let groove = 0; groove < folds.depth.length; groove++) {
    const level = folds.depth[groove];
    const style = FOLD_STYLE[level];
    const start = folds.starts[groove];
    const end = folds.starts[groove + 1];
    const span = Math.max(1, end - start - 1);
    for (let index = start; index < end - 1; index++) {
      const face = Math.min(1, Math.max(0, ((facing[index] + facing[index + 1]) / 2 + 0.05) / 0.4));
      if (face <= 0) continue;
      const t = (index - start + 0.5) / span;
      const taper = level === 1 ? Math.max(0, 1 - Math.abs(2 * t - 1) * 1.6) : Math.min(1, Math.sin(Math.PI * t) * 2.2);
      if (taper <= 0.02) continue;
      add(style.ink * face * Math.min(1, taper + 0.3) * strength, style.width * hair * (0.35 + 0.65 * taper), x[index], y[index], x[index + 1], y[index + 1]);
    }
  }
}
