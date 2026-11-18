// Where a log's strip puts its records, cursors and brackets, worked out from the data alone (no DOM), so it can be
// tested. Everything here is in label pixels: the strip is drawn at the stage's label scale, so its words keep their
// size on screen however far the camera zooms.
import type { LogCursor, LogEntry, LogState } from "./model.ts";

/** Sizes, in label pixels. A row is a tray lying on the floor: record tiles stand on its top, and its front edge is a
 * ruler with each record's offset printed on it. Cursors hang under the ruler; brackets and line cursors' names sit above. */
export const LOG = {
  /** Text advances: the 10.5px monospace of records, the 10px monospace of offsets, the 10.5px names of cursors and
   * brackets, and the 12px name of a log. */
  mono: 6.32, small: 6.02, sans: 6.15, name: 7.1,
  tileH: 19, band: 3.5, gap: 4, padX: 5, padTop: 3, padBot: 2.5,
  ruler: 13.5, segGap: 12, ellipsis: 15, topLane: 19, topLane2: 14, lane: 13, rowGap: 6, labelGap: 9,
  /** How far a tray's top and its right end recede, up the floor's diagonal like a base's faces. */
  depth: 8,
  /** A row folded down to a sliver: its records show as bars, without words, and its readers as small carets. */
  thin: { tileH: 3.5, band: 1, padTop: 2.2, padBot: 1.8, ruler: 2.5, rowGap: 4, lane: 2.5 },
};

/** How wide each record tile is for these words: enough for the longest. */
export function tileWidth(texts: string[]): number {
  const most = texts.reduce((n, t) => Math.max(n, t.length), 0);
  return Math.round(Math.min(104, Math.max(44, 14 + most * LOG.mono)));
}
/** A log's name, as wide as it is drawn. */
export const nameWidth = (label: string) => Math.ceil(label.length * LOG.name);
/** How many tiles fit in a strip `budget` wide, keeping room for its name, an ellipsis and the open slot. */
export function capacity(budget: number, tileW: number, labelCol: number, slotW: number, most = 8): number {
  const fixed = (labelCol ? labelCol + LOG.labelGap : 0) + LOG.padX * 2 + LOG.ellipsis + LOG.gap + slotW;
  return Math.max(2, Math.min(most, Math.floor((budget - fixed) / (tileW + LOG.gap))));
}

export type Cell = { kind: "tile" | "ellipsis" | "slot"; x: number; w: number; seg: number; rec?: LogEntry };
/** A tray piece: each segment of the log is its own piece, with a gap between them. */
export type Piece = { x0: number; x1: number; seg: number };
/** A reader's caret, with its name to the right of it (side 1) or the left (side -1), in a lane under the ruler. */
export type Pointer = { id: string; x: number; lane: number; side: 1 | -1; label: string; tone: string; x0: number; x1: number };
/** A watermark: a line just before its record, its name in a lane over the tray, right of the line (side 1) or left. */
export type Line = { id: string; x: number; label: string; tone: string; lane: number; side: 1 | -1 };
/** A bracket over a stretch of records, its name centred over it in a lane over the tray. */
export type Bracket = { id: string; x0: number; x1: number; label: string; tone: string; lane: number };
export type Row = {
  cells: Cell[]; pieces: Piece[]; pointers: Pointer[]; lines: Line[]; brackets: Bracket[];
  /** Records left out before the first tile shown. */
  elided: number;
  /** Where the tray ends, and where anything drawn on the row ends (a cursor's name can run past the tray). */
  width: number; reach: number;
  /** How many lanes the pointer cursors take under the ruler, and the names of watermarks and brackets over the tray. */
  lanes: number; topLanes: number;
};
export type RowOptions = {
  tileW: number; cap: number; slotW: number;
  /** Stretch the last tray piece to at least this. */
  trayW?: number;
  /** A folded row: its records are bars without words, so it needs no ellipsis before them. */
  folded?: boolean;
};

