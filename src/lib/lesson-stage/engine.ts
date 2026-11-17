// Plays a lesson stage: an SVG of the system that changes step by step, with messages moving between parts.
// Framework-free, so it stays small and any chapter can use it. The React wrapper owns the controls and text.
import { GLYPH_TOP, PICTOGRAM_DEFS, glyph, isDrawn, plinth } from "./pictograms.ts";
import { loadScenePacks } from "./packs/index.ts";
import { fills } from "./roles.ts";
import { applyEvent, cloneModel, initialModel, stateBefore, stepEvents, type Choices, type StageModel } from "./model";
import { isFront, portSlot, routeLinks, rounded, type Face, type Rect, type RouteNode } from "./routing";
import type { FlowKind, PacketEvent, Place, StageEvent, StageRole, StageScene, StreamEvent } from "./types";

const NS = "http://www.w3.org/2000/svg";
const CANCEL = Symbol("cancel");
const GLYPH = 1.42, PH = 7, BASE = 56, HALF_BASE_W = BASE * Math.cos(Math.PI / 6);
// Choreography, in ms: what leaves, then what moves, then what arrives, then the links between them.
const T = { exit: 420, move: 820, enter: 680, stagger: 130, draw: 560, linkStagger: 90, camera: 820, hop: 160 };
const SPEED = 0.22; // world units per ms

type Point = { x: number; y: number };
type Route = { pts: Point[]; len: number[]; total: number };
type Token = { dead: boolean };

export type StageStatus = {
  step: number; total: number; playing: boolean; paused: boolean; ended: boolean; settled: boolean;
  /** While autoplay waits on a step for reading time, how long it waits (ms); 0 otherwise. */
  hold: number;
};
export type StageOptions = { reduce?: boolean; onStatus?: (status: StageStatus) => void; label?: string };
export type StageHandle = {
  play(): void; pause(): void; toggle(): void; next(): void; back(): void; jump(index: number): void; reset(): void;
  /** Set a step's control (such as a hit rate) and replay what it changes. */
  choose(step: number, option: number): void;
  /** Land on a step without animating it, as a link to a step does. */
  show(index: number): void;
  destroy(): void;
  readonly step: number;
  readonly choices: Choices;
};

const topOf = (role: StageRole) => GLYPH_TOP[role] * GLYPH + PH;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const backOut = (t: number) => 1 + 2.5 * Math.pow(t - 1, 3) + 1.5 * Math.pow(t - 1, 2);
const fmt = (n: number) => Math.round(n * 100) / 100;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const key in attrs) node.setAttribute(key, String(attrs[key]));
  if (parent) parent.appendChild(node);
  return node;
}

// One frame loop for every stage on the page; it stops whenever nothing is moving.
type Frame = (dt: number) => void;
const frames = new Set<Frame>();
let rafId = 0, lastTime = 0;
function loop(now: number) {
  const dt = lastTime ? Math.min(50, now - lastTime) : 16;
  lastTime = now;
  for (const f of [...frames]) f(dt);
  rafId = frames.size ? requestAnimationFrame(loop) : 0;
  if (!rafId) lastTime = 0;
}
function addFrame(f: Frame) {
  frames.add(f);
  if (!rafId) rafId = requestAnimationFrame(loop);
}
function removeFrame(f: Frame) { frames.delete(f); }

