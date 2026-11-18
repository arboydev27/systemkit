import assert from "node:assert/strict";
import test from "node:test";
import {
  BEAT_PX, MIN_LABEL, RAIL, along, barPaths, headBoxes, inside, labelScale, lanePoint, layoutBox, layoutTimeline, lerp, messageEnds, nowLine,
  pillWidth, placeLabels, restTelling, tellings,
} from "../src/lib/lesson-stage/timeline-geometry.ts";
import { applyEvent, initialModel, stepEvents } from "../src/lib/lesson-stage/model.ts";
import { timelineSpan } from "../src/lib/lesson-stage/figure-model.ts";
import { txLostUpdateStage } from "../src/content/lesson-stage/transactions/tx-lost-update.ts";
import { ROLES } from "../src/lib/lesson-stage/roles.ts";

// The lost-update lesson's lifelines: two payments either side of the wallet's row. A part's height is its pictogram's
// top times the stage's glyph scale (1.42) plus its base (7).
const top = (glyph) => glyph * 1.42 + 7;
const lanes = [
  { id: "a", top: top(26), label: "Payment A", detail: "debits $30", readout: 0 },
  { id: "w", top: top(40), label: "Wallet", detail: "row 7", readout: 0 },
  { id: "b", top: top(26), label: "Payment B", detail: "debits $50", readout: 0 },
];
// the stage's own label scale (engine.ts): full size down to a zoom of 0.62, then easing to 80%
const engineScale = (k) => (k >= 0.35 ? Math.min(1, Math.max(0.8, k / 0.62)) / k : 0.8 / 0.35);
const input = (width, height, narrow, more = {}) => ({ narrow, width, height, lanes, span: 6, beat: 1, pill: 60, ticks: [], unit: "", engine: engineScale, ...more });
// stage sizes: a 1440x900 window, a large one, a small laptop, and two phones
const WIDE = [[652, 484], [900, 620], [580, 400]], PHONES = [[356, 589], [341, 467]];
const pads = (narrow) => (narrow ? { x: 14, top: 76, bottom: 84 } : { x: 40, top: 72, bottom: 84 });
const fitsStage = (g, width, height) => {
  const b = layoutBox(g, g.s, g.se), p = pads(g.narrow);
  return (b.x1 - b.x0) * g.k <= width - 2 * p.x + 1 && (b.y1 - b.y0) * g.k <= height - p.top - p.bottom + 1;
};

test("a wide timeline runs rows top to bottom, each part at the left end of its lifeline, and fits the stage", () => {
  for (const [w, h] of WIDE) {
    const g = layoutTimeline(input(w, h, false));
    assert.ok(g.cross.a < g.cross.w && g.cross.w < g.cross.b, "rows in lifeline order");
    for (const l of lanes) {
      assert.equal(g.heads[l.id].y, g.cross[l.id], "a head stands on its own row");
      assert.ok(g.heads[l.id].x < g.origin, "time starts right of every head");
      assert.equal(g.railStart[l.id], g.heads[l.id].x, "a rail starts under its head");
    }
    assert.ok(fitsStage(g, w, h), `fits a ${w}x${h} stage`);
    assert.ok(g.k >= 0.42, "parts stay a readable size");
  }
  // where there is room, a beat leaves its message label room
  for (const [w, h] of WIDE.slice(0, 2)) assert.ok(layoutTimeline(input(w, h, false)).beatPx >= BEAT_PX.wide);
});

test("a phone timeline runs columns left to right with time running down, and fits the stage", () => {
  for (const [w, h] of PHONES) {
    const g = layoutTimeline(input(w, h, true));
    assert.ok(g.cross.a < g.cross.w && g.cross.w < g.cross.b, "columns in lifeline order");
    for (const l of lanes) {
      assert.equal(g.heads[l.id].x, g.cross[l.id]);
      assert.ok(g.heads[l.id].y < g.origin, "time starts under every head");
    }
    assert.ok(fitsStage(g, w, h), `fits a ${w}x${h} stage`);
    assert.ok(g.beatPx >= BEAT_PX.narrow, `a beat has ${g.beatPx.toFixed(1)}px on a ${w}x${h} phone`);
    // neighbouring heads and their name tags never overlap
    const boxes = headBoxes(g, g.se);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (Math.floor(i / 2) === Math.floor(j / 2)) continue;
      const a = boxes[i], b = boxes[j];
      assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `heads ${i >> 1} and ${j >> 1} overlap`);
    }
  }
});

