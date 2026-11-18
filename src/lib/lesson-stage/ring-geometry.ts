// The hash ring's geometry, worked out without a DOM so it can be tested. The ring lies on the floor: a circle seen from
// the stage's isometric angle is an ellipse as wide as it is deep times √3, so everything here is in screen-world units
// around the ring's centre. Positions run clockwise on screen from the top (the back of the ring).

export type Pt = { x: number; y: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };
/** The ring's size on screen: its rim's half width and half depth, and how tall the platter's side is. */
export type Disc = { rx: number; ry: number };

/** How much an isometric floor circle is squashed: its depth over its width. */
export const ISO = Math.tan(Math.PI / 6);

export const angleOf = (pos: number, size: number) => (pos / size) * Math.PI * 2;

/** The point at ring position `pos` (any real number; whole laps wrap), `r` of the way out to the rim. */
export function onRing(d: Disc, size: number, pos: number, r = 1): Pt {
  const a = angleOf(pos, size);
  return { x: d.rx * r * Math.sin(a), y: -d.ry * r * Math.cos(a) };
}

/** The screen direction from the centre out through a position (a unit vector). */
export function outward(d: Disc, size: number, pos: number): Pt {
  const p = onRing(d, size, pos);
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
}

/** How far clockwise from `from` to `to`, in positions: 0 to size − 1. */
export const clockwise = (size: number, from: number, to: number) => (((to - from) % size) + size) % size;

/** The stretch a marked arc covers, after `from` up to and including `to`, as a continuous [start, end] (end may pass
 * size); from === to is the whole ring. */
export function stretch(size: number, from: number, to: number): [number, number] {
  return [from, from + (clockwise(size, from, to) || size)];
}

/** The stretch as drawn: one too short to see (a mark at a single token) is widened to `least` positions round its
 * middle, so it still shows. */
export function shownStretch(size: number, from: number, to: number, least: number): [number, number] {
  const [a, b] = stretch(size, from, to), mid = (a + b) / 2;
  return b - a >= least ? [a, b] : [mid - least / 2, mid + least / 2];
}

/** Small boxes (half size r) every `step` along a segment, so labels can keep off a line without its whole box. */
export function segmentBoxes(a: Pt, b: Pt, step: number, r: number): Box[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step)), out: Box[] = [];
  for (let i = 0; i <= n; i++) out.push(boxAt({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }, r, r));
  return out;
}

const f2 = (n: number) => Math.round(n * 100) / 100;
const xy = (p: Pt) => `${f2(p.x)} ${f2(p.y)}`;

/** An SVG path along the ellipse at `r` from p0 clockwise to p1 (p1 ≥ p0, continuous positions). Starts with M unless `join`. */
export function arcPath(d: Disc, size: number, p0: number, p1: number, r: number, join = false): string {
  const span = Math.max(0, p1 - p0), rx = f2(d.rx * r), ry = f2(d.ry * r);
  let out = (join ? "L" : "M") + xy(onRing(d, size, p0, r));
  // an SVG arc can't draw a whole ellipse, so long sweeps go in halves
  const parts = Math.max(1, Math.ceil(span / (size * 0.49)));
  for (let i = 1; i <= parts; i++) {
    const q = p0 + (span * i) / parts;
    out += `A${rx} ${ry} 0 0 1 ${xy(onRing(d, size, q, r))}`;
  }
  return out;
}

/** A band between radii r0 < r1 from p0 clockwise to p1; a full lap is a closed ring. */
export function bandPath(d: Disc, size: number, p0: number, p1: number, r0: number, r1: number): string {
  if (p1 - p0 >= size - 1e-6) return ellipsePath(d, r1) + ellipsePath(d, r0, true);
  let out = arcPath(d, size, p0, p1, r1);
  out += "L" + xy(onRing(d, size, p1, r0));
  // back along the inner edge, anticlockwise
  const span = p1 - p0, rx = f2(d.rx * r0), ry = f2(d.ry * r0), parts = Math.max(1, Math.ceil(span / (size * 0.49)));
  for (let i = parts - 1; i >= 0; i--) out += `A${rx} ${ry} 0 0 0 ${xy(onRing(d, size, p0 + (span * i) / parts, r0))}`;
  return out + "Z";
}

/** A whole ellipse at r as a closed path (anticlockwise when `reverse`, so a band's hole stays empty). */
export function ellipsePath(d: Disc, r: number, reverse = false): string {
  const rx = f2(d.rx * r), ry = f2(d.ry * r), s = reverse ? 0 : 1;
  return `M${f2(-rx)} 0A${rx} ${ry} 0 0 ${s} ${rx} 0A${rx} ${ry} 0 0 ${s} ${f2(-rx)} 0Z`;
}

