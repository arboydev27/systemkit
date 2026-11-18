import assert from "node:assert/strict";
import test from "node:test";
import { ISO_C, isFront, routeLinks, routeProblems, rounded } from "../src/lib/lesson-stage/routing.ts";

// Parts laid out as the stage lays them out on a wide screen at full size: tiers 226 apart, lanes down the floor.
const place = (t, l) => ({ x: t * 226 + l * 64, y: l * 104 });
function part(id, at, { top = 70, tag = 110, pill } = {}) {
  return { id, at, top, tag: { x0: at.x - tag / 2, y0: at.y + 25, x1: at.x + tag / 2, y1: at.y + 61 }, pill };
}
const wide = { narrow: false, gap: 8 };
const len = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
/** The screen direction of each run, as a unit vector. */
const runs = (pts) => pts.slice(1).map((q, i) => { const p = pts[i], l = len(p, q); return { x: (q.x - p.x) / l, y: (q.y - p.y) / l, l }; });

test("links lie on the floor: every run follows one of the floor's axes", () => {
  const nodes = [part("a", place(0, 0)), part("b", place(1, 0)), part("c", place(2, -1)), part("d", place(2, 1))];
  const links = [{ id: 0, a: "a", b: "b" }, { id: 1, a: "b", b: "c" }, { id: 2, a: "b", b: "d" }];
  for (const r of routeLinks(nodes, links, wide)) {
    for (const d of runs(r.pts)) {
      if (d.l < 0.5) continue;
      assert.ok(Math.abs(Math.abs(d.x) - ISO_C) < 1e-6 && Math.abs(Math.abs(d.y) - 0.5) < 1e-6, `${r.a}>${r.b} runs off the floor's axes`);
    }
  }
});

test("two parts side by side link front to front, through a port on each base", () => {
  const [r] = routeLinks([part("a", place(0, 0)), part("b", place(1, 0))], [{ id: 0, a: "a", b: "b" }], wide);
  assert.equal(r.from, "R");
  assert.equal(r.to, "L");
  assert.ok(isFront(r.from) && isFront(r.to));
  // and it keeps clear of both tags
  assert.deepEqual(routeProblems([part("a", place(0, 0)), part("b", place(1, 0))], [r]), []);
});

test("links that leave the same face fan out a gap apart instead of sharing a line", () => {
  const nodes = [part("lb", place(0, 0)), part("a", place(1.3, 0)), part("b", place(1.3, 1)), part("c", place(1.3, 2))];
  const links = ["a", "b", "c"].map((id, i) => ({ id: i, a: "lb", b: id }));
  const routes = routeLinks(nodes, links, wide);
  const fromR = routes.filter((r) => r.from === "R");
  assert.ok(fromR.length >= 2, "several links leave the load balancer's front");
  for (let i = 0; i < fromR.length; i++) for (let j = i + 1; j < fromR.length; j++) {
    const p = fromR[i].pts[0], q = fromR[j].pts[0];
    // parallel runs along the floor's x axis: how far apart they are across it
    const apart = Math.abs((q.x - p.x) * 0.5 - (q.y - p.y) * ISO_C);
    assert.ok(apart > 6, `ports ${apart.toFixed(1)} apart`);
  }
  // and fanning out in order, they never cross each other
  assert.equal(routes.reduce((n, r) => n + r.under.length, 0), 0);
});

test("where two links cross, one of them breaks to pass under the other", () => {
  const nodes = [part("a", place(0, -1)), part("b", place(0, 1)), part("c", place(1.4, -1)), part("d", place(1.4, 1))];
  const routes = routeLinks(nodes, [{ id: 0, a: "a", b: "d" }, { id: 1, a: "b", b: "c" }], wide);
  const under = routes.flatMap((r) => r.under);
  assert.equal(under.length, 1);
  assert.equal(routes[0].under.length, 0, "the link listed first goes over");
  // a link out of the step's focus passes under one in focus, whatever the order
  const quiet = routeLinks(nodes, [{ id: 0, a: "a", b: "d", quiet: true }, { id: 1, a: "b", b: "c" }], wide);
  assert.equal(quiet[0].under.length, 1);
});

test("a link to a part in front of one carrying a log leaves from the face on that part's side instead of wrapping around its tag", () => {
  // two parts of one tier, the second down the floor's diagonal, the first with a log's strips beside it: however wide
  // the tags (zoomed out they grow next to their ports) and whichever way the link is listed, it runs from the first
  // part's right face
  for (const tag of [96, 110, 134, 160]) for (const lane of [1.3, 1.65, 2.2]) {
    const strip = { x0: place(1, 0).x + 60, y0: place(1, 0).y - 120, x1: place(1, 0).x + 400, y1: place(1, 0).y - 40 };
    const a = { ...part("a", place(1, 0), { tag }), more: [strip] }, b = part("b", place(1, lane), { tag });
    const [ab] = routeLinks([a, b], [{ id: 0, a: "a", b: "b" }], wide);
    const [ba] = routeLinks([a, b], [{ id: 0, a: "b", b: "a" }], wide);
    assert.equal(ab.from, "R", `tag ${tag}, lane ${lane}: ${ab.shape}`);
    assert.equal(ba.to, "R", `tag ${tag}, lane ${lane}: ${ba.shape}`);
  }
});

test("a link goes around a part in its way rather than behind it or its tag", () => {
  const nodes = [part("a", place(0, 0)), part("mid", place(1, 0)), part("b", place(2, 0))];
  const [r] = routeLinks(nodes, [{ id: 0, a: "a", b: "b" }], wide);
  assert.deepEqual(routeProblems(nodes, [r]), []);
});

test("on a phone a tier hangs under the one before: a link leaves from under the tag and comes in from behind", () => {
  const phone = { narrow: true, gap: 8 };
  const p = (row, lane) => ({ x: lane * 160, y: row * 230 });
  const nodes = [part("lb", p(0, 0), { tag: 120 }), part("l", p(1, -1)), part("m", p(1, 0)), part("r", p(1, 1))];
  const routes = routeLinks(nodes, ["l", "m", "r"].map((id, i) => ({ id: i, a: "lb", b: id })), phone);
  for (const r of routes) {
    assert.equal(r.from, "BOT");
    assert.ok(!isFront(r.to), `${r.b} is reached from behind`);
    for (const d of runs(r.pts)) {
      if (d.l < 0.5) continue;
      const iso = Math.abs(Math.abs(d.x) - ISO_C) < 1e-6, down = Math.abs(d.x) < 1e-6;
      assert.ok(iso || down, "runs along the floor's axes or straight down");
    }
  }
  assert.deepEqual(routeProblems(nodes, routes), []);
  assert.equal(routes.reduce((n, r) => n + r.under.length, 0), 0);
});

test("a link keeps the shape it was given while its parts move", () => {
  const nodes = [part("a", place(0, 0)), part("b", place(1, 0))];
  const [first] = routeLinks(nodes, [{ id: 0, a: "a", b: "b" }], wide);
  const moved = [nodes[0], part("b", place(1.1, -0.4))];
  const [kept] = routeLinks(moved, [{ id: 0, a: "a", b: "b" }], { ...wide, force: new Map([[0, first.shape]]) });
  assert.equal(kept.shape, first.shape);
});

test("corners round off without leaving the route's ends", () => {
  const pts = [{ x: 0, y: 0 }, { x: 100, y: 58 }, { x: 200, y: 0 }];
  const out = rounded(pts, 14);
  assert.deepEqual(out[0], pts[0]);
  assert.deepEqual(out[out.length - 1], pts[2]);
  assert.ok(out.length > 3);
});
