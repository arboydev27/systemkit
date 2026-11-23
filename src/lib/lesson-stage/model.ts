// The state of a stage between steps, worked out from the data alone (no DOM), so it can be tested.
import type {
  GlyphOptions, Light, LogRecord, MarkTone, MetricValue, Place, RingKey, RingToken, StageEvent, StageMetric, StageScene, Tone,
} from "./types";

export type NodeState = {
  visible: boolean;
  at: Place;
  label: string;
  detail: string;
  light: Light;
  readout: string;
  meter: number | null;
  tone: Tone;
  down: boolean;
  opts: GlyphOptions;
};
export type RingArc = { id: string; from: number; to: number; label: string; tone: MarkTone | "" };
export type RingState = { size: number; tokens: RingToken[]; keys: RingKey[]; dots: number[]; arcs: RingArc[] };
export type LogEntry = LogRecord & { offset: number; seg: number };
export type LogCursor = { id: string; at: number; label: string; tone: MarkTone | ""; line: boolean };
export type LogBracket = { id: string; from: number; to: number; label: string; tone: MarkTone | "" };
export type LogState = {
  id: string; node: string; label: string; visible: boolean; sorted: boolean; step: number;
  /** The offset the next record gets, and the segment it joins. */
  next: number; seg: number;
  records: LogEntry[]; cursors: LogCursor[]; brackets: LogBracket[];
};
export type TimelineItem =
  | { kind: "message"; id: string; from: string; to: string; t0: number; t1: number; label: string; flow: string; lost: boolean }
  | { kind: "mark"; id: string; node: string; t: number; text: string; tone: MarkTone | "" }
  | { kind: "span"; id: string; node: string; t0: number; t1: number | null; label: string; tone: MarkTone | "" };
/** `clock` is when the next item starts by default, `last` when the item before started (for `with`). */
export type TimelineState = { clock: number; last: number; items: TimelineItem[] };
export type StageModel = {
  nodes: Record<string, NodeState>;
  ring?: RingState;
  logs?: Record<string, LogState>;
  timeline?: TimelineState;
};
/** Which option each step's control is set to, by step index. */
export type Choices = Record<number, number>;

/** How the ring, logs and timeline change. It lives in figure-model.ts, which the figures and the checks load, so a
 * lesson drawn only in tiers never downloads it; until it loads, those events change nothing. */
export type FigureModel = {
  init(scene: StageScene, model: StageModel): void;
  apply(model: StageModel, event: StageEvent): void;
  derive(scene: StageScene, metric: StageMetric, index: number, choices: Choices): MetricValue;
};
let figures: FigureModel | null = null;
export function registerFigureModel(model: FigureModel) { figures = model; }

export function initialModel(scene: StageScene): StageModel {
  const nodes: Record<string, NodeState> = {};
  for (const n of scene.nodes) {
    nodes[n.id] = {
      visible: !(n.appear && n.appear > 0), at: [n.at[0], n.at[1]], label: n.label, detail: n.detail ?? "",
      light: "idle", readout: "", meter: null, tone: "", down: false, opts: { ...(n.opts ?? {}) },
    };
  }
  const model: StageModel = { nodes };
  figures?.init(scene, model);
  return model;
}

export function cloneModel(model: StageModel): StageModel {
  const nodes: Record<string, NodeState> = {};
  for (const id in model.nodes) {
    const n = model.nodes[id];
    nodes[id] = { ...n, at: [n.at[0], n.at[1]], opts: { ...n.opts } };
  }
  const copy: StageModel = { nodes };
  for (const k of ["ring", "logs", "timeline"] as const) if (model[k]) Object.assign(copy, { [k]: structuredClone(model[k]) });
  return copy;
}

