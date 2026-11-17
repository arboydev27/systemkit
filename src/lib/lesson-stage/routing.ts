// Where a lesson stage's links run, worked out from the parts' places alone (no DOM), so it can be tested.
// A link lies on the floor: it runs along the floor's two axes (on a phone also straight down the screen, the dot grid's
// third direction), plugs into a port on a part's base, keeps clear of other parts and their tags, fans out from links
// it shares a trunk with, and breaks where it passes under another link.

export type Pt = { x: number; y: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };
/** A side of a part's base: R and L are its two front faces, UL and UR the back ones. BOT runs out under the part's
 * name tag and TOP in behind the part, both straight down the screen, for a phone's tiers. */
export type Face = "R" | "L" | "UL" | "UR" | "BOT" | "TOP";

export const ISO_C = Math.cos(Math.PI / 6), ISO_S = 0.5;
/** Half a base's side, in floor units (a base is 56 across). */
export const HALF = 28;

export type RouteNode = {
  id: string;
  /** The middle of the part's base on the floor, in world units. */
  at: Pt;
  /** How high the drawn part stands above its base's middle. */
  top: number;
  /** Its name tag, and how round the tag's corners are. */
  tag: Rect;
  tagRound?: number;
  /** The load pill, when the part shows one. */
  pill?: Rect;
  /** Anything else drawn beside the part that links keep clear of, such as its log. */
  more?: Rect[];
};
export type RouteLink = {
  id: number; a: string; b: string;
  /** Out of the step's focus: anything it crosses goes over it. */
  quiet?: boolean;
};
export type RouteOptions = {
  narrow: boolean;
  /** Space between links that share a trunk, in world units. */
  gap: number;
  /** A shape for some links, by name (from an earlier run's `shape`): while parts move, each link keeps the shape
   * it has where they're headed. */
  force?: Map<number, string>;
  /** Only roughly: skip looking for a way through for links that run into something (for sizing the view). */
  rough?: boolean;
};
export type Routed = {
  id: number; a: string; b: string;
  shape: string;
  /** Corners, from a's port to b's port. */
  pts: Pt[];
  from: Face; to: Face;
  /** Where another link crosses over this one, so this one breaks there. */
  under: Pt[];
};

// ---------- directions on the floor ----------
type Dir = "+U" | "-U" | "+V" | "-V" | "+D" | "-D" | "+H" | "-H";
const UNIT: Record<string, Pt> = { U: { x: ISO_C, y: ISO_S }, V: { x: -ISO_C, y: ISO_S }, D: { x: 0, y: 1 }, H: { x: 1, y: 0 } };
const vec = (d: Dir): Pt => { const u = UNIT[d[1]]; return d[0] === "+" ? u : { x: -u.x, y: -u.y }; };
const flip = (d: Dir): Dir => ((d[0] === "+" ? "-" : "+") + d[1]) as Dir;
const parallel = (a: Dir, b: Dir) => a[1] === b[1];
const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

type FaceInfo = { out: Dir; base: Pt; along: Pt; center: number; lo: number; hi: number; front: boolean };
const toScreen = (u: number, v: number): Pt => ({ x: (u - v) * ISO_C, y: (u + v) * ISO_S });
// A port's offset runs along its face. Front ports sit toward the base's outer corners, clear of the name tag on its
// front corner, and the left one keeps off the status light.
const FACES: Record<Face, FaceInfo> = {
  R: { out: "+U", base: toScreen(HALF, 0), along: toScreen(0, 1), center: -12, lo: -16, hi: 12, front: true },
  L: { out: "+V", base: toScreen(0, HALF), along: toScreen(1, 0), center: -12, lo: -16, hi: -3, front: true },
  UL: { out: "-U", base: toScreen(-HALF, 0), along: toScreen(0, 1), center: 0, lo: -14, hi: 14, front: false },
  UR: { out: "-V", base: toScreen(0, -HALF), along: toScreen(1, 0), center: 0, lo: -14, hi: 14, front: false },
  BOT: { out: "+D", base: { x: 0, y: HALF + 2 }, along: { x: 1, y: 0 }, center: 0, lo: -16, hi: 16, front: false },
  TOP: { out: "-D", base: { x: 0, y: -18 }, along: { x: 1, y: 0 }, center: 0, lo: -16, hi: 16, front: false },
};
const FACE_OF: Partial<Record<Dir, Face>> = { "+U": "R", "-U": "UL", "+V": "L", "-V": "UR", "+D": "BOT", "-D": "TOP" };
export const isFront = (f: Face) => FACES[f].front;
const portAt = (n: RouteNode, f: Face, t: number) => add(add(n.at, FACES[f].base), FACES[f].along, t);
/** How far apart two ports must sit on a face for the links leaving it to run `gap` apart. */
const slotFor = (f: Face, gap: number) => gap / Math.abs(cross(vec(FACES[f].out), FACES[f].along));