test("a phone-width stage that is short rather than tall runs time across, as a wide one does", () => {
  for (const [w, h] of PHONES) assert.equal(layoutTimeline(input(w, h, true)).across, false, `${w}x${h} runs time down`);
  const g = layoutTimeline(input(544, 398, true));
  assert.equal(g.across, true);
  assert.ok(g.heads.a.y < g.heads.w.y && g.heads.w.y < g.heads.b.y, "lifelines as rows");
  assert.ok(fitsStage(g, 544, 398) && g.beatPx >= BEAT_PX.wide);
});

test("six lifelines still fit a small phone, heads staggering if they must", () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, top: top(40), label: `Node ${i + 1}`, detail: "", readout: 0 }));
  const g = layoutTimeline({ ...input(341, 467, true), lanes: six });
  assert.ok(fitsStage(g, 341, 467));
  const boxes = headBoxes(g, g.se);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (Math.floor(i / 2) === Math.floor(j / 2)) continue;
    const a = boxes[i], b = boxes[j];
    assert.ok(a.x1 <= b.x0 + 0.5 || b.x1 <= a.x0 + 0.5 || a.y1 <= b.y0 + 0.5 || b.y1 <= a.y0 + 0.5, `heads ${i >> 1} and ${j >> 1} overlap`);
  }
});

test("labels never shrink below 10px of text, and follow the stage's own scale above that", () => {
  for (let k = 0.3; k <= 1.3; k += 0.05) {
    assert.ok(labelScale(k, engineScale(k)) * k >= MIN_LABEL - 1e-9, `at zoom ${k.toFixed(2)}`);
    assert.ok(labelScale(k, engineScale(k)) >= engineScale(k));
  }
  assert.equal(labelScale(1, engineScale(1)), 1);
});

test("time maps onto the lifelines with one fixed scale", () => {
  const g = layoutTimeline(input(652, 484, false));
  assert.equal(along(g, 0), g.origin);
  assert.ok(Math.abs(along(g, g.span) - (g.origin + g.length)) < 1e-9);
  assert.ok(g.railEnd > g.origin + g.length);
  const p = lanePoint(g, "w", 3);
  assert.deepEqual(p, { x: along(g, 3), y: g.cross.w - RAIL.h });
  const n = layoutTimeline(input(356, 589, true));
  assert.deepEqual(lanePoint(n, "b", 2), { x: n.cross.b, y: along(n, 2) - RAIL.h });
});

test("a rail lies flat: its far end rounds like a floor circle, and its side shows below its top", () => {
  const wide = barPaths(true, 0, 100, 0, 10, 4);
  const nums = (d) => d.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = nums(wide.top).filter((_, i) => i % 2 === 0), ys = nums(wide.top).filter((_, i) => i % 2 === 1);
  assert.ok(Math.abs(Math.max(...xs) - (100 + 0.866 * 10)) < 0.05, "a wide rail's end cap reaches 0.87w past its end");
  assert.equal(Math.min(...xs), 0, "its near end is square, hidden under the part");
  assert.ok(Math.abs(Math.min(...ys) - -9) < 0.05 && Math.abs(Math.max(...ys) - 1) < 0.05, "its top face stands h above the floor");
  assert.ok(Math.max(...nums(wide.side).filter((_, i) => i % 2 === 1)) > Math.max(...ys), "its side shows below the top face");
  const phone = barPaths(false, 0, 100, 0, 10, 4);
  const py = nums(phone.top).filter((_, i) => i % 2 === 1);
  assert.ok(Math.abs(Math.max(...py) - (100 + 0.2887 * 10 - 4)) < 0.05, "a phone rail's end cap is only 0.29w deep");
});

