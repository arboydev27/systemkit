import type { Point, SpatialLink, SpatialNode, SpatialScene } from "./spatial-model";
import type {
  DiagramStatus, ExplanationScene, LearningGroup, LearningLink, LearningNode, LearningScene,
  PresentationOptions, RelationMeaning, ScenePresentation, SpatialLesson, TeachingContent,
} from "./spatial-learning-types";

const WIDTH = 112, HEIGHT = 72, COLUMN = 192, TIER = 182, CLEARANCE = 16;
const meanings: RelationMeaning[] = ["request", "response", "read", "write", "replication", "publish", "delivery", "acknowledgement", "decision", "connection"];
const statuses: DiagramStatus[] = ["unavailable", "under-pressure", "active"];
const copyNode = (node: LearningNode): LearningNode => ({ ...node, ...(node.members ? { members: [...node.members] } : {}) });
const copyLink = (link: LearningLink): LearningLink => ({ ...link, points: link.points.map(p => [...p] as Point), origins: [...link.origins] });
const unique = <T,>(items: T[]): T[] => [...new Set(items)];
function fail(message: string): never { throw new Error(`Invalid spatial lesson: ${message}`); }

function inferredMeaning(label: string): RelationMeaning {
  if (/replicat|\bcopy\b|\bsync\b/i.test(label)) return "replication";
  if (/\back(?:nowledge|nowledgement|nowledgment)?\b/i.test(label)) return "acknowledgement";
  if (/\bwrite|\bpersist|\bsave/i.test(label)) return "write";
  if (/\bread|\blookup/i.test(label)) return "read";
  if (/\bpublish/i.test(label)) return "publish";
  if (/\bdeliver/i.test(label)) return "delivery";
  if (/\bresponse|\breturn/i.test(label)) return "response";
  if (/\brequest/i.test(label)) return "request";
  if (/\bdecision|\ballow|\breject|\bchoose/i.test(label)) return "decision";
  return "connection";
}

function kindLane(kind: string): number | undefined {
  if (["browser", "phone", "client", "device", "player", "person", "user"].includes(kind)) return 0;
  if (["balancer", "router", "gateway", "dns", "cdn", "network"].includes(kind)) return 1;
  if (["server", "combined", "api", "service", "provider", "region"].includes(kind)) return 2;
  if (["database", "storage", "store", "cache", "index", "bucket", "queue", "stream", "event", "inbox"].includes(kind)) return 3;
  if (["worker", "scheduler", "parser", "process"].includes(kind)) return 4;
  return undefined;
}

/** Rank only the supplied graph. Cycles form peers instead of invented pipeline stages. */
function graphRanks(nodes: SpatialNode[], links: SpatialLink[]): Map<string, number> {
  const ids = new Set(nodes.map(n => n.id)), adjacency = new Map(nodes.map(n => [n.id, [] as string[]]));
  for (const link of links) if (link.source && link.target && ids.has(link.source) && ids.has(link.target) && link.source !== link.target) adjacency.get(link.source)!.push(link.target);
  let counter = 0;
  const index = new Map<string, number>(), low = new Map<string, number>(), stack: string[] = [], active = new Set<string>(), components: string[][] = [];
  const visit = (id: string) => {
    index.set(id, counter); low.set(id, counter++); stack.push(id); active.add(id);
    for (const next of adjacency.get(id)!) {
      if (!index.has(next)) { visit(next); low.set(id, Math.min(low.get(id)!, low.get(next)!)); }
      else if (active.has(next)) low.set(id, Math.min(low.get(id)!, index.get(next)!));
    }
    if (low.get(id) === index.get(id)) {
      const group: string[] = []; let next: string;
      do { next = stack.pop()!; active.delete(next); group.push(next); } while (next !== id);
      components.push(group);
    }
  };
  nodes.forEach(n => { if (!index.has(n.id)) visit(n.id); });
  const component = new Map(components.flatMap((members, i) => members.map(id => [id, i] as const)));
  const parents = components.map(() => new Set<number>());
  for (const [source, targets] of adjacency) for (const target of targets) if (component.get(source) !== component.get(target)) parents[component.get(target)!].add(component.get(source)!);
  const ranks = new Map<number, number>();
  const rank = (id: number): number => { if (!ranks.has(id)) ranks.set(id, parents[id].size ? 1 + Math.max(...[...parents[id]].map(rank)) : 0); return ranks.get(id)!; };
  return new Map(nodes.map(n => [n.id, rank(component.get(n.id)!)]));
}

