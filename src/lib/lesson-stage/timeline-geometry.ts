// Where a timeline's lifelines, heads and time axis go on a stage of a given size, how its rails are shaped, and where its
// flat labels rest so they keep clear of each other. Pure numbers (no DOM), so it can be tested.
//
// Wide: each part stands at the left end of its row and its lifeline runs right; time runs left to right. Phone: each part
// stands at the top of its column and its lifeline runs down. The layout is worked out once for the stage's size, so the
// scale holds for the whole scene, and it is sized so that one beat of time (a typical message) has room for its label.

import { applyEvent, initialModel, stepEvents, type Choices, type TimelineItem } from "./model.ts";
import type { StageScene } from "./types";

export type Pt = { x: number; y: number };
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** A lifeline's part, as the layout needs it. */
export type Lane = {
  id: string;
  /** How high the part's drawing stands above the middle of its base, in world units. */
  top: number;
  label: string;
  detail: string;
  /** The longest load pill the part shows, in characters (0 for none). */
  readout: number;
  /** A note floats over the part in some step. */
  note?: boolean;
};

export type LayoutInput = {
  narrow: boolean;
  /** The stage's size on screen, in px. */
  width: number;
  height: number;
  /** In lifeline order. */
  lanes: Lane[];
  /** How much time the timeline spans, and a beat: a typical message's travel time. */
  span: number;
  beat: number;
  /** A typical message label's width on screen (px), so a beat leaves it room. */
  pill: number;
  ticks: number[];
  unit: string;
  /** The engine's label scale at zoom k (the stage's own, FigureContext.labelScale), which its tags and pills follow. */
  engine: (k: number) => number;
};

export type Layout = {
  /** The engine's phone layout (tags show names only, load pills sit over the parts). */
  narrow: boolean;
  /** Time runs across the stage, lifelines as rows (wide screens, and short stages); otherwise down it, as columns. */
  across: boolean;
  /** The zoom the layout was made for, and the label scales there (ours and the engine's). */
  k: number;
  s: number;
  se: number;
  span: number;
  lanes: Lane[];
  index: Record<string, number>;
  heads: Record<string, Pt>;
  /** The lifeline's place across time: its row's y on a wide screen, its column's x on a phone. */
  cross: Record<string, number>;
  /** Along time: where t = 0 falls and how long the whole span is. */
  origin: number;
  length: number;
  /** Where each rail begins (under its head) and where every rail ends, along time (past the span, so the last moment
   * never sits at a rail's very end). */
  railStart: Record<string, number>;
  railEnd: number;
  stagger: boolean;
  ticks: number[];
  unit: string;
  /** Screen px per beat, as laid out. */
  beatPx: number;
};

// ---------- what the engine draws ----------
// The label scale comes from the engine (LayoutInput.engine) and a part's height from FigureContext.top. A part's base
// and its name tag can't be asked for before the parts stand somewhere, and the layout decides where they stand, so
// their sizes are written down here; the figure checks them against FigureContext.tag once the parts are placed and
// warns if the engine has drawn them differently (see checkTags in timeline.ts).
/** A base's front corner below a part's middle (half the 56 base, plus its 7 thickness), and its half width. */
const PH = 7, FRONT = 56 / 2 + PH, HALF = 48.5;
/** Our labels never drop below 10px of text on screen (their 10.5px type at 96%). */
export const MIN_LABEL = 0.96;
/** Our flat labels' scale at zoom k, given the engine's there. */
export function labelScale(k: number, engine: number): number {
  return Math.max(engine, MIN_LABEL / k);
}
const tagWidth = (l: Lane, narrow: boolean) => Math.round(Math.max(l.label.length * 7.4, narrow ? 0 : l.detail.length * 6.2) + 22);
const tagHeight = (l: Lane, narrow: boolean) => (l.detail && !narrow ? 36 : 22);
const readoutWidth = (chars: number) => 16 + chars * 6.5;
/** A message or mark pill's width on screen, as the engine draws packets. */
export const pillWidth = (label: string, dot: boolean) => Math.round((dot ? 26 : 16) + label.length * 6.3);
/** A span label's width on screen. */
export const spanLabelWidth = (label: string) => Math.round(label.length * 6.4 + 4);

// ---------- the rails ----------
/** A rail's top face, across (screen units), and how thick it stands. */
export const RAIL = { w: 8, h: 3, tail: 14 };
/** A span's sleeve over the rail. */
export const SLEEVE = { w: 15, h: 5.5 };
/** How far a lost message gets. */
export const LOST = 0.62;

// ---------- laying out ----------
/** Running across: how far a mark's flag reaches over its rail (stem, pill and breathing room), and what lies under the
 * last rail (a flag, or the time axis). */
const flagAbove = (s: number) => RAIL.h + RAIL.w / 2 + 32 * s;
/** Running down: how wide the times printed left of the first lifeline are, the last with its unit. */
const axisWidth = (ticks: number[], unit: string) =>
  ticks.length ? Math.max(...ticks.map((t, i) => `${t}${i === ticks.length - 1 && unit ? ` ${unit}` : ""}`.length)) * 6.6 + RAIL.w / 2 + 10 : 0;
