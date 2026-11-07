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
const { buildOrbGraph, regionsFor } = require('../src/lib/orb-layout.ts');
const view = { ...require('../src/lib/orb-view.ts'), ...require('../src/lib/orb-motion.ts') };
const shape = require('../src/lib/brain-shape.ts');
const body = require('../src/lib/brain-body.ts');
const brainFolds = require('../src/lib/brain-folds.ts');

const graph = buildOrbGraph(chapters);
const lessonCount = chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
const at = (lesson) => graph.positions.slice(lesson * 3, lesson * 3 + 3);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (points) => [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
const lessonsOf = (chapter) => {
  const lessons = [];
  for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1]; lesson++) lessons.push(lesson);
  return lessons;
};

test('the layout is the same every time and small enough to pass from the server', () => {
  assert.deepEqual(buildOrbGraph(chapters), graph);
  assert.ok(JSON.stringify(graph).length < 16_000, `${JSON.stringify(graph).length} bytes`);
  for (const value of graph.positions) assert.equal(value, Math.round(value * 1000) / 1000);
});

test('every lesson has one place, in course order, on the surface of the brain', () => {
  assert.equal(graph.positions.length, lessonCount * 3);
  assert.equal(graph.titles.length, lessonCount);
  assert.equal(graph.chapterStarts.length, chapters.length + 1);
  assert.equal(graph.titles[graph.chapterStarts[1]], chapters[1].steps[0].title);
  for (let lesson = 0; lesson < lessonCount; lesson++) {
    const [x, y, z] = at(lesson);
    assert.ok(Math.abs(shape.brainField(x, y, z)) < 0.006, `lesson ${lesson} is off the surface by ${shape.brainField(x, y, z)}`);
    assert.ok(Math.hypot(x, y, z) < 1, `lesson ${lesson} is outside the view`);
    assert.ok(shape.pieceField('stem', x, y, z) > 0.02, `lesson ${lesson} is on the brainstem`);
  }
});

test('the whole brain fits the view, which frames the unit sphere', () => {
  for (const piece of shape.PIECES) {
    const points = shape.pieceSamples(piece, 2000, 0);
    for (let index = 0; index < points.length; index += 3) {
      assert.ok(Math.hypot(points[index], points[index + 1], points[index + 2]) < 1, `${piece} reaches past the view`);
    }
  }
});

test('the brain has two hemispheres either side of a fissure, a cerebellum under the back, and a stem', () => {
  const inside = (piece, point) => shape.pieceField(piece, ...shape.fromAnatomy(point)) < 0;
  assert.ok(inside('right', [0.4, 0.1, 0]) && inside('left', [-0.4, 0.1, 0]));
  assert.ok(!inside('right', [0, 0.5, 0]) && !inside('left', [0, 0.5, 0]), 'the fissure between them is open');
  assert.ok(inside('cerebellum', [0.25, -0.62, -0.5]) && shape.cerebrumField(...shape.fromAnatomy([0.25, -0.62, -0.5])) > 0);
  assert.ok(inside('stem', [0, -0.8, -0.28]) && !inside('right', [0, -0.8, -0.28]));
  // A lateral profile: the frontal pole in front, the occipital pole behind, highest over the parietal lobe.
  assert.ok(shape.lobePreference(shape.fromAnatomy([0.3, 0.1, 0.8]), 'frontal', ['parietal', 'occipital', 'temporal']) < 0);
  assert.ok(shape.lobePreference(shape.fromAnatomy([0.3, 0.6, -0.4]), 'parietal', ['frontal', 'occipital', 'temporal']) < 0);
  assert.ok(shape.lobePreference(shape.fromAnatomy([0.6, -0.4, 0]), 'temporal', ['frontal', 'parietal', 'occipital']) < 0);
});