function positionNodes(base: SpatialScene, content: TeachingContent, force?: "pipeline" | "peers"): LearningNode[] {
  const layout = force ?? content.layout, ranks = graphRanks(base.nodes, base.links);
  const conceptual = base.nodes.every(n => kindLane(n.kind) === undefined);
  const pipeline = layout === "pipeline" || (layout === "authored" || layout === "tiers") && conceptual && base.links.length > 0;
  const peers = layout === "peers" || (layout === "authored" || layout === "tiers") && conceptual && base.links.length === 0;
  const occupied = new Map<number, Set<number>>(), counts = new Map<number, number>();
  const result = base.nodes.map((node, index): LearningNode => {
    const role = !force ? content.nodeRoles?.[node.id] : undefined;
    let lane = role?.lane ?? (pipeline ? ranks.get(node.id)! : peers ? Math.floor(index / 3) : kindLane(node.kind) ?? ranks.get(node.id)!);
    let slot = role?.order, row = lane;
    if (pipeline) { slot = role?.lane ?? ranks.get(node.id)!; row = role?.order ?? counts.get(slot) ?? 0; counts.set(slot, row + 1); lane = slot; }
    else {
      const used = occupied.get(lane) ?? new Set<number>();
      if (slot === undefined) { slot = peers ? index % 3 : 0; while (used.has(slot)) slot++; }
      if (used.has(slot)) fail(`nodes share lane ${lane} and order ${slot}; give each node a distinct order`);
      used.add(slot); occupied.set(lane, used);
    }
    return { ...node, x: 40 + slot * COLUMN, y: 50 + (pipeline ? row : lane) * TIER, width: WIDTH, height: HEIGHT,
      semanticId: (node as Partial<LearningNode>).semanticId ?? content.nodeRoles?.[node.id]?.semanticId ?? node.id, lane };
  });
  if (!force && base.guide === "ring") {
    result.forEach((node, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / result.length; node.x = 360 + 230 * Math.cos(angle) - WIDTH / 2; node.y = 300 + 230 * Math.sin(angle) - HEIGHT / 2; });
  } else if (!force && base.guide === "timeline") {
    result.forEach((node, index) => { node.x = 40 + index * COLUMN; node.y = index % 2 ? 224 : 50; });
  } else if (!force && base.id === "id-layout") {
    // Bit fields retain their declared left-to-right order, without SVG proportions implying capacity.
    result.forEach((node, index) => { node.x = 40 + index * COLUMN; node.y = 50; node.lane = 0; });
  }
  return result;
}

