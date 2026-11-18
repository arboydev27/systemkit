// SystemKit's system pictograms: real objects in the page's neutrals, drawn in code from the kit in draw.ts.
// The core set below loads with every stage; the other parts live in packs (packs/index.ts) that a stage loads only
// when its scene uses them. Roles, their names and heights are listed in roles.ts.
import { NS, ball, box, clamp, cylinder, each, etch, etchDot, face, halo, iso, led, lamp, line, plane, plate, pocket, poly, pts, r2, recess, rule, screw, slot, type V3 } from "./draw.ts";
import { ROLES, ROLE_IDS, type GlyphOptions, type StageRole } from "./roles.ts";

export { iso } from "./draw.ts";
export type Drawing = (o: GlyphOptions) => string;
export type Pack = Partial<Record<StageRole, Drawing>>;

let clipCount = 0;

const CORE: Pack = {
  // A laptop: a lid with a recessed screen, a keyboard of keys in a pocket, a trackpad, a light on its front edge.
  client(o) {
    const one = (dx: number, dy: number) => {
      const base = box(-15, -10, 0, 30, 20, 2.4, { bevel: 0.5 });
      const keys = face(base, "T", pocket(3, 2.4, 24, 9.2, 0.8) +
        each(3, (r) => each(9, (c) => `<rect class="key" x="${r2(3.9 + c * 2.52)}" y="${r2(3.6 + r * 2.6)}" width="1.9" height="1.8" rx=".35"/>`)) +
        pocket(11, 13.4, 8, 4.8, 0.6));
      const front = face(base, "L", led(24.2, 1.2, 2.6));
      // the lid leans back: t runs from its hinge (0) to its top (1), 1.4 thick
      const P = (u: number, t: number, back = 0): V3 => [u, -10 - 3 * t - back, 2.4 + 18.6 * t];
      const lid =
        poly([P(-15, 0), P(15, 0), P(15, 1), P(-15, 1)], "pl") +
        poly([P(15, 0), P(15, 0, 1.4), P(15, 1, 1.4), P(15, 1)], "pr") +
        poly([P(-15, 1), P(15, 1), P(15, 1, 1.4), P(-15, 1, 1.4)], "pt") +
        poly([P(-15, 0.965), P(15, 0.965), P(15, 1), P(-15, 1)], "bevel") +
        plane(P(-15, 0), [1, 0, 0], [0, -3 / 18.84, 18.6 / 18.84],
          recess(1.6, 1.5, 26.8, 15.6, 1.2) + rule(4, 12.6, 15) + rule(4, 10.4, 21) + rule(4, 8.2, 12)) +
        line([P(-15, 1), P(15, 1), P(15, 0)], "crease") +
        `<polygon class="edge" points="${pts([P(-15, 1, 1.4), P(15, 1, 1.4), P(15, 0, 1.4), P(15, 0), P(-15, 0), P(-15, 1)])}"/>`;
      return `<g transform="translate(${r2(dx)} ${r2(dy)})">${base.svg}${keys}${front}${lid}</g>`;
    };
    // `many`: a second machine behind the first and to its right, both smaller so the pair stays on its base. They're
    // placed by world offsets whose footprints don't meet (about 3 apart at the hinge), and staggered across the view
    // so the back one's screen shows beside the front one's lid, not hidden behind it.
    const [bx, by] = iso(5, -12), [fx, fy] = iso(-5, 12);
    return halo(24, 12, 3) + (o.many ? `<g transform="scale(.74)">${one(bx, by)}${one(fx, fy)}</g>` : one(0, 0));
  },

  // A crowd: people as turned bodies with round heads, shaded smoothly.
  crowd() {
    let out = halo(26, 13, 2);
    const people: [number, number][] = [];
    // nine people, spaced so each still reads as a person at a phone's size
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) people.push([-11 + i * 11, -10 + j * 10.5 + (i % 2) * 1.5]);
    people.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y] of people) {
      const [hx, hy] = iso(x, y, 12.6);
      out += cylinder(2.8, 9, { x, y, crease: false }).svg + ball(hx, hy, 2.9);
    }
    return out;
  },

  // DNS as a card index: an open box of address cards with tabs; one card is pulled up, the name that was looked up.
  dns() {
    const back = poly([[-12, -8, 0], [12, -8, 0], [12, -8, 9], [-12, -8, 9]], "pr");
    // the back and left rims go down before the cards, which stand in front of them
    const inside = poly([[-10.8, -6.8, 9], [10.8, -6.8, 9], [10.8, 6.8, 9], [-10.8, 6.8, 9]], "recess") +
      poly([[-10.8, -6.8, 3], [10.8, -6.8, 3], [10.8, -6.8, 9], [-10.8, -6.8, 9]], "pd") +
      line([[-12, 8, 9], [-12, -8, 9], [12, -8, 9]], "edge-open");
    const cards = each(6, (i) => {
      const y = -5.4 + i * 2.1, found = i === 3, lift = found ? 8.5 : 0, tab = -8 + (i % 3) * 6.2, z1 = 13 + lift, cls = found ? "card-lit" : "card";
      return poly([[-10, y, 3 + lift], [10, y, 3 + lift], [10, y, z1], [-10, y, z1]], cls) +
        poly([[tab, y, z1], [tab + 4.6, y, z1], [tab + 4.6, y, z1 + 1.8], [tab, y, z1 + 1.8]], cls) +
        (found ? plane([-10, y, 3 + lift], [1, 0, 0], [0, 0, 1], rule(2.5, 7.6, 13) + rule(2.5, 5.6, 16)) : "");
    });
    // the front wall hides the cards' feet, with a label holder and the light
    const front = poly([[-12, 8, 0], [12, 8, 0], [12, 8, 9], [-12, 8, 9]], "pl") + poly([[-12, 8, 8.2], [12, 8, 8.2], [12, 8, 9], [-12, 8, 9]], "bevel") +
      plane([-12, 8, 0], [1, 0, 0], [0, 0, 1], plate(8, 3, 8, 3.4) + led(2.2, 1.6));
    const side = poly([[12, -8, 0], [12, 8, 0], [12, 8, 9], [12, -8, 9]], "pr") + poly([[12, 8, 8.2], [12, -8, 8.2], [12, -8, 9], [12, 8, 9]], "bevel-r") +
      line([[12, 8, 9], [12, 8, 0]], "crease") +
      // the near half of the silhouette and the front and right rims, over the cards
      line([[-12, 8, 9], [-12, 8, 0], [12, 8, 0], [12, -8, 0], [12, -8, 9]], "edge-open") +
      line([[-12, 8, 9], [12, 8, 9], [12, -8, 9]], "edge-open");
    return halo(22) + back + inside + cards + front + side;
  },

  // A load balancer: a 1U appliance, a row of recessed ports with link lights, the fan-out etched in its lid.
  balancer() {
    const b = box(-16, -10, 0, 32, 20, 7);
    // one link light, over the first port; the others' marks stay quiet so the part keeps one lit accent
    const ports = each(4, (i) => recess(4 + i * 5.4, 1.4, 3.8, 3, 0.8) + (i === 0 ? led(4.4, 5.6, 1.6) : rule(4.4 + i * 5.4, 5.6, 6 + i * 5.4)));
    const front = face(b, "L", ports + recess(26.4, 1.6, 3, 2.6, 0.7) + screw(1.3, 3.5) + screw(30.7, 3.5));
    const lid = face(b, "T", etch([[4, 10], [12, 10]]) + etch([[12, 10], [25, 4.2]]) + etch([[12, 10], [25, 10]]) + etch([[12, 10], [25, 15.8]]) +
      etchDot(12, 10, 1) + etchDot(25, 4.2) + etchDot(25, 10) + etchDot(25, 15.8) + etchDot(4, 10, 0.7) +
      screw(1.6, 1.6) + screw(30.4, 1.6) + screw(1.6, 18.4) + screw(30.4, 18.4));
    const side = face(b, "R", each(3, (i) => slot(4 + i * 4, 2.2, 2.6, 2.6)));
    return halo(26) + b.svg + front + lid + side;
  },

  // A tower server: a label plate with the light above it, recessed drive bays with pulls, a grille, side vents, a lid seam, screws.
  web(o) {
    // `many` draws each machine a little smaller (a big row smaller still), so the row stays on its base and under the role's top
    const k = (o.big ? 1.18 : 1) * (o.many ? (o.big ? 0.8 : 0.86) : 1), w = 18 * k, h = 34 * k, bay = Math.min(3.4, h * 0.1);
    const tower = (ox: number, oy: number) => {
      const b = box(-w / 2 + ox, -w / 2 + oy, 0, w, w, h);
      // drive bays: a pull (rule) and a quiet activity slot each, a strip of face between them so they stay apart at a
      // phone's size; the one status light sits above the label plate
      const bays = [0.52, 0.38, 0.24].map((f) => recess(2, h * f, w - 4, bay, 1) + rule(3.4, h * f + bay / 2, 8.5) + slot(w - 5.4, h * f + bay / 2 - 0.45, 1.6, 0.9)).join("");
      const front = face(b, "L", plate(2, h * 0.7, w - 4, 5.2) + screw(2.9, h * 0.7 + 2.6) + bays + each(6, (i) => slot(2.4 + i * 2.3 * k, 2, 1.1, 3.2)) + led(w - 5.6, h - 2.4, 2));
      const side = face(b, "R", each(2, (c) => each(5, (i) => slot(3 + c * 6 * k, h * 0.55 + i * 2.4, 4.2 * k, 1))) + screw(1.6, h - 1.8) + screw(w - 1.6, h - 1.8));
      const lid = face(b, "T", `<path class="rule" d="M0 ${r2(w / 2)}H${r2(w)}" ${NS}/>` + screw(1.7, 1.7) + screw(w - 1.7, 1.7) + screw(1.7, w - 1.7) + screw(w - 1.7, w - 1.7));
      return b.svg + front + side + lid;
    };
    // `many`: a row of identical machines, back to front
    return halo(19 * k + (o.many ? 8 : 0), 9.5 * k + (o.many ? 4 : 0)) + (o.many ? tower(-6, -13) + tower(-3, -6.5) : "") + tower(0, 0);
  },

  // A database: a smoothly shaded drum with raised hoops and a cap. It fills like a tank to `level`.
  database(o) {
    const k = o.big ? 1.2 : 1, h = 27 * k;
    const c = cylinder(13 * k, h, { level: o.level, levelHot: o.levelHot });
    const arc = (y: number) => `M${r2(-c.rx)} ${r2(y)}A${r2(c.rx)} ${r2(c.ry)} 0 0 0 ${r2(c.rx)} ${r2(y)}`;
    // the hoops: a band of the deepest tone (never lighter than the drum behind it) with a crease under it and a light
    // line along its top, so the drum reads as a stack of disks in both themes however small
    const hoops = [9 * k, 18 * k].map((bz) => {
      const y = c.sb - bz;
      return `<path class="pd" d="${arc(y)}L${r2(c.rx)} ${r2(y + 1.3)}A${r2(c.rx)} ${r2(c.ry)} 0 0 1 ${r2(-c.rx)} ${r2(y + 1.3)}Z"/>` +
        `<path class="crease" d="${arc(y + 1.3)}"/><path class="ring-light" d="${arc(y)}" ${NS}/>`;
    }).join("");
    // the waterline: a ring at the fill's edge, so the level reads in both themes however faint the fill is
    let water = "";
    if (o.level && o.level > 0) {
      const y = c.sb - clamp(h * o.level, 1.2, h - 0.8);
      water = `<path class="ring-shade" d="${arc(y + 0.9)}" ${NS}/><path class="ring-light" d="${arc(y)}" ${NS}/>`;
    }
    // the hoops' and the waterline's ends tuck under the silhouette, drawn again over them
    const outline = `<path class="edge" d="M${r2(-c.rx)} ${r2(c.st)}L${r2(-c.rx)} ${r2(c.sb)}A${r2(c.rx)} ${r2(c.ry)} 0 0 0 ${r2(c.rx)} ${r2(c.sb)}L${r2(c.rx)} ${r2(c.st)}"/>`;
    // a primary's cap is plain; a replica's carries a ring sunk into it
    const cap = o.replica ? `<ellipse class="recess" cx="0" cy="${r2(c.st)}" rx="${r2(c.rx * 0.56)}" ry="${r2(c.ry * 0.56)}"/>` +
      `<ellipse class="pt" cx="0" cy="${r2(c.st)}" rx="${r2(c.rx * 0.4)}" ry="${r2(c.ry * 0.4)}"/>` +
      `<ellipse class="rim" cx="0" cy="${r2(c.st)}" rx="${r2(c.rx * 0.56)}" ry="${r2(c.ry * 0.56)}" ${NS}/>` : "";
    return halo(20 * k) + c.svg + hoops + water + outline + cap + `<path class="led" d="M-2.6 ${r2(c.sb + c.ry - 4.4)}h5.2" ${NS}/>`;
  },

  // A memory module: a bevelled board, chips with legs, gold contacts along its edge, a notch, one light.
  cache() {
    const board = box(-17, -8, 0, 34, 16, 2.6, { bevel: 0.5 });
    const chips = each(4, (i) => {
      const chip = box(-14.2 + i * 8, -4.6, 2.6, 5.6, 8.6, 1.6, { top: "pm", bevel: 0.35 });
      return chip.svg + face(chip, "L", each(4, (j) => `<path class="leg" d="M${r2(0.8 + j * 1.35)} 0V-1.2" ${NS}/>`));
    });
    const fingers = face(board, "L", each(14, (i) => (i === 7 ? "" : `<rect class="finger" x="${r2(1.2 + i * 2.32)}" y=".35" width="1.3" height="1.7" rx=".3"/>`)));
    return halo(26) + board.svg + fingers + face(board, "R", led(4, 1.3, 2.6)) + chips;
  },

  // A CDN edge: a globe on a stand, shaded smoothly, its grid drawn as the stage's camera sees it and lights where the
  // edges are.
  cdn() {
    const p = box(-9, -9, 0, 18, 18, 4, { bevel: 0.5 });
    const collar = cylinder(3, 2.4, { z: 4, crease: false });
    const [cx, cy] = iso(0, 0, 18), R = 13.5, id = `sk-globe-${++clipCount}`;
    // the camera looks down 35 degrees, so the grid shows only what faces it: every line ends on the globe's outline, and
    // the meridians cross at a dot on the north pole. `at` is the point at latitude `la`, longitude `lo` (0 faces the viewer)
    const se = 1 / Math.sqrt(3), ce = Math.sqrt(2 / 3), rad = Math.PI / 180;
    const at = (la: number, lo: number): [number, number] =>
      [cx + R * Math.cos(la * rad) * Math.sin(lo * rad), cy + R * (se * Math.cos(la * rad) * Math.cos(lo * rad) - ce * Math.sin(la * rad))];
    const arc = (a: [number, number], rx: number, ry: number, rot: number, large: number, sweep: number, b: [number, number]) =>
      `<path class="etch" d="M${r2(a[0])} ${r2(a[1])}A${r2(rx)} ${r2(ry)} ${r2(rot)} ${large} ${sweep} ${r2(b[0])} ${r2(b[1])}" ${NS}/>`;
    // a latitude: the part of its ring that faces the viewer, round the front from one side of the outline to the other
    const lat = (la: number) => {
      const reach = Math.acos(clamp(-Math.tan(la * rad) * se / ce, -1, 1)) / rad, rx = R * Math.cos(la * rad);
      return arc(at(la, -reach), rx, rx * se, 0, reach > 90 ? 1 : 0, 0, at(la, reach));
    };
    // a meridian: the half of its ring that faces the viewer, from the outline low on one side, over the north pole, to
    // the outline high on the other; the one facing the viewer is seen edge on, a straight line through the pole
    const meridian = (lo: number) => {
      if (!lo) return `<path class="etch" d="M${r2(cx)} ${r2(cy - R)}V${r2(cy + R)}" ${NS}/>`;
      const s = Math.sin(lo * rad), ex = s * se, ey = Math.cos(lo * rad), n = Math.hypot(ex, ey);
      return arc([cx - (R * ex) / n, cy - (R * ey) / n], R, R * Math.abs(s) * ce, Math.atan2(ey, ex) / rad, 0, ex > 0 ? 1 : 0, [cx + (R * ex) / n, cy + (R * ey) / n]);
    };
    // the southern latitude sits at 20 degrees, not 40: seen from above, one further south would crowd the outline
    const lines = lat(40) + lat(0) + lat(-20) + meridian(-45) + meridian(0) + meridian(45) + etchDot(cx, cy - R * ce, 0.7);
    // the edges' lights sit on the grid, clear of the outline: two where a meridian crosses a latitude, one on the southern latitude
    const lights = [at(40, -45), at(0, 45), at(-20, -22)].map(([x, y]) => lamp(x, y, 1.4)).join("");
    const globe = `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${R}" fill="url(#sk-ball)"/>` +
      `<clipPath id="${id}"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${R}"/></clipPath><g clip-path="url(#${id})">${lines}</g>` +
      `<circle class="edge" cx="${r2(cx)}" cy="${r2(cy)}" r="${R}"/>` + lights;
    return halo(18) + p.svg + face(p, "T", screw(1.6, 1.6) + screw(16.4, 1.6) + screw(1.6, 16.4) + screw(16.4, 16.4)) + collar.svg + globe;
  },

  // Object storage: a bucket, its tapered body shaded smoothly, a raised band, a rim around its open top, a wire handle.
  storage() {
    const b = cylinder(13, 22, { rBottom: 10, bands: [15], crease: false });
    const mouth = `<ellipse class="recess" cx="0" cy="${r2(b.st + 0.5)}" rx="${r2(b.rx - 2)}" ry="${r2(b.ry - 1.2)}"/>` +
      `<path class="wall" d="M${r2(-b.rx + 2)} ${r2(b.st + 0.5)}A${r2(b.rx - 2)} ${r2(b.ry - 1.2)} 0 0 1 ${r2(b.rx - 2)} ${r2(b.st + 0.5)}A${r2(b.rx - 2)} ${r2(b.ry * 0.7)} 0 0 0 ${r2(-b.rx + 2)} ${r2(b.st + 0.5)}Z"/>` +
      `<ellipse class="rim" cx="0" cy="${r2(b.st + 0.5)}" rx="${r2(b.rx - 2)}" ry="${r2(b.ry - 1.2)}" ${NS}/>`;
    const ear = (x: number) => `<circle class="pm" cx="${r2(x)}" cy="${r2(b.st + 3)}" r="1.3"/><circle class="edge" cx="${r2(x)}" cy="${r2(b.st + 3)}" r="1.3"/>`;
    // the bail stands well clear of the rim, so it reads as a handle and not a second rim
    const handle = `<path class="handle" d="M${r2(-b.rx + 0.6)} ${r2(b.st + 3)}C${r2(-b.rx + 2)} ${r2(b.st - 26)} ${r2(b.rx - 2)} ${r2(b.st - 26)} ${r2(b.rx - 0.6)} ${r2(b.st + 3)}"/>`;
    return halo(17) + b.svg + mouth + ear(-b.rx + 0.6) + ear(b.rx - 0.6) + handle + `<path class="led" d="M-2.5 ${r2(b.sb + b.ryb - 4.6)}h5" ${NS}/>`;
  },

  // A queue: a tray on rollers with an end stop, parcels taped shut and gathered at its head. 38 long, so it stays on its base.
  queue(o) {
    const n = clamp(o.items ?? 3, 0, 4);
    const rail = box(-19, -7, 0, 38, 14, 3);
    const rollers = face(rail, "T", each(9, (i) => `<path class="crease" d="M${r2(2 + i * 4.25)} 1.6V12.4" ${NS}/>`));
    // the lips butt into the end stop rather than run through it
    const lipBack = box(-19, -7, 3, 36.6, 1.4, 2.2, { bevel: 0.3 });
    // each parcel's tape runs over its lid and down its front to the bottom edge
    const parcels = [10, 1.6, -6.8, -15.2].slice(0, n).map((x) => {
      const p = box(x, -4.4, 3, 7, 7, 6.4, { bevel: 0.45 });
      return p.svg + face(p, "T", `<path class="tape" d="M3.5 0V7" ${NS}/>`) + face(p, "L", `<path class="tape" d="M3.5 6.4V0" ${NS}/>`);
    }).reverse().join("");
    const lipFront = box(-19, 5.6, 3, 36.6, 1.4, 2.2, { bevel: 0.3 });
    // the stop stands nearer the viewer than the front lip's end, so it goes down last
    const stop = box(17.6, -7, 3, 1.4, 14, 4.4, { bevel: 0.3 });
    // the end stop and the parcels gathered at the head show which way it runs; the rail's front carries only its screws
    const front = face(rail, "L", screw(1.4, 1.5) + screw(36.6, 1.5));
    return halo(27) + rail.svg + rollers + face(rail, "R", led(4.5, 1.5, 3)) + lipBack.svg + parcels + lipFront.svg + stop.svg + front;
  },

  // A worker: a machine with a gear in a round recess on its face, vent slots, a lid seam and screws.
  worker() {
    const b = box(-10, -10, 0, 20, 20, 20);
    // eight broad teeth (a flat tip, short flanks, a flat root) outlined in ink, so it reads as a cog down to a phone's size
    const P = Math.PI / 4, tooth: [number, number][] = [[-0.16, 6.9], [0.16, 6.9], [0.34, 4.6], [0.66, 4.6]];
    const teeth = each(8, (j) => tooth.map(([f, r]) => { const a = (j + f) * P - Math.PI / 2; return `${r2(10 + Math.cos(a) * r)},${r2(10.5 + Math.sin(a) * r)} `; }).join("")).trim();
    // the round recess's shadowed wall is under its top edge, like every other recess
    const gear = `<circle class="recess" cx="10" cy="10.5" r="7.6"/><path class="wall" d="M2.4 10.5A7.6 7.6 0 0 0 17.6 10.5A7.6 6.4 0 0 1 2.4 10.5Z"/><circle class="rim" cx="10" cy="10.5" r="7.6" ${NS}/>` +
      `<polygon class="gear" points="${teeth}" ${NS}/><polygon class="edge" points="${teeth}"/><circle class="pd" cx="10" cy="10.5" r="1.7"/><circle class="screw" cx="10" cy="10.5" r=".7"/>`;
    const front = face(b, "L", gear + screw(1.6, 1.6) + screw(18.4, 1.6) + screw(1.6, 18.4) + screw(18.4, 18.4));
    const side = face(b, "R", led(3, 16, 3.4) + each(4, (i) => slot(3 + i * 3.6, 3, 1.4, 7)));
    const lid = face(b, "T", `<path class="rule" d="M0 10H20" ${NS}/>` + screw(1.7, 1.7) + screw(18.3, 1.7) + screw(1.7, 18.3) + screw(18.3, 18.3));
    return halo(20) + b.svg + front + side + lid;
  },

  // Monitoring: a screen on a stand showing a sparkline in its recess, a foot with screws.
  monitor() {
    const foot = box(-8, -6, 0, 16, 12, 1.6, { bevel: 0.4 });
    const stem = box(-1.5, -1.5, 1.6, 3, 3, 9, { bevel: 0 });
    const panel = box(-15, -1.5, 10.6, 30, 2.6, 20, { bevel: 0.6 });
    const screen = face(panel, "L", recess(1.6, 1.8, 26.8, 16.4, 1.2) +
      `<polyline class="spark" points="4.5,5.5 9,9 13,7 17,11.5 21,10 25.5,14.5" ${NS}/>` + led(24.4, 0.9, 2.4));
    return halo(17) + foot.svg + face(foot, "T", screw(1.6, 1.6) + screw(14.4, 1.6) + screw(1.6, 10.4) + screw(14.4, 10.4)) + stem.svg + panel.svg + screen;
  },
};