test('no two lessons crowd each other, and no side of the orb is left empty', () => {
  for (let a = 0; a < lessonCount; a++) for (let b = a + 1; b < lessonCount; b++) {
    assert.ok(distance(at(a), at(b)) > 0.07, `${graph.titles[a]} and ${graph.titles[b]}`);
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const octant = graph.titles.filter((_, lesson) => {
      const [px, py, pz] = at(lesson);
      return px * x > 0 && py * y > 0 && pz * z > 0;
    });
    assert.ok(octant.length >= 8, `octant ${x},${y},${z} has ${octant.length}`);
  }
});

// Lessons that touch over the surface, as the grooves see them.
const neighbours = (() => {
  const triangles = brainFolds.surfaceTriangles(graph.positions);
  const next = graph.titles.map(() => new Set());
  for (let index = 0; index < triangles.length; index += 3) {
    const [a, b, c] = triangles.slice(index, index + 3);
    for (const [p, q] of [[a, b], [b, c], [a, c]]) { next[p].add(q); next[q].add(p); }
  }
  return next;
})();
const connected = (lessons) => {
  const wanted = new Set(lessons);
  const seen = new Set([lessons[0]]);
  for (const queue = [lessons[0]]; queue.length;) for (const other of neighbours[queue.shift()]) if (wanted.has(other) && !seen.has(other)) { seen.add(other); queue.push(other); }
  return seen.size === wanted.size;
};
const side = (lesson) => Math.sign(at(lesson)[0]);

test('each chapter is one gyrus in one hemisphere, and each part a lobe in both', () => {
  chapters.forEach((chapter, index) => {
    const lessons = lessonsOf(index);
    assert.ok(lessons.every((lesson) => side(lesson) === side(lessons[0])), `${chapter.id} crosses the fissure`);
    assert.ok(connected(lessons), `${chapter.id} is in pieces`);
  });
  graph.partTitles.forEach((title, part) => {
    for (const half of [-1, 1]) {
      const lessons = chapters.flatMap((_, chapter) => graph.chapterParts[chapter] === part ? lessonsOf(chapter) : []).filter((lesson) => side(lesson) === half);
      assert.ok(lessons.length > 0, `${title} has nothing in one hemisphere`);
      assert.ok(connected(lessons), `${title} is in pieces in one hemisphere`);
    }
  });
  const halves = [-1, 1].map((half) => graph.titles.filter((_, lesson) => side(lesson) === half).length);
  assert.ok(Math.abs(halves[0] - halves[1]) <= 6, `the hemispheres hold ${halves}`);
});

test('each part sits on the lobe that does what it teaches', () => {
  assert.deepEqual(regionsFor(4), ['parietal', 'temporal', 'cerebellum', 'frontal']);
  const centerOf = (part) => mean(chapters.flatMap((_, chapter) => graph.chapterParts[chapter] === part ? lessonsOf(chapter).map(at) : []));
  const [parietal, temporal, cerebellum, frontal] = graph.partTitles.map((_, part) => centerOf(part));
  assert.ok(frontal[2] > parietal[2] + 0.3, 'designing products is in front, where planning happens');
  assert.ok(parietal[1] > temporal[1] + 0.3, 'thinking like a designer is on the crown, over how data behaves');
  assert.ok(cerebellum[1] < temporal[1] && cerebellum[2] < frontal[2], 'keeping systems healthy is under the back');
  const healthy = graph.partTitles.indexOf('Keeping systems healthy');
  for (const lesson of chapters.flatMap((_, chapter) => graph.chapterParts[chapter] === healthy ? lessonsOf(chapter) : [])) {
    assert.ok(Math.abs(shape.pieceField('cerebellum', ...at(lesson))) < 0.006, `${graph.titles[lesson]} is not on the cerebellum`);
  }
});

test('consecutive lessons are neighbors, so a chapter reads as one short thread', () => {
  chapters.forEach((chapter, index) => {
    const lessons = lessonsOf(index);
    for (let step = 0; step < lessons.length - 1; step++) {
      assert.ok(distance(at(lessons[step]), at(lessons[step + 1])) < 0.5, `${chapter.id} step ${step}`);
    }
  });
});

