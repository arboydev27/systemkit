// The state of a stage between steps, worked out from the data alone (no DOM), so it can be tested.
import type { GlyphOptions, Light, MetricValue, Place, StageEvent, StageScene, Tone } from "./types";

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
export type StageModel = { nodes: Record<string, NodeState> };
/** Which option each step's control is set to, by step index. */
export type Choices = Record<number, number>;

export function initialModel(scene: StageScene): StageModel {
  const nodes: Record<string, NodeState> = {};
  for (const n of scene.nodes) {
    nodes[n.id] = {
      visible: !(n.appear && n.appear > 0), at: [n.at[0], n.at[1]], label: n.label, detail: n.detail ?? "",
      light: "idle", readout: "", meter: null, tone: "", down: false, opts: { ...(n.opts ?? {}) },
    };
  }
  return { nodes };
}

export function cloneModel(model: StageModel): StageModel {
  const nodes: Record<string, NodeState> = {};
  for (const id in model.nodes) {
    const n = model.nodes[id];
    nodes[id] = { ...n, at: [n.at[0], n.at[1]], opts: { ...n.opts } };
  }
  return { nodes };
}

/** Apply the lasting part of an event: what's shown, where, and in what state. Packets and notes leave nothing behind. */
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
  }
}

export function stepEvents(scene: StageScene, index: number, choices: Choices = {}): StageEvent[] {
  const step = scene.steps[index];
  const control = step.control ? step.control.options[choices[index] ?? 0]?.events ?? [] : [];
  // A part with `appear` arrives at the start of its step unless the step shows it itself.
  const shownHere = new Set(step.events.flatMap((e) => (e.type === "show" ? e.nodes : [])));
  const arriving = scene.nodes.filter((n) => n.appear === index && !shownHere.has(n.id)).map((n) => n.id);
  return [...(arriving.length ? [{ type: "show" as const, nodes: arriving }] : []), ...step.events, ...control];
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
  for (let s = 0; s <= Math.min(index, scene.steps.length - 1); s++) {
    const step = scene.steps[s];
    Object.assign(values, step.metrics ?? {});
    if (step.control) Object.assign(values, step.control.options[choices[s] ?? 0]?.metrics ?? {});
  }
  return values;
}

export function formatMetric(value: MetricValue | undefined, n?: number): string {
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  const number = typeof value === "number" ? value : value.n;
  const unit = typeof value === "number" ? "" : value.unit ?? "";
  return Math.round(n ?? number).toLocaleString("en-US") + unit;
}
