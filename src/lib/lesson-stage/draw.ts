// The kit every pictogram is drawn with: an isometric projection, solid boxes and turned bodies, and the small real
// details (recesses, screws, vent slots, rule lines, the status light) drawn onto their faces.
// World units: x and y on the floor, z up; an object's floor centre is (0, 0, 0). Output is SVG markup as a string.
// Colours never live here: shapes carry classes that LessonStage.module.css colours from page tokens, so one drawing
// serves both themes and the status light can turn blue (work) or orange (hot). Read .claude/skills/pictogram-polish.

export type V3 = [number, number, number];
export const C = Math.cos(Math.PI / 6), S = 0.5, R2 = Math.SQRT2;
export const r2 = (n: number) => Math.round(n * 100) / 100;
/** Where a world point lands on screen. */
export const iso = (x: number, y: number, z = 0): [number, number] => [(x - y) * C, (x + y) * S - z];
export const pts = (list: V3[]) => list.map((p) => iso(...p).map(r2).join(",")).join(" ");
export const poly = (list: V3[], cls: string) => `<polygon class="${cls}" points="${pts(list)}"/>`;
export const line = (list: V3[], cls: string) => `<polyline class="${cls}" points="${pts(list)}"/>`;
/** Fine details keep their width on screen however far the camera zooms out. */
export const NS = 'vector-effect="non-scaling-stroke"';
/** `n` copies of something, joined. */
export const each = (n: number, f: (i: number) => string) => Array.from({ length: Math.max(0, n) }, (_, i) => f(i)).join("");
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type Box = { x: number; y: number; z: number; x1: number; y1: number; z1: number; w: number; d: number; h: number; svg: string };
/** Face classes (pt top, pl left, pr right; `pm` and `pd` are a mid and a deep tone) and the bevel's height (0 for none). */
export type BoxStyle = { top?: string; left?: string; right?: string; bevel?: number };

