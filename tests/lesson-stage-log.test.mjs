import assert from "node:assert/strict";
import test from "node:test";
import { LOG, capacity, packPointers, packTop, rowGap, rowLayout, rowMetrics, stack, tileWidth, topBaseline, topHeight, trayDepth } from "../src/lib/lesson-stage/log-geometry.ts";

const rec = (offset, text, seg = 0, extra = {}) => ({ offset, text, seg, ...extra });
const log = (records, extra = {}) => ({ records, next: records.length ? records[records.length - 1].offset + 1 : 0, seg: records.length ? records[records.length - 1].seg : 0, sorted: false, cursors: [], brackets: [], ...extra });
const opts = { tileW: 60, cap: 4, slotW: 26 };
const tiles = (row) => row.cells.filter((c) => c.kind === "tile");

test("tiles are as wide as the longest words, within limits", () => {
  assert.equal(tileWidth(["812 paid"]), Math.round(14 + 8 * LOG.mono));
  assert.equal(tileWidth(["a"]), 44);
  assert.equal(tileWidth(["a very long record text"]), 104);
});

test("a strip shows the newest records that fit, with an ellipsis for the rest and the open slot at the end", () => {
  const row = rowLayout(log([1038, 1039, 1040, 1041, 1042, 1043].map((o) => rec(o, `r${o}`))), opts);
  assert.deepEqual(tiles(row).map((c) => c.rec.offset), [1040, 1041, 1042, 1043]);
  assert.equal(row.elided, 2);
  assert.deepEqual(row.cells.map((c) => c.kind), ["ellipsis", "tile", "tile", "tile", "tile", "slot"]);
  // left to right, never overlapping, and the tray wraps them all
  row.cells.slice(1).forEach((c, i) => assert.ok(c.x >= row.cells[i].x + row.cells[i].w + LOG.gap - 0.01));
  const last = row.cells[row.cells.length - 1];
  assert.equal(row.width, last.x + last.w + LOG.padX);
  assert.equal(row.pieces.length, 1);
  // a folded row shows the same records as bars, from the tray's start
  const folded = rowLayout(log([1038, 1039, 1040, 1041, 1042, 1043].map((o) => rec(o, `r${o}`))), { ...opts, folded: true });
  assert.deepEqual(folded.cells.map((c) => c.kind), ["tile", "tile", "tile", "tile", "slot"]);
  assert.equal(folded.cells[0].x, LOG.padX);
  // a short log needs no ellipsis
  const short = rowLayout(log([rec(0, "a"), rec(1, "b")]), opts);
  assert.equal(short.elided, 0);
  assert.deepEqual(short.cells.map((c) => c.kind), ["tile", "tile", "slot"]);
});

test("each segment is its own tray piece, and a rolled log's slot opens a new one", () => {
  const row = rowLayout(log([rec(0, "a", 0), rec(1, "b", 0), rec(2, "c", 1)]), opts);
  assert.deepEqual(row.pieces.map((p) => p.seg), [0, 1]);
  assert.equal(row.pieces[1].x0 - row.pieces[0].x1, LOG.segGap);
  const rolled = rowLayout(log([rec(0, "a", 0)], { seg: 1, next: 1 }), opts);
  assert.deepEqual(rolled.pieces.map((p) => p.seg), [0, 1]);
  assert.equal(rolled.cells[1].kind, "slot");
  assert.ok(rolled.cells[1].x > rolled.pieces[0].x1);
  // a sorted log (a memtable) has no open end, but an empty one keeps an empty place
  assert.ok(!rowLayout(log([rec(0, "a")], { sorted: true }), opts).cells.some((c) => c.kind === "slot"));
  assert.deepEqual(rowLayout(log([], { sorted: true }), opts).cells.map((c) => c.kind), ["slot"]);
});

test("a cursor points at its record, the open end, or the ellipsis when its record is out of view", () => {
  const records = [1038, 1039, 1040, 1041, 1042, 1043].map((o) => rec(o, `r${o}`));
  const cursors = [
    { id: "billing", at: 1042, label: "billing", tone: "", line: false },
    { id: "end", at: 1044, label: "", tone: "", line: false },
    { id: "old", at: 1038, label: "", tone: "", line: false },
  ];
  const row = rowLayout(log(records, { cursors }), opts);
  const centre = (c) => c.x + c.w / 2;
  const at = (id) => row.pointers.find((p) => p.id === id).x;
  assert.equal(at("billing"), centre(tiles(row).find((c) => c.rec.offset === 1042)));
  assert.equal(at("end"), centre(row.cells.find((c) => c.kind === "slot")));
  assert.equal(at("old"), centre(row.cells.find((c) => c.kind === "ellipsis")));
});

test("cursor names share a lane where they fit, the left one turning its name to the left", () => {
  const records = [0, 1, 2, 3].map((o) => rec(o, `r${o}`));
  const near = rowLayout(log(records, { cursors: [
    { id: "billing", at: 2, label: "billing", tone: "", line: false },
    { id: "search", at: 3, label: "search", tone: "work", line: false },
  ] }), { ...opts, tileW: 44 });
  assert.equal(near.lanes, 1);
  assert.deepEqual(near.pointers.map((p) => p.side), [-1, 1]);
  // two readers at the same record stand side by side, names outward
  const same = rowLayout(log(records, { cursors: [
    { id: "billing", at: 3, label: "billing", tone: "", line: false },
    { id: "search", at: 3, label: "search", tone: "", line: false },
  ] }), opts);
  assert.equal(same.lanes, 1);
  assert.ok(same.pointers[0].x < same.pointers[1].x);
  assert.ok(same.pointers[0].x1 <= same.pointers[1].x0 + 0.01);
  // a name never turns left past the tray's start: then it takes a second lane
  assert.deepEqual(packPointers([{ x: 10, w: 40 }, { x: 30, w: 40 }]).lanes, [0, 1]);
});

