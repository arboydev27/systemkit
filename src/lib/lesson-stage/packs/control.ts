// The "control" pack: what checks, limits and lets through. Drawn to the rules in .claude/skills/pictogram-polish;
// roles and their options are listed in roles.ts, the objects in docs/pictogram-catalog.md.
import { C, NS, R2, S, ball, box, clamp, cylinder, each, face, halo, iso, lamp, led, line, plane, plate, pocket, poly, r2, recess, rule, screw, slot, type V3 } from "../draw.ts";
import type { GlyphOptions, StageRole } from "../roles.ts";
import type { Pack } from "../pictograms.ts";

const add = (p: V3, ...q: V3[]) => q.reduce<V3>((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], p);
const mul = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: V3) => mul(v, 1 / Math.hypot(...v));
const deg = (d: number) => (d * Math.PI) / 180;

function hull(p: [number, number][]) {
  p = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: [number, number][]) => list.reduce<[number, number][]>((h, q) => {
    while (h.length > 1 && (h[h.length - 1][0] - h[h.length - 2][0]) * (q[1] - h[h.length - 2][1]) - (h[h.length - 1][1] - h[h.length - 2][1]) * (q[0] - h[h.length - 2][0]) <= 0) h.pop();
    return h.push(q), h;
  }, []).slice(0, -1);
  return half(p).concat(half(p.reverse()));
}

/**
 * A solid bar at any angle (an arm, a lever): from corner o along edge vectors a, b, c. Its visible faces take the
 * tone of the way they face (up pt, left pl, right pr; `dark` one step deeper); `edge` is its ink outline, drawn after
 * anything on its faces.
 */
function bar(o: V3, a: V3, b: V3, c: V3, dark = false) {
  const tone = dark ? ["pm", "pr", "pd"] : ["pt", "pl", "pr"];
  let fill = "", crease = "";
  for (const [u, v, w] of [[a, b, c], [b, c, a], [c, a, b]]) {
    const n = cross(u, v), s = Math.sign(n[0] * w[0] + n[1] * w[1] + n[2] * w[2]);
    for (const far of [0, 1]) {
      if ((n[0] + n[1] + n[2]) * (far ? s : -s) < 1e-6) continue;
      const q = far ? add(o, w) : o, f = [q, add(q, u), add(q, u, v), add(q, v)], m = n.map(Math.abs);
      fill += poly(f, tone[m[2] >= m[0] && m[2] >= m[1] ? 0 : m[1] >= m[0] ? 1 : 2]);
      crease += line([...f, q], "crease");
    }
  }
  const ends = Array.from({ length: 8 }, (_, i) => iso(...add(o, mul(a, i & 1), mul(b, (i >> 1) & 1), mul(c, i >> 2))));
  return { fill, edge: crease + `<polygon class="edge" points="${hull(ends).map((q) => q.map(r2).join(",")).join(" ")}"/>` };
}
/** A rod (an arm, a spoke) from p along direction d, `t` across: a square bar turned so two of its sides face the viewer. */
function rod(p: V3, d: V3, len: number, t: number) {
  const e1 = unit(Math.abs(d[2]) > 0.95 ? [1, -1, 0] : cross(d, [0, 0, 1])), e2 = unit(cross(e1, d));
  return bar(add(p, mul(e1, -t / 2), mul(e2, -t / 2)), mul(unit(d), len), mul(e1, t), mul(e2, t));
}
/** A barrier arm pivoting at p, raised `up` degrees from level along +x: a bar with dark bands, a stub behind. */
function boom(p: V3, up: number, len: number, back: number, t = 2, d = 1.8) {
  const u: V3 = [Math.cos(deg(up)), 0, Math.sin(deg(up))], n: V3 = [-u[2], 0, u[0]], L = len + back;
  const o = add(p, mul(u, -back), mul(n, -t / 2), [0, -d / 2, 0]), b = bar(o, mul(u, L), [0, d, 0], mul(n, t));
  const bands = (h: number) => each(Math.ceil((len - 3) / 7), (i) => `<rect class="slot" x="${r2(back + 3 + i * 7)}" y="0" width="${r2(Math.min(3.5, L - back - 3 - i * 7))}" height="${h}"/>`);
  return b.fill + plane(add(o, [0, d, 0]), u, n, bands(t)) + plane(up < 45 ? add(o, mul(n, t)) : o, u, [0, 1, 0], bands(d)) + b.edge;
}
const raise = (o: GlyphOptions, full: number, part: number, rest = 0) => (o.open === true ? full : o.open === "half" ? part : rest);
const disc = (u: number, v: number, r: number, cls = "pm") => `<circle class="${cls}" cx="${r2(u)}" cy="${r2(v)}" r="${r}"/><circle class="edge" cx="${r2(u)}" cy="${r2(v)}" r="${r}"/>`;
const corners = (w: number, h: number, i = 1.4) => screw(i, i) + screw(w - i, i) + screw(i, h - i) + screw(w - i, h - i);
let clips = 0;

