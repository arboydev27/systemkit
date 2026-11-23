// Checks a stage scene before it ships: every reference resolves and the words stay short enough to read while things move.
// The .ts path lets the tests load this file as it is, with Node stripping the types.
import { applyEvent, cloneModel, initialModel, stepEvents, type StageModel } from "./model.ts";
import "./figure-model.ts";
import type { StageEvent, StageScene } from "./types";
import { roleProblems } from "./roles.ts";

export const STAGE_LIMITS = {
  minSteps: 3, maxSteps: 8, titleChars: 44, shortChars: 18, textWords: 60, labelChars: 16, detailChars: 20, packetChars: 22, noteChars: 26,
  // the ring
  ringSize: [8, 1000], ringMarks: 8, tokens: 16, tokenChars: 3, keys: 8, keyChars: 8, dots: 64, walk: 6, arcs: 3, arcChars: 16,
  // logs
  logs: 8, logsPerPart: 6, records: 40, recordChars: 12, logChars: 16, cursors: 3, cursorChars: 12, brackets: 2, bracketChars: 14,
  // the timeline
  lifelines: [2, 6], timelineItems: 40, markChars: 18, spanChars: 14, ticks: 8, unitChars: 4,
} as const;
const SIGNS = new Set(["+", "−", "~"]);