/** The tiles, tray pieces, cursors and brackets of one log, left to right from x = 0. */
export function rowLayout(log: Pick<LogState, "records" | "next" | "seg" | "sorted" | "cursors" | "brackets">, o: RowOptions): Row {
  const recs = log.records, start = Math.max(0, recs.length - o.cap), shown = recs.slice(start);
  const cells: Cell[] = [], pieces: Piece[] = [];
  let x = LOG.padX, x0 = 0, seg = shown.length ? shown[0].seg : log.seg;
  const close = () => { pieces.push({ x0, x1: x - LOG.gap + LOG.padX, seg }); x += LOG.segGap - LOG.gap + LOG.padX * 2; x0 = x - LOG.padX; };
  if (start > 0 && !o.folded) { cells.push({ kind: "ellipsis", x, w: LOG.ellipsis, seg }); x += LOG.ellipsis + LOG.gap; }
  for (const r of shown) {
    if (r.seg !== seg) { close(); seg = r.seg; }
    cells.push({ kind: "tile", x, w: o.tileW, seg: r.seg, rec: r });
    x += o.tileW + LOG.gap;
  }
  // the open end where the next record lands; a sorted log (a memtable) has none, but an empty one keeps a place
  if (!log.sorted || !shown.length) {
    if (log.seg !== seg && cells.length) { close(); }
    seg = log.seg;
    cells.push({ kind: "slot", x, w: o.slotW, seg });
    x += o.slotW + LOG.gap;
  }
  if (!cells.length) x += LOG.gap;
  pieces.push({ x0, x1: Math.max(x - LOG.gap + LOG.padX, o.trayW ?? 0), seg });
  const width = pieces[pieces.length - 1].x1;

  const tiles = cells.filter((c) => c.kind === "tile");
  const first = tiles[0]?.rec?.offset, slot = cells.find((c) => c.kind === "slot"), ell = cells.find((c) => c.kind === "ellipsis");
  /** The cell a cursor at `at` points at: the record with that offset, the open end, or what stands for it when elided. */
  const cellAt = (at: number): Cell | undefined => {
    const exact = tiles.find((c) => c.rec!.offset === at);
    if (exact) return exact;
    if (at >= log.next) return slot ?? tiles[tiles.length - 1];
    if (first !== undefined && at < first) return ell ?? tiles[0];
    return tiles.find((c) => c.rec!.offset >= at) ?? slot;
  };
  const centre = (c: Cell) => c.x + c.w / 2;

  // pointer cursors: a caret under the record, its name beside it, packed into as few lanes as fit; two readers at one
  // record stand side by side
  const found = [...log.cursors].filter((c) => !c.line).map((c) => ({ c, cell: cellAt(c.at) })).filter((p) => p.cell)
    .sort((a, b) => centre(a.cell!) - centre(b.cell!) || (a.c.id < b.c.id ? -1 : 1));
  const placed = found.map(({ c, cell }) => {
    const mates = found.filter((f) => f.cell === cell), i = mates.findIndex((f) => f.c === c);
    return { c, cell: cells.indexOf(cell!), x: centre(cell!) + (i - (mates.length - 1) / 2) * 9, w: pointerWidth(c) };
  });
  const { sides, lanes: laneOf, count } = packPointers(placed);
  const pointers: Pointer[] = placed.map((p, i) => ({
    id: p.c.id, x: p.x, lane: laneOf[i], side: sides[i], label: p.c.label, tone: p.c.tone,
    x0: sides[i] > 0 ? p.x - 4.5 : p.x - 7 - p.w, x1: sides[i] > 0 ? p.x + 7 + p.w : p.x + 4.5,
  }));
  // line cursors: a boundary just before the record; brackets over the records from..to that show. Their names share
  // lanes over the tray.
  const lineAt: { c: LogCursor; x: number }[] = [];
  for (const c of log.cursors) {
    if (!c.line) continue;
    const cell = cellAt(c.at);
    if (cell) lineAt.push({ c, x: cell.x - LOG.gap / 2 });
  }
  const spans: { b: (typeof log.brackets)[number]; x0: number; x1: number }[] = [];
  for (const b of log.brackets) {
    const inside = tiles.filter((c) => c.rec!.offset >= b.from && c.rec!.offset <= b.to);
    const before = recs.some((r, i) => i < start && r.offset >= b.from && r.offset <= b.to);
    const a = before && ell ? ell : inside[0], z = inside[inside.length - 1] ?? (before ? ell : undefined);
    if (a && z) spans.push({ b, x0: a.x, x1: z.x + z.w });
  }
  const top = packTop(lineAt.map((l) => ({ x: l.x, w: l.c.label ? l.c.label.length * LOG.sans : 0 })), spans.map((b) => ({ x0: b.x0, x1: b.x1, w: b.b.label.length * LOG.sans })));
  const lines: Line[] = lineAt.map((l, i) => ({ id: l.c.id, x: l.x, label: l.c.label, tone: l.c.tone, lane: top.lines[i].lane, side: top.lines[i].side }));
  const brackets: Bracket[] = spans.map((b, i) => ({ id: b.b.id, x0: b.x0, x1: b.x1, label: b.b.label, tone: b.b.tone, lane: top.brackets[i] }));
  const reach = Math.max(width, ...pointers.map((p) => p.x1), ...lines.map((l) => (l.side > 0 ? l.x + 4 + l.label.length * LOG.sans : l.x + 2)),
    ...brackets.map((b) => (b.x0 + b.x1) / 2 + (b.label.length * LOG.sans) / 2));
  return { cells, pieces, pointers, lines, brackets, elided: start, width, reach, lanes: count, topLanes: top.count };
}
export const pointerWidth = (c: Pick<LogCursor, "label">) => (c.label ? c.label.length * LOG.sans + 2 : 0);