test('the course begins on the side facing the viewer, clear of the glass in the middle', () => {
  const [x, y, z] = view.turned(...at(0), view.VIEW.yaw, view.VIEW.pitch);
  assert.ok(z > 0.3, `the first lesson faces away at z=${z}`);
  assert.ok(Math.hypot(x, y) > 0.35, 'the first lesson is under the lens');
});

test('every related link in the content is on the orb', () => {
  const related = chapters.reduce((sum, chapter) => sum + chapter.steps.reduce((inner, step) => inner + (step.related?.length ?? 0), 0), 0);
  assert.equal(graph.links.length / 2, related);
  for (const lesson of graph.links) assert.ok(Number.isInteger(lesson) && lesson >= 0 && lesson < lessonCount);
  for (let index = 0; index < graph.links.length; index += 2) assert.notEqual(graph.links[index], graph.links[index + 1]);
  const scaling = chapters.findIndex((chapter) => chapter.id === 'scaling');
  const withLink = chapters[scaling].steps.findIndex((step) => step.related?.length);
  const { chapterId, stepId } = chapters[scaling].steps[withLink].related[0];
  const toChapter = chapters.findIndex((chapter) => chapter.id === chapterId);
  const from = graph.chapterStarts[scaling] + withLink;
  const to = graph.chapterStarts[toChapter] + chapters[toChapter].steps.findIndex((step) => step.id === stepId);
  const pairs = graph.links.flatMap((lesson, index) => index % 2 ? [] : [[lesson, graph.links[index + 1]]]);
  assert.ok(pairs.some(([a, b]) => a === from && b === to));
});

test('links that point nowhere are dropped rather than breaking the orb', () => {
  const small = buildOrbGraph([{ id: 'a', part: 'One', steps: [
    { id: 'x', title: 'X', related: [{ chapterId: 'missing', stepId: 'y' }, { chapterId: 'a', stepId: 'x' }, { chapterId: 'a', stepId: 'y' }] },
    { id: 'y', title: 'Y' },
  ] }]);
  assert.deepEqual(small.links, [0, 1]);
  assert.deepEqual(small.chapterStarts, [0, 2]);
});

test('turning to face a point brings it to the center of the view', () => {
  for (const lesson of [0, 40, 100, 157]) {
    const [x, y, z] = at(lesson);
    const { yaw, pitch } = view.faceAngles(x, y, z);
    const turnedX = x * Math.cos(yaw) + z * Math.sin(yaw);
    const flatZ = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const turnedY = y * Math.cos(pitch) - flatZ * Math.sin(pitch);
    const turnedZ = y * Math.sin(pitch) + flatZ * Math.cos(pitch);
    assert.ok(Math.abs(turnedX) < 1e-9 && Math.abs(turnedY) < 1e-9 && Math.abs(turnedZ - Math.hypot(x, y, z)) < 1e-9, `lesson ${lesson}`);
  }
});

test('a turn takes the short way around', () => {
  assert.ok(Math.abs(view.nearestAngle(6.2, 0.1) - 6.2) <= Math.PI);
  assert.ok(Math.abs(view.nearestAngle(-20, 3) + 20) <= Math.PI);
  assert.equal(view.nearestAngle(0, 1), 1);
});

test('the spring settles on its target without overshoot, and keeps velocity when interrupted', () => {
  let { value, velocity } = { value: 0, velocity: 0 };
  let highest = 0;
  for (let frame = 0; frame < 120; frame++) {
    ({ value, velocity } = view.springStep(value, velocity, 1, 0.5, 1 / 60));
    highest = Math.max(highest, value);
  }
  assert.ok(Math.abs(value - 1) < 1e-3);
  assert.ok(highest <= 1 + 1e-9);
  const moving = view.springStep(0, 5, 0, 0.5, 1 / 60);
  assert.ok(moving.value > 0 && moving.velocity > 0, 'a retargeted spring carries on in the direction it was moving');
  const coarse = view.springStep(0, 0, 1, 0.5, 1);
  assert.ok(coarse.value > 0.99 && coarse.value <= 1, 'a long frame cannot blow up');
});

