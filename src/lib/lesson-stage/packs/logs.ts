// The "logs" pack: drawn to the rules in .claude/skills/pictogram-polish. Roles and their options are listed in roles.ts.
import { NS, box, clamp, cylinder, each, etch, face, floorEllipse, halo, lamp, led, line, plane, plate, poly, pts, r2, recess, rule, screw, slot, type V3 } from "../draw.ts";
import type { GlyphOptions, StageRole } from "../roles.ts";
import type { Pack } from "../pictograms.ts";

/** A whole-number option, clamped. */
const int = (n: number | undefined, d: number, lo: number, hi: number) => clamp(Math.round(n ?? d), lo, hi);
/** The picked one of `n`, or -1. */
const pick = (o: GlyphOptions, n: number) => (typeof o.mark === "number" && n > 0 ? clamp(Math.round(o.mark), 0, n - 1) : -1);
/** A body whose top slopes down toward the front (a reading machine's face). */
function wedge(x: number, y: number, z: number, w: number, d: number, hb: number, hf: number) {
  const x1 = x + w, y1 = y + d, A: V3 = [x, y, z + hb], B: V3 = [x1, y, z + hb], F: V3 = [x1, y1, z + hf], D: V3 = [x, y1, z + hf];
  return poly([[x, y1, z], [x1, y1, z], F, D], "pl") + poly([[x1, y1, z], [x1, y, z], B, F], "pr") + poly([A, B, F, D], "pt") +
    poly([[x, y1, z + hf - 0.5], [x1, y1, z + hf - 0.5], F, D], "bevel") + poly([[x1, y1, z + hf - 0.5], [x1, y, z + hb - 0.5], B, F], "bevel-r") +
    line([D, F, B], "crease") + line([F, [x1, y1, z]], "crease") + `<polygon class="edge" points="${pts([A, B, [x1, y, z], [x1, y1, z], [x, y1, z], D])}"/>`;
}

