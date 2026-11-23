/** A presentation of the existing lesson diagram, never an inferred system. */
export type Point = [number, number];
export type SpatialNode = {
  id: string; title: string; detail: string; kind: string;
  x: number; y: number; width: number; height: number;
};
export type SpatialLink = {
  id: string; points: Point[]; label: string; dashed: boolean; arrow: boolean;
  source: string | null; target: string | null;
};
export type SpatialScene = {
  id: string; title: string; description: string; note: string;
  nodes: SpatialNode[]; links: SpatialLink[];
  guide?: "ring" | "timeline";
  groups: { title: string; x: number; y: number; width: number; height: number }[];
};
type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue => v !== null && typeof v === "object" ? v as RecordValue : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown): string => typeof v === "string" ? v : "";
const number = (v: unknown): number => typeof v === "number" && Number.isFinite(v) ? v : NaN;

/** The lesson paths use only absolute M/L/H/V commands; reject other syntax. */
export function pathPoints(path: string): Point[] {
  const tokens = path.match(/[MLHV]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  if (path.replace(/[MLHV\s,\d.e+-]/g, "").length) throw new Error("Unsupported lesson path");
  let command = "", x = 0, y = 0, i = 0;
  const result: Point[] = [];
  while (i < tokens.length) {
    if (/^[MLHV]$/.test(tokens[i])) command = tokens[i++];
    const a = Number(tokens[i++]);
    if (!Number.isFinite(a)) throw new Error("Invalid path coordinate");
    if (command === "M" || command === "L") {
      const b = Number(tokens[i++]);
      if (!Number.isFinite(b)) throw new Error("Invalid path coordinate");
      x = a; y = b; command = "L";
    } else if (command === "H") x = a;
    else if (command === "V") y = a;
    else throw new Error("Unsupported lesson path");
    result.push([x, y]);
  }
  return result;
}

function points(value: unknown): Point[] {
  return list(value).map(p => {
    const pair = list(p);
    const point: Point = [number(pair[0]), number(pair[1])];
    if (!point.every(Number.isFinite)) throw new Error("Invalid lesson connection");
    return point;
  });
}

function endpoint(point: Point, nodes: SpatialNode[]): string | null {
  // Resolve only an endpoint touching a supplied card. No nearest-name guesses.
  const matches = nodes.filter(n => point[0] >= n.x - 12 && point[0] <= n.x + n.width + 12 &&
    point[1] >= n.y - 12 && point[1] <= n.y + n.height + 12);
  return matches.length === 1 ? matches[0].id : null;
}

export function spatialScene(id: string, raw: unknown, nodeHeight = 74): SpatialScene {
  const scene = record(raw);
  if (!text(scene.title)) throw new Error(`No lesson diagram: ${id}`);
  const sourceNodes = list(scene.nodes ?? scene.cards ?? scene.tiles ?? scene.items);
  const foundation = Array.isArray(scene.items);
  const kind = text(scene.kind);
  let bitX = 30;
  const bitWidths = [108, 406, 142, 142, 142];
  const nodes: SpatialNode[] = sourceNodes.map((value, i) => {
    const v: RecordValue = Array.isArray(value) ? { x: value[0], y: value[1], w: value[2], title: value[3], detail: value[4], kind: value[5] } : record(value);
    let x = number(v.x), y = number(v.y), width = number(v.width ?? v.w), height = nodeHeight;
    if (foundation) {
      if (kind === "ring") {
        const angle = (-90 + i * 360 / sourceNodes.length) * Math.PI / 180;
        width = height = 68; x = 500 + 139 * Math.cos(angle) - 34; y = 215 + 139 * Math.sin(angle) - 34;
      } else if (kind === "bits") {
        width = bitWidths[i] - 4; x = bitX; bitX += bitWidths[i]; y = 155; height = 112;
      } else if (kind === "timeline") {
        x = 70 + i * 238 - 60; y = i % 2 === 0 ? 103 : 258; width = 166; height = 75;
      } else { x = 34 + i * 244; y = 155; width = 204; height = 104; }
    }
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error(`Invalid lesson node: ${id}`);
    return { id: text(v.id) || `${id}:node:${i}`, x, y, width, height, title: text(v.title), detail: text(v.detail), kind: text(v.kind ?? v.icon ?? v.tone) || "component" };
  });
  let rawLinks = list(scene.connections ?? scene.links ?? scene.edges ?? scene.arrows);
  if (foundation && kind === "flow") rawLinks = nodes.slice(0, -1).map((n, i) => ({ points: [[n.x + n.width, 207], [nodes[i + 1].x - 10, 207]] }));
  const links: SpatialLink[] = rawLinks.map((value, i) => {
    const v = record(value);
    const route = Array.isArray(value) ? points(value) : v.path ? pathPoints(text(v.path)) :
      v.from && v.to ? points([v.from, v.to]) : points(v.points);
    if (route.length < 2) throw new Error(`Invalid lesson route: ${id}`);
    return { id: `${id}:relation:${i}`, points: route, label: text(v.label) || text(v.tone) || "Connection",
      dashed: v.dashed === true, arrow: v.arrow !== false,
      source: endpoint(route[0], nodes), target: endpoint(route[route.length - 1], nodes) };
  });
  return { id, title: text(scene.title), description: text(scene.description ?? scene.summary), note: text(scene.note), nodes, links,
    guide: foundation && (kind === "ring" || kind === "timeline") ? kind : undefined,
    groups: id === "multi-dc" ? [
      { title: "REGION A", x: 450, y: 63, width: 490, height: 109 },
      { title: "REGION B", x: 450, y: 300, width: 490, height: 110 },
    ] : [] };
}
