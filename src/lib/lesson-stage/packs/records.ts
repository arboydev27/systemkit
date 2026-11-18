// The "records" pack: how data is laid out and found. Drawn to the rules in .claude/skills/pictogram-polish; roles and
// their options are listed in roles.ts, the objects they are in docs/pictogram-catalog.md.
import { NS, box, clamp, cylinder, each, etch, etchDot, face, halo, iso, lamp, led, line, plane, plate, pocket, poly, pts, r2, recess, rule, screw, slot, type V3 } from "../draw.ts";
import type { GlyphOptions, StageRole } from "../roles.ts";
import type { Pack } from "../pictograms.ts";

let clips = 0;
const rad = (a: number) => (a * Math.PI) / 180;

const pack: Pack = {
  // A whiteboard on a stand: posts on splayed feet, a framed board with sorted entries written down it to `level`, a
  // marker tray along its foot with the light on the tray's lip. Full and hot, the written part warms.
  memtable(o) {
    const k = Math.round(clamp(o.level ?? 0.55, 0, 1) * 7);
    const stand = each(2, (i) => { const x = i ? 12 : -12; return box(x - 1.1, -9, 0, 2.2, 13, 1.6, { bevel: 0.4 }).svg + box(x - 0.9, -3.4, 1.6, 1.8, 1.8, 31.4, { bevel: 0 }).svg; });
    const b = box(-15, -1.6, 10.8, 30, 2.2, 21.4, { bevel: 0.6 });
    const entries = each(k, (i) => { const v = 17.8 - i * 2.4; return etchDot(3.6, v, 0.55) + rule(5.4, v, 5.4 + 8 + ((i * 5) % 9) * 1.4); });
    const wash = o.levelHot && k ? `<rect class="liquid is-hot" x="1.3" y="${r2(19.1 - k * 2.4)}" width="27.4" height="${r2(k * 2.4 + 0.7)}"/>` : "";
    const board = face(b, "L", `<rect class="pt" x="1.3" y="1.3" width="27.4" height="18.8" rx=".4"/>${wash}<rect class="rim" x="1.3" y="1.3" width="27.4" height="18.8" rx=".4" ${NS}/>` + entries);
    const tray = box(-13, 0.6, 9, 26, 3, 1.8, { bevel: 0.4 });
    const marker = box(-9, 1.4, 10.8, 6, 1.3, 1.3, { bevel: 0.3, top: "pm" });
    return halo(22) + stand + b.svg + board + tray.svg + face(tray, "L", led(20, 0.9, 2.6)) + marker.svg;
  },

  // Sorted files: archive boxes stacked one per file, each with a label holder, a hand hole and a band sealing its lid.
  // A stack stays three high: a fourth and fifth file start a second stack behind the first.
  sstable(o) {
    const n = clamp(o.count ?? 3, 1, 5), front = Math.min(n, 3);
    const archive = (i: number, level: number, oy: number, lit: boolean) => {
      const dx = [0, 0.7, -0.5, 0.5, -0.3][i], dy = [0, -0.5, 0.4, 0.2, -0.4][i] + oy, z = level * 8;
      const b = box(-10 + dx, -6.5 + dy, z, 20, 13, 6.4, { bevel: 0 });
      const lid = box(-10.4 + dx, -6.9 + dy, z + 5.6, 20.8, 13.8, 2.4, { bevel: 0.4 });
      return b.svg + face(b, "L", plate(2, 1.1, 8, 3.4) + `<path class="tape" d="M15 0V5.6" ${NS}/>` + (lit ? led(11.4, 2.8, 2.4) : "")) +
        face(b, "R", slot(4.5, 2.4, 4, 1.5)) + lid.svg +
        face(lid, "L", `<path class="tape" d="M15.4 0V2.4" ${NS}/>`) + face(lid, "T", `<path class="tape" d="M15.4 0V13.8" ${NS}/>`);
    };
    // the back stack first (further from the viewer), then the front stack, each bottom to top; the light on the front stack's top
    const back = each(n - 3, (j) => archive(3 + j, j, -10, false));
    return (n > 3 ? halo(22, 11.5, -0.5, 2.6) : halo(19)) + back + each(front, (j) => archive(j, j, n > 3 ? 4 : 0, j === front - 1));
  },

  // A Bloom filter: a pegboard sloped back on a low wedge stand, like a game board, a grid of 28 holes with a peg set in
  // each bit that's on. `level` is the share of bits set, scattered the way hashes scatter them.
  bloom(o) {
    const cols = 7, N = 28, k = Math.round(clamp(o.level ?? 0.4, 0, 1) * N);
    // a fixed scattered order, taken from its start: no two of the first fourteen holes sit side by side or stacked, so
    // a board up to half full reads as bits scattered by hashing, never as runs of neighbours
    const ORDER = [3, 25, 7, 15, 13, 21, 1, 19, 5, 27, 9, 23, 17, 11, 6, 2, 0, 26, 16, 12, 18, 10, 8, 22, 24, 20, 4, 14];
    const on = new Set(ORDER.slice(0, k));
    // the board leans back from upright by LEAN; t runs up it from its front edge (0) to its back edge (L)
    const LEAN = rad(35), L = 18, sn = Math.sin(LEAN), cs = Math.cos(LEAN), X0 = -15, X1 = 15, YF = 5.5, ZF = 3, LEDGE = 1.6;
    const P = (x: number, t: number, lift = 0): V3 => [x, YF - t * sn + lift * cs, ZF + t * cs + lift * sn];
    const yb = YF - L * sn, zt = ZF + L * cs;
    const at = (i: number) => [3.3 + (i % cols) * 3.9, 3 + Math.floor(i / cols) * ((L - 6) / 3)];
    // the stand: a lip along its front, a flat ledge along its back, its right side, then the sloped board between them
    const lip = poly([[X0, YF, 0], [X1, YF, 0], [X1, YF, ZF], [X0, YF, ZF]], "pl");
    const side = poly([[X1, YF, 0], [X1, yb - LEDGE, 0], [X1, yb - LEDGE, zt], [X1, yb, zt], [X1, YF, ZF]], "pr");
    const ledge = poly([[X0, yb - LEDGE, zt], [X1, yb - LEDGE, zt], [X1, yb, zt], [X0, yb, zt]], "pt");
    const slope = poly([P(X0, 0), P(X1, 0), P(X1, L), P(X0, L)], "pl");
    const board = plane(P(X0, 0), [1, 0, 0], [0, -sn, cs],
      `<rect class="rim" x="1" y="1" width="28" height="${r2(L - 2)}" rx=".5" ${NS}/>` +
      each(N, (i) => `<circle class="recess" cx="${r2(at(i)[0])}" cy="${r2(at(i)[1])}" r=".95"/>`));
    const front = plane([X0, YF, 0], [1, 0, 0], [0, 0, 1], led(23.6, 1.5, 2.6) + screw(1.5, 1.5) + screw(28.5, 1.5));
    const edges = line([[X0, YF, ZF], [X1, YF, ZF], [X1, YF, 0]], "crease") + line([P(X1, 0), P(X1, L)], "crease") + line([[X0, yb, zt], [X1, yb, zt], [X1, yb - LEDGE, zt]], "crease") +
      `<polygon class="edge" points="${pts([[X0, yb - LEDGE, zt], [X1, yb - LEDGE, zt], [X1, yb - LEDGE, 0], [X1, YF, 0], [X0, YF, 0], [X0, YF, ZF], [X0, yb, zt]])}"/>`;
    // a set peg: a solid round head standing just off the board, back rows first
    const pegs = each(N, (j) => {
      const i = N - 1 - j;
      if (!on.has(i)) return "";
      const [u, v] = at(i), [px, py] = iso(...P(X0 + u, v, 0.9));
      return `<circle class="ink" cx="${r2(px)}" cy="${r2(py)}" r="1.3"/>`;
    });
    return halo(22, 11, 1 + (YF + yb) / 4, -(YF + yb) * 0.43) + lip + side + ledge + slope + board + front + edges + pegs;
  },

  // A tree on a stand: a root block on a post, children on rods, two leaves under each standing on a long board; the leaf
  // the walk reached (`mark`, under that child) is lifted and lit. The blocks are pages, with dividers between their keys.
  tree(o) {
    // the model stands across the view, on the diagonal: s is a place along it, at world (s, -s). The children sit close
    // to the post (and three of them close to each other), so no gap in the middle shows the base's back edge behind
    const n = clamp(o.count ?? 2, 2, 3), m = o.mark === undefined ? -1 : clamp(o.mark, 0, n - 1), Z = 1.8;
    const kids = n === 2 ? [-6.5, 6.5] : [-9, 0, 9], lw = n === 2 ? 3.8 : 3.2, pw = n === 2 ? 3 : 2.4;
    // each child's two leaves, left to right; three children's six leaves are spaced evenly along the board
    const under = (s: number): [number, number] => (n === 2 ? [s - 3, s + 3] : s === 0 ? [-2.8, 2.8] : s < 0 ? [-12, -7.4] : [7.4, 12]);
    const block = (s: number, z: number, w: number, h: number, cells: number, left = "", right = "") => {
      const b = box(s - w / 2, -s - w / 2, z, w, w, h, { bevel: 0.4 });
      return b.svg + face(b, "L", each(cells - 1, (j) => { const u = (w * (j + 1)) / cells; return etch([[u, 0], [u, h]]); }) + left) + (right && face(b, "R", right));
    };
    const socket = (p: V3) => { const [x, y] = iso(...p); return `<circle class="pd" cx="${r2(x)}" cy="${r2(y)}" r=".8"/>`; };
    // the board: long under the leaves, its ends pointed along the floor's edges, its front a flat face to the viewer
    const H = Math.abs(under(kids[n - 1])[1]) + lw / 2 + 1.2, q = 5.2 * Math.SQRT2, bv = 0.45;
    const corners: [number, number][] = [[-H, H], [q - H, H], [H, q - H], [H, -H], [H - q, -H], [-H, H - q]];
    const at = (k: number, z: number): V3 => [...corners[k], z];
    const side = (k: number, cls: string, bevel: string) =>
      poly([at(k, 0), at(k + 1, 0), at(k + 1, Z), at(k, Z)], cls) + poly([at(k, Z - bv), at(k + 1, Z - bv), at(k + 1, Z), at(k, Z)], bevel);
    const board = side(0, "pl", "bevel") + side(1, "pm", "bevel") + side(2, "pr", "bevel-r") + poly(corners.map((_, k) => at(k, Z)), "pt") +
      line([at(0, Z), at(1, Z), at(2, Z), at(3, Z)], "crease") + line([at(1, Z), at(1, 0)], "crease") + line([at(2, Z), at(2, 0)], "crease") +
      `<polygon class="edge" points="${pts([at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(3, Z), at(4, Z), at(5, Z), at(0, Z)])}"/>`;
    const post = box(-pw / 2, -pw / 2, Z, pw, pw, 28 - Z, { bevel: 0 }).svg;
    let leaves = "", low = "", mid = "";
    kids.forEach((s, i) => under(s).forEach((l, j) => {
      const hit = i === m && j === 0, z = Z + (hit ? 7 : 0);
      leaves += block(l, z, lw, 4, 1, hit ? lamp(lw / 2, 2, 1.1) : rule(0.8, 2, lw - 0.8));
      low += line([[s, -s, 15], [l, -l, z + 4]], "pole") + socket([l, -l, z + 4]);
    }));
    kids.forEach((s) => { mid += line([[0, 0, 28], [s, -s, 20]], "pole") + socket([s, -s, 20]); });
    return halo(22, 9) + board + post + leaves + low + kids.map((s) => block(s, 15, 8, 5, 2)).join("") + mid + block(0, 28, 10, 6, 3, "", led(3.8, 3, 2.4));
  },

  // A shard: a drum cut into wedges on a round board, one wedge (`mark`) pulled out and lit: this slice of the data.
  shard(o) {
    const n = clamp(o.count ?? 4, 2, 6), m = clamp(o.mark ?? 0, 0, n - 1), R = 11.5, Z = 2.4, H = 13, step = 360 / n;
    const P = (dx: number, dy: number, a: number, r: number, z: number): V3 => [dx + r * Math.cos(rad(a)), dy + r * Math.sin(rad(a)), z];
    const arc = (dx: number, dy: number, a0: number, a1: number, z: number, r = R) => {
      const k = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 9));
      return Array.from({ length: k + 1 }, (_, j) => P(dx, dy, a0 + ((a1 - a0) * j) / k, r, z));
    };
    const side = (dx: number, dy: number, s0: number, s1: number) => pts([...arc(dx, dy, s0, s1, Z + H), ...arc(dx, dy, s1, s0, Z)]);
    const wedges = Array.from({ length: n }, (_, i) => {
      // pulled out until its rind meets the board's edge, never past it
      const a0 = 20 - step / 2 + i * step, a1 = a0 + step, mid = a0 + step / 2, out = i === m ? 4.5 : 0;
      const dx = out * Math.cos(rad(mid)), dy = out * Math.sin(rad(mid)), c0: V3 = [dx, dy, Z], c1: V3 = [dx, dy, Z + H];
      const cut = (a: number, nx: number, ny: number) => {
        if (nx + ny < 0.01) return "";
        const f = pts([c0, P(dx, dy, a, R, Z), P(dx, dy, a, R, Z + H), c1]);
        return `<polygon class="${ny > nx ? "pl" : "pr"}" points="${f}"/><polygon class="edge" points="${f}"/>`;
      };
      let svg = cut(a0, Math.sin(rad(a0)), -Math.cos(rad(a0))) + cut(a1, -Math.sin(rad(a1)), Math.cos(rad(a1)));
      // the rind: the part of the drum's side this wedge shows, shaded from the whole drum's gradient
      const lo = ((((a0 + 45) % 360) + 360) % 360) - 45, hi = lo + step;
      for (const [s0, s1] of [[Math.max(lo, -45), Math.min(hi, 135)], [Math.max(lo, 315), hi]]) {
        if (s1 - s0 < 0.5) continue;
        const id = `sk-clip-shard-${++clips}`, region = side(dx, dy, s0, s1);
        svg += `<clipPath id="${id}"><polygon points="${region}"/></clipPath><polygon points="${side(dx, dy, -45, 135)}" fill="url(#sk-round)" clip-path="url(#${id})"/><polygon class="edge" points="${region}"/>`;
      }
      const top = pts([c1, ...arc(dx, dy, a0, a1, Z + H)]);
      svg += `<polygon class="pt" points="${top}"/><polygon class="edge" points="${top}"/>`;
      if (i === m) { const [lx, ly] = iso(...P(dx, dy, mid, R * 0.6, Z + H)); svg += lamp(lx, ly, 1.3); }
      return { svg, depth: dx + dy + R * 0.6 * (Math.cos(rad(mid)) + Math.sin(rad(mid))) };
    }).sort((a, b) => a.depth - b.depth);
    const board = cylinder(16, Z, { crease: false });
    return halo(22) + board.svg + `<polyline class="led" points="${pts(arc(0, 0, 100, 114, 1.2, 16))}" ${NS}/>` + wedges.map((w) => w.svg).join("");
  },

  // An index: a card-catalogue cabinet on legs, rows of small drawers with label holders and pulls; the drawer looked
  // up (`mark`) is pulled out, the cards standing in it, its lamp lit.
  index(o) {
    const m = o.mark === undefined ? -1 : clamp(Math.round(o.mark), 0, 11), w = 5.975, h = 4.37;
    const cell = (j: number) => [1 + (j % 4) * (w + 0.7), 15.5 - (Math.floor(j / 4) + 1) * h - Math.floor(j / 4) * 0.7];
    const drawer = (lit: boolean) => `<rect class="plate" x="1.3" y="2.5" width="3.4" height="1.2" rx=".3"/>` + slot(1.9, 0.8, 2.2, 0.9) + (lit ? lamp(4.9, 1.25, 0.7) : "");
    const legs = each(4, (i) => box(i % 2 ? 11 : -13, i > 1 ? 4.6 : -6.6, 0, 2, 2, 5, { bevel: 0 }).svg);
    const cab = box(-14, -7.5, 5, 28, 15, 16.5, { bevel: 0 });
    const top = box(-14.8, -8.3, 21.5, 29.6, 16.6, 1.6, { bevel: 0.5 });
    const fronts = recess(0.7, 0.7, 26.6, 15.1, 0.6) + each(12, (j) => {
      const [u, v] = cell(j);
      return j === m ? recess(u, v, w, h, 1) : `<g transform="translate(${r2(u)} ${r2(v)})"><rect class="pl" width="${r2(w)}" height="${h}" rx=".3"/><rect class="rim" width="${r2(w)}" height="${h}" rx=".3" ${NS}/>${drawer(false)}</g>`;
    });
    let out = "";
    if (m >= 0) {
      const [u, v] = cell(m), d = box(-14 + u, 7.5, 5 + v, w, 7, h, { bevel: 0.3 });
      out = d.svg + face(d, "T", pocket(0.5, 0, w - 1, 6.4, 1.2)) +
        each(4, (j) => { const y = 8.4 + j * 1.3; return poly([[d.x + 0.9, y, d.z1 - 0.4], [d.x1 - 0.9, y, d.z1 - 0.4], [d.x1 - 0.9, y, d.z1 + 1.4], [d.x + 0.9, y, d.z1 + 1.4]], "card"); }) +
        face(d, "L", drawer(true));
    }
    return halo(22) + legs + cab.svg + face(cab, "L", fronts) + face(cab, "R", `<rect class="rim" x="1.4" y="1.4" width="12.2" height="13.7" rx=".4" ${NS}/>`) +
      top.svg + face(top, "L", led(24.4, 0.8, 2.6)) + out;
  },

  // A column store: a rack of tall column trays, each a column of values stacked under a header; the columns a query
  // reads (`items`) slide forward and light.
  columns(o) {
    const n = clamp(o.count ?? 4, 3, 6), k = clamp(o.items ?? 0, 0, n), w = 4.6, g = 1, span = n * w + (n - 1) * g, x0 = -span / 2;
    const read = [1, 3, 0, 4, 2, 5].filter((i) => i < n).slice(0, k);
    const base = box(x0 - 1.4, -6.4, 0, span + 2.8, 13.2, 2.4, { bevel: 0.5 });
    const trays = each(n, (i) => {
      // a tray that's read slides forward until it's flush with the base's front
      const lit = read.includes(i), t = box(x0 + i * (w + g), -5 + (lit ? 1.8 : 0), 2.4, w, 10, 28, { bevel: 0.5 });
      return t.svg + face(t, "L", recess(0.7, 0.8, w - 1.4, 21.8, 0.8) + each(7, (j) => `<rect class="key" x="1.15" y="${r2(1.3 + j * 3)}" width="${r2(w - 2.3)}" height="2.3" rx=".3"/>`) +
        `<rect class="pm" x=".7" y="23.6" width="${r2(w - 1.4)}" height="3.4" rx=".3"/><rect class="rim" x=".7" y="23.6" width="${r2(w - 1.4)}" height="3.4" rx=".3" ${NS}/>` +
        (lit ? lamp(w / 2, 25.3, 0.9) : ""));
    });
    const back = box(x0 - 1.4, -6.4, 2.4, span + 2.8, 1.4, 29.4, { bevel: 0.5 });
    // the light on the base's right end, where no tray slides over it
    return halo(span / 2 + 6) + base.svg + face(base, "R", led(2, 1.2, 2.6)) + back.svg + trays;
  },

  // A row: version cards (`count`) standing tall in a low slotted stand, each older one taller and further back, the
  // newest in front showing the row's fields; `locked` hangs a padlock from a hole punched in the front card.
  row(o) {
    const n = clamp(o.count ?? 2, 1, 4), Z = 2.5, H = 17, hold = box(-12, -5, 0, 24, 10, Z, { bevel: 0.5 });
    const cards = each(n, (j) => {
      const age = n - 1 - j, y = 1.4 - age * 1.2, x = -10 + age * 1.2, top = Z + H + age * 2;
      return poly([[x, y, Z], [x + 20, y, Z], [x + 20, y, top], [x, y, top]], age ? "card" : "card-lit") +
        (age ? "" : plane([x, y, Z], [1, 0, 0], [0, 0, 1], rule(2, 13.4, 11) + rule(2, 11.4, 7.5) + (o.locked ? `<circle class="recess" cx="14" cy="9" r=".9"/>` : "") +
          each(3, (c) => `<rect class="rim" x="${1.6 + c * 5.8}" y="2.2" width="5" height="4.4" rx=".3" ${NS}/>` + rule(2.6 + c * 5.8, 4.4, 5 + c * 5.8))));
    });
    // the padlock hangs in front of the cards, its shackle through the hole
    let lock = "";
    if (o.locked) {
      const body = box(2.6, 2.2, 4.2, 7.4, 2.4, 6.2, { bevel: 0.4, left: "pm" });
      lock = plane([2.6, 3.4, 0], [1, 0, 0], [0, 0, 1], `<path class="handle" d="M1.4 10.4V12A2.3 2.3 0 0 0 6 12V10.4"/>`) +
        body.svg + face(body, "L", `<circle class="recess" cx="3.7" cy="3.6" r=".9"/>` + slot(3.3, 1.2, 0.8, 2.2));
    }
    return halo(20) + hold.svg + face(hold, "T", pocket(1.2, 1.6, 21.6, 5.8, 0.8)) + face(hold, "L", led(2, 1.25, 2.6)) + cards + lock;
  },

  // A document: a clipboard on a desk copy stand, lying back on its wedge about 24 degrees (a phone in its dock stands
  // nearly upright), its clip holding a ruled sheet, older sheets (`count`) behind.
  doc(o) {
    // t runs up the board from its foot (0) to its top (1); `back` goes into the board, 1.2 thick
    const n = clamp(o.count ?? 2, 1, 3), DY = 11, DZ = 25, len = Math.hypot(DY, DZ), Y0 = 3, TW = 0.45;
    const P = (u: number, t: number, back = 0): V3 => [u, Y0 - DY * t - back, 1.6 + DZ * t];
    const onBoard = (inner: string) => plane(P(-11, 0), [1, 0, 0], [0, -DY / len, DZ / len], inner);
    const [, yb, zb] = P(0, TW, 1.2);
    const base = box(-11, yb - 1.2, 0, 22, Y0 + 2.6 - (yb - 1.2), 1.6, { bevel: 0.4 });
    // the wedge the board lies on: only its right side shows, a triangle under the board's lower edge
    const wedgeSide: V3[] = [[10, Y0 - 1.2, 1.6], [10, yb, zb], [10, yb, 1.6]];
    const wedge = poly(wedgeSide, "pr") + `<polygon class="edge" points="${pts(wedgeSide)}"/>`;
    const board =
      poly([P(-11, 0), P(11, 0), P(11, 1), P(-11, 1)], "pl") +
      poly([P(11, 0), P(11, 0, 1.2), P(11, 1, 1.2), P(11, 1)], "pr") +
      poly([P(-11, 1), P(11, 1), P(11, 1, 1.2), P(-11, 1, 1.2)], "pt") +
      poly([P(-11, 0.975), P(11, 0.975), P(11, 1), P(-11, 1)], "bevel") +
      line([P(-11, 1), P(11, 1), P(11, 0)], "crease") +
      `<polygon class="edge" points="${pts([P(-11, 1, 1.2), P(11, 1, 1.2), P(11, 0, 1.2), P(11, 0), P(-11, 0), P(-11, 1)])}"/>`;
    // older sheets step out to the right and down, so each shows an edge however small the stage draws it
    const sheet = (k: number) => `<rect class="card" x="2.4" y="2.2" width="15.6" height="21.4" rx=".3"${k ? ` transform="translate(${r2(k * 1.6)} ${r2(-k * 0.8)})"` : ""}/>`;
    const lines = each(6, (i) => rule(4.6, 4.6 + i * 2.4, i === 5 ? 11 : 16)) + rule(4.6, 19.6, 11);
    // the clip's wire loop stands well clear of its body (crown about 2.5 above it, just over the board's top edge), so
    // the board shows through it and it reads as an open wire, not an ink dome; its ends tuck under the body
    const clip = `<path class="handle" d="M7.6 25.4C7.8 29.6 14.2 29.6 14.4 25.4"/><rect class="pm" x="5.2" y="22.6" width="11.6" height="3.4" rx="1.4"/>` +
      `<rect class="edge" x="5.2" y="22.6" width="11.6" height="3.4" rx="1.4"/>` + screw(7, 24.3) + screw(15, 24.3);
    const lip = box(-10, Y0, 1.6, 20, 1.3, 1.4, { bevel: 0.3 });
    return halo(18) + base.svg + face(base, "L", led(16, 0.8, 2.6)) + wedge + board +
      onBoard(each(n, (i) => sheet(n - 1 - i)) + lines) + onBoard(clip) + lip.svg;
  },
};

export default pack;

/** Options worth seeing on the comparison sheet, per role (the first is how scenes usually show it). */
export const samples: Partial<Record<StageRole, GlyphOptions[]>> = {
  memtable: [{ level: 0.3 }, { level: 0.9 }, { level: 0 }, { level: 1, levelHot: true }],
  sstable: [{ count: 1 }, { count: 4 }, { count: 5 }],
  bloom: [{ level: 0 }, { level: 0.3 }, { level: 0.9 }],
  tree: [{ mark: 0 }, { count: 3 }, { count: 3, mark: 2 }, { mark: 1 }],
  shard: [{ count: 2 }, { mark: 2 }, { count: 6, mark: 3 }],
  index: [{ mark: 0 }, { mark: 7 }],
  columns: [{ items: 2 }, { count: 3 }, { count: 6, items: 6 }],
  row: [{ count: 1 }, { count: 4 }, { locked: true }, { count: 4, locked: true }],
  doc: [{ count: 1 }, { count: 3 }],
};
