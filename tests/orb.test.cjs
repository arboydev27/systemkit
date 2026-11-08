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

test('a goal order lists every lesson once, starting with its first chapter', () => {
  const order = chapters.map((_, index) => index).reverse();
  const lessons = view.lessonsInOrder(graph, order);
  assert.equal(lessons.length, lessonCount);
  assert.equal(new Set(lessons).size, lessonCount);
  assert.equal(lessons[0], graph.chapterStarts[chapters.length - 1]);
});

test('the events the course line and its navigation send reach analytics with their names intact', () => {
  const { eventName } = require('../src/lib/analytics.ts');
  const source = ['CourseNav', 'CourseMap', 'MiloHome', 'Milo'].map((name) => fs.readFileSync(`src/components/site/${name}.tsx`, 'utf8')).join('');
  const names = [...source.matchAll(/trackEvent\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const name of ['orb_open_dot', 'orb_open_row', 'path_open_list_chapter', 'orb_open_part', 'home_start_button']) assert.ok(names.includes(name), name);
  for (const name of names) assert.equal(eventName(name), name);
});

test('every goal has a short name on the home page, and the course has no view switch left', () => {
  const home = fs.readFileSync('src/components/site/MiloHome.tsx', 'utf8');
  const chapters = fs.readFileSync('src/content/chapters.ts', 'utf8');
  const named = home.match(/GOAL_NAMES[^{]*\{([^}]*)\}/)[1];
  const goals = chapters.match(/goalPaths:[^=]*"interview" \| "work" \| "foundations"/)[0];
  for (const goal of goals.match(/"([a-z]+)"/g)) assert.ok(named.includes(goal.slice(1, -1)), goal);
  for (const name of ['CourseMap', 'CourseNav', 'MiloHome', 'Milo']) assert.ok(!fs.readFileSync(`src/components/site/${name}.tsx`, 'utf8').includes('aria-pressed'), name);
});