type Rect = { left: number; right: number; top: number; bottom: number };
type Side = "left" | "right" | "top" | "bottom";
type Port = { point: Point; escape: Point };
const rect = (node: SpatialNode, margin = 0): Rect => ({ left: node.x - margin, right: node.x + node.width + margin, top: node.y - margin, bottom: node.y + node.height + margin });
function crosses(a: Point, b: Point, obstacle: Rect): boolean {
  if (a[0] === b[0]) return a[0] > obstacle.left + .001 && a[0] < obstacle.right - .001 && Math.max(a[1], b[1]) > obstacle.top + .001 && Math.min(a[1], b[1]) < obstacle.bottom - .001;
  if (a[1] === b[1]) return a[1] > obstacle.top + .001 && a[1] < obstacle.bottom - .001 && Math.max(a[0], b[0]) > obstacle.left + .001 && Math.min(a[0], b[0]) < obstacle.right - .001;
  return true;
}
function sideFor(node: SpatialNode, other: SpatialNode | undefined, source: boolean): Side {
  if (!other) return source ? "right" : "left";
  if (other.id === node.id) return source ? "right" : "top";
  const dx = other.x + other.width / 2 - node.x - node.width / 2, dy = other.y + other.height / 2 - node.y - node.height / 2;
  return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "bottom" : "top";
}
function port(node: SpatialNode, side: Side, index: number, count: number): Port {
  const horizontal = side === "top" || side === "bottom", size = horizontal ? node.width : node.height;
  const offset = count === 1 ? 0 : (index / (count - 1) - .5) * size * .65;
  const point: Point = horizontal ? [node.x + node.width / 2 + offset, side === "top" ? node.y : node.y + node.height] : [side === "left" ? node.x : node.x + node.width, node.y + node.height / 2 + offset];
  const escape: Point = [...point]; escape[horizontal ? 1 : 0] += (side === "left" || side === "top" ? -1 : 1) * (CLEARANCE + 2);
  return { point, escape };
}
function compact(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length && result[result.length - 1][0] === point[0] && result[result.length - 1][1] === point[1]) continue;
    while (result.length > 1) { const a = result[result.length - 2], b = result[result.length - 1]; if (a[0] === b[0] && b[0] === point[0] || a[1] === b[1] && b[1] === point[1]) result.pop(); else break; }
    result.push(point);
  }
  return result;
}
class MinHeap {
  private entries: { state: number; cost: number }[] = [];
  push(state: number, cost: number) { const item = { state, cost }; let index = this.entries.length; this.entries.push(item); while (index) { const parent = Math.floor((index - 1) / 2); if (this.entries[parent].cost <= cost) break; this.entries[index] = this.entries[parent]; index = parent; } this.entries[index] = item; }
  pop() { const first = this.entries[0], last = this.entries.pop(); if (!first) return undefined; if (this.entries.length && last) { let index = 0; while (index * 2 + 1 < this.entries.length) { let child = index * 2 + 1; if (child + 1 < this.entries.length && this.entries[child + 1].cost < this.entries[child].cost) child++; if (this.entries[child].cost >= last.cost) break; this.entries[index] = this.entries[child]; index = child; } this.entries[index] = last; } return first; }
}
function overlapLength(a: Point, b: Point, c: Point, d: Point): number {
  if (a[0] === b[0] && c[0] === d[0] && a[0] === c[0]) return Math.max(0, Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) - Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])));
  if (a[1] === b[1] && c[1] === d[1] && a[1] === c[1]) return Math.max(0, Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) - Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])));
  return 0;
}

/** Visibility-grid routing uses endpoint ports and empty corridors, never a node's interior. */
function route(start: Point, end: Point, nodes: LearningNode[], track: number, previous: Point[][]): Point[] {
  if (start[0] === end[0] && start[1] === end[1]) return [start, end];
  const obstacles = nodes.map(n => rect(n, CLEARANCE));
  const minX = Math.min(start[0], end[0], ...obstacles.map(r => r.left)), maxX = Math.max(start[0], end[0], ...obstacles.map(r => r.right));
  const minY = Math.min(start[1], end[1], ...obstacles.map(r => r.top)), maxY = Math.max(start[1], end[1], ...obstacles.map(r => r.bottom));
  const extra = 28 + track * 8;
  const xs = unique([start[0], end[0], minX - extra, maxX + extra, ...obstacles.flatMap(r => [r.left - 2 - track * 2, r.right + 2 + track * 2])]).sort((a, b) => a - b);
  const ys = unique([start[1], end[1], minY - extra, maxY + extra, ...obstacles.flatMap(r => [r.top - 2 - track * 2, r.bottom + 2 + track * 2])]).sort((a, b) => a - b);
  const columns = xs.length, total = columns * ys.length, point = (id: number): Point => [xs[id % columns], ys[Math.floor(id / columns)]];
  const source = ys.indexOf(start[1]) * columns + xs.indexOf(start[0]), target = ys.indexOf(end[1]) * columns + xs.indexOf(end[0]);
  const distances = new Float64Array(total * 3).fill(Infinity), parents = new Int32Array(total * 3).fill(-1), heap = new MinHeap();
  const initial = source * 3; distances[initial] = 0; heap.push(initial, 0); let destination = -1;
  while (true) {
    const item = heap.pop(); if (!item) break;
    if (item.cost !== distances[item.state]) continue;
    const id = Math.floor(item.state / 3), direction = item.state % 3;
    if (id === target) { destination = item.state; break; }
    const x = id % columns, y = Math.floor(id / columns), a = point(id);
    for (const next of [x > 0 ? id - 1 : -1, x + 1 < columns ? id + 1 : -1, y > 0 ? id - columns : -1, y + 1 < ys.length ? id + columns : -1]) {
      if (next < 0) continue; const b = point(next);
      if (obstacles.some(obstacle => crosses(a, b, obstacle))) continue;
      const nextDirection = a[0] === b[0] ? 2 : 1;
      let shared = 0; for (const path of previous) for (let i = 1; i < path.length; i++) shared += overlapLength(a, b, path[i - 1], path[i]);
      const cost = item.cost + Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + (direction && direction !== nextDirection ? 24 : 0) + shared * 8;
      const state = next * 3 + nextDirection;
      if (cost < distances[state]) { distances[state] = cost; parents[state] = item.state; heap.push(state, cost); }
    }
  }
  if (destination < 0) fail("no obstacle-free connection corridor");
  const path: Point[] = []; for (let state = destination; state >= 0; state = parents[state]) path.push(point(Math.floor(state / 3)));
  return compact(path.reverse());
}

