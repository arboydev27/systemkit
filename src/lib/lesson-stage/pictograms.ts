// SystemKit's system pictograms: isometric objects in the page's neutrals, drawn from a few primitives.
// World units: x and y on the floor, z up; each object's floor centre is (0, 0, 0). Output is SVG markup.
// Faces use classes (pt top, pl left, pr right) that the stage colours from page tokens, so both themes work.
import type { GlyphOptions, StageRole } from "./types";

type V3 = [number, number, number];
const C = Math.cos(Math.PI / 6), S = 0.5, R2 = Math.SQRT2;
const r2 = (n: number) => Math.round(n * 100) / 100;
export const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * C, (x + y) * S - z];
const pts = (list: V3[]) => list.map((p) => iso(...p).map(r2).join(",")).join(" ");
const poly = (list: V3[], cls: string) => `<polygon class="${cls}" points="${pts(list)}"/>`;
const NS = 'vector-effect="non-scaling-stroke"';

type Box = { x: number; y: number; z: number; x1: number; y1: number; z1: number; svg: string };
function box(x: number, y: number, z: number, w: number, d: number, h: number): Box {
  const x1 = x + w, y1 = y + d, z1 = z + h;
  const svg =
    poly([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], "pl") +
    poly([[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], "pr") +
    poly([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], "pt");
  return { x, y, z, x1, y1, z1, svg };
}

/** A face as a flat drawing surface: u runs left to right on screen, v runs up. */
function face(b: Box, which: "L" | "R" | "T", inner: string) {
  let m: number[], o: [number, number];
  if (which === "L") { o = iso(b.x, b.y1, b.z); m = [C, S, 0, -1]; }
  else if (which === "R") { o = iso(b.x1, b.y1, b.z); m = [C, -S, 0, -1]; }
  else { o = iso(b.x, b.y, b.z1); m = [C, S, -C, S]; }
  return `<g transform="matrix(${m.map(r2).join(" ")} ${r2(o[0])} ${r2(o[1])})">${inner}</g>`;
}
const led = (x1: number, y1: number, x2: number, y2: number) => `<line class="led" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${NS}/>`;
const dl = (d: string) => `<path class="dl" d="${d}" ${NS}/>`;
const rect = (x: number, y: number, w: number, h: number, cls = "gl", rx = 0.8) =>
  `<rect class="${cls}" x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${rx}" ${NS}/>`;
let clipCount = 0;
const shadow = (rx: number, ry = rx * 0.5, dy = 0) => `<ellipse class="sh" cx="0" cy="${dy}" rx="${rx}" ry="${ry}"/>`;

/** A round body's side: lit left, a flat darker right part like a box's right face, and its outline. */
function roundSide(sx: number, st: number, sb: number, rxt: number, rxb: number, ryb: number, inside = "") {
  const k = 0.42, xb = sx + k * rxb, yb = sb + ryb * Math.sqrt(1 - k * k), xt = sx + k * rxt;
  const outline = `M${r2(sx - rxt)} ${r2(st)}L${r2(sx - rxb)} ${r2(sb)}A${r2(rxb)} ${r2(ryb)} 0 0 0 ${r2(sx + rxb)} ${r2(sb)}L${r2(sx + rxt)} ${r2(st)}`;
  return `<path class="ps" d="${outline}Z"/>` +
    `<path class="pr-shade" d="M${r2(xt)} ${r2(st)}L${r2(xb)} ${r2(yb)}A${r2(rxb)} ${r2(ryb)} 0 0 0 ${r2(sx + rxb)} ${r2(sb)}L${r2(sx + rxt)} ${r2(st)}Z"/>` +
    inside + `<path class="ps-line" d="${outline}"/>`;
}

function cylinder(z: number, r: number, h: number, bands: number[] = [], level = 0, levelHot = false) {
  const [sx, sb] = iso(0, 0, z);
  const st = sb - h, rx = r * C * R2, ry = r * S * R2;
  let liquid = "";
  if (level > 0) {
    const lz = Math.max(1.5, Math.min(h - 1, h * level));
    liquid = `<path class="liquid${levelHot ? " is-hot" : ""}" d="M${r2(-rx)} ${r2(sb - lz)}L${r2(-rx)} ${r2(sb)}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(rx)} ${r2(sb)}L${r2(rx)} ${r2(sb - lz)}A${r2(rx)} ${r2(ry)} 0 0 1 ${r2(-rx)} ${r2(sb - lz)}Z"/>`;
  }
  const lines = bands.map((bz) => `<path class="dl" d="M${r2(sx - rx)} ${r2(sb - bz)}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(sx + rx)} ${r2(sb - bz)}" ${NS}/>`).join("");
  const top = `<ellipse class="pt" cx="${r2(sx)}" cy="${r2(st)}" rx="${r2(rx)}" ry="${r2(ry)}"/>`;
  return { svg: roundSide(sx, st, sb, rx, rx, ry, liquid) + lines + top, sb, st, rx, ry };
}

const G: Record<StageRole, (o: GlyphOptions) => string> = {
  client(o) {
    const one = (dx: number, dy: number) => {
      const base = box(-15, -10, 0, 30, 20, 2.4);
      const P0 = (u: number, t: number): V3 => [u, -10 - 3 * t, 2.4 + 18.6 * t];
      const rule = (t: number, u1: number) => `<polyline class="dl" ${NS} points="${pts([P0(-9.5, t), P0(u1, t)])}"/>`;
      const screen =
        poly([P0(-15, 0), P0(15, 0), P0(15, 1), P0(-15, 1)], "pl") +
        poly([[15, -10, 2.4], [15, -11.4, 2.4], [15, -14.4, 21], [15, -13, 21]], "pr") +
        poly([[-15, -13, 21], [15, -13, 21], [15, -14.4, 21], [-15, -14.4, 21]], "pt") +
        poly([P0(-12.6, 0.12), P0(12.6, 0.12), P0(12.6, 0.9), P0(-12.6, 0.9)], "gl") +
        rule(0.68, 1) + rule(0.5, 5) + rule(0.32, -1);
      const keys = face(base, "T", rect(3, 2.5, 24, 9, "gl", 0.6) + dl("M5 5.5H25M5 8.5H25") + rect(11, 13.5, 8, 4.5, "gl", 0.6));
      const light = face(base, "L", led(24.5, 1.2, 27, 1.2));
      return `<g transform="translate(${dx} ${dy})">${base.svg}${keys}${light}${screen}</g>`;
    };
    return shadow(24, 12, 3) + (o.many ? one(-16, -9) : "") + one(0, 0);
  },

  crowd() {
    let out = shadow(24, 12, 2);
    const people: [number, number][] = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) people.push([-13 + i * 8.6, -9 + j * 9 + (i % 2) * 1.5]);
    people.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y] of people) {
      const [sx, sb] = iso(x, y, 0), rx = 2.5 * C * R2, ry = 2.5 * S * R2, st = sb - 8;
      const [hx, hy] = iso(x, y, 11.6);
      out += roundSide(sx, st, sb, rx, rx, ry) + `<ellipse class="pt" cx="${r2(sx)}" cy="${r2(st)}" rx="${r2(rx)}" ry="${r2(ry)}"/>` +
        `<circle class="head" cx="${r2(hx)}" cy="${r2(hy)}" r="2.7"/>`;
    }
    return out;
  },

  dns() {
    const plate = box(-7, -7, 0, 14, 14, 1.6);
    const post = box(-1.6, -1.6, 1.6, 3.2, 3.2, 31);
    const board = (outline: [number, number][], rule: [number, number][]) =>
      `<polygon class="pl" points="${outline.map(([u, z]) => iso(u, 1.9, z).map(r2).join(",")).join(" ")}"/>` +
      `<polyline class="dl" ${NS} points="${rule.map(([u, z]) => iso(u, 1.9, z).map(r2).join(",")).join(" ")}"/>`;
    const right = board([[-3, 22], [13, 22], [17.5, 25], [13, 28], [-3, 28]], [[0, 25], [10, 25]]);
    const left = board([[3, 13.5], [-13, 13.5], [-17.5, 16.5], [-13, 19.5], [3, 19.5]], [[0, 16.5], [-10, 16.5]]);
    const cap = box(-2.2, -2.2, 32.6, 4.4, 4.4, 1.4);
    return shadow(15, 7.5, 1) + plate.svg + face(plate, "L", led(9, 0.8, 11.5, 0.8)) + post.svg + cap.svg + left + right;
  },

  balancer() {
    const b = box(-16, -11, 0, 32, 22, 7);
    const fan = face(b, "T", dl("M3 11H12M12 11L27 4M12 11H27M12 11L27 18") +
      '<circle class="dot" cx="12" cy="11" r="1.3"/><circle class="dot" cx="27" cy="4" r="1.1"/><circle class="dot" cx="27" cy="11" r="1.1"/><circle class="dot" cx="27" cy="18" r="1.1"/>');
    const ports = face(b, "R", rect(4, 2.2, 3.4, 2.4) + rect(9.5, 2.2, 3.4, 2.4) + rect(15, 2.2, 3.4, 2.4));
    return shadow(25, 12.5, 2) + b.svg + fan + ports + face(b, "L", led(3, 3.5, 6.5, 3.5) + dl("M10 3.5H28"));
  },

  web(o) {
    const k = o.big ? 1.18 : 1, w = 18 * k, h = 34 * k;
    const tower = (ox: number, oy: number) => {
      const b = box(-w / 2 + ox, -w / 2 + oy, 0, w, w, h);
      const bays = [0.14, 0.34, 0.54].map((f) => rect(2, h * f, w - 4, h * 0.13, "gl", 0.6) + dl(`M4 ${r2(h * f + h * 0.065)}H${r2(w * 0.45)}`)).join("");
      const front = face(b, "L", bays + rect(2, h * 0.76, w - 4, h * 0.15, "bay", 0.6) + led(w - 6.5, h * 0.835, w - 4, h * 0.835));
      const vents = face(b, "R", dl([4, 6, 8, 10, 12].map((u) => `M${r2(u * k)} ${r2(h * 0.7)}V${r2(h * 0.88)}`).join("")));
      return b.svg + front + vents;
    };
    // `many`: a row of identical machines, back to front
    return shadow(18 * k + (o.many ? 8 : 0), 9 * k + (o.many ? 4 : 0), 1) + (o.many ? tower(-7, -16) + tower(-3.5, -8) : "") + tower(0, 0);
  },

  database(o) {
    const k = o.big ? 1.2 : 1;
    const c = cylinder(0, 13 * k, 27 * k, [9 * k, 18 * k], o.level ?? 0, !!o.levelHot);
    const ring = o.replica ? `<ellipse class="dl" ${NS} cx="0" cy="${r2(c.st)}" rx="${r2(c.rx * 0.55)}" ry="${r2(c.ry * 0.55)}"/>` : "";
    return shadow(19 * k, 9.5 * k, 1) + c.svg + ring + `<line class="led" ${NS} x1="-2.5" y1="${r2(c.ry - 4.5)}" x2="2.5" y2="${r2(c.ry - 4.5)}"/>`;
  },

  cache() {
    const b = box(-17, -8, 0, 34, 16, 4);
    const chips = [0, 1, 2, 3].map((i) => box(-14 + i * 8, -4.5, 4, 5.4, 9, 1.8).svg).join("");
    const pins = face(b, "L", dl(Array.from({ length: 12 }, (_, i) => `M${r2(2.5 + i * 2.6)} 0.7V2.6`).join("")));
    return shadow(22, 11, 1) + b.svg + pins + face(b, "R", led(3, 2, 6, 2)) + chips;
  },

  cdn() {
    const p = box(-9, -9, 0, 18, 18, 4);
    const [cx, cy] = iso(0, 0, 18), R = 13.5, id = `sk-globe-${++clipCount}`;
    const clip = (e: string) => `<clipPath id="${id}"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${R}"/></clipPath><g clip-path="url(#${id})">${e}</g>`;
    const globe =
      `<circle class="ball" cx="${r2(cx)}" cy="${r2(cy)}" r="${R}"/>` +
      clip(`<ellipse class="dl" ${NS} cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(R * 0.42)}" ry="${R}"/>` +
        `<ellipse class="dl" ${NS} cx="${r2(cx)}" cy="${r2(cy)}" rx="${R}" ry="${r2(R * 0.34)}"/>` +
        `<path class="dl" ${NS} d="M${r2(cx - R * 0.74)} ${r2(cy - R * 0.62)}A${r2(R * 0.78)} ${r2(R * 0.22)} 0 0 0 ${r2(cx + R * 0.74)} ${r2(cy - R * 0.62)}"/>`) +
      `<circle class="ring" cx="${r2(cx)}" cy="${r2(cy)}" r="${R}"/>` +
      [[-6, -4], [6.5, -7], [5, 4.5]].map(([dx, dy]) => `<circle class="node-led" cx="${r2(cx + dx)}" cy="${r2(cy + dy)}" r="1.5"/>`).join("");
    return shadow(18, 9, 1) + p.svg + globe;
  },

  storage() {
    const [sx, sb] = iso(0, 0, 0);
    const h = 22, rt = 13, rb = 10;
    const rxt = rt * C * R2, ryt = rt * S * R2, rxb = rb * C * R2, ryb = rb * S * R2, st = sb - h;
    const bz = 15, rbz = rb + ((rt - rb) * bz) / h;
    const band = `<path class="dl" ${NS} d="M${r2(-rbz * C * R2)} ${r2(sb - bz)}A${r2(rbz * C * R2)} ${r2(rbz * S * R2)} 0 0 0 ${r2(rbz * C * R2)} ${r2(sb - bz)}"/>`;
    const top = `<ellipse class="pt" cx="0" cy="${r2(st)}" rx="${r2(rxt)}" ry="${r2(ryt)}"/><ellipse class="gl" cx="0" cy="${r2(st + 0.6)}" rx="${r2(rxt - 2)}" ry="${r2(ryt - 1.2)}"/>`;
    const handle = `<path class="handle" d="M${r2(-rxt + 0.5)} ${r2(st)}C${r2(-rxt + 2)} ${r2(st - 17)} ${r2(rxt - 2)} ${r2(st - 17)} ${r2(rxt - 0.5)} ${r2(st)}"/>`;
    return shadow(17, 8.5, 1) + handle + roundSide(sx, st, sb, rxt, rxb, ryb) + band + top +
      `<line class="led" ${NS} x1="-2.5" y1="${r2(sb + ryb - 5)}" x2="2.5" y2="${r2(sb + ryb - 5)}"/>`;
  },

  queue(o) {
    const n = o.items ?? 3;
    const rail = box(-22, -7, 0, 44, 14, 3);
    const back = box(-22, -7, 3, 44, 1.4, 2.4);
    const items = Array.from({ length: Math.min(n, 4) }, (_, i) => box(12 - i * 10, -4.2, 3, 7, 7, 7).svg).reverse().join("");
    const front = box(-22, 5.6, 3, 44, 1.4, 2.4);
    return shadow(28, 14, 2) + rail.svg + face(rail, "R", led(4, 1.5, 7.5, 1.5)) + back.svg + items + front.svg +
      face(front, "L", dl("M30 1.2l2.2 0M35 1.2l2.2 0M40 1.2l2.2 0"));
  },

  worker() {
    const b = box(-10, -10, 0, 20, 20, 20);
    const teeth = Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2, r = Math.floor(i / 2) % 2 ? 5.2 : 6.6;
      return `${r2(10 + Math.cos(a) * r)},${r2(10.5 + Math.sin(a) * r)}`;
    }).join(" ");
    const gear = face(b, "L", `<polygon class="gearbody" ${NS} points="${teeth}"/><circle class="gl" ${NS} cx="10" cy="10.5" r="2"/>`);
    return shadow(20, 10, 1) + b.svg + gear + face(b, "R", led(3, 16, 6.5, 16) + dl("M3 3.5H17M3 6H17"));
  },

  monitor() {
    const foot = box(-8, -6, 0, 16, 12, 1.6);
    const stem = box(-1.5, -1.5, 1.6, 3, 3, 9);
    const panel = box(-15, -1.5, 10.6, 30, 2.6, 20);
    const screen = face(panel, "L", rect(2, 2.2, 26, 15.6, "gl", 0.8) +
      `<polyline class="spark" ${NS} points="4.5,6 9,9.5 13,7.5 17,12 21,10.5 25.5,15"/>` + led(24.5, 1.1, 27, 1.1));
    return shadow(17, 8.5, 1) + foot.svg + stem.svg + panel.svg + screen;
  },
};