// ---------- shapes ----------
type Shape = { kind: "I" | "L" | "Z"; dirs: Dir[]; f: number };
const nameOf = (s: Shape) => `${s.kind}${s.dirs.join("")}${s.kind === "Z" ? s.f : ""}`;
type Built = { shape: Shape; pts: Pt[]; from: Face; to: Face; ta: number; tb: number; ok: boolean };

/** Solve p = α·a + β·b. */
function split(p: Pt, a: Pt, b: Pt): [number, number] {
  const den = cross(a, b);
  return [cross(p, b) / den, cross(a, p) / den];
}

function build(shape: Shape, A: RouteNode, B: RouteNode, ta?: number, tb?: number): Built {
  const d0 = shape.dirs[0], dn = shape.dirs[shape.dirs.length - 1];
  const from = FACE_OF[d0]!, to = FACE_OF[flip(dn)]!;
  const fa = FACES[from], fb = FACES[to];
  let tA = ta ?? fa.center, tB = tb ?? fb.center;
  if (shape.kind === "I") {
    // one straight run: both ports on the same line, somewhere both faces reach
    const d = vec(d0);
    const qa = cross(d, add(A.at, fa.base)), ka = cross(d, fa.along);
    const qb = cross(d, add(B.at, fb.base)), kb = cross(d, fb.along);
    const [a0, a1] = [qa + ka * fa.lo, qa + ka * fa.hi].sort((x, y) => x - y);
    const [b0, b1] = [qb + kb * fb.lo, qb + kb * fb.hi].sort((x, y) => x - y);
    const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
    const want = ta !== undefined ? qa + ka * ta : (Math.max(lo, Math.min(hi, qa + ka * fa.center)) + Math.max(lo, Math.min(hi, qb + kb * fb.center))) / 2;
    const q = Math.max(lo, Math.min(hi, want));
    tA = (q - qa) / ka; tB = Math.max(fb.lo, Math.min(fb.hi, (q - qb) / kb));
    const pa = portAt(A, from, tA), pb = portAt(B, to, tB);
    return { shape, pts: [pa, pb], from, to, ta: tA, tb: tB, ok: lo <= hi + 0.01 && dot(sub(pb, pa), d) > 24 };
  }
  const pa = portAt(A, from, tA), pb = portAt(B, to, tB);
  const [al, be] = split(sub(pb, pa), vec(d0), vec(shape.dirs[1]));
  // A leg out from under a tag or in behind a part may be any length; one that shows must be long enough to read.
  const shown = (f: Face) => (f === "BOT" || f === "TOP" ? 0 : 12);
  if (shape.kind === "L") {
    const c = add(pa, vec(d0), al);
    return { shape, pts: [pa, c, pb], from, to, ta: tA, tb: tB, ok: al >= shown(from) && be >= shown(to) };
  }
  const c1 = add(pa, vec(d0), al * shape.f), c2 = add(c1, vec(shape.dirs[1]), be);
  return { shape, pts: [pa, c1, c2, pb], from, to, ta: tA, tb: tB, ok: al * shape.f >= shown(from) && al * (1 - shape.f) >= shown(to) && be > 0.5 };
}