function routeLinks(nodes: LearningNode[], links: LearningLink[]): LearningLink[] {
  const byId = new Map(nodes.map(n => [n.id, n])), incidents = new Map<string, string[]>(), sides = new Map<string, Side>();
  const token = (link: LearningLink, source: boolean) => `${link.id}:${source ? "source" : "target"}`;
  for (const link of links) for (const source of [true, false]) {
    const id = source ? link.source : link.target, other = source ? link.target : link.source;
    if (!id) continue; const node = byId.get(id); if (!node) fail(`connection ${link.id} references missing node ${id}`);
    const side = sideFor(node, other ? byId.get(other) : undefined, source), key = `${id}:${side}`, list = incidents.get(key) ?? [];
    sides.set(token(link, source), side); list.push(token(link, source)); incidents.set(key, list);
  }
  for (const list of incidents.values()) list.sort();
  const minX = Math.min(40, ...nodes.map(n => n.x)), maxX = Math.max(152, ...nodes.map(n => n.x + n.width)), minY = Math.min(50, ...nodes.map(n => n.y));
  const previous: Point[][] = [];
  return links.map((link, index) => {
    const getPort = (source: boolean): Port => {
      const id = source ? link.source : link.target;
      if (!id) { const otherId = source ? link.target : link.source, other = otherId ? byId.get(otherId) : undefined;
        const point: Point = [source ? minX - 70 - index * 8 : maxX + 70 + index * 8, other ? other.y + other.height / 2 : minY - 70 - index * 12];
        return { point, escape: point };
      }
      const node = byId.get(id)!, side = sides.get(token(link, source))!, list = incidents.get(`${id}:${side}`)!;
      return port(node, side, list.indexOf(token(link, source)), list.length);
    };
    const start = getPort(true), end = getPort(false);
    const path = compact([start.point, ...route(start.escape, end.escape, nodes, index, previous), end.point]);
    previous.push(path); return { ...link, points: path, origins: [...link.origins] };
  });
}

function groupBounds(group: TeachingContent["groups"][number], nodes: LearningNode[]): LearningGroup | undefined {
  const members = group.members.filter(id => nodes.some(n => n.id === id)), selected = nodes.filter(n => members.includes(n.id));
  if (!selected.length) return undefined;
  const minX = Math.min(...selected.map(n => n.x)), maxX = Math.max(...selected.map(n => n.x + n.width));
  const minY = Math.min(...selected.map(n => n.y)), maxY = Math.max(...selected.map(n => n.y + n.height));
  return { ...group, members, x: minX - 24, y: minY - 38, width: maxX - minX + 48, height: maxY - minY + 62 };
}

