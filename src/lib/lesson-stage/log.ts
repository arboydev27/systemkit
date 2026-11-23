// The append-only log: a tray of record tiles lying on the floor beside its part, one row per log (a topic's partitions
// stack as rows). Records drop into the open slot at the end, offsets are printed along the tray's front edge like a
// ruler, readers' cursors hang under it, and brackets and watermarks sit over it. The tray is drawn at the stage's
// label scale, so its words keep their size on screen; where it stands follows its part.
import styles from "./log.module.css";
import type { Figure, FigureFactory, Point, Token } from "./figure";
import { applyEvent, cloneModel, initialModel, stepEvents, type Choices, type LogEntry, type LogState, type NodeState, type StageModel } from "./model";
import type { Rect } from "./routing";
import type { StageEvent } from "./types";
import { LOG, capacity, nameWidth, rowGap, rowLayout, rowMetrics, stack, tileWidth, topBaseline, topHeight, trayDepth, type Row, type RowMetrics } from "./log-geometry";

// the engine's part sizes, for keeping clear of a part's base, tag and load pill
const BASE = 56, PH = 7, HALF_BASE_W = BASE * Math.cos(Math.PI / 6);
const TYPES = new Set(["append", "cursor", "read", "roll", "compact", "flush", "truncate", "record", "bracket"]);
const fmt = (n: number) => Math.round(n * 100) / 100;
/** A label scale, kept fine enough that 10px words stay 10px on screen. */
const fmtScale = (n: number) => Math.round(n * 1e4) / 1e4;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
let clipSeq = 0;

type Num = Record<string, number>;
type Anim = { now: Num; from: Num; to: Num; d0: number; d1: number; ease: (t: number) => number; done?: () => void };

/** Room a part's rows keep over the tray (watermark and bracket names) and under it (cursor names), by log. */
type Reserve = { top: Record<string, number>; lanes: Record<string, number> };
type PartCfg = {
  node: string; side: "right" | "left" | "below"; logs: string[];
  tileW: number; slotW: number; cap: number; labelCol: number; trayW: number; reach: number;
  /** What each step needs, so a row keeps its size through a step but only makes room for readers when it has some. */
  at: Map<number, Reserve>;
};
type RowPlan = { id: string; row: Row; full: number; met: RowMetrics; y: number; top: number; lanes: number };
type Plan = { node: string; cfg: PartCfg; rows: RowPlan[]; h: number };

/** Anything drawn that can be on its way out: once `gone`, `drop` takes it off the stage when it has faded. */
type Leaving = { now: Num; gone: boolean; drop?: () => void };
type TileD = Leaving & {
  key: string; log: string; rec: LogEntry; g: SVGGElement; top: SVGPathElement; band: SVGPathElement; text: SVGTextElement; strike: SVGLineElement;
  off: SVGTextElement; shown: string; wanted: string;
};
type PieceD = Leaving & { seg: number; g: SVGGElement; front: SVGPathElement; face: SVGPathElement; floor: SVGPathElement; lid: SVGPathElement; end: SVGPathElement };
type MarkD = Leaving & { id: string; g: SVGGElement; mark: SVGPathElement; text: SVGTextElement; kind: "ptr" | "line" | "br"; tone: string; early?: number };
type RowD = Leaving & {
  id: string; sd: StackD; g: SVGGElement; label: SVGTextElement;
  pieceG: SVGGElement; tileG: SVGGElement; offG: SVGGElement; markG: SVGGElement;
  slot: SVGGElement; slotRect: SVGPathElement; slotOff: SVGTextElement; ell: SVGTextElement; clipRect: SVGRectElement;
  sorted: boolean;
  tiles: Map<string, TileD>; pieces: Map<number, PieceD>; marks: Map<string, MarkD>;
  slotText: string;
};
/** A part's strips: the outer group carries position and fades, the inner one dimming, so the two never fight. */
type StackD = { node: string; g: SVGGElement; inner: SVGGElement; rows: Map<string, RowD>; now: Num };