test("labels rest clear of each other, and adding one never moves those before it", () => {
  const g = layoutTimeline(input(652, 484, false));
  const msg = (key, from, to, t0, t1, w = 60) => ({ kind: "message", key, a: lanePoint(g, from, t0), b: lanePoint(g, to, t1), w });
  // both payments read at once, from either side of the wallet, and the wallet answers both
  const specs = [msg("ra", "a", "w", 0, 1), msg("rb", "b", "w", 0, 1), msg("ya", "w", "a", 1, 2, 40), msg("yb", "w", "b", 1, 2, 40)];
  const mark = { kind: "mark", key: "k", at: lanePoint(g, "w", 1), w: 80, lane: 1 };
  const one = placeLabels(g, specs, g.s, g.se), two = placeLabels(g, [...specs, mark], g.s, g.se);
  for (const s of specs) assert.deepEqual(one.get(s.key), two.get(s.key), `${s.key} stays put`);
  const boxes = [...two.values()].map((r) => r.box);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `labels ${i} and ${j} overlap`);
  }
  assert.deepEqual(placeLabels(g, [...specs, mark], g.s, g.se), two, "the same items rest in the same places");
});

test("a mark's flag keeps off the lines arriving at its dot", () => {
  for (const [w, h, narrow] of [[652, 484, false], [356, 589, true], [341, 467, true]]) {
    const g = layoutTimeline(input(w, h, narrow));
    const msg = (key, from) => ({ kind: "message", key, a: lanePoint(g, from, 0), b: lanePoint(g, "w", 1), w: 92 });
    const specs = [msg("ra", "a"), msg("rb", "b"), { kind: "mark", key: "k", at: lanePoint(g, "w", 1), w: 76, lane: 1 }];
    const flag = placeLabels(g, specs, g.s, g.se).get("k");
    for (const s of specs.slice(0, 2)) assert.equal(inside(flag.box, s.a, s.b), 0, `the flag covers ${s.key}'s line on ${w}x${h}`);
  }
});

test("a message's label rests on its line, at the middle when it can", () => {
  const g = layoutTimeline(input(652, 484, false));
  const a = lanePoint(g, "a", 0), b = lanePoint(g, "w", 1);
  const r = placeLabels(g, [{ kind: "message", key: "m", a, b, w: 60 }], g.s, g.se).get("m");
  assert.equal(r.f, 0.5);
  assert.deepEqual(r.at, lerp(a, b, 0.5));
});

test("a label keeps off the lines still to come in its telling", () => {
  const g = layoutTimeline(input(652, 484, false));
  // A holds a lock from t = 1, and later sends its commit down across the place under its rail where the label would go
  const span = { kind: "span", key: "lock", at: lanePoint(g, "a", 1), w: 90, lane: 0 };
  const commit = { key: "commit", a: lanePoint(g, "a", 1.4), b: lanePoint(g, "w", 2.4) };
  const now = placeLabels(g, [span], g.s, g.se).get("lock");
  assert.ok(inside(now.box, commit.a, commit.b) > 0, "with nothing ahead it rests under the rail, where the commit will run");
  const told = placeLabels(g, [span], g.s, g.se, [commit]).get("lock");
  assert.equal(inside(told.box, commit.a, commit.b), 0, "told what is coming, it rests clear of it");
  assert.ok(told.at.y < g.cross.a, "over the rail instead");
});

test("on a phone a mark's flag hangs under its dot rather than lie across a neighbour's lifeline", () => {
  const g = layoutTimeline(input(356, 589, true));
  // the last lifeline's dot, with a reply arriving at it from the wallet: beside it on the left the flag would cover the
  // reply or lie across the wallet's lifeline, and on the right it would leave the stage
  const reply = { key: "in", a: lanePoint(g, "w", 1), b: lanePoint(g, "b", 2) };
  const at = lanePoint(g, "b", 2);
  const specs = [{ kind: "message", key: "in", a: reply.a, b: reply.b, w: 60 }, { kind: "mark", key: "k", at, w: 110, lane: 2 }];
  const flag = placeLabels(g, specs, g.s, g.se).get("k");
  assert.equal(inside(flag.box, reply.a, reply.b), 0, "the flag covers the reply");
  assert.ok(flag.box.x0 > g.cross.w + RAIL.w / 2, "it keeps off the wallet's lifeline");
  assert.ok(flag.box.x0 < at.x && at.x < flag.box.x1 && flag.stem.x === at.x, "it hangs on its own lifeline");
  assert.ok(flag.at.y > at.y, "under its dot");
});

