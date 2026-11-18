// The "time" pack: drawn to the rules in .claude/skills/pictogram-polish. Roles and their options are listed in roles.ts.
// Clocks, timeouts and leases: an alarm clock, an hourglass, a parking meter and a punch clock over a rack of cards.
import { C, NS, R2, ball, box, clamp, cylinder, each, etch, etchDot, face, halo, iso, lamp, led, line, plane, poly, pts, r2, recess, rule, screw, slot, type V3 } from "../draw.ts";
import type { GlyphOptions, StageRole } from "../roles.ts";
import type { Pack } from "../pictograms.ts";

const TURN = Math.PI * 2;
let clips = 0;
const xy = (p: number[]) => p.map(r2).join(",");

/**
 * A clock dial in flat coordinates (v up), centred on (cx, cy): a white face sunk under its bezel, twelve indices,
 * an hour and a minute hand (`t` is the minute hand's turn, `tail` how far each runs back past the centre), and the
 * hub, which is the status light: never smaller than 1.3, so the light still shows on a small dial at a phone's size.
 */
function dial(cx: number, cy: number, r: number, t: number, tail = 0.16) {
  const at = (a: number, k: number) => [cx + Math.sin(a * TURN) * r * k, cy + Math.cos(a * TURN) * r * k];
  const hand = (a: number, k: number, w: number) => {
    const s = Math.sin(a * TURN) * w, c = Math.cos(a * TURN) * w;
    return `<polygon class="ink" points="${[at(a, k), [cx + c, cy - s], at(a + 0.5, tail), [cx - c, cy + s]].map(xy).join(" ")}"/>`;
  };
  return `<circle class="pt" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}"/>` +
    `<path class="wall" d="M${r2(cx - r)} ${r2(cy)}A${r2(r)} ${r2(r)} 0 0 0 ${r2(cx + r)} ${r2(cy)}A${r2(r)} ${r2(r * 0.84)} 0 0 1 ${r2(cx - r)} ${r2(cy)}Z"/>` +
    `<circle class="rim" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" ${NS}/>` +
    each(12, (i) => { const [x, y] = at(i / 12, 0.8); return i % 3 ? etchDot(x, y, r2(r * 0.05)) : `<path class="rule" d="M${xy(at(i / 12, 0.68))}L${xy(at(i / 12, 0.88))}" ${NS}/>`; }) +
    hand((10 + t) / 12, 0.5, r * 0.09) + hand(t, 0.8, r * 0.065) + lamp(cx, cy, r2(Math.max(1.3, r * 0.12)));
}