/** A box: three faces, a bevel of light under the top edges, faint creases where faces meet, then an ink silhouette. */
export function box(x: number, y: number, z: number, w: number, d: number, h: number, o: BoxStyle = {}): Box {
  const x1 = x + w, y1 = y + d, z1 = z + h, b = o.bevel ?? Math.min(1, h * 0.12);
  let svg = poly([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], o.left ?? "pl") +
    poly([[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], o.right ?? "pr") +
    poly([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], o.top ?? "pt");
  if (b > 0.2) svg += poly([[x, y1, z1 - b], [x1, y1, z1 - b], [x1, y1, z1], [x, y1, z1]], "bevel") +
    poly([[x1, y1, z1 - b], [x1, y, z1 - b], [x1, y, z1], [x1, y1, z1]], "bevel-r");
  svg += line([[x, y1, z1], [x1, y1, z1], [x1, y, z1]], "crease") + line([[x1, y1, z1], [x1, y1, z]], "crease") +
    `<polygon class="edge" points="${pts([[x, y, z1], [x1, y, z1], [x1, y, z], [x1, y1, z], [x, y1, z], [x, y1, z1]])}"/>`;
  return { x, y, z, x1, y1, z1, w, d, h, svg };
}

/**
 * Draw on a face in flat coordinates. L is the face toward the lower left (at y1, u along x), R the face toward the
 * lower right (at x1, u along -y), T the top (u along x, v along y, from its back corner). On L and R, v runs up.
 */
export function face(b: Box, which: "L" | "R" | "T", inner: string) {
  if (which === "L") return plane([b.x, b.y1, b.z], [1, 0, 0], [0, 0, 1], inner);
  if (which === "R") return plane([b.x1, b.y1, b.z], [0, -1, 0], [0, 0, 1], inner);
  return plane([b.x, b.y, b.z1], [1, 0, 0], [0, 1, 0], inner);
}
/** Draw on any flat plane: `u` and `v` are world directions one unit long (a tilted lid, a sloped panel). */
export function plane(origin: V3, u: V3, v: V3, inner: string) {
  const [ox, oy] = iso(...origin), [ux, uy] = iso(...u), [vx, vy] = iso(...v);
  return `<g transform="matrix(${[ux, uy, vx, vy, ox, oy].map(r2).join(" ")})">${inner}</g>`;
}

// ---- details drawn on a face, in its flat coordinates: u to the right, v up the face (on T, v runs to the front) ----
// Raw SVG inside face() or plane() uses the same coordinates: x = u, y = v. On L and R a rect at y = v covers v..v+h
// going up, so its top edge is at v + h.
/** A recess: a dark floor, a shadowed inner wall under its top edge, a faint rim. */
export const recess = (u: number, v: number, w: number, h: number, wall = 1) =>
  `<rect class="recess" x="${r2(u)}" y="${r2(v)}" width="${r2(w)}" height="${r2(h)}" rx=".5"/>` +
  `<rect class="wall" x="${r2(u)}" y="${r2(v + h - wall)}" width="${r2(w)}" height="${r2(wall)}"/>` +
  `<rect class="rim" x="${r2(u)}" y="${r2(v)}" width="${r2(w)}" height="${r2(h)}" rx=".5" ${NS}/>`;
/** A pocket sunk into a top face: the same, with its shadowed wall along the back edge. */
export const pocket = (u: number, v: number, w: number, h: number, wall = 1) =>
  `<rect class="recess" x="${r2(u)}" y="${r2(v)}" width="${r2(w)}" height="${r2(h)}" rx=".5"/>` +
  `<rect class="wall" x="${r2(u)}" y="${r2(v)}" width="${r2(w)}" height="${r2(wall)}"/>` +
  `<rect class="rim" x="${r2(u)}" y="${r2(v)}" width="${r2(w)}" height="${r2(h)}" rx=".5" ${NS}/>`;
/** A screw head at a plate's corner. */
export const screw = (u: number, v: number) => `<circle class="screw" cx="${r2(u)}" cy="${r2(v)}" r=".55"/>`;
/** A closed vent slot (a slot has no loose ends). */
export const slot = (u: number, v: number, w: number, h: number) =>
  `<rect class="slot" x="${r2(u)}" y="${r2(v)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(Math.min(w, h) / 2)}"/>`;
/** A rule line, standing for printed text on a label or screen: the one line allowed to stop on a bare face. */
export const rule = (u1: number, v: number, u2: number) => `<path class="rule" d="M${r2(u1)} ${r2(v)}H${r2(u2)}" ${NS}/>`;
/** A line etched into a face through points; its ends must land on something (an edge, a dot, a seam). */
export const etch = (d: [number, number][]) => `<path class="etch" d="M${d.map(([u, v]) => `${r2(u)} ${r2(v)}`).join("L")}" ${NS}/>`;
export const etchDot = (u: number, v: number, r = 0.9) => `<circle class="etch-dot" cx="${r2(u)}" cy="${r2(v)}" r="${r}"/>`;
/** A label plate: two rule lines (printed text) and a screw. */
export const plate = (u: number, v: number, w: number, h = 4) =>
  `<rect class="plate" x="${r2(u)}" y="${r2(v)}" width="${r2(w)}" height="${r2(h)}" rx=".5"/>` +
  rule(u + 1.4, v + h * 0.66, u + w * 0.62) + rule(u + 1.4, v + h * 0.34, u + w * 0.45) + screw(u + w - 1.1, v + h / 2);
/**
 * The status light: the one bright mark on a part. Idle it's a quiet grey; the stage turns it ink (on), the labs'
 * blue (work) or orange (hot). Every part needs one where the eye finds it; the base carries another.
 */
export const led = (u: number, v: number, len = 2.4) => `<path class="led" d="M${r2(u)} ${r2(v)}h${r2(len)}" ${NS}/>`;
/** A round light (a lamp, or the mark on a picked element); it follows the status light's colour. */
export const lamp = (u: number, v: number, r = 0.9) => `<circle class="lamp" cx="${r2(u)}" cy="${r2(v)}" r="${r}"/>`;

/** A soft contact shadow where an object stands on its base. */
export const halo = (rx: number, ry = rx / 2, dy = 1) => `<ellipse cx="0" cy="${r2(dy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="url(#sk-halo)"/>`;

export type Turned = { svg: string; sx: number; sb: number; st: number; rx: number; ry: number; rxb: number; ryb: number };
export type TurnedStyle = { x?: number; y?: number; z?: number; rBottom?: number; bands?: number[]; level?: number; levelHot?: boolean; top?: string; crease?: boolean };
/**
 * A turned body (a drum, a tub, a post): its side shaded smoothly from one gradient, raised rings at `bands`
 * (heights), an optional fill rising inside to `level` (0-1), and an ellipse top. Tapered when `rBottom` differs from r.
 */
export function cylinder(r: number, h: number, o: TurnedStyle = {}): Turned {
  const [sx, sb] = iso(o.x ?? 0, o.y ?? 0, o.z ?? 0), st = sb - h;
  const rb = o.rBottom ?? r, rx = r * C * R2, ry = r * S * R2, rxb = rb * C * R2, ryb = rb * S * R2;
  const at = (z: number) => { const k = rb + ((r - rb) * z) / h; return [k * C * R2, k * S * R2]; };
  const side = `M${r2(sx - rx)} ${r2(st)}L${r2(sx - rxb)} ${r2(sb)}A${r2(rxb)} ${r2(ryb)} 0 0 0 ${r2(sx + rxb)} ${r2(sb)}L${r2(sx + rx)} ${r2(st)}`;
  let svg = `<path d="${side}Z" fill="url(#sk-round)"/>`;
  if (o.level && o.level > 0) {
    const lz = clamp(h * o.level, 1.2, h - 0.8), [lx, ly] = at(lz);
    svg += `<path class="liquid${o.levelHot ? " is-hot" : ""}" d="M${r2(sx - lx)} ${r2(sb - lz)}L${r2(sx - rxb)} ${r2(sb)}A${r2(rxb)} ${r2(ryb)} 0 0 0 ${r2(sx + rxb)} ${r2(sb)}L${r2(sx + lx)} ${r2(sb - lz)}A${r2(lx)} ${r2(ly)} 0 0 1 ${r2(sx - lx)} ${r2(sb - lz)}Z"/>` +
      `<path class="surface" d="M${r2(sx - lx)} ${r2(sb - lz)}A${r2(lx)} ${r2(ly)} 0 0 0 ${r2(sx + lx)} ${r2(sb - lz)}" ${NS}/>`;
  }
  for (const bz of o.bands ?? []) {
    const [bx, by] = at(bz), y = sb - bz;
    // a ring: a shadow line under a light line, both following the front of the body
    svg += `<path class="ring-shade" d="M${r2(sx - bx)} ${r2(y + 0.9)}A${r2(bx)} ${r2(by)} 0 0 0 ${r2(sx + bx)} ${r2(y + 0.9)}" ${NS}/>` +
      `<path class="ring-light" d="M${r2(sx - bx)} ${r2(y)}A${r2(bx)} ${r2(by)} 0 0 0 ${r2(sx + bx)} ${r2(y)}" ${NS}/>`;
  }
  svg += `<path class="edge" d="${side}"/>` + `<ellipse class="${o.top ?? "pt"}" cx="${r2(sx)}" cy="${r2(st)}" rx="${r2(rx)}" ry="${r2(ry)}"/>` +
    (o.crease === false ? "" : `<ellipse class="crease" cx="${r2(sx)}" cy="${r2(st + 0.35)}" rx="${r2(rx * 0.8)}" ry="${r2(ry * 0.8)}"/>`) +
    `<ellipse class="edge" cx="${r2(sx)}" cy="${r2(st)}" rx="${r2(rx)}" ry="${r2(ry)}"/>`;
  return { svg, sx, sb, st, rx, ry, rxb, ryb };
}

/** A ball (a globe, a head, a knob), shaded from one radial gradient lit from the upper left. */
export const ball = (cx: number, cy: number, r: number) =>
  `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="url(#sk-ball)"/><circle class="edge" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}"/>`;

/** The flat outline of an ellipse lying on the floor plane at height z (a ring, a dial's rim), as a path. */
export const floorEllipse = (x: number, y: number, z: number, r: number, cls: string) => {
  const [cx, cy] = iso(x, y, z);
  return `<ellipse class="${cls}" cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(r * C * R2)}" ry="${r2(r * S * R2)}"/>`;
};