const underLast = (s: number, ticks: boolean) => Math.max(RAIL.w / 2 + 32 * s, ticks ? RAIL.w / 2 + 10 + 16 * s : 0);

type Built = Layout & { fits: boolean };

function build(input: LayoutInput, k: number, across: boolean, stagger: boolean, spread: boolean, tight = false): Built {
  const { narrow, lanes } = input;
  const n = lanes.length, se = input.engine(k), s = labelScale(k, se);
  const pads = narrow ? { x: 14, top: 76, bottom: 84 } : { x: 40, top: 72, bottom: 84 };
  const aw = Math.max(1, input.width - pads.x * 2) / k, ah = Math.max(1, input.height - pads.top - pads.bottom) / k;
  const tw = lanes.map((l) => tagWidth(l, narrow)), th = lanes.map((l) => tagHeight(l, narrow));
  // below a head's middle: its base and tag; above: its drawing, and a note or (on a phone) its load pill
  const tb = lanes.map((_, i) => FRONT + (th[i] - 2) * se);
  const ht = lanes.map((l) => l.top + 10 + (l.note ? 34 * se : 0) + (narrow && l.readout ? 26 * se : 0));
  const heads: Record<string, Pt> = {}, cross: Record<string, number> = {}, railStart: Record<string, number> = {};
  const index: Record<string, number> = {};
  lanes.forEach((l, i) => { index[l.id] = i; });
  let origin = 0, length = 0, fits = true, tail = RAIL.tail;

  if (across) {
    // rows, top to bottom; a mark's pill rests over a rail and a span's label under it
    const markAbove = flagAbove(s), spanBelow = RAIL.w / 2 + 6 + 14 * s;
    let pMin = markAbove + spanBelow + 6, d = 0;
    for (let r = 0; r < n - 1; r++) {
      if (!stagger) pMin = Math.max(pMin, tb[r] + 12 + ht[r + 1]);
      else {
        // heads alternate between two columns: a rail threads between the tag above it and the part below it
        pMin = Math.max(pMin, tb[r] + 10, lanes[r + 1].top + 8);
        if (r < n - 2) pMin = Math.max(pMin, (tb[r] + 12 + ht[r + 2]) / 2);
        d = Math.max(d, 2 * HALF + 14, (tw[r] * se) / 2 + HALF + 12, (tw[r + 1] * se) / 2 + HALF + 12);
      }
    }
    const headX = (r: number) => (stagger && r % 2 ? -d : 0);
    let x0 = -Infinity, left = Infinity;
    lanes.forEach((l, r) => {
      const hx = headX(r);
      x0 = Math.max(x0, hx + Math.max(HALF, (tw[r] * se) / 2, l.readout && !narrow ? 46 + readoutWidth(l.readout) * se : 0) + 18 + 10 * s);
      left = Math.min(left, hx - Math.max(52, (tw[r] * se) / 2));
    });
    const over = 34 * s;
    length = aw - (x0 - left) - RAIL.tail - over;
    const place = (p: number) => lanes.forEach((l, r) => { heads[l.id] = { x: headX(r), y: r * p }; cross[l.id] = r * p; railStart[l.id] = headX(r); });
    const extent = (p: number) => {
      place(p);
      let y0 = -markAbove, y1 = (n - 1) * p + underLast(s, input.ticks.length > 0);
      lanes.forEach((l, r) => { y0 = Math.min(y0, r * p - ht[r]); y1 = Math.max(y1, r * p + tb[r]); });
      return y1 - y0;
    };
    let pitch = pMin;
    fits = n < 2 || extent(pMin) <= ah;
    if (spread && n > 1) {
      // spread the rows into the height there is, so messages slant clearly, but not so far that they float apart
      const room = ah - (extent(pMin) - (n - 1) * pMin);
      pitch = Math.min(pMin * 1.45, Math.max(pMin, room / (n - 1)));
    }
    place(pitch);
    origin = x0;
    fits = fits && length > 40;
  } else {
    // columns, left to right; the time origin sits under every head and its tag
    // a message label between neighbouring columns, unless there is no room for one: then it rests over a rail
    const pillRoom = tight ? 0 : input.pill * s + RAIL.w + 12;
    let qMin = Math.max(2 * HALF + 12, pillRoom);
    if (!stagger) for (let c = 0; c < n - 1; c++) qMin = Math.max(qMin, ((tw[c] + tw[c + 1]) / 2) * se + 10);
    else {
      // heads alternate between two heights, so neighbours' tags may pass over each other; every other head still
      // stands clear of the next but one, and of its neighbours' bases
      qMin = Math.max(pillRoom, 2 * HALF + 6);
      for (let c = 0; c < n - 2; c++) qMin = Math.max(qMin, ((tw[c] + tw[c + 2]) / 4) * se + 4);
    }
    /** How far the lower heads stand below the upper ones, for columns q apart. */
    const drop = (q: number) => {
      let z = 0;
      if (stagger) for (let c = 0; c < n - 1; c++) {
        const up = c % 2 ? c + 1 : c, low = c % 2 ? c : c + 1;
        // a tag runs from 31 − 6se to 35 + (h − 2)se below its head's middle
        if (((tw[up] + tw[low]) / 2) * se + 6 > q) z = Math.max(z, 4 + (th[up] + 4) * se + 6);
        if ((tw[up] * se) / 2 + HALF + 4 > q) z = Math.max(z, tb[up] + 8 + ht[low]);
        if ((tw[low] * se) / 2 + HALF + 4 > q) z = Math.max(z, FRONT + 4 - (31 - 6 * se));
      }
      return z;
    };
    const leftExt = Math.max(52, (tw[0] * se) / 2), rightExt = Math.max(52, (tw[n - 1] * se) / 2);
    const axisW = axisWidth(input.ticks, input.unit);
    const left = Math.max(leftExt, axisW * s);
    const room = n > 1 ? (aw - left - rightExt) / (n - 1) : qMin;
    let q = qMin;
    fits = room >= qMin;
    if (spread && n > 1) q = Math.min(qMin * 1.6, Math.max(qMin, room));
    // where the width allows, keep each tag off its neighbours' drawings: then the lower heads drop only a tag's height
    if (stagger) {
      let clear = 0;
      for (let c = 0; c < n; c++) clear = Math.max(clear, (tw[c] * se) / 2 + HALF + 5);
      if (room >= clear) q = Math.max(q, clear);
    }
    const z = drop(q), headY = (c: number) => (stagger && c % 2 ? z : 0);
    let y0 = -Infinity, top = Infinity;
    lanes.forEach((_, c) => { y0 = Math.max(y0, headY(c) + tb[c]); top = Math.min(top, headY(c) - ht[c]); });
    y0 += 10 + 6 * s;
    length = ah - (y0 - top) - RAIL.tail - 12 * s;
    fits = fits && length > 40;
    // laid out, the rails run on past the last moment by up to a flag's height more, from whatever room a beat can spare
    if (spread) {
      const more = Math.max(0, Math.min(12 * s, length - (BEAT_PX.narrow / k) * (input.span / input.beat)));
      length -= more;
      tail += more;
    }
    lanes.forEach((l, c) => { heads[l.id] = { x: c * q, y: headY(c) }; cross[l.id] = c * q; railStart[l.id] = headY(c); });
    origin = y0;
  }
  const beatPx = (length / Math.max(1, input.span / input.beat)) * k;
  return {
    narrow, across, k, s, se, span: input.span, lanes, index, heads, cross, origin, length, railStart, railEnd: origin + length + tail,
    stagger, ticks: input.ticks, unit: input.unit, beatPx, fits,
  };
}

