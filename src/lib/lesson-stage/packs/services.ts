// The "services" pack: machines that do one job. Drawn to the rules in .claude/skills/pictogram-polish; roles and their
// options are listed in roles.ts, what each object is in docs/pictogram-catalog.md.
import { C, NS, R2, S, ball, box, clamp, cylinder, each, face, halo, iso, led, line, plane, plate, pocket, poly, r2, recess, rule, screw, slot, type V3 } from "../draw.ts";
import type { GlyphOptions, StageRole } from "../roles.ts";
import type { Pack } from "../pictograms.ts";

const add = (p: V3, q: V3, k = 1): V3 => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const at = (p: V3) => iso(...p).map(r2).join(" ");

function hull(p: [number, number][]) {
  const turn = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => list.reduce<[number, number][]>((h, q) => {
    while (h.length > 1 && turn(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
    return h.push(q), h;
  }, []).slice(0, -1);
  const s = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return half(s).concat(half(s.reverse()));
}

/** A block on any three edges (a tilted boom, a plug): the faces turned to the viewer, creases where they meet, an ink outline. */
function block(o: V3, e: [V3, V3, V3]) {
  const corner = (i: number) => e.reduce<V3>((p, d, t) => ((i >> t) & 1 ? add(p, d) : p), o);
  const shown: number[][] = [];
  let svg = "";
  for (let t = 0; t < 3; t++) {
    const p = (t + 1) % 3, q = (t + 2) % 3, n = cross(e[p], e[q]), k = Math.sign(n[0] * e[t][0] + n[1] * e[t][1] + n[2] * e[t][2]);
    for (const s of [0, 1]) {
      const [nx, ny, nz] = n.map((v) => v * k * (s ? 1 : -1));
      if (nx + ny + nz <= 0) continue;
      svg += poly([0, 1, 3, 2].map((j) => corner((s << t) | ((j & 1) << p) | ((j >> 1) << q))), nz / Math.hypot(nx, ny, nz) > 0.55 ? "pt" : ny >= nx ? "pl" : "pr");
      shown.push([t, s]);
    }
  }
  for (const [t1, s1] of shown) for (const [t2, s2] of shown) if (t1 < t2) {
    const i = (s1 << t1) | (s2 << t2);
    svg += line([corner(i), corner(i | (1 << (3 - t1 - t2)))], "crease");
  }
  return svg + `<polygon class="edge" points="${hull(Array.from({ length: 8 }, (_, i) => iso(...corner(i)))).map((q) => q.map(r2).join(",")).join(" ")}"/>`;
}

/** A disc standing upright: facing +x (a = 30, a pipe's end) or +y (a = -30, a reel's flange). */
const disc = (p: V3, r: number, cls: string, a = 30) => {
  const [cx, cy] = iso(...p).map(r2);
  return `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${r2(r * S * R2)}" ry="${r2(r * C * R2)}" transform="rotate(${a} ${cx} ${cy})"/>`;
};
/** A pipe lying along x from x0 to x1 at (y, z): shaded across from the round gradient, a rounded far end, a flat near end. */
function pipe(x0: number, x1: number, y: number, z: number, r: number) {
  const [ox, oy] = iso(x0, y, z).map(r2), w = r2(r * C * R2), L = r2(x1 - x0);
  const side = `M${w} ${L}V0A${w} ${r2(r * S * R2)} 0 0 0 ${-w} 0V${L}`;
  return `<g transform="matrix(-.5 ${r2(C)} ${r2(C)} .5 ${ox} ${oy})"><path d="${side}Z" fill="url(#sk-round)"/><path class="edge" d="${side}"/></g>` +
    disc([x1, y, z], r, "pm") + disc([x1, y, z], r, "edge");
}
/** A round recess on a face: a dark floor, the shadowed wall under its top edge, a faint rim. */
const round = (u: number, v: number, r: number) =>
  `<circle class="recess" cx="${r2(u)}" cy="${r2(v)}" r="${r2(r)}"/>` +
  `<path class="wall" d="M${r2(u - r)} ${r2(v)}A${r2(r)} ${r2(r)} 0 0 0 ${r2(u + r)} ${r2(v)}A${r2(r)} ${r2(r * 0.7)} 0 0 1 ${r2(u - r)} ${r2(v)}Z"/>` +
  `<circle class="rim" cx="${r2(u)}" cy="${r2(v)}" r="${r2(r)}" ${NS}/>`;
const corners = (w: number, h: number, m = 1.3) => screw(m, m) + screw(w - m, m) + screw(m, h - m) + screw(w - m, h - m);

const pack: Pack = {
  // A switchboard: a panel of eight jacks over a shelf; each held connection (`items`) is a cord plugged from the shelf
  // into a jack, none an idle board.
  socket(o) {
    const n = clamp(o.items ?? 3, 0, 8);
    const desk = box(-14, -9, 0, 28, 18, 11), panel = box(-14, -9, 11, 28, 6, 20, { bevel: 0.6 });
    // jack k: 0-3 the lower row, 4-7 the upper; the held ones spread across the panel as more are held
    const jack = (k: number): V3 => [-9.6 + (k % 4) * 6.4, -3, k < 4 ? 17 : 23.5];
    const hole = (k: number): V3 => [jack(k)[0] + (k < 4 ? -1.2 : 1.8), k < 4 ? 5 : 7.4, 11];
    const held = [0, 5, 2, 7, 1, 6, 3, 4].slice(0, n).sort((a, b) => a - b);
    const cord = (k: number) => {
      const a = jack(k), h = hole(k), e = add(a, [0, 1.4, 0]);
      // a cord at the silhouette's weight and a light plug head with a thin outline, so a full board doesn't outweigh
      // its own outline
      const [px, py] = iso(...e);
      return `<path class="edge-open" d="M${at(e)}C${at(add(e, [0, 6, 1]))} ${at(add(h, [0, -1, 5]))} ${at(h)}"/>` +
        `<circle class="card" cx="${r2(px)}" cy="${r2(py)}" r="1.4"/>`;
    };
    const shelf = face(desk, "T", each(8, (k) => { const [x, y] = hole(k); return round(x + 14, y + 9, 0.9); }));
    return halo(25) + desk.svg + shelf + face(desk, "L", plate(3, 3.6, 11, 3.8) + led(22, 5.5, 3) + screw(1.3, 1.3) + screw(26.7, 1.3)) +
      face(desk, "R", each(4, (i) => slot(3.4 + i * 3.4, 2.6, 1.4, 5.6))) + panel.svg +
      face(panel, "L", each(8, (k) => round(4.4 + (k % 4) * 6.4, k < 4 ? 6 : 12.5, 1.5)) + plate(3, 15.4, 22, 2.8) + screw(1.3, 18.7) + screw(26.7, 18.7)) +
      held.map(cord).join("");
  },

  // A manifold: one flanged inlet into a header pipe on saddles, a row of outlets on top, each through a valve.
  fanout(o) {
    const n = clamp(o.count ?? 4, 2, 6), Z = 9, R = 4, zv = Z + R + 1.6;
    const skid = box(-17, -6, 0, 31, 12, 2.4, { bevel: 0.5 });
    const saddles = [-12.5, 2].map((x) => box(x, -3.4, 2.4, 3.4, 6.8, 3.2, { bevel: 0.4 }).svg).join("");
    const outlet = (i: number) => {
      const x = -15 + ((i + 0.5) * 21) / n, r = Math.min(2, 8.8 / n), top = cylinder(r * 0.66, 4, { x, z: zv + 2.4, crease: false });
      // the stem rises from the pipe's crown, so the header's front isn't painted over
      const z0 = Z + Math.sqrt(R * R - (r * 0.66) ** 2) - 0.4;
      return cylinder(r * 0.66, zv - z0, { x, z: z0, crease: false }).svg + cylinder(r, 2.4, { x, z: zv, crease: false }).svg + top.svg +
        `<ellipse class="recess" cx="${r2(top.sx)}" cy="${r2(top.st)}" rx="${r2(top.rx * 0.6)}" ry="${r2(top.ry * 0.6)}"/>`;
    };
    const bolts = (x: number, r: number, k: number) => each(k, (i) => { const a = ((i + 0.5) / k) * Math.PI * 2; return screw(...iso(x, r * Math.cos(a), Z + r * Math.sin(a))); });
    return halo(25, 12.5) + skid.svg + face(skid, "L", led(24, 1.2, 3)) + saddles + pipe(-16, 8, 0, Z, R) + each(n, outlet) +
      pipe(8, 9.4, 0, Z, 5.4) + bolts(9.4, 4.5, 6) + pipe(9.4, 15.6, 0, Z, 3) + disc([15.6, 0, Z], 2, "recess");
  },

  // A take-a-number dispenser on a stand: a turned drum under a lid ring, the next ticket sticking out of the slot in
  // its front.
  idgen() {
    const foot = cylinder(6.5, 1.8, { crease: false }), post = cylinder(1.3, 14.4, { z: 1.8, crease: false });
    // the lid is closed: a plain top, no inner crease, so the drum doesn't read as an open cup
    const R = 8, Z = 16, drum = cylinder(R, 11, { z: Z }), lid = cylinder(R + 0.7, 1.6, { z: Z + 11, crease: false });
    // a plane tangent to the drum at `deg` degrees round from +x (45 faces the viewer): n out of the drum, u along it
    const tangent = (deg: number) => {
      const a = (deg * Math.PI) / 180, n: V3 = [Math.cos(a), Math.sin(a), 0];
      return { n, u: [Math.sin(a), -Math.cos(a), 0] as V3, mid: [R * n[0], R * n[1], Z] as V3 };
    };
    // the slot faces the front-left; the light sits just under the slot's right end, round the drum from it, where the
    // drooping ticket can't hide it
    const { n, u, mid } = tangent(62), lit = tangent(29), sw = 9;
    const front = plane(add(mid, u, -sw / 2), u, [0, 0, 1], recess(0, 6, sw, 1.8, 0.7)) + plane(add(lit.mid, lit.u, -1.2), lit.u, [0, 0, 1], led(0.8, 3, 2.4));
    // the ticket leaves the slot drooping a little; its torn end is serrated
    const tw = 7, L = 6.8, T = (s: number, d: number): V3 => add(add(add(mid, u, s), n, d), [0, 0, 6.9 - d * 0.3]);
    const down: V3 = [n[0] * 0.958, n[1] * 0.958, -0.287];
    const ticket = poly([T(-tw / 2, 0), T(tw / 2, 0), ...Array.from({ length: 9 }, (_, i) => T(tw / 2 - (i * tw) / 8, L + (i % 2) * 0.8))], "card-lit") +
      plane(T(-tw / 2, 0), u, down, rule(1.4, 2.4, 5.2) + rule(1.4, 4.4, 3.8));
    return halo(14, 7) + foot.svg + post.svg + drum.svg + lid.svg + front + ticket;
  },

  // A transcoder: the original runs in from a reel on its lid; renditions come out in trays of falling size.
  transcoder(o) {
    const n = clamp(o.count ?? 3, 1, 3);
    const b = box(-14, -10, 0, 26, 14, 15);
    const rc: V3 = [-4.5, -4.5, 23.4], R = 7;
    const stand = box(-9, -8.4, 15, 9, 2.6, 2.4, { bevel: 0.4 });
    const film = poly([[1.1, -6.6, 23.4], [1.1, -4.8, 23.4], [1.1, -4.8, 15], [1.1, -6.6, 15]], "pd");
    // the reel faces the viewer's left (+y): its axle runs along y, the back flange and the tape pack behind the front one
    const reel = disc(add(rc, [0, -2.2, 0]), R, "pr", -30) + disc(add(rc, [0, -2.2, 0]), R, "edge", -30) + disc(add(rc, [0, -1.1, 0]), R * 0.8, "pd", -30) + film +
      disc(rc, R, "pl", -30) + disc(rc, R, "edge", -30) +
      plane(rc, [1, 0, 0], [0, 0, 1], each(3, (i) => { const a = (i / 3 + 0.25) * Math.PI * 2; return round(4 * Math.cos(a), 4 * Math.sin(a), 2.1); }) +
        `<circle class="pd" r="1.1"/>` + screw(0, 0));
    const tray = (i: number) => {
      const w = 18 - i * 5, d = 8.5 - i * 2, x = -1 - w / 2, z = 1.4 + i * 4.5, zt = z + 1.2;
      const t = box(x, 4, z, w, d, 1.2, { bevel: 0.3 });
      return t.svg + poly([[x + 1, 5, zt], [x + w - 1, 5, zt], [x + w - 1, 3 + d, zt], [x + 1, 3 + d, zt]], "card");
    };
    const mouths = each(n, (i) => recess(13 - (19 - i * 5) / 2, 1 + i * 4.5, 19 - i * 5, 2.6, 0.8));
    return halo(24, 12) + b.svg + face(b, "L", mouths + led(21, 13, 2.6)) + face(b, "R", each(3, (i) => slot(3 + i * 3.4, 5, 1.4, 6.4)) + screw(1.3, 13.7) + screw(12.7, 13.7)) +
      face(b, "T", pocket(14.3, 2.8, 2.6, 2.6, 0.6) + screw(1.3, 12.7) + screw(24.7, 12.7)) + stand.svg + reel + each(n, tray);
  },

  // A fetcher: a small crane on a turret; its boom reaches up and out, and the claw on its cable holds a page.
  fetcher() {
    const turret = cylinder(8, 4, { bands: [2] });
    const cab = box(-4.5, -5, 4, 9, 10, 10, { bevel: 0.7 }), weight = box(-4, 5, 4, 8, 3, 6, { bevel: 0.5 });
    const boom = block([-1.3, -1.5, 12.4], [[2.6, 0, 0], [0, -15, 18], [0, 1.54, 1.28]]), Y = -15.7, cable = 21;
    const tip: V3 = [0, Y, 31.4];
    const page = poly([[-4, Y, 7], [4, Y, 7], [4, Y, 18.4], [-4, Y, 18.4]], "card-lit") +
      plane([-4, Y, 7], [1, 0, 0], [0, 0, 1], rule(1.6, 8.4, 6.6) + rule(1.6, 6.2, 6) + rule(1.6, 4, 4.6));
    const hook = box(-1.4, Y - 1, cable - 2.4, 2.8, 2, 2.4, { bevel: 0.3 });
    const fingers = [-1, 1].map((s) => `<path class="handle" d="M${at([s * 1.4, Y, cable - 2.4])}Q${at([s * 2.8, Y, cable - 3.4])} ${at([s * 1.8, Y, 17])}"/><circle class="ink" cx="${r2(iso(s * 1.8, Y, 17)[0])}" cy="${r2(iso(s * 1.8, Y, 17)[1])}" r=".6"/>`).join("");
    // the light sits on the strip of the cab's front that shows above the counterweight; the weight is cast plates
    return halo(19) + line([tip, [0, Y, cable]], "handle") + page + hook.svg + fingers + turret.svg + cab.svg + face(cab, "L", led(3.3, 7.8, 2.4)) +
      face(cab, "R", recess(1.4, 3.4, 7.2, 5, 0.8)) + face(cab, "T", screw(1.3, 1.3) + screw(7.7, 1.3)) + boom + ball(...iso(...tip), 1.5) +
      weight.svg + face(weight, "L", slot(1.2, 1.6, 5.6, 0.9) + slot(1.2, 3.4, 5.6, 0.9));
  },

  // A coin sorter: a hopper over a sloped bed of chutes, one per key range, each into its coin tube; the coin drops, lit, into the one taking it.
  router(o) {
    const n = clamp(o.count ?? 3, 2, 4), m = o.mark === undefined ? -1 : clamp(o.mark, 0, n - 1);
    const W = 14, B = -13, Yc = -1, Y1 = 9, Z0 = 18, Z1 = 6, L = Math.hypot(Y1 - Yc, Z0 - Z1);
    const shell = poly([[W, B, 0], [W, Y1, 0], [W, Y1, Z1], [W, Yc, Z0], [W, B, Z0]], "pr") +
      poly([[W, B, Z0 - 0.6], [W, Yc, Z0 - 0.6], [W, Yc, Z0], [W, B, Z0]], "bevel-r") + poly([[W, Yc, Z0 - 0.6], [W, Y1, Z1 - 0.6], [W, Y1, Z1], [W, Yc, Z0]], "bevel-r") +
      poly([[-W, Y1, 0], [W, Y1, 0], [W, Y1, Z1], [-W, Y1, Z1]], "pl") + poly([[-W, Y1, Z1 - 0.6], [W, Y1, Z1 - 0.6], [W, Y1, Z1], [-W, Y1, Z1]], "bevel") +
      poly([[-W, B, Z0], [W, B, Z0], [W, Yc, Z0], [-W, Yc, Z0]], "pt") + poly([[-W, Yc, Z0], [W, Yc, Z0], [W, Y1, Z1], [-W, Y1, Z1]], "pt") +
      line([[-W, Yc, Z0], [W, Yc, Z0], [W, B, Z0]], "crease") + line([[-W, Y1, Z1], [W, Y1, Z1], [W, Yc, Z0]], "crease") + line([[W, Y1, Z1], [W, Y1, 0]], "crease") +
      `<polygon class="edge" points="${([[-W, B, Z0], [W, B, Z0], [W, B, 0], [W, Y1, 0], [-W, Y1, 0], [-W, Y1, Z1], [-W, Yc, Z0]] as V3[]).map((p) => iso(...p).map(r2).join(",")).join(" ")}"/>`;
    const gap = Math.min(7.5, 24 / n), cx = (i: number) => (i - (n - 1) / 2) * gap;
    const bed = plane([-W, Y1, Z1], [1, 0, 0], [0, -(Y1 - Yc) / L, (Z0 - Z1) / L], each(n, (i) => recess(W + cx(i) - 1.7, 0.6, 3.4, L - 2.6, 1)));
    const side = plane([W, Yc, 0], [0, -1, 0], [0, 0, 1], each(3, (i) => slot(2.4 + i * 3, 4, 1.4, 7)) + led(2.4, 14.6, 2.6));
    const tube = (i: number) => {
      // the tube taking the coin is pulled out along (+x, +y): straight down on screen, still under its chute, clear of
      // its neighbours
      const x = cx(i) + (i === m ? 1.8 : 0), y = i === m ? 14 : 12.2;
      const t = cylinder(2.2, 7, { x, y, crease: false });
      // the coin stands upright over the mouth, lit, a gap under it as it drops in
      return t.svg + `<ellipse class="recess" cx="${r2(t.sx)}" cy="${r2(t.st)}" rx="${r2(t.rx * 0.7)}" ry="${r2(t.ry * 0.7)}"/>` +
        (i === m ? disc([x, y, 10.6], 1.8, "lamp", -30) + disc([x, y, 10.6], 1.8, "edge", -30) : "");
    };
    const hopper = cylinder(9, 9, { rBottom: 4.6, y: -7, z: Z0, crease: false });
    const a = hopper.rx - 1.6, b = hopper.ry - 0.9, y0 = r2(hopper.st + 0.4);
    const mouth = (cls: string, extra = "") => `<ellipse class="${cls}" cx="${r2(hopper.sx)}" cy="${y0}" rx="${r2(a)}" ry="${r2(b)}"${extra}/>`;
    // the open funnel's far wall, in shadow, like the storage bucket's mouth
    const wall = `<path class="wall" d="M${r2(hopper.sx - a)} ${y0}A${r2(a)} ${r2(b)} 0 0 1 ${r2(hopper.sx + a)} ${y0}A${r2(a)} ${r2(b * 0.7)} 0 0 0 ${r2(hopper.sx - a)} ${y0}Z"/>`;
    return halo(24, 12) + shell + bed + side + hopper.svg + mouth("recess") + wall + mouth("rim", ` ${NS}`) + each(n, tube);
  },

  // A ballot box: a vote goes in through the slot in its lid; a window in its front shows a cell per voter, filled as votes come in.
  coordinator(o) {
    const n = clamp(o.count ?? 3, 2, 5), k = clamp(o.items ?? 0, 0, n);
    const b = box(-12, -10, 0, 24, 20, 18), lid = box(-12.6, -10.6, 18, 25.2, 21.2, 2, { bevel: 0.5 });
    const ballot = poly([[-4.4, 0.4, 19.6], [4.4, 0.4, 19.6], [4.4, 0.4, 28], [-4.4, 0.4, 28]], "card-lit") +
      plane([-4.4, 0.4, 19.6], [1, 0, 0], [0, 0, 1], rule(1.4, 6, 7) + rule(1.4, 4, 5.4) + `<rect class="rim" x="5.4" y="3.2" width="1.8" height="1.8" ${NS}/>`);
    const w = n * 4 + 0.8, u0 = 12 - w / 2;
    const tally = recess(u0, 8, w, 5.4, 0.9) + each(n, (i) => (i < k ? `<rect class="ink" x="${r2(u0 + 0.8 + i * 4)}" y="8.8" width="3.2" height="3.4" rx=".4"/>` : "") +
      `<rect class="rim" x="${r2(u0 + 0.8 + i * 4)}" y="8.8" width="3.2" height="3.4" rx=".4" ${NS}/>`);
    return halo(22, 11) + b.svg + face(b, "L", tally + led(10.8, 3.6, 2.4) + screw(1.3, 1.3) + screw(22.7, 1.3)) + face(b, "R", plate(5, 9, 10, 3.6)) + lid.svg +
      face(lid, "T", pocket(8, 10.4, 9.2, 1.6, 0.6) + corners(25.2, 21.2)) + ballot;
  },

  // A key cabinet, its door open: pegs in rows, the keys that are held hanging from them; a register inside the door.
  registry(o) {
    const n = clamp(o.count ?? 4, 2, 6), k = clamp(o.items ?? 2, 0, n), rows = n > 3 ? 2 : 1, per = Math.ceil(n / rows);
    // the cabinet stands right of centre, its door as wide as its front, so the open door's free edge ends well clear of
    // the leader's flag pole at the base's left corner
    const W = 18, X = -6, b = box(X, -12, 0, W, 10, 31, { bevel: 0.8 });
    // a shorter last row is centred, so it doesn't read as a missing peg
    const peg = (i: number): [number, number] => {
      const row = Math.floor(i / per), rowN = Math.min(per, n - row * per);
      return [1.6 + ((i % per) + 0.5 + (per - rowN) / 2) * ((W - 3.2) / per), rows === 1 ? 21 : 23.4 - row * 11.4];
    };
    // a held key: an outlined bow and a broad blade, so the keys still show on a phone's stage
    const keyPath = (u: number, v: number) => `M${r2(u - 0.75)} ${r2(v - 2.6)}V${r2(v - 9)}h1.5v1.2h1.2v1.2h-1.2V${r2(v - 2.6)}Z`;
    const key = (u: number, v: number) => `<path class="card" d="${keyPath(u, v)}"/><circle class="card" cx="${r2(u)}" cy="${r2(v - 2)}" r="1.5"/>` +
      `<circle class="recess" cx="${r2(u)}" cy="${r2(v - 1.6)}" r=".5"/>`;
    const inside = recess(1.6, 1.8, W - 3.2, 27.4, 1.4) + plate(3.4, 25, W - 6.8, 2.4) + each(n, (i) => { const [u, v] = peg(i); return `<circle class="pm" cx="${r2(u)}" cy="${r2(v)}" r=".8"/><circle class="rim" cx="${r2(u)}" cy="${r2(v)}" r=".8" ${NS}/>` + (i < k ? key(u, v) : ""); });
    const door = box(X - 1.2, -2, 0.6, 1.2, W, 29.8, { bevel: 0.4 });
    const register = `<rect class="plate" x="3" y="5" width="${W - 6}" height="19" rx=".5"/>` + each(6, (i) => rule(4.6, 21 - i * 2.8, i % 2 ? W - 8 : W - 5.4)) + screw(W / 2, 22.8);
    // the light is on the right side under its top screws, clear of the recess's rim
    return halo(20) + b.svg + face(b, "L", inside) + face(b, "R", led(3.8, 26.6, 2.4) + screw(1.3, 29.7) + screw(8.7, 29.7)) + face(b, "T", screw(1.3, 1.3) + screw(W - 1.3, 1.3)) +
      door.svg + face(door, "R", register + `<rect class="pd" x="1" y="13" width="1.2" height="4.4" rx=".5"/>`);
  },
};

export default pack;

/** Options worth seeing on the comparison sheet, per role (the first is how scenes usually show it). */
export const samples: Partial<Record<StageRole, GlyphOptions[]>> = {
  socket: [{ items: 3 }, { items: 0 }, { items: 1 }, { items: 8 }],
  fanout: [{ count: 4 }, { count: 2 }, { count: 6 }],
  idgen: [{}],
  transcoder: [{ count: 3 }, { count: 1 }, { count: 2 }],
  fetcher: [{}],
  router: [{ count: 3 }, { count: 3, mark: 1 }, { count: 2, mark: 0 }, { count: 4, mark: 3 }],
  coordinator: [{ count: 3, items: 2 }, { count: 2, items: 0 }, { count: 5, items: 5 }, { count: 5, items: 3 }],
  registry: [{ count: 4, items: 2 }, { count: 2, items: 0 }, { count: 6, items: 6 }, { count: 6, items: 3 }, { count: 5, items: 4 }, { count: 4, items: 2, lead: true }],
};