/** A part whose drawing isn't loaded (or failed): a plain crate of the role's height, so the stage never breaks. */
function crate(top: number) {
  const h = clamp(top - 12, 6, 34), b = box(-12, -12, 0, 24, 24, h);
  return halo(18) + b.svg + face(b, "L", plate(4, h * 0.55, 16, Math.min(5, h * 0.3)) + led(16, 1.6, 2.6)) +
    face(b, "T", screw(1.7, 1.7) + screw(22.3, 1.7) + screw(1.7, 22.3) + screw(22.3, 22.3));
}

/** The leader's flag, on a pole at the base's left corner: any role can carry it (`lead`). */
function flag() {
  const at = (x: number, z: number): V3 => [x, 15, z];
  return line([at(-12, 0), at(-12, 30)], "pole") + `<circle class="pm" cx="${r2(iso(-12, 15, 0)[0])}" cy="${r2(iso(-12, 15, 0)[1])}" r="1.1"/>` +
    poly([at(-12, 30), at(-20, 28), at(-12, 22.5)], "flag") + line([at(-12, 30), at(-20, 28), at(-12, 22.5)], "edge-open");
}

const drawn: Pack = { ...CORE };
/** Add a pack's drawings (packs/index.ts does this when a scene needs them). */
export function addPack(pack: Pack) { Object.assign(drawn, pack); }
export const isDrawn = (role: StageRole) => !!drawn[role];

