// The hash ring: a low platter lying on the floor with a groove near its rim. Tokens stand in the groove as pins with
// flags, keys rest in it as beads, and the stretch each token owns is shaded in a neutral step. Keys walk clockwise to
// their owner, tokens join and leave and the slice that changes owner sweeps across in blue, a walk numbers the tokens
// it chooses, and an arc marks a stretch. Geometry lives in ring-geometry.ts; this module draws and plays it.
import type { FigureFactory, Point, Token } from "./figure";
import { applyEvent, cloneModel, initialModel, stateBefore, stepEvents, type RingState, type StageModel } from "./model";
import { ringOwner } from "./figure-model";
import * as G from "./ring-geometry";
import type { MarkTone, RingKey, RingToken, StageEvent, StageNode } from "./types";
import styles from "./ring.module.css";

const TYPES = new Set(["token", "key", "scatter", "walk", "arc"]);
// what a part takes on screen around where it stands (see the engine): its base, and its tag under it
const HALF_BASE = 50, BASE_FRONT = 28 + 7;
// flat labels, in label pixels
const FLAG_H = 16, KEY_H = 13, MARK_H = 12, OWNER_H = 12, PILL_H = 22, BADGE_R = 8;
const flagW = (t: string) => Math.max(18, Math.round(t.length * 7.4 + 11));
const monoW = (t: string) => Math.round(t.length * 6.35 + 4);
const ownerW = (t: string) => Math.round(t.length * 7 + 4);
const pillW = (t: string, dot: boolean) => Math.round((dot ? 26 : 16) + t.length * 6.3);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const f2 = (n: number) => Math.round(n * 100) / 100;

type Geo = G.Disc & {
  /** The platter's side, the groove's inner and outer edges and the track along its middle (fractions of the rim). */
  h: number; g0: number; g1: number; track: number;
  /** A pin's height and a bead's and a dot's radius, in world units. */
  pin: number; bead: number; dot: number;
  /** The label scale parts are spaced for, and how many fine ticks run round the rim. */
  sRef: number; ticks: number;
};
const G0 = 0.8, TRACK = 0.86, PIN = 0.145;
// A phone shows the ring larger against its parts (they stand above and below it there), so its groove, flags and
// keys keep room to read. `rx` may grow so a part at the centre fits.
const geometry = (narrow: boolean, rx = narrow ? 222 : 158): Geo => ({
  rx, ry: rx * G.ISO, h: 8, g0: G0, g1: 0.92, track: TRACK,
  pin: rx * PIN, bead: rx * 0.025, dot: rx * 0.0125, sRef: narrow ? 1.6 : 1.06, ticks: narrow ? 25 : 50,
});
type PartLike = { label: string; detail: string; readout: string; meter: number | null; down: boolean };

/** Something lasting the ring draws: it comes and goes through its presence p (0 gone, 1 there). */
type Item = {
  key: string; p: number; from: number; to: number; delay: number; dur: number;
  rise: (t: number) => number;
  draw(): void;
  kill(): void;
};
/** A flat label the ring places clear of everything else: its size in label pixels and where it may go, and boxes only
 * it keeps away from (an owner's name stays off its own flag, which already says it). `el` gives its group (placed by
 * its item's draw) and an inner group to fade, while it shows, so a label that moves as something plays fades across. */
type Label = {
  w: number; h: number; cands(s: number): Point[]; optional?: boolean; at: Point | null; air?: number; avoid?(s: number): G.Box[];
  el?(): { outer: SVGGElement; inner: SVGElement } | null;
  /** Printed marks it may sit over, standing in for them (they hide while it does). */
  frees?(): number[];
};