test("the lost-update lesson's labels rest clear of each other, its lines and its parts, on every stage", () => {
  const scene = txLostUpdateStage;
  const key = (it) => `${it.kind}|${it.id}`;
  // each telling of the story: what is drawn just before each rewind, and at the end
  const told = tellings(scene, key);
  assert.equal(told.length, 3, "told three times: the race, the atomic update, compare-and-set");
  const glyph = Object.fromEntries(Object.entries(ROLES).map(([role, info]) => [role, info.top]));
  const parts = [...scene.nodes].sort((a, b) => a.at[0] - b.at[0]).map((n) => ({ id: n.id, top: top(glyph[n.role]), label: n.label, detail: n.detail ?? "", readout: 0 }));
  const packets = scene.steps.flatMap((st) => st.events).filter((e) => e.type === "packet");
  const widths = packets.map((e) => pillWidth(e.label, (e.kind ?? "request") !== "request")).sort((a, b) => a - b);
  const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.5 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.5;
  for (const [w, h] of [...WIDE, ...PHONES, [652, 400]]) {
    const g = layoutTimeline({ narrow: w < 560, width: w, height: h, lanes: parts, span: timelineSpan(scene), beat: 1, pill: widths[widths.length >> 1], ticks: [], unit: "", engine: engineScale });
    const frame = layoutBox(g, g.s, g.se), heads = headBoxes(g, g.se);
    for (const { items, nows } of told) {
      const rests = restTelling(g, items, key, nows), boxes = [...rests.values()].map((r) => r.box);
      const lines = items.filter((it) => it.kind === "message").map((it) => ({ key: key(it), ...messageEnds(g, it) }));
      for (const [k, r] of rests) {
        const where = `${k} on a ${w}x${h} stage`;
        assert.ok(!r.hidden, `${where} is hidden`);
        // a line may pass close by a label (through the room it keeps from other labels), never under it
        const own = { x0: r.box.x0 + 2 * g.s, y0: r.box.y0 + 2 * g.s, x1: r.box.x1 - 2 * g.s, y1: r.box.y1 - 2 * g.s };
        for (const l of lines) if (l.key !== k) assert.equal(inside(own, l.a, l.b), 0, `${where} covers ${l.key}`);
        for (const b of boxes) if (b !== r.box) assert.ok(!overlap(r.box, b), `${where} overlaps another label`);
        for (const b of heads) assert.ok(!overlap(r.box, b), `${where} overlaps a part`);
        assert.ok(r.box.x0 >= frame.x0 - 0.5 && r.box.x1 <= frame.x1 + 0.5 && r.box.y0 >= frame.y0 - 0.5 && r.box.y1 <= frame.y1 + 0.5, `${where} leaves the frame`);
      }
    }
  }
});

test("the lost-update lesson's flags hang on straight stems, its span labels stay by their sleeves, and no pill hides now", () => {
  const scene = txLostUpdateStage;
  const key = (it) => `${it.kind}|${it.id}`;
  const glyph = Object.fromEntries(Object.entries(ROLES).map(([role, info]) => [role, info.top]));
  const parts = [...scene.nodes].sort((a, b) => a.at[0] - b.at[0]).map((n) => ({ id: n.id, top: top(glyph[n.role]), label: n.label, detail: n.detail ?? "", readout: 0 }));
  // the stages a 1440x900 window and the two phones give this lesson
  for (const [w, h] of [[672, 498], [356, 588.8], [341, 464.89]]) {
    const g = layoutTimeline({ narrow: w < 560, width: w, height: h, lanes: parts, span: timelineSpan(scene), beat: 1, pill: 79, ticks: [], unit: "", engine: engineScale });
    for (const { items, nows } of tellings(scene, key)) {
      const rests = restTelling(g, items, key, nows);
      items.forEach((it, seq) => {
        const r = rests.get(key(it)), where = `${key(it)} on a ${w}x${h} stage`;
        if (!r) return;
        if (it.kind === "mark" && r.stem) {
          const dot = lanePoint(g, it.node, it.t);
          assert.ok(Math.abs(r.stem.x - dot.x) < 1e-6 || Math.abs(r.stem.y - dot.y) < 1e-6, `${where} hangs on a slanted stem`);
        }
        if (it.kind === "span") {
          // beside its sleeve's start, never a line or more away from it
          const start = lanePoint(g, it.node, it.t0);
          assert.ok(Math.abs(r.at.y - start.y) <= 26 * g.s && Math.abs(r.at.x - start.x) <= 160 * g.s, `${where} rests away from its sleeve`);
        }
        // the caret at the top (or left) of the now line, wherever a step leaves it once this label is there
        const own = { x0: r.box.x0 + 3 * g.s, y0: r.box.y0 + 3 * g.s, x1: r.box.x1 - 3 * g.s, y1: r.box.y1 - 3 * g.s };
        for (const n of nows) if (seq < n.seen) {
          const { a, b } = nowLine(g, n.t, g.s), tip = lerp(a, b, (8 * g.s) / Math.hypot(b.x - a.x, b.y - a.y));
          assert.equal(inside(own, a, tip), 0, `${where} hides the now caret at ${n.t}`);
        }
      });
    }
  }
});