/** Height of each part above its floor centre, for placing what floats over it. */
export const GLYPH_TOP = Object.fromEntries(ROLE_IDS.map((r) => [r, ROLES[r].top])) as Record<StageRole, number>;

/** A part's drawing as SVG markup; a neutral crate when its pack hasn't loaded. */
export function glyph(role: StageRole, opts: GlyphOptions = {}): string {
  let art = "";
  try { art = drawn[role]?.(opts) ?? ""; } catch (err) { console.error(`SystemKit stage: drawing "${role}" failed`, err); }
  return (art || crate(GLYPH_TOP[role] ?? 30)) + (opts.lead ? flag() : "");
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

/** The rounded base every part stands on: a bevel of light on its rim, a crease where top meets side, a light on its front. */
export function plinth(size = 56, h = 7, r = 11): string {
  const half = size / 2, foot: [number, number][] = [];
  for (const [cx, cy, a0] of [[half - r, half - r, 0], [r - half, half - r, 90], [r - half, r - half, 180], [half - r, r - half, 270]])
    for (let k = 0; k <= 8; k++) { const a = ((a0 + k * 11.25) * Math.PI) / 180; foot.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const at = (z: number) => foot.map(([x, y]) => iso(x, y, z));
  const outline = closed(hull([...at(h), ...at(0)]));
  const [a, b] = [iso(half - r - 16, half, h * 0.45), iso(half - r - 5, half, h * 0.45)];
  return `<path class="base-side" d="${outline}"/><path class="base-rim" d="${closed(at(h - 1.1))}"/><path class="base-top" d="${closed(at(h))}"/>` +
    `<path class="base-edge" d="${outline}"/><path class="led strip" d="M${r2(a[0])} ${r2(a[1])}L${r2(b[0])} ${r2(b[1])}"/>`;
}

/** Gradients the drawings share, for the stage's <defs>: round shading, a lit ball, a contact halo, the base's side. */
export const PICTOGRAM_DEFS =
  '<linearGradient id="sk-round" x1="0" x2="1"><stop offset="0" class="gs-mid"/><stop offset=".28" class="gs-left"/><stop offset=".62" class="gs-right"/><stop offset="1" class="gs-deep"/></linearGradient>' +
  '<radialGradient id="sk-ball" cx=".36" cy=".32" r=".75"><stop offset="0" class="gs-top"/><stop offset=".5" class="gs-mid"/><stop offset="1" class="gs-deep"/></radialGradient>' +
  '<radialGradient id="sk-halo"><stop offset="0" class="gh0"/><stop offset=".6" class="gh1"/><stop offset="1" class="gh2"/></radialGradient>' +
  '<linearGradient id="sk-plinth-side" x1="0" x2="1"><stop offset="0" class="gs-mid"/><stop offset=".5" class="gs-mid"/><stop offset=".5" class="gs-deep"/><stop offset="1" class="gs-deep"/></linearGradient>';