const pack: Pack = {
  // An alarm clock: a round case on two ball feet facing the viewer, a white dial under its bezel, twin bells on top.
  // `level` sets the minute hand (0-1 of a turn); the hour hand follows on from ten o'clock.
  clock(o) {
    const t = clamp(o.level ?? 1 / 6, 0, 1), R = 12.5, f = 2.1, zc = R + 3;
    const rx = R * R2 * C, yF = iso(f, f, zc)[1], yB = iso(-f, -f, zc)[1], yC = -zc;
    // a point on the case's rim, `a` turns clockwise from twelve, k times the radius out
    const rim = (a: number, k: number, y = yC) => [Math.sin(a * TURN) * rx * k, y - Math.cos(a * TURN) * R * k];
    // each leg splays out to a ball foot resting on the floor, and a knob tops each bell: both solid ink like the
    // legs, since a shaded ball this small reads as a hollow ring (a wheel, a loop) at the stage's sizes
    const knob = (x: number, y: number, r: number) => `<circle class="ink" cx="${r2(x)}" cy="${r2(y)}" r="${r}"/>`;
    // the feet splay out past the case's round bottom, so a length of each leg shows between case and foot
    const leg = (s: number) => {
      const [x0, y0] = rim(0.5 - s * 0.11, 0.8), [x1, y1] = [x0 * 1.5, -1.6];
      return `<path class="pole" d="M${r2(x0)} ${r2(y0)}L${r2(x1)} ${r2(y1)}"/>` + knob(x1, y1, 1.7);
    };
    const bell = (s: number) => { const [x, y] = rim(s * 0.115, 1.02, yB); return ball(x, y, 4.6) + knob(x * 0.9, y - 4.7, 1.4); };
    const band = `M${r2(-rx)} ${r2(yF)}V${r2(yB)}A${r2(rx)} ${R} 0 0 1 ${r2(rx)} ${r2(yB)}V${r2(yF)}`;
    const shell = `<path d="${band}Z" fill="url(#sk-round)"/><path class="edge" d="${band}"/>`;
    const front = `<ellipse class="pm" cx="0" cy="${r2(yF)}" rx="${r2(rx)}" ry="${R}"/>` +
      plane([f, f, zc], [1 / R2, -1 / R2, 0], [0, 0, 1], dial(0, 0, R - 1.9, t)) +
      `<ellipse class="edge" cx="0" cy="${r2(yF)}" rx="${r2(rx)}" ry="${R}"/>`;
    return halo(15, 6, 1) + leg(-1) + leg(1) + bell(-1) + bell(1) + shell + front;
  },

  // An hourglass: two round bulbs joined at a narrow neck, between turned plates on two posts. `level` is the time left,
  // the sand still in the top bulb (1 just turned, 0 run out), like the lease and the bucket: as it falls the top bulb
  // empties down to the neck, the mound below grows, and a stream joins them while it runs.
  timer(o) {
    // the bottom plate is thick enough to lift the neck well clear of the base's back corner (art y -17.5), which shows
    // through the open frame: on the corner's line, the neck would look braced to both posts. `lv` is the sand that has run.
    const lv = 1 - clamp(o.level ?? 0.65, 0, 1), z0 = 5.6, z1 = 34.2, zm = 19.9, hb = 14.3, id = `sk-clip-hourglass-${++clips}`;
    // each bulb swells from the neck to round shoulders under its plate, its widest point well inside the posts so a
    // strip of the base shows between glass and frame
    const rad = (z: number) => 0.7 + 4.5 * Math.sin(Math.min(1, Math.abs(z - zm) / hb) * 0.62 * Math.PI) ** 0.9;
    const X = (z: number) => rad(z) * C * R2;
    const side = (k: number) => each(29, (i) => { const z = k > 0 ? z1 - i * (z1 - z0) / 28 : z0 + i * (z1 - z0) / 28; return `L${r2(k * X(z))} ${r2(-z)}`; });
    const glass = `M${r2(X(z1))} ${-z1}` + side(1) + `A${r2(X(z0))} ${r2(X(z0) * 0.577)} 0 0 1 ${r2(-X(z0))} ${-z0}` + side(-1) + "Z";
    // the sand: what's left above the neck under a level surface, what has run in a mound, the stream between
    const zT = zm + 0.8 * hb * (1 - lv) ** 0.6, zP = z0 + 2 + (0.62 * hb - 2) * lv ** 0.7, wT = X(zT), wP = X(zP) + 1;
    const fill = (d: string) => `<path class="pd" d="${d}"/>` + (o.levelHot ? `<path class="liquid is-hot" d="${d}"/>` : "");
    const mound = `M${r2(-wP)} ${r2(-zP)}Q0 ${r2(-zP - 5)} ${r2(wP)} ${r2(-zP)}`;
    const sand = (lv < 1 ? fill(`M${r2(-wT)} ${r2(-zT)}A${r2(wT)} ${r2(wT * 0.577)} 0 0 1 ${r2(wT)} ${r2(-zT)}V${-zm}H${r2(-wT)}Z`) +
      `<ellipse class="surface" cx="0" cy="${r2(-zT)}" rx="${r2(wT)}" ry="${r2(wT * 0.577)}" ${NS}/>` : "") +
      // the mound runs down past the bulb's round floor and the clip trims it, so no glass shows under the sand
      (lv > 0 ? fill(`${mound}V${r2(-z0 + X(z0) * 0.577 + 0.6)}H${r2(-wP)}Z`) + `<path class="surface" d="${mound}" ${NS}/>` : "") +
      (lv > 0 && lv < 1 ? fill(`M-.4 ${-zm}H.4V${r2(-zP - 2.4)}H-.4Z`) : "");
    const bulbs = `<path class="pt" d="${glass}"/><clipPath id="${id}"><path d="${glass}"/></clipPath><g clip-path="url(#${id})">${sand}</g>` +
      `<path class="edge" d="${glass}"/>`;
    const post = (k: number) => cylinder(1.1, z1 - z0, { x: k * 5.5, y: -k * 5.5, z: z0, crease: false }).svg;
    // the thick bottom plate is turned with a raised ring under its lip, the light on the face below the ring
    const base = cylinder(9, z0, { bands: [z0 - 2] }), top = cylinder(9, 2.4, { z: z1 });
    return halo(15) + base.svg + `<path class="led" d="M-2.4 ${r2(base.sb + base.ryb - (z0 - 2) / 2)}h4.8" ${NS}/>` + bulbs + post(-1) + post(1) + top.svg;
  },

  // A parking meter: a tall arch-topped head on a post, a round window with the dial showing time left, a readout
  // (where the fencing token shows) holding the light, a coin slot, a crank on its side. `level` is the time left: the
  // needle and the shaded wedge fall toward empty; at nothing the expired flag stands up in the window.
  lease(o) {
    // the head is as big as the core parts' bodies, so its window (the only place `level` shows) reads at a phone's size
    const lv = clamp(o.level ?? 0.6, 0, 1), w = 17, d = 11.4, h = 12.4, zb = 15.6, r = w / 2, x = -r, y = -d / 2, x1 = r, y1 = d / 2, z1 = zb + h;
    const arc = (yy: number, a0: number, a1: number, k = r): V3[] => Array.from({ length: 10 }, (_, i) => {
      const a = ((a0 + ((a1 - a0) * i) / 9) * Math.PI) / 180;
      return [Math.cos(a) * k, yy, z1 + Math.sin(a) * k];
    });
    const foot = cylinder(4.4, 1.4, { crease: false }), post = cylinder(1.9, zb - 1.4, { z: 1.4, bands: [zb - 5] });
    const head = poly([[x1, y1, zb], ...arc(y1, 0, 180), [x, y1, zb]], "pl") + poly([[x1, y, zb], [x1, y1, zb], [x1, y1, z1], [x1, y, z1]], "pr") +
      `<polygon points="${pts([...arc(y1, 0, 135), ...arc(y, 135, 0)])}" fill="url(#sk-round)"/>` +
      poly([...arc(y1, 0, 180), ...arc(y1, 180, 0, r - 0.7)], "bevel") + poly([[x1, y1, z1 - 0.7], [x1, y, z1 - 0.7], [x1, y, z1], [x1, y1, z1]], "bevel-r") +
      line(arc(y1, 0, 135), "crease") + line([[x1, y1, z1], [x1, y1, zb]], "crease") +
      `<polygon class="edge" points="${pts([[x, y1, zb], [x1, y1, zb], [x1, y, zb], [x1, y, z1], ...arc(y, 0, 135), ...arc(y1, 135, 180)])}"/>`;
    // the window, round under the arch: a white dial, the time-left wedge from empty up to the needle, the flag at zero.
    // The needle sweeps from 0.9π (empty) to 0.1π (full), so it never lies on the etched baseline at either end.
    const cx = r, cy = h, rr = 6.8, k = rr * 0.86, empty = Math.PI * 0.9, a = Math.PI * (0.9 - 0.8 * lv);
    const at = (ang: number, len: number) => [cx + Math.cos(ang) * len, cy + Math.sin(ang) * len];
    const [nx, ny] = at(a, k), [ex, ey] = at(empty, k), sx = -Math.sin(a) * 0.55, sy = Math.cos(a) * 0.55;
    // the needle tapers from the hub to its tip like the clock's hands, with a short tail behind the hub
    const needle = `<polygon class="ink" points="${[[nx, ny], [cx + sx, cy + sy], at(a + Math.PI, 1.8), [cx - sx, cy - sy]].map(xy).join(" ")}"/>`;
    // the time-left wedge, from empty up to the needle, in the deep tone so it reads in both themes (orange over it when hot)
    const wedge = `M${cx} ${cy}L${r2(ex)} ${r2(ey)}A${r2(k)} ${r2(k)} 0 0 0 ${r2(nx)} ${r2(ny)}Z`;
    // the expired flag, hinged on the window's lower rim, stands up into the half the needle has left: a thin stem
    // with the flag flying from its top, clear of the hub and of the window's rim
    const fx = cx + rr * 0.33, fb = cy - Math.sqrt(rr * rr - (rr * 0.33) ** 2), fk = rr / 5.7;
    const flag = `<rect class="ink" x="${r2(fx - 0.4)}" y="${r2(fb)}" width=".8" height="${r2(cy + 3.4 * fk - fb)}"/>` +
      `<rect class="flag" x="${r2(fx - 0.4)}" y="${r2(cy + fk)}" width="${r2(2.6 * fk)}" height="${r2(2.4 * fk)}" rx=".3"/>`;
    const window = `<circle class="pt" cx="${cx}" cy="${cy}" r="${rr}"/>` +
      `<path class="wall" d="M${cx - rr} ${cy}A${rr} ${rr} 0 0 0 ${cx + rr} ${cy}A${rr} ${rr * 0.82} 0 0 1 ${cx - rr} ${cy}Z"/>` +
      (lv > 0 ? `<path class="pd" d="${wedge}"/>` + (o.levelHot ? `<path class="liquid is-hot" d="${wedge}"/>` : "") : "") +
      etch([[cx - rr, cy], [cx + rr, cy]]) + each(5, (i) => { const [x, y] = at(Math.PI * (0.1 + 0.2 * i), rr * 0.68); return etchDot(x, y, 0.34); }) +
      (lv < 0.01 ? flag : "") + needle + `<circle class="pd" cx="${cx}" cy="${cy}" r="1.2"/>` + screw(cx, cy) +
      `<circle class="rim" cx="${cx}" cy="${cy}" r="${rr}" ${NS}/>`;
    const front = plane([x, y1, zb], [1, 0, 0], [0, 0, 1], window + recess(1.8, 1.8, 8.8, 3, 0.7) + led(2.9, 3.05, 4) + slot(12.8, 1.6, 1.5, 3.4));
    // the crank: a lever from a boss on the side, down and forward along the face to a solid knob (a shaded ball this
    // small reads as a hollow eyelet, like the clock's knobs)
    const [kx, ky] = iso(x1, 1, zb + 5.5), [hx, hy] = iso(x1, -1.6, zb + 3.2);
    const crank = `<circle class="pd" cx="${r2(kx)}" cy="${r2(ky)}" r="1.7"/>` + `<path class="pole" d="M${r2(kx)} ${r2(ky)}L${r2(hx)} ${r2(hy)}"/>` +
      `<circle class="ink" cx="${r2(hx)}" cy="${r2(hy)}" r="1.1"/>`;
    return halo(12) + foot.svg + post.svg + head + front + crank;
  },

  // A punch clock: a big dial on its face and a rack of card slots along its top, each card a job waiting for its
  // time. `items` is how many cards stand in the slots.
  scheduler(o) {
    const n = clamp(o.items ?? 3, 0, 4);
    const b = box(-10, -5, 0, 20, 10, 18), rack = box(-9.6, -4.4, 18, 19.2, 5.4, 2, { bevel: 0.4 });
    // the dial's hands keep short tails so its hub, the light, stands clear of them; a screw at each corner of the face
    const front = face(b, "L", dial(10, 9.6, 7, 1 / 6, 0.1) + screw(1.4, 1.4) + screw(18.6, 1.4) + screw(1.4, 16.4) + screw(18.6, 16.4));
    const slots = face(rack, "T", each(4, (i) => `<rect class="recess" x="${r2(0.8 + i * 4.6)}" y="2.1" width="4.2" height="1.3" rx=".4"/>`));
    // the cards stand in the rack, tops staggered, each with a name and a time ruled on it
    const cards = each(n, (i) => {
      const x = -8.6 + i * 4.6, t = 7 - (i % 2) * 1.5;
      return poly([[x, -1.65, 20], [x + 4, -1.65, 20], [x + 4, -1.65, 20 + t], [x, -1.65, 20 + t]], "card") +
        plane([x, -1.65, 20], [1, 0, 0], [0, 0, 1], rule(0.8, t - 1.6, 3.2) + rule(0.8, t - 3, 2.4));
    });
    // the side's screws sit at its far corners, away from the front's, so no corner carries two
    // and a column of closed vents down its middle, like the core boxes' sides
    const side = face(b, "R", each(3, (i) => slot(2 + i * 2.2, 5, 1.2, 8)) + screw(8.6, 1.4) + screw(8.6, 16.4));
    return halo(19) + b.svg + front + side + rack.svg + slots + cards;
  },
};

export default pack;

/** Options worth seeing on the comparison sheet, per role (the first is how scenes usually show it). */
export const samples: Partial<Record<StageRole, GlyphOptions[]>> = {
  clock: [{ level: 0 }, { level: 0.3 }, { level: 0.75 }],
  timer: [{ level: 1 }, { level: 0.7 }, { level: 0.1 }, { level: 0 }, { level: 0.1, levelHot: true }],
  lease: [{ level: 0 }, { level: 0.3 }, { level: 0.9 }, { level: 1 }, { level: 0.3, levelHot: true }],
  scheduler: [{ items: 0 }, { items: 1 }, { items: 4 }],
};