/** Height of each object above its floor centre, for placing what floats over it. */
export const GLYPH_TOP: Record<StageRole, number> = {
  client: 26, crowd: 16, dns: 38, balancer: 20, web: 48, cache: 18, database: 40, cdn: 36, storage: 40, queue: 18, worker: 30, monitor: 34,
};

export const ROLE_NAMES: Record<StageRole, string> = {
  client: "Client", crowd: "Users", dns: "DNS", balancer: "Load balancer", web: "Web server", cache: "Cache", database: "Database",
  cdn: "CDN edge", storage: "Object storage", queue: "Queue", worker: "Worker", monitor: "Monitoring",
};

export function glyph(role: StageRole, opts: GlyphOptions = {}): string {
  return G[role](opts);
}

function hull(points: [number, number][]) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], hi: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
const closed = (list: [number, number][]) => "M" + list.map((p) => p.map(r2).join(" ")).join("L") + "Z";

/** The soft rounded base every part stands on. Its front edge carries the part's status light. */
export function plinth(size = 56, h = 7, r = 11): string {
  const half = size / 2, foot: [number, number][] = [];
  for (const [cx, cy, a0] of [[half - r, half - r, 0], [r - half, half - r, 90], [r - half, r - half, 180], [half - r, r - half, 270]])
    for (let k = 0; k <= 6; k++) { const a = ((a0 + k * 15) * Math.PI) / 180; foot.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const top = foot.map(([x, y]) => iso(x, y, h)), bottom = foot.map(([x, y]) => iso(x, y, 0));
  const bevel = foot.map(([x, y]) => iso(x * 0.86, y * 0.86, h));
  const [a, b] = [iso(half - r - 16, half, h * 0.5), iso(half - r - 5, half, h * 0.5)];
  return `<path class="plinth-side" d="${closed(hull([...top, ...bottom]))}"/><path class="plinth-top" d="${closed(top)}"/>` +
    `<path class="plinth-bevel" d="${closed(bevel)}"/><line class="led strip" x1="${r2(a[0])}" y1="${r2(a[1])}" x2="${r2(b[0])}" y2="${r2(b[1])}"/>`;
}