/** Below this zoom the parts grow too small to read; a timeline that needs more room squeezes its beats instead. */
const MIN_ZOOM = 0.42;
/** A beat needs this much room on screen for its message label (wide: across, phone: down). */
export const BEAT_PX = { wide: 64, narrow: 33 };

/** The layout for a stage: the largest zoom at which every lifeline fits and a beat has room for its label. Time runs
 * across a wide stage and down a phone's; a phone-width stage that is short rather than tall runs it across too. */
export function layoutTimeline(input: LayoutInput): Layout {
  const cap = input.narrow ? 1.15 : 1.3;
  const n = input.lanes.length;
  // the largest zoom where everything fits and a beat has its room; failing that, the smallest zoom that still fits
  // (down to MIN_ZOOM), which gives a beat the most room there is
  let best: { k: number; across: boolean; stagger: boolean; score: number; tight: boolean } | null = null;
  for (const tight of [false, true]) for (const across of input.narrow ? [false, true] : [true]) for (const stagger of [false, true]) {
    if (best && tight && !best.tight) break;
    if (stagger && n < (across ? 2 : 3)) continue;
    const want = across ? BEAT_PX.wide : BEAT_PX.narrow;
    let found = 0, fallback = 0;
    for (let k = cap; k >= 0.3; k = Math.round((k - 0.01) * 100) / 100) {
      const g = build(input, k, across, stagger, false, tight);
      if (!g.fits) continue;
      if (g.beatPx >= want && k >= MIN_ZOOM) { found = k; break; }
      if (k >= MIN_ZOOM || !fallback) fallback = k;
    }
    if (!found && !fallback) continue;
    // a straight column (row) of heads reads best: stagger only when it buys a much bigger drawing; and a phone keeps
    // time running down unless running it across is clearly better
    const score = (found ? 10 : 0) + (found || fallback) * (stagger ? 0.8 : 1) * (input.narrow && across ? 0.85 : 1);
    if (!best || score > best.score) best = { k: found || fallback, across, stagger, score, tight };
  }
  const chosen = best ?? { k: MIN_ZOOM, across: !input.narrow, stagger: n > 2, tight: true };
  const { fits: _fits, ...layout } = build(input, chosen.k, chosen.across, chosen.stagger, true, chosen.tight);
  return layout;
}