export function createStage(host: HTMLElement, scene: StageScene, options: StageOptions = {}): StageHandle {
  const reduce = options.reduce ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const steps = scene.steps;
  const roleOf: Record<string, StageRole> = Object.fromEntries(scene.nodes.map((n) => [n.id, n.role]));
  const ids = scene.nodes.map((n) => n.id);
  const choices: Choices = {};
  const clock = { paused: false, offscreen: false };
  const stopped = () => clock.paused || clock.offscreen;
  // This stage's frames; while it is paused or off screen they leave the shared loop, which then stops.
  const mine = new Set<Frame>();
  const parked = () => stopped() || destroyed;
  function addMine(f: Frame) { mine.add(f); if (!parked()) addFrame(f); }
  function dropMine(f: Frame) { mine.delete(f); removeFrame(f); }
  function syncFrames() { for (const f of mine) { if (parked()) removeFrame(f); else addFrame(f); } }
  function setPaused(value: boolean) { clock.paused = value; syncFrames(); }
  let token: Token = { dead: false };
  let cur = -1, autoPlay = false, ended = false, looping = false, destroyed = false, settled = true, hold = 0;
  let model: StageModel = initialModel(scene);

  // ---------- time that pausing freezes ----------
  function after(ms: number, tk: Token): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let t = 0;
      const f: Frame = (dt) => {
        if (tk.dead) { dropMine(f); reject(CANCEL); return; }
        if (stopped()) return;
        t += dt;
        if (t >= ms) { dropMine(f); resolve(); }
      };
      addMine(f);
    });
  }
  function tween(ms: number, tk: Token, fn: (p: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let t = 0;
      fn(0);
      const f: Frame = (dt) => {
        if (tk.dead) { dropMine(f); reject(CANCEL); return; }
        if (stopped()) return;
        t += dt;
        const p = Math.min(1, t / ms);
        fn(p);
        if (p >= 1) { dropMine(f); resolve(); }
      };
      addMine(f);
    });
  }
  function realtime(ms: number, fn: (p: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let t = 0;
      fn(0);
      const f: Frame = (dt) => { t += dt; const p = Math.min(1, t / ms); fn(p); if (p >= 1) { dropMine(f); resolve(); } };
      addMine(f);
      if (clock.paused && !clock.offscreen) addFrame(f);
    });
  }
  const swallow = (err: unknown) => { if (err !== CANCEL) throw err; };

  // ---------- scaffold ----------
  host.innerHTML = "";
  const svg = el("svg", { class: "stage-svg", role: "img", "aria-label": options.label ?? "The system, step by step" }, host);
  const defs = el("defs", {}, svg);
  const pattern = el("pattern", { id: "sk-iso-dots", width: 20.78, height: 12, patternUnits: "userSpaceOnUse" }, defs);
  for (const [cx, cy] of [[0, 0], [10.39, 6], [20.78, 12], [0, 12], [20.78, 0]]) el("circle", { cx, cy, r: 0.9, class: "griddot" }, pattern);
  defs.insertAdjacentHTML("beforeend",
    '<radialGradient id="sk-soft-shadow"><stop offset="0" class="ss0"/><stop offset=".55" class="ss1"/><stop offset="1" class="ss2"/></radialGradient>' +
    '<radialGradient id="sk-heat"><stop offset="0" class="ht0"/><stop offset="1" class="ht1"/></radialGradient>' +
    PICTOGRAM_DEFS);
  el("rect", { x: -4000, y: -4000, width: 8000, height: 8000, fill: "url(#sk-iso-dots)" }, svg);
  const gLinks = el("g", { class: "links" }, svg);
  const gStreamTrails = el("g", { class: "trails stream" }, svg);
  const gTrails = el("g", { class: "trails" }, svg);
  const gDots = el("g", {}, svg);
  const gRings = el("g", {}, svg);
  const gNodes = el("g", {}, svg);
  const gLabels = el("g", {}, svg);
  const gNotes = el("g", {}, svg);
  const gPackets = el("g", {}, svg);

  const view = { x: -300, y: -200, w: 600, h: 400, k: 1, W: 600, H: 400 };
  let narrow = host.getBoundingClientRect().width < 560;
  // On a phone a tag shows the part's name only: the step's text below the stage carries the description.
  const tagHeight = (detail: string) => (detail && !narrow ? 36 : 22);
  const pos: Record<string, Point> = {};
  type Shown = { visible: boolean; op: number; sink: number; lift: number };
  const shown: Record<string, Shown> = {};
  type NodeEls = {
    g: SVGGElement; lift: SVGGElement; pk: SVGGElement; ports: SVGGElement; portsKey: string; art: SVGGElement; label: SVGGElement; labelInner: SVGGElement; pillInner: SVGGElement; tag: SVGRectElement;
    name: SVGTextElement; detail: SVGTextElement; pill: SVGGElement; pillBg: SVGRectElement; barBg: SVGRectElement;
    bar: SVGRectElement; pillText: SVGTextElement; opts: string | null; light: string | null;
  };
  const nodeEls: Record<string, NodeEls> = {};
  type LinkEl = { a: string; b: string; unless?: string; path: SVGPathElement; drawn: number };
  const linkEls: LinkEl[] = [];

  // Tags, pills, notes and messages keep their size on screen as the camera zooms, down to a floor: past it
  // they shrink with the drawing, so a small phone can still hold the whole system.
  // Full size down to a zoom of 0.62, then easing to 80%; below 0.35 they shrink with the drawing, which keeps
  // the spacing they ask for bounded so the fit always settles.
  const ovs = (k: number) => (k >= 0.35 ? Math.min(1, Math.max(0.8, k / 0.62)) / k : 0.8 / 0.35);
  const ov = () => ovs(view.k);
  // Tiers run left to right (top to bottom on a phone); a pool of siblings steps down the floor's diagonal.
  // On a phone the spacing grows with the zoom so the tags and links between rows always have room.
  const pitch = { tier: 212, lane: 132 };
  const placeAt = ([t, l]: Place): Point => (narrow ? { x: l * pitch.lane, y: t * pitch.tier } : { x: t * 226 + l * 64, y: l * 104 });
  let focusList: string[] | undefined;
  const hasPill = (id: string, m = model) => { const n = m.nodes[id]; return !!(n.readout || n.meter != null) && !n.down; };

  for (const n of scene.nodes) {
    const g = el("g", { class: "node" }, gNodes);
    const lift = el("g", {}, g);
    el("ellipse", { class: "heat", cx: 0, cy: 2, rx: 88, ry: 45, fill: "url(#sk-heat)" }, lift);
    el("ellipse", { class: "soft", cx: 0, cy: 12, rx: 66, ry: 33, fill: "url(#sk-soft-shadow)" }, lift);
    const pk = el("g", { class: "pk" }, lift);
    pk.innerHTML = plinth(BASE, PH, 11);
    // where links plug into the base's front
    const ports = el("g", { class: "ports" }, pk);
    const art = el("g", { transform: `translate(0 ${-PH}) scale(${GLYPH})` }, pk);
    el("path", { class: "down-mark", d: "M-8 -8L8 8M8 -8L-8 8", transform: `translate(0 ${-topOf(n.role) - 6})` }, lift);
    // Outer groups carry position and fades; inner groups carry dimming, so the two never fight.
    const label = el("g", { class: "node-label" }, gLabels);
    const labelInner = el("g", {}, label);
    const tag = el("rect", { class: "tag", x: -40, y: 0, width: 80, height: 36, rx: 10 }, labelInner);
    const name = el("text", { class: "name", "text-anchor": "middle", y: 15 }, labelInner);
    const detail = el("text", { class: "detail", "text-anchor": "middle", y: 29 }, labelInner);
    const pill = el("g", { class: "pill is-off" }, gLabels);
    const pillInner = el("g", {}, pill);
    const pillBg = el("rect", { class: "pill-bg", x: -30, y: -22, width: 60, height: 22, rx: 11 }, pillInner);
    const barBg = el("rect", { class: "bar-bg", x: 0, y: -13.5, width: 24, height: 5, rx: 2.5 }, pillInner);
    const bar = el("rect", { class: "bar", x: 0, y: -13.5, width: 0, height: 5, rx: 2.5 }, pillInner);
    const pillText = el("text", { class: "pill-text", y: -7.2 }, pillInner);
    nodeEls[n.id] = { g, lift, pk, ports, portsKey: "", art, label, labelInner, tag, name, detail, pill, pillInner, pillBg, barBg, bar, pillText, opts: null, light: null };
    shown[n.id] = { visible: false, op: 0, sink: 0, lift: 0 };
  }
  for (const l of scene.links) linkEls.push({ a: l.from, b: l.to, unless: l.unless, path: el("path", { class: "link" }, gLinks), drawn: 0 });

  const wanted = new WeakMap<SVGTextElement, string>();
  function crossfadeText(t: SVGTextElement, value: string) {
    if ((wanted.get(t) ?? t.textContent) === value) return;
    wanted.set(t, value);
    if (typeof t.getAnimations === "function") for (const a of t.getAnimations()) a.cancel();
    if (reduce || !t.textContent || typeof t.animate !== "function") { t.textContent = value; return; }
    t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in" }).onfinish = () => {
      if (wanted.get(t) !== value) return;
      t.textContent = value;
      t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
    };
  }

  function renderNode(id: string) {
    const s = model.nodes[id], e = nodeEls[id], role = roleOf[id];
    const opts = fills(role) && s.meter != null ? { ...s.opts, level: s.meter, levelHot: s.tone === "hot" } : s.opts;
    const key = JSON.stringify(opts);
    if (e.opts !== key) { e.art.innerHTML = glyph(role, opts); e.opts = key; }
    e.pk.setAttribute("data-light", s.down ? "idle" : s.light);
    e.g.classList.toggle("is-down", s.down);
    e.g.classList.toggle("is-hot", s.tone === "hot" && !s.down);
    e.label.classList.toggle("is-down", s.down);
    crossfadeText(e.name, s.label);
    crossfadeText(e.detail, s.detail);
    e.detail.style.display = narrow ? "none" : "";
    const tw = Math.round(tagWidth(s));
    e.tag.setAttribute("x", String(-tw / 2)); e.tag.setAttribute("width", String(tw)); e.tag.setAttribute("height", String(tagHeight(s.detail)));
    const showPill = hasPill(id), wasOff = e.pill.classList.contains("is-off");
    e.pill.classList.toggle("is-off", !showPill);
    if (!showPill) { wanted.delete(e.pillText); e.pillText.textContent = ""; return; }
    if (wasOff) e.pillText.textContent = "";
    const withBar = s.meter != null && !narrow;
    const text = s.readout || `${Math.round((s.meter ?? 0) * 100)}%`;
    const w = Math.round(16 + (withBar ? 31 : 0) + text.length * 6.5);
    const x0 = narrow ? -w / 2 : 0; // over the part on a phone, beside it on a wide screen
    e.pillBg.setAttribute("x", String(x0)); e.pillBg.setAttribute("width", String(w));
    e.barBg.style.display = e.bar.style.display = withBar ? "" : "none";
    e.barBg.setAttribute("x", String(x0 + 9)); e.bar.setAttribute("x", String(x0 + 9));
    e.bar.setAttribute("width", String(withBar ? fmt(24 * Math.min(1, s.meter ?? 0)) : 0));
    e.pillText.setAttribute("x", String(withBar ? x0 + 39 : x0 + 8));
    crossfadeText(e.pillText, text);
    e.pill.setAttribute("data-tone", s.tone);
  }

  function placeNode(id: string) {
    const p = pos[id], sh = shown[id], e = nodeEls[id];
    if (!p) return;
    e.g.setAttribute("transform", `translate(${fmt(p.x)} ${fmt(p.y + sh.sink)})`);
    e.lift.setAttribute("transform", `translate(0 ${fmt(-sh.lift)})`);
    e.g.style.opacity = e.label.style.opacity = e.pill.style.opacity = String(sh.op);
    e.g.style.visibility = e.label.style.visibility = e.pill.style.visibility = sh.op > 0 ? "" : "hidden";
    const s = ov(), y = p.y + sh.sink - sh.lift, top = topOf(roleOf[id]);
    e.label.setAttribute("transform", `translate(${fmt(p.x)} ${fmt(y + BASE / 2 + PH - 4 - 6 * s)}) scale(${fmt(s)})`);
    e.pill.setAttribute("transform", narrow
      ? `translate(${fmt(p.x)} ${fmt(y - top - 6)}) scale(${fmt(s)})`
      : `translate(${fmt(p.x + 46)} ${fmt(y - top * 0.5)}) scale(${fmt(s)})`);
  }

  function setFocus(list: string[] | undefined) {
    focusList = list;
    for (const id of ids) {
      const dim = !!list && !list.includes(id);
      nodeEls[id].lift.classList.toggle("is-dim", dim);
      for (const x of [nodeEls[id].labelInner, nodeEls[id].pillInner]) x.classList.toggle("is-quiet", dim);
    }
    for (const L of linkEls) L.path.classList.toggle("is-dim", !!list && !(list.includes(L.a) && list.includes(L.b)));
  }

  // ---------- routes ----------
  // Links lie on the floor: they run along its axes into ports on the parts' bases (see routing.ts). Each link's shape
  // is chosen for where the parts will stand, then drawn for where they are, so a link keeps its shape while parts move.
  function measure(pts: Point[]): Route {
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, len, total: len[len.length - 1] };
  }
  function offset(rt: Route, off: number): Route {
    return measure(rt.pts.map((p, i) => {
      const a = rt.pts[Math.max(0, i - 1)], b = rt.pts[Math.min(rt.pts.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
      return { x: p.x - (dy / l) * off, y: p.y + (dx / l) * off };
    }));
  }
  function at(rt: Route, s: number): Point {
    s = Math.max(0, Math.min(rt.total, s));
    let i = 1;
    while (i < rt.len.length - 1 && rt.len[i] < s) i++;
    const s0 = rt.len[i - 1], s1 = rt.len[i], t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    const a = rt.pts[i - 1], b = rt.pts[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  /** The route from its start to `f` of the way along, leaving out the stretches in `gaps` (where another link crosses over). */
  function partial(rt: Route, f: number, gaps: [number, number][] = []) {
    const end = rt.total * Math.max(0, Math.min(1, f));
    const cuts = [0, ...gaps.flat().filter((c) => c > 0 && c < end), end].sort((a, b) => a - b);
    let d = "";
    for (let k = 0; k < cuts.length - 1; k++) {
      const s0 = cuts[k], s1 = cuts[k + 1], mid = (s0 + s1) / 2;
      if (s1 - s0 < 0.01 || gaps.some(([a, b]) => mid > a && mid < b)) continue;
      const pts = [at(rt, s0)];
      for (let i = 1; i < rt.pts.length - 1; i++) if (rt.len[i] > s0 && rt.len[i] < s1) pts.push(rt.pts[i]);
      pts.push(at(rt, s1));
      d += "M" + pts.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join("L");
    }
    return d;
  }
  /** Where along a route a point lies (the nearest place on it). */
  function along(rt: Route, p: Point): number {
    let best = 0, bestD = Infinity;
    for (let i = 1; i < rt.pts.length; i++) {
      const a = rt.pts[i - 1], b = rt.pts[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      const d = Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
      if (d < bestD) { bestD = d; best = rt.len[i - 1] + (rt.len[i] - rt.len[i - 1]) * t; }
    }
    return best;
  }

  /** A part as the router sees it: where it stands, how tall it is, and where its tag and load pill sit. */
  function routeNode(id: string, p: Point, m: StageModel, s: number): RouteNode {
    const n = m.nodes[id], top = topOf(roleOf[id]);
    const tw = Math.round(tagWidth(n)) * s, ty = p.y + BASE / 2 + PH - 4 - 6 * s;
    let pill: Rect | undefined;
    if (hasPill(id, m)) {
      const pw = pillWidth(n) * s;
      pill = narrow
        ? { x0: p.x - pw / 2, y0: p.y - top - 6 - 22 * s, x1: p.x + pw / 2, y1: p.y - top - 6 }
        : { x0: p.x + 46, y0: p.y - top * 0.5 - 22 * s, x1: p.x + 46 + pw, y1: p.y - top * 0.5 };
    }
    return { id, at: p, top, tag: { x0: p.x - tw / 2, y0: ty, x1: p.x + tw / 2, y1: ty + tagHeight(n.detail) * s }, tagRound: 10 * s, pill };
  }
  const gapAt = (s: number) => 8 * s;
  /** Routes for the links in `list` with every visible part of `m` standing where `place` says. */
  function routesFor(m: StageModel, list: LinkEl[], place: (id: string) => Point | undefined, s: number, force?: Map<number, string>, rough = false) {
    const nodes: RouteNode[] = [];
    for (const id of ids) { const p = place(id); if (p && (m.nodes[id].visible || shown[id].visible)) nodes.push(routeNode(id, p, m, s)); }
    const links = list.map((L) => ({ id: linkEls.indexOf(L), a: L.a, b: L.b, quiet: !!focusList && !(focusList.includes(L.a) && focusList.includes(L.b)) }));
    return { nodes, links, run: () => routeLinks(nodes, links, { narrow, gap: gapAt(s), force, rough }) };
  }
  type Drawn = { rt: Route; gaps: [number, number][]; from: Face; to: Face; pts: Point[] };
  let drawnRoutes = new Map<LinkEl, Drawn>(), drawnKey = "", planKey = "";
  let plan = new Map<number, string>();
  function currentRoutes(): Map<LinkEl, Drawn> {
    const live = linkEls.filter((L) => pos[L.a] && pos[L.b] && (linkWanted(L) || (L.drawn > 0 && shown[L.a].visible && shown[L.b].visible)));
    // the shapes come from where the parts are headed, at the zoom the camera is headed for
    const sGoal = ovs(heading?.k ?? view.k);
    const goal = routesFor(model, live, (id) => (pos[id] ? placeAt(model.nodes[id].at) : undefined), sGoal);
    const gk = JSON.stringify([goal.nodes, goal.links, narrow, fmt(sGoal)]);
    if (gk !== planKey) { planKey = gk; plan = new Map(goal.run().map((r) => [r.id, r.shape])); }
    const s = ov(), now = routesFor(model, live, (id) => pos[id], s, plan);
    const key = JSON.stringify([now.nodes, now.links, narrow, fmt(s), planKey]);
    if (key === drawnKey) return drawnRoutes;
    drawnKey = key;
    drawnRoutes = new Map();
    const g = 3.5 * s;
    for (const r of now.run()) {
      const rt = measure(rounded(r.pts, 12 * s));
      drawnRoutes.set(linkEls[r.id], { rt, gaps: r.under.map((x) => { const a = along(rt, x); return [a - g, a + g] as [number, number]; }), from: r.from, to: r.to, pts: r.pts });
    }
    return drawnRoutes;
  }
  function route(a: string, b: string): Route {
    const L = linkEls.find((l) => l.a === a && l.b === b);
    const known = L && currentRoutes().get(L);
    if (known) return known.rt;
    // a message between two parts with no link drawn between them
    const parts = routesFor(model, [], (id) => pos[id], ov()).nodes;
    const r = routeLinks(parts, [{ id: -1, a, b }], { narrow, gap: gapAt(ov()) })[0];
    return measure(rounded(r ? r.pts : [pos[a], pos[b]], 12 * ov()));
  }
  /** One hop of a message, on its own lane so a request and its reply never overlap. */
  function hop(a: string, b: string): Route {
    const link = scene.links.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
    const base = link ? route(link.from, link.to) : route(a, b);
    return offset(!link || link.from === a ? base : measure([...base.pts].reverse()), 3 * ov());
  }

  const linkWanted = (L: LinkEl, m = model) => m.nodes[L.a].visible && m.nodes[L.b].visible && !(L.unless && m.nodes[L.unless].visible);
  function updateLinks() {
    const routes = currentRoutes();
    const ports: Record<string, string[]> = {};
    for (const L of linkEls) {
      const r = routes.get(L);
      const on = L.drawn > 0 && shown[L.a].visible && shown[L.b].visible && !!r;
      L.path.style.display = on ? "" : "none";
      if (!on || !r) continue;
      L.path.classList.toggle("is-down", model.nodes[L.a].down || model.nodes[L.b].down);
      L.path.setAttribute("d", partial(r.rt, L.drawn, r.gaps));
      L.path.style.opacity = String(Math.min(shown[L.a].op, shown[L.b].op));
      // a port shows once its link has reached it
      const slot = (id: string, face: Face, p: Point) => { const q = portSlot(face, p, pos[id]); if (q) (ports[id] ??= []).push(q); };
      if (isFront(r.from)) slot(L.a, r.from, r.pts[0]);
      if (L.drawn >= 1 && isFront(r.to)) slot(L.b, r.to, r.pts[r.pts.length - 1]);
    }
    for (const id of ids) {
      const e = nodeEls[id], key = (ports[id] ?? []).join("|");
      if (key === e.portsKey) continue;
      e.portsKey = key;
      e.ports.innerHTML = (ports[id] ?? []).map((q) => `<polygon class="port" points="${q}"/>`).join("");
    }
  }

  function ring(p: Point, kind: "plain" | "work" | "hot" = "plain", big = false) {
    if (reduce) return;
    const r = el("ellipse", { class: `ring k-${kind}`, cx: fmt(p.x), cy: fmt(p.y + 4), rx: 40, ry: 20 }, gRings);
    const r0 = big ? 50 : 38, r1 = big ? 78 : 58;
    realtime(big ? 1200 : 520, (q) => {
      const rr = r0 + (r1 - r0) * easeOut(q);
      r.setAttribute("rx", String(fmt(rr))); r.setAttribute("ry", String(fmt(rr / 2)));
      r.style.opacity = String((1 - q) * 0.7);
    }).then(() => r.remove());
  }
  const ringKind = (kind: FlowKind | undefined) => (kind === "response" || kind === "work" ? "work" : kind === "hot" ? "hot" : "plain");

  // ---------- the choreography: leave, move, arrive, then draw the links ----------
  async function transitionTo(target: StageModel, tk: Token, instant = false) {
    const before = Object.fromEntries(ids.map((id) => [id, { visible: shown[id].visible, at: pos[id] ? { ...pos[id] } : null }]));
    model = target;
    const goal = Object.fromEntries(ids.map((id) => [id, placeAt(model.nodes[id].at)]));
    const exits = ids.filter((id) => before[id].visible && !model.nodes[id].visible);
    const enters = ids.filter((id) => !before[id].visible && model.nodes[id].visible);
    const moves = ids.filter((id) => before[id].visible && model.nodes[id].visible && before[id].at && Math.hypot(before[id].at!.x - goal[id].x, before[id].at!.y - goal[id].y) > 0.5);
    const lightOf = (id: string) => (model.nodes[id].down ? "down" : model.nodes[id].light);
    const changed = ids.filter((id) => model.nodes[id].visible && nodeEls[id].light && nodeEls[id].light !== lightOf(id));
    for (const id of ids) { renderNode(id); nodeEls[id].light = lightOf(id); }
    // whatever an interrupted transition left half-done is settled here
    for (const id of ids) if (!enters.includes(id) && !exits.includes(id)) Object.assign(shown[id], model.nodes[id].visible ? { visible: true, op: 1, sink: 0, lift: 0 } : { visible: false, op: 0, sink: 0, lift: 0 });
    for (const L of linkEls) if (!linkWanted(L)) L.drawn = 0;

    if (instant || reduce) {
      for (const id of ids) {
        pos[id] = goal[id];
        Object.assign(shown[id], { visible: model.nodes[id].visible, op: model.nodes[id].visible ? 1 : 0, sink: 0, lift: 0 });
        placeNode(id);
      }
      for (const L of linkEls) L.drawn = linkWanted(L) ? 1 : 0;
      updateLinks();
      return;
    }
    const ringChanged = () => {
      for (const id of changed) {
        if (enters.includes(id) || lightOf(id) === "idle" || (focusList && !focusList.includes(id))) continue;
        ring(goal[id], model.nodes[id].tone === "hot" ? "hot" : "plain", true);
      }
    };
    if (!moves.length) ringChanged();
    for (const L of linkEls) if (L.drawn && (exits.includes(L.a) || exits.includes(L.b) || !linkWanted(L))) L.drawn = 0;
    if (exits.length) {
      await tween(T.exit, tk, (p) => { for (const id of exits) { shown[id].op = 1 - easeOut(p); shown[id].sink = 22 * easeIn(p); placeNode(id); } updateLinks(); });
      for (const id of exits) Object.assign(shown[id], { visible: false, sink: 0 });
    }
    if (moves.length) {
      const from = Object.fromEntries(moves.map((id) => [id, { ...pos[id] }]));
      await tween(T.move, tk, (p) => {
        const q = easeInOut(p);
        for (const id of moves) { pos[id] = { x: from[id].x + (goal[id].x - from[id].x) * q, y: from[id].y + (goal[id].y - from[id].y) * q }; placeNode(id); }
        updateLinks();
      });
    }
    for (const id of ids) pos[id] = goal[id];
    if (moves.length) ringChanged();
    if (enters.length) {
      enters.sort((a, b) => goal[a].y - goal[b].y || goal[a].x - goal[b].x);
      for (const id of enters) { Object.assign(shown[id], { visible: true, op: 0, lift: 70, sink: 0 }); placeNode(id); }
      await Promise.all(enters.map((id, i) => after(i * T.stagger, tk).then(() => {
        let rung = false;
        return tween(T.enter, tk, (p) => {
          shown[id].lift = 70 * (1 - backOut(p));
          shown[id].op = Math.min(1, p * 2.4);
          if (!rung && p > 0.62) { rung = true; ring(pos[id], "plain", true); }
          placeNode(id);
        });
      })));
    }
    for (const id of ids) placeNode(id);
    const fresh = linkEls.filter((L) => linkWanted(L) && L.drawn < 1);
    await Promise.all(fresh.map((L, i) => after(i * T.linkStagger, tk).then(() => tween(T.draw, tk, (p) => { L.drawn = Math.max(0.001, easeInOut(p)); updateLinks(); }))));
    updateLinks();
  }

  // ---------- the camera only moves when the next scene doesn't already fit ----------
  const tagWidth = (n: { label: string; detail: string }) => Math.max(n.label.length * 7.4, narrow ? 0 : n.detail.length * 6.2) + 22;
  const pillWidth = (n: { readout: string; meter: number | null }) => 16 + (n.meter != null && !narrow ? 31 : 0) + (n.readout || `${Math.round((n.meter ?? 0) * 100)}%`).length * 6.5;
  function bounds(list: string[], m: StageModel, k: number, notes: Set<string> = new Set()) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const s = ovs(k);
    for (const id of list) {
      const n = m.nodes[id];
      if (!n.visible) continue;
      const p = placeAt(n.at), pill = hasPill(id, m);
      const half = Math.max(52, (tagWidth(n) / 2) * s);
      x0 = Math.min(x0, p.x - half); x1 = Math.max(x1, p.x + half);
      if (!narrow && pill) x1 = Math.max(x1, p.x + 46 + pillWidth(n) * s);
      y0 = Math.min(y0, p.y - topOf(roleOf[id]) - 10 - (narrow && pill ? 26 * s : 0) - (notes.has(id) ? 34 * s : 0) - (n.down ? 16 : 0));
      y1 = Math.max(y1, p.y + BASE / 2 + PH + (tagHeight(n.detail) - 2) * s);
    }
    // links can run out past the parts, below a row or around one
    const inList = new Set(list), live = linkEls.filter((L) => linkWanted(L, m) && inList.has(L.a) && inList.has(L.b));
    const r = isFinite(x0) && live.length ? routeBox(m, live, s) : null;
    if (r) { x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); y0 = Math.min(y0, r.y0); y1 = Math.max(y1, r.y1); }
    return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: -100, y0: -100, x1: 100, y1: 100 };
  }
  // The camera tries several zooms for each step, so the links' extent is kept for each layout and (rounded) zoom.
  const routeBoxes = new Map<string, Rect | null>();
  function routeBox(m: StageModel, live: LinkEl[], s: number): Rect | null {
    const q = Math.round(s * 20) / 20;
    const run = routesFor(m, live, (id) => (m.nodes[id].visible ? placeAt(m.nodes[id].at) : undefined), q, undefined, true);
    const key = JSON.stringify([run.nodes, run.links.map((l) => l.id), narrow, q]);
    if (!routeBoxes.has(key)) {
      if (routeBoxes.size > 64) routeBoxes.clear();
      let box: Rect | null = null;
      for (const r of run.run()) for (const p of r.pts) {
        box = box ?? { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        box = { x0: Math.min(box.x0, p.x - 6), y0: Math.min(box.y0, p.y - 6), x1: Math.max(box.x1, p.x + 6), y1: Math.max(box.y1, p.y + 6) };
      }
      routeBoxes.set(key, box);
    }
    return routeBoxes.get(key)!;
  }
  const pads = () => ({ x: narrow ? 14 : 40, top: narrow ? 76 : 72, bottom: 84 });
  /** What a phone needs between rows and columns at zoom k: the tallest part, its tag, its pill and a clear stretch of link. */
  function pitchFor(list: string[], models: StageModel[], k: number, notes: Set<string>) {
    const s = ovs(k);
    let top = 0, tag = 22, pill = false, note = false, wide = 0;
    const rows = new Map<number, string[]>();
    for (const m of models) for (const id of list) {
      const n = m.nodes[id];
      if (!n.visible) continue;
      top = Math.max(top, topOf(roleOf[id]));
      tag = Math.max(tag, tagHeight(n.detail));
      pill = pill || hasPill(id, m);
      note = note || notes.has(id);
      const row = Math.round(n.at[0] * 10);
      rows.set(row, [...(rows.get(row) ?? []), id]);
    }
    // columns only need to clear the tags and pills of parts that share a row
    for (const m of models) for (const row of rows.values()) {
      if (row.length < 2) continue;
      for (const id of row) { const n = m.nodes[id]; if (n.visible) wide = Math.max(wide, tagWidth(n), hasPill(id, m) ? pillWidth(n) : 0); }
    }
    return {
      tier: Math.max(212, top + 16 + BASE / 2 + PH + (tag + 14 + (pill ? 26 : 0) + (note ? 28 : 0) + 10) * s),
      lane: Math.max(132, (wide + 14) * s),
    };
  }
  function fit(list: string[], m: StageModel, also?: StageModel, notes: Set<string> = new Set()) {
    const r = host.getBoundingClientRect();
    view.W = Math.max(1, r.width); view.H = Math.max(1, r.height);
    const pd = pads(), uw = view.W - pd.x * 2, uh = view.H - pd.top - pd.bottom;
    const span = (k: number) => {
      const a = bounds(list, m, k, notes);
      if (!also) return a;
      const b = bounds(list, also, k, notes);
      return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
    };
    const saved = { ...pitch };
    let k = 1, b = span(k), next = { ...pitch };
    for (let pass = 0; pass < 5; pass++) {
      if (narrow) { next = pitchFor(list, also ? [m, also] : [m], k, notes); Object.assign(pitch, next); }
      b = span(k);
      k = Math.min(uw / (b.x1 - b.x0), uh / (b.y1 - b.y0), narrow ? 1.15 : 1.3);
    }
    if (narrow) { next = pitchFor(list, also ? [m, also] : [m], k, notes); Object.assign(pitch, next); }
    // with the spacing settled, fit the zoom to it once more so nothing is cut off
    b = span(k);
    k = Math.min(uw / (b.x1 - b.x0), uh / (b.y1 - b.y0), narrow ? 1.15 : 1.3);
    b = span(k);
    Object.assign(pitch, saved);
    return { k, x: (b.x0 + b.x1) / 2 - view.W / 2 / k, y: (b.y0 + b.y1) / 2 - (pd.top + uh / 2) / k, b, pitch: next };
  }
  function setView(v: { k: number; x: number; y: number }) {
    view.k = v.k; view.x = v.x; view.y = v.y; view.w = view.W / v.k; view.h = view.H / v.k;
    svg.setAttribute("viewBox", `${fmt(view.x)} ${fmt(view.y)} ${fmt(view.w)} ${fmt(view.h)}`);
    for (const id of ids) placeNode(id);
    for (const o of overlays) o.place(ov());
    updateLinks();
    const pd = pads();
    for (const id of ids) {
      const p = pos[id];
      if (!p) continue;
      const top = (p.y - topOf(roleOf[id]) - view.y) * view.k, bottom = (p.y + BASE / 2 + PH - view.y) * view.k + tagHeight(model.nodes[id].detail);
      const half = Math.max(50 * view.k, (tagWidth(model.nodes[id]) / 2) * view.k * ov());
      const left = (p.x - view.x) * view.k - half, right = (p.x - view.x) * view.k + half;
      const out = narrow && !!focusList && !focusList.includes(id) && (top < pd.top - 6 || bottom > view.H - pd.bottom + 6 || left < 0 || right > view.W);
      for (const x of [nodeEls[id].lift, nodeEls[id].labelInner, nodeEls[id].pillInner]) x.classList.toggle("is-out", out);
    }
  }
  let camRun = 0;
  let heading: { k: number; x: number; y: number } | null = null;
  function cameraTo(list: string[] | null | undefined, m: StageModel, instant = false, also?: StageModel, notes?: Set<string>) {
    const target = fit(list && list.length ? list : ids, m, also, notes);
    const repitched = narrow && (Math.abs(target.pitch.tier - pitch.tier) > 1 || Math.abs(target.pitch.lane - pitch.lane) > 1);
    Object.assign(pitch, target.pitch);
    if (!instant && !repitched) {
      const v = heading ?? view, pd = pads(), b = target.b;
      const inside = b.x0 >= v.x + pd.x / v.k && b.x1 <= v.x + (view.W - pd.x) / v.k && b.y0 >= v.y + pd.top / v.k && b.y1 <= v.y + (view.H - pd.bottom) / v.k;
      if (inside && v.k / target.k > 0.84 && v.k / target.k < 1.2) return;
    }
    const run = ++camRun;
    heading = { k: target.k, x: target.x, y: target.y };
    if (instant || reduce) { setView(target); heading = null; return; }
    const start = { k: view.k, x: view.x, y: view.y };
    realtime(T.camera, (p) => {
      if (run !== camRun) return;
      const q = easeInOut(p);
      setView({ k: 1 / (1 / start.k + (1 / target.k - 1 / start.k) * q), x: start.x + (target.x - start.x) * q, y: start.y + (target.y - start.y) * q });
      if (p >= 1) heading = null;
    });
  }

  // ---------- messages, notes and streams ----------
  type Overlay = { place(s: number): void };
  const overlays = new Set<Overlay>();
  const streams = new Set<() => void>();
  function clearTransient() {
    for (const g of [gTrails, gStreamTrails, gPackets, gNotes, gDots, gRings]) g.innerHTML = "";
    resting = [];
    overlays.clear();
    for (const stop of streams) stop();
    streams.clear();
  }
  function trail(rt: Route, kind: FlowKind, group: SVGGElement = gTrails) {
    const p = el("path", { class: `trail k-${kind}`, d: "" }, group);
    return (f: number) => p.setAttribute("d", f <= 0 ? "" : partial(rt, f));
  }
  const pillW = (label: string, dot: boolean) => Math.round((dot ? 26 : 16) + label.length * 6.3);
  function pillMarkup(g: SVGGElement, label: string, dot: boolean) {
    const w = pillW(label, dot);
    el("rect", { x: -w / 2, y: -11, width: w, height: 22, rx: 11 }, g);
    if (dot) el("circle", { cx: -w / 2 + 10, cy: 0, r: 2.8 }, g);
    const t = el("text", { x: dot ? 5 : 0, y: 3.8, "text-anchor": "middle" }, g);
    t.textContent = label;
  }
  function packet(label: string, kind: FlowKind) {
    const g = el("g", { class: `packet k-${kind}` }, gPackets);
    pillMarkup(g, label, kind !== "request");
    const o = { x: 0, y: 0, sc: 1, op: 1, place(s: number) { g.setAttribute("transform", `translate(${fmt(o.x)} ${fmt(o.y - 16 * s)}) scale(${fmt(s * o.sc)})`); g.style.opacity = String(o.op); } };
    overlays.add(o);
    return { g, o, remove() { overlays.delete(o); g.remove(); } };
  }
  /** How far above a part's base its note floats. */
  const noteUp = (id: string, s: number) => topOf(roleOf[id]) + 10 + (narrow && hasPill(id) ? 30 * s : 0) + (model.nodes[id].down ? 16 : 0) + 14 * s;
  /** Where the current step's notes on a part sit, played or not yet. */
  function noteBoxes(id: string): Rect[] {
    if (cur < 0) return [];
    const s = ov(), p = pos[id], y = p.y - noteUp(id, s);
    return stepEvents(scene, cur, choices).flatMap((e) => {
      if (e.type !== "note" || e.node !== id) return [];
      const w = (pillW(e.text, !!e.tone) / 2) * s;
      return [{ x0: p.x - w, y0: y - 11 * s, x1: p.x + w, y1: y + 11 * s }];
    });
  }
  function note(id: string, text: string, tone?: "work" | "hot") {
    const g = el("g", { class: `note t-${tone ?? "plain"}` }, gNotes);
    const inner = el("g", {}, g);
    pillMarkup(inner, text, !!tone);
    const o = {
      place(s: number) {
        const p = pos[id];
        g.setAttribute("transform", `translate(${fmt(p.x)} ${fmt(p.y - noteUp(id, s))}) scale(${fmt(s)})`);
      },
    };
    overlays.add(o); o.place(ov());
    if (!reduce && typeof inner.animate === "function") inner.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" });
  }
  function bob(id: string) {
    if (reduce || typeof nodeEls[id].pk.animate !== "function") return;
    nodeEls[id].pk.animate([{ transform: "translateY(0)" }, { transform: "translateY(-4px)" }, { transform: "translateY(0)" }], { duration: 340, easing: "ease-out" });
  }
  function lostMark(p: Point, kind: FlowKind = "hot") {
    const g = el("g", { class: `lost-mark k-${kind === "hot" ? "hot" : "quiet"}` }, gNotes);
    const burst = el("circle", { r: 10, class: "burst" }, g);
    el("path", { d: "M-5 -5L5 5M5 -5L-5 5" }, g);
    const o = { place(s: number) { g.setAttribute("transform", `translate(${fmt(p.x)} ${fmt(p.y)}) scale(${fmt(s)})`); } };
    overlays.add(o); o.place(ov());
    if (reduce) burst.style.opacity = "0";
    else realtime(650, (q) => { burst.setAttribute("r", String(fmt(4 + 16 * easeOut(q)))); burst.style.opacity = String(0.8 * (1 - q)); });
  }
  /** How far along a hop a message pill can go, or where it can start, without covering the part at that end. */
  /** A part and everything drawn on it: its base and the part above, its tag, load pill and the step's notes. */
  function partBoxes(id: string): Rect[] {
    const s = ov(), p = pos[id], n = routeNode(id, p, model, s), w = HALF_BASE_W;
    return [{ x0: p.x - w, y0: p.y - n.top - 4, x1: p.x + w, y1: p.y + BASE / 2 + 2 }, n.tag, ...(n.pill ? [n.pill] : []), ...noteBoxes(id)];
  }
  /** The box a message pill covers when it rides at `d` along a route. */
  function pillBox(rt: Route, d: number, label: string, kind: FlowKind): Rect {
    const s = ov(), q = at(rt, d), hw = (pillW(label, kind !== "request") / 2) * s + 4, hh = 11 * s + 3, cy = q.y - 16 * s;
    return { x0: q.x - hw, y0: cy - hh, x1: q.x + hw, y1: cy + hh };
  }
  const meets = (a: Rect, b: Rect) => a.x1 > b.x0 && a.x0 < b.x1 && a.y1 > b.y0 && a.y0 < b.y1;
  /** How far along a hop a message pill can go, or where it can start, without covering the part at that end. */
  function clearOf(rt: Route, id: string, label: string, kind: FlowKind, arriving: boolean): number {
    const keepOff = partBoxes(id);
    const clear = (d: number) => { const b = pillBox(rt, d, label, kind); return !keepOff.some((r) => meets(b, r)); };
    const step = 3;
    if (arriving) { for (let d = rt.total; d > rt.total * 0.45; d -= step) if (clear(d)) return d; return rt.total * 0.45; }
    for (let d = 0; d < rt.total * 0.45; d += step) if (clear(d)) return d;
    return rt.total * 0.45;
  }
  async function runPacket(e: PacketEvent, tk: Token) {
    const kind = e.kind ?? "request";
    let pk: ReturnType<typeof packet> | null = null;
    try {
      for (let h = 0; h < e.path.length - 1; h++) {
        const from = e.path[h], to = e.path[h + 1];
        const rt = hop(from, to);
        const draw = trail(rt, kind);
        const last = h === e.path.length - 2;
        // The pill rides between the two parts and stops short of the one it reaches; its trail runs port to port.
        const s0 = clearOf(rt, from, e.label, kind, false);
        const s1 = Math.max(s0, e.lost && last ? rt.total * 0.58 : clearOf(rt, to, e.label, kind, true));
        draw(s0 / rt.total);
        pk = packet(e.label, kind);
        const p0 = at(rt, s0);
        pk.o.x = p0.x; pk.o.y = p0.y; pk.o.sc = 0; pk.o.place(ov());
        const ride = pk;
        await tween(Math.max(160, (s1 - s0) / SPEED), tk, (p) => {
          const q = s0 + (s1 - s0) * easeInOut(p), pt = at(rt, q);
          ride.o.x = pt.x; ride.o.y = pt.y;
          ride.o.sc = backOut(Math.min(1, p * 3.5));
          draw(q / rt.total); ride.o.place(ov());
        });
        if (e.lost && last) {
          await tween(380, tk, (p) => { ride.o.op = 1 - p; ride.o.sc = 1 - p * 0.3; ride.o.place(ov()); });
          lostMark(at(rt, s1), kind);
          return;
        }
        // it hands over: the pill goes as the trail reaches the port, and the part takes it
        await tween(180, tk, (p) => { ride.o.sc = 1 - 0.35 * p; ride.o.op = 1 - p; ride.o.place(ov()); draw((s1 + (rt.total - s1) * p) / rt.total); });
        ride.remove(); pk = null;
        bob(to); ring(pos[to], ringKind(kind));
        if (!last) await after(T.hop, tk);
      }
    } finally { pk?.remove(); }
  }
  // Messages resting on the stage (reduced motion), so the next one rests clear of them.
  let resting: Rect[] = [];
  function placePacket(e: PacketEvent, lossOnly = false) {
    if (lossOnly && !e.lost) return;
    // Reduced motion: the route is drawn and the message rests short of where it arrives.
    let last: { rt: Route; reach: number; from: string; to: string } | null = null;
    for (let h = 0; h < e.path.length - 1; h++) {
      const rt = hop(e.path[h], e.path[h + 1]);
      const reach = e.lost && h === e.path.length - 2 ? 0.58 : 1;
      trail(rt, e.kind ?? "request")(reach);
      last = { rt, reach, from: e.path[h], to: e.path[h + 1] };
    }
    if (!last) return;
    if (e.lost) { lostMark(at(last.rt, last.rt.total * last.reach), e.kind ?? "request"); return; }
    const kind = e.kind ?? "request", pk = packet(e.label, kind), rt = last.rt;
    // as near its part as it can rest clear of both parts, their notes and the messages already resting
    const avoid = [...partBoxes(last.to), ...partBoxes(last.from), ...resting];
    const near = Math.min(rt.total * 0.7, clearOf(rt, last.to, e.label, kind, true));
    // where nothing is clear, the place that covers least of the others
    const covered = (b: Rect) => avoid.reduce((sum, r) => sum + Math.max(0, Math.min(b.x1, r.x1) - Math.max(b.x0, r.x0)) * Math.max(0, Math.min(b.y1, r.y1) - Math.max(b.y0, r.y0)), 0);
    let d = near, least = Infinity;
    for (let t = near; t > rt.total * 0.2; t -= 3) {
      const c = covered(pillBox(rt, t, e.label, kind));
      if (c < least - 1) { least = c; d = t; }
      if (c === 0) break;
    }
    resting.push(pillBox(rt, d, e.label, kind));
    const end = at(rt, d);
    pk.o.x = end.x; pk.o.y = end.y; pk.o.place(ov());
  }
  function startStream(e: StreamEvent) {
    for (const stop of streams) stop();
    streams.clear();
    gStreamTrails.innerHTML = "";
    const routes = e.routes.map((r) => ({ ...r, w: r.w ?? 1, acc: 0, hops: r.path.slice(0, -1).map((a, i) => hop(a, r.path[i + 1])) }));
    for (const r of [...routes].sort((a, b) => a.w - b.w)) r.hops.forEach((rt) => trail(rt, r.kind ?? "request", gStreamTrails)(1));
    if (reduce) {
      for (const r of routes) for (const rt of r.hops) for (const f of [0.3, 0.7]) {
        const p = at(rt, rt.total * f);
        el("circle", { class: `dot k-${r.kind ?? "request"}`, cx: fmt(p.x), cy: fmt(p.y), r: fmt(3.6 * ov()) }, gDots);
      }
      return;
    }
    const total = routes.reduce((s, r) => s + r.w, 0);
    type Dot = { g: SVGGElement; parts: SVGCircleElement[]; r: (typeof routes)[number]; s: number; len: number };
    const live = new Set<Dot>();
    let t = 0, next = 0;
    const f: Frame = (dt) => {
      if (stopped()) return;
      t += dt;
      if (t >= next) {
        next = t + (e.every ?? 300);
        let best = routes[0];
        for (const r of routes) { r.acc += r.w; if (r.acc > best.acc) best = r; }
        best.acc -= total;
        const g = el("g", { class: `dot k-${best.kind ?? "request"}` }, gDots);
        live.add({ g, parts: [0.22, 0.45, 1].map((o) => el("circle", { opacity: o }, g)), r: best, s: 0, len: best.hops.reduce((a, h) => a + h.total, 0) });
      }
      for (const d of [...live]) {
        d.s += dt * SPEED * 1.3;
        if (d.s > d.len) {
          d.g.remove(); live.delete(d);
          if (Math.random() < 0.3) ring(pos[d.r.path[d.r.path.length - 1]], ringKind(d.r.kind));
          continue;
        }
        [-16, -8, 0].forEach((off, i) => {
          let s = Math.max(0, d.s + off), h = 0;
          while (h < d.r.hops.length - 1 && s > d.r.hops[h].total) { s -= d.r.hops[h].total; h++; }
          const p = at(d.r.hops[h], s), c = d.parts[i];
          c.setAttribute("cx", String(fmt(p.x))); c.setAttribute("cy", String(fmt(p.y))); c.setAttribute("r", String(fmt([2, 2.8, 3.8][i] * ov())));
        });
      }
    };
    addMine(f);
    streams.add(() => { dropMine(f); for (const d of live) d.g.remove(); });
  }

  async function runEvent(e: StageEvent, tk: Token): Promise<void> {
    if (e.type === "packet") return reduce ? placePacket(e) : runPacket(e, tk);
    if (e.type === "note") return note(e.node, e.text, e.tone);
    if (e.type === "stream") return startStream(e);
    if (e.type === "pause") return reduce ? undefined : after(e.ms, tk);
    const next = cloneModel(model);
    applyEvent(next, e);
    await transitionTo(next, tk);
  }

  // ---------- steps ----------
  const frameOf = (index: number) => { const st = steps[index]; return st ? st.frame ?? (narrow ? st.focus : undefined) : undefined; };
  async function runEvents(events: StageEvent[], tk: Token) {
    const pending: Promise<void>[] = [];
    for (const e of events) {
      if (!e.with && pending.length) { await Promise.all(pending.splice(0)); if (!reduce) await after(e.gap ?? 320, tk); }
      const p = runEvent(e, tk);
      if (p) pending.push(p);
    }
    await Promise.all(pending);
  }
  /** Put back what a played step leaves on screen, without replaying it: its notes and its ongoing traffic. */
  function settleExtras(i: number) {
    let stream: StreamEvent | null = null;
    for (const e of stepEvents(scene, i, choices)) {
      if (e.type === "note") note(e.node, e.text, e.tone);
      else if (e.type === "stream") stream = e;
      else if (e.type === "packet" && (reduce || e.lost)) placePacket(e, !reduce);
    }
    if (stream) startStream(stream);
  }
  const notesOf = (i: number) => new Set(stepEvents(scene, i, choices).flatMap((e) => (e.type === "note" ? [e.node] : [])));
  async function runStep(i: number, tk: Token) {
    cur = i; ended = false; settled = false;
    clearTransient();
    report();
    setFocus(steps[i].focus);
    const start = stateBefore(scene, i, choices), end = stateBefore(scene, i + 1, choices);
    // frame where the step starts and where it ends, so nothing moving in from outside is cut off
    cameraTo(frameOf(i), end, false, start, notesOf(i));
    await transitionTo(start, tk);
    await after(reduce ? 0 : 260, tk);
    await runEvents(stepEvents(scene, i, choices), tk);
    settled = true;
    cameraTo(frameOf(i), end, false, undefined, notesOf(i));
    report();
  }
  // Long enough to read the step and what it changed while watching it: about 240 words a minute.
  const holdFor = (i: number) => Math.max(3000, Math.min(13000, 1000 + steps[i].text.split(/\s+/).length * 220 + (steps[i].changes?.length ?? 0) * 500));

  async function go(i: number, auto: boolean) {
    hold = 0;
    token.dead = true;
    const tk = (token = { dead: false });
    setPaused(false); autoPlay = auto; looping = true;
    report();
    try {
      for (let s = i; s < steps.length; s++) {
        await runStep(s, tk);
        if (!autoPlay) break;
        if (s === steps.length - 1) { ended = true; break; }
        // a step with a control waits for the learner to try it
        if (steps[s].control) { autoPlay = false; break; }
        hold = holdFor(s); report();
        await after(hold, tk);
        hold = 0;
        if (!autoPlay) break;
      }
    } catch (err) { swallow(err); return; }
    if (tk === token) { looping = false; if (ended) autoPlay = false; report(); }
  }
  function report() {
    if (!destroyed) options.onStatus?.({ step: cur, total: steps.length, playing: autoPlay && !clock.paused, paused: clock.paused, ended, settled, hold: autoPlay ? hold : 0 });
  }

  // Nothing moves while the stage is off screen.
  const visibility = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => { clock.offscreen = !entries[entries.length - 1].isIntersecting; syncFrames(); }, { threshold: 0.05 })
    : null;
  visibility?.observe(host);
  let resizeTimer = 0;
  const resize = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { if (!destroyed) handle.resize(); }, 120); })
    : null;

  const handle = {
    play() {
      if (ended || cur === -1) { void go(ended ? 0 : Math.max(0, cur), true); return; }
      autoPlay = true; setPaused(false);
      if (!looping) void go(cur + 1 < steps.length ? cur + 1 : 0, true); else report();
    },
    pause() { autoPlay = false; setPaused(true); report(); },
    toggle() { if (autoPlay && !clock.paused) handle.pause(); else handle.play(); },
    next() { if (cur < steps.length - 1) void go(cur + 1, autoPlay && !clock.paused); },
    back() { if (cur > 0) void go(cur - 1, autoPlay && !clock.paused); else handle.reset(); },
    jump(i: number) { if (i >= 0 && i < steps.length) void go(i, autoPlay && !clock.paused); },
    reset() {
      token.dead = true;
      const tk = (token = { dead: false });
      cur = -1; autoPlay = false; ended = false; looping = false; settled = true; setPaused(false);
      clearTransient(); setFocus(undefined); report();
      const m = initialModel(scene);
      cameraTo(null, m);
      transitionTo(m, tk).catch(swallow);
    },
    choose(step: number, option: number) {
      choices[step] = option;
      if (step !== cur || !steps[step].control) return;
      token.dead = true;
      const tk = (token = { dead: false });
      autoPlay = false; looping = false; ended = false; setPaused(false);
      clearTransient();
      settled = true;
      const end = stateBefore(scene, step + 1, choices);
      cameraTo(frameOf(step), end, false, undefined, notesOf(step));
      report();
      (async () => {
        await transitionTo(end, tk);
        for (const e of steps[step].events) if (e.type === "note") note(e.node, e.text, e.tone);
        await runEvents(steps[step].control!.options[option].events.filter((e) => e.type !== "state" && e.type !== "show" && e.type !== "hide" && e.type !== "move"), tk);
      })().catch(swallow);
    },
    show(i: number) {
      token.dead = true;
      token = { dead: false };
      cur = i; ended = false; autoPlay = false; looping = false; setPaused(false);
      clearTransient(); setFocus(steps[i].focus);
      settled = true;
      const end = stateBefore(scene, i + 1, choices);
      cameraTo(frameOf(i), end, true, undefined, notesOf(i));
      transitionTo(end, token, true).catch(swallow);
      settleExtras(i);
      report();
    },
    resize() {
      const width = host.getBoundingClientRect().width;
      if (width < 100) return; // a momentary collapse, such as a screenshot tool laying the page out
      const n = width < 560;
      if (n !== narrow) {
        narrow = n;
        for (const id of ids) renderNode(id);
        if (cur >= 0) { if (looping) void go(cur, autoPlay); else handle.show(cur); return; }
        const m = model;
        cameraTo(null, m, true);
        transitionTo(m, token, true).catch(swallow);
        return;
      }
      cameraTo(cur >= 0 ? frameOf(cur) : null, cur >= 0 ? stateBefore(scene, cur + 1, choices) : model, true, undefined, cur >= 0 ? notesOf(cur) : undefined);
      for (const id of ids) pos[id] = placeAt(model.nodes[id].at);
      setView(view);
    },
    destroy() {
      destroyed = true; token.dead = true;
      clearTransient();
      syncFrames();
      visibility?.disconnect(); resize?.disconnect();
      host.innerHTML = "";
    },
    get step() { return cur; },
    get choices() { return choices; },
  };

  // Parts whose pack hasn't loaded stand as plain crates until their drawings arrive (a loader can load them first).
  const waiting = ids.filter((id) => !isDrawn(roleOf[id]));
  if (waiting.length) loadScenePacks(scene).then(() => {
    if (destroyed) return;
    for (const id of waiting) { nodeEls[id].opts = null; renderNode(id); }
  }, (err) => console.error("SystemKit stage: a pack of drawings didn't load", err));

  cameraTo(null, model, true);
  transitionTo(model, token, true).catch(swallow);
  resize?.observe(host);
  report();
  return handle;
}