export function layoutSpatialScene(chapterId: string, lessonId: string, base: SpatialScene, content: TeachingContent): LearningScene {
  const ids = new Set(base.nodes.map(n => n.id));
  if (ids.size !== base.nodes.length) fail("duplicate node IDs");
  for (const [id, role] of Object.entries(content.nodeRoles ?? {})) { if (!ids.has(id)) fail(`node role references missing node ${id}`); if (!Number.isInteger(role.lane) || role.lane < 0 || role.order !== undefined && (!Number.isInteger(role.order) || role.order < 0)) fail(`invalid lane or order for ${id}`); }
  const linkIds = new Set(base.links.map(l => l.id));
  for (const [id, relation] of Object.entries(content.relationships ?? {})) { if (!linkIds.has(id)) fail(`relationship references missing connection ${id}`); for (const endpoint of [relation.source, relation.target]) if (endpoint !== undefined && !ids.has(endpoint)) fail(`relationship ${id} references missing node ${endpoint}`); }
  const links: LearningLink[] = base.links.map(link => {
    const relation = content.relationships?.[link.id];
    return { ...link, points: link.points.map(point => [...point] as Point), source: relation?.source ?? link.source, target: relation?.target ?? link.target,
      meaning: relation?.meaning ?? inferredMeaning(link.label), condition: relation?.condition ?? "", explanation: relation?.explanation ?? link.label, origins: [link.id] };
  });
  const nodes = positionNodes({ ...base, links }, content);
  const groups = content.groups.map(group => groupBounds(group, nodes)).filter((group): group is LearningGroup => !!group);
  const guidePath: Point[] | undefined = base.guide === "ring" ? Array.from({ length: 97 }, (_, i) => [360 + 230 * Math.cos(i * Math.PI * 2 / 96), 300 + 230 * Math.sin(i * Math.PI * 2 / 96)] as Point) : base.guide === "timeline" ? [[40, 173], [40 + Math.max(0, nodes.length - 1) * COLUMN + WIDTH, 173]] : undefined;
  const scene: LearningScene = { ...base, chapterId, lessonId, nodes, links: routeLinks(nodes, links), groups, ...(guidePath ? { guidePath } : {}) };
  validateSpatialLesson({ scene, content }); return scene;
}

function validateExplanation(explanation: ExplanationScene, nodeIds: Set<string>, linkIds: Set<string>, viewIds: Set<string>, label: string) {
  for (const id of [...explanation.nodeIds, ...(explanation.revealNodeIds ?? []), ...Object.keys(explanation.statuses ?? {})]) if (!nodeIds.has(id)) fail(`${label} references missing node ${id}`);
  for (const id of explanation.linkIds) if (!linkIds.has(id)) fail(`${label} references missing connection ${id}`);
  if (explanation.viewId && !viewIds.has(explanation.viewId)) fail(`${label} references missing view ${explanation.viewId}`);
  for (const value of Object.values(explanation.statuses ?? {})) if (!statuses.includes(value)) fail(`${label} has unknown status ${value}`);
}

