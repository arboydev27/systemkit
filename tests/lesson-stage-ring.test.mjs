import assert from "node:assert/strict";
import test from "node:test";
import {
  ISO, arcLength, beyond, boxAt, boxMeetsHull, changedRuns, clockwise, hugInside, hull, onRing, outward, overlap, pick, segmentBoxes, shownStretch, standOff, standOffNear, stretch, toneOf, walkStops,
} from "../src/lib/lesson-stage/ring-geometry.ts";

const disc = { rx: 160, ry: 160 * ISO };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("position 0 is the back of the ring and positions run clockwise on screen", () => {
  const top = onRing(disc, 100, 0), right = onRing(disc, 100, 25), front = onRing(disc, 100, 50), left = onRing(disc, 100, 75);
  near(top.x, 0); near(top.y, -disc.ry);
  near(right.x, disc.rx); near(right.y, 0);
  near(front.x, 0); near(front.y, disc.ry);
  near(left.x, -disc.rx); near(left.y, 0);
  // a whole lap comes back to the same place
  near(onRing(disc, 100, 120).x, onRing(disc, 100, 20).x);
  const u = outward(disc, 100, 25);
  near(u.x, 1); near(u.y, 0);
});

test("a floor circle is squashed to the stage's isometric depth", () => {
  near(disc.ry / disc.rx, Math.tan(Math.PI / 6));
});

test("clockwise distances and marked stretches wrap past the top", () => {
  assert.equal(clockwise(100, 91, 20), 29);
  assert.equal(clockwise(100, 20, 20), 0);
  assert.deepEqual(stretch(100, 20, 35), [20, 35]);
  assert.deepEqual(stretch(100, 80, 20), [80, 120]);
  assert.deepEqual(stretch(100, 10, 10), [10, 110]);
});

test("a stretch too short to see is drawn wider round its middle, a longer one as it is", () => {
  // a mark at the token at 50: (49, 50] shows as 48-51
  assert.deepEqual(shownStretch(100, 49, 50, 3), [48, 51]);
  assert.deepEqual(shownStretch(100, 20, 35, 3), [20, 35]);
  assert.deepEqual(shownStretch(100, 99, 0, 3), [98, 101]);
});

test("a label keeps off a line, not off the line's whole box", () => {
  const line = segmentBoxes({ x: 0, y: 0 }, { x: 100, y: 100 }, 5, 2);
  // a label on the line is taken; one in the empty corner of the line's box is not
  assert.ok(line.some((b) => overlap(boxAt({ x: 50, y: 50 }, 8, 6), b) > 0));
  assert.ok(!line.some((b) => overlap(boxAt({ x: 80, y: 20 }, 8, 6), b) > 0));
  assert.equal(pick([boxAt({ x: 50, y: 50 }, 8, 6), boxAt({ x: 80, y: 20 }, 8, 6)], line), 1);
});

test("the stretches that change owner are found, including one across the top", () => {
  const owner = (tokens) => (p) => (tokens.find((t) => t.at >= p) ?? tokens[0]).node;
  const abc = [{ node: "a", at: 20 }, { node: "b", at: 50 }, { node: "c", at: 80 }];
  // D joins at 35: it takes 21-35 from B
  assert.deepEqual(changedRuns(100, owner(abc), owner([abc[0], { node: "d", at: 35 }, abc[1], abc[2]])), [[20, 35]]);
  // C leaves: 51-80 go on to A
  assert.deepEqual(changedRuns(100, owner(abc), owner([abc[0], abc[1]])), [[50, 80]]);
  // A leaves: 81-20 go on to B, a stretch across the top
  assert.deepEqual(changedRuns(100, owner(abc), owner([abc[1], abc[2]])), [[80, 120]]);
  assert.deepEqual(changedRuns(100, owner(abc), owner(abc)), []);
  // two tokens join at once: two stretches
  const two = changedRuns(100, owner(abc), owner([{ node: "d", at: 10 }, abc[0], abc[1], { node: "e", at: 65 }, abc[2]]));
  assert.deepEqual(two, [[50, 65], [80, 110]]);
});

test("a walk meets tokens clockwise, skipping parts already chosen", () => {
  const tokens = [{ id: "A1", node: "a", at: 10 }, { id: "A2", node: "a", at: 20 }, { id: "B1", node: "b", at: 30 }, { id: "C1", node: "c", at: 50 }];
  const plain = walkStops(tokens, 100, 5, 3);
  assert.deepEqual(plain.map((s) => [s.token.id, s.chosen]), [["A1", 1], ["A2", 2], ["B1", 3]]);
  const distinct = walkStops(tokens, 100, 5, 3, true);
  assert.deepEqual(distinct.map((s) => [s.token.id, s.chosen]), [["A1", 1], ["A2", 0], ["B1", 2], ["C1", 3]]);
  // from past the last token it wraps, and positions stay continuous
  const wrap = walkStops(tokens, 100, 60, 2, true);
  assert.deepEqual(wrap.map((s) => [s.token.id, s.at, s.chosen]), [["A1", 110, 1], ["A2", 120, 0], ["B1", 130, 2]]);
  // a token exactly at the start is met first
  assert.equal(walkStops(tokens, 100, 30, 1)[0].token.id, "B1");
});