export function validateScene(scene: StageScene): string[] {
  const problems: string[] = [];
  const where = (s: string) => `${scene.id}: ${s}`;
  const ids = new Set<string>();
  for (const n of scene.nodes) {
    if (ids.has(n.id)) problems.push(where(`duplicate node "${n.id}"`));
    ids.add(n.id);
    if (n.label.length > STAGE_LIMITS.labelChars) problems.push(where(`node "${n.id}" label is longer than ${STAGE_LIMITS.labelChars} characters`));
    if ((n.detail ?? "").length > STAGE_LIMITS.detailChars) problems.push(where(`node "${n.id}" detail is longer than ${STAGE_LIMITS.detailChars} characters`));
    if (n.appear !== undefined && (n.appear < 1 || n.appear >= scene.steps.length)) problems.push(where(`node "${n.id}" appears at step ${n.appear}, outside 1-${scene.steps.length - 1}`));
  }
  for (const p of roleProblems(scene)) problems.push(where(p));
  const node = (id: string, context: string) => { if (!ids.has(id)) problems.push(where(`${context} names unknown node "${id}"`)); };
  const layout = scene.layout ?? "tiers", L = STAGE_LIMITS;
  if (!["tiers", "ring", "timeline"].includes(layout)) problems.push(where(`unknown layout "${layout}"`));
  if (layout === "ring" && !scene.ring) problems.push(where("a ring layout needs a ring"));
  if (scene.ring && layout !== "ring") problems.push(where("a ring needs layout \"ring\""));
  if (scene.timeline && layout !== "timeline") problems.push(where("timeline settings need layout \"timeline\""));
  if (scene.logs?.length && layout !== "tiers") problems.push(where("logs are drawn in the tiers layout only"));
  const size = scene.ring?.size ?? 100, onRing = (p: number) => Number.isInteger(p) && p >= 0 && p < size;
  if (scene.ring) {
    if (!(size >= L.ringSize[0] && size <= L.ringSize[1])) problems.push(where(`ring size ${size} is outside ${L.ringSize[0]}-${L.ringSize[1]}`));
    if ((scene.ring.marks ?? []).length > L.ringMarks) problems.push(where(`ring has more than ${L.ringMarks} marks`));
    for (const m of scene.ring.marks ?? []) if (!onRing(m)) problems.push(where(`ring mark ${m} is not a position on the ring`));
  }
  if (layout === "ring") for (const n of scene.nodes) if (!(n.at[0] >= 0 && n.at[0] < size && n.at[1] >= 0 && n.at[1] <= 3)) problems.push(where(`node "${n.id}" stands at [${n.at}], which is not [position 0-${size - 1}, distance 0-3]`));
  if (layout === "timeline") {
    const rows = scene.nodes.map((n) => n.at[0]);
    if (scene.nodes.length < L.lifelines[0] || scene.nodes.length > L.lifelines[1]) problems.push(where(`a timeline needs ${L.lifelines[0]}-${L.lifelines[1]} parts, has ${scene.nodes.length}`));
    for (const n of scene.nodes) if (!Number.isInteger(n.at[0]) || n.at[0] < 0 || n.at[1] !== 0) problems.push(where(`node "${n.id}" stands at [${n.at}]; on a timeline use [lifeline, 0]`));
    if (new Set(rows).size !== rows.length) problems.push(where("two parts share a lifeline"));
    if (scene.links.length) problems.push(where("a timeline draws no links; leave links empty"));
    const ticks = scene.timeline?.ticks ?? [];
    if (ticks.length > L.ticks) problems.push(where(`timeline has more than ${L.ticks} ticks`));
    if (ticks.some((t, i) => i > 0 && t <= ticks[i - 1])) problems.push(where("timeline ticks must rise"));
    if ((scene.timeline?.unit ?? "").length > L.unitChars) problems.push(where(`timeline unit is longer than ${L.unitChars} characters`));
  }
  const logIds = new Set<string>();
  for (const l of scene.logs ?? []) {
    if (logIds.has(l.id)) problems.push(where(`duplicate log "${l.id}"`));
    logIds.add(l.id);
    node(l.node, `log "${l.id}"`);
    if ((l.label ?? "").length > L.logChars) problems.push(where(`log "${l.id}" label is longer than ${L.logChars} characters`));
    if (l.appear !== undefined && (l.appear < 1 || l.appear >= scene.steps.length)) problems.push(where(`log "${l.id}" appears at step ${l.appear}, outside 1-${scene.steps.length - 1}`));
    if (l.step !== undefined && !(l.step > 0)) problems.push(where(`log "${l.id}" step must be above 0`));
    for (const r of l.records ?? []) if (r.text.length > L.recordChars) problems.push(where(`log "${l.id}" record "${r.text}" is longer than ${L.recordChars} characters`));
  }
  if ((scene.logs ?? []).length > L.logs) problems.push(where(`has more than ${L.logs} logs`));
  for (const id of ids) if ((scene.logs ?? []).filter((l) => l.node === id).length > L.logsPerPart) problems.push(where(`node "${id}" has more than ${L.logsPerPart} logs`));
  const log = (id: string, context: string) => { if (!logIds.has(id)) problems.push(where(`${context} names unknown log "${id}"`)); };
  const metricKinds = new Map((scene.metrics ?? []).map((m) => [m.id, m]));
  for (const m of scene.metrics ?? []) {
    const d = m.derive;
    if (!d) continue;
    if ("share" in d) { node(d.share, `metric "${m.id}"`); if (layout !== "ring") problems.push(where(`metric "${m.id}" derives a ring share without a ring`)); }
    else if ("moved" in d) { if (layout !== "ring") problems.push(where(`metric "${m.id}" derives ring moves without a ring`)); }
    else if ("lag" in d) log(d.lag[0], `metric "${m.id}"`);
    else if (layout !== "timeline") problems.push(where(`metric "${m.id}" derives a clock without a timeline`));
  }
  const linked = (a: string, b: string) => scene.links.some((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
  for (const l of scene.links) { node(l.from, "a link"); node(l.to, "a link"); if (l.unless) node(l.unless, "a link"); }
  const metricIds = new Set((scene.metrics ?? []).map((m) => m.id));
  if (!scene.intro.trim()) problems.push(where("intro is empty"));
  if (scene.steps.length < STAGE_LIMITS.minSteps || scene.steps.length > STAGE_LIMITS.maxSteps) problems.push(where(`has ${scene.steps.length} steps, needs ${STAGE_LIMITS.minSteps}-${STAGE_LIMITS.maxSteps}`));

  const visible = new Set(scene.nodes.filter((n) => !n.appear).map((n) => n.id));
  const checkEvents = (events: StageEvent[], context: string) => {
    events.forEach((e, k) => {
      const at = `${context} event ${k + 1} (${e.type})`;
      const timed = "t" in e || "dur" in e;
      if (timed && layout !== "timeline") problems.push(where(`${at} sets t or dur, which only a timeline uses`));
      if (timed && (((e as { t?: number }).t ?? 0) < 0 || ((e as { dur?: number }).dur ?? 1) < 0)) problems.push(where(`${at} has a negative t or dur`));
      const ringOnly = ["token", "key", "scatter", "walk", "arc"], logOnly = ["append", "cursor", "read", "roll", "compact", "flush", "truncate", "record", "bracket"], timelineOnly = ["mark", "span", "rewind"];
      if (ringOnly.includes(e.type) && layout !== "ring") problems.push(where(`${at} needs the ring layout`));
      if (timelineOnly.includes(e.type) && layout !== "timeline") problems.push(where(`${at} needs the timeline layout`));
      if (logOnly.includes(e.type) && !scene.logs?.length) problems.push(where(`${at} needs a log`));
      if (layout === "timeline" && (e.type === "stream" || e.type === "move")) problems.push(where(`${at} has no place on a timeline`));
      if (e.type === "packet" && layout === "timeline") {
        if (e.path.length !== 2 || e.path[0] === e.path[1]) problems.push(where(`${at} on a timeline goes from one lifeline to another: a path of two parts`));
        e.path.forEach((id) => node(id, at));
        if (e.label.length > STAGE_LIMITS.packetChars) problems.push(where(`${at} label "${e.label}" is longer than ${STAGE_LIMITS.packetChars} characters`));
        e.path.forEach((id) => { if (!visible.has(id)) problems.push(where(`${at} passes ${id} before it is shown`)); });
      } else if (e.type === "packet") {
        if (e.path.length < 2) problems.push(where(`${at} needs at least two nodes`));
        e.path.forEach((id) => node(id, at));
        for (let h = 0; h < e.path.length - 1; h++) if (!linked(e.path[h], e.path[h + 1])) problems.push(where(`${at} hops ${e.path[h]} → ${e.path[h + 1]} without a link`));
        if (e.label.length > STAGE_LIMITS.packetChars) problems.push(where(`${at} label "${e.label}" is longer than ${STAGE_LIMITS.packetChars} characters`));
        e.path.forEach((id) => { if (!visible.has(id)) problems.push(where(`${at} passes ${id} before it is shown`)); });
      } else if (e.type === "stream") {
        if (!e.routes.length) problems.push(where(`${at} has no routes`));
        for (const r of e.routes) {
          r.path.forEach((id) => node(id, at));
          for (let h = 0; h < r.path.length - 1; h++) if (!linked(r.path[h], r.path[h + 1])) problems.push(where(`${at} hops ${r.path[h]} → ${r.path[h + 1]} without a link`));
        }
      } else if (e.type === "note") {
        node(e.node, at);
        if (e.text.length > STAGE_LIMITS.noteChars) problems.push(where(`${at} text "${e.text}" is longer than ${STAGE_LIMITS.noteChars} characters`));
      } else if (e.type === "state") {
        const list = e.nodes ?? (e.node ? [e.node] : []);
        if (!list.length) problems.push(where(`${at} names no node`));
        list.forEach((id) => node(id, at));
        if (e.meter != null && (e.meter < 0 || e.meter > 1.5)) problems.push(where(`${at} meter ${e.meter} is outside 0-1.5`));
        if (e.label && e.label.length > STAGE_LIMITS.labelChars) problems.push(where(`${at} label is too long`));
      } else if (e.type === "show") {
        e.nodes.forEach((id) => { node(id, at); visible.add(id); });
        Object.keys(e.at ?? {}).forEach((id) => node(id, at));
      } else if (e.type === "hide") {
        e.nodes.forEach((id) => { node(id, at); visible.delete(id); });
      } else if (e.type === "move") {
        Object.keys(e.at).forEach((id) => node(id, at));
      } else if (e.type === "token") {
        for (const t of e.add ?? []) {
          node(t.node, at);
          if (!onRing(t.at)) problems.push(where(`${at} token "${t.id}" at ${t.at} is not a position on the ring`));
          if ((t.label ?? "").length > L.tokenChars) problems.push(where(`${at} token label "${t.label}" is longer than ${L.tokenChars} characters`));
        }
      } else if (e.type === "key") {
        if (e.at !== null && !onRing(e.at)) problems.push(where(`${at} key at ${e.at} is not a position on the ring`));
        if ((e.label ?? "").length > L.keyChars) problems.push(where(`${at} key label "${e.label}" is longer than ${L.keyChars} characters`));
        if (e.from) { node(e.from, at); if (!visible.has(e.from)) problems.push(where(`${at} comes from ${e.from} before it is shown`)); }
      } else if (e.type === "scatter") {
        if (!(e.count >= 0 && e.count <= L.dots)) problems.push(where(`${at} scatters ${e.count} keys, keep it to 0-${L.dots}`));
      } else if (e.type === "walk") {
        if (!onRing(e.from)) problems.push(where(`${at} starts at ${e.from}, not a position on the ring`));
        if (!(e.count >= 1 && e.count <= L.walk)) problems.push(where(`${at} walks to ${e.count} tokens, keep it to 1-${L.walk}`));
        if ((e.label ?? "").length > L.noteChars) problems.push(where(`${at} label is longer than ${L.noteChars} characters`));
      } else if (e.type === "arc") {
        for (const p of [e.from, e.to]) if (p !== undefined && !onRing(p)) problems.push(where(`${at} runs to ${p}, not a position on the ring`));
        if ((e.label ?? "").length > L.arcChars) problems.push(where(`${at} label is longer than ${L.arcChars} characters`));
      } else if (e.type === "append") {
        log(e.log, at);
        if (!e.records.length) problems.push(where(`${at} appends nothing`));
        for (const r of e.records) if (r.text.length > L.recordChars) problems.push(where(`${at} record "${r.text}" is longer than ${L.recordChars} characters`));
        if (e.from) { node(e.from, at); if (!visible.has(e.from)) problems.push(where(`${at} comes from ${e.from} before it is shown`)); }
      } else if (e.type === "cursor") {
        log(e.log, at);
        if ((e.label ?? "").length > L.cursorChars) problems.push(where(`${at} label "${e.label}" is longer than ${L.cursorChars} characters`));
      } else if (e.type === "read") {
        log(e.log, at);
        if (e.to) { node(e.to, at); if (!visible.has(e.to)) problems.push(where(`${at} goes to ${e.to} before it is shown`)); }
        if ((e.label ?? "").length > STAGE_LIMITS.packetChars) problems.push(where(`${at} label is longer than ${STAGE_LIMITS.packetChars} characters`));
      } else if (e.type === "roll" || e.type === "truncate") {
        log(e.log, at);
      } else if (e.type === "compact") {
        log(e.log, at);
        for (const m of e.merge ?? []) { log(m, at); if (m === e.log) problems.push(where(`${at} merges a log into itself`)); }
      } else if (e.type === "flush") {
        log(e.from, at); log(e.to, at);
        if (e.from === e.to) problems.push(where(`${at} flushes a log into itself`));
      } else if (e.type === "record") {
        log(e.log, at);
        if (e.text !== undefined && e.text.length > L.recordChars) problems.push(where(`${at} text "${e.text}" is longer than ${L.recordChars} characters`));
      } else if (e.type === "bracket") {
        log(e.log, at);
        if ((e.label ?? "").length > L.bracketChars) problems.push(where(`${at} label is longer than ${L.bracketChars} characters`));
      } else if (e.type === "mark") {
        node(e.node, at);
        if (!visible.has(e.node)) problems.push(where(`${at} marks ${e.node} before it is shown`));
        if (e.text.length > L.markChars) problems.push(where(`${at} text "${e.text}" is longer than ${L.markChars} characters`));
      } else if (e.type === "span") {
        if (!e.end) {
          if (!e.node) problems.push(where(`${at} starts a span without a node`));
          else { node(e.node, at); if (!visible.has(e.node)) problems.push(where(`${at} starts a span on ${e.node} before it is shown`)); }
        }
        if ((e.label ?? "").length > L.spanChars) problems.push(where(`${at} label "${e.label}" is longer than ${L.spanChars} characters`));
      }
    });
  };

  scene.steps.forEach((step, i) => {
    const context = `step ${i + 1}`;
    for (const n of scene.nodes) if (n.appear === i) visible.add(n.id);
    if (!step.title.trim() || step.title.length > STAGE_LIMITS.titleChars) problems.push(where(`${context} title must be 1-${STAGE_LIMITS.titleChars} characters`));
    if (!step.short.trim() || step.short.length > STAGE_LIMITS.shortChars) problems.push(where(`${context} short name must be 1-${STAGE_LIMITS.shortChars} characters`));
    const words = step.text.trim().split(/\s+/).length;
    if (!step.text.trim() || words > STAGE_LIMITS.textWords) problems.push(where(`${context} text has ${words} words, keep it to ${STAGE_LIMITS.textWords}`));
    if (!step.events.length && !step.control) problems.push(where(`${context} has nothing happening`));
    for (const id of [...(step.focus ?? []), ...(step.frame ?? [])]) node(id, `${context} focus`);
    for (const id of Object.keys(step.metrics ?? {})) {
      if (!metricIds.has(id)) problems.push(where(`${context} sets unknown metric "${id}"`));
      else if (metricKinds.get(id)?.derive) problems.push(where(`${context} sets metric "${id}", which the stage works out itself`));
    }
    for (const c of step.changes ?? []) if (!SIGNS.has(c[0]) || c[1] !== " ") problems.push(where(`${context} change "${c}" must start with "+ ", "− " or "~ "`));
    checkEvents(step.events, context);
    if (step.control) {
      if (step.control.options.length < 2) problems.push(where(`${context} control needs at least two options`));
      const snapshot = new Set(visible);
      step.control.options.forEach((o, j) => {
        for (const id of Object.keys(o.metrics ?? {})) if (!metricIds.has(id)) problems.push(where(`${context} option ${j + 1} sets unknown metric "${id}"`));
        visible.clear(); snapshot.forEach((id) => visible.add(id));
        checkEvents(o.events, `${context} option ${j + 1}`);
      });
    }
  });
  if (layout !== "tiers" || scene.logs?.length) problems.push(...figureProblems(scene).map(where));
  return problems;
}

/** What only shows by playing the scene: how many tokens, keys, cursors and timeline items are out at once, and spans
 * that end without having started. Every control option is played. */
function figureProblems(scene: StageScene): string[] {
  const L = STAGE_LIMITS, out = new Set<string>();
  const check = (m: StageModel, context: string, e: StageEvent) => {
    if (m.ring) {
      if (m.ring.tokens.length > L.tokens) out.add(`${context}: more than ${L.tokens} tokens on the ring`);
      if (m.ring.keys.length > L.keys) out.add(`${context}: more than ${L.keys} named keys on the ring`);
      if (m.ring.arcs.length > L.arcs) out.add(`${context}: more than ${L.arcs} arcs on the ring`);
      if (e.type === "walk" && !m.ring.tokens.length) out.add(`${context}: a walk on a ring with no tokens`);
    }
    for (const l of Object.values(m.logs ?? {})) {
      if (l.records.length > L.records) out.add(`${context}: log "${l.id}" holds more than ${L.records} records`);
      if (l.cursors.length > L.cursors) out.add(`${context}: log "${l.id}" has more than ${L.cursors} cursors`);
      if (l.brackets.length > L.brackets) out.add(`${context}: log "${l.id}" has more than ${L.brackets} brackets`);
      if (e.type === "read" && e.log === l.id && !l.records.some((r) => r.offset === e.at)) out.add(`${context}: reads offset ${e.at}, which log "${l.id}" doesn't hold`);
      if (e.type === "record" && e.log === l.id && !l.records.some((r) => r.offset === e.at)) out.add(`${context}: changes offset ${e.at}, which log "${l.id}" doesn't hold`);
    }
    if (m.timeline && m.timeline.items.length > L.timelineItems) out.add(`${context}: more than ${L.timelineItems} items on the timeline`);
  };
  const play = (m: StageModel, events: StageEvent[], context: string) => {
    events.forEach((e, k) => {
      const at = `${context} event ${k + 1} (${e.type})`;
      if (e.type === "token" && m.ring) for (const id of e.remove ?? []) if (!m.ring.tokens.some((t) => t.id === id)) out.add(`${at}: removes token "${id}", which isn't on the ring`);
      if (e.type === "span" && e.end && m.timeline && !m.timeline.items.some((i) => i.kind === "span" && i.id === e.id && i.t1 === null)) out.add(`${at}: ends span "${e.id}", which isn't open`);
      if (e.type === "span" && !e.end && m.timeline?.items.some((i) => i.kind === "span" && i.id === e.id && i.t1 === null)) out.add(`${at}: starts span "${e.id}" again while it is open`);
      if (e.type === "cursor" && e.at !== null && e.at !== "end" && m.logs?.[e.log] && e.at > m.logs[e.log].next) out.add(`${at}: puts cursor "${e.id}" past the end of log "${e.log}"`);
      applyEvent(m, e);
      check(m, at, e);
    });
  };
  const runs: Record<number, number>[] = [{}];
  scene.steps.forEach((step, i) => step.control?.options.forEach((_, j) => { if (j) runs.push({ [i]: j }); }));
  for (const choices of runs) {
    let m = initialModel(scene);
    scene.steps.forEach((_, i) => { const copy = cloneModel(m); play(copy, stepEvents(scene, i, choices), `step ${i + 1}`); m = copy; });
  }
  return [...out];
}