/** Reject authored references before an interaction can silently alter the lesson. */
export function validateSpatialLesson({ scene, content }: SpatialLesson): void {
  const nodeIds = new Set(scene.nodes.map(n => n.id)), linkIds = new Set(scene.links.map(l => l.id)), groupIds = new Set(content.groups.map(g => g.id)), viewIds = new Set(content.views.map(v => v.id));
  if (!scene.nodes.length || nodeIds.size !== scene.nodes.length) fail("empty model or duplicate node IDs");
  if (new Set(scene.nodes.map(node => node.semanticId)).size !== scene.nodes.length) fail("duplicate semantic node identities");
  if (linkIds.size !== scene.links.length) fail("duplicate connection IDs");
  if (groupIds.size !== content.groups.length) fail("duplicate group IDs");
  if (viewIds.size !== content.views.length) fail("duplicate teaching view IDs");
  if (!(["tiers", "pipeline", "peers", "authored"] as string[]).includes(content.layout)) fail(`unknown layout ${content.layout}`);
  for (const node of scene.nodes) {
    if (!node.id || !node.semanticId || ![node.x, node.y, node.width, node.height, node.lane].every(Number.isFinite) || node.width <= 0 || node.height <= 0) fail(`invalid geometry or identity for node ${node.id}`);
    if (node.status && !statuses.includes(node.status)) fail(`unknown status for node ${node.id}`);
  }
  for (const link of scene.links) {
    for (const id of [link.source, link.target]) if (id !== null && !nodeIds.has(id)) fail(`connection ${link.id} references missing node ${id}`);
    if (link.points.length < 2 || link.points.some(p => p.length !== 2 || !p.every(Number.isFinite))) fail(`invalid route for connection ${link.id}`);
    if (link.points.some((p, i) => i > 0 && p[0] !== link.points[i - 1][0] && p[1] !== link.points[i - 1][1])) fail(`non-orthogonal route for connection ${link.id}`);
    if (!meanings.includes(link.meaning)) fail(`unknown meaning for connection ${link.id}`);
    if (!link.origins.length || unique(link.origins).length !== link.origins.length || link.origins.some(id => !linkIds.has(id))) fail(`invalid origins for connection ${link.id}`);
  }
  for (const [id, role] of Object.entries(content.nodeRoles ?? {})) { if (!nodeIds.has(id)) fail(`node role references missing node ${id}`); if (!Number.isInteger(role.lane) || role.lane < 0 || role.order !== undefined && (!Number.isInteger(role.order) || role.order < 0)) fail(`invalid lane or order for ${id}`); }
  for (const [id, relation] of Object.entries(content.relationships ?? {})) { if (!linkIds.has(id)) fail(`relationship references missing connection ${id}`); if (!meanings.includes(relation.meaning)) fail(`unknown relationship meaning for ${id}`); for (const endpoint of [relation.source, relation.target]) if (endpoint !== undefined && !nodeIds.has(endpoint)) fail(`relationship ${id} references missing node ${endpoint}`); }
  const checkMembers = (members: string[], label: string) => { if (!members.length || unique(members).length !== members.length) fail(`${label} has empty or duplicate members`); for (const id of members) if (!nodeIds.has(id)) fail(`${label} references missing node ${id}`); };
  for (const group of content.groups) {
    checkMembers(group.members, `group ${group.id}`);
    if (nodeIds.has(`group:${group.id}`)) fail(`group ${group.id} conflicts with a node ID`);
    const bounds = scene.groups.find(g => g.id === group.id);
    if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) fail(`missing or invalid bounds for group ${group.id}`);
    for (const id of group.members) { const node = scene.nodes.find(n => n.id === id)!; if (node.x < bounds.x || node.y < bounds.y || node.x + node.width > bounds.x + bounds.width || node.y + node.height > bounds.y + bounds.height) fail(`group ${group.id} does not enclose member ${id}`); }
  }
  for (const view of content.views) {
    checkMembers(view.members, `view ${view.id}`);
    if (view.layout !== "pipeline" && view.layout !== "peers") fail(`unknown layout for view ${view.id}`);
    if (view.linkIds !== undefined) {
      if (unique(view.linkIds).length !== view.linkIds.length) fail(`view ${view.id} has duplicate connection IDs`);
      for (const id of view.linkIds) {
        const link = scene.links.find(connection => connection.id === id);
        if (!link) fail(`view ${view.id} references missing connection ${id}`);
        if (!link.source || !link.target || !view.members.includes(link.source) || !view.members.includes(link.target)) fail(`view ${view.id} connection ${id} has endpoint outside declared members`);
      }
    }
  }
  if (new Set(content.scenes.map(s => s.id)).size !== content.scenes.length) fail("duplicate explanation scene IDs");
  for (const explanation of content.scenes) validateExplanation(explanation, nodeIds, linkIds, viewIds, `scene ${explanation.id}`);
  if (new Set(content.predictions.map(p => p.id)).size !== content.predictions.length) fail("duplicate prediction IDs");
  for (const prediction of content.predictions) {
    if (prediction.options.length < 2 || !Number.isInteger(prediction.correctIndex) || prediction.correctIndex < 0 || prediction.correctIndex >= prediction.options.length) fail(`invalid answer options for prediction ${prediction.id}`);
    validateExplanation(prediction.reveal, nodeIds, linkIds, viewIds, `prediction ${prediction.id}`);
  }
}

