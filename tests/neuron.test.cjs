const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};

const { chapters } = require('../src/content/chapters.ts');
const { buildOrbGraph } = require('../src/lib/orb-layout.ts');
const { CAMERA } = require('../src/lib/orb-view.ts');
const dive = require('../src/lib/neuron-route.ts');

const graph = buildOrbGraph(chapters);
const scaling = chapters.findIndex((chapter) => chapter.id === 'scaling');
const exits = [];
for (let lesson = graph.chapterStarts[scaling]; lesson < graph.chapterStarts[scaling + 1]; lesson++) exits.push(lesson);
const routes = dive.routesTo(graph, exits);
const chapterOf = (lesson) => { let chapter = 0; while (graph.chapterStarts[chapter + 1] <= lesson) chapter++; return chapter; };
const linked = (a, b) => routes.related(a, b) || (Math.abs(a - b) === 1 && chapterOf(a) === chapterOf(b));
const angles = [];
for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 12) for (const pitch of [-0.8, -0.4, 0, 0.4, 0.8]) angles.push([yaw, pitch]);

test('from any angle the orb can be turned to, the dive goes through a dot facing the viewer, a few real links from a lesson on scaling', () => {
  for (const [yaw, pitch] of angles) {
    const turned = dive.turnPoints(graph.positions, yaw, pitch);
    const entry = dive.chooseEntry(graph, turned, routes, { lens: 0.3 });
    assert.ok(entry >= 0, `no entry at ${yaw.toFixed(2)}, ${pitch}`);
    assert.ok(turned[entry * 3 + 2] > 0.3, `${graph.titles[entry]} faces away`);
    const place = dive.onScreen(turned[entry * 3], turned[entry * 3 + 1], turned[entry * 3 + 2]);
    assert.ok(Math.hypot(place.x, place.y) > 0.3, `${graph.titles[entry]} is under the lens`);
    const route = dive.routeFrom(routes, entry);
    assert.ok(route.length >= 3 && route.length <= 5, `${route.length - 1} hops`);
    assert.ok(exits.includes(route[route.length - 1]), `ends at ${graph.titles[route[route.length - 1]]}`);
    for (let index = 1; index < route.length; index++) assert.ok(linked(route[index - 1], route[index]), `${graph.titles[route[index - 1]]} → ${graph.titles[route[index]]} is not a real link`);
  }
});

test('most routes dive through the middle on related links rather than creeping along a chapter', () => {
  let dives = 0;
  let hops = 0;
  for (const [yaw, pitch] of angles) {
    const turned = dive.turnPoints(graph.positions, yaw, pitch);
    const entry = dive.chooseEntry(graph, turned, routes);
    dives += routes.dives[entry];
    hops += routes.hops[entry];
  }
  assert.ok(dives / hops > 0.5, `${dives} of ${hops} hops are related links`);
});

test('the dot under the visitor\'s pointer is the one the dive goes through', () => {
  const turned = dive.turnPoints(graph.positions, 0.4, 0.1);
  for (let lesson = 0; lesson < graph.titles.length; lesson++) {
    if (turned[lesson * 3 + 2] < 0.6 || routes.hops[lesson] < 2 || routes.hops[lesson] > 4) continue;
    const place = dive.onScreen(turned[lesson * 3], turned[lesson * 3 + 1], turned[lesson * 3 + 2]);
    if (Math.hypot(place.x, place.y) < 0.4) continue;
    assert.equal(dive.chooseEntry(graph, turned, routes, { hint: { x: place.x, y: -place.y }, lens: 0.3 }), lesson, graph.titles[lesson]);
  }
});

test('the camera starts where the viewer stands, goes through the first dot exactly, and passes every lesson in order', () => {
  const turned = dive.turnPoints(graph.positions, 1.1, -0.3);
  const route = dive.routeFrom(routes, dive.chooseEntry(graph, turned, routes));
  const path = dive.buildFlightPath(graph, turned, route, routes);
  const point = [0, 0, 0];
  assert.deepEqual([...dive.pathPoint(path, 0, point)].map((value) => +value.toFixed(4)), [0, 0, CAMERA]);
  dive.pathPoint(path, path.stops[0], point);
  assert.ok(Math.hypot(point[0] - turned[route[0] * 3], point[1] - turned[route[0] * 3 + 1], point[2] - turned[route[0] * 3 + 2]) < 1e-3);
  for (let stop = 1; stop < route.length; stop++) {
    assert.ok(path.stops[stop] > path.stops[stop - 1]);
    dive.pathPoint(path, path.stops[stop], point);
    const lesson = route[stop];
    assert.ok(Math.hypot(point[0] - turned[lesson * 3], point[1] - turned[lesson * 3 + 1], point[2] - turned[lesson * 3 + 2]) < 0.06, graph.titles[lesson]);
  }
  for (let index = 0; index < path.count; index++) {
    assert.ok(Math.abs(Math.hypot(path.nx[index], path.ny[index], path.nz[index]) - 1) < 1e-3);
  }
});

test('the flight draws back, lunges through the dot, keeps moving forward, and reaches the last lesson as the far end opens', () => {
  const turned = dive.turnPoints(graph.positions, 2.3, 0.2);
  const path = dive.buildFlightPath(graph, turned, dive.routeFrom(routes, dive.chooseEntry(graph, turned, routes)), routes);
  assert.ok(Math.abs(dive.flightDistance(path, 0)) < 1e-12);
  assert.ok(dive.flightDistance(path, dive.FLIGHT.pull) < 0);
  assert.ok(Math.abs(dive.flightDistance(path, dive.FLIGHT.through) - path.stops[0]) < 1e-9);
  assert.ok(Math.abs(dive.flightDistance(path, dive.FLIGHT.open + 0.02) - path.stops[path.stops.length - 1]) < 1e-6);
  let last = dive.flightDistance(path, dive.FLIGHT.pull);
  for (let progress = dive.FLIGHT.pull; progress <= 1; progress += 0.001) {
    const along = dive.flightDistance(path, progress);
    assert.ok(along >= last - 1e-9, `goes back at ${progress.toFixed(3)}`);
    last = along;
  }
  assert.ok(dive.FLIGHT.pull < dive.FLIGHT.covered && dive.FLIGHT.covered <= dive.FLIGHT.through && dive.FLIGHT.through < dive.FLIGHT.open && dive.FLIGHT.open < dive.FLIGHT.clear && dive.FLIGHT.clear < 1);
});

test('scrolling that stops partway settles the way it was going, after the smallest nudge', () => {
  assert.equal(dive.settleTo(0.06, 1), 1);
  assert.equal(dive.settleTo(0.03, 1), 0);
  assert.equal(dive.settleTo(0.94, -1), 0);
  assert.equal(dive.settleTo(0.97, -1), 1);
  assert.equal(dive.settleTo(0.4, 0), 0);
  assert.equal(dive.settleTo(0.6, 0), 1);
});

test('the easings never go backwards', () => {
  for (const [leave, arrive] of [[3, 0.28], [0.28, 0.28], [0.8, 0.25]]) {
    let last = 0;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const value = dive.hermite(Math.min(1, t), leave, arrive);
      assert.ok(value >= last - 1e-9);
      last = value;
    }
    assert.ok(Math.abs(last - 1) < 1e-9);
  }
});