test('dragging past the limit gives less and less', () => {
  assert.equal(view.rubberBand(0.5, 1), 0.5);
  assert.ok(view.rubberBand(2, 1) > 1 && view.rubberBand(2, 1) < 2);
  assert.ok(view.rubberBand(9, 1) < 4);
  assert.equal(view.rubberBand(-2, 1), -view.rubberBand(2, 1));
});

test('depth reads through size and brightness, and a finished lesson outranks an unfinished one', () => {
  assert.ok(view.dotRadius(1, 0, false, 300) > view.dotRadius(0, 0, false, 300) * 2);
  assert.ok(view.dotRadius(0.5, 9, false, 300) > view.dotRadius(0.5, 0, false, 300));
  assert.ok(view.dotRadius(0.5, 0, true, 300) > view.dotRadius(0.5, 0, false, 300));
  assert.ok(view.dotAlpha(1, false) > view.dotAlpha(0, false) * 3);
  for (const depth of [0, 0.25, 0.5, 0.75, 1]) assert.ok(view.dotAlpha(depth, true) > view.dotAlpha(depth, false));
  assert.ok(view.lineAlpha(1, 0.3) > view.lineAlpha(0, 0.3) * 5);
});

test('every lesson belongs to the right chapter by index', () => {
  chapters.forEach((_, chapter) => {
    for (const lesson of lessonsOf(chapter)) assert.equal(view.chapterOfLesson(graph, lesson), chapter);
  });
});

test('a link arc dives inside the orb and ends on its lessons', () => {
  const a = at(graph.links[0]);
  const b = at(graph.links[1]);
  const control = view.arcControl(a, b);
  assert.ok(Math.hypot(...view.arcPoint(a, control, b, 0.5)) < Math.min(Math.hypot(...a), Math.hypot(...b)));
  assert.deepEqual(view.arcPoint(a, control, b, 0), a);
  assert.deepEqual(view.arcPoint(a, control, b, 1), b);
});

test('a pointer finds the nearest front dot, and ignores dots behind or out of reach', () => {
  const points = [{ x: 10, y: 10, depth: 0.9 }, { x: 14, y: 10, depth: 0.9 }, { x: 12, y: 10, depth: 0.1 }, { x: 200, y: 200, depth: 1 }];
  assert.equal(view.hitLesson(points, 11, 10, 12), 0);
  assert.equal(view.hitLesson(points, 13.5, 10, 12), 1);
  assert.equal(view.hitLesson(points, 100, 100, 12), -1);
  assert.equal(view.hitLesson([{ x: 0, y: 0, depth: 0.2 }], 0, 0, 12), -1);
  assert.equal(view.hitLesson([{ x: 0, y: 0, depth: 0.5 }, { x: 2, y: 0, depth: 1 }], 1, 0, 12), 1);
});

test('the signal reaches every lesson by following real links from any start', () => {
  for (const start of [0, 80, 157]) {
    const hops = view.hopsFrom(graph, start);
    assert.equal(hops[start], 0);
    assert.ok(hops.every(Number.isFinite), 'part of the course is disconnected');
  }
  assert.equal(view.hopsFrom(graph, 0)[1], 1);
});

test('a goal order lists every lesson once, starting with its first chapter', () => {
  const order = chapters.map((_, index) => index).reverse();
  const lessons = view.lessonsInOrder(graph, order);
  assert.equal(lessons.length, lessonCount);
  assert.equal(new Set(lessons).size, lessonCount);
  assert.equal(lessons[0], graph.chapterStarts[chapters.length - 1]);
});