export const ringFigure: FigureFactory = (ctx) => {
  const { scene } = ctx;
  const size = scene.ring?.size ?? 100;
  const nodeOf: Record<string, StageNode> = Object.fromEntries(scene.nodes.map((n) => [n.id, n]));
  // "Node A" is A: a short last word names the part, otherwise its first letter does
  const tokenLabel = (t: RingToken) => {
    if (t.label) return t.label;
    const words = (nodeOf[t.node]?.label ?? t.node).trim().split(/\s+/), last = words[words.length - 1];
    return words.length > 1 && last.length <= 3 ? last : words[0].charAt(0).toUpperCase();
  };
  const keyLabel = (k: RingKey) => k.label ?? k.id;
  /** Flat labels keep their size on screen as the camera zooms; the ring's never shrink below it (the engine lets its
   * own shrink a little on a small phone), so positions and keys stay readable. */
  const scaleAt = (k: number) => Math.max(ctx.labelScale(k), Math.min(1 / k, 1 / 0.45));
  const S = () => scaleAt(ctx.zoom());

  let narrow = ctx.narrow();
  let geo = geometry(narrow);
  const P = (pos: number, r: number) => G.onRing(geo, size, pos, r);
  const out = (pos: number) => G.outward(geo, size, pos);
  const inward = (pos: number) => { const u = out(pos); return { x: -u.x, y: -u.y }; };
  /** The rim's outer edge at a position, including the platter's side where it shows (the front half). */
  const rimOut = (pos: number) => { const p = P(pos, 1); return { x: p.x, y: p.y + geo.h * clamp((p.y / geo.ry) * 2.5) }; };
  const marks = () => {
    const all = [...(scene.ring?.marks ?? [])].sort((a, b) => a - b);
    return narrow && all.length > 4 ? all.filter((_, i) => i % 2 === 0) : all;
  };

  // ---------- what holds for the whole scene: each part's tone (neighbouring arcs always differ), and how crowded the
  // ring ever gets (the most tokens and named keys on it at once) ----------
  const { tones, crowd, everShown } = (() => {
    const pairs: [string, string][] = [], seen = new Set<string>(), everShown = new Set<string>();
    const shownIn = (m: StageModel) => { for (const id in m.nodes) if (m.nodes[id].visible) everShown.add(id); };
    const note = (r?: RingState) => r?.tokens.forEach((t, i) => {
      seen.add(t.node);
      const next = r.tokens[(i + 1) % r.tokens.length];
      if (next.node !== t.node) pairs.push([t.node, next.node]);
    });
    const m = initialModel(scene);
    let most = 0;
    note(m.ring);
    shownIn(m);
    scene.steps.forEach((_, i) => {
      for (const e of stepEvents(scene, i)) {
        applyEvent(m, e);
        if (e.type === "token") note(m.ring);
        most = Math.max(most, (m.ring?.tokens.length ?? 0) + (m.ring?.keys.length ?? 0));
        shownIn(m);
      }
    });
    return { tones: G.toneOf(scene.nodes.map((n) => n.id).filter((id) => seen.has(id)), pairs), crowd: most, everShown };
  })();
  // every token that ever stands on the ring, so parts stand clear of all their flags from the start
  const sceneTokens: RingToken[] = [
    ...(scene.ring?.tokens ?? []),
    ...scene.steps.flatMap((st) => [...st.events, ...(st.control?.options.flatMap((o) => o.events) ?? [])]).flatMap((e) => (e.type === "token" ? e.add ?? [] : [])),
  ];

  // ---------- the drawing's layers, back to front ----------
  const hub = !scene.nodes.some((n) => n.at[1] < 0.45);
  /** The spindle's box, which labels keep clear of. */
  const HUB: G.Box = { x0: -14, y0: -11, x1: 14, y1: 11 };
  const root = ctx.el("g", { class: styles.ring }, ctx.layers.floor);
  const floatG = ctx.el("g", { class: styles.ring }, ctx.layers.top);
  let L: Record<"base" | "tones" | "arcs" | "under" | "edges" | "feet" | "trails" | "dots" | "beads" | "print" | "pins" | "labels" | "over", SVGGElement>;
  function build() {
    root.innerHTML = "";
    const layer = () => ctx.el("g", {}, root);
    L = { base: layer(), tones: layer(), arcs: layer(), under: layer(), edges: layer(), feet: layer(), trails: layer(), dots: layer(), beads: layer(), print: layer(), pins: layer(), labels: layer(), over: layer() };
    const { rx, ry, h } = geo, el = ctx.el;
    el("ellipse", { class: styles.shadow, cx: 0, cy: f2(h + ry * 0.1), rx: f2(rx * 1.08), ry: f2(ry * 1.16), fill: "url(#sk-soft-shadow)" }, L.base);
    el("path", { class: styles.side, d: `M${f2(-rx)} 0L${f2(-rx)} ${h}A${f2(rx)} ${f2(ry)} 0 0 0 ${f2(rx)} ${h}L${f2(rx)} 0A${f2(rx)} ${f2(ry)} 0 0 1 ${f2(-rx)} 0Z` }, L.base);
    el("ellipse", { class: styles.top, cx: 0, cy: 0, rx: f2(rx), ry: f2(ry) }, L.base);
    el("ellipse", { class: styles.bevel, cx: 0, cy: 0, rx: f2(rx * 0.975), ry: f2(ry * 0.975) }, L.base);
    el("ellipse", { class: styles.engrave, cx: 0, cy: 0, rx: f2(rx * 0.56), ry: f2(ry * 0.56) }, L.base);
    el("path", { class: styles.groove, d: G.ellipsePath(geo, geo.g1) + G.ellipsePath(geo, geo.g0, true) }, L.base);
    // fine ticks round the rim, longer and darker at the marks
    const every = Math.max(1, Math.round(size / geo.ticks)), majors = new Set(scene.ring?.marks ?? []);
    let minor = "", major = "";
    for (let p = 0; p < size; p += every) if (!majors.has(p)) { const a = P(p, 0.942), b = P(p, 0.972); minor += `M${f2(a.x)} ${f2(a.y)}L${f2(b.x)} ${f2(b.y)}`; }
    for (const p of majors) { const a = P(p, 0.935), b = P(p, 0.99); major += `M${f2(a.x)} ${f2(a.y)}L${f2(b.x)} ${f2(b.y)}`; }
    if (minor) el("path", { class: styles.tick, d: minor }, L.base);
    if (major) el("path", { class: `${styles.tick} ${styles.major}`, d: major }, L.base);
    // a spindle at the centre, unless a part stands there
    if (hub) {
      el("ellipse", { class: styles.hubSide, cx: 0, cy: 1.5, rx: 11, ry: f2(11 * G.ISO) }, L.base);
      el("ellipse", { class: styles.hubTop, cx: 0, cy: -1.5, rx: 11, ry: f2(11 * G.ISO) }, L.base);
      el("ellipse", { class: styles.hubDot, cx: 0, cy: -1.5, rx: 2.4, ry: f2(2.4 * G.ISO) }, L.base);
    }
    el("path", { class: styles.edge, d: G.ellipsePath(geo, geo.g1) }, L.edges);
    el("path", { class: `${styles.edge} ${styles.edgeIn}`, d: G.ellipsePath(geo, geo.g0) }, L.edges);
    markEls = marks().map((m) => {
      const g = el("g", { class: styles.fade }, L.labels), t = el("text", { class: `${styles.mono} ${styles.markText}`, "text-anchor": "middle", y: 3.8 }, g);
      t.textContent = String(m);
      return { m, g, w: monoW(String(m)) };
    });
  }
  let markEls: { m: number; g: SVGGElement; w: number }[] = [];
  /** Marks a label stands in for, sitting where they are printed. */
  let hiddenMarks = new Set<number>();
  const markCentre = (m: number, w: number, s: number) => G.beyond(rimOut(m), out(m), (w / 2) * s, (MARK_H / 2) * s, 5 * s);

  // ---------- where parts stand ----------
  // the widest note each part carries in the scene: a part keeps room above it for its notes
  const noteW: Record<string, number> = {};
  for (const st of scene.steps) for (const e of [...st.events, ...(st.control?.options.flatMap((o) => o.events) ?? [])]) {
    if (e.type === "note") noteW[e.node] = Math.max(noteW[e.node] ?? 0, pillW(e.text, !!e.tone));
  }
  /** The box a part takes round where it stands: its drawing, its tag under it, its load pill and its notes. */
  function partBox(id: string, n: PartLike, s: number, notes = true): G.Box {
    const top = ctx.top(id), tagH = n.detail && !narrow ? 36 : 22, pill = !!(n.readout || n.meter != null) && !n.down;
    const tw = Math.max(n.label.length * 7.4, narrow ? 0 : n.detail.length * 6.2) + 22, half = Math.max(HALF_BASE, (tw / 2) * s);
    const box = { x0: -half, y0: -top - 8, x1: half, y1: BASE_FRONT - 4 - 6 * s + tagH * s + 2 };
    if (pill) {
      const pw = (16 + (n.meter != null && !narrow ? 31 : 0) + (n.readout || "100%").length * 6.5) * s;
      if (narrow) box.y0 = Math.min(box.y0, -top - 8 - 22 * s); else box.x1 = Math.max(box.x1, 46 + pw);
    }
    if (notes && noteW[id]) {
      // as the engine floats a note: over the part (and its pill on a phone), half a pill tall
      const up = top + 10 + (narrow && pill ? 30 * s : 0) + 14 * s + 11 * s + 2;
      box.y0 = Math.min(box.y0, -up);
      box.x0 = Math.min(box.x0, (-noteW[id] / 2) * s); box.x1 = Math.max(box.x1, (noteW[id] / 2) * s);
    }
    return box;
  }
  const asPart = (n: StageNode): PartLike => ({ label: n.label, detail: n.detail ?? "", readout: "", meter: null, down: false });
  /** The ring's size for this layout: a part standing at the centre needs room between the groove at the back and the
   * flags at the front. */
  function sized(): Geo {
    const base = geometry(narrow), s = base.sRef;
    // a crowded ring is drawn larger on a wide screen, so its flags and keys have room against the parts (a phone's
    // ring already spans the stage)
    let rx = narrow ? base.rx : base.rx * Math.min(1.5, 1 + Math.max(0, crowd - 8) * 0.035);
    for (const n of scene.nodes) if (n.at[1] < 0.01) {
      // its notes float over the ring's back, so only the part and its tag need the room
      const box = partBox(n.id, asPart(n), s, false);
      rx = Math.max(rx, (box.y1 - box.y0 + FLAG_H * s + 18) / (G.ISO * (G0 + TRACK) - PIN));
    }
    return geometry(narrow, Math.round(rx));
  }
  geo = sized();
  let keepOutCache: G.Pt[] | null = null;
  /** Everything a part standing outside keeps clear of: the rim, the marks, and the scene's pins with their flags. */
  function keepOut() {
    if (keepOutCache) return keepOutCache;
    const s = geo.sRef, pts: G.Pt[] = [];
    for (let i = 0; i < 72; i++) pts.push(rimOut((i / 72) * size));
    for (const t of sceneTokens) {
      const b = P(t.at, geo.track), top = b.y - geo.pin - FLAG_H * s, side = b.x >= -1 ? 1 : -1;
      pts.push({ x: b.x, y: top }, { x: b.x + side * flagW(tokenLabel(t)) * s, y: top });
    }
    for (const m of marks()) {
      const w = monoW(String(m)), c = markCentre(m, w, s), hw = (w / 2) * s, hh = (MARK_H / 2) * s;
      pts.push({ x: c.x - hw, y: c.y - hh }, { x: c.x + hw, y: c.y - hh }, { x: c.x + hw, y: c.y + hh }, { x: c.x - hw, y: c.y + hh });
    }
    return (keepOutCache = G.hull(pts));
  }
  /** Where a part at the centre stands: its base and tag between the groove at the back and the flags at the front. */
  function centreSpot(box: G.Box): Point {
    const lo = -geo.g0 * geo.ry + 6 - box.y0, hi = geo.track * geo.ry - geo.pin - FLAG_H * geo.sRef - 6 - box.y1;
    return { x: 0, y: lo <= hi ? (lo + hi) / 2 : lo };
  }
  /** Where a part stands just outside the rim at a position. On a wide screen it stands out along that position's ray;
   * on a phone, which has height to spare and little width, it stands above or below the ring, within its width. */
  function rimSpot(pos: number, box: G.Box, placed: G.Box[]): Point {
    const hull = keepOut();
    if (!narrow) return G.standOffNear(geo, size, pos, hull, box, 12, placed);
    const rim = P(pos, 1), edge = Math.max(geo.rx + 8, ...hull.map((p) => Math.abs(p.x)));
    const x = Math.max(-edge - box.x0, Math.min(edge - box.x1, rim.x));
    return G.slideClear({ x, y: rim.y }, { x: 0, y: rim.y > 1 ? 1 : -1 }, hull, box, 12, placed);
  }
  const layouts = new Map<string, Record<string, Point>>();
  /** Every part's place for a model, worked out together so parts round the ring never stand on each other. */
  function layoutParts(m: StageModel): Record<string, Point> {
    const key = `${narrow}${JSON.stringify(scene.nodes.map((n) => { const st = m.nodes[n.id]; return [st.at, st.label, st.detail, st.readout, st.meter != null, st.down]; }))}`;
    const known = layouts.get(key);
    if (known) return known;
    const s = geo.sRef, placed: G.Box[] = [], spots: Record<string, Point> = {};
    // parts at the centre first, then the rest in the scene's order
    const order = [...scene.nodes].sort((a, b) => Number(m.nodes[a.id].at[1] > 0) - Number(m.nodes[b.id].at[1] > 0));
    for (const n of order) {
      const st = m.nodes[n.id], [pos, dist] = st.at, box = partBox(n.id, st, s), centre = centreSpot(partBox(n.id, st, s, false));
      let at = centre;
      if (dist > 0) {
        const rim = rimSpot(pos, box, placed);
        if (dist <= 1) at = { x: centre.x + (rim.x - centre.x) * dist, y: centre.y + (rim.y - centre.y) * dist };
        else { const u = out(pos); at = { x: rim.x + u.x * (dist - 1) * 110, y: rim.y + u.y * (dist - 1) * 110 }; }
      }
      spots[n.id] = at;
      placed.push({ x0: at.x + box.x0, y0: at.y + box.y0, x1: at.x + box.x1, y1: at.y + box.y1 });
    }
    if (layouts.size > 64) layouts.clear();
    layouts.set(key, spots);
    return spots;
  }
  const place = (id: string, m: StageModel): Point | undefined => (m.nodes[id] ? layoutParts(m)[id] : undefined);

  // ---------- the lasting drawing: pins, tones, arcs, keys, dots ----------
  const pins = new Map<string, Item & { token: RingToken; level: number; side: number; flagG: SVGGElement; wrap: SVGGElement; w: number }>();
  const keys = new Map<string, Item & { k: RingKey; label: Label; wrap: SVGGElement; lg: SVGGElement; moved: boolean; setMoved(on: boolean): void }>();
  const dots = new Map<string, Item & { at: number; wrap: SVGGElement; moved: boolean; setMoved(on: boolean): void }>();
  const toneItems = new Map<string, Item & { paths: { node: string; el: SVGPathElement }[]; labels: (Label & { node: string; g: SVGGElement; t: SVGTextElement })[] }>();
  const arcs = new Map<string, Item & { label: Label; retext(next: string): void }>();
  const all = () => [...pins.values(), ...toneItems.values(), ...arcs.values(), ...keys.values(), ...dots.values()] as Item[];
  let shown: RingState = { size, tokens: [], keys: [], dots: [], arcs: [] };
  let focusList: string[] | undefined;

  const pinBase = (t: RingToken) => P(t.at, geo.track);
  function flagBox(t: RingToken, level: number, s: number, side: number, w: number): G.Box {
    const b = pinBase(t), top = b.y - geo.pin * level;
    return side > 0 ? { x0: b.x - 2, y0: top - FLAG_H * s, x1: b.x + w * s, y1: top } : { x0: b.x - w * s, y0: top - FLAG_H * s, x1: b.x + 2, y1: top };
  }

  function makePin(t: RingToken, key: string) {
    const label = tokenLabel(t), w = flagW(label), side = pinBase(t).x >= -1 ? 1 : -1;
    const notch = ctx.el("line", { class: styles.notch }, L.feet);
    const foot = ctx.el("ellipse", { class: styles.foot }, L.feet);
    const wrap = ctx.el("g", { class: styles.fade }, L.pins);
    const post = ctx.el("line", { class: styles.post }, wrap);
    const flagG = ctx.el("g", { class: styles.flag }, wrap);
    const flagIn = ctx.el("g", {}, flagG);
    // square where it meets the pole, rounded at its free end
    const e = side * w, r = side * 4;
    ctx.el("path", { d: `M0 ${-FLAG_H}H${e - r}Q${e} ${-FLAG_H} ${e} ${-FLAG_H + 4}V-4Q${e} 0 ${e - r} 0H0Z` }, flagIn);
    const text = ctx.el("text", { x: (side * w) / 2, y: -4.6, "text-anchor": "middle" }, flagIn);
    text.textContent = label;
    const item = {
      key, token: t, level: 1, side, flagG, wrap, w, p: 0, from: 0, to: 1, delay: 0, dur: 560, rise: ctx.ease.back,
      draw() {
        const s = S(), p = item.p, vis = clamp(p * 2), b = pinBase(t);
        const top = b.y - geo.pin * item.level * Math.max(0, p);
        const n0 = P(t.at, geo.g0 - 0.02), n1 = P(t.at, geo.g1 + 0.02);
        notch.setAttribute("x1", String(f2(n0.x))); notch.setAttribute("y1", String(f2(n0.y)));
        notch.setAttribute("x2", String(f2(n1.x))); notch.setAttribute("y2", String(f2(n1.y)));
        notch.style.opacity = String(vis);
        const fr = geo.bead * 1.15 * clamp(p * 1.6);
        foot.setAttribute("cx", String(f2(b.x))); foot.setAttribute("cy", String(f2(b.y)));
        foot.setAttribute("rx", String(f2(fr))); foot.setAttribute("ry", String(f2(fr * G.ISO)));
        foot.style.opacity = String(vis);
        const fv = clamp((p - 0.3) / 0.7);
        post.setAttribute("x1", String(f2(b.x))); post.setAttribute("y1", String(f2(b.y)));
        post.setAttribute("x2", String(f2(b.x))); post.setAttribute("y2", String(f2(top - FLAG_H * s * fv)));
        post.style.opacity = String(vis);
        flagG.setAttribute("transform", `translate(${f2(b.x)} ${f2(top)}) scale(${f2(s * (0.7 + 0.3 * fv))})`);
        flagIn.style.opacity = String(fv);
      },
      kill() { notch.remove(); foot.remove(); wrap.remove(); },
    };
    return item;
  }

  function makeKey(k: RingKey, key: string) {
    const text = keyLabel(k), w = monoW(text);
    const wrap = ctx.el("g", { class: styles.fade }, L.beads);
    const bead = ctx.el("circle", { class: styles.bead, r: 0 }, wrap);
    const lg = ctx.el("g", { class: styles.fade }, L.print), li = ctx.el("g", {}, lg);
    const lt = ctx.el("text", { class: `${styles.mono} ${styles.keyText}`, "text-anchor": "middle", y: 3.8 }, li);
    lt.textContent = text;
    const label: Label = {
      w, h: KEY_H, at: null,
      el: () => (item.to === 1 && item.p >= 0.999 ? { outer: lg, inner: li } : null),
      cands(s) {
        const hw = (w / 2) * s, hh = (KEY_H / 2) * s, list: Point[] = [];
        // by the bead inside the groove, nudged along it, a row further in, then outside the rim
        for (const row of [3, 4 + KEY_H, 5 + 2 * KEY_H]) for (const d of [0, -0.025, 0.025, -0.05, 0.05]) {
          const q = k.at + d * size;
          list.push(G.beyond(P(q, geo.g0), inward(q), hw, hh, row * s));
        }
        list.push(G.beyond(rimOut(k.at), out(k.at), hw, hh, 6 * s));
        return list;
      },
    };
    const item = {
      key, k, label, wrap, lg, moved: false, p: 0, from: 0, to: 1, delay: 0, dur: 460, rise: ctx.ease.back,
      setMoved(on: boolean) { item.moved = on; bead.classList.toggle(styles.moved, on); lt.classList.toggle(styles.moved, on); },
      draw() {
        const b = P(k.at, geo.track), s = S();
        bead.setAttribute("cx", String(f2(b.x))); bead.setAttribute("cy", String(f2(b.y)));
        bead.setAttribute("r", String(f2(geo.bead * Math.max(0, item.p))));
        bead.style.opacity = String(clamp(item.p * 2));
        const at = label.at ?? b;
        lg.setAttribute("transform", `translate(${f2(at.x)} ${f2(at.y)}) scale(${f2(s)})`);
        lt.style.opacity = String(label.at ? clamp(item.p * 2 - 1) : 0);
      },
      kill() { wrap.remove(); lg.remove(); },
    };
    return item;
  }

  function makeDot(at: number, key: string) {
    const wrap = ctx.el("g", { class: styles.fade }, L.dots);
    const c = ctx.el("circle", { class: styles.dot, r: 0 }, wrap);
    const item = {
      key, at, wrap, moved: false, p: 0, from: 0, to: 1, delay: 0, dur: 360, rise: ctx.ease.out,
      setMoved(on: boolean) { item.moved = on; c.classList.toggle(styles.moved, on); },
      draw() {
        const b = P(at, geo.track);
        c.setAttribute("cx", String(f2(b.x))); c.setAttribute("cy", String(f2(b.y)));
        c.setAttribute("r", String(f2(geo.dot * Math.max(0, item.p))));
        c.style.opacity = String(clamp(item.p));
      },
      kill() { wrap.remove(); },
    };
    return item;
  }

  /** Each token's stretch of the groove, shaded in its part's tone, with the part's name printed at its middle. */
  function makeTones(r: RingState, key: string) {
    const g = ctx.el("g", {}, L.tones);
    const paths: { node: string; el: SVGPathElement }[] = [];
    const labels: (Label & { node: string; g: SVGGElement; t: SVGTextElement })[] = [];
    r.tokens.forEach((t, i) => {
      const prev = r.tokens[(i - 1 + r.tokens.length) % r.tokens.length];
      const [a0, a1] = r.tokens.length === 1 ? [t.at, t.at + size] : G.stretch(size, prev.at, t.at);
      const el = ctx.el("path", { class: `${styles.tone} ${styles["t" + ((tones[t.node] ?? 0) % 4)]}`, d: G.bandPath(geo, size, a0, a1, geo.g0, geo.g1) }, g);
      paths.push({ node: t.node, el });
      // the owner's name: its token's flag without a virtual node's number
      const text = tokenLabel(t).replace(/(?<=\D)\d+$/, "");
      const lg = ctx.el("g", { class: styles.fade }, L.print), li = ctx.el("g", {}, lg);
      const lt = ctx.el("text", { class: styles.ownerText, "text-anchor": "middle", y: 3.6 }, li);
      lt.textContent = text;
      const w = ownerW(text), span = a1 - a0;
      labels.push({
        node: t.node, g: lg, t: lt, w, h: OWNER_H, optional: true, at: null, air: 7,
        el: () => (item.to === 1 && item.p >= 0.999 ? { outer: lg, inner: li } : null),
        cands(s) {
          // a short stretch (virtual nodes) is named by its flag alone
          if (span < size * 0.1) return [];
          const hw = (w / 2) * s, hh = (OWNER_H / 2) * s, list: Point[] = [];
          // a row in from the keys by the groove, then right by the groove, then further in
          for (const inset of [6 + KEY_H, 4, 8 + 2 * KEY_H]) for (const f of [0.5, 0.38, 0.62, 0.26, 0.74]) {
            const q = a0 + span * f;
            list.push(G.beyond(P(q, geo.g0), inward(q), hw, hh, inset * s));
          }
          return list;
        },
        avoid(s) {
          // well clear of the flag at the stretch's end, which names it already
          const it = pins.get(pinKey(t));
          if (!it || it.to !== 1) return [];
          const b = flagBox(t, it.level, s, it.side, it.w), m = 22 * s;
          return [{ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + geo.pin * it.level + m }];
        },
      });
    });
    const item = {
      key, paths, labels, p: 0, from: 0, to: 1, delay: 0, dur: 420, rise: ctx.ease.inOut,
      draw() {
        g.style.opacity = String(clamp(item.p));
        const s = S();
        for (const l of labels) {
          const at = l.at ?? { x: 0, y: 0 };
          l.g.setAttribute("transform", `translate(${f2(at.x)} ${f2(at.y)}) scale(${f2(s)})`);
          // the names come in once the shading is mostly there, after the names of a shading this one replaces have gone
          l.t.style.opacity = String(l.at ? (item.to === 1 ? clamp((item.p - 0.4) / 0.6) : clamp(item.p)) : 0);
        }
      },
      kill() { g.remove(); for (const l of labels) l.g.remove(); },
    };
    return item;
  }

  /** A marked stretch: a band over the groove, a line along the lip with ticks at its ends, and a label outside. */
  function stretchMarks(parent: SVGGElement, tone: MarkTone | "") {
    const cls = styles[tone || "ink"];
    const band = ctx.el("path", { class: `${styles.band} ${cls}` }, parent);
    const line = ctx.el("path", { class: `${styles.lip} ${cls}` }, parent);
    return (a0: number, a1: number) => {
      if (a1 - a0 < 1e-3) { band.setAttribute("d", ""); line.setAttribute("d", ""); return; }
      band.setAttribute("d", G.bandPath(geo, size, a0, a1, geo.g0, geo.g1));
      const e0 = [P(a0, geo.g1), P(a0, 0.995)], e1 = [P(a1, geo.g1), P(a1, 0.995)];
      line.setAttribute("d", `M${f2(e0[0].x)} ${f2(e0[0].y)}L${f2(e0[1].x)} ${f2(e0[1].y)}` + G.arcPath(geo, size, a0, a1, 0.965) + `M${f2(e1[0].x)} ${f2(e1[0].y)}L${f2(e1[1].x)} ${f2(e1[1].y)}`);
    };
  }
  function pill(parent: SVGGElement, text: string, tone: MarkTone | "", cls = styles.pill) {
    const g = ctx.el("g", { class: `${cls} ${styles[tone || "ink"]}` }, parent);
    const inner = ctx.el("g", {}, g);
    const dot = !!tone, w = pillW(text, dot);
    ctx.el("rect", { x: -w / 2, y: -PILL_H / 2, width: w, height: PILL_H, rx: PILL_H / 2 }, inner);
    if (dot) ctx.el("circle", { cx: -w / 2 + 10, cy: 0, r: 2.8 }, inner);
    const t = ctx.el("text", { x: dot ? 5 : 0, y: 3.8, "text-anchor": "middle" }, inner);
    t.textContent = text;
    return { g, inner, w };
  }

  function makeArc(a: RingState["arcs"][number], key: string) {
    // a stretch too short to see (a mark at one token, say) is drawn a little wider, round its middle
    const [a0, a1] = G.shownStretch(size, a.from, a.to, size * 0.03);
    const g = ctx.el("g", {}, L.arcs);
    const set = stretchMarks(g, a.tone);
    let text = a.label, tag = text ? pill(L.labels, text, a.tone) : null;
    /** Going (or coming back from going), the band fades where it lies instead of sweeping back. */
    let fading = false;
    /** A new label not yet drawn where it goes: it fades in by itself, so placing it is no move to crossfade. */
    let fresh = false;
    const label: Label = {
      w: tag?.w ?? 0, h: PILL_H, at: null,
      el: () => (tag && !fresh && item.to === 1 && item.p >= 0.999 ? { outer: tag.g, inner: tag.inner } : null),
      // the marks printed along its stretch: its label may sit where one is printed, and stands in for it
      frees: () => markEls.filter((mk) => inStretch(mk.m, a0, a1)).map((mk) => mk.m),
      cands(s) {
        if (!tag) return [];
        const hw = (tag.w / 2) * s, hh = (PILL_H / 2) * s, list: Point[] = [];
        // along the stretch; a short one's label may also sit a little either side of it
        const mid = (a0 + a1) / 2, wide = a1 - a0 < size * 0.12 ? [-0.04, 0.04, -0.07, 0.07].map((d) => mid + d * size) : [];
        const along = (fs: number[]) => [...fs.map((f) => a0 + (a1 - a0) * f), ...wide];
        const inside = (q: number, gap: number) => list.push(G.beyond(P(q, geo.g0), inward(q), hw, hh, gap));
        const outside = (q: number, gap: number) => list.push(G.beyond(rimOut(q), out(q), hw, hh, gap));
        // inside the ring by the stretch, where nothing else stands
        for (const q of along([0.5, 0.35, 0.65, 0.2, 0.8])) inside(q, 5 * s);
        for (const q of along([0.5, 0.35, 0.65])) inside(q, 9 * s + KEY_H * s);
        // then as close to the stretch as it fits: snug against the groove's inner edge (above or below the spindle,
        // say), or just outside the rim where the stretch's mark is printed, nearest first
        const gap = 5 * s, at = (f: number) => a0 + (a1 - a0) * f, fs = [0, 0.25, 0.5, 0.75, 1];
        const track = fs.map((f) => P(at(f), geo.track));
        const reach = (c: Point) => Math.min(...track.map((p) => Math.hypot(Math.max(c.x - hw - p.x, 0, p.x - c.x - hw), Math.max(c.y - hh - p.y, 0, p.y - c.y - hh))));
        const near = [
          ...G.hugInside(geo.rx * geo.g0 - gap, geo.ry * geo.g0 - gap, hw, hh, fs.map((f) => P(at(f), geo.g0)), 16),
          ...along([0.5, 0.35, 0.65]).map((q) => G.beyond(rimOut(q), out(q), hw, hh, s)),
        ];
        list.push(...near.map((c) => ({ c, d: reach(c) })).sort((p, q) => p.d - q.d).map((p) => p.c));
        for (const q of along([0.5, 0.35, 0.65, 0.2, 0.8])) outside(q, 7 * s);
        // a phone's labels are large against its ring: across the middle, over or under the spindle
        if (hub) list.push({ x: 0, y: HUB.y0 - 3 * s - hh }, { x: 0, y: HUB.y1 + 3 * s + hh });
        // on a crowded ring: further in, or further out past the flags
        for (const q of along([0.5, 0.3, 0.7])) inside(q, 13 * s + 2 * KEY_H * s);
        for (const q of along([0.5, 0.3, 0.7])) outside(q, 10 * s + FLAG_H * s);
        return list;
      },
    };
    const item = {
      key, label, p: 0, from: 0, to: 1, delay: 0, dur: 620, rise: ctx.ease.inOut,
      /** A new label on the same stretch crossfades instead of the stretch sweeping again. */
      retext(next: string) {
        if (next === text) return;
        const old = tag;
        text = next; tag = next ? pill(L.labels, next, a.tone) : null; label.w = tag?.w ?? 0; fresh = !!tag;
        if (old) {
          if (ctx.reduce || typeof old.inner.animate !== "function") old.g.remove();
          else old.inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" }).onfinish = () => old.g.remove();
        }
        if (tag && !ctx.reduce && typeof tag.inner.animate === "function") tag.inner.animate([{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
      },
      draw() {
        if (item.to === 0 && item.p < 1) fading = true;
        else if (item.p >= 1 || item.p <= 0) fading = false;
        set(a0, fading ? a1 : a0 + (a1 - a0) * clamp(item.p));
        g.style.opacity = fading ? String(clamp(item.p)) : "";
        if (!tag) return;
        const at = label.at ?? rimOut((a0 + a1) / 2), s = S();
        tag.g.setAttribute("transform", `translate(${f2(at.x)} ${f2(at.y)}) scale(${f2(s)})`);
        tag.inner.style.opacity = String(clamp((item.p - 0.55) / 0.45));
        fresh = false;
      },
      kill() { g.remove(); tag?.g.remove(); },
    };
    return item;
  }

  // ---------- bringing the drawing to a ring ----------
  const pinKey = (t: RingToken) => `${t.id}@${t.at}:${tokenLabel(t)}`;
  const keyKey = (k: RingKey) => `${k.id}@${k.at}:${keyLabel(k)}`;
  const toneKey = (r: RingState) => r.tokens.map((t) => `${t.node}@${t.at}`).join(",");
  const arcKey = (a: RingState["arcs"][number]) => `${a.id}:${a.from}-${a.to}:${a.tone}`;

  function syncInto<T, I extends Item>(map: Map<string, I>, want: [string, T][], make: (v: T, key: string) => I, stagger: number, after: number) {
    const keep = new Set(want.map(([k]) => k));
    let removing = false;
    for (const [k, it] of map) if (!keep.has(k)) { if (it.to !== 0) { it.to = 0; it.delay = 0; } removing = removing || it.p > 0; }
    let n = 0;
    for (const [k, v] of want) {
      let it = map.get(k);
      if (!it) { it = make(v, k); map.set(k, it); it.p = 0; it.draw(); }
      if (it.to !== 1 || it.p < 1) { it.to = 1; it.delay = after + n * stagger; n++; }
    }
    return removing;
  }
  /** Pins rise and sink in their own phase when a token joins or leaves. */
  function syncPins(r: RingState, after = 0) {
    const removing = syncInto(pins, r.tokens.map((t) => [pinKey(t), t]), makePin, 110, after);
    levelPins();
    return removing;
  }
  /** Pins standing so close their flags would meet (or meet a printed mark) stand taller, going clockwise. */
  function levelPins() {
    const s = geo.sRef, placed: G.Box[] = markEls.map((mk) => G.boxAt(markCentre(mk.m, mk.w, s), (mk.w / 2) * s, (MARK_H / 2) * s));
    const live = [...pins.values()].filter((it) => it.to === 1).sort((a, b) => a.token.at - b.token.at);
    for (const it of live) {
      let level = 1;
      while (level < 2.8 && placed.some((b) => G.overlap(b, flagBox(it.token, level, s, it.side, it.w)) > 0)) level += 0.55;
      it.level = level;
      placed.push(flagBox(it.token, level, s, it.side, it.w));
    }
    // painted back to front, so a pin in front passes over a flag behind it
    for (const it of [...pins.values()].sort((a, b) => pinBase(a.token).y - pinBase(b.token).y)) L.pins.appendChild(it.wrap);
  }
  /** Brings the drawing to a ring. `hold` keeps the pins and the shading as they are: a token event of the same step is
   * changing them, and the ring this comes with doesn't have its change yet. */
  function sync(r: RingState, hold = false) {
    shown = hold ? { ...r, tokens: shown.tokens } : r;
    const removedPins = hold ? false : syncPins(r);
    const lag = removedPins ? 240 : 0;
    if (!hold) {
      // a new shading goes on over the old, which then goes; the old one's names fade at once, before the new ones come
      const tk = toneKey(r), tonesWanted: [string, RingState][] = r.tokens.length ? [[tk, r]] : [];
      syncInto(toneItems, tonesWanted, makeTones, 0, lag);
      for (const [k, it] of toneItems) {
        if (k !== tk && it.to === 0 && tonesWanted.length) { it.delay = lag + 420; it.dur = 1; }
        for (const l of it.labels) l.g.style.opacity = it.to === 1 ? "" : "0";
      }
    }
    syncInto(arcs, r.arcs.map((a) => [arcKey(a), a]), makeArc, 120, lag);
    for (const a of r.arcs) arcs.get(arcKey(a))?.retext(a.label);
    syncInto(keys, r.keys.map((k) => [keyKey(k), k]), makeKey, 90, lag);
    // dots arrive clockwise, all within about a second
    const seen = new Map<number, number>();
    const dotWant = r.dots.map((p) => { const n = seen.get(p) ?? 0; seen.set(p, n + 1); return [`${p}.${n}`, p] as [string, number]; });
    syncInto(dots, dotWant, makeDot, Math.min(24, 900 / Math.max(1, dotWant.length)), lag);
  }
  function prune() {
    for (const map of [pins, keys, dots, toneItems, arcs] as Map<string, Item>[]) for (const [k, it] of map) if (it.to === 0 && it.p <= 0) { it.kill(); map.delete(k); }
  }
  function finish(list: Item[]) { for (const it of list) { it.p = it.to; it.draw(); } prune(); }
  async function run(list: Item[], tk: Token) {
    const moving = list.filter((it) => Math.abs(it.p - it.to) > 1e-3);
    if (!moving.length) { prune(); return; }
    for (const it of moving) it.from = it.p;
    const total = Math.max(...moving.map((it) => it.delay + it.dur));
    await ctx.tween(total, tk, (q) => {
      const t = q * total;
      for (const it of moving) {
        const l = clamp((t - it.delay) / it.dur);
        const e = it.to > it.from ? it.rise(l) : ctx.ease.in(l);
        it.p = it.from + (it.to - it.from) * e;
        it.draw();
      }
    });
    finish(moving);
  }

  // ---------- labels: placed clear of the parts, the flags, the marks and each other ----------
  type Floating = Label & { g: SVGGElement; inner?: SVGGElement };
  let transientLabels: Floating[] = [];
  let lastS = 0;
  function partBoxes(): G.Box[] {
    const m = ctx.model(), list: G.Box[] = [];
    for (const id in m.nodes) {
      if (!m.nodes[id].visible) continue;
      const p = ctx.at(id);
      if (!p) continue;
      list.push({ x0: p.x - HALF_BASE, y0: p.y - ctx.top(id) - 4, x1: p.x + HALF_BASE, y1: p.y + BASE_FRONT });
      const t = ctx.tag(id);
      if (t) list.push(t);
    }
    // the step's notes, where the engine floats them over their parts
    const st = ctx.step(), ls = ctx.labelScale();
    if (st >= 0) for (const e of stepEvents(scene, st)) {
      if (e.type !== "note" || !m.nodes[e.node]?.visible) continue;
      const p = ctx.at(e.node), n = m.nodes[e.node];
      if (!p) continue;
      const pill = !!(n.readout || n.meter != null) && !n.down;
      const y = p.y - (ctx.top(e.node) + 10 + (narrow && pill ? 30 * ls : 0) + (n.down ? 16 : 0) + 14 * ls), hw = (pillW(e.text, !!e.tone) / 2) * ls;
      list.push({ x0: p.x - hw, y0: y - 11 * ls, x1: p.x + hw, y1: y + 11 * ls });
    }
    return list;
  }
  /** A label that moves, comes or goes while it shows fades across: out where it was (a copy) and in where it goes. */
  function crossfade(outer: SVGGElement, inner: SVGElement, from: Point | null, to: Point | null) {
    if (typeof inner.animate !== "function") return;
    if (from) {
      const ghost = outer.cloneNode(true) as SVGGElement, gi = ghost.firstElementChild as SVGElement | null;
      outer.parentNode?.insertBefore(ghost, outer);
      (gi ?? ghost).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-in", fill: "forwards" }).onfinish = () => ghost.remove();
    }
    if (to) inner.animate(from ? [{ opacity: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: from ? 420 : 300, easing: "ease-out" });
  }
  /** Each step's key flights, by key: labels keep off the dotted line a key flew in along. */
  const flights = new Map<string, { a: Point; b: Point }>();
  const flightBoxes = () => [...flights.values()].flatMap(({ a, b }) => G.segmentBoxes(a, b, 5, 2));
  /** The ring with its marks and flags, at label scale s: every flag the scene ever shows, so the camera holds still as
   * tokens and parts come and go (the ring is one object, framed whole, whatever the step is about). */
  function ringBox(s: number, tokens: RingToken[] = []): G.Box {
    let b: G.Box = { x0: -geo.rx - 4, y0: -geo.ry - 4, x1: geo.rx + 4, y1: geo.ry + geo.h + 8 };
    for (const mk of markEls) b = G.union(b, G.boxAt(markCentre(mk.m, mk.w, s), (mk.w / 2) * s, (MARK_H / 2) * s));
    for (const t of [...tokens, ...sceneTokens]) {
      const it = pins.get(pinKey(t)), w = flagW(tokenLabel(t));
      b = G.union(b, flagBox(t, it?.level ?? 1, s, pinBase(t).x >= -1 ? 1 : -1, w));
    }
    return b;
  }
  function relabel(fade = false) {
    const s = (lastS = S()), taken = partBoxes();
    if (hub) taken.push(HUB);
    taken.push(...flightBoxes());
    if (narrow) {
      // a phone frames the ring's width and no more (its parts stand above and below), so labels stay within it
      const r = ringBox(s);
      taken.push({ x0: r.x0 - 999, y0: -9999, x1: r.x0, y1: 9999 }, { x0: r.x1, y0: -9999, x1: r.x1 + 999, y1: 9999 });
    }
    const markBox = new Map(markEls.map((mk) => [mk.m, G.boxAt(markCentre(mk.m, mk.w, s), (mk.w / 2) * s, (MARK_H / 2) * s)]));
    taken.push(...markBox.values());
    for (const it of pins.values()) if (it.to === 1) {
      taken.push(flagBox(it.token, it.level, s, it.side, it.w));
      const b = pinBase(it.token);
      taken.push({ x0: b.x - 3, y0: b.y - geo.pin * it.level, x1: b.x + 3, y1: b.y + 3 });
    }
    for (const it of keys.values()) if (it.to === 1) { const b = P(it.k.at, geo.track); taken.push(G.boxAt(b, geo.bead + 1, geo.bead + 1)); }
    const labels: Label[] = [
      ...[...keys.values()].filter((it) => it.to === 1).map((it) => it.label),
      ...[...arcs.values()].filter((it) => it.to === 1).map((it) => it.label),
      ...[...toneItems.values()].filter((it) => it.to === 1).flatMap((it) => it.labels),
      ...transientLabels,
    ];
    hiddenMarks = new Set();
    for (const l of labels) {
      const cands = l.cands(s), frees = new Set((l.frees?.() ?? []).map((m) => markBox.get(m)));
      const against = [...taken.filter((b) => !frees.has(b)), ...(l.avoid?.(s) ?? [])], air = (l.air ?? 0) * s;
      const boxes = cands.map((c) => G.boxAt(c, (l.w / 2) * s + air, (l.h / 2) * s + air));
      const i = cands.length ? G.pick(boxes, against, l.optional) : -1;
      if (i >= 0) for (const [m, b] of markBox) if (frees.has(b) && G.overlap(b, boxes[i]) > 0) hiddenMarks.add(m);
      const was = l.at;
      l.at = i >= 0 ? cands[i] : null;
      if (i >= 0) taken.push(boxes[i]);
      const el = fade && !ctx.reduce ? l.el?.() : null;
      if (el && (!!was !== !!l.at || (was && l.at && Math.hypot(was.x - l.at.x, was.y - l.at.y) > 2 * s))) crossfade(el.outer, el.inner, was, l.at);
    }
  }
  function placeLabels() {
    const s = S();
    for (const mk of markEls) {
      const c = markCentre(mk.m, mk.w, s);
      mk.g.setAttribute("transform", `translate(${f2(c.x)} ${f2(c.y)}) scale(${f2(s)})`);
      mk.g.style.opacity = hiddenMarks.has(mk.m) ? "0" : "";
    }
    for (const l of transientLabels) {
      l.g.style.display = l.at ? "" : "none";
      if (l.at) l.g.setAttribute("transform", `translate(${f2(l.at.x)} ${f2(l.at.y)}) scale(${f2(s)})`);
    }
  }
  function redraw(labelled = false) {
    for (const it of labelled ? [...pins.values(), ...toneItems.values(), ...arcs.values(), ...keys.values()] : all()) it.draw();
    placeLabels();
  }

  // ---------- focus: the focused parts' stretches in ink, everything of the others dimmed ----------
  function restyle() {
    // inking only says something while some owner on the ring is not focused; when every owner is, all stay neutral
    const f = focusList, dim = (node: string | undefined) => !!f && !!node && !f.includes(node);
    const singled = !!f && [...pins.values()].some((it) => it.to === 1 && !f.includes(it.token.node));
    const mine = (node: string) => singled && f!.includes(node);
    for (const it of pins.values()) { it.wrap.classList.toggle(styles.dim, dim(it.token.node)); it.flagG.classList.toggle(styles.mine, mine(it.token.node)); }
    for (const it of toneItems.values()) {
      for (const p of it.paths) { p.el.classList.toggle(styles.mine, mine(p.node)); p.el.classList.toggle(styles.dim, dim(p.node)); }
      for (const l of it.labels) { l.t.classList.toggle(styles.mine, mine(l.node)); l.g.classList.toggle(styles.dim, dim(l.node)); }
    }
    const owner = (at: number) => (shown.tokens.length ? ringOwner(shown, at)?.node : undefined);
    for (const it of keys.values()) { const d = dim(owner(it.k.at)); it.wrap.classList.toggle(styles.dim, d); it.lg.classList.toggle(styles.dim, d); }
    for (const it of dots.values()) it.wrap.classList.toggle(styles.dim, dim(owner(it.at)));
  }

  /** The token event playing now, by its step's token: until it hands over, what else its step renders (a part hiding
   * alongside it) comes with a ring that doesn't have its change yet, so must not bring back what it is taking away. */
  let tokenPlay: Token | null = null;
  async function render(m: StageModel, tk: Token, instant: boolean) {
    if (!m.ring) return;
    const hold = !instant && !ctx.reduce && tokenPlay === tk && !tk.dead;
    sync(m.ring, hold);
    const fade = !instant && !ctx.reduce;
    relabel(fade);
    restyle();
    if (!fade) { finish(all()); placeLabels(); return; }
    redraw();
    await run(hold ? [...arcs.values(), ...keys.values(), ...dots.values()] : all(), tk);
  }

  // ---------- what plays leaves marks for the step ----------
  /** A trail along the track from p0 to p1, with a small arrowhead where it arrives. */
  function trail(tone: "ink" | "work", p0: number) {
    // a halo in the platter's tone keeps the trail clear of whatever shading it crosses
    const halo = ctx.el("path", { class: styles.halo }, L.trails);
    const path = ctx.el("path", { class: `${styles.trail} ${styles[tone]}` }, L.trails);
    const head = ctx.el("path", { class: `${styles.head} ${styles[tone]}` }, L.trails);
    return (p1: number) => {
      if (p1 - p0 < 0.05) { for (const x of [halo, path, head]) x.setAttribute("d", ""); return; }
      path.setAttribute("d", G.arcPath(geo, size, p0, p1, geo.track));
      halo.setAttribute("d", path.getAttribute("d")!);
      // the arrowhead points along the ring, clockwise
      const a = P(p1, geo.track), b = P(p1 - size * 0.004, geo.track), l = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ux = (a.x - b.x) / l, uy = (a.y - b.y) / l, k = 4.2 * Math.min(1.25, S());
      const back = { x: a.x - ux * k * 1.4, y: a.y - uy * k * 1.4 };
      head.setAttribute("d", `M${f2(back.x - uy * k)} ${f2(back.y + ux * k)}L${f2(a.x)} ${f2(a.y)}L${f2(back.x + uy * k)} ${f2(back.y - ux * k)}`);
    };
  }
  function walker(tone: "ink" | "work") {
    const c = ctx.el("circle", { class: `${styles.walker} ${styles[tone]}`, r: f2(geo.bead * 0.9) }, L.over);
    return {
      at(pos: number) { const b = P(pos, geo.track); c.setAttribute("cx", String(f2(b.x))); c.setAttribute("cy", String(f2(b.y))); },
      async fade(tk: Token) { await ctx.tween(180, tk, (q) => { c.style.opacity = String(1 - q); }); c.remove(); },
      remove() { c.remove(); },
    };
  }
  /** A small ripple on the ring where something arrives. */
  function ripple(pos: number, tone: "ink" | "work" = "ink") {
    if (ctx.reduce) return;
    const b = P(pos, geo.track);
    const r = ctx.el("ellipse", { class: `${styles.ripple} ${styles[tone]}`, cx: f2(b.x), cy: f2(b.y), rx: 4, ry: f2(4 * G.ISO) }, L.over);
    void ctx.realtime(560, (q) => {
      const rr = (5 + 17 * ctx.ease.out(q)) * (narrow ? 1.2 : 1);
      r.setAttribute("rx", String(f2(rr))); r.setAttribute("ry", String(f2(rr * G.ISO)));
      r.style.opacity = String(0.85 * (1 - q));
    }).then(() => r.remove());
  }
  const arrive = (token: RingToken, tone: "ink" | "work" = "ink") => { ripple(token.at, tone); ctx.bob(token.node); };
  /** The trail a key leaves: from its hash position clockwise to the token that owns it. */
  function keyTrail(pos: number, r: RingState) {
    const owner = r.tokens.length ? ringOwner(r, pos) : undefined;
    return owner ? { owner, end: pos + G.clockwise(size, pos, owner.at) } : null;
  }
  /** The line a key flies along from a part to its place on the ring. */
  function flight(id: string, from: string, pos: number) {
    const a = ctx.at(from), b = P(pos, geo.track);
    if (!a) return null;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1, start = { x: a.x + ((b.x - a.x) / l) * 30, y: a.y + ((b.y - a.y) / l) * 30 };
    const path = ctx.el("path", { class: styles.flight }, L.under);
    flights.set(id, { a: start, b });
    return { start, end: b, len: Math.hypot(b.x - start.x, b.y - start.y), draw(q: number) { path.setAttribute("d", q <= 0 ? "" : `M${f2(start.x)} ${f2(start.y)}L${f2(start.x + (b.x - start.x) * q)} ${f2(start.y + (b.y - start.y) * q)}`); } };
  }
  /** A walk's number by a chosen token (or a muted mark by one it skips), placed clear of the flags. */
  function badge(stop: G.WalkStop<RingToken>) {
    const g = ctx.el("g", { class: stop.chosen ? styles.badge : styles.skip }, L.over);
    const inner = ctx.el("g", {}, g);
    ctx.el("circle", { r: stop.chosen ? BADGE_R : BADGE_R - 2 }, inner);
    if (stop.chosen) { const t = ctx.el("text", { y: 3.6, "text-anchor": "middle" }, inner); t.textContent = String(stop.chosen); }
    else ctx.el("path", { d: "M-2.6 0H2.6" }, inner);
    const pin = [...pins.values()].find((it) => it.token.id === stop.token.id && it.to === 1);
    const d = (stop.chosen ? BADGE_R : BADGE_R - 2) * 2 + 2;
    const label: Floating = {
      g, inner, w: d, h: d, at: null,
      cands(s) {
        const t = stop.token, list: Point[] = [];
        if (pin) {
          // always by its own flag, so the number reads as the token's even on a crowded ring: past the flag's free
          // end, over it, on the pole's other side, or beside the pole under it
          const fb = flagBox(t, pin.level, s, pin.side, pin.w), cy = (fb.y0 + fb.y1) / 2, r = (d / 2 + 3) * s, b = pinBase(t);
          list.push(pin.side > 0 ? { x: fb.x1 + r, y: cy } : { x: fb.x0 - r, y: cy });
          list.push({ x: (fb.x0 + fb.x1) / 2, y: fb.y0 - r });
          list.push(pin.side > 0 ? { x: fb.x0 - r + 2 * s, y: cy } : { x: fb.x1 + r - 2 * s, y: cy });
          list.push({ x: b.x - pin.side * (d / 2 + 3) * s, y: b.y - (geo.pin * pin.level) / 2 });
          return list;
        }
        list.push(G.beyond(P(t.at, geo.g0), inward(t.at), (d / 2) * s, (d / 2) * s, 3 * s));
        list.push(G.beyond(rimOut(t.at), out(t.at), (d / 2) * s, (d / 2) * s, 4 * s));
        return list;
      },
    };
    transientLabels.push(label);
    return label;
  }
  function note(text: string, pos: number, end = pos) {
    // it floats over the parts like the engine's notes, so no tag ever hides it
    const tag = pill(floatG, text, "work", styles.note);
    const label: Floating = {
      g: tag.g, inner: tag.inner, w: tag.w, h: PILL_H, at: null,
      cands(s) {
        const hw = (tag.w / 2) * s, hh = (PILL_H / 2) * s, list: Point[] = [];
        // inside the ring, by where the walk starts or along it (the camera frames the ring, not what floats outside)
        const along = [0, 0.5, 1, -0.05].map((f) => pos + (f < 0 ? f * size : (end - pos) * f));
        for (const inset of [5 + KEY_H, 5, 9 + 2 * KEY_H]) for (const q of along) list.push(G.beyond(P(q, geo.g0), inward(q), hw, hh, inset * s));
        list.push({ x: 0, y: -geo.ry * 0.35 }, { x: 0, y: geo.ry * 0.35 });
        return list;
      },
    };
    transientLabels.push(label);
    return label;
  }
  const popIn = (l: Floating) => {
    if (ctx.reduce || !l.inner || typeof l.inner.animate !== "function") return;
    l.inner.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 320, easing: "cubic-bezier(.22,1.4,.36,1)" });
  };

  // ---------- the model around an event, for drawing what it leaves without playing it ----------
  function around(e: StageEvent): { before: StageModel; after: StageModel } | null {
    for (let i = 0; i < scene.steps.length; i++) {
      const runs: Record<number, number>[] = [{}, ...(scene.steps[i].control?.options.map((_, j) => ({ [i]: j })) ?? [])];
      for (const choices of runs) {
        const list = stepEvents(scene, i, choices), k = list.indexOf(e);
        if (k < 0) continue;
        const before = stateBefore(scene, i, choices);
        for (let j = 0; j < k; j++) applyEvent(before, list[j]);
        const after = cloneModel(before);
        applyEvent(after, e);
        return { before, after };
      }
    }
    return null;
  }
  const ownerOf = (r: RingState) => (p: number) => (r.tokens.length ? ringOwner(r, p)?.node : undefined);
  /** The stretches that change owner between two rings; none when either has no tokens (nothing is owned to move). */
  const moved = (a: RingState, b: RingState) => (a.tokens.length && b.tokens.length ? G.changedRuns(size, ownerOf(a), ownerOf(b)) : []);
  const inStretch = (pos: number, a0: number, a1: number) => { const d = G.clockwise(size, a0, pos); return (d > 0 || a1 - a0 >= size) && d <= a1 - a0; };
  function movers(a0: number, a1: number) {
    const list: { d: number; set(on: boolean): void }[] = [];
    for (const it of keys.values()) if (it.to === 1 && inStretch(it.k.at, a0, a1)) list.push({ d: G.clockwise(size, a0, it.k.at) || size, set: it.setMoved });
    for (const it of dots.values()) if (it.to === 1 && inStretch(it.at, a0, a1)) list.push({ d: G.clockwise(size, a0, it.at) || size, set: it.setMoved });
    return list.sort((a, b) => a.d - b.d);
  }

  // ---------- playing ----------
  async function playToken(before: StageModel, after: StageModel, tk: Token) {
    tokenPlay = tk;
    try { await sweepToken(before, after, tk); } finally { if (tokenPlay === tk) tokenPlay = null; }
    await render(after, tk, false);
  }
  async function sweepToken(before: StageModel, after: StageModel, tk: Token) {
    const rb = before.ring!, ra = after.ring!;
    // the pins rise and sink first
    syncPins(ra);
    relabel(true); restyle(); redraw(true);
    await run([...pins.values()], tk);
    // then each slice that changes owner sweeps across, and its keys turn blue as it passes them
    const runs = moved(rb, ra);
    await Promise.all(runs.map(async ([a0, a1]) => {
      const set = stretchMarks(L.under, "work"), list = movers(a0, a1);
      // a slice whose token left goes on to the next token clockwise: one cursor leads the sweep and carries on
      const owner = ringOwner(ra, ((a1 % size) + size) % size);
      const end = owner ? a1 + G.clockwise(size, ((a1 % size) + size) % size, owner.at) : a1;
      const draw = end > a1 ? trail("work", a1) : null, w = walker("work");
      const len = G.arcLength(geo, size, a0, end, geo.track);
      try {
        await ctx.tween(Math.max(520, len / ctx.speed), tk, (q) => {
          const cur = a0 + (end - a0) * ctx.ease.inOut(q);
          set(a0, Math.min(cur, a1));
          if (draw) draw(Math.max(a1, cur));
          w.at(cur);
          for (const mv of list) if (a0 + mv.d <= cur + 1e-6) mv.set(true);
        });
      } finally { void w.fade(tk).catch(() => w.remove()); }
      if (owner) arrive(owner, "work");
    }));
  }

  async function playKey(e: Extract<StageEvent, { type: "key" }>, after: StageModel, tk: Token) {
    if (e.at === null) { await render(after, tk, false); return; }
    const pos = e.at, ra = after.ring!;
    // it flies from the part that sends it, as a message pill, to its hash position
    const fl = e.from ? flight(e.id, e.from, pos) : null;
    // its bead's place (still empty) and the owners' names make way for the flight line before it starts, so nothing
    // has to move out of its way as it lands
    syncInto(keys, ra.keys.map((k) => [keyKey(k), k]), makeKey, 0, 0);
    relabel(true); restyle(); redraw(true);
    if (fl) {
      const pk = ctx.pill(e.label ?? e.id, "request");
      try {
        await ctx.tween(Math.max(320, fl.len / ctx.speed), tk, (q) => {
          const v = ctx.ease.inOut(q);
          pk.o.x = fl.start.x + (fl.end.x - fl.start.x) * v; pk.o.y = fl.start.y + (fl.end.y - fl.start.y) * v;
          pk.o.sc = ctx.ease.back(clamp(q * 3.5)); fl.draw(v); pk.o.place(ctx.labelScale());
        });
        await ctx.tween(170, tk, (q) => { pk.o.sc = 1 - 0.4 * q; pk.o.op = 1 - q; pk.o.place(ctx.labelScale()); });
      } finally { pk.remove(); }
    }
    // the bead lands
    syncInto(keys, ra.keys.map((k) => [keyKey(k), k]), makeKey, 0, 0);
    shown = { ...shown, keys: ra.keys };
    relabel(true); restyle(); redraw(true);
    ripple(pos);
    await run([...keys.values()], tk);
    // and walks clockwise to the first token
    const kt = keyTrail(pos, ra);
    if (kt) {
      if (kt.end > pos) {
        const draw = trail("ink", pos), w = walker("ink");
        await ctx.tween(Math.max(260, G.arcLength(geo, size, pos, kt.end, geo.track) / ctx.speed), tk, (q) => { const c = pos + (kt.end - pos) * ctx.ease.inOut(q); draw(c); w.at(c); });
        void w.fade(tk).catch(() => w.remove());
      }
      arrive(kt.owner);
    }
    await render(after, tk, false);
  }

  /** A stretch marked in work tone that takes a new label as it stays (a range being copied, say) has data move across
   * it: a short stream of blue pulses runs along it clockwise, what it holds flickers as the first passes, and a part
   * standing by its end takes them. It leaves nothing behind, so its end state is the relabelled mark alone. */
  async function playArc(e: Extract<StageEvent, { type: "arc" }>, before: StageModel, after: StageModel, tk: Token) {
    const was = before.ring?.arcs.find((a) => a.id === e.id), now = after.ring?.arcs.find((a) => a.id === e.id);
    await render(after, tk, false);
    if (!was || !now || now.tone !== "work" || was.from !== now.from || was.to !== now.to || was.label === now.label) return;
    const [a0, a1] = G.shownStretch(size, now.from, now.to, size * 0.03);
    const ms = Math.max(620, G.arcLength(geo, size, a0, a1, geo.track) / ctx.speed);
    const held = movers(a0, a1).map((mv) => ({ ...mv, lit: false }));
    await Promise.all([0, 1, 2].map(async (n) => {
      await ctx.after(n * 190, tk);
      const halo = ctx.el("path", { class: styles.halo }, L.trails), tail = ctx.el("path", { class: `${styles.trail} ${styles.work}` }, L.trails);
      const w = walker("work");
      w.at(a0);
      try {
        await ctx.tween(ms, tk, (q) => {
          const c = a0 + (a1 - a0) * ctx.ease.inOut(q), d = c - a0 > 0.05 ? G.arcPath(geo, size, Math.max(a0, c - size * 0.045), c, geo.track) : "";
          tail.setAttribute("d", d); halo.setAttribute("d", d);
          w.at(c);
          if (n === 0) for (const mv of held) if (!mv.lit && a0 + mv.d <= c + 1e-6) {
            mv.lit = true; mv.set(true);
            void ctx.after(360, tk).then(() => mv.set(false), () => {});
          }
        });
      } finally { halo.remove(); tail.remove(); void w.fade(tk).catch(() => w.remove()); }
    }));
    ripple(a1, "work");
    const end = ((Math.round(a1) % size) + size) % size;
    const by = scene.nodes.find((nd) => { const st = after.nodes[nd.id]; return st?.visible && st.at[1] > 0 && Math.round(st.at[0]) === end; });
    if (by) ctx.bob(by.id);
  }

  async function playWalk(e: Extract<StageEvent, { type: "walk" }>, before: StageModel, tk: Token) {
    const r = before.ring!, stops = G.walkStops(r.tokens, size, e.from, e.count, e.distinct);
    if (e.label) { const n = note(e.label, e.from, stops.length ? stops[stops.length - 1].at : e.from); relabel(); placeLabels(); popIn(n); }
    const draw = trail("work", e.from), w = walker("work");
    let cur = e.from;
    w.at(cur);
    try {
      for (const stop of stops) {
        const from = cur;
        await ctx.tween(Math.max(200, G.arcLength(geo, size, from, stop.at, geo.track) / ctx.speed), tk, (q) => { cur = from + (stop.at - from) * ctx.ease.inOut(q); draw(cur); w.at(cur); });
        cur = stop.at;
        ripple(stop.token.at, stop.chosen ? "work" : "ink");
        if (stop.chosen) ctx.bob(stop.token.node);
        const b = badge(stop);
        relabel(); placeLabels(); popIn(b);
        await ctx.after(160, tk);
      }
    } finally { void w.fade(tk).catch(() => w.remove()); }
  }

  // ---------- leaving a played event's marks without playing it ----------
  function settleToken(before: StageModel, after: StageModel) {
    const rb = before.ring!, ra = after.ring!;
    for (const [a0, a1] of moved(rb, ra)) {
      stretchMarks(L.under, "work")(a0, a1);
      for (const mv of movers(a0, a1)) mv.set(true);
      const end0 = ((a1 % size) + size) % size, owner = ringOwner(ra, end0);
      if (owner && G.clockwise(size, end0, owner.at) > 0) trail("work", a1)(a1 + G.clockwise(size, end0, owner.at));
    }
  }
  function settleKey(e: Extract<StageEvent, { type: "key" }>, after: StageModel) {
    if (e.at === null) return;
    if (e.from) flight(e.id, e.from, e.at)?.draw(1);
    const kt = keyTrail(e.at, after.ring!);
    if (kt && kt.end > e.at) trail("ink", e.at)(kt.end);
  }
  function settleWalk(e: Extract<StageEvent, { type: "walk" }>, before: StageModel) {
    const stops = G.walkStops(before.ring!.tokens, size, e.from, e.count, e.distinct);
    if (!stops.length) return;
    if (e.label) note(e.label, e.from, stops[stops.length - 1].at);
    trail("work", e.from)(stops[stops.length - 1].at);
    for (const stop of stops) badge(stop);
  }

  function clear() {
    for (const g of [L.under, L.trails, L.over, floatG]) g.innerHTML = "";
    transientLabels = [];
    flights.clear();
    for (const it of keys.values()) if (it.moved) it.setMoved(false);
    for (const it of dots.values()) if (it.moved) it.setMoved(false);
  }

  build();
  return {
    handles: (e) => TYPES.has(e.type),
    place,
    bounds(m, k) {
      const s = scaleAt(k);
      let b = ringBox(s, m.ring?.tokens ?? []);
      for (const id in m.nodes) {
        const n = m.nodes[id];
        if (!n.visible && !everShown.has(id)) continue;
        const at = place(id, m)!, box = partBox(id, n, s);
        // as deep as the engine's own test for a part out of frame takes its tag to reach
        const y1 = Math.max(box.y1, BASE_FRONT + ((n.detail && !narrow ? 36 : 22) + 4) / k);
        b = G.union(b, { x0: at.x + box.x0, y0: at.y + box.y0, x1: at.x + box.x1, y1: at.y + y1 });
      }
      return b;
    },
    render,
    async play(e, before, after, tk) {
      if (e.type === "token") await playToken(before, after, tk);
      else if (e.type === "key") await playKey(e, after, tk);
      else if (e.type === "walk") await playWalk(e, before, tk);
      else if (e.type === "arc") await playArc(e, before, after, tk);
      else await render(after, tk, false);
    },
    settle(e, m) {
      const at = around(e) ?? { before: m, after: m };
      if (!at.before.ring || !at.after.ring) return;
      if (e.type === "token") settleToken(at.before, at.after);
      else if (e.type === "key") settleKey(e, at.after);
      else if (e.type === "walk") settleWalk(e, at.before);
      // placed knowing what the event leaves (a key's flight line), and drawn there: key labels move only when drawn
      relabel();
      redraw(true);
    },
    clear,
    focus(list) { focusList = list; restyle(); },
    layout() {
      if (Math.abs(S() - lastS) > lastS * 0.004) relabel();
      // the camera or the parts moved: only what carries a flat label changes
      redraw(true);
    },
    resize() {
      narrow = ctx.narrow();
      geo = sized();
      keepOutCache = null;
      layouts.clear();
      for (const map of [pins, keys, dots, toneItems, arcs] as Map<string, Item>[]) { for (const it of map.values()) it.kill(); map.clear(); }
      transientLabels = [];
      flights.clear();
      tokenPlay = null;
      build();
    },
    destroy() { root.remove(); floatG.remove(); },
  };
};