// ---------- positions along a lifeline ----------
/** Where time t falls along the lifelines. */
export const along = (g: Layout, t: number) => g.origin + (t / g.span) * g.length;
/** The point on a lifeline's rail (its top face's middle) at time t. */
export function lanePoint(g: Layout, id: string, t: number): Pt {
  const a = along(g, t), c = g.cross[id] ?? 0;
  return g.across ? { x: a, y: c - RAIL.h } : { x: c, y: a - RAIL.h };
}
export const lerp = (a: Pt, b: Pt, f: number): Pt => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
/** The now line at time t, across every lifeline: `a` is the end with its caret (over the first rail on a wide stage,
 * left of the first lifeline on a phone). */
export function nowLine(g: Layout, t: number, s: number): { a: Pt; b: Pt } {
  const at = along(g, t), first = g.cross[g.lanes[0].id], last = g.cross[g.lanes[g.lanes.length - 1].id];
  return g.across
    ? { a: { x: at, y: first - RAIL.h - RAIL.w / 2 - 10 * s }, b: { x: at, y: last + RAIL.w / 2 + 8 * s } }
    : { a: { x: first - RAIL.w / 2 - 10 * s, y: at - RAIL.h }, b: { x: last + RAIL.w / 2 + 10 * s, y: at - RAIL.h } };
}

/** What the timeline takes on screen at label scales s (ours) and se (the engine's), for the camera. */
export function layoutBox(g: Layout, s: number, se: number): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (a: number, b: number, c: number, d: number) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  for (const l of g.lanes) {
    const p = g.heads[l.id], half = Math.max(52, (tagWidth(l, g.narrow) / 2) * se);
    const up = l.top + 10 + (l.note ? 34 * se : 0) + (g.narrow && l.readout ? 26 * se : 0);
    grow(p.x - half, p.y - up, p.x + half, p.y + FRONT + (tagHeight(l, g.narrow) - 2) * se);
    if (!g.narrow && l.readout) grow(p.x, p.y, p.x + 46 + readoutWidth(l.readout) * se, p.y);
  }
  const first = g.cross[g.lanes[0].id], last = g.cross[g.lanes[g.lanes.length - 1].id];
  if (g.across) {
    grow(g.origin, first - flagAbove(s), g.railEnd + 34 * s, last + underLast(s, g.ticks.length > 0));
  } else {
    const axisW = axisWidth(g.ticks, g.unit);
    grow(first - axisW * s, g.origin, last, g.railEnd + 12 * s);
  }
  return { x0, y0, x1, y1 };
}

/** The box a part's name tag takes, as the engine draws it at label scale se. */
export function tagBox(g: Layout, l: Lane, se: number): Box {
  const p = g.heads[l.id], tw = (tagWidth(l, g.narrow) / 2) * se;
  return { x0: p.x - tw, y0: p.y + FRONT - 4 - 6 * se, x1: p.x + tw, y1: p.y + FRONT - 4 - 6 * se + tagHeight(l, g.narrow) * se };
}

/** Boxes the heads take (their drawing, base and tag), which labels keep clear of. */
export function headBoxes(g: Layout, se: number): Box[] {
  return g.lanes.flatMap((l) => {
    const p = g.heads[l.id];
    return [{ x0: p.x - HALF, y0: p.y - l.top - 4, x1: p.x + HALF, y1: p.y + FRONT }, tagBox(g, l, se)];
  });
}

// ---------- the rails' shapes ----------
function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [], hi: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const closed = (list: Pt[]) => "M" + list.map((p) => `${r2(p.x)} ${r2(p.y)}`).join("L") + "Z";

/** A flat bar lying on the floor from `a` to `b` along time, its middle at `c` across: `w` wide on screen and `h` thick,
 * each end rounded like a floor semicircle seen from the stage's angle. Returns its top face and the side that shows. */
export function barPaths(across: boolean, a: number, b: number, c: number, w: number, h: number, round: [boolean, boolean] = [false, true]): { top: string; side: string } {
  // a floor semicircle at a bar's end: running across the screen the bar lies along a floor diagonal that is flat on
  // screen, so its end cap is a half-ellipse 0.87w deep; running down the screen its cap is only 0.29w deep
  const depth = across ? 0.866 * w : 0.2887 * w, half = w / 2;
  const cap = (end: number, dir: number, on: boolean): Pt[] => {
    const out: Pt[] = [];
    const steps = on ? 10 : 1;
    for (let i = 0; i <= steps; i++) {
      const th = -Math.PI / 2 + (i / steps) * Math.PI;
      const u = on ? Math.cos(th) * depth * dir : 0, v = Math.sin(th) * half * dir;
      out.push(across ? { x: end + u, y: c + v - h } : { x: c - v, y: end + u - h });
    }
    return out;
  };
  const topFace = [...cap(Math.max(a, b), 1, round[1]), ...cap(a, -1, round[0])];
  const bottom = topFace.map((p) => ({ x: p.x, y: p.y + h }));
  return { top: closed(topFace), side: closed(hull([...topFace, ...bottom])) };
}