/** How long the ellipse at r is from p0 to p1, in world units (sampled). */
export function arcLength(d: Disc, size: number, p0: number, p1: number, r: number): number {
  const n = Math.max(4, Math.ceil(Math.abs(p1 - p0) / size * 96));
  let len = 0, prev = onRing(d, size, p0, r);
  for (let i = 1; i <= n; i++) {
    const q = onRing(d, size, p0 + ((p1 - p0) * i) / n, r);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return len;
}

/** Stretches of the ring whose owner differs between two lookups, as continuous [start, end]: the boundary before the
 * first position that changed, and the last one that did. A stretch may run past the top (end beyond size). */
export function changedRuns(size: number, before: (p: number) => string | undefined, after: (p: number) => string | undefined): [number, number][] {
  const changed = Array.from({ length: size }, (_, p) => before(p) !== after(p));
  if (changed.every(Boolean)) return [[0, size]];
  if (!changed.some(Boolean)) return [];
  // start just after a position that stayed, so a run across the top is one run
  const first = changed.findIndex((c) => !c);
  const runs: [number, number][] = [];
  let start = -1;
  for (let k = 1; k <= size; k++) {
    const p = (first + k) % size, q = first + k;
    if (changed[p] && start < 0) start = q;
    if (!changed[p] && start >= 0) { runs.push([start - 1, q - 1]); start = -1; }
  }
  if (start >= 0) runs.push([start - 1, first + size]);
  return runs.map(([a, b]) => {
    const shift = Math.floor(a / size) * size;
    return [a - shift, b - shift] as [number, number];
  });
}

/** The centre for a box of half size (hw, hh) placed beyond point p along unit u, `gap` clear of it. */
export function beyond(p: Pt, u: Pt, hw: number, hh: number, gap: number): Pt {
  const d = gap + Math.abs(u.x) * hw + Math.abs(u.y) * hh;
  return { x: p.x + u.x * d, y: p.y + u.y * d };
}

/** Places for a box of half size (hw, hh) inside an ellipse of half axes (a, b) round the origin, each snug against its
 * edge: at a spread of heights against the left or right side, and at a spread of widths against the top or bottom.
 * Nearest first to any of the points `near`, at most `count`. */
export function hugInside(a: number, b: number, hw: number, hh: number, near: Pt[], count: number): Pt[] {
  const out: Pt[] = [];
  const stepY = Math.max(1, hh), stepX = Math.max(1, hw / 2);
  for (let y = -b; y <= b + 1e-6; y += stepY) {
    const far = Math.abs(y) + hh;
    if (far >= b) continue;
    const x = a * Math.sqrt(1 - (far / b) ** 2) - hw;
    if (x >= 0) out.push({ x, y }, { x: -x, y });
  }
  for (let x = -a; x <= a + 1e-6; x += stepX) {
    const far = Math.abs(x) + hw;
    if (far >= a) continue;
    const y = b * Math.sqrt(1 - (far / a) ** 2) - hh;
    if (y >= 0) out.push({ x, y }, { x, y: -y });
  }
  const dist = (c: Pt) => Math.min(...near.map((p) => Math.hypot(c.x - p.x, c.y - p.y)));
  return out.map((c) => ({ c, d: dist(c) })).sort((p, q) => p.d - q.d).slice(0, count).map((p) => p.c);
}

export const boxAt = (c: Pt, hw: number, hh: number): Box => ({ x0: c.x - hw, y0: c.y - hh, x1: c.x + hw, y1: c.y + hh });
export const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
export const union = (a: Box | null, b: Box): Box => (a ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : { ...b });

/** The first candidate clear of everything taken; else, unless `optional`, the one that covers least. -1 when none fits. */
export function pick(candidates: Box[], taken: Box[], optional = false): number {
  let best = -1, least = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const c = taken.reduce((sum, t) => sum + overlap(candidates[i], t), 0);
    if (c === 0) return i;
    if (c < least - 0.5) { least = c; best = i; }
  }
  return optional ? -1 : best;
}

/** The convex hull of points, anticlockwise on screen (y down). */
export function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [], hi: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

