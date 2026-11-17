// A sample of SystemKit's pictograms redrawn to anatomy's craft rules, at pictogram scale:
// a strong ink silhouette over faint creases, bevels that catch the light, four close face tones,
// recessed details with an inner wall, screws, closed vent slots, smooth round shading,
// and every detail line ending on an edge. Same world units as pictograms.ts.
const C = Math.cos(Math.PI / 6), S = 0.5, R2 = Math.SQRT2;
const r2 = (n) => Math.round(n * 100) / 100;
export const iso = (x, y, z = 0) => [(x - y) * C, (x + y) * S - z];
const P = (list) => list.map((p) => iso(...p).map(r2).join(",")).join(" ");
const poly = (list, cls) => `<polygon class="${cls}" points="${P(list)}"/>`;
const line = (list, cls) => `<polyline class="${cls}" points="${P(list)}"/>`;

/** A box: three filled faces, bevel strips under the top edges, faint creases, then an ink silhouette. */
function box(x, y, z, w, d, h, o = {}) {
  const x1 = x + w, y1 = y + d, z1 = z + h, b = o.bevel ?? Math.min(1, h * 0.12);
  const top = o.top ?? "q-top", left = o.left ?? "q-left", right = o.right ?? "q-right";
  let svg = poly([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], left) +
    poly([[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], right) +
    poly([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], top);
  if (b > 0.2) {
    svg += poly([[x, y1, z1 - b], [x1, y1, z1 - b], [x1, y1, z1], [x, y1, z1]], "q-bevel") +
      poly([[x1, y1, z1 - b], [x1, y, z1 - b], [x1, y, z1], [x1, y1, z1]], "q-bevel-r");
  }
  // creases where faces meet, faint; the outline last, in ink
  svg += line([[x, y1, z1], [x1, y1, z1], [x1, y, z1]], "q-crease") + line([[x1, y1, z1], [x1, y1, z]], "q-crease");
  svg += `<polygon class="q-edge" points="${P([[x, y, z1], [x1, y, z1], [x1, y, z], [x1, y1, z], [x, y1, z], [x, y1, z1]])}"/>`;
  return { x, y, z, x1, y1, z1, w, d, h, svg };
}
/** Draw on a face in flat coordinates: u left to right, v up. */
function face(b, which, inner) {
  let m, o;
  if (which === "L") { o = iso(b.x, b.y1, b.z); m = [C, S, 0, -1]; }
  else if (which === "R") { o = iso(b.x1, b.y1, b.z); m = [C, -S, 0, -1]; }
  else { o = iso(b.x, b.y, b.z1); m = [C, S, -C, S]; }
  return `<g transform="matrix(${m.map(r2).join(" ")} ${r2(o[0])} ${r2(o[1])})">${inner}</g>`;
}
const NS = 'vector-effect="non-scaling-stroke"';
/** A recess: dark floor, a shadowed inner wall under its top edge, a faint rim. */
const recess = (u, v, w, h, wall = 1) =>
  `<rect class="q-recess" x="${u}" y="${v}" width="${w}" height="${h}" rx=".5"/>` +
  `<path class="q-wall" d="M${u} ${v + h}H${u + w}V${r2(v + h - wall)}H${u}Z"/>` +
  `<rect class="q-rim" x="${u}" y="${v}" width="${w}" height="${h}" rx=".5" ${NS}/>`;
const screw = (u, v) => `<circle class="q-screw" cx="${u}" cy="${v}" r=".55"/>`;
const slot = (u, v, w, h) => `<rect class="q-slot" x="${u}" y="${v}" width="${w}" height="${h}" rx="${r2(Math.min(w, h) / 2)}"/>`;
const rule = (u1, v, u2) => `<path class="q-rule" d="M${u1} ${v}H${u2}" ${NS}/>`;
const led = (u, v, len = 2.4) => `<path class="led" d="M${u} ${v}h${len}" ${NS}/>`;
const halo = (rx, ry = rx / 2, dy = 1) => `<ellipse class="q-halo" cx="0" cy="${dy}" rx="${rx}" ry="${ry}" fill="url(#GID-halo)"/>`;

/** A turned body: smooth shading from one gradient, bands as raised rings, an ellipse top. */
function cylinder(r, h, bands = [], z = 0) {
  const [sx, sb] = iso(0, 0, z), st = sb - h, rx = r * C * R2, ry = r * S * R2;
  const side = `M${r2(sx - rx)} ${r2(st)}L${r2(sx - rx)} ${r2(sb)}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(sx + rx)} ${r2(sb)}L${r2(sx + rx)} ${r2(st)}`;
  let svg = `<path d="${side}Z" fill="url(#GID-round)"/>`;
  for (const bz of bands) {
    const y = sb - bz;
    // a ring: a shadow line under a light line, both following the front of the body
    svg += `<path class="q-ring-shade" d="M${r2(sx - rx)} ${r2(y + 0.9)}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(sx + rx)} ${r2(y + 0.9)}" ${NS}/>`;
    svg += `<path class="q-ring-light" d="M${r2(sx - rx)} ${r2(y)}A${r2(rx)} ${r2(ry)} 0 0 0 ${r2(sx + rx)} ${r2(y)}" ${NS}/>`;
  }
  svg += `<path class="q-edge-open" d="${side}"/>`;
  svg += `<ellipse class="q-top" cx="${r2(sx)}" cy="${r2(st)}" rx="${r2(rx)}" ry="${r2(ry)}"/>`;
  svg += `<ellipse class="q-crease-fill" cx="${r2(sx)}" cy="${r2(st + 0.35)}" rx="${r2(rx * 0.8)}" ry="${r2(ry * 0.8)}"/>`;
  svg += `<ellipse class="q-edge" cx="${r2(sx)}" cy="${r2(st)}" rx="${r2(rx)}" ry="${r2(ry)}"/>`;
  return { svg, sx, sb, st, rx, ry };
}

export const POLISHED = {
  // A tower server: a label plate, three recessed drive bays with pulls and lights, a grille of closed slots, side vents, screws.
  web() {
    const w = 18, h = 34, b = box(-9, -9, 0, w, w, h);
    const bays = [0.5, 0.36, 0.22].map((f, i) => {
      const v = h * f;
      return recess(2, v, w - 4, 4.1) + rule(3.4, r2(v + 2.05), 8.5) + led(w - 5.6, r2(v + 2.05), 1.8) + (i === 0 ? "" : "");
    }).join("");
    const plate = `<rect class="q-plate" x="2" y="${r2(h * 0.7)}" width="${w - 4}" height="5.2" rx=".6"/>` + rule(3.4, r2(h * 0.7 + 3.4), 11) + rule(3.4, r2(h * 0.7 + 1.8), 8) + screw(2.9, r2(h * 0.7 + 4.4)) + screw(w - 2.9, r2(h * 0.7 + 4.4));
    const grille = Array.from({ length: 6 }, (_, i) => slot(2.4 + i * 2.3, 2, 1.1, 3.2)).join("");
    const front = face(b, "L", plate + bays + grille + `<path class="led" d="M${w - 5.6} ${r2(h * 0.86)}h2" ${NS}/>`);
    const side = face(b, "R", [0, 1].map((c) => Array.from({ length: 5 }, (_, i) => slot(3 + c * 6, h * 0.55 + i * 2.4, 4.2, 1)).join("")).join("") + screw(1.6, h - 1.8) + screw(w - 1.6, h - 1.8));
    const lid = face(b, "T", `<path class="q-rule" d="M0 ${w / 2}H${w}" ${NS}/>` + screw(1.7, 1.7) + screw(w - 1.7, 1.7) + screw(1.7, w - 1.7) + screw(w - 1.7, w - 1.7));
    return halo(19) + b.svg + front + side + lid;
  },

  // A database: a smoothly shaded drum with raised rings, a cap, a status light on the front ring.
  database() {
    const c = cylinder(13, 27, [9, 18]);
    const cap = `<ellipse class="q-crease" cx="0" cy="${r2(c.st)}" rx="${r2(c.rx * 0.36)}" ry="${r2(c.ry * 0.36)}" ${NS}/>`;
    const light = `<path class="led" d="M-2.6 ${r2(c.sb + c.ry - 4.4)}h5.2" ${NS}/>`;
    return halo(20) + c.svg + cap + light;
  },

  // A memory module: a bevelled board, chips with legs that land on the board, gold fingers, a notch, one light.
  cache() {
    const board = box(-17, -8, 0, 34, 16, 2.6, { bevel: 0.5 });
    const chips = [0, 1, 2, 3].map((i) => {
      const cx = -14.2 + i * 8;
      const chip = box(cx, -4.6, 2.6, 5.6, 8.6, 1.6, { top: "q-chip", bevel: 0.35 });
      const legs = face(chip, "L", Array.from({ length: 4 }, (_, k) => `<path class="q-leg" d="M${r2(0.8 + k * 1.35)} 0V-1.2" ${NS}/>`).join(""));
      return chip.svg + legs;
    }).join("");
    const fingers = face(board, "L", Array.from({ length: 14 }, (_, i) => (i === 7 ? "" : `<rect class="q-finger" x="${r2(1.2 + i * 2.32)}" y=".35" width="1.3" height="1.7" rx=".3"/>`)).join(""));
    const light = face(board, "R", led(4, 1.3, 2.6));
    return halo(26) + board.svg + fingers + light + chips;
  },

  // A load balancer: a 1U appliance with rack ears, a row of recessed ports with link lights, the fan-out etched in its lid.
  balancer() {
    const b = box(-16, -10, 0, 32, 20, 7);
    const ports = [0, 1, 2, 3].map((i) => recess(4 + i * 5.4, 1.4, 3.8, 3, 0.8) + `<path class="${i < 3 ? "led" : "q-rule"}" d="M${r2(4.4 + i * 5.4)} 5.6h1.6" ${NS}/>`).join("");
    const front = face(b, "L", ports + recess(26.4, 1.6, 3, 2.6, 0.7) + screw(1.3, 3.5) + screw(30.7, 3.5));
    const lid = face(b, "T", `<path class="q-etch" d="M4 10H12M12 10L25 4.2M12 10H25M12 10L25 15.8" ${NS}/>` +
      `<circle class="q-etch-dot" cx="12" cy="10" r="1"/><circle class="q-etch-dot" cx="25" cy="4.2" r=".9"/><circle class="q-etch-dot" cx="25" cy="10" r=".9"/><circle class="q-etch-dot" cx="25" cy="15.8" r=".9"/>` +
      screw(1.6, 1.6) + screw(30.4, 1.6) + screw(1.6, 18.4) + screw(30.4, 18.4));
    return halo(26) + b.svg + front + lid;
  },

  // DNS as a card index: an open box of address cards with tabs; one card is pulled up, the lookup that was found.
  dns() {
    const tray = box(-12, -8, 0, 24, 16, 9);
    // the box is open: draw its inner floor and back wall inside the top
    const inside = poly([[-10.8, -6.8, 9], [10.8, -6.8, 9], [10.8, 6.8, 9], [-10.8, 6.8, 9]], "q-recess") +
      poly([[-10.8, -6.8, 3], [10.8, -6.8, 3], [10.8, -6.8, 9], [-10.8, -6.8, 9]], "q-wall-face");
    const cards = [];
    for (let i = 0; i < 6; i++) {
      const y = -5.4 + i * 2.1, lift = i === 3 ? 8.5 : 0, tabX = -8 + (i % 3) * 6.2;
      const z0 = 3, z1 = 13 + lift;
      cards.push(poly([[-10, y, z0 + lift], [10, y, z0 + lift], [10, y, z1], [-10, y, z1]], i === 3 ? "q-card-lit" : "q-card") +
        poly([[tabX, y, z1], [tabX + 4.6, y, z1], [tabX + 4.6, y, z1 + 1.8], [tabX, y, z1 + 1.8]], i === 3 ? "q-card-lit" : "q-card") +
        (i === 3 ? `<polyline class="q-rule" ${NS} points="${P([[-7.5, y, z1 - 2.4], [3, y, z1 - 2.4]])}"/><polyline class="q-rule" ${NS} points="${P([[-7.5, y, z1 - 4.4], [6, y, z1 - 4.4]])}"/>` : ""));
    }
    // the front wall hides the cards' feet; it is drawn after them, with a finger notch and a label holder
    const front = poly([[-12, 8, 0], [12, 8, 0], [12, 8, 9], [-12, 8, 9]], "q-left") +
      poly([[-12, 8, 9 - 0.8], [12, 8, 9 - 0.8], [12, 8, 9], [-12, 8, 9]], "q-bevel");
    const holder = `<g transform="matrix(${[C, S, 0, -1].map(r2).join(" ")} ${r2(iso(-12, 8, 0)[0])} ${r2(iso(-12, 8, 0)[1])})">` +
      `<rect class="q-plate" x="8" y="3" width="8" height="3.4" rx=".4"/>` + rule(9.2, 4.7, 14.8) + screw(7.2, 4.7) + screw(16.8, 4.7) + led(2.2, 1.6, 2.4) + `</g>`;
    const sideAndOutline = poly([[12, -8, 0], [12, 8, 0], [12, 8, 9], [12, -8, 9]], "q-right") +
      poly([[12, 8, 9 - 0.8], [12, -8, 9 - 0.8], [12, -8, 9], [12, 8, 9]], "q-bevel-r") +
      line([[12, 8, 9], [12, 8, 0]], "q-crease") +
      `<polygon class="q-edge" points="${P([[-12, -8, 9], [12, -8, 9], [12, -8, 0], [12, 8, 0], [-12, 8, 0], [-12, 8, 9]])}"/>` +
      line([[-12, -8, 9], [-12, 8, 9], [12, 8, 9], [12, -8, 9]], "q-rim-top");
    // back wall and left rim behind the cards
    const back = poly([[-12, -8, 0], [12, -8, 0], [12, -8, 9], [-12, -8, 9]], "q-right");
    return halo(22) + back + inside + cards.join("") + front + holder + sideAndOutline;
  },

  // A queue: a tray on rollers with end stops, parcels taped shut, the direction etched on its lip.
  queue() {
    const rail = box(-22, -7, 0, 44, 14, 3);
    const lipBack = box(-22, -7, 3, 44, 1.4, 2.2, { bevel: 0.3 });
    const rollers = face(rail, "T", Array.from({ length: 10 }, (_, i) => `<path class="q-crease" d="M${r2(2 + i * 4.4)} 1.6V12.4" ${NS}/>`).join(""));
    const parcels = [12, 2, -8].map((x, i) => {
      const p = box(x, -4.4, 3, 7, 7, 6.4, { bevel: 0.45 });
      const tape = face(p, "T", `<path class="q-tape" d="M3.5 0V7" ${NS}/>`) + face(p, "L", `<path class="q-tape" d="M3.5 6.4V3.6" ${NS}/>`);
      return p.svg + tape;
    }).reverse().join("");
    const lipFront = box(-22, 5.6, 3, 44, 1.4, 2.2, { bevel: 0.3 });
    const stop = box(20.6, -7, 3, 1.4, 14, 4.4, { bevel: 0.3 });
    const front = face(rail, "L", `<path class="q-etch" d="M30 1.5l1.6 0M33.6 1.5l1.6 0M37.2 1.5l1.6 0" ${NS}/>` + screw(1.4, 1.5) + screw(42.6, 1.5));
    const light = face(rail, "R", led(4.5, 1.5, 3));
    return halo(30) + rail.svg + rollers + light + lipBack.svg + parcels + stop.svg + lipFront.svg + front;
  },
};

/** The base every part stands on, polished: a bevel strip on its rim, a crease where top meets side, a halo. */
export function plinthPolished(size = 56, h = 7, r = 11) {
  const half = size / 2, foot = [];
  for (const [cx, cy, a0] of [[half - r, half - r, 0], [r - half, half - r, 90], [r - half, r - half, 180], [half - r, r - half, 270]])
    for (let k = 0; k <= 8; k++) { const a = ((a0 + k * 11.25) * Math.PI) / 180; foot.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const top = foot.map(([x, y]) => iso(x, y, h)), bottom = foot.map(([x, y]) => iso(x, y, 0));
  const hull = (points) => {
    const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (const q of [...p].reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  };
  const d = (pts) => "M" + pts.map((p) => p.map(r2).join(" ")).join("L") + "Z";
  const rim = foot.map(([x, y]) => iso(x, y, h - 1.1));
  const [a, b] = [iso(half - r - 16, half, h * 0.45), iso(half - r - 5, half, h * 0.45)];
  return `<ellipse cx="0" cy="${r2(half * 0.55)}" rx="${half * 1.35}" ry="${half * 0.7}" fill="url(#GID-halo)"/>` +
    `<path class="q-base-side" d="${d(hull([...top, ...bottom]))}" fill="url(#GID-base)"/>` +
    `<path class="q-base-rim" d="${d(rim)}"/>` +
    `<path class="q-base-top" d="${d(top)}"/>` +
    `<path class="q-base-edge" d="${d(hull([...top, ...bottom]))}"/>` +
    `<path class="led strip" d="M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}"/>`;
}

/** Gradients for one theme panel: smooth round shading, the base's side, and the halo. */
export function defs(gid) {
  return `<defs>
    <linearGradient id="${gid}-round" x1="0" x2="1"><stop offset="0" class="q-s2"/><stop offset=".28" class="q-s3"/><stop offset=".62" class="q-s1"/><stop offset="1" class="q-s0"/></linearGradient>
    <linearGradient id="${gid}-base" x1="0" x2="1"><stop offset="0" class="q-s2"/><stop offset=".5" class="q-s2"/><stop offset=".5" class="q-s0"/><stop offset="1" class="q-s0"/></linearGradient>
    <radialGradient id="${gid}-halo"><stop offset="0" class="q-h0"/><stop offset=".6" class="q-h1"/><stop offset="1" class="q-h2"/></radialGradient>
  </defs>`;
}