// ---------- resting labels ----------
export type LabelSpec =
  /** A message's pill rests on its line from `a` to `b` (its drawn end), as near the middle as it can. */
  | { kind: "message"; key: string; seq?: number; a: Pt; b: Pt; w: number; dup?: boolean }
  /** A mark's pill hangs off its dot on lifeline `lane`. */
  | { kind: "mark"; key: string; seq?: number; at: Pt; w: number; lane: number }
  /** A span's label sits by its start. `seq` is each one's place in its telling, so only the now lines it lives with
   * count (see `Now`). */
  | { kind: "span"; key: string; seq?: number; at: Pt; w: number; lane: number };
export type Resting = {
  key: string;
  /** The label's middle (message, mark) or the end it is anchored by (span), and the box it covers. */
  at: Pt;
  box: Box;
  /** For a message, how far along its line it rests; for a mark, where its stem meets the pill (none: the pill sits
   * right by its dot). A stem always runs straight across the rail or along it, never aslant. */
  f?: number;
  stem?: Pt;
  /** For a span label, its text anchor. */
  anchor?: "start" | "middle" | "end";
  /** A message whose pill says the same as another's sent or received at the same moment, and finds no clear place: it
   * rides while it travels but does not stay, and the first of them speaks for all. */
  hidden?: boolean;
  /** How much less natural this place is than the label's first choice, so that of two clear places the nearer wins. */
  pref?: number;
};

const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
/** How much of a segment passes through a box. */
export function inside(b: Box, p: Pt, q: Pt): number {
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  for (const [pp, qq] of [[-dx, p.x - b.x0], [dx, b.x1 - p.x], [-dy, p.y - b.y0], [dy, b.y1 - p.y]] as const) {
    if (pp === 0) { if (qq < 0) return 0; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return 0; if (r > t0) t0 = r; } else { if (r < t0) return 0; if (r < t1) t1 = r; }
  }
  return t1 > t0 ? (t1 - t0) * Math.hypot(dx, dy) : 0;
}

const FRACTIONS = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8];
/** The room a label keeps around itself (screen px): `pad` always (its box), and up to `gutter` where there is space,
 * so two labels rest at least 6px apart and, where they can, 12px. */
export const ROOM = { pad: 3, gutter: 6 };

/** A message's line, which labels keep off. */
export type Line = { key: string; a: Pt; b: Pt };
/** Where a step leaves the now line (time t), once the first `seen` items of its telling are drawn. */
export type Now = { t: number; seen: number };

/** Rest every label in order, each where it covers the least of what is already there: heads, the rails, the labels
 * before it, the message lines before it and in `ahead` (the lines still to come in this telling, so a label never
 * rests where a later message will cross it), and the now line wherever a step leaves it (`nows`, its times). The same
 * items always rest in the same places, and adding one never moves those before it. With `refine`, up to that many
 * passes then move any label to a better place given all the others (each move lowers the total cover, so it settles);
 * a story placed all at once uses it, and then a later label can make room for an earlier one. */