/** Whether a box and a convex polygon overlap (separating axes). */
export function boxMeetsHull(b: Box, poly: Pt[]): boolean {
  if (!poly.length) return false;
  const corners: Pt[] = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
  const axes: Pt[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    axes.push({ x: -(c.y - a.y), y: c.x - a.x });
  }
  for (const ax of axes) {
    const proj = (list: Pt[]) => list.map((q) => q.x * ax.x + q.y * ax.y);
    const pa = proj(corners), pb = proj(poly);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}

/** Where a part stands just outside the ring: the nearest place along its position's ray from the centre where its box
 * (relative to where it stands) is `gap` clear of everything the ring keeps out. */
export function standOff(d: Disc, size: number, pos: number, keepOut: Pt[], part: Box, gap: number, others: Box[] = []): Pt {
  const rim = onRing(d, size, pos), l = Math.hypot(rim.x, rim.y) || 1;
  return slideClear(rim, { x: rim.x / l, y: rim.y / l }, keepOut, part, gap, others);
}

/** Like `standOff`, but when another part already stands on the ray, the ray turned up to 30° either way may find a
 * place nearer the ring than sliding on past that part; a turned ray must win by more the further it turns. */
export function standOffNear(d: Disc, size: number, pos: number, keepOut: Pt[], part: Box, gap: number, others: Box[] = []): Pt {
  const alone = standOff(d, size, pos, keepOut, part, gap);
  const grown = { x0: alone.x + part.x0 - gap, y0: alone.y + part.y0 - gap, x1: alone.x + part.x1 + gap, y1: alone.y + part.y1 + gap };
  if (!others.some((o) => overlap(grown, o) > 0)) return alone;
  const rim = onRing(d, size, pos), u = outward(d, size, pos);
  let best = standOff(d, size, pos, keepOut, part, gap, others), cost = Math.hypot(best.x - rim.x, best.y - rim.y);
  for (const deg of [-15, 15, -30, 30]) {
    const a = (deg * Math.PI) / 180, dir = { x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) };
    const at = slideClear(rim, dir, keepOut, part, gap, others), c = Math.hypot(at.x - rim.x, at.y - rim.y) * (1 + Math.abs(deg) / 90);
    if (c < cost) { cost = c; best = at; }
  }
  return best;
}

/** Slides a part from `start` along unit `dir` until its box (relative to where it stands) is `gap` clear of the ring's
 * keep-out and of other parts' boxes. */
export function slideClear(start: Pt, dir: Pt, keepOut: Pt[], part: Box, gap: number, others: Box[] = []): Pt {
  const grown = { x0: part.x0 - gap, y0: part.y0 - gap, x1: part.x1 + gap, y1: part.y1 + gap };
  for (let t = 0; t < 1200; t += 2) {
    const at = { x: start.x + dir.x * t, y: start.y + dir.y * t };
    const b = { x0: at.x + grown.x0, y0: at.y + grown.y0, x1: at.x + grown.x1, y1: at.y + grown.y1 };
    if (!boxMeetsHull(b, keepOut) && !others.some((o) => overlap(b, o) > 0)) return at;
  }
  return start;
}

/** A tone for each part's arcs, so neighbouring arcs on the ring always differ: the first tone its neighbours don't use. */
export function toneOf(order: string[], neighbours: [string, string][], tones = 4): Record<string, number> {
  const out: Record<string, number> = {};
  order.forEach((id, i) => {
    const used = new Set(neighbours.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])).filter((n) => n in out).map((n) => out[n]));
    let t = 0;
    while (used.has(t) && t < tones) t++;
    out[id] = t < tones ? t : i % tones;
  });
  return out;
}

export type WalkStop<T> = { token: T; at: number; chosen: number };
/** A walk clockwise from `from` over sorted tokens for one lap: each token it meets, where (continuous, ≥ from), and its
 * place in the list (1..count), or 0 when it is skipped because its part was already chosen. Stops at `count`. */
export function walkStops<T extends { node: string; at: number }>(tokens: T[], size: number, from: number, count: number, distinct = false): WalkStop<T>[] {
  const n = tokens.length;
  if (!n) return [];
  const first = Math.max(0, tokens.findIndex((t) => t.at >= from));
  const start = tokens.some((t) => t.at >= from) ? first : 0;
  const out: WalkStop<T>[] = [];
  const nodes = new Set<string>();
  let chosen = 0;
  for (let k = 0; k < n && chosen < count; k++) {
    const token = tokens[(start + k) % n];
    const at = from + clockwise(size, from, token.at);
    if (distinct && nodes.has(token.node)) out.push({ token, at, chosen: 0 });
    else { chosen++; nodes.add(token.node); out.push({ token, at, chosen }); }
  }
  return out;
}