const shapeSets = new Map<boolean, Shape[]>();
function shapes(narrow: boolean): Shape[] {
  if (!shapeSets.has(narrow)) shapeSets.set(narrow, allShapes(narrow));
  return shapeSets.get(narrow)!;
}
function allShapes(narrow: boolean): Shape[] {
  const ends: Dir[] = narrow ? ["+U", "-U", "+V", "-V", "+D", "-D"] : ["+U", "-U", "+V", "-V"];
  const mids: Dir[] = narrow ? [...ends, "+H", "-H"] : ends;
  const out: Shape[] = [];
  for (const d of ends) out.push({ kind: "I", dirs: [d], f: 0 });
  for (const a of ends) for (const b of ends) if (!parallel(a, b)) out.push({ kind: "L", dirs: [a, b], f: 0 });
  for (const a of ends) for (const b of mids) {
    if (parallel(a, b)) continue;
    // a sideways run straight across the screen is only for a phone's tiers, between two drops
    if (b[1] === "H" && a[1] !== "D") continue;
    for (const f of [0.3, 0.5, 0.7]) out.push({ kind: "Z", dirs: [a, b, a], f });
  }
  return out;
}

// ---------- what a route runs into ----------
function hitsRect(p: Pt, q: Pt, r: Rect): boolean {
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  for (const [pp, qq] of [[-dx, p.x - r.x0], [dx, r.x1 - p.x], [-dy, p.y - r.y0], [dy, r.y1 - p.y]]) {
    if (Math.abs(pp) < 1e-9) { if (qq < 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t1 - t0 > 1e-6;
}
/** The base and the part on it, as an outline on screen (convex). */
function bodyOf(n: RouteNode): Pt[] {
  const w = HALF * 2 * ISO_C, { x, y } = n.at, art = 38;
  const pts = [{ x: x - w, y }, { x: x - w, y: y - 7 }, { x, y: y - HALF - 7 }, { x: x + w, y: y - 7 }, { x: x + w, y }, { x, y: y + HALF },
    { x: x - art, y: y - n.top }, { x: x + art, y: y - n.top }];
  // the outline around them all
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: Pt[]) => {
    const h: Pt[] = [];
    for (const p of list) { while (h.length >= 2 && cross(sub(h[h.length - 1], h[h.length - 2]), sub(p, h[h.length - 2])) <= 0) h.pop(); h.push(p); }
    return h.slice(0, -1);
  };
  return [...half(pts), ...half([...pts].reverse())];
}
function inside(p: Pt, poly: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = cross(sub(b, a), sub(p, a));
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false;
  }
  return true;
}
function segCross(p: Pt, q: Pt, a: Pt, b: Pt): Pt | null {
  const r = sub(q, p), s = sub(b, a), den = cross(r, s);
  if (Math.abs(den) < 1e-9) return null;
  const t = cross(sub(a, p), s) / den, u = cross(sub(a, p), r) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? add(p, r, t) : null;
}
function hitsPoly(p: Pt, q: Pt, poly: Pt[]): boolean {
  if (inside(p, poly) || inside(q, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (segCross(p, q, poly[i], poly[(i + 1) % poly.length])) return true;
  return false;
}
const grow = (r: Rect, m: number): Rect => ({ x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m });
/** A run that clips a tag's rounded-off corner misses it. */
function hitsRound(p: Pt, q: Pt, t: Rect, r: number): boolean {
  r = Math.max(0, Math.min(r, (t.x1 - t.x0) / 2, (t.y1 - t.y0) / 2));
  if (hitsRect(p, q, { ...t, x0: t.x0 + r, x1: t.x1 - r }) || hitsRect(p, q, { ...t, y0: t.y0 + r, y1: t.y1 - r })) return true;
  const d = sub(q, p), l2 = dot(d, d) || 1;
  for (const c of [{ x: t.x0 + r, y: t.y0 + r }, { x: t.x1 - r, y: t.y0 + r }, { x: t.x0 + r, y: t.y1 - r }, { x: t.x1 - r, y: t.y1 - r }]) {
    const k = Math.max(0, Math.min(1, dot(sub(c, p), d) / l2));
    if (dist(add(p, d, k), c) < r) return true;
  }
  return false;
}
const segsOf = (pts: Pt[]) => pts.slice(1).map((q, i) => [pts[i], q] as const);

/** Two runs on the same line that overlap, so one would hide the other. */
function overlaps(p: Pt, q: Pt, a: Pt, b: Pt, within: number): boolean {
  const d = sub(q, p), l = Math.hypot(d.x, d.y), e = sub(b, a), m = Math.hypot(e.x, e.y);
  if (l < 1 || m < 1 || Math.abs(cross(d, e)) / (l * m) > 0.02) return false;
  if (Math.abs(cross(d, sub(a, p))) / l > within) return false;
  const s0 = dot(sub(a, p), d) / l, s1 = dot(sub(b, p), d) / l;
  return Math.min(l, Math.max(s0, s1)) - Math.max(0, Math.min(s0, s1)) > 6;
}

type Chosen = Built & { id: number; A: RouteNode; B: RouteNode; pinned?: boolean };

/** What a route costs for running into parts, their tags and their pills (0 when it keeps clear of all of them). */
function hits(b: Chosen, all: RouteNode[]): number {
  const { A, B } = b;
  let cost = 0;
  const segs = segsOf(b.pts);
  for (const n of all) {
    const own = n === A || n === B;
    const tagOk = (n === A && b.from === "BOT") || (n === B && b.to === "BOT");
    const pillOk = (n === A && b.from === "TOP") || (n === B && b.to === "TOP");
    const body = bodyOf(n), tag = grow(n.tag, 3), round = (n.tagRound ?? 10) + 3, pill = n.pill && grow(n.pill, 3);
    for (const [p, q] of segs) {
      if (!own && hitsPoly(p, q, body)) cost += 1000;
      if (!tagOk && hitsRound(p, q, tag, round)) cost += own ? 600 : 1000;
      if (pill && !pillOk && hitsRect(p, q, pill)) cost += own ? 250 : 500;
      for (const r of n.more ?? []) if (hitsRect(p, q, grow(r, 3))) cost += own ? 250 : 500;
    }
  }
  return cost;
}

function score(b: Chosen, all: RouteNode[], placed: Chosen[], opts: RouteOptions): number {
  const { A, B } = b;
  let cost = hits(b, all);
  const segs = segsOf(b.pts);
  // On a wide screen tiers run left to right, so a link can reach a base's front; on a phone each tier hangs under
  // the one before, and coming in from behind is the natural way.
  if (!opts.narrow) for (const f of [b.from, b.to]) if (f === "UL" || f === "UR") cost += 45;
  cost += b.shape.kind === "I" ? -20 : b.shape.kind === "Z" ? 30 + 20 * Math.abs(b.shape.f - 0.5) : 0;
  if (b.shape.dirs.some((d) => d[1] === "H")) cost += 400;
  let length = 0;
  segs.forEach(([p, q], i) => {
    const l = dist(p, q);
    length += l;
    const hidden = (i === 0 && (b.from === "BOT" || b.from === "TOP")) || (i === segs.length - 1 && (b.to === "BOT" || b.to === "TOP"));
    if (!hidden && l > 0.5 && l < 14) cost += 80;
  });
  // short and direct: a detour costs more than its length
  cost += length * 0.03 + (length - dist(b.pts[0], b.pts[b.pts.length - 1])) * 0.08;
  // a link that climbs over both its parts reads as going somewhere else
  const over = Math.min(A.at.y - A.top, B.at.y - B.top) - Math.min(...b.pts.map((p) => p.y));
  const under = Math.max(...b.pts.map((p) => p.y)) - Math.max(A.tag.y1, B.tag.y1);
  if (over > 0) cost += over * 0.4;
  if (under > 0) cost += under * 0.4;
  for (const o of placed) {
    // runs that leave the same face side by side are spread apart later, so they don't count as on top of each other
    const sameFace = (o.A === A && o.from === b.from) || (o.B === A && o.to === b.from) || (o.A === B && o.from === b.to) || (o.B === B && o.to === b.to);
    for (const [p, q] of segs) for (const [a, c] of segsOf(o.pts)) {
      if (segCross(p, q, a, c)) cost += 14;
      else if (!sameFace && overlaps(p, q, a, c, opts.gap * 0.5)) cost += 120;
    }
  }
  return cost;
}

// ---------- the whole stage ----------
/** Route every link: choose each one's shape, spread the ports where links share a face, and find the crossings. */
export function routeLinks(nodes: RouteNode[], links: RouteLink[], opts: RouteOptions): Routed[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const all = shapes(opts.narrow);
  const chosen: Chosen[] = [];
  for (const L of links) {
    const A = byId.get(L.a), B = byId.get(L.b);
    if (!A || !B) continue;
    let best: Chosen | null = null, bestCost = Infinity;
    const kept = opts.force?.get(L.id), keep = kept ? all.find((s) => nameOf(s) === kept) : undefined;
    if (keep) { chosen.push({ ...build(keep, A, B), ok: true, id: L.id, A, B }); continue; }
    const consider = (b: Chosen) => {
      if (!b.ok) return;
      const c = score(b, nodes, chosen, opts);
      if (c < bestCost) { best = b; bestCost = c; }
    };
    for (const s of all) consider({ ...build(s, A, B), id: L.id, A, B });
    // Every way from the middle of the faces runs into something: try ports toward the faces' ends, and keep them.
    if (!opts.rough && best && hits(best, nodes) > 0) {
      const ends = (f: Face) => [FACES[f].lo, FACES[f].center, FACES[f].hi];
      for (const s of all) {
        if (s.kind === "I") continue;
        const first = build(s, A, B);
        for (const ta of ends(first.from)) for (const tb of ends(first.to)) consider({ ...build(s, A, B, ta, tb), id: L.id, A, B, pinned: true });
      }
    }
    // nothing fits the rules (two parts on top of each other): run straight between their middles
    chosen.push(best ?? { id: L.id, A, B, shape: { kind: "I", dirs: ["+U"], f: 0 }, pts: [A.at, B.at], from: "R", to: "UL", ta: 0, tb: 0, ok: false });
  }
  spreadPorts(chosen, opts.gap);
  separateMiddles(chosen, opts.gap);
  if (!opts.force && !opts.rough) repair(chosen, nodes, all, opts);
  const quiet = new Set(links.filter((l) => l.quiet).map((l) => l.id));
  const result: Routed[] = chosen.map((b) => ({ id: b.id, a: b.A.id, b: b.B.id, shape: nameOf(b.shape), pts: b.pts, from: b.from, to: b.to, under: [] }));
  // Where two links cross, the one in focus, or else the one listed first, goes over; the other breaks.
  for (let i = 0; i < result.length; i++) for (let j = i + 1; j < result.length; j++) {
    const P = result[i], Q = result[j];
    const under = quiet.has(P.id) && !quiet.has(Q.id) ? P : Q;
    const ends = [P.pts[0], P.pts[P.pts.length - 1], Q.pts[0], Q.pts[Q.pts.length - 1]];
    for (const [p, q] of segsOf(P.pts)) for (const [a, c] of segsOf(Q.pts)) {
      const x = segCross(p, q, a, c);
      if (x && !ends.some((e) => dist(e, x) < opts.gap)) under.under.push(x);
    }
  }
  return result;
}

/** Links that leave or reach the same face get their own ports, ordered so they fan out without crossing. */
function spreadPorts(routes: Chosen[], gap: number) {
  type End = { r: Chosen; end: "a" | "b"; key: number };
  const groups = new Map<string, End[]>();
  for (const r of routes) {
    if (!r.ok) continue;
    const n = r.pts.length;
    // the leg at each end, pointing away from the part, and where it turns next
    const legs: [Face, Pt, Pt, Pt | null, "a" | "b", string, number][] = [
      [r.from, r.pts[0], r.pts[1], n > 2 ? r.pts[2] : null, "a", r.A.id, r.ta],
      [r.to, r.pts[n - 1], r.pts[n - 2], n > 2 ? r.pts[n - 3] : null, "b", r.B.id, r.tb],
    ];
    for (const [face, p0, p1, p2, end, owner, t] of legs) {
      const F = FACES[face], along = F.along;
      // Of the links running out side by side, the first to turn toward a side must be the outermost on that side;
      // a port moved to one end of its face to keep the link clear of something stays at that end.
      const key = r.pinned && t !== F.center ? Math.sign(t - F.center) * 1e9
        : p2 ? Math.sign(dot(sub(p2, p1), along)) * (100000 - dist(p0, p1)) : dot(sub(p1, p0), along) * 1e-3;
      const k = `${owner}|${face}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push({ r, end, key });
    }
  }
  const slots = new Map<Chosen, { a?: number; b?: number }>();
  for (const [k, list] of groups) {
    if (list.length < 2) continue;
    const face = k.slice(k.lastIndexOf("|") + 1) as Face, F = FACES[face];
    list.sort((x, y) => x.key - y.key);
    let step = slotFor(face, gap);
    if (step * (list.length - 1) > F.hi - F.lo) step = (F.hi - F.lo) / (list.length - 1);
    const start = Math.max(F.lo, Math.min(F.hi - step * (list.length - 1), F.center - (step * (list.length - 1)) / 2));
    list.forEach((e, i) => { const s = slots.get(e.r) ?? {}; s[e.end] = start + i * step; slots.set(e.r, s); });
  }
  for (const [r, s] of slots) {
    // a straight run keeps both its ports on one line, so its far end follows the near one
    const ta = s.a ?? (r.shape.kind === "I" && s.b !== undefined ? undefined : r.ta);
    const again = r.shape.kind === "I" && s.a === undefined && s.b !== undefined
      ? reverseI(r, s.b)
      : build(r.shape, r.A, r.B, ta ?? r.ta, r.shape.kind === "I" ? undefined : s.b ?? r.tb);
    Object.assign(r, { pts: again.pts, ta: again.ta, tb: again.tb });
  }
}
/** A straight run placed by its far end's port. */
function reverseI(r: Chosen, tb: number): Built {
  const back = build({ ...r.shape, dirs: [flip(r.shape.dirs[0])] }, r.B, r.A, tb);
  return { ...back, pts: [...back.pts].reverse(), ta: back.tb, tb: back.ta, from: r.from, to: r.to, shape: r.shape };
}

/** A link that still runs into something once the ports are spread looks again for a way through, with the other
 * links where they are and a port of its own that no other link on that face uses. */
function repair(routes: Chosen[], nodes: RouteNode[], all: Shape[], opts: RouteOptions) {
  for (const r of routes) {
    if (!r.ok || hits(r, nodes) === 0) continue;
    const others = routes.filter((o) => o !== r);
    // ports already taken on a face of this part
    const taken = (n: RouteNode, f: Face) => others.flatMap((o) => [...(o.A === n && o.from === f ? [o.ta] : []), ...(o.B === n && o.to === f ? [o.tb] : [])]);
    const free = (n: RouteNode, f: Face, t: number) => taken(n, f).every((u) => Math.abs(u - t) >= slotFor(f, opts.gap) * 0.75);
    const spots = (f: Face) => { const F = FACES[f], out: number[] = []; for (let t = F.lo; t <= F.hi + 1e-6; t += (F.hi - F.lo) / 6) out.push(t); return out; };
    let best: Chosen | null = null, bestCost = Infinity;
    for (const s of all) {
      if (s.kind === "I") continue;
      const first = build(s, r.A, r.B);
      for (const ta of spots(first.from)) {
        if (!free(r.A, first.from, ta)) continue;
        for (const tb of spots(first.to)) {
          if (!free(r.B, first.to, tb)) continue;
          const b: Chosen = { ...build(s, r.A, r.B, ta, tb), id: r.id, A: r.A, B: r.B, pinned: true };
          if (!b.ok || hits(b, nodes) > 0) continue;
          const c = score(b, nodes, others, opts);
          if (c < bestCost) { best = b; bestCost = c; }
        }
      }
    }
    if (best) Object.assign(r, best);
  }
}

/** A middle run that lands on top of another link's run moves over by a gap. */
function separateMiddles(routes: Chosen[], gap: number) {
  routes.forEach((r, i) => {
    if (r.shape.kind !== "Z") return;
    const clash = (pts: Pt[]) => routes.some((o, j) => j !== i && segsOf(o.pts).some(([a, c]) => overlaps(pts[1], pts[2], a, c, gap * 0.6)));
    if (!clash(r.pts)) return;
    const al = dist(r.pts[0], r.pts[1]) + dist(r.pts[2], r.pts[3]);
    const per = gap / Math.abs(cross(vec(r.shape.dirs[0]), vec(r.shape.dirs[1]))) / Math.max(1, al);
    for (const k of [1, -1, 2, -2, 3, -3]) {
      const f = r.shape.f + k * per;
      if (f < 0.12 || f > 0.88) continue;
      const again = build({ ...r.shape, f }, r.A, r.B, r.ta, r.tb);
      if (!clash(again.pts)) { r.pts = again.pts; return; }
    }
  });
}

// ---------- drawing a route ----------
/** Round a route's corners into short curves (a corner on the floor seen in perspective), as a dense polyline. */
export function rounded(pts: Pt[], r: number): Pt[] {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], pa = pts[i - 1], pb = pts[i + 1];
    const la = dist(p, pa), lb = dist(pb, p);
    if (la < 1e-6 || lb < 1e-6) continue;
    const rr = Math.min(r, la / 2, lb / 2);
    const p1 = add(p, sub(pa, p), rr / la), p2 = add(p, sub(pb, p), rr / lb);
    for (let k = 0; k <= 8; k++) { const t = k / 8, u = 1 - t; out.push({ x: u * u * p1.x + 2 * u * t * p.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * p.y + t * t * p2.y }); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A port: a small slot in the face of a base where a link plugs in, as polygon points around the base's middle. */
export function portSlot(face: Face, at: Pt, center: Pt): string | null {
  if (!isFront(face)) return null;
  const F = FACES[face], o = sub(at, center), w = 3.2, h = 3.6;
  const a = add(o, F.along, -w), b = add(o, F.along, w);
  return [a, b, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }].map((p) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`).join(" ");
}

/** What a set of routes runs into: another part, another part's tag or load pill. Empty when every link keeps clear. */
export function routeProblems(nodes: RouteNode[], routes: Routed[]): string[] {
  const out: string[] = [];
  for (const r of routes) for (const n of nodes) {
    if (n.id === r.a || n.id === r.b) continue;
    for (const [p, q] of segsOf(r.pts)) {
      if (hitsPoly(p, q, bodyOf(n))) out.push(`${r.a}>${r.b} runs behind ${n.id}`);
      else if (hitsRound(p, q, n.tag, n.tagRound ?? 10)) out.push(`${r.a}>${r.b} runs behind ${n.id}'s tag`);
      else if (n.pill && hitsRect(p, q, n.pill)) out.push(`${r.a}>${r.b} runs behind ${n.id}'s pill`);
      else if (n.more?.some((m) => hitsRect(p, q, m))) out.push(`${r.a}>${r.b} runs behind what ${n.id} carries`);
    }
  }
  return [...new Set(out)];
}