export function placeLabels(g: Layout, specs: LabelSpec[], s: number, se: number, ahead: Line[] = [], refine = 0, nows: Now[] = []): Map<string, Resting> {
  const frame = layoutBox(g, s, se);
  const solid: Box[] = headBoxes(g, se), tags = g.lanes.map((l) => tagBox(g, l, se));
  const pad = ROOM.pad * s, more = (ROOM.gutter - ROOM.pad) * s, hh = 11 * s;
  // the rails in the time area: a label resting on one reads as a mark on that lifeline
  const rails: Box[] = g.lanes.map((l) => {
    const c = g.cross[l.id];
    return g.across
      ? { x0: g.origin - 4, y0: c - RAIL.h - RAIL.w / 2 - 1, x1: g.railEnd, y1: c + RAIL.w / 2 + 1 }
      : { x0: c - RAIL.w / 2 - 1, y0: g.origin - 4, x1: c + RAIL.w / 2 + 1, y1: g.railEnd };
  });
  // the now line where a step leaves it: a pill sits over it (only its caret must show), but a span label's bare text
  // reads as struck out where it runs through
  const still = nows.map(({ t, seen }) => {
    const { a, b } = nowLine(g, t, s), caret = g.across ? { x: a.x, y: a.y - 2 * s } : { x: a.x - 2 * s, y: a.y };
    return { seen, a: caret, b, tip: lerp(caret, b, (14 * s) / Math.hypot(b.x - caret.x, b.y - caret.y)) };
  });
  const grown = (b: Box, d: number): Box => ({ x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d });
  type Slot = { cands: Resting[]; own?: string; lane?: number; seq: number; kind: LabelSpec["kind"]; pick: Resting; dup?: boolean; hidden?: boolean };
  const slots: Slot[] = [], lines: Line[] = [...ahead];
  /** What a place costs a label: what it covers, how far it is from the label's first choice, and (unless `hard`) how
   * it sits with the now line, which matters less than covering something. */
  const score = (c: Resting, self: number, hard = false) => {
    const { own: line, lane, seq, kind } = slots[self], box = c.box;
    let sc = c.pref ?? 0;
    // a part or its name tag, or another label: never on it (any overlap costs as much as a line under it), and from
    // another label a full gutter where there is room
    const on = (b: Box) => { const a = area(box, b); return a > 0.5 ? 60 * s * s + a * 1.5 : 0; };
    for (const b of solid) sc += on(b);
    // a name tag keeps a little air around it too
    for (const b of tags) sc += area(grown(box, 8 * s - pad), b) * 0.5;
    const wide = grown(box, more);
    slots.forEach((o, i) => { if (i !== self && !o.hidden) sc += on(o.pick.box) + area(wide, grown(o.pick.box, more)) * 0.3; });
    rails.forEach((b, i) => { if (i !== lane) sc += area(box, b) * 0.6; });
    // a line under a label reads as crossed out: what counts is how much of it the label hides (it may pass close by)
    const near = grown(box, s - pad);
    for (const l of lines) if (l.key !== line) { const len = inside(near, l.a, l.b); if (len > 0) sc += (12 + len) * 8 * s; }
    // the now line may pass near a label, just not through it (only where it stands once the label is there): through
    // bare words it strikes them out, and a flag on it reads as part of it; under a message's pill only its caret matters,
    // though the pill is better clear of it too
    const tight = grown(box, 2 * s - pad);
    if (!hard) for (const n of still) if (seq < n.seen) {
      const len = inside(tight, n.a, kind === "message" ? n.tip : n.b);
      if (len > 0) sc += (12 + len) * 4 * s;
      else if (inside(tight, n.a, n.b) > 0) sc += 16 * s * s;
    }
    // running down a phone, a label is better not hanging past where the telling ends, onto the bare ends of the rails
    const end = still[still.length - 1];
    if (!hard && end && !g.across && tight.y1 > end.a.y) sc += 30 * s * s;
    const outside = (box.x1 - box.x0) * (box.y1 - box.y0) - area(box, frame);
    return sc + outside * 4;
  };
  /** The nearest place that covers nothing, or else the one that costs least. */
  const best = (self: number) => {
    const cands = slots[self].cands;
    let pick = cands[0], least = Infinity;
    for (const c of cands) {
      const sc = score(c, self);
      if (sc < least - 0.5) { least = sc; pick = c; }
      // places come nearest first: once one is clear, none after it can do better
      if (sc - (c.pref ?? 0) <= 0.5) break;
    }
    return { pick, least };
  };
  const choose = (sp: LabelSpec, cands: Resting[], own?: string, lane?: number, dup?: boolean) => {
    const self = slots.length;
    slots.push({ cands, own, lane, seq: sp.seq ?? -1, kind: sp.kind, pick: cands[0], dup });
    slots[self].pick = best(self).pick;
  };
  const boxAt = (x: number, y: number, hw: number, h: number): Box => ({ x0: x - hw - pad, y0: y - h - pad, x1: x + hw + pad, y1: y + h + pad });
  for (const sp of specs) {
    const hw = (sp.w / 2) * s;
    if (sp.kind === "message") {
      const cands = FRACTIONS.map((f) => {
        const at = lerp(sp.a, sp.b, f);
        return { key: sp.key, at, f, box: boxAt(at.x, at.y, hw, hh) };
      });
      choose(sp, cands, sp.key, undefined, sp.dup);
      if (!lines.some((l) => l.key === sp.key)) lines.push({ key: sp.key, a: sp.a, b: sp.b });
    } else if (sp.kind === "mark") {
      const stem = 7 * s, r = hh, cands: Resting[] = [], p = sp.at;
      const at = (x: number, y: number, st?: Pt): Resting => ({ key: sp.key, at: { x, y }, ...(st ? { stem: st } : {}), box: boxAt(x, y, hw, hh) });
      const put = (pref: number, ...list: Resting[]) => { for (const c of list) cands.push({ ...c, pref: pref * s * s }); };
      /** How far the pill's outline lies from its middle line, `d` along it from its middle (its ends are round). */
      const rim = (d: number) => { const e = Math.abs(d) - (hw - r); return e <= 0 ? r : Math.sqrt(Math.max(0, r * r - e * e)); };
      const lean = hw - 12 * s, far = Math.max(lean, hw - 6 * s);
      const last = sp.lane === g.lanes.length - 1 && g.lanes.length > 1, sides = last ? [-1, 1] : [1, -1];
      if (g.across) {
        // a flag over the rail or under it, its stem rising (dropping) straight from the dot to its edge: centred, then
        // slid along the stem so a line arriving at the dot from one side stays clear, then higher or lower
        const up = p.y - RAIL.w / 2 - stem - hh, down = p.y + RAIL.w / 2 + RAIL.h + stem + hh;
        const flag = (dx: number, y: number) => at(p.x + dx, y, { x: p.x, y: y < p.y ? y + rim(dx) : y - rim(dx) });
        for (const y of [up, down]) put(0, flag(0, y)), put(4, flag(lean, y), flag(-lean, y));
        for (const y of [up - 16 * s, down + 16 * s]) put(16, flag(lean, y), flag(-lean, y));
        for (const y of [up, down]) put(20, flag(far, y), flag(-far, y));
        for (const y of [up - 16 * s, down + 16 * s]) put(30, flag(far, y), flag(-far, y));
        // then lying on its own rail right beside the dot, with no stem; last, hung by its very end, wholly to one side
        for (const side of [1, -1]) put(50, at(p.x + side * (6 * s + hw), p.y));
        for (const y of [up, down]) put(56, flag(hw - 2 * s, y), flag(2 * s - hw, y));
      } else {
        // beside the dot, its stem running level across to the flag's end; the flag may sit a little higher or lower
        const beside = (side: number, dy: number, reach: number) => {
          const x = p.x + side * (RAIL.w / 2 + reach + hw);
          return at(x, p.y + dy, { x: x - side * (hw - r + Math.sqrt(Math.max(0, r * r - dy * dy))), y: p.y });
        };
        for (const side of sides) put(0, beside(side, 0, stem)), put(6, beside(side, 6 * s, stem), beside(side, -6 * s, stem));
        // tucked in beside the dot, a little under (over) it, so close it needs no stem: clear of a line arriving there
        for (const side of sides) for (const dy of [hh + 2 * s, -hh - 2 * s]) put(12, at(p.x + side * (RAIL.w / 2 + 3 * s + hw), p.y + dy));
        // rather than lie across a neighbour's lifeline, hang under the dot (or over it) on its own, centred or leaning
        // in toward the stage, the stem dropping straight from the dot onto the flag's edge
        const below = p.y + 4 * s + stem + hh, above = p.y - 4 * s - stem - hh, hang = (dx: number, y: number) => at(p.x + dx, y, { x: p.x, y: y < p.y ? y + rim(dx) : y - rim(dx) });
        for (const y of [below, above]) for (const dx of [0, ...sides.map((side) => side * Math.max(0, lean))]) put(20, hang(dx, y));
        for (const side of sides) put(30, beside(side, 0, stem + 14 * s));
        // and further under (over) it on a longer stem
        for (const far of [14, 26]) for (const y of [below + far * s, above - far * s]) for (const dx of [0, ...sides.map((side) => side * Math.max(0, lean))]) put(26 + far, hang(dx, y));
      }
      choose(sp, cands, undefined, sp.lane);
    } else {
      const w = sp.w * s, h = 7 * s, cands: Resting[] = [], p = sp.at;
      /** The label's text from `x` on (start), up to `x` (end) or around it (middle), its middle line at y. */
      const label = (x: number, y: number, anchor: "start" | "middle" | "end"): Resting => {
        const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
        return { key: sp.key, at: { x, y }, anchor, box: { x0: x0 - pad, y0: y - h - pad, x1: x0 + w + pad, y1: y + h + pad } };
      };
      if (g.across) {
        // under the sleeve or over it, from its start on; else ending where it starts
        const below = p.y + RAIL.h + SLEEVE.w / 2 + 3 + h, above = p.y - SLEEVE.w / 2 - 3 - h;
        for (const y of [below, above]) cands.push(label(p.x + 2, y, "start"));
        for (const y of [above, below]) cands.push({ ...label(p.x - 2, y, "end"), pref: 10 * s * s });
      } else {
        // beside the sleeve, its top level with the sleeve's top; else over the sleeve's start on its own lifeline, like
        // a heading; else just above the start beside it, and lower only if it must
        const off = SLEEVE.w / 2 + 6, last = sp.lane === g.lanes.length - 1 && g.lanes.length > 1, sides = last ? [-1, 1] : [1, -1];
        const beside = (side: number, dy: number) => label(p.x + side * off, p.y + dy, side > 0 ? "start" : "end");
        const put = (pref: number, c: Resting) => cands.push({ ...c, pref: pref * s * s });
        for (const side of sides) put(0, beside(side, h)), put(6, beside(side, h + 7 * s));
        put(10, label(p.x, p.y - 6 - h, "middle"));
        for (const side of sides) put(16, beside(side, -h - 2 * s)), put(24, beside(side, h + 15 * s)), put(40, beside(side, h + 30 * s));
      }
      choose(sp, cands, undefined, sp.lane);
    }
  }
  /** Passes that move each label (but `keep`) to its best place given the others, until none moves: off what it covers,
   * or back nearer its first choice once room has opened there. */
  const settle = (keep = -1) => {
    for (let pass = 0; pass < refine; pass++) {
      let moved = false;
      slots.forEach((o, i) => {
        if (o.hidden || i === keep) return;
        const now = score(o.pick, i);
        if (now <= 0.5) return;
        const { pick, least } = best(i);
        if (least < now - 0.5) { o.pick = pick; moved = true; }
      });
      if (!moved) break;
    }
  };
  const total = () => slots.reduce((sum, o, i) => sum + (o.hidden ? 0 : score(o.pick, i)), 0);
  /** Two labels can block each other where neither moving alone helps: so a label still covering something tries each of
   * its places with the others settling around it, and the whole arrangement that covers least wins. */
  const untangle = () => {
    if (!refine) return;
    settle();
    for (let round = 0; round < 2; round++) {
      let changed = false;
      slots.forEach((o, i) => {
        if (o.hidden || score(o.pick, i) - (o.pick.pref ?? 0) <= 0.5) return;
        const start = slots.map((x) => x.pick);
        let least = total(), won = start;
        for (const c of o.cands) {
          if (c === start[i]) continue;
          slots.forEach((x, j) => { x.pick = start[j]; });
          o.pick = c;
          settle(i);
          const sum = total();
          if (sum < least - 0.5) { least = sum; won = slots.map((x) => x.pick); }
        }
        slots.forEach((x, j) => { x.pick = won[j]; });
        changed ||= won !== start;
      });
      if (!changed) break;
    }
  };
  untangle();
  // a repeated pill that still covers something stays hidden, and the others may then take the room it leaves
  let hid = false;
  slots.forEach((o, i) => { if (o.dup && score(o.pick, i, true) - (o.pick.pref ?? 0) > 0.5) { o.hidden = hid = true; } });
  if (hid) untangle();
  return new Map(slots.map((o) => [o.pick.key, o.hidden ? { ...o.pick, hidden: true } : o.pick]));
}