test('the route ahead starts at the next lesson, skips what is finished, and ends when nothing is left', () => {
  const order = chapters.map((_, index) => index);
  const none = graph.titles.map(() => false);
  assert.equal(view.routeAhead(graph, order, none, 0).length, lessonCount);
  assert.equal(view.routeAhead(graph, order, none, 0)[0], 0);
  const finished = [...none];
  finished[0] = finished[1] = finished[5] = true;
  const route = view.routeAhead(graph, order, finished, 2);
  assert.equal(route[0], 2);
  assert.equal(route.length, lessonCount - 3);
  assert.ok(!route.includes(5));
  const wrapped = view.routeAhead(graph, order, none, 50);
  assert.equal(wrapped[0], 50);
  assert.equal(wrapped[wrapped.length - 1], 49, 'it comes back around to skipped lessons');
  assert.deepEqual(view.routeAhead(graph, order, none, null), []);
});

test('the first paint is identical on every run, with every lesson and link drawn', () => {
  const marks = view.posterMarks(graph, 1000);
  assert.deepEqual(view.posterMarks(graph, 1000), marks);
  assert.ok(JSON.stringify(marks).length < 12_000, `${JSON.stringify(marks).length} bytes`);
  const dots = marks.dots.flatMap((group) => [...group.path.matchAll(/M(-?\d+) (-?\d+)h0/g)].map((match) => [Number(match[1]), Number(match[2])]));
  assert.equal(dots.length, lessonCount);
  for (const [x, y] of dots) assert.ok(x > 0 && x < 1000 && y > 0 && y < 1000, `a dot is off the stage at ${x},${y}`);
  assert.ok(marks.dots.every((group, index) => index === 0 || marks.dots[index - 1].depth <= group.depth), 'front dots draw last');
  assert.ok(marks.lines.some((line) => line.link.includes('Q')));
  assert.equal(marks.lines.reduce((sum, line) => sum + (line.chapter.match(/M/g) ?? []).length, 0), lessonCount - chapters.length);
  assert.equal(marks.lines.reduce((sum, line) => sum + (line.link.match(/M/g) ?? []).length, 0), graph.links.length / 2);
});

test('a part name fades out rather than overlapping the name of a nearer lobe', () => {
  const near = { x: 100, y: 100, half: 60, high: 8, depth: 0.9 };
  assert.deepEqual(view.nameFades([near, { x: 300, y: 100, half: 60, high: 8, depth: 0.2 }], 10), [1, 1]);
  assert.deepEqual(view.nameFades([near, { x: 150, y: 104, half: 60, high: 8, depth: 0.2 }], 10), [1, 0]);
  const closing = view.nameFades([near, { x: 225, y: 100, half: 60, high: 8, depth: 0.2 }], 10);
  assert.ok(closing[0] === 1 && closing[1] > 0 && closing[1] < 1);
  assert.deepEqual(view.nameFades([near, { x: 100, y: 140, half: 60, high: 8, depth: 0.2 }], 10), [1, 1], 'one above the other');
});

