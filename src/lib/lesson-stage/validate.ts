// Checks a stage scene before it ships: every reference resolves and the words stay short enough to read while things move.
import type { StageEvent, StageScene } from "./types";
import { roleProblems } from "./roles.ts";

export const STAGE_LIMITS = { minSteps: 3, maxSteps: 8, titleChars: 44, shortChars: 18, textWords: 60, labelChars: 16, detailChars: 20, packetChars: 22, noteChars: 26 };
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
  const linked = (a: string, b: string) => scene.links.some((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
  for (const l of scene.links) { node(l.from, "a link"); node(l.to, "a link"); if (l.unless) node(l.unless, "a link"); }
  const metricIds = new Set((scene.metrics ?? []).map((m) => m.id));
  if (!scene.intro.trim()) problems.push(where("intro is empty"));
  if (scene.steps.length < STAGE_LIMITS.minSteps || scene.steps.length > STAGE_LIMITS.maxSteps) problems.push(where(`has ${scene.steps.length} steps, needs ${STAGE_LIMITS.minSteps}-${STAGE_LIMITS.maxSteps}`));

  const visible = new Set(scene.nodes.filter((n) => !n.appear).map((n) => n.id));
  const checkEvents = (events: StageEvent[], context: string) => {
    events.forEach((e, k) => {
      const at = `${context} event ${k + 1} (${e.type})`;
      if (e.type === "packet") {
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
    for (const id of Object.keys(step.metrics ?? {})) if (!metricIds.has(id)) problems.push(where(`${context} sets unknown metric "${id}"`));
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
  return problems;
}
