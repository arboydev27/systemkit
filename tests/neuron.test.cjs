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

test('the flight draws back, lunges into the dot and stops inside it, holds at each lesson, and passes the last as the far end opens', () => {
  const turned = dive.turnPoints(graph.positions, 2.3, 0.2);
  const path = dive.buildFlightPath(graph, turned, dive.routeFrom(routes, dive.chooseEntry(graph, turned, routes)), routes);
  const stops = dive.stopsFor(path.stops.length - 2);
  assert.ok(Math.abs(dive.flightDistance(path, 0)) < 1e-12);
  assert.ok(dive.flightDistance(path, dive.FLIGHT.pull) < 0);
  assert.ok(dive.flightDistance(path, dive.FLIGHT.cell) > path.stops[0], 'stops just inside the first dot');
  for (let stop = 2; stop < stops.length - 1; stop++) assert.ok(Math.abs(dive.flightDistance(path, stops[stop]) - path.stops[stop - 1]) < 1e-6, `holds at lesson ${stop - 1}`);
  assert.ok(Math.abs(dive.flightDistance(path, dive.FLIGHT.open + 0.02) - path.stops[path.stops.length - 1]) < 1e-6);
  let last = dive.flightDistance(path, dive.FLIGHT.pull);
  for (let progress = dive.FLIGHT.pull; progress <= 1; progress += 0.001) {
    const along = dive.flightDistance(path, progress);
    assert.ok(along >= last - 1e-9, `goes back at ${progress.toFixed(3)}`);
    last = along;
  }
  const { FLIGHT } = dive;
  assert.ok(FLIGHT.pull < FLIGHT.covered && FLIGHT.covered <= FLIGHT.through && FLIGHT.through < FLIGHT.cell && FLIGHT.cell < FLIGHT.terminal && FLIGHT.terminal < FLIGHT.release && FLIGHT.release < FLIGHT.open && FLIGHT.open < FLIGHT.clear && FLIGHT.clear < 1);
});

test('a dive stops in the cell, at one node for each lesson on the way, at most two, then at the game', () => {
  assert.deepEqual(dive.stopsFor(0), [0, dive.FLIGHT.cell, dive.FLIGHT.terminal, 1]);
  assert.deepEqual(dive.stopsFor(1), [0, dive.FLIGHT.cell, dive.FLIGHT.terminal, 1]);
  assert.equal(dive.stopsFor(2).length, 5);
  assert.equal(dive.stopsFor(7).length, 2 + 1 + dive.MOST_PASSED);
  const stops = dive.stopsFor(2);
  for (let index = 1; index < stops.length; index++) assert.ok(stops[index] > stops[index - 1]);
  // Spread evenly along the scroll, each stop where its share says.
  for (let index = 0; index < stops.length; index++) assert.ok(Math.abs(dive.flightAt(stops, index / (stops.length - 1)) - stops[index]) < 1e-12);
  assert.ok(dive.flightAt(stops, 0.5 / (stops.length - 1)) > 0 && dive.flightAt(stops, 0.5 / (stops.length - 1)) < stops[1]);
  // Every hop takes long enough to see, and none so long that it needs a pause button.
  for (let hop = 0; hop < stops.length - 1; hop++) assert.ok(dive.hopSeconds(stops, hop) >= 1.2 && dive.hopSeconds(stops, hop) < 5);
});

test('scrolling that stops between stops settles on the next one the way it was going, after the smallest nudge', () => {
  assert.equal(dive.settleStop(1.06, 1), 2);
  assert.equal(dive.settleStop(1.03, 1), 1);
  assert.equal(dive.settleStop(1.94, -1), 1);
  assert.equal(dive.settleStop(1.97, -1), 2);
  assert.equal(dive.settleStop(2.4, 0), 2);
  assert.equal(dive.settleStop(2.6, 0), 3);
  assert.equal(dive.settleStop(2, 1), 2);
});