test("placing a telling at once never leaves a label worse off than placing it label by label", () => {
  const g = layoutTimeline(input(580, 400, false));
  // two messages and a mark crowding the wallet's dot: label by label, the first pill takes the place the flag needs
  const msg = (key, from, to, t0, t1, w) => ({ kind: "message", key, a: lanePoint(g, from, t0), b: lanePoint(g, to, t1), w });
  const specs = [msg("ra", "a", "w", 0, 1, 92), msg("rb", "b", "w", 0, 1, 92), { kind: "mark", key: "k", at: lanePoint(g, "w", 1), w: 76, lane: 1 }];
  const lines = specs.slice(0, 2).map(({ key, a, b }) => ({ key, a, b }));
  const cover = (rests) => {
    let c = 0;
    const list = [...rests.values()];
    for (const r of list) for (const o of list) if (o !== r) c += Math.max(0, Math.min(r.box.x1, o.box.x1) - Math.max(r.box.x0, o.box.x0)) * Math.max(0, Math.min(r.box.y1, o.box.y1) - Math.max(r.box.y0, o.box.y0));
    for (const r of list) for (const l of lines) if (l.key !== r.key) c += inside(r.box, l.a, l.b);
    return c;
  };
  const greedy = placeLabels(g, specs, g.s, g.se, lines), refined = placeLabels(g, specs, g.s, g.se, lines, 4);
  assert.ok(cover(refined) <= cover(greedy));
  assert.deepEqual(placeLabels(g, specs, g.s, g.se, lines, 4), refined, "the same every time");
});

test("a pill repeated by a burst of messages stays hidden when it cannot find room, and the first speaks for all", () => {
  const five = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, top: top(40), label: `Node ${i + 1}`, detail: "", readout: 0 }));
  const g = layoutTimeline({ ...input(341, 467, true), lanes: five, span: 8 });
  // the leader sends the same entry to every follower at once, and two of them answer at once
  const items = [1, 2, 3, 4].map((i) => ({ kind: "message", id: `m${i}`, from: "n0", to: `n${i}`, t0: 1, t1: 2, label: "append", flow: "request", lost: false }))
    .concat([1, 2].map((i) => ({ kind: "message", id: `r${i}`, from: `n${i}`, to: "n0", t0: 2, t1: 3, label: "ok", flow: "response", lost: false })));
  const rests = restTelling(g, items, (it) => it.id);
  assert.ok(!rests.get("m1").hidden && !rests.get("r1").hidden, "the first of each says it");
  const shown = [...rests.values()].filter((r) => !r.hidden).map((r) => r.box);
  assert.ok(shown.length < items.length, "some repeats stay hidden");
  for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
    const a = shown[i], b = shown[j];
    assert.ok(a.x1 <= b.x0 + 0.5 || b.x1 <= a.x0 + 0.5 || a.y1 <= b.y0 + 0.5 || b.y1 <= a.y0 + 0.5, "the pills that show never overlap");
  }
});

test("the time axis, its unit included, keeps inside the frame on a phone", () => {
  const g = layoutTimeline(input(341, 467, true, { ticks: [0, 10, 20, 30, 40], unit: "ms", span: 40, beat: 5 }));
  assert.ok(fitsStage(g, 341, 467));
  const box = layoutBox(g, g.s, g.se), first = g.cross.a;
  // "40 ms" is printed right-aligned just left of the first lifeline
  assert.ok(first - RAIL.w / 2 - "40 ms".length * 6.3 * g.s >= box.x0, "the last time and its unit fit");
});
