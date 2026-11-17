// How a stage's ring, logs and timeline change, worked out from the data alone (no DOM), so it can be tested. Loading
// this module plugs it into the model; the figures load it, and so do the checks and tests.
import { applyEvent, initialModel, registerFigureModel, stateBefore, stepEvents, type Choices, type LogEntry, type LogState, type RingState, type StageModel, type TimelineItem, type TimelineState } from "./model.ts";
import type { LogRecord, LogSpec, MetricValue, RingToken, StageEvent, StageMetric, StageScene } from "./types";

function newLog(spec: LogSpec): LogState {
  const log: LogState = {
    id: spec.id, node: spec.node, label: spec.label ?? "", visible: !(spec.appear && spec.appear > 0), sorted: !!spec.sorted,
    step: spec.step ?? 1, next: spec.start ?? 0, seg: 0, records: [], cursors: [], brackets: [],
  };
  appendTo(log, spec.records ?? []);
  return log;
}

// ---------- the ring ----------
const sortTokens = (tokens: RingToken[]) => tokens.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
/** The token that owns a position: the first at or after it, clockwise, wrapping past the top. */
export function ringOwner(ring: RingState, at: number): RingToken | undefined {
  return ring.tokens.find((t) => t.at >= at) ?? ring.tokens[0];
}
/** How many positions a token owns: back to the token before it. */
export function tokenSpan(ring: RingState, token: RingToken): number {
  const i = ring.tokens.indexOf(token), prev = ring.tokens[(i - 1 + ring.tokens.length) % ring.tokens.length];
  return ring.tokens.length === 1 ? ring.size : (token.at - prev.at + ring.size) % ring.size;
}
/** The share of the ring a part owns, 0 to 1. */
export function ringShare(ring: RingState, node: string): number {
  return ring.tokens.filter((t) => t.node === node).reduce((sum, t) => sum + tokenSpan(ring, t), 0) / ring.size;
}
/** The tokens a walk clockwise from a position meets, up to `count` of them (each part once when `distinct`), in one lap. */
export function preferenceList(ring: RingState, from: number, count: number, distinct = false): RingToken[] {
  const n = ring.tokens.length, start = Math.max(0, ring.tokens.findIndex((t) => t.at >= from));
  const first = ring.tokens.some((t) => t.at >= from) ? start : 0, out: RingToken[] = [];
  for (let k = 0; k < n && out.length < count; k++) {
    const t = ring.tokens[(first + k) % n];
    if (!distinct || !out.some((o) => o.node === t.node)) out.push(t);
  }
  return out;
}
/** The share of positions, 0 to 1, whose owning part differs between two rings of the same size. */
export function ringMoved(a: RingState | undefined, b: RingState | undefined): number {
  if (!a || !b || !a.tokens.length || !b.tokens.length) return 0;
  let moved = 0;
  for (let p = 0; p < a.size; p++) if (ringOwner(a, p)?.node !== ringOwner(b, p)?.node) moved++;
  return moved / a.size;
}
/** Where `count` unnamed keys land for a seed: spread round the ring, the same every time. */
export function scatter(size: number, count: number, seed = 1): number[] {
  let s = seed >>> 0 || 1;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: count }, (_, i) => Math.min(size - 1, Math.floor(((i + rand()) / count) * size))).sort((a, b) => a - b);
}

// ---------- logs ----------
function appendTo(log: LogState, records: LogRecord[]) {
  for (const r of records) {
    const entry: LogEntry = { ...r, offset: log.next, seg: log.seg };
    log.next += log.step;
    if (!log.sorted) { log.records.push(entry); continue; }
    const key = (e: LogRecord) => e.key ?? e.text;
    // a sorted log keeps one record per key, the newest
    const same = log.records.findIndex((e) => key(e) === key(entry));
    if (same >= 0) log.records.splice(same, 1);
    const at = log.records.findIndex((e) => key(e) > key(entry));
    log.records.splice(at < 0 ? log.records.length : at, 0, entry);
  }
}
/** The newest record per key (records without a key all stay), with tombstones and what they hide dropped. */
export function compacted(records: LogEntry[]): LogEntry[] {
  const newest = new Map<string, LogEntry>();
  for (const r of records) if (r.key !== undefined) newest.set(r.key, r);
  return records.filter((r) => (r.key === undefined ? !r.tomb : newest.get(r.key) === r && !r.tomb));
}