// ---------- a whole telling ----------
/** A message's line: from its sender's rail at t0 to the near edge of the receiver's rail at t1, or well short of it
 * when it is lost; `full` is where it would land. */
export function messageEnds(g: Layout, it: { from: string; to: string; t0: number; t1: number; lost: boolean }) {
  const a = lanePoint(g, it.from, it.t0), full = lanePoint(g, it.to, it.t1);
  const gap = Math.abs(g.across ? full.y - a.y : full.x - a.x) || 1;
  const b = it.lost ? lerp(a, full, LOST) : lerp(a, full, 1 - Math.min(0.4, (RAIL.w / 2 + 1.5) / gap));
  return { a, b, full };
}
/** What each item's label asks for: a message's pill on its line, a mark's flag by its dot, a span's label by its start. */
export function labelSpecs(g: Layout, items: TimelineItem[], key: (it: TimelineItem) => string): LabelSpec[] {
  // the same words sent by one part to several at once, or received by one part from several at once
  const said = new Set<string>();
  return items.flatMap((it, seq): LabelSpec[] => {
    if (it.kind === "message") {
      const e = messageEnds(g, it), out = `o|${it.from}|${it.t0}|${it.label}|${it.flow}`, back = `i|${it.to}|${it.t1}|${it.label}|${it.flow}`;
      const dup = said.has(out) || said.has(back);
      said.add(out).add(back);
      return [{ kind: "message", key: key(it), seq, a: e.a, b: e.b, w: pillWidth(it.label, it.flow !== "request"), dup }];
    }
    if (it.kind === "mark") return [{ kind: "mark", key: key(it), seq, at: lanePoint(g, it.node, it.t), w: pillWidth(it.text, !!it.tone), lane: g.index[it.node] ?? 0 }];
    return it.label ? [{ kind: "span", key: key(it), seq, at: lanePoint(g, it.node, it.t0), w: spanLabelWidth(it.label), lane: g.index[it.node] ?? 0 }] : [];
  });
}
// a span's label has only a few places by its sleeve, a mark's flag many around its dot
const ORDER = { message: 0, span: 1, mark: 2 } as const;
/** Where the labels of everything a telling draws rest, worked out at once: clear of every line it will draw and of the
 * now line where each of its steps leaves it (`nows`), the message pills first (as near their lines' middles as they
 * can), then the spans' labels and the marks' flags around them, and then a few passes that let any label move to a
 * better place now that it knows where all the others are. */