const pack: Pack = {
  // An API gateway: a checkpoint booth glazed all round under an overhanging roof, its barrier arm across the lane.
  gateway(o) {
    const booth = box(-17, -10, 0, 10, 13, 17), roof = box(-18.2, -11.2, 17, 12.4, 15.4, 2.2, { bevel: 0.6 });
    const glazing = face(booth, "L", recess(1.4, 8, 7.2, 7.6, 1.2) + plate(1.6, 2.4, 6.8, 3.2)) +
      face(booth, "R", recess(1.4, 8, 4.6, 7.6, 1.2) + recess(7, 8, 4.6, 7.6, 1.2) + screw(1.6, 1.6) + screw(11.4, 1.6));
    // the post stands right of the booth, far enough that the raised arm stands clear of the roof's right corner against
    // the background (so open reads, and the roofed booth reads as its own block, not the gate's housing); the arm is
    // short enough that lowered it still ends on the base. The lamp is the only mark on the post
    const post = box(1, -4.7, 0, 4.6, 4.6, 9.6);
    return halo(24, 12, 2) + booth.svg + glazing + roof.svg + face(roof, "T", corners(12.4, 15.4)) +
      post.svg + face(post, "L", lamp(2.3, 6.6, 1.2)) + boom([6.4, -2.4, 7.8], raise(o, 88, 40), 13, 0.8);
  },

  // A gate: a boom barrier, the arm on a hub at the lane-side edge of its housing, reaching well past it across the
  // way to rest in a forked post. The arm pivots low, so raised it stays about level with the notes over the part.
  gate(o) {
    const up = raise(o, 88, 38), t = 2.6, d = 2.4, cab = box(-15, -9, 0, 11, 10, 16), hub: V3 = [-6.6, 2.4, 8 + t / 2];
    // the rest post stands under the arm's end, its fork round the arm, which lies on the post's top
    const py = hub[1] - d / 2 - 0.7, rest = box(14.5, py, 0, 3, d + 1.4, 8), prong = (y: number) => box(14.5, y, 8, 3, 0.7, 3.4, { bevel: 0 }).svg;
    // the signal light sits low on the housing's front, right of the hub: under the arm when it's down or half up, and
    // right of the stub that hangs below the hub when it's raised; the screws are on the lid, so the light has the
    // front to itself
    return halo(23, 11.5, 2) + cab.svg + face(cab, "L", lamp(9.2, 2.4, 1.2)) + face(cab, "R", each(3, (i) => slot(3.2 + i * 1.6, 3, 0.8, 8))) +
      face(cab, "T", corners(11, 10, 1.2)) + rest.svg + prong(py) + boom(hub, up, 23.4, 3, t, d) +
      plane(add(hub, [0, d / 2, 0]), [1, 0, 0], [0, 0, 1], disc(0, 0, 2) + screw(0, 0)) + prong(py + d + 0.7);
  },

  // A circuit breaker: an upright wall box, taller than it is wide, its big toggle standing out of the module on its
  // front: up while it's on, down when it trips, level when it's half-open and trying again. A breaker box has no
  // vents, and the module's face stays plain, so only the lever stands out (never a porthole: that's the worker's gear).
  breaker(o) {
    // on, the toggle stands steep (72 degrees), so its front face and top end show and it reads as up even at a phone's
    // size; much shallower, its broad face turns edge on to the camera and it draws as a thin stick. It's half the
    // module's width, so the module shows either side and it reads as a lever, not a plate; it pivots mid-module, high
    // enough that tripped it still clears the floor
    const a = deg(raise(o, -60, 0, 72)), b = box(-9, -5, 0, 18, 9, 24), nose = box(-5, 4, 3, 10, 2.6, 16, { bevel: 0.4 });
    const d: V3 = [0, Math.cos(a), Math.sin(a)], n: V3 = [0, -d[2], d[1]], p: V3 = [0, 5.6, 11];
    const paddle = bar(add(p, [-2.5, 0, 0], mul(n, -1.3)), mul(d, 10.5), [5, 0, 0], mul(n, 2.6), true);
    // the label plate and the light share the top of the face, over the module, the plate kept left of the raised
    // toggle's tip; screws only at its foot, so neither top corner clumps
    return halo(20) + b.svg + face(b, "L", plate(1.6, 20, 6, 2.6) + lamp(15.4, 21.3, 1.2) + screw(1.4, 1.4) + screw(16.6, 1.4)) +
      face(b, "T", corners(18, 9, 1.5)) + nose.svg + face(nose, "L", screw(5, 1.3) + screw(5, 14.7)) + paddle.fill + paddle.edge;
  },

  // A rate limiter: turnstiles in a row, each a cabinet with a signal light and a three-armed rotor on its top that
  // lets one through, a solid side panel closing the last lane.
  limiter(o) {
    const n = clamp(Math.round(o.count ?? 1), 1, 3) || 1, k = [1.2, 1.06, 0.88][n - 1], w = 11.6 * k, cw = 4.4 * k, x0 = -(n * w + 1.6 * k) / 2;
    // the side panel is one solid low wall (posts under a bar read as a bench), so the arm across the lane (the one that
    // blocks) shows over it along its length, reaching for it as a real turnstile lane's arm does
    const side = box(x0 + n * w, -8 * k, 0, 1.6 * k, 16.4 * k, 6.4 * k, { bevel: 0.4 });
    // the rotor's arms lie in a plane square to its axis, which tilts toward the way through, so a push on the arm across
    // the lane turns it. The hub sits over the cabinet's lane-side top edge near its front end, its spindle running down
    // the axis into the top (behind the lane arm, as the camera sees it); there the arm that swings forward and down
    // passes in front of the cabinet, never through it. The lanes are narrow enough for the level arm to reach the next
    // cabinet or the side panel
    const dirs: V3[] = [[-0.5, 0.61, -0.61], [-0.5, -0.61, 0.61], [1, 0, 0]];
    return halo(10 + n * 7, 5 + n * 3.5, 2) + each(n, (i) => {
      const x = x0 + i * w, cab = box(x, -8 * k, 0, cw, 16 * k, 10 * k), hub: V3 = [x + cw - 0.6 * k, 7.6 * k, 11.5 * k];
      const spindle = rod(hub, [0, -1, -1], 3 * k, 1.6 * k);
      const arms = dirs.map((d) => { const r = rod(hub, d, 6.2 * k, 1.9 * k); return r.fill + r.edge; });
      return cab.svg + face(cab, "L", lamp(cw / 2, 4.4 * k, 1.1)) + face(cab, "T", pocket(0.7, 2.4 * k, cw - 1.4, 3 * k, 0.7)) +
        arms[1] + spindle.fill + spindle.edge + arms[0] + ball(...iso(...hub), 2.8 * k) + arms[2];
    }) + side.svg + face(side, "R", screw(1.2, 1.2) + screw(side.d - 1.2, 1.2));
  },

  // A token bucket: a hopper of tokens with a tap over it that drips new ones in; its fill is how many are left.
  bucket(o) {
    // the tokens in the mouth follow the fill unless the scene counts them itself, so the side and the mouth agree
    const level = clamp(o.level ?? 0.6, 0, 1), n = clamp(Math.round(o.items ?? level * 8), 0, 8);
    const t = cylinder(11, 18, { rBottom: 9.5, level, levelHot: o.levelHot, crease: false }), lz = clamp(18 * level, 1.2, 17.2);
    // the waterline: a ring at the fill's edge, so a bucket running dry still reads at a phone's size; the side's
    // silhouette goes down again over the ring's ends
    let water = "";
    if (level > 0) {
      const k = 9.5 + (1.5 * lz) / 18, wx = k * C * R2, wy = k * S * R2, y = t.sb - lz;
      const arc = (v: number) => `M${r2(-wx)} ${r2(v)}A${r2(wx)} ${r2(wy)} 0 0 0 ${r2(wx)} ${r2(v)}`;
      water = `<path class="ring-shade" d="${arc(y + 0.9)}" ${NS}/><path class="ring-light" d="${arc(y)}" ${NS}/>` +
        `<path class="edge" d="M${r2(-t.rx)} ${r2(t.st)}L${r2(-t.rxb)} ${r2(t.sb)}A${r2(t.rxb)} ${r2(t.ryb)} 0 0 0 ${r2(t.rxb)} ${r2(t.sb)}L${r2(t.rx)} ${r2(t.st)}"/>`;
    }
    const mx = r2(t.rx - 1.8), my = r2(t.ry - 1), mouth = `<ellipse class="recess" cx="0" cy="${r2(t.st + 0.4)}" rx="${mx}" ry="${my}"/>` +
      `<path class="wall" d="M${r2(-t.rx + 1.8)} ${r2(t.st + 0.4)}A${mx} ${my} 0 0 1 ${mx} ${r2(t.st + 0.4)}A${mx} ${r2(t.ry * 0.6)} 0 0 0 ${r2(-t.rx + 1.8)} ${r2(t.st + 0.4)}Z"/>`;
    // seen through the mouth: the fill's surface, at the height of the side's waterline, and the tokens lying on it.
    // The near rim hides them as the fill drops, so the mouth and the side agree; the far tokens are laid first, as
    // they're the ones a low fill still shows. A full load is a heap, not a ring: the later tokens fill the middle and
    // two lie on the others, so it reads as a pile in the mouth (lower ones first, then back to front)
    const id = `sk-clip-bucket-${++clips}`, ri = 8 + (1.5 * lz) / 18, sy = r2(t.sb - lz);
    const spots: V3[] = [[-3.8, -3.8, 0], [-5.4, 0, 0], [0, -5.4, 0], [-1.2, -1.2, 0.7], [3.8, -3.8, 0], [-3.8, 3.8, 0], [1.6, 1.6, 0], [-2.4, -2.4, 1.4]];
    const coins = spots.slice(0, n).sort((p, q) => p[2] - q[2] || p[0] + p[1] - q[0] - q[1])
      .map(([x, y, lift]) => cylinder(2.2, 0.7, { x, y, z: lz + lift, crease: false }).svg).join("");
    const inside = level > 0 ? `<clipPath id="${id}"><ellipse cx="0" cy="${r2(t.st + 0.4)}" rx="${mx}" ry="${my}"/></clipPath><g clip-path="url(#${id})">` +
      `<ellipse class="liquid${o.levelHot ? " is-hot" : ""}" cx="0" cy="${sy}" rx="${r2(ri * C * R2)}" ry="${r2(ri * S * R2)}"/>` +
      `<ellipse class="surface" cx="0" cy="${sy}" rx="${r2(ri * C * R2)}" ry="${r2(ri * S * R2)}" ${NS}/>${coins}</g>` : "";
    // the tap: a standpipe at the side, a spout over the middle, a valve handle, one token falling. The light is on the
    // metering valve on the standpipe, clear of the bucket's side, where the waterline moves
    const pipe = box(12.8, -3.3, 0, 2.6, 2.6, 30), spout = box(0, -3.3, 27.4, 15.4, 2.6, 2.6), nozzle = box(0.4, -3.1, 24.8, 2.2, 2.2, 2.6, { bevel: 0 });
    const valve = box(13.5, -2.6, 30, 1.2, 1.2, 1.4, { bevel: 0 }).svg + box(13.5, -5.2, 31.4, 1.2, 6.4, 1.1, { bevel: 0.3 }).svg;
    const drop = plane([1.5, -2, 21.4], [1, 0, 0], [0, 0, 1], disc(0, 0, 1.8, "pt"));
    const meter = box(12.1, -4, 10, 4, 4, 5.6, { bevel: 0.4 });
    return halo(17) + t.svg + water + mouth + inside + box(11.5, -4.6, 0, 5.2, 5.2, 1.2, { bevel: 0.3 }).svg + pipe.svg +
      meter.svg + face(meter, "L", lamp(2, 3, 1.1)) + face(meter, "R", slot(1.4, 1.4, 1.2, 2.8)) + spout.svg + nozzle.svg + valve + drop;
  },

  // A counter: a mechanical tally counter, number wheels behind a window, a plunger on top that clicks it on, and the
  // finger ring it's held by, standing off its end.
  counter() {
    const b = box(-11, -6, 0, 22, 12, 14, { bevel: 0.8 });
    // the ring: a flat loop in the window's plane, 1.2 thick (its back face shows as a dark sliver), on a short neck
    const loop = (ro: number, ri: number) => `M${-ro} 0A${ro} ${ro} 0 1 0 ${ro} 0A${ro} ${ro} 0 1 0 ${-ro} 0ZM${-ri} 0A${ri} ${ri} 0 1 1 ${ri} 0A${ri} ${ri} 0 1 1 ${-ri} 0Z`;
    const ring = (y: number, cls: string) => plane([15.2, y, 7], [1, 0, 0], [0, 0, 1], `<path class="${cls}" d="${loop(3.6, 2.1)}"/><path class="edge" d="${loop(3.6, 2.1)}"/>`);
    const finger = ring(-3.4, "pd") + box(11, -3.4, 6.2, 0.9, 1.2, 1.6, { bevel: 0 }).svg + ring(-2.2, "pm");
    const wheels = each(4, (i) => {
      const cu = 5.2 + i * 3.9, cv = 8.4;
      // a wheel turns about a level axis, so its shading runs top to bottom: the round gradient, turned
      return `<rect x="${r2(cu - 3)}" y="${r2(cv - 1.65)}" width="6" height="3.3" fill="url(#sk-round)" transform="rotate(-90 ${r2(cu)} ${r2(cv)})"/>` + rule(cu - 0.7, cv, cu + 0.7);
    });
    // screws only at the face's foot, so the window's top rim stays clean
    return halo(23, 11.5, 1, 1.5) + b.svg + face(b, "L", recess(2.4, 4.6, 17.2, 7.8, 1) + wheels + led(15.6, 2.2, 3) + screw(1.4, 1.4) + screw(20.6, 1.4)) +
      face(b, "R", each(3, (i) => slot(2.2 + i * 2.2, 4, 1, 6))) + face(b, "T", screw(1.6, 1.6) + screw(20.4, 1.6)) +
      cylinder(1.5, 1.8, { x: -5.5, y: 0, z: 14, bands: [0.9], crease: false }).svg +
      cylinder(2.1, 4.6, { x: 4.5, y: 0, z: 14, crease: false }).svg + cylinder(3.8, 2, { x: 4.5, y: 0, z: 18.6 }).svg + finger;
  },

  // A lock: a padlock hung on a hasp, its shackle through the staple. Unlatched ("half"), the shackle springs up, its
  // short leg out of its socket; open, it also swings half a turn about its long leg, out of the staple, so its short
  // leg stands in the air beside the body.
  lock(o) {
    // drawn at k times its first sketch, in code rather than with a transform, so its silhouette keeps the weight every
    // other part's has and it stands as large as its neighbours; the face details are scaled as a group (as sensor()'s are)
    const k = 1.3, g = (inner: string) => `<g transform="scale(${k})">${inner}</g>`;
    const swing = o.open === true, up = raise(o, 4, 4.5) * k;
    const back = box(-6.5 * k, -9.4 * k, 0, 13 * k, 2.4 * k, 15 * k, { bevel: 0.65 }), body = box(-7 * k, -3.2 * k, 1.4 * k, 14 * k, 6.4 * k, 12 * k, { bevel: 0.9 });
    // the long leg stays in the body; the short one comes out. Swung, the path is mirrored about the long leg (not the
    // plane, so the round shading stays lit from the left)
    const z = 13.4 * k + up, legs = r2(3.4 * k), ro = r2(6 * k), ri = r2(3.4 * k), m = (u: number) => r2(swing ? -(ro + ri) - u : u), f = swing ? [1, 0] : [0, 1];
    const d = `M${m(-ro)} ${r2(-up)}V${legs}A${ro} ${ro} 0 0 ${f[0]} ${m(ro)} ${legs}V0H${m(ri)}V${legs}A${ri} ${ri} 0 0 ${f[1]} ${m(-ri)} ${legs}V${r2(-up)}Z`;
    const shackle = plane([0, 0, z], [1, 0, 0], [0, 0, 1], `<path d="${d}" fill="url(#sk-round)"/><path class="edge" d="${d}"/>`);
    // the short leg's socket in the body's top, empty under the gap once the shackle springs up (a leg in its socket
    // fills it, so the long leg's never shows)
    const socket = (u: number) => `<circle class="recess" cx="${u}" cy="3.2" r="1.4"/>` +
      `<path class="wall" d="M${r2(u - 1.4)} 3.2A1.4 1.4 0 0 1 ${r2(u + 1.4)} 3.2A1.4 .8 0 0 0 ${r2(u - 1.4)} 3.2Z"/><circle class="rim" cx="${u}" cy="3.2" r="1.4" ${NS}/>`;
    // the body goes down before the staple and the shackle: they stand above its top, which they hide, never the other way
    return halo(25) + back.svg + face(back, "L", corners(13 * k, 15 * k, 1.6)) +
      body.svg + face(body, "L", g(`<circle class="recess" cx="7" cy="5.4" r="1.6"/><rect class="recess" x="6.3" y="2" width="1.4" height="3.8" rx=".4"/>` + led(5.6, 9.2, 2.8))) +
      (up ? face(body, "T", g(socket(11.7))) : "") +
      box(-1.3 * k, -7 * k, 14.6 * k, 2.6 * k, 5.6 * k, 2 * k, { bevel: 0 }).svg + shackle + box(-1.3 * k, -1.4 * k, 14.6 * k, 2.6 * k, 3 * k, 2 * k, { bevel: 0 }).svg;
  },
};

export default pack;

/** Options worth seeing on the comparison sheet, per role (the first is how scenes usually show it). */
export const samples: Partial<Record<StageRole, GlyphOptions[]>> = {
  gateway: [{ open: true }, { open: "half" }],
  gate: [{ open: true }, { open: "half" }],
  breaker: [{ open: true }, { open: "half" }],
  limiter: [{ count: 2 }, { count: 3 }],
  bucket: [{ level: 0 }, { level: 0.2 }, { level: 0.6, items: 2 }, { level: 1, levelHot: true }],
  lock: [{ open: true }, { open: "half" }],
};