// ---------- the timeline ----------
function timelineStart(tl: TimelineState, e: { t?: number; with?: boolean }) {
  return e.t ?? (e.with ? tl.last : tl.clock);
}
function timelineAdd(tl: TimelineState, start: number, end: number) {
  tl.last = start;
  tl.clock = Math.max(tl.clock, end);
}
/** The latest time a scene's timeline reaches, at any step and with any control option. */
export function timelineSpan(scene: StageScene): number {
  if (scene.timeline?.span) return scene.timeline.span;
  let most = 1;
  const runs: Choices[] = [{}];
  scene.steps.forEach((step, i) => step.control?.options.forEach((_, j) => { if (j) runs.push({ [i]: j }); }));
  for (const choices of runs) {
    const model = initialModel(scene);
    for (let s = 0; s < scene.steps.length; s++) for (const e of stepEvents(scene, s, choices)) {
      applyEvent(model, e);
      if (model.timeline) most = Math.max(most, model.timeline.clock);
    }
  }
  return most;
}

/** Apply the lasting part of an event: what's shown, where, and in what state. Packets and notes leave nothing behind. */
// ---------- applying events ----------
function init(scene: StageScene, model: StageModel) {
  if (scene.layout === "ring" || scene.ring) {
    const r = scene.ring ?? { size: 100 };
    model.ring = { size: r.size, tokens: sortTokens((r.tokens ?? []).map((t) => ({ ...t }))), keys: (r.keys ?? []).map((k) => ({ ...k })), dots: [], arcs: [] };
  }
  if (scene.logs?.length) {
    model.logs = {};
    for (const spec of scene.logs) model.logs[spec.id] = newLog(spec);
  }
  if (scene.layout === "timeline") model.timeline = { clock: 0, last: 0, items: [] };
}