/** Which side of its caret each cursor's name goes, and in which lane, so the fewest lanes hold them all without
 * names overlapping: names go right where they can, left where a neighbour needs the room, and never left of the
 * tray's start. Carets come sorted left to right; carets at the same cell may touch. */
export function packPointers(list: { x: number; w: number; cell?: number }[]): { sides: (1 | -1)[]; lanes: number[]; count: number } {
  const n = list.length;
  let best: { sides: (1 | -1)[]; lanes: number[]; count: number; score: number } = { sides: [], lanes: [], count: 0, score: Infinity };
  for (let mask = 0; mask < 1 << n; mask++) {
    const sides = list.map((_, i) => ((mask >> i) & 1 ? -1 : 1) as 1 | -1);
    if (list.some((p, i) => sides[i] < 0 && p.x - 7 - p.w < 0)) continue;
    const span = list.map((p, i) => (sides[i] > 0 ? [p.x - 4.5, p.x + 7 + p.w] : [p.x - 7 - p.w, p.x + 4.5]));
    const taken: number[][] = [], lanes: number[] = [];
    span.forEach(([a, b], i) => {
      const clear = (j: number) => { const sep = list[j].cell !== undefined && list[j].cell === list[i].cell ? 0 : 6; return b + sep <= span[j][0] || a >= span[j][1] + sep; };
      let lane = taken.findIndex((l) => l.every(clear));
      if (lane < 0) { lane = taken.length; taken.push([]); }
      taken[lane].push(i);
      lanes.push(lane);
    });
    const score = taken.length * 100 + sides.filter((x) => x < 0).length;
    if (score < best.score) best = { sides, lanes, count: taken.length, score };
  }
  return { sides: best.sides, lanes: best.lanes, count: best.count };
}

/** Lanes over the tray for the names of watermarks (beside their line, right where they can) and brackets (centred
 * over them), so the fewest lanes hold them without overlapping, and no name sits across another watermark's line. */
