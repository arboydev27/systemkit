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
// The dive starts from the visitor's next lesson, so it has to work from any of them, seen from the front as the
// dive draws the course inside.
const front = dive.turnPoints(graph.positions, 0, 0);

test('from any lesson a visitor could be on, the dive follows real links to a lesson on scaling', () => {
  for (let start = 0; start < graph.titles.length; start++) {
    const route = dive.routeFrom(routes, start);
    assert.equal(route[0], start);
    assert.ok(exits.includes(route[route.length - 1]), `${graph.titles[start]} ends at ${graph.titles[route[route.length - 1]]}`);
    assert.ok(route.length <= 12, `${graph.titles[start]} takes ${route.length - 1} hops`);
    for (let index = 1; index < route.length; index++) assert.ok(linked(route[index - 1], route[index]), `${graph.titles[route[index - 1]]} → ${graph.titles[route[index]]} is not a real link`);
  }
});

test('most routes dive through the middle on related links rather than creeping along a chapter', () => {
  let dives = 0;
  let hops = 0;
  for (let start = 0; start < graph.titles.length; start++) {
    dives += routes.dives[start];
    hops += routes.hops[start];
  }
  assert.ok(dives / hops > 0.5, `${dives} of ${hops} hops are related links`);
});

test('without WebGL, the camera starts where the viewer stands, goes through the first lesson exactly, and passes every lesson in order', () => {
  const turned = front;
  const route = dive.routeFrom(routes, 0);
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

test('the flight draws back, lunges through the eye, keeps moving forward, and reaches the last lesson as the far end opens', () => {
  const turned = front;
  const path = dive.buildFlightPath(graph, turned, dive.routeFrom(routes, 40), routes);
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

const film = require('../src/lib/neuron-film.ts');

test('the neuron has a node of Ranvier for each lesson the route passes, and its names land in order', () => {
  const titles = graph.titles;
  const degrees = require('../src/lib/orb-view.ts').linkDegrees(graph);
  const route = dive.routeFrom(routes, 60);
  const made = film.makeFilm(route, titles, degrees);
  assert.equal(made.nodes.length, Math.max(1, Math.min(4, route.length - 2)));
  assert.deepEqual(made.names, [...route.slice(1, -1).slice(0, 4).map((lesson) => titles[lesson]), titles[route[route.length - 1]]]);
  for (let index = 1; index < made.nodes.length; index++) assert.ok(made.nodes[index] > made.nodes[index - 1]);
  assert.ok(made.swell > made.nodes[made.nodes.length - 1] && made.end > made.swell && made.membrane < film.FILM.axon);
  for (const count of made.branches) assert.ok(count >= 0 && count <= 3);
  // A route of a single hop still passes one node, left unnamed.
  const short = film.makeFilm([route[route.length - 2], route[route.length - 1]], titles, degrees);
  assert.equal(short.nodes.length, 1);
  assert.equal(short.names[0], '');
});

test('the camera only moves forward through the neuron, the signal stays ahead of it, and it ends at the terminal', () => {
  const made = film.makeFilm([0, 1, 2, 3, 4], graph.titles, require('../src/lib/orb-view.ts').linkDegrees(graph));
  let last = -Infinity;
  for (let progress = 0; progress <= 1.0001; progress += 0.002) {
    const depth = film.filmDepth(made, Math.min(1, progress));
    assert.ok(depth >= last - 1e-9, `goes back at ${progress.toFixed(3)}`);
    last = depth;
    if (progress > film.FILM.inside && progress < film.FILM.terminal) assert.ok(film.signalDepth(made, progress) >= depth - 1e-9, `signal behind at ${progress.toFixed(3)}`);
  }
  assert.ok(Math.abs(film.filmDepth(made, film.FILM.inside) - film.FILM.axon) < 1e-9);
  assert.ok(Math.abs(film.filmDepth(made, 1) - (made.end - 1.25)) < 1e-9);
  assert.ok(film.filmDepth(made, 0.12) < made.membrane && film.filmDepth(made, 0.2) > made.membrane, 'the camera goes through the cell membrane while the dot opens');
});

test('the camera looks straight down the axon, square and level, and what is dead ahead lands where the screen says', () => {
  const made = film.makeFilm([0, 1, 2], graph.titles, require('../src/lib/orb-view.ts').linkDegrees(graph));
  for (const progress of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const shot = film.shoot(made, progress, 1440, 900, 700, 450);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const v of [shot.right, shot.up, shot.forward]) assert.ok(Math.abs(dot(v, v) - 1) < 1e-6);
    assert.ok(Math.abs(dot(shot.right, shot.up)) < 1e-6 && Math.abs(dot(shot.right, shot.forward)) < 1e-6 && Math.abs(dot(shot.up, shot.forward)) < 1e-6);
    const ahead = shot.position.map((value, axis) => value + shot.forward[axis] * 3);
    const spot = film.onFilm(shot, ahead);
    assert.ok(Math.abs(spot.x - 700) < 1e-6 && Math.abs(spot.y - 450) < 1e-6);
    assert.equal(film.onFilm(shot, shot.position.map((value, axis) => value - shot.forward[axis])), null);
  }
});
