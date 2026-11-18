// The timeline figure (layout "timeline"): each part stands at the head of its lifeline, a low rail lying on the floor
// that runs across time. Messages slant from one rail to another with their label riding them, marks stand on a rail with
// a small flag, spans wrap a stretch of rail in a sleeve, and a fine line marks now. Where everything goes is worked out
// in timeline-geometry.ts; this module draws it and plays it.
import type { Figure, FigureFactory, Point, Token } from "./figure";
import { applyEvent, cloneModel, stateBefore, stepEvents, type StageModel, type TimelineItem } from "./model";
import { timelineSpan } from "./figure-model";
import type { StageEvent, StageScene } from "./types";
import {
  LOST, RAIL, SLEEVE, along, barPaths, labelScale, lanePoint, layoutBox, layoutTimeline, lerp, messageEnds, nowLine, pillWidth, restTelling,
  spanLabelWidth, tagBox, tellings, type Box, type Lane, type Layout, type Resting, type Telling,
} from "./timeline-geometry";
import styles from "./timeline.module.css";

type Msg = Extract<TimelineItem, { kind: "message" }>;
type Mark = Extract<TimelineItem, { kind: "mark" }>;
type Span = Extract<TimelineItem, { kind: "span" }>;
type Drawn = {
  key: string;
  item: TimelineItem;
  /** Its drawing on the floor, and its flat label over everything. */
  g: SVGGElement;
  lab: SVGGElement | null;
  /** Outer groups that carry focus dimming, so it never fights the fades drawn on g and lab. */
  dims: SVGGElement[];
  rest?: Resting;
  /** How visible it is and how far drawn (a message's line, a mark's pop); a play owns it while busy. */
  op: number;
  prog: number;
  busy: boolean;
  leaving: boolean;
  /** A message's pill while it rides: how far along, and how big. */
  riding: boolean;
  pillF: number;
  pillSc: number;
  /** How much of a riding pill shows: a repeated pill that will not stay fades as it arrives. */
  pillOp: number;
  /** How much of a request pill is still ink, as packets are while they travel: it drains away toward the receiver as
   * the message lands, leaving the resting outline (a wipe, never a fade, so the words read at every moment). */
  ink: number;
  /** How visible a span's label is (the now line breaks behind it). */
  labOp: number;
  /** A span's drawn end in time; null follows now. */
  end: number | null;
  parts: Record<string, SVGElement>;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Clip paths need ids unique in the page, whatever else it holds. */
const uid = `tl${Math.random().toString(36).slice(2, 8)}`;
let clips = 0;
const keyOf = (it: TimelineItem) =>
  it.kind === "message" ? `m|${it.id}|${it.from}|${it.to}|${it.t0}|${it.t1}|${it.label}|${it.flow}|${it.lost}`
    : it.kind === "mark" ? `k|${it.id}|${it.node}|${it.t}|${it.text}|${it.tone}`
      : `s|${it.id}|${it.node}|${it.t0}|${it.label}|${it.tone}`;
const startOf = (it: TimelineItem) => (it.kind === "mark" ? it.t : it.t0);
const pulseKind = (flow: string) => (flow === "response" || flow === "work" ? "work" : flow === "hot" ? "hot" : "plain");
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** What the scene asks of the layout, read once: its lifelines in order, its span and beat, its widest labels. */
function readScene(scene: StageScene, top: (id: string) => number) {
  const all = scene.steps.flatMap((st) => [...st.events, ...(st.control?.options.flatMap((o) => o.events) ?? [])]);
  const readout: Record<string, number> = {};
  for (const e of all) if (e.type === "state" && e.readout) for (const id of e.nodes ?? (e.node ? [e.node] : [])) readout[id] = Math.max(readout[id] ?? 0, e.readout.length);
  const noted = new Set(all.flatMap((e) => (e.type === "note" ? [e.node] : [])));
  const lanes: Lane[] = [...scene.nodes].sort((a, b) => a.at[0] - b.at[0])
    .map((n) => ({ id: n.id, top: top(n.id), label: n.label, detail: n.detail ?? "", readout: readout[n.id] ?? 0, note: noted.has(n.id) }));
  const packets = all.flatMap((e) => (e.type === "packet" ? [e] : []));
  const median = (list: number[], fallback: number) => {
    if (!list.length) return fallback;
    const s = [...list].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const ticks = scene.timeline?.ticks ?? [];
  return {
    lanes,
    span: Math.max(timelineSpan(scene), ...ticks, 0.001),
    beat: median(packets.map((e) => e.dur ?? 1), 1),
    pill: median(packets.map((e) => pillWidth(e.label, (e.kind ?? "request") !== "request")), 60),
    ticks,
    unit: scene.timeline?.unit ?? "",
  };
}

export const timelineFigure: FigureFactory = (ctx) => {
  const { el, scene } = ctx;
  const info = readScene(scene, ctx.top);
  const root = el("g", { class: styles.timeline }, ctx.layers.floor);
  const gRails = el("g", {}, root), gSpans = el("g", {}, root), gNow = el("g", {}, root);
  const gLines = el("g", {}, root), gMarks = el("g", {}, root), gFx = el("g", {}, root);
  const gLab = el("g", { class: styles.labels }, ctx.layers.top);
  const gAxis = el("g", {}, gLab), gItems = el("g", {}, gLab);
  const sl = () => labelScale(ctx.zoom(), ctx.labelScale());

  // ---------- the layout, made for the stage's size ----------
  // The stage's size is read only where the engine asks for the camera (bounds, which it calls right after measuring
  // the stage itself), when it renders or switches layouts, and once at the start; drawing a frame never reads layout.
  let geo: Layout | null = null, geoKey = "", size: { w: number; h: number } | null = null;
  function measure() {
    const r = ctx.layers.floor.ownerSVGElement?.getBoundingClientRect();
    // a momentary collapse (a screenshot tool laying the page out) keeps the last size
    if (r && r.width >= 100 && r.height >= 100) size = { w: r.width, h: r.height };
  }
  function geometry(): Layout {
    if (!size) measure();
    const { w, h } = size ?? { w: 600, h: 440 };
    const key = `${ctx.narrow()}|${Math.round(w)}|${Math.round(h)}`;
    if (!geo || key !== geoKey) {
      geoKey = key;
      geo = layoutTimeline({ narrow: ctx.narrow(), width: w, height: h, ...info, engine: (k) => ctx.labelScale(k) });
    }
    return geo;
  }

  // ---------- the rails, the axis and now ----------
  type Rail = { g: SVGGElement; shade: SVGPathElement; side: SVGPathElement; top: SVGPathElement; notches: SVGGElement; shown: boolean };
  const rails: Record<string, Rail> = {};
  for (const l of info.lanes) {
    const g = el("g", { class: styles.rail }, gRails);
    const shade = el("path", { class: styles.railShade }, g);
    rails[l.id] = { g, shade, side: el("path", { class: styles.railSide }, g), top: el("path", { class: styles.railTop }, g), notches: el("g", {}, g), shown: true };
  }
  const nowPath = el("path", { class: styles.now }, gNow);
  const nowCaret = el("path", { class: styles.nowCaret }, gNow);
  let drawnGeo: Layout | null = null, nowT = 0;

  function drawStatic(g: Layout) {
    for (const l of info.lanes) {
      const r = rails[l.id], c = g.cross[l.id];
      const p = barPaths(g.across, g.railStart[l.id], g.railEnd, c, RAIL.w, RAIL.h, [false, true]);
      r.side.setAttribute("d", p.side);
      r.top.setAttribute("d", p.top);
      // a soft shadow where it meets the floor, like a part's base
      r.shade.setAttribute("d", barPaths(g.across, g.railStart[l.id], g.railEnd + 2, c + 2.5, RAIL.w + 4, RAIL.h, [false, true]).side);
      r.notches.innerHTML = "";
      for (const t of g.ticks) {
        const a = along(g, t), h = RAIL.w / 2 - 1.5;
        el("path", { class: styles.notch, d: g.across ? `M${r2(a)} ${r2(c - RAIL.h - h)}V${r2(c - RAIL.h + h)}` : `M${r2(c - h)} ${r2(a - RAIL.h)}H${r2(c + h)}` }, r.notches);
      }
    }
    gAxis.innerHTML = "";
    g.ticks.forEach((t, i) => {
      const last = i === g.ticks.length - 1;
      const o = el("g", {}, gAxis);
      const text = el("text", { class: styles.axis, "text-anchor": g.across ? "middle" : "end", y: 3.6 }, o);
      text.textContent = last && g.unit ? `${t} ${g.unit}` : String(t);
      o.dataset.t = String(t);
    });
    drawnGeo = g;
  }
  function placeStatic() {
    const g = geometry(), s = sl();
    const first = g.cross[info.lanes[0].id], last = g.cross[info.lanes[info.lanes.length - 1].id];
    for (const o of gAxis.children) {
      const t = Number((o as SVGGElement).dataset.t), a = along(g, t);
      const at = g.across ? { x: a, y: last + RAIL.w / 2 + 6 + 10 * s } : { x: first - RAIL.w / 2 - 7 * s, y: a - RAIL.h };
      o.setAttribute("transform", `translate(${r2(at.x)} ${r2(at.y)}) scale(${r2(s)})`);
    }
    drawNow();
  }
  function drawNow() {
    const g = geometry(), s = sl(), { a, b } = nowLine(g, nowT, s), across = g.across;
    // the line passes behind a label with a little air on either side, never through a span's bare words nor up to a
    // pill's edge
    const along0 = across ? a.y : a.x, along1 = across ? b.y : b.x, at = across ? a.x : a.y;
    const gaps: [number, number][] = [];
    for (const d of drawn.values()) {
      if (d.labOp < 0.05 || !d.rest) continue;
      const box = labelBox(d, s);
      if (across ? box.x0 < at && at < box.x1 : box.y0 < at && at < box.y1) gaps.push(across ? [box.y0, box.y1] : [box.x0, box.x1]);
    }
    gaps.sort((p, q) => p[0] - q[0]);
    let d = "", from = along0;
    const seg = (u: number, v: number) => { if (v - u > 0.5) d += across ? `M${r2(at)} ${r2(u)}V${r2(v)}` : `M${r2(u)} ${r2(at)}H${r2(v)}`; };
    for (const [u, v] of gaps) { seg(from, Math.min(u, along1)); from = Math.max(from, v); }
    seg(from, along1);
    nowPath.setAttribute("d", d);
    nowCaret.setAttribute("d", across
      ? `M${r2(a.x - 3.6 * s)} ${r2(a.y - 1 * s)}L${r2(a.x)} ${r2(a.y + 4.4 * s)}L${r2(a.x + 3.6 * s)} ${r2(a.y - 1 * s)}Z`
      : `M${r2(a.x - 1 * s)} ${r2(a.y - 3.6 * s)}L${r2(a.x + 4.4 * s)} ${r2(a.y)}L${r2(a.x - 1 * s)} ${r2(a.y + 3.6 * s)}Z`);
  }
  /** The box an item's resting label takes at label scale s, with a little room around it. */
  function labelBox(d: Drawn, s: number): Box {
    const r = d.rest!, it = d.item, pad = 3 * s;
    if (it.kind === "span") {
      const w = spanLabelWidth(it.label) * s, x0 = r.anchor === "end" ? r.at.x - w : r.anchor === "middle" ? r.at.x - w / 2 : r.at.x;
      return { x0: x0 - pad, y0: r.at.y - 7 * s - pad, x1: x0 + w + pad, y1: r.at.y + 7 * s + pad };
    }
    const msg = it.kind === "message", e = msg ? ends(it) : null, at = e ? lerp(e.a, e.b, r.f ?? 0.5) : r.at;
    const hw = (pillWidth(msg ? it.label : it.text, msg ? it.flow !== "request" : !!it.tone) / 2) * s + pad;
    return { x0: at.x - hw, y0: at.y - 11 * s - pad, x1: at.x + hw, y1: at.y + 11 * s + pad };
  }
  /** Move now; open spans follow it. */
  function setNow(t: number) {
    nowT = t;
    drawNow();
    for (const d of drawn.values()) if (d.item.kind === "span" && d.end === null) drawItem(d);
  }

  // ---------- the items ----------
  const drawn = new Map<string, Drawn>();
  const ends = (it: Msg) => messageEnds(geometry(), it);
  /** Where every item's label rests. A telling's labels are placed once, for everything it will draw (restTelling), so
   * none rests where a later message will cross it and none moves as the story goes on. */
  const told = tellings(scene, keyOf);
  let solved: TimelineItem[] = [], solvedFor: Layout | null = null;
  const solutions = new Map<Telling, Map<string, Resting>>();
  function solve(items: TimelineItem[]) {
    solved = items;
    const g = geometry(), keys = items.map(keyOf);
    if (solvedFor !== g) { solutions.clear(); solvedFor = g; }
    const story = told.find((t) => t.keys.length >= keys.length && keys.every((k, i) => t.keys[i] === k));
    let rests = story && solutions.get(story);
    if (!rests) {
      rests = restTelling(g, story?.items ?? items, keyOf, story?.nows);
      if (story) solutions.set(story, rests);
    }
    for (const it of items) { const d = drawn.get(keyOf(it)); if (d) d.rest = rests.get(d.key); }
    return rests;
  }

  function create(it: TimelineItem): Drawn {
    const key = keyOf(it), parts: Record<string, SVGElement> = {};
    const dims: SVGGElement[] = [];
    const outer = (layer: SVGGElement) => { const w = el("g", { class: styles.dimmable }, layer); dims.push(w); return w; };
    let g: SVGGElement, lab: SVGGElement | null = null;
    if (it.kind === "message") {
      g = el("g", { class: styles.msg, "data-k": it.flow }, outer(gLines));
      parts.line = el("path", { class: styles.line }, g);
      parts.start = el("circle", { class: styles.start, r: 2.4 }, g);
      if (it.lost) { const x = el("g", {}, g); el("path", { class: styles.lost, d: "M-4.5 -4.5L4.5 4.5M4.5 -4.5L-4.5 4.5" }, x); parts.cross = x; }
      else parts.tip = el("path", { class: styles.tip, d: "M0 0L-8 -3.6L-6.6 0L-8 3.6Z" }, g);
      lab = el("g", { class: styles.pill, "data-k": it.flow }, outer(gItems));
      const dot = it.flow !== "request", w = pillWidth(it.label, dot);
      const face = (into: SVGGElement) => {
        el("rect", { x: -w / 2, y: -11, width: w, height: 22, rx: 11 }, into);
        if (dot) el("circle", { cx: -w / 2 + 10, cy: 0, r: 2.8 }, into);
        el("text", { x: dot ? 5 : 0, y: 3.8, "text-anchor": "middle" }, into).textContent = it.label;
      };
      face(lab);
      if (!dot) {
        // the ink a request carries while it travels, over the outline it leaves, shown through a sliding window
        const id = `${uid}-${++clips}`, clip = el("clipPath", { id }, lab);
        parts.wipe = el("rect", { x: -w / 2 - 2, y: -13, width: w + 4, height: 26 }, clip);
        parts.ink = el("g", { class: styles.ink, "clip-path": `url(#${id})` }, lab);
        face(parts.ink as SVGGElement);
      }
    } else if (it.kind === "mark") {
      g = el("g", { class: styles.mark, "data-tone": it.tone }, outer(gMarks));
      parts.stem = el("path", { class: styles.stem }, g);
      parts.dot = el("circle", { class: styles.dot, r: 3.8 }, g);
      lab = el("g", { class: styles.flag, "data-tone": it.tone }, outer(gItems));
      const dot = !!it.tone, w = pillWidth(it.text, dot);
      el("rect", { x: -w / 2, y: -11, width: w, height: 22, rx: 11 }, lab);
      if (dot) el("circle", { cx: -w / 2 + 10, cy: 0, r: 2.8 }, lab);
      el("text", { x: dot ? 5 : 0, y: 3.8, "text-anchor": "middle" }, lab).textContent = it.text;
    } else {
      g = el("g", { class: styles.span, "data-tone": it.tone }, outer(gSpans));
      parts.side = el("path", { class: styles.sleeveSide }, g);
      parts.top = el("path", { class: styles.sleeveTop }, g);
      if (it.label) {
        lab = el("g", {}, outer(gItems));
        el("text", { class: styles.spanLabel, "data-tone": it.tone, y: 3.8 }, lab).textContent = it.label;
      }
    }
    g.style.opacity = "0";
    if (lab) lab.style.opacity = "0";
    const d: Drawn = { key, item: it, g, lab, dims, op: 0, prog: 0, busy: false, leaving: false, riding: false, pillF: 0.5, pillSc: 1, pillOp: 1, ink: 0, labOp: 0, end: it.kind === "span" ? it.t1 : null, parts };
    drawn.set(key, d);
    applyFocus(d);
    return d;
  }
  function remove(d: Drawn) {
    for (const w of d.dims) w.remove();
    drawn.delete(d.key);
  }
  const place = (e: SVGElement, p: Point, s: number, extra = "") => e.setAttribute("transform", `translate(${r2(p.x)} ${r2(p.y)})${extra} scale(${r2(s)})`);

  /** Draw an item as its state says: visible, drawn so far, its label resting or riding. */
  function drawItem(d: Drawn) {
    const g = geometry(), s = sl(), it = d.item;
    d.g.style.opacity = String(r2(d.op));
    if (it.kind === "message") {
      const { a, b } = ends(it), tip = lerp(a, b, d.prog);
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      const len = Math.hypot(b.x - a.x, b.y - a.y) * d.prog;
      // the arrowhead grows out of the line once it has left the sender's rail, so it never shows behind the sender nor
      // over what is arriving there; the line stops under it so its round cap never shows past the point
      const head = it.lost ? 0 : clamp01((len - RAIL.w / 2 - 2) / (8 * s)), back = 6 * s * head;
      const end = lerp(a, b, d.prog * (len ? 1 - back / len : 1));
      d.parts.line.setAttribute("d", d.prog > 0.001 ? `M${r2(a.x)} ${r2(a.y)}L${r2(end.x)} ${r2(end.y)}` : "");
      place(d.parts.start, a, s);
      if (d.parts.tip) { place(d.parts.tip, tip, s * head, ` rotate(${r2(angle)})`); d.parts.tip.style.opacity = head > 0.05 ? "1" : "0"; }
      if (d.parts.cross) { place(d.parts.cross, b, s); d.parts.cross.style.opacity = d.prog >= 0.999 ? "1" : "0"; }
      if (d.lab) {
        const f = d.riding ? d.pillF : d.rest?.f ?? 0.5, at = lerp(a, b, f);
        place(d.lab, at, s * d.pillSc);
        d.labOp = d.riding ? 0 : d.op * clamp01(d.pillSc * 1.5) * (d.rest?.hidden ? 0 : 1);
        d.lab.style.opacity = String(r2(d.riding ? d.op * clamp01(d.pillSc * 1.5) * d.pillOp : d.labOp));
        if (d.parts.wipe) {
          // the ink drains toward the receiver: what is left of it is the end nearest where the message goes
          const w = pillWidth(it.label, false) + 4, x0 = -w / 2, left = w * clamp01(d.ink);
          d.parts.wipe.setAttribute("x", String(r2(b.x >= a.x ? x0 + w - left : x0)));
          d.parts.wipe.setAttribute("width", String(r2(left)));
          d.parts.ink.style.display = left > 0.01 ? "" : "none";
        }
      }
    } else if (it.kind === "mark") {
      const p = lanePoint(g, it.node, it.t), pop = ctx.ease.back(clamp01(d.prog * 1.6));
      place(d.parts.dot, p, s * Math.max(0, pop));
      const rest = d.rest, grow = clamp01((d.prog - 0.25) / 0.45);
      // the stem leaves the dot's edge straight toward the flag (a flag right by its dot has none)
      const dx = rest?.stem ? rest.stem.x - p.x : 0, dy = rest?.stem ? rest.stem.y - p.y : 0, l = Math.hypot(dx, dy), r = 4 * s;
      const from = { x: p.x + (dx / (l || 1)) * r, y: p.y + (dy / (l || 1)) * r }, to = rest?.stem ? lerp(from, rest.stem, grow) : from;
      d.parts.stem.setAttribute("d", l > r ? `M${r2(from.x)} ${r2(from.y)}L${r2(to.x)} ${r2(to.y)}` : "");
      // a stem running down its own rail would read as the rail's edge: it takes the mark's colour instead
      d.parts.stem.classList.toggle(styles.along, !g.across && Math.abs(dx) < 0.5);
      if (d.lab && rest) {
        const show = clamp01((d.prog - 0.4) / 0.6), dir = rest.at.y < p.y ? 1 : -1;
        place(d.lab, !g.across ? rest.at : { x: rest.at.x, y: rest.at.y + dir * 5 * s * (1 - ctx.ease.out(show)) }, s);
        d.labOp = d.op * show;
        d.lab.style.opacity = String(r2(d.labOp));
      }
    } else {
      const t1 = d.end ?? Math.max(it.t0, nowT);
      let a0 = along(g, it.t0), a1 = along(g, t1);
      // the sleeve's rounded ends sit inside its stretch of time; a span just begun is a bead
      const depth = (g.across ? 0.866 : 0.2887) * SLEEVE.w, grow = ctx.ease.out(clamp01(d.prog));
      if (a1 - a0 > 2 * depth) { a0 += depth; a1 -= depth; } else { const m = (a0 + a1) / 2; a0 = a1 = m; }
      const c = g.cross[it.node];
      const p = barPaths(g.across, a0, a1, c, SLEEVE.w * (0.6 + 0.4 * grow), SLEEVE.h * grow + 0.01, [true, true]);
      d.parts.side.setAttribute("d", p.side);
      d.parts.top.setAttribute("d", p.top);
      if (d.lab && d.rest) {
        place(d.lab, d.rest.at, s);
        (d.lab.firstChild as SVGTextElement).setAttribute("text-anchor", d.rest.anchor ?? "start");
        d.labOp = d.op * clamp01(d.prog * 1.4 - 0.2);
        d.lab.style.opacity = String(r2(d.labOp));
      }
    }
  }

  /** The layout keeps labels off the parts' name tags by their size as the engine draws them, written down in
   * timeline-geometry.ts (the tags can't be asked for before the parts stand somewhere). Once the parts stand at their
   * heads, check that against the engine's own tags, so a change there is heard of rather than quietly overlapped. */
  let checked: Layout | null = null;
  function checkTags(g: Layout) {
    if (checked === g) return;
    const se = ctx.labelScale(), off = (p: Box, q: Box) => Math.max(Math.abs(p.x0 - q.x0), Math.abs(p.x1 - q.x1), Math.abs(p.y0 - q.y0), Math.abs(p.y1 - q.y1));
    for (const l of info.lanes) {
      const at = ctx.at(l.id), head = g.heads[l.id], tag = ctx.tag(l.id);
      if (!at || !tag || Math.abs(at.x - head.x) + Math.abs(at.y - head.y) > 0.5) return;
      if (off(tag, tagBox(g, l, se)) > 1.5) console.warn(`timeline: the stage draws ${l.id}'s name tag at another size than timeline-geometry.ts expects`);
    }
    checked = g;
  }

  // ---------- focus ----------
  let focusList: string[] | undefined;
  function applyFocus(d: Drawn) {
    const it = d.item, f = focusList;
    const dim = !!f && (it.kind === "message" ? !(f.includes(it.from) && f.includes(it.to)) : !f.includes(it.node));
    for (const w of d.dims) w.classList.toggle(styles.dim, dim);
  }

  // ---------- small flourishes ----------
  function pulse(p: Point, kind: string, big = false) {
    if (ctx.reduce) return;
    const s = sl(), e = el("ellipse", { class: styles.pulse, "data-k": kind, cx: r2(p.x), cy: r2(p.y) }, gFx);
    const r0 = (big ? 6 : 4) * s, r1 = (big ? 22 : 15) * s;
    void ctx.realtime(560, (q) => {
      const r = r0 + (r1 - r0) * ctx.ease.out(q);
      e.setAttribute("rx", String(r2(r))); e.setAttribute("ry", String(r2(r / 2)));
      e.style.opacity = String(r2(0.75 * (1 - q)));
    }).then(() => e.remove());
  }

  // ---------- which model is drawn ----------
  // The engine works out a figure event's `after` from the model as it stood when the event began, so events that start
  // together (`with`) don't see each other. While a step plays, the timeline is drawn from the step's own events applied
  // in order instead, the same way stateBefore() does.
  let stepAt = -1, stepEvts: StageEvent[] = [], stepStart: StageModel | null = null, played = -1;
  function through(i: number): StageModel {
    const m = cloneModel(stepStart!);
    for (let j = 0; j <= i; j++) applyEvent(m, stepEvts[j]);
    return m;
  }
  function canonical(e: StageEvent): StageModel | null {
    const i = ctx.step();
    if (i < 0) return null;
    if (i !== stepAt || !stepStart) { stepAt = i; stepEvts = stepEvents(scene, i); stepStart = stateBefore(scene, i); played = -1; }
    const at = stepEvts.indexOf(e);
    if (at < 0) return null;
    played = Math.max(played, at);
    return through(at);
  }
  const modelFor = (m: StageModel) => (played >= 0 && ctx.step() === stepAt && stepStart ? through(played) : m);

  // ---------- render: bring the drawing to a model ----------
  async function render(m: StageModel, tk: Token, instant: boolean) {
    measure();
    const g = geometry();
    if (drawnGeo !== g) drawStatic(g);
    const target = modelFor(m), tl = target.timeline ?? { clock: 0, last: 0, items: [] };
    const now = instant || ctx.reduce;
    const tasks: Promise<void>[] = [];
    for (const l of info.lanes) {
      const r = rails[l.id], show = !!target.nodes[l.id]?.visible;
      if (r.shown === show) continue;
      r.shown = show;
      if (now) r.g.style.opacity = show ? "" : "0";
      else tasks.push(ctx.tween(380, tk, (p) => { r.g.style.opacity = String(r2(show ? p : 1 - p)); }));
    }
    const want = new Map(tl.items.map((it) => [keyOf(it), it]));
    // what goes leaves first, then what comes draws in, as the stage's own changes do
    const leaving: Promise<void>[] = [];
    for (const d of [...drawn.values()]) {
      if (want.has(d.key) || d.busy) continue;
      if (now) { remove(d); continue; }
      d.leaving = true;
      const from = d.op;
      leaving.push(ctx.tween(240, tk, (p) => { d.op = from * (1 - ctx.ease.out(p)); drawItem(d); }).then(() => { if (d.leaving) remove(d); }));
    }
    const fresh = new Set<Drawn>();
    for (const it of tl.items) if (!drawn.has(keyOf(it))) fresh.add(create(it));
    solve(tl.items);
    for (const it of tl.items) {
      const d = drawn.get(keyOf(it))!;
      d.item = it;
      d.leaving = false;
      applyFocus(d);
      if (d.busy) continue;
      const end = it.kind === "span" ? it.t1 : null;
      if (now) { d.op = 1; d.prog = 1; d.pillSc = 1; d.ink = 0; d.end = end; drawItem(d); continue; }
      drawItem(d);
      tasks.push(fresh.has(d) && leaving.length ? Promise.all(leaving).then(() => settleIn(d, end, tk)) : settleIn(d, end, tk));
    }
    if (now) setNow(tl.clock);
    else if (Math.abs(nowT - tl.clock) > 1e-6) {
      const from = nowT;
      tasks.push(ctx.tween(leaving.length ? 620 : 460, tk, (p) => setNow(from + (tl.clock - from) * ctx.ease.inOut(p))));
    }
    placeStatic();
    await Promise.all([...tasks, ...leaving]);
  }
  /** Bring an item that should be drawn all the way in: a message draws itself, a mark pops, a span reaches its end. */
  function settleIn(d: Drawn, end: number | null, tk: Token): Promise<void> {
    const it = d.item;
    const done = d.op >= 1 && d.prog >= 1 && d.pillSc >= 1 && d.ink <= 0 && (it.kind !== "span" || d.end === end);
    if (done) { drawItem(d); return Promise.resolve(); }
    const op0 = d.op, prog0 = d.prog, sc0 = d.pillSc, ink0 = d.ink;
    const e0 = it.kind === "span" ? d.end ?? Math.max(it.t0, nowT) : 0;
    return ctx.tween(it.kind === "message" ? 480 : 380, tk, (p) => {
      const q = ctx.ease.out(p);
      d.op = op0 + (1 - op0) * q;
      d.prog = prog0 + (1 - prog0) * q;
      d.pillSc = sc0 + (1 - sc0) * q;
      d.ink = ink0 * (1 - q);
      if (it.kind === "span") d.end = end === null ? (p >= 1 ? null : e0 + (Math.max(it.t0, nowT) - e0) * q) : e0 + (end - e0) * q;
      drawItem(d);
    });
  }

  // ---------- playing events ----------
  /** Something that happens later than now waits for time to reach it: now moves on first, and open spans grow. */
  async function catchUp(t: number, tk: Token) {
    if (t <= nowT + 1e-6) return;
    const from = nowT, ms = Math.min(700, 160 + 300 * ((t - from) / info.beat));
    await ctx.tween(ms, tk, (p) => setNow(from + (t - from) * ctx.ease.inOut(p)));
  }
  async function playMessage(d: Drawn, tk: Token) {
    const it = d.item as Msg, { a, b, full } = ends(it);
    // a repeated pill that will not stay rides all the way, as a packet does, and fades as it arrives
    const hidden = !!d.rest?.hidden, restF = hidden ? 1 : d.rest?.f ?? 0.5;
    const len = Math.hypot(b.x - a.x, b.y - a.y), ms = Math.max(520, len / ctx.speed);
    await catchUp(it.t0, tk);
    const now0 = nowT, s = sl();
    // the pill grows as it leaves its sender, once clear of the rail and the arrowheads landing there, so two messages
    // leaving one point together never cover each other or what just arrived
    const stop = len * (hidden ? 0.5 : restF), lead = Math.min(RAIL.w / 2 + 12 * s, stop * 0.4);
    const grow = Math.max(1, Math.min(1.2 * (pillWidth(it.label, it.flow !== "request") / 2) * s, stop - lead));
    // a request's ink drains in the last part of its journey, the wipe ending as it lands
    const drain = it.flow === "request" ? Math.min(0.32, 300 / ms) : 0;
    Object.assign(d, { op: 1, prog: 0, pillF: 0, pillSc: 0, pillOp: 1, ink: drain ? 1 : 0, riding: true });
    await ctx.tween(ms, tk, (p) => {
      const q = ctx.ease.inOut(p);
      d.prog = q;
      d.pillF = Math.min(q, restF);
      // (in step with the distance, never ahead of it: an overshooting ease would let the two meet at the start)
      d.pillSc = clamp01((q * len - lead) / grow);
      if (hidden) d.pillOp = clamp01((1 - q) / 0.3);
      if (drain) d.ink = 1 - ctx.ease.inOut(clamp01((p - (1 - drain)) / drain));
      drawItem(d);
      setNow(Math.max(now0, nowT, it.t0 + (it.t1 - it.t0) * q));
    });
    d.ink = 0;
    d.riding = false;
    drawItem(d);
    if (it.lost) {
      const s = sl(), burst = el("circle", { class: styles.pulse, "data-k": "hot", cx: r2(b.x), cy: r2(b.y) }, gFx);
      void ctx.realtime(650, (q) => { burst.setAttribute("r", String(r2((4 + 14 * ctx.ease.out(q)) * s))); burst.style.opacity = String(r2(0.8 * (1 - q))); }).then(() => burst.remove());
    } else {
      pulse(full, pulseKind(it.flow), true);
      ctx.bob(it.to);
    }
  }
  async function playMark(d: Drawn, clock: number, tk: Token) {
    const it = d.item as Mark;
    await catchUp(it.t, tk);
    const now0 = nowT;
    Object.assign(d, { op: 1, prog: 0 });
    let rung = false;
    await ctx.tween(520, tk, (p) => {
      d.prog = p;
      drawItem(d);
      if (!rung && p > 0.2) { rung = true; pulse(lanePoint(geometry(), it.node, it.t), it.tone === "hot" ? "hot" : it.tone === "work" ? "work" : "plain"); }
      setNow(Math.max(now0, now0 + (clock - now0) * ctx.ease.inOut(p)));
    });
  }
  async function playSpan(d: Drawn, clock: number, tk: Token) {
    await catchUp((d.item as Span).t0, tk);
    const now0 = nowT;
    Object.assign(d, { op: 1, prog: 0, end: null });
    await ctx.tween(420, tk, (p) => {
      d.prog = p;
      if (clock > now0) setNow(now0 + (clock - now0) * ctx.ease.inOut(p));
      drawItem(d);
    });
  }
  async function closeSpan(d: Drawn, t1: number, clock: number, tk: Token) {
    const now0 = nowT, e0 = d.end ?? Math.max((d.item as Span).t0, nowT);
    await ctx.tween(Math.abs(t1 - e0) > 1e-6 || clock > now0 ? 420 : 1, tk, (p) => {
      const q = ctx.ease.inOut(p);
      if (clock > now0) setNow(now0 + (clock - now0) * q);
      d.end = e0 + (t1 - e0) * q;
      drawItem(d);
    });
    d.end = t1;
  }
  /** Time runs back: the now line sweeps to 0 and everything it passes on the way goes, lines withdrawing into their
   * senders, marks and spans folding away. */
  async function playRewind(tk: Token) {
    const list = [...drawn.values()].filter((d) => !d.leaving), from = Math.max(nowT, 0.001);
    const fade = Math.max(0.15, info.span * 0.04);
    for (const d of list) { d.busy = true; d.leaving = true; }
    const base = new Map(list.map((d) => [d, { op: d.op, prog: d.prog, end: d.end }]));
    await ctx.tween(Math.min(1500, 700 + from * 90), tk, (p) => {
      const t = from * (1 - ctx.ease.inOut(p));
      setNow(t);
      for (const d of list) {
        const it = d.item, b0 = base.get(d)!, t0 = startOf(it);
        if (it.kind === "message") {
          d.prog = Math.min(b0.prog, it.t1 > it.t0 ? clamp01((t - it.t0) / ((it.t1 - it.t0) * (it.lost ? LOST : 1))) : t > it.t0 ? 1 : 0);
          d.op = b0.op * clamp01((t - t0) / fade + 0.25);
          d.pillSc = clamp01((t - t0) / fade + 0.3);
        } else if (it.kind === "mark") {
          d.op = b0.op * clamp01((t - t0) / fade);
          d.prog = Math.min(b0.prog, 0.62 + 0.38 * clamp01((t - t0) / fade));
        } else {
          d.end = Math.min(b0.end ?? t, t);
          d.op = b0.op * clamp01((t - t0) / fade);
        }
        drawItem(d);
      }
    });
    for (const d of list) remove(d);
  }

  const figure: Figure = {
    handles: (e) => e.type === "packet" || e.type === "mark" || e.type === "span" || e.type === "rewind",
    place: (id) => { const p = geometry().heads[id]; return p ? { x: p.x, y: p.y } : undefined; },
    bounds(_m, k) {
      measure();
      return layoutBox(geometry(), labelScale(k, ctx.labelScale(k)), ctx.labelScale(k));
    },
    render,
    async play(e, _before, after, tk) {
      const m = canonical(e) ?? after;
      const tl = m.timeline;
      if (!tl) return;
      if (e.type === "rewind") return playRewind(tk);
      const g = geometry();
      if (drawnGeo !== g) drawStatic(g);
      if (e.type === "span" && e.end) {
        const it = [...tl.items].reverse().find((i): i is Span => i.kind === "span" && i.id === e.id);
        const d = it && drawn.get(keyOf(it));
        if (!it || !d || it.t1 === null) return;
        d.item = it;
        d.busy = true;
        try { await closeSpan(d, it.t1, tl.clock, tk); } finally { d.busy = false; }
        return;
      }
      const it = tl.items[tl.items.length - 1];
      if (!it) return;
      const d = drawn.get(keyOf(it)) ?? create(it);
      d.item = it;
      d.busy = true;
      solve(tl.items);
      try {
        if (it.kind === "message") await playMessage(d, tk);
        else if (it.kind === "mark") await playMark(d, tl.clock, tk);
        else await playSpan(d, tl.clock, tk);
      } finally { d.busy = false; }
    },
    settle() { /* what a played event leaves is lasting, and render draws it */ },
    clear() {
      gFx.innerHTML = "";
      stepAt = -1; stepStart = null; played = -1;
      for (const d of drawn.values()) { d.busy = false; d.riding = false; }
    },
    focus(list) {
      focusList = list;
      for (const d of drawn.values()) applyFocus(d);
      for (const l of info.lanes) rails[l.id].g.classList.toggle(styles.dim, !!list && !list.includes(l.id));
    },
    layout() {
      const g = geometry();
      if (drawnGeo !== g) {
        drawStatic(g);
        solve(solved);
      }
      placeStatic();
      for (const d of drawn.values()) drawItem(d);
      checkTags(g);
    },
    resize() { measure(); geoKey = ""; },
    destroy() { root.remove(); gLab.remove(); },
  };
  return figure;
};

