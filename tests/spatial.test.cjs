const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');

// Load the authored lesson data without running React or launching a GPU.
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};
const { getSpatialScene } = require('../src/lib/spatial-scenes.ts');
const { pathPoints, spatialScene } = require('../src/lib/spatial-model.ts');
const { chapters } = require('../src/content/chapters.ts');

test('every live lesson has a spatial view with valid stable geometry and references', () => {
  let count = 0;
  for (const chapter of chapters) for (const lesson of chapter.steps) {
    const scene = getSpatialScene(chapter.id, lesson.diagramId);
    assert.ok(scene.title && scene.description && scene.nodes.length, `${chapter.id}/${lesson.id}`);
    const ids = new Set(scene.nodes.map(n => n.id));
    assert.equal(ids.size, scene.nodes.length);
    for (const n of scene.nodes) assert.ok([n.x, n.y, n.width, n.height].every(Number.isFinite));
    for (const l of scene.links) {
      assert.ok(l.points.length >= 2);
      assert.ok(l.source === null || ids.has(l.source));
      assert.ok(l.target === null || ids.has(l.target));
    }
    assert.deepEqual(getSpatialScene(chapter.id, lesson.diagramId), scene);
    count++;
  }
  assert.equal(count, 116);
});

test('read, write, replication and conditional routes retain their supplied direction and meaning', () => {
  const scene = getSpatialScene('scaling', 'replication');
  assert.equal(scene.links[0].source, 'web');
  assert.equal(scene.links[0].target, 'primary');
  assert.equal(scene.links[0].label, 'writes');
  assert.equal(scene.links[3].source, 'primary');
  assert.equal(scene.links[3].target, 'replica-a');
  assert.equal(scene.links[3].dashed, true);
  const cache = getSpatialScene('scaling', 'cache');
  assert.ok(cache.links.some(l => /miss/i.test(l.label)));
});

test('non-network diagrams do not acquire invented runtime connections', () => {
  for (const chapter of chapters.filter(c => ['consistent-hashing', 'unique-id'].includes(c.id))) {
    for (const step of chapter.steps) {
      const s = getSpatialScene(chapter.id, step.diagramId);
      if (s.guide === 'ring' || s.guide === 'timeline') assert.equal(s.links.length, 0);
    }
  }
  const s = spatialScene('comparison', { title:'Options', description:'Compare', kind:'comparison', items:[{title:'A'}, {title:'B'}] });
  assert.equal(s.links.length, 0);
});

test('path conversion preserves orthogonal bends and rejects unsupported commands', () => {
  assert.deepEqual(pathPoints('M 10 20 H 30 V 40 L 50 60'), [[10,20],[30,20],[30,40],[50,60]]);
  assert.throws(() => pathPoints('M 10 20 Q 30 40 50 60'));
  assert.throws(() => pathPoints('M 10'));
});

test('invalid or absent lesson data is rejected, and unattached endpoints stay explicit', () => {
  assert.throws(() => getSpatialScene('unknown', 'missing'));
  assert.throws(() => getSpatialScene('chat', 'missing'));
  assert.throws(() => spatialScene('bad', {title:'Bad', nodes:[{title:'Bad', x:NaN, y:0, w:10}]}));
  const s = spatialScene('free', {title:'Free', nodes:[{title:'Node', x:0, y:0, w:40}], edges:[{points:[[400,400],[500,500]]}]});
  assert.equal(s.links[0].source, null);
  assert.equal(s.links[0].target, null);
});