export function packTop(lines: { x: number; w: number }[], brackets: { x0: number; x1: number; w: number }[]): { lines: { lane: number; side: 1 | -1 }[]; brackets: number[]; count: number } {
  const n = lines.length, items = n + brackets.length;
  if (!items) return { lines: [], brackets: [], count: 0 };
  // what a name covers in its lane: a watermark's name and its line, a bracket's name (its bar lies under every lane)
  const span = (i: number, side: number): [number, number] => {
    if (i >= n) { const b = brackets[i - n], c = (b.x0 + b.x1) / 2; return [c - b.w / 2, c + b.w / 2]; }
    const l = lines[i];
    return side > 0 ? [l.x - 2, l.x + 4 + l.w] : [l.x - 4 - l.w, l.x + 2];
  };
  let best = { lines: [] as { lane: number; side: 1 | -1 }[], brackets: [] as number[], count: items, score: Infinity };
  const lanesMax = Math.min(3, items);
  const combos = lanesMax ** items;
  for (let mask = 0; mask < 1 << n; mask++) {
    const sides = lines.map((_, i) => ((mask >> i) & 1 ? -1 : 1) as 1 | -1);
    if (lines.some((l, i) => sides[i] < 0 && l.x - 4 - l.w < 0)) continue;
    for (let c = 0; c < combos; c++) {
      const lane: number[] = [];
      for (let i = 0, k = c; i < items; i++, k = Math.floor(k / lanesMax)) lane.push(k % lanesMax);
      let ok = true;
      for (let i = 0; i < items && ok; i++) for (let j = i + 1; j < items && ok; j++) {
        if (lane[i] === lane[j]) {
          const a = span(i, sides[i] ?? 1), b = span(j, sides[j] ?? 1);
          if (a[1] + 6 > b[0] && b[1] + 6 > a[0]) ok = false;
        }
        // a watermark's line runs down from its name through every lane under it
        for (const [l, o] of [[i, j], [j, i]]) {
          if (l >= n || lane[o] >= lane[l]) continue;
          const x = lines[l].x, b = span(o, sides[o] ?? 1);
          if (x > b[0] - 3 && x < b[1] + 3) ok = false;
        }
      }
      if (!ok) continue;
      const count = Math.max(...lane) + 1;
      const score = count * 1000 + lane.reduce((a, b) => a + b, 0) * 10 + sides.filter((x) => x < 0).length;
      if (score < best.score) best = { lines: sides.map((side, i) => ({ lane: lane[i], side })), brackets: lane.slice(n), count, score };
    }
  }
  return { lines: best.lines, brackets: best.brackets, count: best.count };
}
/** How tall the lanes over the tray are, for `count` lanes. */
export const topHeight = (count: number) => (count > 0 ? LOG.topLane + (count - 1) * LOG.topLane2 : 0);
/** Where a name in lane `lane` over the tray stands: its baseline, measured up from the tray's top. */
export const topBaseline = (lane: number) => 10.5 + lane * LOG.topLane2;

export type RowMetrics = {
  h: number; trayY: number; tileY: number; tileH: number; band: number; rulerY: number; ruler: number; laneY: number;
  /** How much its words show, 0 to 1. */
  words: number;
};
/** A row's heights: `full` 1 is a full row with its words, 0 a sliver; `top` and `lanes` are the lanes it keeps room
 * for over the tray and under it. */
export function rowMetrics(full: number, top: number, lanes: number): RowMetrics {
  const f = Math.max(0, Math.min(1, full)), mix = (a: number, b: number) => a + (b - a) * f;
  const trayY = topHeight(top) * f;
  const padTop = mix(LOG.thin.padTop, LOG.padTop), tileH = mix(LOG.thin.tileH, LOG.tileH), band = mix(LOG.thin.band, LOG.band);
  const rulerY = trayY + padTop + tileH + band + mix(LOG.thin.padBot, LOG.padBot);
  const ruler = mix(LOG.thin.ruler, LOG.ruler), laneY = rulerY + ruler + 2 * f;
  // a folded row's readers keep a small caret under it, without their names
  const under = lanes ? lanes * LOG.lane * f + LOG.thin.lane * (1 - f) : 0;
  return { h: laneY + under, trayY, tileY: trayY + padTop, tileH, band, rulerY, ruler, laneY, words: Math.max(0, (f - 0.45) / 0.55) };
}
/** How far a row's tray recedes (its top face's depth), and that depth across and up the screen: a folded row's
 * slimmer tray recedes less. */
export function trayDepth(full: number): { d: number; dx: number; dy: number } {
  const d = LOG.depth * (0.35 + 0.65 * Math.max(0, Math.min(1, full)));
  return { d, dx: d * Math.cos(Math.PI / 6), dy: d / 2 };
}
export const rowGap = (full: number) => LOG.thin.rowGap + (LOG.rowGap - LOG.thin.rowGap) * Math.max(0, Math.min(1, full));

/** Rows stacked down the strip, each `h` tall: where each starts and how tall they are together. */
export function stack(rows: { h: number; gap: number }[]): { y: number[]; h: number } {
  const y: number[] = [];
  let at = 0;
  rows.forEach((r, i) => { if (i) at += r.gap; y.push(at); at += r.h; });
  return { y, h: at };
}
