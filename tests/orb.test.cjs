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
const view = { ...require('../src/lib/orb-view.ts'), ...require('../src/lib/orb-motion.ts') };

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

test('every lesson has one place, in course order, on the shell of the orb', () => {
  assert.equal(graph.positions.length, lessonCount * 3);
  assert.equal(graph.titles.length, lessonCount);
  assert.equal(graph.chapterStarts.length, chapters.length + 1);
  assert.equal(graph.titles[graph.chapterStarts[1]], chapters[1].steps[0].title);
  for (let lesson = 0; lesson < lessonCount; lesson++) {
    const reach = Math.hypot(...at(lesson));
    assert.ok(reach <= 1.001 && reach > 0.85, `lesson ${lesson} sits at ${reach}`);
  }
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

test('lessons sit with their chapter, and chapters with their part', () => {
  const chapterCenters = chapters.map((_, chapter) => mean(lessonsOf(chapter).map(at)));
  chapters.forEach((_, chapter) => {
    for (const lesson of lessonsOf(chapter)) {
      const nearest = chapterCenters.reduce((best, center, index) => distance(at(lesson), center) < distance(at(lesson), chapterCenters[best]) ? index : best, 0);
      assert.equal(nearest, chapter, `${graph.titles[lesson]} is nearer to ${chapters[nearest].id} than ${chapters[chapter].id}`);
    }
  });
  const parts = graph.partTitles.map((_, part) => chapters.flatMap((__, chapter) => graph.chapterParts[chapter] === part ? lessonsOf(chapter).map(at) : []));
  const partCenters = parts.map(mean);
  parts.forEach((points, part) => {
    const stray = points.filter((point) => partCenters.some((center, other) => other !== part && distance(point, center) < distance(point, partCenters[part]) * 0.8));
    assert.ok(stray.length <= points.length * 0.1, `${graph.partTitles[part]} has ${stray.length} strays`);
  });
});

test('consecutive lessons are neighbors, so a chapter reads as one short thread', () => {
  chapters.forEach((chapter, index) => {
    const lessons = lessonsOf(index);
    for (let step = 0; step < lessons.length - 1; step++) {
      assert.ok(distance(at(lessons[step]), at(lessons[step + 1])) < 0.5, `${chapter.id} step ${step}`);
    }
  });
});

test('the course begins on the side facing the viewer', () => {
  assert.ok(at(0)[2] > 0.4, `the first lesson faces away at z=${at(0)[2]}`);
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
    assert.ok(Math.abs(turnedX) < 1e-9 && Math.abs(turnedY) < 1e-9 && turnedZ > 0.8, `lesson ${lesson}`);
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

test('a part name fades out rather than overlapping a nearer one on the rim', () => {
  const near = { angle: -1.2, half: 0.3, depth: 0.9 };
  const clear = view.rimNameFades([near, { angle: -2.4, half: 0.3, depth: 0.2 }], 0.1);
  assert.deepEqual(clear, [1, 1]);
  const overlapping = view.rimNameFades([near, { angle: -1.6, half: 0.3, depth: 0.2 }], 0.1);
  assert.deepEqual(overlapping, [1, 0]);
  const closing = view.rimNameFades([near, { angle: -1.85, half: 0.3, depth: 0.2 }], 0.1);
  assert.ok(closing[0] === 1 && closing[1] > 0 && closing[1] < 1);
  assert.deepEqual(view.rimNameFades([near, { angle: 1.2, half: 0.3, depth: 0.2 }], 0.1), [1, 1], 'above and below the orb never meet');
});

test('the events that compare the orb with the list reach analytics with their names intact', () => {
  const { eventName } = require('../src/lib/analytics.ts');
  const source = ['CourseOrb', 'CourseMap'].map((name) => fs.readFileSync(`src/components/site/${name}.tsx`, 'utf8')).join('');
  const names = [...source.matchAll(/trackEvent\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const name of ['orb_open_dot', 'orb_open_row', 'path_open_list_chapter']) assert.ok(names.includes(name), name);
  assert.ok(source.includes('"path_switch_list"'));
  for (const name of [...names, 'path_switch_list', 'path_switch_orb']) assert.equal(eventName(name), name);
});