export const logFigure: FigureFactory = (ctx) => {
  const scene = ctx.scene;
  const specs = scene.logs ?? [];
  const parts = [...new Set(specs.map((l) => l.node))];
  const el = ctx.el;

  // ---------- what the scene ever holds, so a strip keeps its size from step to step ----------
  const models: StageModel[] = [];
  /** The models each step passes through (its start, after each figure event, its end); -1 is before the first. */
  const stepModels = new Map<number, StageModel[]>();
  {
    const runs: Choices[] = [{}];
    scene.steps.forEach((st, i) => st.control?.options.forEach((_, j) => { if (j) runs.push({ [i]: j }); }));
    const add = (i: number, m: StageModel) => { const c = cloneModel(m); models.push(c); stepModels.set(i, [...(stepModels.get(i) ?? []), c]); };
    for (const choices of runs) {
      const m = initialModel(scene);
      add(-1, m);
      for (let i = 0; i < scene.steps.length; i++) {
        add(i, m);
        for (const e of stepEvents(scene, i, choices)) {
          applyEvent(m, e);
          if (TYPES.has(e.type)) add(i, m);
        }
        add(i, m);
      }
    }
  }
  const cfgs: [Map<string, PartCfg>, Map<string, PartCfg>] = [new Map(), new Map()];
  /** How wide a strip may be, in label pixels: on a phone the stage's width less its side padding; on a wide screen a
   * share of the stage, so the parts keep their room beside it. */
  function budget(narrow: boolean) {
    const w = ctx.layers.floor.ownerSVGElement?.getBoundingClientRect().width ?? (narrow ? 360 : 700);
    return narrow ? Math.max(230, Math.min(350, w - 36)) : Math.max(430, Math.min(560, w * 0.6));
  }
  function cfgOf(node: string): PartCfg {
    const narrow = ctx.narrow(), cache = cfgs[narrow ? 1 : 0];
    const known = cache.get(node);
    if (known) return known;
    const logs = specs.filter((l) => l.node === node).map((l) => l.id);
    const side = specs.find((l) => l.node === node && l.side)?.side ?? "right";
    const texts = models.flatMap((m) => logs.flatMap((id) => m.logs?.[id]?.records.map((r) => r.text) ?? []));
    const tileW = tileWidth(texts);
    const labelCol = Math.max(0, ...logs.map((id) => nameWidth(specs.find((l) => l.id === id)?.label ?? "")));
    const slotW = Math.min(tileW, narrow ? 26 : 34);
    const cap = capacity(budget(narrow), tileW, labelCol, slotW, narrow ? 5 : 8);
    const cfg: PartCfg = { node, side, logs, tileW, slotW, cap, labelCol, trayW: 0, reach: 0, at: new Map() };
    for (const m of models) for (const id of logs) {
      const log = m.logs?.[id];
      if (!log) continue;
      const row = rowLayout(log, { tileW, cap, slotW });
      cfg.trayW = Math.max(cfg.trayW, row.width);
      cfg.reach = Math.max(cfg.reach, row.reach);
    }
    cache.set(node, cfg);
    return cfg;
  }
  /** The lanes a part's rows keep over and under their trays for a step: what the step's busiest moment needs. */
  function reserve(cfg: PartCfg, step: number): Reserve {
    const known = cfg.at.get(step);
    if (known) return known;
    const r: Reserve = { top: {}, lanes: {} };
    for (const m of stepModels.get(step) ?? models) for (const id of cfg.logs) {
      const log = m.logs?.[id];
      if (!log) continue;
      const row = rowLayout(log, { tileW: cfg.tileW, cap: cfg.cap, slotW: cfg.slotW });
      r.lanes[id] = Math.max(r.lanes[id] ?? 0, row.lanes);
      r.top[id] = Math.max(r.top[id] ?? 0, row.topLanes);
    }
    cfg.at.set(step, r);
    return r;
  }

  // ---------- which logs a step is about: on a crowded part, the others fold down to slivers ----------
  const activeCache = new Map<number, Set<string>>();
  const firstLogStep = scene.steps.findIndex((st) => st.events.some((e) => TYPES.has(e.type)));
  function activeAt(step: number): Set<string> {
    // before the first step, the log the story starts with lies open
    if (step < 0 && firstLogStep >= 0) step = firstLogStep;
    const known = activeCache.get(step);
    if (known) return known;
    const touched = new Set<string>(), moved = new Set<string>();
    const st = scene.steps[step];
    if (st) for (const e of [...st.events, ...(st.control?.options.flatMap((o) => o.events) ?? [])]) {
      if (e.type === "cursor") { moved.add(e.log); continue; }
      if ("log" in e) touched.add(e.log);
      if (e.type === "flush") { touched.add(e.from); touched.add(e.to); }
      if (e.type === "compact") for (const id of e.merge ?? []) touched.add(id);
    }
    // a reader stepping along a log the step isn't about moves on its sliver; a step of cursors only opens their logs
    const out = touched.size ? touched : moved;
    activeCache.set(step, out);
    return out;
  }

  // ---------- where a part's strip goes ----------
  let plans = new WeakMap<StageModel, Map<string, Plan>>();
  function plan(node: string, m: StageModel, step = ctx.step()): Plan {
    const narrow = ctx.narrow(), key = `${node}|${step}|${narrow ? 1 : 0}`;
    let byModel = plans.get(m);
    const known = byModel?.get(key);
    if (known) return known;
    const cfg = cfgOf(node), part = m.nodes[node], res = reserve(cfg, step);
    const ids = part?.visible ? cfg.logs.filter((id) => m.logs?.[id]?.visible) : [];
    const crowded = ids.length > (narrow ? 2 : 3), active = activeAt(step);
    const rows = ids.map((id) => {
      const full = crowded && !active.has(id) ? 0 : 1;
      const row = rowLayout(m.logs![id], { tileW: cfg.tileW, cap: cfg.cap, slotW: cfg.slotW, folded: !full });
      const top = res.top[id] ?? 0, lanes = res.lanes[id] ?? 0;
      return { id, row, full, met: rowMetrics(full, top, lanes), y: 0, top, lanes };
    });
    const st = stack(rows.map((r) => ({ h: r.met.h, gap: rowGap(r.full) })));
    // the first tray's top recedes above the row where nothing is printed over it
    const lift = rows.length ? Math.max(0, trayDepth(rows[0].full).dy - rows[0].met.trayY) : 0;
    rows.forEach((r, i) => (r.y = st.y[i] + lift));
    const out = { node, cfg, rows, h: st.h + lift };
    if (!byModel) plans.set(m, (byModel = new Map()));
    byModel.set(key, out);
    return out;
  }
  const leftOf = (cfg: PartCfg) => (cfg.labelCol ? cfg.labelCol + LOG.labelGap : 0);
  const rightOf = (cfg: PartCfg) => Math.max(cfg.trayW + trayDepth(1).dx, cfg.reach);
  const tagH = (n: NodeState) => (n.detail && !ctx.narrow() ? 36 : 22);
  const hasPill = (n: NodeState) => !!(n.readout || n.meter != null) && !n.down;
  const pillW = (n: NodeState) => 16 + (n.meter != null && !ctx.narrow() ? 31 : 0) + (n.readout || `${Math.round((n.meter ?? 0) * 100)}%`).length * 6.5;
  const rowOfPart = (m: StageModel, id: string) => Math.round(m.nodes[id].at[0] * 10);
  /** On a phone, the parts in this part's row of the tiers that show strips, left to right: their strips stack under
   * the row, so two parts side by side never lay theirs over each other. */
  function rowMates(node: string, m: StageModel): string[] {
    const n = m.nodes[node];
    if (!n) return [node];
    const row = rowOfPart(m, node);
    return parts.filter((id) => id === node || (m.nodes[id]?.visible && rowOfPart(m, id) === row && plan(id, m).rows.length > 0))
      .sort((a, b) => m.nodes[a].at[1] - m.nodes[b].at[1] || parts.indexOf(a) - parts.indexOf(b));
  }
  /** Every part a phone row shows during the step: the strips centre under all of them, so the row and its strips
   * frame as one, and hold still while one part makes way for another. */
  function rowParts(node: string, m: StageModel): string[] {
    const row = rowOfPart(m, node), seen = stepModels.get(ctx.step()) ?? [];
    return Object.keys(m.nodes).filter((id) => id === node || (rowOfPart(m, id) === row && (m.nodes[id].visible || seen.some((x) => x.nodes[id]?.visible))));
  }
  const MATE_GAP = 14;
  /** Where the other parts stand and how tall their strips are: as drawn now, or as model m has them. */
  type Others = { at(id: string): Point; h(id: string): number };
  /** The world point where the strip's (0, 0) lies: the left end of its first tray, the top of its first row. */
  function anchor(node: string, p: Point, s: number, h: number, m: StageModel, others?: Others): Point {
    const cfg = cfgOf(node), n = m.nodes[node], left = leftOf(cfg), right = rightOf(cfg);
    const side = ctx.narrow() ? "below" : cfg.side;
    if (side === "below" && ctx.narrow()) {
      const mates = rowMates(node, m), at = (id: string) => (id === node ? p : m.nodes[id].visible ? others?.at(id) ?? ctx.goal(id, m) : ctx.goal(id, m));
      const row = rowParts(node, m);
      let y = Math.max(...row.map((id) => at(id).y + BASE / 2 + PH - 4 - 6 * s + tagH(m.nodes[id]) * s)) + 7 * s;
      for (const id of mates) { if (id === node) break; y += ((others?.h(id) ?? plan(id, m).h) + MATE_GAP) * s; }
      const xs = row.map((id) => at(id).x), cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      // stacked strips line up on the left, their names in one column
      const L = Math.max(...mates.map((id) => leftOf(cfgOf(id)))), R = Math.max(...mates.map((id) => rightOf(cfgOf(id))));
      return { x: cx - ((L + R) / 2) * s + L * s, y };
    }
    if (side === "below") {
      const tagBottom = p.y + BASE / 2 + PH - 4 - 6 * s + tagH(n) * s;
      return { x: p.x - ((left + right) / 2) * s + left * s, y: tagBottom + 10 * s };
    }
    // beside the part the rows lie on the floor going back: the nearest rests by the part's base, just clear of its
    // name tag, and the rest rise behind it
    const tagTop = p.y + BASE / 2 + PH - 4 - 6 * s;
    const y0 = tagTop - 2 * s - h * s;
    let dx = HALF_BASE_W + 30;
    if (side === "left") return { x: p.x - dx - right * s, y: y0 };
    if (hasPill(n)) {
      const py1 = p.y - ctx.top(node) * 0.5, py0 = py1 - 22 * s;
      if (y0 < py1 && y0 + h * s > py0) dx = Math.max(dx, 46 + pillW(n) * s + 12 * s);
    }
    return { x: p.x + dx + left * s, y: y0 };
  }
  function box(node: string, p: Point, s: number, m: StageModel, step?: number): Rect | null {
    const pl = plan(node, m, step);
    if (!pl.rows.length) return null;
    const a = anchor(node, p, s, pl.h, m);
    return { x0: a.x - leftOf(pl.cfg) * s, y0: a.y, x1: a.x + rightOf(pl.cfg) * s, y1: a.y + pl.h * s };
  }

  // ---------- drawing ----------
  const root = el("g", { class: styles.logs }, ctx.layers.mid);
  // records ride in and out past a tray's left end like a conveyor's, so they never cross the log's name: each row
  // clips its records to the right of its start, or of its ellipsis while older records are elided (a record leaving
  // the window slides in under the ellipsis instead of showing through it)
  const clipBase = `sk-log-clip-${++clipSeq}`;
  let clipRows = 0;
  const stacks = new Map<string, StackD>();
  for (const node of parts) {
    const g = el("g", {}, root), inner = el("g", { class: styles.stack }, g);
    g.style.opacity = "0";
    stacks.set(node, { node, g, inner, rows: new Map(), now: { op: 0 } });
  }
  let anims: Anim[] = [];
  function aim(now: Num, to: Num, d0 = 0, d1 = 1, ease: (t: number) => number = ctx.ease.inOut, done?: () => void) {
    anims.push({ now, from: { ...now }, to, d0, d1, ease, done });
  }
  /** Mark something as on its way out; it leaves the stage once faded, unless it is wanted again first. */
  function leave(x: Leaving, remove: () => void): () => void {
    x.gone = true;
    x.drop = () => { if (x.gone) remove(); };
    return x.drop;
  }
  const at = (list: Anim[], p: number) => {
    for (const a of list) {
      const q = a.ease(clamp01((p - a.d0) / Math.max(0.001, a.d1 - a.d0)));
      for (const k in a.to) a.now[k] = a.from[k] + (a.to[k] - a.from[k]) * q;
    }
  };
  const finish = (list: Anim[]) => { for (const a of list) Object.assign(a.now, a.to); for (const a of list) a.done?.(); paint(); };
  /** Each reconcile starts a new generation: what an interrupted run was still finishing stops where the new one begins. */
  let gen = 0, busy = 0;
  async function run(ms: number, tk: Token, instant: boolean) {
    const list = anims;
    anims = [];
    const moving = list.some((a) => Object.keys(a.to).some((k) => Math.abs(a.to[k] - (a.now[k] ?? a.to[k])) > 0.001));
    if (instant || ctx.reduce || !moving) { finish(list); return; }
    let reached = 0;
    busy++;
    try {
      await ctx.tween(ms, tk, (p) => { reached = p; at(list, p); paint(); });
    } catch (err) {
      // the learner moved on: what was under way finishes quickly (records land, gone ones leave) rather than freezing
      // half done; the next reconcile takes over from wherever it has got to
      const g = gen;
      void ctx.realtime(200, (q) => { if (g === gen) { at(list, reached + (1 - reached) * q); paint(); } }).then(() => { if (g === gen) finish(list); });
      throw err;
    } finally { busy--; }
    finish(list);
  }

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return `M${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}A${r} ${r} 0 0 1 ${fmt(x + w)} ${fmt(y + r)}V${fmt(y + h - r)}A${r} ${r} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)}H${fmt(x + r)}A${r} ${r} 0 0 1 ${fmt(x)} ${fmt(y + h - r)}V${fmt(y + r)}A${r} ${r} 0 0 1 ${fmt(x + r)} ${fmt(y)}Z`;
  };
  const roundTop = (x: number, y: number, w: number, h: number, r: number) => {
    r = Math.max(0, Math.min(r, w / 2, h));
    return `M${fmt(x)} ${fmt(y + h)}V${fmt(y + r)}A${r} ${r} 0 0 1 ${fmt(x + r)} ${fmt(y)}H${fmt(x + w - r)}A${r} ${r} 0 0 1 ${fmt(x + w)} ${fmt(y + r)}V${fmt(y + h)}Z`;
  };

  function makeRow(sd: StackD, id: string): RowD {
    const g = el("g", {}, sd.inner);
    const clip = `${clipBase}-${++clipRows}`;
    const clipRect = el("rect", { x: 0, y: -80, width: 4000, height: 240 }, el("clipPath", { id: clip }, g));
    const label = el("text", { class: styles.label, "text-anchor": "end" }, g);
    label.textContent = specs.find((l) => l.id === id)?.label ?? "";
    const pieceG = el("g", {}, g), tileG = el("g", { "clip-path": `url(#${clip})` }, g), offG = el("g", { "clip-path": `url(#${clip})` }, g), markG = el("g", {}, g);
    const slot = el("g", { class: styles.slot }, g);
    const slotRect = el("path", {}, slot);
    const slotOff = el("text", { class: styles.offset, "text-anchor": "middle" }, slot);
    const ell = el("text", { class: styles.ellipsis, "text-anchor": "middle" }, g);
    ell.textContent = "…";
    return {
      id, sd, g, label, pieceG, tileG, offG, markG, slot, slotRect, slotOff, ell, clipRect,
      // sa and sb: the open slot steps aside while a record drops in (sa fades it, sb brings it back); clipX: where the
      // row's records are cut off on the left
      now: { y: 0, full: 1, op: 0, top: 0, lanes: 0, slotX: 0, slotOp: 0, sa: 0, sb: 1, slotSwap: 1, ellX: 0, ellOp: 0, clipX: 0 }, gone: false,
      sorted: !!specs.find((l) => l.id === id)?.sorted,
      tiles: new Map(), pieces: new Map(), marks: new Map(), slotText: "",
    };
  }
  function makeTile(rd: RowD, key: string, rec: LogEntry): TileD {
    const g = el("g", { class: styles.tile }, rd.tileG);
    const band = el("path", { class: styles.band }, g);
    const top = el("path", { class: styles.face }, g);
    const text = el("text", { class: styles.text, "text-anchor": "middle" }, g);
    const strike = el("line", { class: styles.strike }, g);
    const off = el("text", { class: styles.offset, "text-anchor": "middle" }, rd.offG);
    text.textContent = rec.text;
    // a sorted log (a memtable) is found by key, not by offset: its ruler stays blank
    off.textContent = rd.sorted ? "" : String(rec.offset);
    return { key, log: rd.id, rec, g, top, band, text, strike, off, now: { x: 0, op: 0, dy: 0, swap: 1 }, shown: rec.text, wanted: rec.text, gone: false };
  }
  const toneClass = (tone: string) => (tone === "work" ? styles.work : tone === "hot" ? styles.hot : tone === "quiet" ? styles.quiet : "");
  function setTileClass(t: TileD) {
    const k = litKey(t);
    const cls = [styles.tile, toneClass(t.rec.tone ?? ""), t.rec.tomb ? styles.tomb : "", lit.has(k) ? styles.lit : "", read.has(k) ? styles.read : "", doomed.has(k) ? styles.doomed : "", cut.has(k) ? styles.cut : ""];
    t.g.setAttribute("class", cls.filter(Boolean).join(" "));
  }
  // transient marks: a record being read lights up, and a read record keeps a ring for the step; a compaction strikes
  // what it drops and a crash marks the tail it cuts, while they happen
  const lit = new Set<string>(), read = new Set<string>(), doomed = new Set<string>(), cut = new Set<string>();
  const litKey = (t: TileD) => `${t.log}:${t.rec.offset}`;
  const keyOf = (log: string, offset: number) => `${log}:${offset}`;
  /** Take marks off records, and redraw the records they were on. */
  function unmark(...sets: Set<string>[]) {
    const marked = sets.flatMap((s) => [...s]);
    for (const s of sets) s.clear();
    for (const k of marked) { const i = k.lastIndexOf(":"); refresh(k.slice(0, i), +k.slice(i + 1)); }
  }

  // ---------- focus: a reader named after a part out of the step's focus dims with it ----------
  let focusList: string[] | undefined;
  const byLabel = new Map(scene.nodes.map((n) => [n.label.toLowerCase(), n.id]));
  function markClass(md: MarkD) {
    const id = md.id.slice(2), owner = scene.nodes.some((n) => n.id === id) ? id : byLabel.get(md.text.textContent?.toLowerCase() ?? "");
    const away = md.kind !== "br" && !!focusList && !!owner && !focusList.includes(owner);
    md.g.setAttribute("class", [styles[md.kind], toneClass(md.tone), away ? styles.away : ""].filter(Boolean).join(" "));
  }

  /** Each record's key in a row: its offset, with a count where a merge brought in the same offset twice. */
  function keys(recs: LogEntry[]): string[] {
    const seen = new Map<number, number>();
    return recs.map((r) => { const n = seen.get(r.offset) ?? 0; seen.set(r.offset, n + 1); return n ? `${r.offset}~${n}` : String(r.offset); });
  }

  /** Records a flight is bringing in, by log: they show once it lands. */
  type Incoming = Map<string, Set<string>>;
  type RenderOpts = { incoming?: Incoming; vanish?: Set<string>; fall?: Set<string>; stagger?: boolean };

  /** The model the strips were last brought to. */
  let drawn: StageModel | null = null;
  /** Bring every strip to model m: rows fold, unfold and slide; records drop in, slide along and sink away. Anything
   * still leaving from an interrupted run is sent on its way again. */
  function reconcile(m: StageModel, o: RenderOpts = {}): number {
    gen++;
    drawn = m;
    let entering = 0;
    for (const node of parts) {
      const sd = stacks.get(node)!, pl = plan(node, m);
      aim(sd.now, { op: pl.rows.length ? 1 : 0 });
      const wanted = new Set(pl.rows.map((r) => r.id));
      for (const rp of pl.rows) {
        let rd = sd.rows.get(rp.id);
        const fresh = !rd || rd.gone;
        // a row that arrives unfolds from a sliver where it will lie
        if (!rd) { rd = makeRow(sd, rp.id); sd.rows.set(rp.id, rd); Object.assign(rd.now, { y: rp.y, full: 0, top: rp.top, lanes: rp.lanes }); }
        rd.gone = false;
        aim(rd.now, { y: rp.y, full: rp.full, op: 1, top: rp.top, lanes: rp.lanes }, fresh ? 0.25 : 0, 1, ctx.ease.inOut);
        entering += reconcileRow(rd, rp, m.logs![rp.id], o);
      }
      for (const [id, rd] of sd.rows) {
        if (wanted.has(id)) continue;
        const drop = rd.gone ? rd.drop : leave(rd, () => { rd.g.remove(); if (sd.rows.get(id) === rd) sd.rows.delete(id); });
        aim(rd.now, { op: 0, full: 0 }, 0, 0.7, ctx.ease.out, drop);
      }
    }
    return entering;
  }

  function reconcileRow(rd: RowD, rp: RowPlan, log: LogState, o: RenderOpts): number {
    const tiles = rp.row.cells.filter((c) => c.kind === "tile");
    const ks = keys(log.records), keyByRec = new Map(log.records.map((r, i) => [r, ks[i]]));
    const want = new Map(tiles.map((c) => [keyByRec.get(c.rec!)!, c]));
    const still = new Set(ks); // records the log still holds, shown or not
    let entering = 0, k = 0;
    const incoming = o.incoming?.get(rd.id);
    const live = [...rd.tiles.values()].filter((t) => !t.gone);
    // how far the window slides: records leaving it or coming back into it ride along with the ones that stay
    let shift: number | null = null;
    for (const [key, c] of want) { const t = rd.tiles.get(key); if (t && !t.gone) { shift = c.x - t.now.x; break; } }
    // what the row shows now reaches this far: an older record coming back into view slides in from the left instead
    const newest = Math.max(-Infinity, ...live.map((t) => t.rec.offset));
    const isNew = (key: string, rec: LogEntry) => !rd.tiles.has(key) && !incoming?.has(key) && !(rec.offset < newest);
    // a record dropping in: the tray grows and the open slot steps aside first, so the record lands on the tray
    const dropping = [...want].some(([key, c]) => isNew(key, c.rec!));
    const slotShown = rd.now.slotOp > 0.5 && !log.sorted;
    for (const [key, c] of want) {
      const rec = c.rec!;
      let t = rd.tiles.get(key);
      if (t && t.gone && incoming?.has(key)) { t.g.remove(); t.off.remove(); rd.tiles.delete(key); t = undefined; }
      if (!t) {
        t = makeTile(rd, key, rec);
        rd.tiles.set(key, t);
        t.now.x = c.x;
        if (incoming?.has(key)) {
          // a flight brings it from another strip; it shows where it lands
          aim(t.now, { op: 1 }, 0.94, 1, (q) => q);
        } else if (rec.offset < newest) {
          // an older record coming back into view (going back a step): it slides in from the ellipsis with the rest,
          // showing as the newer ones leave, so the tray is never bare mid-move
          t.now.x = c.x - Math.max(10, shift ?? 0);
          aim(t.now, { x: c.x, dy: 0 }, 0, 0.85, ctx.ease.inOut);
          aim(t.now, { op: 1 }, 0.05, 0.55, ctx.ease.inOut);
        } else {
          // it drops into the open slot where the slot is now, and rides along as the window slides
          t.now.x = slotShown ? rd.now.slotX + k * (c.w + LOG.gap) : c.x;
          t.now.dy = -14;
          const d0 = o.stagger === false ? 0.26 : Math.min(0.6, 0.26 + k * 0.14);
          aim(t.now, { x: c.x }, 0, 0.85, ctx.ease.inOut);
          aim(t.now, { dy: 0 }, d0, Math.min(1, d0 + 0.42), ctx.ease.back);
          aim(t.now, { op: 1 }, d0, Math.min(1, d0 + 0.12), ctx.ease.out);
          k++; entering++;
        }
      } else {
        // it stays, or it was leaving and is wanted again: it comes back from wherever it had got to
        t.rec = rec;
        t.gone = false;
        aim(t.now, { x: c.x, op: 1, dy: 0 }, 0, 0.85, ctx.ease.inOut);
        if (t.wanted !== rec.text) { t.wanted = rec.text; t.now.swap = 0; }
        if (t.now.swap < 1) aim(t.now, { swap: 1 }, 0, 0.7, (q) => q);
        if (!rd.sorted && t.off.textContent !== String(rec.offset)) t.off.textContent = String(rec.offset);
      }
      setTileClass(t);
    }
    let slidingOut = false;
    for (const [key, t] of rd.tiles) {
      if (want.has(key)) continue;
      if (t.gone) { aim(t.now, { op: 0 }, 0, 0.45, ctx.ease.out, t.drop); continue; }
      const done = leave(t, () => { t.g.remove(); t.off.remove(); if (rd.tiles.get(key) === t) rd.tiles.delete(key); });
      if (o.vanish?.has(`${rd.id}:${key}`)) { t.now.op = 0; aim(t.now, { op: 0 }, 0, 0.01, (q) => q, done); continue; }
      if (still.has(key)) {
        // it slid out of the window, carried left on the conveyor past the tray's end, fading as it goes
        slidingOut = true;
        const pitch = (tiles[0]?.w ?? 60) + LOG.gap, by = Math.max(-2 * pitch, Math.min(-6, shift ?? -k * pitch));
        aim(t.now, { x: t.now.x + by }, 0, 0.85, ctx.ease.inOut);
        aim(t.now, { op: 0 }, 0, 0.45, ctx.ease.out, done);
      } else if (o.fall?.has(`${rd.id}:${key}`)) aim(t.now, { op: 0, dy: 26 }, 0, 0.8, ctx.ease.in, done);
      else { aim(t.now, { dy: 10 }, 0, 0.45, ctx.ease.in); aim(t.now, { op: 0 }, 0, 0.32, ctx.ease.out, done); }
    }
    // tray pieces, one per segment; a tray growing for a record that drops in grows first
    const grow = dropping ? 0.45 : 0.85;
    const segs = new Set(rp.row.pieces.map((p) => p.seg));
    for (const p of rp.row.pieces) {
      let pd = rd.pieces.get(p.seg);
      if (!pd) {
        const g = el("g", { class: styles.piece }, rd.pieceG);
        const floor = el("path", { class: styles.floor }, g), lid = el("path", { class: styles.lid }, g), end = el("path", { class: styles.end }, g);
        pd = { seg: p.seg, g, floor, lid, end, front: el("path", { class: styles.front }, g), face: el("path", { class: styles.top }, g), now: { x0: p.x0, x1: p.x0 + 8, op: 0 }, gone: false };
        if (!rd.pieces.size) pd.now.x1 = p.x1;
        rd.pieces.set(p.seg, pd);
      }
      pd.gone = false;
      aim(pd.now, { x0: p.x0, x1: p.x1, op: 1 }, 0, grow, ctx.ease.inOut);
    }
    for (const [seg, pd] of rd.pieces) {
      if (segs.has(seg)) continue;
      const drop = pd.gone ? pd.drop : leave(pd, () => { pd.g.remove(); if (rd.pieces.get(seg) === pd) rd.pieces.delete(seg); });
      aim(pd.now, { op: 0, x1: pd.now.x0 + 8 }, 0, 0.7, ctx.ease.inOut, drop);
    }
    // the open slot at the end, with the offset the next record gets
    const slot = rp.row.cells.find((c) => c.kind === "slot");
    const next = log.sorted ? "" : String(log.next);
    if (slot) {
      if (!rd.now.slotOp) rd.now.slotX = slot.x;
      const changed = !!rd.slotText && rd.slotText !== next;
      rd.slotText = next;
      if (dropping && slotShown) {
        // it fades as the record comes down where it was, moves on unseen with its new offset, and shows again there
        rd.now.sa = Math.max(rd.now.sa, rd.now.sb); rd.now.sb = 0;
        aim(rd.now, { sa: 0 }, 0, 0.14, ctx.ease.out);
        aim(rd.now, { slotX: slot.x, slotOp: 1 }, 0.1, 0.5, ctx.ease.inOut);
        aim(rd.now, { sb: 1 }, 0.62, 0.92, ctx.ease.inOut);
        if (changed) { rd.now.slotSwap = 0; aim(rd.now, { slotSwap: 1 }, 0.14, 0.6, (q) => q); }
      } else {
        if (changed) rd.now.slotSwap = 0;
        aim(rd.now, { slotX: slot.x, slotOp: 1, sb: 1 }, 0, 0.85, ctx.ease.inOut);
        if (rd.now.slotSwap < 1) aim(rd.now, { slotSwap: 1 }, 0.2, 0.8, (q) => q);
      }
    } else aim(rd.now, { slotOp: 0 }, 0, 0.5);
    const ell = rp.row.cells.find((c) => c.kind === "ellipsis");
    // Records are cut off just right of the ellipsis while it shows. One carried out of the window slides in under it:
    // the cut moves there quickly and an ellipsis that is only now needed shows once the record has gone, so it never
    // lies over a record's words. Records sliding over as a row unfolds, or older ones coming back, move with the cut.
    // An ellipsis that goes clears out of the way of the records riding back in under it.
    const clipX = ell ? ell.x + ell.w + LOG.gap / 2 : 0, ellTo = { ellOp: ell ? 1 : 0, ellX: ell ? ell.x + ell.w / 2 : rd.now.ellX };
    if (rd.now.ellOp < 0.02) rd.now.ellX = ellTo.ellX;
    if (slidingOut) {
      aim(rd.now, { clipX }, 0, 0.3, ctx.ease.out);
      if (ell && rd.now.ellOp < 0.5) aim(rd.now, ellTo, 0.4, 0.9, ctx.ease.inOut);
      else aim(rd.now, ellTo, 0, 0.8);
    } else {
      aim(rd.now, { clipX }, 0, 0.85, ctx.ease.inOut);
      aim(rd.now, ellTo, 0, ell ? 0.8 : 0.25);
    }
    // cursors, watermarks and brackets
    const marks = new Map<string, Num>();
    for (const p of rp.row.pointers) marks.set(`p:${p.id}`, { x: p.x, lane: p.lane, side: p.side, op: 1 });
    for (const l of rp.row.lines) marks.set(`l:${l.id}`, { x: l.x, lane: l.lane, side: l.side, op: 1 });
    for (const b of rp.row.brackets) marks.set(`b:${b.id}`, { x0: b.x0, x1: b.x1, lane: b.lane, op: 1 });
    for (const [mk, to] of marks) {
      let md = rd.marks.get(mk);
      const kind = mk[0] === "p" ? "ptr" : mk[0] === "l" ? "line" : "br";
      const data = kind === "ptr" ? rp.row.pointers.find((p) => `p:${p.id}` === mk)! : kind === "line" ? rp.row.lines.find((p) => `l:${p.id}` === mk)! : rp.row.brackets.find((p) => `b:${p.id}` === mk)!;
      if (!md) {
        const g = el("g", {}, rd.markG);
        md = { id: mk, g, mark: el("path", { class: styles.mark }, g), text: el("text", { class: styles.markLabel, "text-anchor": kind === "br" ? "middle" : "start" }, g), now: { ...to, op: 0, rise: kind === "ptr" ? 6 : 0 }, gone: false, kind, tone: "" };
        if (kind === "br") { const c = (to.x0 + to.x1) / 2; md.now.x0 = c; md.now.x1 = c; }
        rd.marks.set(mk, md);
      }
      md.gone = false; md.early = undefined;
      md.tone = data.tone;
      if (kind !== "br") md.text.setAttribute("text-anchor", to.side < 0 ? "end" : "start");
      if (md.text.textContent !== data.label) md.text.textContent = data.label;
      markClass(md);
      const { side, ...target } = to;
      if (side !== undefined) md.now.side = side;
      aim(md.now, { ...target, rise: 0 }, 0.1, 0.95, ctx.ease.inOut);
    }
    for (const [mk, md] of rd.marks) {
      if (marks.has(mk)) continue;
      const drop = md.gone ? md.drop : leave(md, () => { md.g.remove(); if (rd.marks.get(mk) === md) rd.marks.delete(mk); });
      aim(md.now, { op: 0 }, 0, 0.5, ctx.ease.out, drop);
    }
    return entering;
  }

  function currentHeight(sd: StackD) {
    let h = 0;
    for (const rd of sd.rows.values()) h = Math.max(h, rd.now.y + rowMetrics(rd.now.full, rd.now.top, rd.now.lanes).h * Math.min(1, rd.now.op * 1.5));
    return h;
  }
  const drawnNow: Others = { at: (id) => ctx.at(id) ?? ctx.goal(id, ctx.model()), h: (id) => (stacks.has(id) ? currentHeight(stacks.get(id)!) : 0) };
  function stackAnchorNow(sd: StackD): Point {
    const p = ctx.at(sd.node) ?? ctx.goal(sd.node, ctx.model());
    return anchor(sd.node, p, ctx.labelScale(), currentHeight(sd), ctx.model(), drawnNow);
  }
  /** Where a tile stands in the world now: the top-left of its face. */
  function tileWorld(rd: RowD, t: TileD): Point {
    const a = stackAnchorNow(rd.sd), s = ctx.labelScale(), met = rowMetrics(rd.now.full, rd.now.top, rd.now.lanes);
    return { x: a.x + t.now.x * s, y: a.y + (rd.now.y + met.tileY + t.now.dy) * s };
  }

  // ---------- records flying from one strip to another (a flush, a merge), over everything ----------
  const flightG = el("g", { class: styles.logs }, ctx.layers.top);
  type Flight = { g: SVGGElement; face: SVGPathElement; band: SVGPathElement; text: SVGTextElement; strike: SVGLineElement; from: Point; w0: number; to: () => { p: Point; w: number } | null; now: Num };
  let flights: Flight[] = [];
  const nodeOfLog = (id: string) => specs.find((l) => l.id === id)?.node ?? "";
  /** A record lifts off where it stands and lands on its tile in another strip, which shows once it is there. */
  function fly(rec: LogEntry, from: Point, w0: number, toLog: string, toKey: string, d0: number, d1: number) {
    const g = el("g", { class: [styles.tile, toneClass(rec.tone ?? ""), rec.tomb ? styles.tomb : ""].filter(Boolean).join(" ") }, flightG);
    const band = el("path", { class: styles.band }, g), face = el("path", { class: styles.face }, g);
    const text = el("text", { class: styles.text, "text-anchor": "middle" }, g);
    text.textContent = rec.text;
    // a tombstone keeps its strike on the way (the class shows it only on a tombstone)
    const strike = el("line", { class: styles.strike }, g);
    const f: Flight = {
      g, face, band, text, strike, from, w0, now: { t: 0 },
      to() {
        const rd = rowOf(toLog), t = rd && (rd.tiles.get(toKey) ?? [...rd.tiles.values()].filter((x) => !x.gone).pop());
        return rd && t ? { p: tileWorld(rd, t), w: cfgOf(nodeOfLog(toLog)).tileW } : null;
      },
    };
    flights.push(f);
    aim(f.now, { t: 1 }, d0, d1, ctx.ease.inOut, () => { f.g.remove(); flights = flights.filter((x) => x !== f); });
  }
  function dropFlights() { for (const f of flights) f.g.remove(); flights = []; }
  function paintFlights(s: number) {
    for (const f of flights) {
      const q = f.now.t, to = f.to() ?? { p: f.from, w: f.w0 }, w = f.w0 + (to.w - f.w0) * q;
      const x = f.from.x + (to.p.x - f.from.x) * q, y = f.from.y + (to.p.y - f.from.y) * q - Math.sin(Math.PI * q) * 22 * s;
      f.g.setAttribute("transform", `translate(${fmt(x)} ${fmt(y)}) scale(${fmtScale(s)})`);
      f.band.setAttribute("d", roundRect(0, LOG.tileH - 3.2, w, LOG.band + 3.2, 3.2));
      f.face.setAttribute("d", roundRect(0, 0, w, LOG.tileH, 3.2));
      f.text.setAttribute("x", String(fmt(w / 2))); f.text.setAttribute("y", String(fmt(LOG.tileH / 2 + 3.7)));
      const tw = Math.min(w - 10, (f.text.textContent ?? "").length * LOG.mono);
      f.strike.setAttribute("x1", String(fmt(w / 2 - tw / 2 - 1))); f.strike.setAttribute("x2", String(fmt(w / 2 + tw / 2 + 1)));
      f.strike.setAttribute("y1", String(fmt(LOG.tileH / 2))); f.strike.setAttribute("y2", String(fmt(LOG.tileH / 2)));
    }
  }

  /** While parts come and go before the strips are brought along (going back a step), a reader whose cursor the new
   * state no longer has fades with its part instead of lingering. */
  function fadeEarly(rd: RowD, m: StageModel) {
    const log = m.logs?.[rd.id];
    for (const md of rd.marks.values()) {
      if (md.gone) continue;
      const id = md.id.slice(2), kept = md.kind === "br" ? log?.brackets.some((b) => b.id === id) : log?.cursors.some((c) => c.id === id);
      if (kept && log?.visible) { md.early = undefined; continue; }
      const now = performance.now();
      md.early ??= now;
      md.now.op = Math.min(md.now.op, 1 - clamp01((now - md.early) / 280));
    }
  }

  function paint() {
    const s = ctx.labelScale(), m = ctx.model(), early = !busy && drawn !== null && m !== drawn;
    for (const sd of stacks.values()) {
      const p = ctx.at(sd.node);
      if (!p || sd.now.op <= 0.001 && !sd.rows.size) { sd.g.style.visibility = "hidden"; continue; }
      const cfg = cfgOf(sd.node), a = anchor(sd.node, p, s, currentHeight(sd), m, drawnNow);
      sd.g.setAttribute("transform", `translate(${fmt(a.x)} ${fmt(a.y)}) scale(${fmtScale(s)})`);
      sd.g.style.opacity = String(fmt(sd.now.op));
      sd.g.style.visibility = sd.now.op > 0.001 ? "" : "hidden";
      for (const rd of sd.rows.values()) { if (early) fadeEarly(rd, m); paintRow(rd, cfg); }
    }
    paintFlights(s);
  }

  function paintRow(rd: RowD, cfg: PartCfg) {
    const n = rd.now, met = rowMetrics(n.full, n.top, n.lanes), words = met.words;
    rd.g.setAttribute("transform", `translate(0 ${fmt(n.y)})`);
    rd.g.style.opacity = String(fmt(n.op));
    rd.g.classList.toggle(styles.thin, n.full < 0.5);
    const tileH = met.tileH, bandH = met.band, w = cfg.tileW;
    const r = 3.2 * Math.min(1, 0.35 + n.full);
    // the tray, a low slab standing on the floor: its front (the bed the records stand on, and the ruler along its foot)
    // faces us, while its top and its right end recede up the floor's diagonal like a base's faces, in the base's
    // three tones; a soft footprint falls on the floor under its front
    const tr = 2.6 * Math.min(1, 0.4 + n.full), bottom = met.rulerY + met.ruler, { dx, dy } = trayDepth(n.full);
    for (const pd of rd.pieces.values()) {
      const pw = Math.max(0, pd.now.x1 - pd.now.x0), x0 = pd.now.x0, x1 = x0 + pw, y0 = met.trayY;
      pd.face.setAttribute("d", roundTop(x0, y0, pw, met.rulerY - y0, tr));
      pd.front.setAttribute("d", roundRect(x0, y0, pw, bottom - y0, tr));
      const real = pw > tr * 2;
      pd.lid.setAttribute("d", real ? `M${fmt(x0 + tr * 0.3)} ${fmt(y0 + tr * 0.3)}L${fmt(x0 + dx)} ${fmt(y0 - dy)}H${fmt(x1 + dx)}L${fmt(x1 - tr * 0.3)} ${fmt(y0 + tr * 0.3)}Z` : "");
      pd.end.setAttribute("d", real ? `M${fmt(x1 - 0.5)} ${fmt(y0 + tr * 0.3)}L${fmt(x1 + dx)} ${fmt(y0 - dy)}V${fmt(bottom - dy - tr * 0.4)}L${fmt(x1 - 0.5)} ${fmt(bottom - tr * 0.3)}Z` : "");
      const sh = 2.4 * (0.45 + 0.55 * n.full);
      pd.floor.setAttribute("d", real ? `M${fmt(x0 + tr)} ${fmt(bottom - 0.5)}L${fmt(x0 + tr + sh * 1.732)} ${fmt(bottom + sh)}H${fmt(x1 + sh * 1.732)}L${fmt(x1 + dx + sh * 0.9)} ${fmt(bottom - dy + sh * 0.5)}L${fmt(x1 + dx)} ${fmt(bottom - dy - 0.5)}Z` : "");
      pd.g.style.opacity = String(fmt(pd.now.op));
    }
    rd.label.setAttribute("x", String(-LOG.labelGap));
    rd.label.setAttribute("y", String(fmt(met.tileY + (tileH + bandH) / 2 + 4.2)));
    // records
    for (const t of rd.tiles.values()) {
      const tn = t.now;
      t.g.setAttribute("transform", `translate(${fmt(tn.x)} ${fmt(met.tileY + tn.dy)})`);
      t.g.style.opacity = String(fmt(tn.op));
      t.band.setAttribute("d", roundRect(0, tileH - r, w, bandH + r, r));
      t.top.setAttribute("d", roundRect(0, 0, w, tileH, r));
      if (tn.swap >= 0.5 && t.shown !== t.wanted) { t.shown = t.wanted; t.text.textContent = t.wanted; }
      t.text.setAttribute("x", String(fmt(w / 2))); t.text.setAttribute("y", String(fmt(tileH / 2 + 3.7)));
      t.text.style.opacity = String(fmt(words * Math.abs(1 - 2 * Math.min(1, tn.swap)) ** 0.8));
      const tw = Math.min(w - 10, t.shown.length * LOG.mono);
      t.strike.setAttribute("x1", String(fmt(w / 2 - tw / 2 - 1))); t.strike.setAttribute("x2", String(fmt(w / 2 + tw / 2 + 1)));
      t.strike.setAttribute("y1", String(fmt(tileH / 2))); t.strike.setAttribute("y2", String(fmt(tileH / 2)));
      t.strike.style.opacity = String(fmt(words));
      t.off.setAttribute("x", String(fmt(tn.x + w / 2)));
      t.off.setAttribute("y", String(fmt(met.rulerY + met.ruler / 2 + 3.5)));
      t.off.style.opacity = String(fmt(words * clamp01(tn.op * 1.4 - 0.4)));
    }
    // the open slot and the next offset
    const sw = cfg.slotW;
    rd.slot.style.opacity = String(fmt(n.slotOp * Math.max(n.sa, n.sb)));
    rd.slotRect.setAttribute("d", roundRect(n.slotX, met.tileY, sw, tileH + bandH, r));
    rd.slotOff.setAttribute("x", String(fmt(n.slotX + sw / 2)));
    rd.slotOff.setAttribute("y", String(fmt(met.rulerY + met.ruler / 2 + 3.5)));
    if (n.slotSwap >= 0.5 && rd.slotOff.textContent !== rd.slotText) rd.slotOff.textContent = rd.slotText;
    rd.slotOff.style.opacity = String(fmt(words * Math.abs(1 - 2 * Math.min(1, n.slotSwap))));
    rd.ell.setAttribute("x", String(fmt(n.ellX)));
    rd.ell.setAttribute("y", String(fmt(met.tileY + tileH / 2 + 3.5)));
    rd.ell.style.opacity = String(fmt(n.ellOp * words));
    rd.clipRect.setAttribute("x", String(fmt(n.clipX)));
    // cursors under the ruler, watermarks through the tray, brackets over it
    for (const md of rd.marks.values()) {
      const mn = md.now;
      md.g.style.opacity = String(fmt(mn.op));
      if (md.kind === "ptr") {
        // a folded row's caret tucks just under its sliver, smaller but in its reader's tone, so a group spread over a
        // topic's partitions shows as one reader under each
        const y = met.laneY + (mn.lane ?? 0) * LOG.lane * n.full + 0.5 + n.full + (mn.rise ?? 0), k = 0.72 + 0.28 * n.full;
        md.mark.setAttribute("d", `M${fmt(mn.x)} ${fmt(y)}l${fmt(4.2 * k)} ${fmt(5.6 * k)}h${fmt(-8.4 * k)}Z`);
        md.text.setAttribute("x", String(fmt(mn.x + ((mn.side ?? 1) < 0 ? -7 : 7))));
        md.text.setAttribute("y", String(fmt(y + 8.4)));
        md.text.style.fillOpacity = String(fmt(words));
      } else if (md.kind === "line") {
        // a watermark: a line before its record, from its name over the tray down through the ruler
        const base = met.trayY - topBaseline(mn.lane ?? 0) * n.full, yTop = base - 8.5 * n.full;
        md.mark.setAttribute("d", `M${fmt(mn.x)} ${fmt(Math.min(yTop, met.trayY - 2))}V${fmt(met.rulerY + met.ruler + 2)}`);
        md.text.setAttribute("x", String(fmt(mn.x + ((mn.side ?? 1) < 0 ? -4 : 4))));
        md.text.setAttribute("y", String(fmt(base)));
        md.text.style.fillOpacity = String(fmt(words));
      } else {
        const y = met.trayY - 3;
        md.mark.setAttribute("d", `M${fmt(mn.x0 + 1)} ${fmt(y)}v-4H${fmt(mn.x1 - 1)}v4`);
        md.text.setAttribute("x", String(fmt((mn.x0 + mn.x1) / 2)));
        md.text.setAttribute("y", String(fmt(met.trayY - topBaseline(mn.lane ?? 0) * n.full)));
        md.text.style.fillOpacity = String(fmt(words));
      }
    }
  }

  // ---------- events ----------
  function findTile(logId: string, offset: number): { rd: RowD; t: TileD } | null {
    const rd = rowOf(logId);
    if (rd) for (const t of rd.tiles.values()) if (!t.gone && t.rec.offset === offset) return { rd, t };
    return null;
  }
  function rowOf(logId: string): RowD | undefined {
    const rd = stacks.get(nodeOfLog(logId))?.rows.get(logId);
    return rd && !rd.gone ? rd : undefined;
  }
  function refresh(logId: string, offset: number) {
    const f = findTile(logId, offset);
    if (f) setTileClass(f.t);
  }
  /** What an append's message says: its records, kept short. */
  const appendLabel = (e: Extract<StageEvent, { type: "append" }>) => e.records.map((r) => r.text).join(", ").slice(0, 22);
  const msFor = (entering: number) => 640 + Math.max(0, entering - 1) * 140;
  /** Is this log's row folded for the step playing (a reader stepping along a log the step isn't about)? */
  const folded = (logId: string) => plan(nodeOfLog(logId), ctx.model()).rows.find((r) => r.id === logId)?.full === 0;

  async function playLog(e: StageEvent, before: StageModel, after: StageModel, tk: Token): Promise<void> {
    if (e.type === "append") {
      const log = after.logs?.[e.log];
      if (e.from && log) await ctx.message([e.from, log.node], appendLabel(e), "request", tk);
      const entering = reconcile(after);
      await run(msFor(entering), tk, false);
      // an empty append is a log arriving (its `appear`): it shows without its part acknowledging a write
      if (log && e.records.length) ctx.bob(log.node);
      return;
    }
    if (e.type === "read") {
      const log = before.logs?.[e.log], f = findTile(e.log, e.at);
      const rec = log?.records.find((r) => r.offset === e.at);
      if (f) {
        lit.add(keyOf(e.log, e.at)); setTileClass(f.t);
        const t = f.t;
        await ctx.tween(320, tk, (p) => { t.now.dy = -4 * Math.sin(Math.PI * p); paint(); });
      }
      if (e.to && log) await ctx.message([log.node, e.to], e.label ?? rec?.text ?? "", e.kind ?? "response", tk);
      else await ctx.after(240, tk);
      lit.delete(keyOf(e.log, e.at)); read.add(keyOf(e.log, e.at));
      refresh(e.log, e.at);
      return;
    }
    if (e.type === "flush") {
      const src = before.logs?.[e.from], dst0 = before.logs?.[e.to], dst = after.logs?.[e.to], rd = rowOf(e.from);
      const launch: { rec: LogEntry; from: Point; key: string }[] = [], vanish = new Set<string>();
      if (src && dst0 && dst && rd) {
        // the records move to the end of the other log in the order they lay in this one
        const fresh = dst.records.filter((r) => r.offset >= dst0.next).sort((a, b) => a.offset - b.offset);
        const dstKeys = keys(dst.records), keyByRec = new Map(dst.records.map((r, i) => [r, dstKeys[i]]));
        const srcKeys = keys(src.records);
        src.records.forEach((r, i) => {
          const target = fresh[i], t = rd.tiles.get(srcKeys[i]);
          if (!target || !t || t.gone) return;
          launch.push({ rec: target, from: tileWorld(rd, t), key: keyByRec.get(target)! });
          vanish.add(`${e.from}:${srcKeys[i]}`);
        });
      }
      reconcile(after, { incoming: new Map([[e.to, new Set(launch.map((l) => l.key))]]), vanish });
      const w0 = cfgOf(nodeOfLog(e.from)).tileW;
      launch.forEach((l, i) => { const d0 = Math.min(0.32, i * 0.07); fly(l.rec, l.from, w0, e.to, l.key, d0, d0 + 0.62); });
      await run(1250, tk, false);
      return;
    }
    if (e.type === "compact") {
      const log = before.logs?.[e.log], out = after.logs?.[e.log];
      if (!log || !out) { reconcile(after); await run(640, tk, false); return; }
      const same = (a: LogEntry, b: LogEntry) => a.offset === b.offset && a.text === b.text && (a.key ?? "") === (b.key ?? "");
      // what goes first dims and is struck; then it sinks while the survivors close up into one tray
      for (const id of [e.log, ...(e.merge ?? [])]) for (const r of before.logs?.[id]?.records ?? []) {
        if (!out.records.some((x) => same(x, r))) { doomed.add(keyOf(id, r.offset)); refresh(id, r.offset); }
      }
      await ctx.after(420, tk);
      // survivors of the merged logs fly into this one
      const launch: { rec: LogEntry; from: Point; key: string; w0: number }[] = [], vanish = new Set<string>();
      const outKeys = keys(out.records);
      for (const id of e.merge ?? []) {
        const rd = rowOf(id), srcLog = before.logs?.[id];
        if (!rd || !srcLog) continue;
        const sk = keys(srcLog.records);
        srcLog.records.forEach((r, i) => {
          const j = out.records.findIndex((x) => same(x, r)), t = rd.tiles.get(sk[i]);
          if (j < 0 || !t || t.gone || log.records.some((x) => same(x, r))) return;
          launch.push({ rec: out.records[j], from: tileWorld(rd, t), key: outKeys[j], w0: cfgOf(nodeOfLog(id)).tileW });
          vanish.add(`${id}:${sk[i]}`);
        });
      }
      reconcile(after, { incoming: new Map([[e.log, new Set(launch.map((l) => l.key))]]), vanish });
      launch.forEach((l, i) => { const d0 = Math.min(0.3, i * 0.06); fly(l.rec, l.from, l.w0, e.log, l.key, d0, d0 + 0.62); });
      await run(launch.length ? 1150 : 900, tk, false);
      unmark(doomed);
      return;
    }
    if (e.type === "truncate") {
      const log = before.logs?.[e.log];
      const fall = new Set<string>();
      if (log) {
        const ks = keys(log.records);
        log.records.forEach((r, i) => { if (r.offset > e.after) { cut.add(keyOf(e.log, r.offset)); refresh(e.log, r.offset); fall.add(`${e.log}:${ks[i]}`); } });
      }
      await ctx.after(460, tk);
      reconcile(after, { fall });
      await run(820, tk, false);
      unmark(cut);
      return;
    }
    const entering = reconcile(after);
    // a reader stepping along a folded row is a small tick, not a beat of its own
    await run(e.type === "cursor" && folded(e.log) ? 300 : msFor(entering), tk, false);
  }

  // ---------- the figure ----------
  const fig: Figure = {
    handles: (e) => TYPES.has(e.type),
    bounds(m, k, list) {
      const s = ctx.labelScale(k);
      let b: Rect | null = null;
      for (const node of parts) {
        if (!list.includes(node) || !m.nodes[node]?.visible) continue;
        const r = box(node, ctx.goal(node, m), s, m);
        if (r) b = b ? { x0: Math.min(b.x0, r.x0), y0: Math.min(b.y0, r.y0), x1: Math.max(b.x1, r.x1), y1: Math.max(b.y1, r.y1) } : r;
      }
      return b;
    },
    below(id, m) {
      if (!ctx.narrow() || !parts.includes(id)) return 0;
      if (!plan(id, m).rows.length) return 0;
      // the strips of a row's parts stack under it
      return rowMates(id, m).reduce((sum, x, i) => sum + plan(x, m).h + (i ? MATE_GAP : 0), 0) + 12;
    },
    obstacles(id, at, m, s) {
      if (!parts.includes(id)) return [];
      const pl = plan(id, m);
      if (!pl.rows.length) return [];
      // each row as far as it is drawn now (its tray, its name, its cursors), so links and resting messages can come close
      const a = anchor(id, at, s, pl.h, m), left = leftOf(pl.cfg), pad = 3 * s;
      return pl.rows.map(({ row, met, full, y }) => {
        const { dx, dy } = trayDepth(full);
        return {
          x0: a.x - (pl.cfg.labelCol ? left : 0) * s - pad,
          y0: a.y + (y + met.trayY - Math.max(dy, topHeight(row.topLanes) * full)) * s - pad,
          x1: a.x + Math.max(full ? row.reach : 0, row.width + dx) * s + pad,
          y1: a.y + (y + met.h) * s + pad,
        };
      });
    },
    async render(m, tk, instant) {
      dropFlights();
      // a compaction or a crash that was cut short leaves no struck or orange records behind
      unmark(doomed, cut);
      const entering = reconcile(m, { stagger: true });
      await run(msFor(entering), tk, instant);
    },
    play: playLog,
    settle(e, m) {
      // of several messages carried the same way in one step, the still picture rests only the last: they would cover
      // each other
      const st = scene.steps[ctx.step()], events = st ? [...st.events, ...(st.control?.options.flatMap((o) => o.events) ?? [])] : [];
      const last = (way: (x: StageEvent) => string | null) => !events.includes(e) || !events.slice(events.indexOf(e) + 1).some((x) => way(x) === way(e));
      const nodeOf = (id: string) => m.logs?.[id]?.node ?? nodeOfLog(id);
      if (e.type === "append") {
        if (e.from && last((x) => (x.type === "append" && x.from ? `${x.from}>${nodeOf(x.log)}` : null))) ctx.rest([e.from, nodeOf(e.log)], appendLabel(e), "request");
        return;
      }
      if (e.type !== "read") return;
      read.add(keyOf(e.log, e.at)); refresh(e.log, e.at);
      const log = m.logs?.[e.log], rec = log?.records.find((r) => r.offset === e.at);
      if (!e.to || !log) return;
      if (!last((x) => (x.type === "read" && x.to ? `${nodeOf(x.log)}>${x.to}` : null))) return;
      ctx.rest([log.node, e.to], e.label ?? rec?.text ?? "", e.kind ?? "response");
    },
    clear() {
      dropFlights();
      unmark(lit, read, doomed, cut);
    },
    focus(list) {
      focusList = list;
      for (const sd of stacks.values()) {
        sd.inner.classList.toggle(styles.dim, !!focusList && !focusList.includes(sd.node));
        for (const rd of sd.rows.values()) for (const md of rd.marks.values()) markClass(md);
      }
    },
    layout: paint,
    resize() { cfgs[0].clear(); cfgs[1].clear(); plans = new WeakMap(); },
    destroy() { root.remove(); flightG.remove(); },
  };
  return fig;
};