test('one gesture carries the page one stop at most, so a flick from the orb can never skip the game', () => {
  const last = 4;
  assert.equal(dive.gateFor(0, 1, last), 1);
  assert.equal(dive.gateFor(-0.4, 1, last), 1, 'from above the dive on a phone');
  assert.equal(dive.gateFor(1, 1, last), 2);
  assert.equal(dive.gateFor(1.5, 1, last), 2);
  assert.equal(dive.gateFor(3, 1, last), 4, 'the game is the last stop');
  assert.equal(dive.gateFor(4, 1, last), null, 'from the game on, the page is free');
  assert.equal(dive.gateFor(4, -1, last), 3);
  assert.equal(dive.gateFor(6, -1, last), 3, 'back up from below the game stops at the last lesson');
  assert.equal(dive.gateFor(2, -1, last), 1);
  assert.equal(dive.gateFor(0.5, -1, last), 0);
  assert.equal(dive.gateFor(0, -1, last), null);
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

test('the neuron has a node of Ranvier for each lesson the route stops at, and its names land in order', () => {
  const titles = graph.titles;
  const degrees = require('../src/lib/orb-view.ts').linkDegrees(graph);
  const route = dive.routeFrom(routes, dive.chooseEntry(graph, dive.turnPoints(graph.positions, 0.7, 0.2), routes));
  const made = film.makeFilm(route, titles, degrees);
  const passed = route.slice(1, -1).slice(0, dive.MOST_PASSED);
  assert.equal(made.nodes.length, Math.max(1, passed.length));
  assert.deepEqual(made.names, [...passed.map((lesson) => titles[lesson]), titles[route[route.length - 1]]]);
  for (let index = 1; index < made.nodes.length; index++) assert.ok(made.nodes[index] > made.nodes[index - 1]);
  assert.ok(made.swell > made.nodes[made.nodes.length - 1] && made.end > made.swell && made.membrane < film.FILM.axon);
  for (const count of made.branches) assert.ok(count >= 0 && count <= 3);
  assert.equal(made.stops.length, made.nodes.length + 3);
  assert.equal(made.holds.length, made.stops.length);
  // A route of a single hop still passes one node, left unnamed.
  const short = film.makeFilm([route[route.length - 2], route[route.length - 1]], titles, degrees);
  assert.equal(short.nodes.length, 1);
  assert.equal(short.names[0], '');
});

test('the camera only moves forward, rests at each stop with the node ahead lit, and ends at the terminal', () => {
  const made = film.makeFilm([0, 1, 2, 3, 4], graph.titles, require('../src/lib/orb-view.ts').linkDegrees(graph));
  let last = -Infinity;
  for (let progress = 0; progress <= 1.0001; progress += 0.002) {
    const depth = film.filmDepth(made, Math.min(1, progress));
    assert.ok(depth >= last - 1e-9, `goes back at ${progress.toFixed(3)}`);
    last = depth;
    if (progress > made.stops[1]) assert.ok(film.signalDepth(made, progress) >= depth - 1e-9, `signal behind at ${progress.toFixed(3)}`);
  }
  for (let stop = 1; stop < made.stops.length; stop++) assert.ok(Math.abs(film.filmDepth(made, made.stops[stop]) - made.holds[stop]) < 1e-9, `holds at stop ${stop}`);
  assert.ok(Math.abs(film.filmDepth(made, film.FILM.soma)) >= 0);
  assert.ok(made.holds[1] > made.membrane, 'the first stop is inside the cell');
  assert.ok(film.filmDepth(made, 0.12) < made.membrane && film.filmDepth(made, 0.27) > made.membrane, 'the camera goes through the cell membrane while the dot opens');
  // At each node's stop the signal has reached that node, short of the camera's next.
  for (let node = 0; node < made.nodes.length; node++) assert.ok(Math.abs(film.signalDepth(made, made.stops[node + 2]) - made.nodes[node]) < 1e-9);
  // Still at the stops, moving between them.
  for (let stop = 1; stop < made.stops.length - 1; stop++) assert.ok(film.restAt(made, made.stops[stop]) > 0.99);
  assert.ok(film.restAt(made, (made.stops[2] + made.stops[3]) / 2) < 0.01);
});

test('the camera looks straight down the axon, square and level, and what is dead ahead lands where the screen says', () => {
  const made = film.makeFilm([0, 1, 2], graph.titles, require('../src/lib/orb-view.ts').linkDegrees(graph));
  for (const progress of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const shot = film.shoot(made, progress, 1440, 900, 700, 450, 3.7, 0.4);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const v of [shot.right, shot.up, shot.forward]) assert.ok(Math.abs(dot(v, v) - 1) < 1e-6);
    assert.ok(Math.abs(dot(shot.right, shot.up)) < 1e-6 && Math.abs(dot(shot.right, shot.forward)) < 1e-6 && Math.abs(dot(shot.up, shot.forward)) < 1e-6);
    const ahead = shot.position.map((value, axis) => value + shot.forward[axis] * 3);
    const spot = film.onFilm(shot, ahead);
    assert.ok(Math.abs(spot.x - 700) < 1e-6 && Math.abs(spot.y - 450) < 1e-6);
    assert.equal(film.onFilm(shot, shot.position.map((value, axis) => value - shot.forward[axis])), null);
  }
});

const arbor = require('../src/lib/orb-arbor.ts');

test('every lesson grows into a neuron: dendrites from its cell body, in order, inside half the gap to its neighbours', () => {
  const degrees = require('../src/lib/orb-view.ts').linkDegrees(graph);
  const made = arbor.buildArbors(graph.positions, degrees, graph.links);
  const again = arbor.buildArbors(graph.positions, degrees, graph.links);
  assert.deepEqual([...made.ends.slice(0, 60)], [...again.ends.slice(0, 60)], 'the same every time, so every browser grows the same orb');
  const count = graph.titles.length;
  assert.equal(made.starts.length, count + 1);
  for (let lesson = 0; lesson < count; lesson++) {
    const soma = graph.positions.slice(lesson * 3, lesson * 3 + 3);
    let stubs = 0;
    for (let index = made.starts[lesson]; index < made.starts[lesson + 1]; index++) {
      assert.equal(made.owner[index], lesson);
      assert.ok(made.from[index] >= 0 && made.to[index] <= 1 + 1e-6 && made.to[index] > made.from[index]);
      assert.ok(made.rank[index] <= 2);
      stubs += made.stub[index];
      for (const end of [0, 1]) {
        const at = (index * 2 + end) * 3;
        const away = Math.hypot(made.ends[at] - soma[0], made.ends[at + 1] - soma[1], made.ends[at + 2] - soma[2]);
        assert.ok(away < 0.15, `${graph.titles[lesson]} reaches ${away.toFixed(3)}`);
      }
    }
    assert.ok(stubs >= 4 && stubs <= 6, `${stubs} dendrites leave the cell body`);
    const apex = made.apex.slice(lesson * 3, lesson * 3 + 3);
    const out = Math.hypot(...soma);
    assert.ok((apex[0] * soma[0] + apex[1] * soma[1] + apex[2] * soma[2]) / out > 0.8, 'the apical dendrite points out toward the surface');
  }
  for (let index = 0; index < made.beads.length; index++) assert.ok(made.beads[index] > 0.05 && made.beads[index] < 0.95);
  const stained = graph.titles.filter((_, lesson) => arbor.stainedAtFirst(lesson)).length / count;
  assert.ok(stained > 0.1 && stained < 0.32, `${(stained * 100).toFixed(0)}% stained at first`);
});

test('dendrites behind the orb are wider and fainter by the same factor, and a cell with no point is the poster\'s dot', () => {
  const near = arbor.strokeOf(1, 0, 1, 1);
  const far = arbor.strokeOf(0.1, 0, 1, 1);
  assert.ok(far.width > near.width * 0.9 && far.alpha < near.alpha);
  for (let rank = 1; rank < 3; rank++) assert.ok(arbor.strokeOf(1, rank, 1, 1).width < arbor.strokeOf(1, rank - 1, 1, 1).width);
  const calls = [];
  const recorder = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]) });
  arbor.somaPath(recorder, 10, 20, 4, 0, -1, 0);
  assert.deepEqual(calls.map(([name]) => name), ['moveTo', 'arc']);
  assert.deepEqual(calls[1].slice(1), [10, 20, 4, 0, Math.PI * 2]);
});

const notes = require('../src/lib/orb-notes.ts');

test('each stop says why its lesson follows the last, where the course gives a reason, and its summary where it doesn\'t', () => {
  const made = notes.orbNotes(chapters);
  assert.equal(made.summaries.length, graph.titles.length);
  assert.equal(made.reasons.length, graph.links.length / 2);
  for (const [from, to, reason] of made.reasons) {
    assert.ok(routes.related(from, to));
    assert.ok(reason.length > 10);
  }
  const [from, to, reason] = made.reasons[0];
  assert.equal(notes.noteFor(made, from, to), reason);
  assert.equal(notes.noteFor(made, null, to), made.summaries[to]);
  assert.equal(notes.noteFor(made, to + 1 === from ? to + 2 : to + 1, to), made.reasons.find(([a, b]) => a === (to + 1 === from ? to + 2 : to + 1) && b === to)?.[2] ?? made.summaries[to]);
  assert.equal(notes.noteFor(null, from, to), '');
});
