// The "devices" pack: what stands at the edges of a system, ours and other people's. Drawn to the rules in
// .claude/skills/pictogram-polish; roles and their options are listed in roles.ts.
import { NS, ball, box, clamp, cylinder, each, etch, etchDot, face, halo, iso, lamp, led, line, plane, pocket, poly, pts, r2, recess, rule, screw, slot, type V3 } from "../draw.ts";
import type { GlyphOptions, StageRole } from "../roles.ts";
import type { Pack } from "../pictograms.ts";

/** A slab standing on its foot and leaning back (a phone in a dock): x0..x0+w across, H tall, th thick, its top `lean` back. */
function slab(x0: number, w: number, y: number, z: number, H: number, th: number, lean: number) {
  const P = (u: number, t: number, b = 0): V3 => [x0 + u, y - lean * t - b, z + H * t], L = Math.hypot(H, lean), bt = 1 - 0.6 / L;
  return {
    L,
    svg: poly([P(0, 0), P(w, 0), P(w, 1), P(0, 1)], "pl") + poly([P(w, 0), P(w, 0, th), P(w, 1, th), P(w, 1)], "pr") +
      poly([P(0, 1), P(w, 1), P(w, 1, th), P(0, 1, th)], "pt") + poly([P(0, bt), P(w, bt), P(w, 1), P(0, 1)], "bevel") +
      line([P(0, 1), P(w, 1), P(w, 0)], "crease") + `<polygon class="edge" points="${pts([P(0, 1, th), P(w, 1, th), P(w, 0, th), P(w, 0), P(0, 0), P(0, 1)])}"/>`,
    front: (inner: string) => plane(P(0, 0), [1, 0, 0], [0, -lean / L, H / L], inner),
  };
}