function apply(model: StageModel, event: StageEvent): void {
  if (model.ring && (event.type === "token" || event.type === "key" || event.type === "scatter" || event.type === "arc")) {
    const ring = model.ring;
    if (event.type === "token") {
      const gone = new Set(event.remove ?? []);
      ring.tokens = sortTokens([...ring.tokens.filter((t) => !gone.has(t.id) && !(event.add ?? []).some((a) => a.id === t.id)), ...(event.add ?? []).map((t) => ({ ...t }))]);
    } else if (event.type === "key") {
      ring.keys = ring.keys.filter((k) => k.id !== event.id);
      if (event.at !== null) ring.keys.push({ id: event.id, at: event.at, ...(event.label !== undefined ? { label: event.label } : {}) });
    } else if (event.type === "scatter") {
      ring.dots = scatter(ring.size, event.count, event.seed);
    } else {
      const old = ring.arcs.find((a) => a.id === event.id);
      ring.arcs = ring.arcs.filter((a) => a.id !== event.id);
      if (!event.remove) ring.arcs.push({ id: event.id, from: event.from ?? old?.from ?? 0, to: event.to ?? old?.to ?? 0, label: event.label ?? old?.label ?? "", tone: event.tone ?? old?.tone ?? "" });
    }
  } else if (model.logs && "log" in event && event.type !== "read") {
    const log = model.logs[event.log];
    if (!log) return;
    if (event.type === "append") { appendTo(log, event.records); log.visible = true; }
    else if (event.type === "cursor") {
      const old = log.cursors.find((c) => c.id === event.id);
      log.cursors = log.cursors.filter((c) => c.id !== event.id);
      if (event.at !== null) log.cursors.push({
        id: event.id, at: event.at === "end" ? log.next : event.at,
        label: event.label ?? old?.label ?? "", tone: event.tone ?? old?.tone ?? "", line: event.line ?? old?.line ?? false,
      });
    } else if (event.type === "roll") { if (log.records.some((r) => r.seg === log.seg)) log.seg++; }
    else if (event.type === "compact") {
      const sources = (event.merge ?? []).map((id) => model.logs![id]).filter(Boolean);
      const merged = compacted([...sources.flatMap((l) => l.records), ...log.records]).map((r) => ({ ...r, seg: 0 }));
      for (const l of sources) { l.records = []; l.cursors = []; l.brackets = []; l.visible = false; }
      log.records = merged;
      log.seg = merged.length ? 1 : 0;
    } else if (event.type === "truncate") {
      log.records = log.records.filter((r) => r.offset <= event.after);
      log.next = Math.min(log.next, event.after + log.step);
    } else if (event.type === "record") {
      const r = log.records.find((x) => x.offset === event.at);
      if (r) {
        if (event.text !== undefined) r.text = event.text;
        if (event.tone !== undefined) { if (event.tone) r.tone = event.tone; else delete r.tone; }
        if (event.tomb !== undefined) r.tomb = event.tomb;
      }
    } else if (event.type === "bracket") {
      const old = log.brackets.find((b) => b.id === event.id);
      log.brackets = log.brackets.filter((b) => b.id !== event.id);
      if (!event.remove) log.brackets.push({ id: event.id, from: event.from ?? old?.from ?? 0, to: event.to ?? old?.to ?? 0, label: event.label ?? old?.label ?? "", tone: event.tone ?? old?.tone ?? "" });
    }
  } else if (model.logs && event.type === "flush") {
    const from = model.logs[event.from], to = model.logs[event.to];
    if (!from || !to) return;
    appendTo(to, from.records.map(({ offset, seg, ...r }) => r));
    to.visible = true;
    from.records = [];
  } else if (model.timeline && (event.type === "packet" || event.type === "mark" || event.type === "span" || event.type === "rewind")) {
    const tl = model.timeline, n = tl.items.length + 1;
    if (event.type === "rewind") { tl.items = []; tl.clock = 0; tl.last = 0; return; }
    const t0 = timelineStart(tl, event);
    if (event.type === "packet") {
      const t1 = t0 + (event.dur ?? 1);
      tl.items.push({ kind: "message", id: `m${n}`, from: event.path[0], to: event.path[event.path.length - 1], t0, t1, label: event.label, flow: event.kind ?? "request", lost: !!event.lost });
      timelineAdd(tl, t0, t1);
    } else if (event.type === "mark") {
      tl.items.push({ kind: "mark", id: `k${n}`, node: event.node, t: t0, text: event.text, tone: event.tone ?? "" });
      timelineAdd(tl, t0, t0 + (event.dur ?? 0.5));
    } else if (event.end) {
      const span = tl.items.find((i): i is Extract<TimelineItem, { kind: "span" }> => i.kind === "span" && i.id === event.id && i.t1 === null);
      if (span) span.t1 = Math.max(span.t0, t0);
      timelineAdd(tl, t0, t0 + (event.dur ?? 0));
    } else {
      tl.items.push({ kind: "span", id: event.id, node: event.node ?? "", t0, t1: null, label: event.label ?? "", tone: event.tone ?? "" });
      timelineAdd(tl, t0, t0 + (event.dur ?? 0));
    }
  }
}

function derive(scene: StageScene, m: StageMetric, last: number, choices: Choices): MetricValue {
  const after = stateBefore(scene, last + 1, choices), d = m.derive!;
  if ("share" in d) return { n: after.ring ? Math.round(ringShare(after.ring, d.share) * 1000) / 10 : 0, unit: "%" };
  if ("moved" in d) return { n: Math.round(ringMoved(stateBefore(scene, last, choices).ring, after.ring) * 1000) / 10, unit: "%" };
  if ("lag" in d) {
    const log = after.logs?.[d.lag[0]], cursor = log?.cursors.find((c) => c.id === d.lag[1]);
    return log && cursor ? log.records.filter((r) => r.offset >= cursor.at).length : "—";
  }
  return { n: after.timeline?.clock ?? 0, unit: scene.timeline?.unit ? ` ${scene.timeline.unit}` : "" };
}

registerFigureModel({ init, apply, derive });