export function presentSpatialLesson(lesson: SpatialLesson, options: PresentationOptions): ScenePresentation {
  validateSpatialLesson(lesson);
  const { scene: original, content } = lesson, explanation = options.explanation;
  if (explanation) validateExplanation(explanation, new Set(original.nodes.map(n => n.id)), new Set(original.links.map(l => l.id)), new Set(content.views.map(v => v.id)), `scene ${explanation.id}`);
  if (options.filter && options.filter !== "all" && !meanings.includes(options.filter)) fail(`unknown relationship filter ${options.filter}`);
  const viewId = options.viewId ?? explanation?.viewId, view = viewId ? content.views.find(v => v.id === viewId) : undefined;
  if (viewId && !view) fail(`missing teaching view ${viewId}`);
  let members = new Set(view ? view.members : original.nodes.map(n => n.id));
  if (explanation?.revealNodeIds !== undefined) members = new Set([...members].filter(id => explanation.revealNodeIds!.includes(id)));
  let nodes = original.nodes.filter(n => members.has(n.id)).map(copyNode);
  let links = original.links.filter(l => (!view && explanation?.revealNodeIds === undefined || !!l.source && !!l.target && members.has(l.source) && members.has(l.target)) && (view?.linkIds === undefined || view.linkIds.includes(l.id)) && (!options.filter || options.filter === "all" || l.meaning === options.filter)).map(copyLink);
  if (view) { nodes = positionNodes({ ...original, nodes, links, guide: undefined }, content, view.layout); links = routeLinks(nodes, links); }
  for (const node of nodes) { const status = explanation?.statuses?.[node.id]; if (status) node.status = status; if (explanation?.revealNodeIds) node.introduced = explanation.nodeIds.includes(node.id); }
  const selectedGroups = unique(options.collapsed).map(id => { const group = content.groups.find(g => g.id === id); if (!group) fail(`missing collapse group ${id}`); return group; });
  const replacements = new Map<string, string>(), proxies: LearningNode[] = [];
  for (const group of selectedGroups) {
    const selected = nodes.filter(n => group.members.includes(n.id)); if (!selected.length) continue;
    for (const node of selected) { if (replacements.has(node.id)) fail(`collapsed groups overlap at node ${node.id}`); replacements.set(node.id, `group:${group.id}`); }
    const centre: Point = [selected.reduce((sum, n) => sum + n.x, 0) / selected.length, selected.reduce((sum, n) => sum + n.y, 0) / selected.length];
    const anchor = [...selected].sort((a, b) => Math.hypot(a.x - centre[0], a.y - centre[1]) - Math.hypot(b.x - centre[0], b.y - centre[1]) || a.id.localeCompare(b.id))[0];
    const sameStatus = selected[0].status && selected.every(n => n.status === selected[0].status) ? selected[0].status : undefined;
    proxies.push({ ...anchor, id: `group:${group.id}`, semanticId: `group:${group.id}`, title: group.title, detail: `${selected.length} components · ${group.description}`, kind: "group", members: selected.map(n => n.id), status: sameStatus });
  }
  if (proxies.length) {
    nodes = [...nodes.filter(n => !replacements.has(n.id)), ...proxies];
    const aggregated = new Map<string, LearningLink>();
    for (const link of links) {
      const source = link.source ? replacements.get(link.source) ?? link.source : null, target = link.target ? replacements.get(link.target) ?? link.target : null;
      if (source && source === target && (source !== link.source || target !== link.target)) continue;
      const collapsed = source !== link.source || target !== link.target;
      const key = collapsed ? JSON.stringify([source, target, link.meaning, link.condition, link.dashed, link.arrow]) : link.id;
      const existing = aggregated.get(key);
      if (existing) { existing.origins.push(...link.origins); existing.label = unique([existing.label, link.label]).join(" · "); existing.explanation = unique([existing.explanation, link.explanation]).join(" "); }
      else aggregated.set(key, { ...link, source, target, origins: [...link.origins] });
    }
    links = routeLinks(nodes, [...aggregated.values()]);
  }
  const groups = content.groups.filter(g => !selectedGroups.some(selected => selected.id === g.id)).map(g => groupBounds(g, nodes)).filter((g): g is LearningGroup => !!g);
  const represented = new Set(nodes.flatMap(n => n.members ?? [n.id])), representedLinks = new Set(links.flatMap(l => l.origins));
  const scene: LearningScene = { ...original, nodes, links, groups };
  if (view || explanation?.revealNodeIds !== undefined) { delete scene.guide; delete scene.guidePath; }
  else if (original.guidePath) scene.guidePath = original.guidePath.map(p => [...p] as Point);
  return { scene, omittedNodes: original.nodes.length - represented.size, omittedLinks: original.links.length - representedLinks.size,
    title: view?.title ?? explanation?.title ?? original.title, description: view?.description ?? explanation?.description ?? original.description };
}