const pack: Pack = {
  // A smartphone leaning in a dock: a recessed screen, notification cards stacked on it, a progress bar, the dock's light.
  phone(o) {
    const n = clamp(o.items ?? 0, 0, 3), lv = o.level === undefined ? -1 : clamp(o.level, 0, 1);
    const one = (cx: number) => {
      const dock = box(cx - 8, -5.4, 0, 16, 10.8, 3.6, { bevel: 0.5 }), p = slab(cx - 6.8, 13.6, 0.6, 3.6, 27, 1.7, 2.8), L = p.L;
      // the cards are printed on the screen, not solid: a light plate with a fine rule outline, spaced so the count reads
      const cards = each(n, (i) => {
        const v = L - 6.6 - i * 4.6;
        return `<rect class="plate" x="2" y="${r2(v)}" width="9.6" height="3" rx=".7"/>` + etchDot(3.5, v + 1.5, 0.75) + rule(5.1, v + 1.5, 10.2);
      });
      // the bar's track is a light plate in both themes, so how full it is reads against the dark screen
      const bar = lv < 0 ? "" : `<rect class="plate" x="2" y="4" width="9.6" height="1.8" rx=".9"/>` + (lv > 0.02 ? `<rect class="ink" x="2" y="4" width="${r2(9.6 * lv)}" height="1.8" rx=".9"/>` : "");
      return dock.svg + face(dock, "T", pocket(0.7, 3.9, 14.6, 2.5, 0.6)) + face(dock, "L", led(6.8, 1.7, 2.4)) +
        p.svg + p.front(recess(0.95, 2.4, 11.7, L - 5, 1) + slot(5.3, L - 1.55, 3, 0.7) + cards + bar + rule(5.4, 2.9, 8.2));
    };
    // `many`: two docks side by side, drawn smaller so the back phone stays under the role's top
    return halo(o.many ? 24 : 17, o.many ? 10 : 8.5, 2) + (o.many ? `<g transform="scale(.88)">${one(-8.8) + one(8.8)}</g>` : one(0));
  },

  // A weatherproof sensor pod on a short post: a vent grille, a round sensor port, an antenna, its light on the front.
  sensor(o) {
    // a pod at (x, y), k its scale: a square foot screwed down, a short post, the pod; face details drawn at full size and scaled
    const pod = (x: number, y: number, k: number) => {
      const g = (inner: string) => `<g transform="scale(${k})">${inner}</g>`;
      const foot = box(x - 3.2 * k, y - 3.2 * k, 0, 6.4 * k, 6.4 * k, 1.2 * k, { bevel: 0.3 * k });
      // the pod stands high enough on its post that the post shows under it as a pole
      const b = box(x - 6 * k, y - 5 * k, 9 * k, 12 * k, 10 * k, 10 * k, { bevel: 0.7 * k });
      // the antenna rises from a gland on the lid, toward its right corner
      const au = 8.6, av = 2.8, [bx, by] = iso(b.x + au * k, b.y + av * k, b.z1), [tx, ty] = iso(b.x + au * k, b.y + av * k, 25 * k);
      // the sensor's window: a lighter collar round a small dark port
      const port = `<circle class="pm" cx="5" cy="5" r="2.6"/><circle class="rim" cx="5" cy="5" r="2.6" ${NS}/>` +
        `<circle class="recess" cx="5" cy="5" r="1.8"/><path class="wall" d="M3.2 5A1.8 1.8 0 0 0 6.8 5A1.8 1.3 0 0 1 3.2 5Z"/><circle class="rim" cx="5" cy="5" r="1.8" ${NS}/>`;
      return foot.svg + face(foot, "T", g(screw(0.9, 0.9) + screw(5.5, 0.9) + screw(0.9, 5.5) + screw(5.5, 5.5))) +
        cylinder(1.1 * k, 7.8 * k, { x, y, z: 1.2 * k, crease: false }).svg + b.svg +
        // the light is a round indicator in the face's upper right corner, clear of the grille's slots
        face(b, "L", g(each(3, (i) => slot(1.8, 1.8 + i * 2.2, 6.4, 1.1)) + lamp(10.1, 8.2, 0.95))) + face(b, "R", g(port)) +
        face(b, "T", g(screw(1.3, 1.3) + screw(10.7, 1.3) + screw(1.3, 8.7) + screw(10.7, 8.7) + screw(au, av))) +
        `<path class="pole" d="M${r2(bx)} ${r2(by)}V${r2(ty)}"/>` + ball(tx, ty, 1.15 * k);
    };
    return o.many ? halo(22, 11, 1) + [[-9, -11], [-8, 9], [11, -3]].map(([x, y]) => pod(x, y, 0.8)).join("") : halo(12, 6, 1) + pod(0, 0, 1.35);
  },

  // A transmitter mast: a lattice tower on an equipment cabinet, panel antennas round its head, a dish, a beacon on top.
  sender() {
    const z0 = 10, z1 = 38, a0 = 5.4, a1 = 2, A = (z: number) => a0 + ((a1 - a0) * (z - z0)) / (z1 - z0);
    const cab = box(-9, -7.5, 0, 18, 15, z0, { bevel: 0.7 });
    const doors = face(cab, "L", etch([[9, 0], [9, z0]]) + slot(7.3, 4, 0.8, 2.6) + slot(9.9, 4, 0.8, 2.6) + each(2, (d) => each(3, (i) => slot(2 + d * 9, 1.2 + i * 1.3, 5, 0.6))));
    const side = face(cab, "R", each(4, (i) => slot(3, 2.2 + i * 1.6, 9, 0.7)) + screw(1.2, z0 - 1.2) + screw(13.8, z0 - 1.2));
    const leg = (sx: number, sy: number) => line([[sx * a0, sy * a0, z0], [sx * a1, sy * a1, z1]], "edge-open");
    const lv = [10, 17, 23, 28.5, 33.5, 38];
    // a face of the lattice between two corners: struts at each level and a zigzag of braces, all ending on the legs
    const lattice = (p: number[], q: number[], cls: string) => lv.map((z, i) => {
      const a = A(z), at = (c: number[], zz: number, aa: number): V3 => [c[0] * aa, c[1] * aa, zz];
      const strut = line([at(p, z, a), at(q, z, a)], cls);
      if (i === lv.length - 1) return strut;
      const z2 = lv[i + 1], b = A(z2), [m, n] = i % 2 ? [p, q] : [q, p];
      return strut + line([at(m, z, a), at(n, z2, b)], cls);
    }).join("");
    // panel antennas stand off each face of the head, with gaps between them
    const panel = (x: number, y: number, w: number, d: number) => box(x, y, 28, w, d, 9, { bevel: 0.3 }).svg, e = A(32) + 1.3;
    const back = panel(-e - 0.8, -1.1, 0.8, 2.2) + panel(-1.1, -e - 0.8, 2.2, 0.8);
    const front = panel(-1.1, e, 2.2, 0.8) + panel(e, -1.1, 0.8, 2.2);
    const dz = 20, dx = A(dz) + 0.5;
    const disc = (x: number, cls: string, extra = "") => plane([x, 0.6, dz], [0, -1, 0], [0, 0, 1], `<circle class="${cls}" r="3.2"/><circle class="edge" r="3.2"/>${extra}`);
    const dish = disc(dx, "pd") + disc(dx + 1.3, "pl", `<circle class="rim" r="2.2" ${NS}/>` + etchDot(0, 0, 0.6));
    const head = box(-a1 - 0.4, -a1 - 0.4, z1, (a1 + 0.4) * 2, (a1 + 0.4) * 2, 1, { bevel: 0.3 });
    const [lx, ly] = iso(0, 0, z1 + 1), [tx, ty] = iso(0, 0, 42.4);
    return halo(18) + cab.svg + doors + side + face(cab, "T", each(4, (i) => `<rect class="pm" x="${r2(9 - a0 - 0.9 + (i % 2) * 2 * a0)}" y="${r2(7.5 - a0 - 0.9 + (i >> 1) * 2 * a0)}" width="1.8" height="1.8"/>`)) +
      // the back panels stand outside the back lattice faces, so they go down first and the struts cross in front of them
      back + lattice([-1, -1], [1, -1], "crease") + lattice([-1, -1], [-1, 1], "crease") + leg(-1, -1) + leg(-1, 1) + leg(1, -1) +
      lattice([-1, 1], [1, 1], "etch") + lattice([1, 1], [1, -1], "etch") + leg(1, 1) + dish + front + head.svg +
      `<path class="pole" d="M${r2(lx)} ${r2(ly)}V${r2(ty)}"/>` + lamp(tx, ty, 1.4);
  },

  // Someone else's system: a small office block taller than it is wide, a ribbon window on each upper floor, shop windows
  // and a door under a canopy (its light) on the ground floor, a unit on the roof.
  external() {
    const W = 20, D = 16, H = 28, b = box(-W / 2, -D / 2, 0, W, D, H, { bevel: 0.8 });
    // one long window per upper floor on each face, and the floor line over the ground floor
    const floors = (w: number) => each(3, (r) => recess(1.6, 9.6 + r * 5.9, w - 3.2, 4, 0.9)) + `<path class="crease" d="M0 8.1H${w}" ${NS}/>`;
    const front = face(b, "L", floors(W) + recess(1.4, 1.4, 5, 3.4, 0.9) + recess(W - 6.4, 1.4, 5, 3.4, 0.9) +
      recess(W / 2 - 2.4, 0, 4.8, 6, 1) + etch([[W / 2, 0], [W / 2, 6]]));
    const side = face(b, "R", floors(D) + recess(1.6, 1.4, D - 3.2, 3.4, 0.9));
    // the roof deck sits a step inside its parapet, the parapet's shadow along the far edges
    const roof = face(b, "T", `<rect class="pm" x="1" y="1" width="${W - 2}" height="${D - 2}"/><path class="wall" d="M1 ${D - 1}V1H${W - 1}V2.1H2.1V${D - 1}Z"/>` +
      `<rect class="rim" x="1" y="1" width="${W - 2}" height="${D - 2}" ${NS}/>`);
    // the canopy over the door is deep enough to carry the light on its front, under the floor line
    const canopy = box(-3.6, D / 2, 6, 7.2, 2.4, 2, { bevel: 0.4 });
    const unit = box(-6, -5, H, 9, 7, 4, { bevel: 0.5 });
    return halo(20) + b.svg + front + side + roof + unit.svg + face(unit, "L", each(3, (i) => slot(1.4, 0.8 + i * 1.1, 6.2, 0.55))) +
      face(unit, "T", `<circle class="recess" cx="4.5" cy="3.5" r="2.4"/><circle class="rim" cx="4.5" cy="3.5" r="2.4" ${NS}/>` + screw(4.5, 3.5)) +
      canopy.svg + face(canopy, "L", led(2.2, 1, 2.8));
  },

  // An inbox as a post box on a post: its door drops open with the letters on it, and its flag goes up when there's mail.
  mailbox(o) {
    const n = clamp(o.items ?? 0, 0, 4), a = 5, z0 = 17, hw = 5.6, y0 = -11, y1 = 6.5, ia = a - 0.9;
    const arc = (y: number, from: number, to: number) => Array.from({ length: Math.abs(to - from) / 15 + 1 }, (_, i): V3 => {
      const t = ((from + Math.sign(to - from) * i * 15) * Math.PI) / 180;
      return [a * Math.cos(t), y, z0 + hw + a * Math.sin(t)];
    });
    // the arched outline of the door (and, `ia` wide, of the mouth) in a plane at its foot
    const arch = (w: number) => `M${-w} 0V${hw}A${w} ${w} 0 0 0 ${w} ${hw}V0`;
    const post = box(-1.6, -3.4, 0, 3.2, 3.2, z0, { bevel: 0 });
    // the rounded roof, shaded across its curve: drawn in the top plane's coordinates, where a point lands at (x - z, y - z)
    const local = (list: V3[]) => list.map(([x, y, z]) => `${r2(x - z)},${r2(y - z)}`).join(" ");
    const roof = plane([0, 0, 0], [1, 0, 0], [0, 1, 0], `<polygon points="${local([...arc(y0, 0, 135), ...arc(y1, 135, 0)])}" fill="url(#sk-round)"/>`);
    const right = poly([[a, y0, z0], [a, y1, z0], [a, y1, z0 + hw], [a, y0, z0 + hw]], "pr");
    const front = plane([0, y1, z0], [1, 0, 0], [0, 0, 1], n
      ? `<path class="recess" d="${arch(ia)}Z"/><path class="wall" d="M${-ia} ${hw}A${ia} ${ia} 0 0 0 ${ia} ${hw}L${ia} ${hw - 1}A${ia} ${ia - 0.6} 0 0 1 ${-ia} ${hw - 1}Z"/><path class="rim" d="${arch(ia)}Z" ${NS}/>`
      : `<path class="etch" d="${arch(ia)}" ${NS}/><circle class="pm" cx="0" cy="${hw + ia - 1.3}" r=".9"/><circle class="edge" cx="0" cy="${hw + ia - 1.3}" r=".9"/>`);
    const sil = [...arc(y1, 135, 180), [-a, y1, z0], [a, y1, z0], [a, y0, z0], ...arc(y0, 0, 135)] as V3[];
    const body = roof + right + line([[a, y0, z0 + hw], [a, y1, z0 + hw]], "crease") + poly([...arc(y1, 0, 180), [-a, y1, z0], [a, y1, z0]], "pl") + front +
      line(arc(y1, 0, 135), "crease") + `<polygon class="edge" points="${pts(sil)}"/>`;
    // with mail the door lies open, hinged at its foot, and the letters lie on it, the top one an envelope
    const flat = (z: number, inner: string) => plane([0, y1, z], [1, 0, 0], [0, 1, 0], inner);
    const door = flat(z0 - 0.55, `<path class="pr" d="${arch(a)}Z"/><path class="edge" d="${arch(a)}Z"/>`) +
      flat(z0, `<path class="pm" d="${arch(a)}Z"/><path class="edge" d="${arch(a)}Z"/><path class="crease" d="${arch(ia)}" ${NS}/>`);
    const letters = each(n, (i) => flat(z0 + 0.2 + i * 0.75, `<g transform="rotate(${[-5, 4, -2, 6][i]} 0 3.6)"><rect class="card" x="-2.9" y="-.6" width="5.8" height="8.4" rx=".4"/>` +
      (i === n - 1 ? `<path class="etch" d="M-2.9 -.6L0 2.4L2.9 -.6" ${NS}/>` : "") + "</g>"));
    // the flag on the right side: an arm on a pivot hub that seats the light, lying along the box, or raised when there's
    // mail; the arm starts at the hub's edge so no ink touches the light. Raised, the arm reaches further, so the flag
    // stands clear above the roof's back end instead of hiding inside the box's outline
    const reach = n ? 3 : 0;
    const flag = plane([a + 0.3, y0 + 4, z0 + 3], [0, 1, 0], [0, 0, 1], `<g transform="rotate(${n ? 90 : 0})"><path class="pole" d="M2.2 0H${8.6 + reach}"/><rect class="flag" x="${5.4 + reach}" y="0" width="3.8" height="2.8"/><rect class="edge" x="${5.4 + reach}" y="0" width="3.8" height="2.8"/></g>` +
      `<circle class="pm" r="2.2"/><circle class="edge" r="2.2"/>` + lamp(0, 0, 0.95));
    // the post's two screws both sit below the box's lower edge, where they show as a pair
    return halo(13, 6.5, 1) + post.svg + face(post, "L", screw(1.6, 2) + screw(1.6, z0 - 6.5)) + body + (n ? door + letters : "") + flag;
  },
};

export default pack;

/** Options worth seeing on the comparison sheet, per role (the first is how scenes usually show it). */
export const samples: Partial<Record<StageRole, GlyphOptions[]>> = {
  phone: [{ items: 1 }, { items: 3 }, { items: 2, level: 0.3 }, { level: 0.9 }, { many: true, items: 1 }],
  sensor: [{ many: true }],
  mailbox: [{ items: 1 }, { items: 4 }],
};