test("the first paint's outline is the one the live brain traces at rest, and every lesson's dot sits on it", () => {
  assert.deepEqual(graph.outline, body.restingOutline());
  assert.equal(graph.outline.length, shape.PIECES.length);
  assert.ok(JSON.stringify(graph.outline).length < 3_000, `${JSON.stringify(graph.outline).length} bytes`);
  // Each path back to polygons on the first paint's square.
  const polygons = graph.outline.flatMap((path) => path.split('z').filter(Boolean).map((loop) => {
    const numbers = loop.match(/-?\d+/g).map(Number);
    const points = [[numbers[0], numbers[1]]];
    for (let index = 2; index < numbers.length; index += 2) points.push([points[points.length - 1][0] + numbers[index], points[points.length - 1][1] + numbers[index + 1]]);
    return points;
  }));
  const within = ([x, y], polygon) => polygon.reduce((inside, [ax, ay], index) => {
    const [bx, by] = polygon[(index + 1) % polygon.length];
    return (ay > y) !== (by > y) && x < ax + ((y - ay) * (bx - ax)) / (by - ay) ? !inside : inside;
  }, false);
  const marks = view.posterMarks(graph, view.POSTER_SIZE);
  const dots = marks.dots.flatMap((group) => [...group.path.matchAll(/M(-?\d+) (-?\d+)h0/g)].map((match) => [Number(match[1]), Number(match[2])]));
  for (const dot of dots) assert.ok(polygons.some((polygon) => within(dot, polygon)), `a dot at ${dot} is off the brain`);
  // At rest the live brain traces the same outline from the same points.
  const traced = body.bodyOutlines(view.VIEW.yaw, view.VIEW.pitch).map(({ loops }) => body.outlinePath(loops, view.POSTER_SIZE));
  assert.deepEqual(traced, graph.outline);
});

test('the grooves come from the chapters: deepest between parts and hemispheres, and gone where chapters merge', () => {
  const folds = brainFolds.buildFolds(graph);
  const depths = new Set(folds.depth);
  for (const level of [1, 2, 3, 4]) assert.ok(depths.has(level), `no grooves of depth ${level}`);
  for (let index = 0; index < folds.points.length; index += 3) {
    // A groove where two pieces meet, as where the cerebellum tucks under the occipital lobe, runs along the crease between them.
    assert.ok(Math.abs(shape.brainField(folds.points[index], folds.points[index + 1], folds.points[index + 2])) < 0.045, 'a groove leaves the surface');
  }
  // One chapter per part: the grooves between chapters go, and those between parts stay.
  const parts = graph.partTitles.map((_, part) => chapters.flatMap((__, chapter) => graph.chapterParts[chapter] === part ? lessonsOf(chapter) : []));
  const merged = brainFolds.buildFolds({ ...graph, chapterParts: graph.partTitles.map((_, part) => part), chapterStarts: [...parts.map((lessons) => lessons[0]), lessonCount] });
  assert.ok(!merged.depth.includes(2));
  assert.ok(merged.depth.includes(3));
  assert.deepEqual(brainFolds.buildFolds(graph), folds);
  const folia = brainFolds.folia();
  assert.ok(folia.depth.length >= 6 && folia.depth.every((level) => level === brainFolds.FOLIA), 'the cerebellum has its folia');
});

test('the events the orb and its navigation send reach analytics with their names intact', () => {
  const { eventName } = require('../src/lib/analytics.ts');
  const source = ['CourseOrb', 'CourseMap', 'OrbHome'].map((name) => fs.readFileSync(`src/components/site/${name}.tsx`, 'utf8')).join('');
  const names = [...source.matchAll(/trackEvent\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const name of ['orb_open_dot', 'orb_open_row', 'path_open_list_chapter', 'orb_open_part', 'home_start_button']) assert.ok(names.includes(name), name);
  for (const name of names) assert.equal(eventName(name), name);
});

test('every goal has a short name on the home page, and the course has no view switch left', () => {
  const home = fs.readFileSync('src/components/site/OrbHome.tsx', 'utf8');
  const chapters = fs.readFileSync('src/content/chapters.ts', 'utf8');
  const named = home.match(/GOAL_NAMES[^{]*\{([^}]*)\}/)[1];
  const goals = chapters.match(/goalPaths:[^=]*"interview" \| "work" \| "foundations"/)[0];
  for (const goal of goals.match(/"([a-z]+)"/g)) assert.ok(named.includes(goal.slice(1, -1)), goal);
  for (const name of ['CourseMap', 'CourseOrb', 'OrbHome']) assert.ok(!fs.readFileSync(`src/components/site/${name}.tsx`, 'utf8').includes('aria-pressed'), name);
});