export function applyEvent(model: StageModel, event: StageEvent): void {
  if (event.type === "show") {
    for (const id of event.nodes) model.nodes[id].visible = true;
    for (const id in event.at ?? {}) model.nodes[id].at = event.at![id];
  } else if (event.type === "hide") {
    for (const id of event.nodes) model.nodes[id].visible = false;
  } else if (event.type === "move") {
    for (const id in event.at) model.nodes[id].at = event.at[id];
  } else if (event.type === "state") {
    for (const id of event.nodes ?? (event.node ? [event.node] : [])) {
      const s = model.nodes[id];
      if (event.light !== undefined) s.light = event.light;
      if (event.readout !== undefined) s.readout = event.readout;
      if (event.meter !== undefined) s.meter = event.meter;
      if (event.tone !== undefined) s.tone = event.tone;
      if (event.down !== undefined) s.down = event.down;
      if (event.label !== undefined) s.label = event.label;
      if (event.detail !== undefined) s.detail = event.detail;
      if (event.opts) s.opts = { ...s.opts, ...event.opts };
      if (event.at) s.at = event.at;
    }
  } else figures?.apply(model, event);

}

export function stepEvents(scene: StageScene, index: number, choices: Choices = {}): StageEvent[] {
  const step = scene.steps[index];
  const control = step.control ? step.control.options[choices[index] ?? 0]?.events ?? [] : [];
  // A part with `appear` arrives at the start of its step unless the step shows it itself.
  const shownHere = new Set(step.events.flatMap((e) => (e.type === "show" ? e.nodes : [])));
  const arriving = scene.nodes.filter((n) => n.appear === index && !shownHere.has(n.id)).map((n) => n.id);
  // So does a log with `appear` (as an empty append), unless the step writes into it, which shows it as it does.
  const written = new Set(step.events.flatMap((e) => (e.type === "append" || e.type === "compact" ? [e.log] : e.type === "flush" ? [e.to] : [])));
  const logs = (scene.logs ?? []).filter((l) => l.appear === index && !written.has(l.id)).map((l) => ({ type: "append" as const, log: l.id, records: [] }));
  return [...(arriving.length ? [{ type: "show" as const, nodes: arriving }] : []), ...logs, ...step.events, ...control];
}

/** The stage as it stands when step `index` begins (0 is the start, `steps.length` the end). */
export function stateBefore(scene: StageScene, index: number, choices: Choices = {}): StageModel {
  const model = initialModel(scene);
  for (let s = 0; s < Math.min(index, scene.steps.length); s++) for (const event of stepEvents(scene, s, choices)) applyEvent(model, event);
  return model;
}

/** The numbers shown over the stage after step `index`, carried forward from earlier steps. */
export function metricsAt(scene: StageScene, index: number, choices: Choices = {}): Record<string, MetricValue> {
  const values: Record<string, MetricValue> = {};
  const last = Math.min(index, scene.steps.length - 1);
  for (let s = 0; s <= last; s++) {
    const step = scene.steps[s];
    Object.assign(values, step.metrics ?? {});
    if (step.control) Object.assign(values, step.control.options[choices[s] ?? 0]?.metrics ?? {});
  }
  if (last >= 0) for (const m of scene.metrics ?? []) if (m.derive) values[m.id] = figures?.derive(scene, m, last, choices) ?? "—";
  return values;
}

/** Whose numbers the chips show while step `index` plays (`settled` false) and once it has: they change once the step has
 * played what changes them, so while it plays they are the step before's. A step that starts by rewinding the timeline
 * clears the picture those numbers describe and tells the story again, so it shows its own from the start. */
export function shownMetricStep(scene: StageScene, index: number, settled: boolean): number {
  if (settled || index < 0) return index;
  return scene.steps[index]?.events[0]?.type === "rewind" ? index : index - 1;
}

export function formatMetric(value: MetricValue | undefined, n?: number): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  const number = typeof value === "number" ? value : value.n;
  const unit = typeof value === "number" ? "" : value.unit ?? "";
  return Math.round(n ?? number).toLocaleString("en-US") + unit;
}