test("labels take the first clear place, or the least covered one", () => {
  const taken = [{ x0: 0, y0: 0, x1: 10, y1: 10 }];
  assert.equal(pick([{ x0: 5, y0: 5, x1: 15, y1: 15 }, { x0: 20, y0: 0, x1: 30, y1: 10 }], taken), 1);
  assert.equal(pick([{ x0: 5, y0: 5, x1: 15, y1: 15 }, { x0: 1, y0: 1, x1: 9, y1: 9 }], taken), 0);
  assert.equal(pick([{ x0: 5, y0: 5, x1: 15, y1: 15 }], taken, true), -1);
  const c = beyond({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, 5, 2);
  assert.deepEqual(c, { x: 12, y: 0 });
});

test("a part stands clear of the ring and of everything the ring keeps out", () => {
  const ring = hull(Array.from({ length: 48 }, (_, i) => onRing(disc, 100, (i / 48) * 100, 1.1)));
  const part = { x0: -50, y0: -60, x1: 50, y1: 70 };
  for (const pos of [0, 20, 35, 50, 80]) {
    const at = standOff(disc, 100, pos, ring, part, 8);
    assert.ok(!boxMeetsHull({ x0: at.x + part.x0, y0: at.y + part.y0, x1: at.x + part.x1, y1: at.y + part.y1 }, ring), `clear at ${pos}`);
    // and it stays on its position's side of the ring
    const rim = onRing(disc, 100, pos);
    assert.ok(at.x * rim.x + at.y * rim.y > 0);
  }
  // a part in front stands further out than the rim's depth, since it is tall
  assert.ok(standOff(disc, 100, 50, ring, part, 8).y > disc.ry * 1.1 + 60);
  assert.ok(arcLength(disc, 100, 0, 100, 1) > 2 * Math.PI * disc.ry);
});

test("a part whose ray is taken turns a little instead of sliding far past the other part", () => {
  const ring = hull(Array.from({ length: 48 }, (_, i) => onRing(disc, 100, (i / 48) * 100, 1.1)));
  const part = { x0: -50, y0: -60, x1: 50, y1: 70 };
  const boxOf = (at) => ({ x0: at.x + part.x0, y0: at.y + part.y0, x1: at.x + part.x1, y1: at.y + part.y1 });
  // nothing in the way: the same place as standing off along the ray
  assert.deepEqual(standOffNear(disc, 100, 35, ring, part, 12), standOff(disc, 100, 35, ring, part, 12));
  // a part already standing by a neighbouring position, in the way of its ray
  const taken = [boxOf(standOff(disc, 100, 28, ring, part, 12))];
  const straight = standOff(disc, 100, 35, ring, part, 12, taken), near = standOffNear(disc, 100, 35, ring, part, 12, taken);
  const rim = onRing(disc, 100, 35), dist = (p) => Math.hypot(p.x - rim.x, p.y - rim.y);
  assert.ok(dist(near) < dist(straight) * 0.75);
  assert.ok(!boxMeetsHull(boxOf(near), ring));
  assert.equal(overlap(boxOf(near), taken[0]), 0);
  // and it stays on its position's side of the ring
  assert.ok(near.x * rim.x + near.y * rim.y > 0);
});

test("neighbouring parts' arcs never share a tone", () => {
  const tones = toneOf(["a", "b", "c", "d"], [["a", "d"], ["d", "b"], ["b", "c"], ["c", "a"], ["a", "b"]]);
  assert.notEqual(tones.a, tones.d);
  assert.notEqual(tones.d, tones.b);
  assert.notEqual(tones.b, tones.c);
  assert.notEqual(tones.c, tones.a);
  assert.notEqual(tones.a, tones.b);
});

test("a label hugs the groove's inner edge as near its stretch as it fits", () => {
  const a = 100, b = 60, hw = 30, hh = 10;
  const inside = (c) => [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].every(([dx, dy]) => ((c.x + dx) / a) ** 2 + ((c.y + dy) / b) ** 2 <= 1 + 1e-9);
  const right = hugInside(a, b, hw, hh, [{ x: 100, y: 0 }], 40);
  assert.ok(right.length > 6);
  for (const c of right) assert.ok(inside(c), `${c.x},${c.y} inside`);
  // nearest first: the first one is on the right, against the side, at the stretch's height
  assert.ok(right[0].x > 0 && Math.abs(right[0].y) < hh + 1e-9);
  near(right[0].x + hw, a * Math.sqrt(1 - ((Math.abs(right[0].y) + hh) / b) ** 2));
  // a stretch at the front: the nearest sits against the bottom
  const front = hugInside(a, b, hw, hh, [{ x: 0, y: 60 }], 3);
  assert.ok(front[0].y > 0 && Math.abs(front[0].x) < hw);
  // a box too big for the ellipse has nowhere to go
  assert.deepEqual(hugInside(a, b, 120, 10, [{ x: 0, y: 0 }], 5), []);
});