export function restTelling(g: Layout, items: TimelineItem[], key: (it: TimelineItem) => string, nows: Now[] = []): Map<string, Resting> {
  const all = labelSpecs(g, items, key);
  const ahead: Line[] = all.flatMap((sp) => (sp.kind === "message" ? [{ key: sp.key, a: sp.a, b: sp.b }] : []));
  return placeLabels(g, [...all].sort((a, b) => ORDER[a.kind] - ORDER[b.kind]), g.s, g.se, ahead, 4, nows);
}

export type Telling = { keys: string[]; items: TimelineItem[]; nows: Now[] };
/** Each telling of a scene's story: the items drawn by each rewind and by the end, in order (for every control option),
 * and where each of its steps leaves the now line. Labels are rested for a whole telling at once, clear of the lines
 * still to come, so none has to move when they arrive. */
export function tellings(scene: StageScene, key: (it: TimelineItem) => string): Telling[] {
  const out: Telling[] = [];
  const runs: Choices[] = [{}];
  scene.steps.forEach((step, i) => step.control?.options.forEach((_, j) => { if (j) runs.push({ [i]: j }); }));
  for (const choices of runs) {
    const m = initialModel(scene);
    let nows: Now[] = [];
    const keep = () => { const items = structuredClone(m.timeline?.items ?? []); if (items.length) out.push({ keys: items.map(key), items, nows }); nows = []; };
    for (let i = 0; i < scene.steps.length; i++) {
      for (const e of stepEvents(scene, i, choices)) {
        if (e.type === "rewind") keep();
        applyEvent(m, e);
      }
      if (m.timeline) nows.push({ t: m.timeline.clock, seen: m.timeline.items.length });
    }
    keep();
  }
  return out;
}