test("line cursors stand just before their record, and brackets span the records they cover", () => {
  const records = [0, 1, 2, 3].map((o) => rec(o, `r${o}`));
  const row = rowLayout(log(records, {
    cursors: [{ id: "wm", at: 2, label: "watermark", tone: "", line: true }],
    brackets: [{ id: "w", from: 1, to: 2, label: "12:00-12:01", tone: "work" }],
  }), opts);
  const [, b, c] = tiles(row);
  assert.equal(row.lines[0].x, c.x - LOG.gap / 2);
  assert.deepEqual([row.brackets[0].x0, row.brackets[0].x1], [b.x, c.x + c.w]);
});

test("a folded row is a sliver without words, and rows stack with their gaps", () => {
  const full = rowMetrics(1, 1, 2), thin = rowMetrics(0, 1, 2);
  assert.equal(full.words, 1);
  assert.equal(thin.words, 0);
  assert.ok(thin.h < 17 && full.h > 70);
  // a folded row without readers keeps no room for carets
  assert.equal(rowMetrics(0, 0, 0).h, rowMetrics(0, 0, 0).laneY);
  assert.equal(thin.h, thin.laneY + LOG.thin.lane);
  assert.equal(full.laneY + 2 * LOG.lane, full.h);
  assert.equal(full.trayY, topHeight(1));
  assert.equal(rowMetrics(1, 2, 0).trayY, topHeight(2));
  assert.equal(rowMetrics(1, 0, 0).trayY, 0);
  const st = stack([{ h: 40, gap: rowGap(1) }, { h: 10, gap: rowGap(0) }, { h: 40, gap: rowGap(1) }]);
  assert.deepEqual(st.y, [0, 40 + LOG.thin.rowGap, 50 + LOG.thin.rowGap + LOG.rowGap]);
  assert.equal(st.h, 90 + LOG.thin.rowGap + LOG.rowGap);
});

test("a tray recedes up the floor's diagonal, a folded one less", () => {
  const full = trayDepth(1), thin = trayDepth(0);
  assert.equal(full.d, LOG.depth);
  assert.ok(thin.d < full.d / 2 && thin.d > 0);
  // the floor's diagonal: 30 degrees up from the horizontal
  assert.ok(Math.abs(full.dy / full.dx - Math.tan(Math.PI / 6)) < 1e-9);
});

test("a strip's capacity keeps room for its name, the ellipsis and the slot", () => {
  const cap = capacity(330, 65, 15, 26, 5);
  assert.equal(cap, Math.floor((330 - (15 + LOG.labelGap + LOG.padX * 2 + LOG.ellipsis + LOG.gap + 26)) / (65 + LOG.gap)));
  assert.equal(capacity(100, 65, 15, 26), 2);
  assert.equal(capacity(2000, 40, 0, 26), 8);
});

test("a watermark's name and a bracket's name share the lane over the tray when they fit, and take two when not", () => {
  // far apart: one lane, the watermark's name to the right of its line
  const apart = packTop([{ x: 10, w: 40 }], [{ x0: 100, x1: 200, w: 60 }]);
  assert.equal(apart.count, 1);
  assert.deepEqual(apart.lines, [{ lane: 0, side: 1 }]);
  // the bracket's name sits where the watermark's would: the name turns left of its line where there is room
  const turn = packTop([{ x: 100, w: 40 }], [{ x0: 100, x1: 200, w: 60 }]);
  assert.equal(turn.count, 1);
  assert.deepEqual(turn.lines, [{ lane: 0, side: -1 }]);
  // no room on the left and the line runs through the bracket's name: two lanes, the bracket's name over the
  // watermark's, so the line never crosses it
  const stacked = packTop([{ x: 150, w: 120 }], [{ x0: 100, x1: 200, w: 60 }]);
  assert.equal(stacked.count, 2);
  assert.deepEqual([stacked.lines[0].lane, stacked.brackets[0]], [0, 1]);
  assert.equal(topBaseline(1) - topBaseline(0), LOG.topLane2);
});

test("watermarks and brackets in a row get lanes that keep their names apart", () => {
  const records = [0, 1, 2, 3].map((o) => rec(o, `r${o}`));
  const row = rowLayout(log(records, {
    cursors: [{ id: "sync", at: 2, label: "synced", tone: "", line: true }],
    brackets: [{ id: "w", from: 1, to: 2, label: "12:00-12:01", tone: "work" }],
  }), { tileW: 60, cap: 8, slotW: 26 });
  const l = row.lines[0], b = row.brackets[0];
  const lineSpan = l.side > 0 ? [l.x - 2, l.x + 4 + l.label.length * LOG.sans] : [l.x - 4 - l.label.length * LOG.sans, l.x + 2];
  const c = (b.x0 + b.x1) / 2, w = b.label.length * LOG.sans, nameSpan = [c - w / 2, c + w / 2];
  assert.ok(l.lane !== b.lane || lineSpan[1] + 6 <= nameSpan[0] || nameSpan[1] + 6 <= lineSpan[0], "names overlap");
  assert.ok(!(l.lane > b.lane && l.x > nameSpan[0] - 3 && l.x < nameSpan[1] + 3), "the line crosses the bracket's name");
  assert.equal(row.topLanes, Math.max(l.lane, b.lane) + 1);
});