const pack: Pack = {
  // A receipt printer: the strip comes out of its front slot, falls over the lip and lies out along the floor, one
  // printed entry after another; it only grows. `mark` clips a rider across the strip after an entry, 0 the oldest
  // (the committed, read or flushed position).
  logfile(o) {
    const n = int(o.items, 5, 0, 8), E = 2.6, m = n ? pick(o, n) : -1, h = 13, y1 = -8.6, xa = -8, xb = 0, zs = h - 3.4, R = 2.4;
    const p = box(-12, -18, 0, 18, 18 + y1, h, { top: "pm", left: "pr", right: "pd" });
    const path: [number, number][] = [[y1, zs]];
    const arc = (yc: number, zc: number, r: number, a0: number, a1: number) => { for (let i = 1; i <= 6; i++) { const a = a0 + ((a1 - a0) * i) / 6; path.push([yc + r * Math.cos(a), zc + r * Math.sin(a)]); } };
    arc(y1 + 0.6, zs - R, R, Math.PI / 2, 0);
    arc(y1 + R + 2, 1.6, 1.4, Math.PI, Math.PI * 1.5);
    const tip = y1 + R + 2.6 + n * E;
    path.push([tip, 0.2]);
    // the strip in runs of one tone: top where it faces up, left where it falls
    let strip = "", run: number[] = [], cls = "";
    const flush = () => { if (run.length > 1) strip += poly([...run.map((i): V3 => [xa, ...path[i]]), ...run.reverse().map((i): V3 => [xb, ...path[i]])], cls); };
    for (let i = 0; i < path.length - 1; i++) {
      const dy = path[i + 1][0] - path[i][0], dz = path[i + 1][1] - path[i][1], c = Math.abs(dy) > Math.abs(dz) ? "pt" : "pl";
      if (c !== cls) { flush(); run = [i]; cls = c; }
      run.push(i + 1);
    }
    flush();
    const side = (x: number) => line(path.map(([y, z]): V3 => [x, y, z]), "edge-open");
    strip += side(xa) + side(xb) + line([[xa, tip, 0.2], [xb, tip, 0.2]], "edge-open") +
      plane([xa, tip, 0.2], [1, 0, 0], [0, -1, 0], each(n, (k) => rule(1.3, k * E + 0.8, 6.7) + rule(1.3, k * E + 1.7, 3.6 + (k % 3) * 1.1)));
    let clip = "";
    // the clip: a thin bar across the strip on the marked entry's tail and its lit block beside the strip's near edge.
    // Anything standing on the strip hides about twice its height of strip behind it, so the bar stays low and the
    // block stands off the strip: every newer entry (toward the printer) stays in sight.
    if (m >= 0) {
      const yc = tip - (m + 1) * E + 0.8, bar = box(xa - 0.5, yc - 0.4, 0.2, xb - xa + 0.5, 0.8, 0.5, { bevel: 0 });
      const t = box(xb, yc - 1, 0, 2.4, 2, 1.7, { bevel: 0.3 });
      clip = bar.svg + t.svg + face(t, "L", lamp(1.2, 0.8, 0.6));
    }
    return halo(22) + p.svg + face(p, "T", `<path class="rule" d="M0 4H18" ${NS}/>` + each(4, (i) => slot(10.6 + i * 1.8, 1.1, 1, 2))) + face(p, "R", plate(1.8, 5.6, 5.8, 3.4)) +
      face(p, "L", recess(xa + 11.4, zs - 0.4, xb - xa + 1.2, 1.4, 0.6) + led(13.6, h - 2.6, 2.6) + recess(13.6, 2.6, 3, 2.4, 0.7)) + strip + clip;
  },

  // A broker: a frame of rails, one per partition, records threaded on each in order, a dark board closing its back.
  // `mark` pulls a rail's end out through the frame, with the light on it; rails count from the top, like the
  // frontier's rows, so mark 0 is the top rail.
  broker(o) {
    const c = int(o.count, 3, 1, 6), n = int(o.items, 3, 0, 6), m = pick(o, c), H = 25, gap = (H - 4) / c, rh = clamp(gap - 1.6, 2.6, 4.4);
    const z = (i: number) => 3 + gap * (i + 0.5), post = (x: number) => box(x, -4, 3, 2.6, 8, H);
    const base = box(-16, -6.5, 0, 32, 13, 3), right = post(13.4);
    const back = box(-13.4, -4, 3, 26.8, 0.6, 22.6, { top: "pd", left: "pd", right: "pd", bevel: 0 });
    // records close up when there are many, so bare rail (room to append) always shows before the right post
    const pitch = Math.min(3.7, 19 / Math.max(n, 1)), rw = pitch - 0.6, x0 = -12.7;
    const rail = (x: number, x1: number, zc: number) => box(x, -0.6, zc - 0.6, x1 - x, 1.2, 1.2, { bevel: 0 }).svg;
    // each record's right face would paint over the rail just past it, so the rail is drawn again after each record,
    // from its right face to the next record (or the post): the records read as threaded on it, not set in front of it
    const rails = each(c, (i) => rail(-13.4, 13.4, z(i)) +
      each(n, (k) => box(x0 + k * pitch, -2.6, z(i) - rh / 2, rw, 5.2, rh, { bevel: 0.4 }).svg + rail(x0 + k * pitch + rw, k < n - 1 ? x0 + (k + 1) * pitch : 13.4, z(i))));
    let knob = "";
    if (m >= 0) { const k = box(16, -1.8, z(c - 1 - m) - 1.8, 3.6, 3.6, 3.6, { bevel: 0.4 }); knob = k.svg + face(k, "L", lamp(1.8, 1.8, 1.2)); }
    return halo(25) + base.svg + face(base, "L", screw(1.4, 1.5) + led(24, 1.5, 3) + screw(30.6, 1.5)) + post(-16).svg + back.svg + rails +
      box(-13.4, -1.4, 0.6 + H, 26.8, 2.8, 2.4).svg + right.svg + face(right, "R", each(c, (i) => screw(4, z(i) - 3))) + knob;
  },

  // A consumer group: a bench of small reading machines, one per member, each a sloped screen over a card slot.
  // `mark` lifts one member on a tall riser slid forward over the bench's front edge, with the light on its front.
  consumer(o) {
    const c = int(o.count, 3, 1, 4), m = pick(o, c), P = 8.3, w = 7.2, x0 = -(c * P - P + w) / 2, d = 8, hb = 9, hf = 3.6, L = Math.hypot(d, hb - hf);
    const legs = [[-16.4, -6.2], [15, -6.2], [-16.4, 4.8], [15, 4.8]].map(([x, y]) => box(x, y, 0, 1.4, 1.4, 6, { bevel: 0 }).svg).join("");
    const top = box(-17, -7, 6, 34, 14, 2.2);
    // members stand apart along x, so drawing them left to right stays right when the picked one comes forward
    return halo(25) + legs + top.svg + face(top, "L", led(27.6, 1.1, 2.8)) + each(c, (i) => {
      const picked = i === m, x = x0 + i * P, y = picked ? -0.9 : -4.3, up = picked ? 5 : 0, zz = 8.2 + up;
      return (picked ? box(x - 0.5, y - 0.5, 8.2, w + 1, d + 1, up, { bevel: 0.4 }).svg : "") + wedge(x, y, zz, w, d, hb, hf) +
        plane([x, y + d, zz + hf], [1, 0, 0], [0, -d / L, (hb - hf) / L], recess(0.9, 0.9, w - 1.8, L - 2.2, 0.8) + rule(1.9, 3, w - 1.9) + rule(1.9, 4.8, w - 3)) +
        plane([x, y + d, zz], [1, 0, 0], [0, 0, 1], slot(1, 1.3, w - (picked ? 4.6 : 3.8), 0.9) + (picked ? lamp(w - 1.5, 1.8, 1.1) : ""));
    });
  },

  // A URL frontier: a sorting rack of pigeonholes, a row per host, letters waiting in each row's holes in order.
  // `mark` is the row that's due: its first letter is pulled up out of its hole, leaning on the lip, with a lit seal.
  frontier(o) {
    // the cabinet stands straight on the floor (a separate foot only showed as a heavy double rule under it), its
    // plinth the plain strip below the holes
    const c = int(o.count, 3, 2, 4), n = int(o.items, 2, 0, 4), m = pick(o, c), W = 28, H = 29.2, mx = 2.2, g = 1.1, bot = 5.6;
    const cab = box(-14, -6, 0, W, 12, H);
    const cw = (W - 2 * mx - 3 * g) / 4, rh = (H - 1.8 - bot - (c - 1) * g) / c, eh = Math.min(rh - 2.4, 4.2), ew = cw - 1.4;
    const rowV = (r: number) => bot + (c - 1 - r) * (rh + g);
    const letter = (u: number, v: number) => `<rect class="card" x="${r2(u)}" y="${r2(v)}" width="${r2(ew)}" height="${r2(eh)}" rx=".3"/>` + etch([[u, v + eh], [u + ew / 2, v + eh * 0.45], [u + ew, v + eh]]);
    const holes = each(c, (r) => each(4, (k) => { const u = mx + k * (cw + g); return recess(u, rowV(r), cw, rh, 1.3) + (k < n && !(r === m && k === 0) ? letter(u + 0.7, rowV(r) + 0.4) : ""); }));
    let lean = "";
    if (m >= 0 && n) {
      // pulled up until only its foot is still in the hole, leaning a little forward on the hole's top lip, so it stands
      // proud of the face above the row (on the top row, over the cabinet's top edge); the light is the seal on its flap.
      // A steeper lean shortens it in iso to a sliver, so the lean stays small.
      const x = -14 + mx + 0.7, y = 5.9, zb = rowV(m) + rh - 0.4, s = Math.sin(0.25), k = Math.cos(0.25), Le = eh + 1;
      const q: V3[] = [[x, y, zb], [x + ew, y, zb], [x + ew, y + Le * s, zb + Le * k], [x, y + Le * s, zb + Le * k]];
      lean = poly(q, "card-lit") + plane(q[0], [1, 0, 0], [0, s, k], etch([[0, Le], [ew / 2, Le * 0.45], [ew, Le]]) + lamp(ew / 2, Le * 0.45, 1));
    }
    // with no letters to pull, the light marks the due row at its end, round the corner on the cabinet's side
    return halo(22) + cab.svg + face(cab, "L", holes + led(W - 5.6, 2.8, 2.8)) +
      face(cab, "R", plate(3.2, H - 6.6, 7.2, 3.6) + (m >= 0 && !n ? lamp(1.5, rowV(m) + rh / 2, 1) : "")) + lean;
  },

  // A hard drive with its lid off: the platter lying in its round well, a clamp with its screw on the spindle, and the
  // read arm swung out over a track from its pivot beside the dark voice-coil magnet.
  disk() {
    const h = 4.4, b = box(-16, -11, 0, 32, 22, h, { top: "pl", left: "pm" }), px = -4.8, R = 9.4, top = (x: number, y: number, z: number, inner: string) => plane([x, y, z], [1, 0, 0], [0, 1, 0], inner);
    const well = top(px, 0, h, `<circle class="recess" r="${R + 0.9}"/><path class="wall" d="M${-R - 0.9} 0A${R + 0.9} ${R + 0.9} 0 0 1 ${R + 0.9} 0A${R + 0.9} ${R} 0 0 0 ${-R - 0.9} 0Z"/><circle class="rim" r="${R + 0.9}" ${NS}/>`);
    const screws = face(b, "T", screw(1, 1) + screw(31, 1) + screw(1, 21) + screw(31, 21) + screw(23.4, 21));
    const sides = face(b, "L", led(25, 2.2, 3)) + face(b, "R", recess(2.6, 1.2, 8.4, 2, 0.6) + recess(12.6, 1.2, 4.4, 2, 0.6));
    // the platter lies flat on the well's floor, sunk below the plate so only the well's back wall shows; one track ring
    const z0 = h - 0.6, platter = floorEllipse(px, 0, z0, R, "pt") + top(px, 0, z0, `<circle class="rim" r="6" ${NS}/>`) + floorEllipse(px, 0, z0, R, "edge");
    const clamp_ = cylinder(3.1, 1.3, { x: px, z: z0, crease: false }).svg + top(px, 0, h + 0.7, screw(0, 0));
    // the arm: from a short square tail behind its pivot (the pivot covers it) out to the head, which sits on the track
    // ring (6 from the spindle)
    const za = h + 0.7, [P, Q] = [[10, 2.6], [-0.6, 4.4]], dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy);
    const at = (t: number, s: number): V3 => [P[0] + dx * t - (dy / len) * s, P[1] + dy * t + (dx / len) * s, za];
    const arm: V3[] = [at(-0.15, -2.4), at(0, -2.4), at(1, -0.5), at(1, 0.5), at(0, 2.4), at(-0.15, 2.4)];
    const [hx, hy] = at(1, 0);
    const magnet = box(10.6, -7.6, h - 0.6, 4.6, 7.6, 2.4, { top: "pr", left: "pd", right: "pd", bevel: 0.3 });
    return halo(24) + b.svg + screws + sides + well + platter + clamp_ + box(hx - 1, hy - 0.8, za - 0.9, 1.6, 1.6, 0.9, { bevel: 0 }).svg +
      poly(arm, "pm") + `<polygon class="edge" points="${pts(arm)}"/>` + magnet.svg + cylinder(2.1, 2.2, { x: P[0], y: P[1], z: h - 0.6 }).svg + top(P[0], P[1], h + 1.6, screw(0, 0));
  },
};

export default pack;

/** Options worth seeing on the comparison sheet, per role (the first is how scenes usually show it). */
export const samples: Partial<Record<StageRole, GlyphOptions[]>> = {
  logfile: [{ items: 5 }, { items: 0 }, { items: 8 }, { items: 6, mark: 3 }],
  broker: [{ count: 3, items: 3 }, { count: 1, items: 0 }, { count: 6, items: 6 }, { count: 3, items: 4, mark: 0 }],
  consumer: [{ count: 3 }, { count: 1 }, { count: 4, mark: 2 }, { count: 4, mark: 0 }],
  frontier: [{ count: 3, items: 2 }, { count: 2, items: 0 }, { count: 4, items: 4 }, { count: 3, items: 3, mark: 0 }],
};
