const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};
const { chapters } = require('../src/content/chapters.ts');
const { getSpatialScene } = require('../src/lib/spatial-scenes.ts');
const { getSpatialLesson, decodeDiagramAttempts, compareSpatialLessons, rememberSpatialLesson } = require('../src/lib/spatial-learning.ts');
const { layoutSpatialScene, presentSpatialLesson, validateSpatialLesson } = require('../src/lib/spatial-layout.ts');
const lessons = () => chapters.flatMap(chapter => chapter.steps.map(step => ({ chapter, step, lesson: getSpatialLesson(chapter.id, step.diagramId) })));
const clone = value => structuredClone(value);
const content = overrides => ({ layout: 'tiers', groups: [], scenes: [], views: [], predictions: [], ...overrides });
const fixture = () => {
  const base = { id: 'fixture', title: 'Supplied relationships', description: 'Declared components and routes', note: '', guide: undefined, groups: [], nodes: [
    { id: 'a', title: 'A', detail: '', kind: 'server', x: 4, y: 9, width: 200, height: 80 },
    { id: 'b', title: 'B', detail: '', kind: 'server', x: 450, y: 9, width: 200, height: 80 },
    { id: 'c', title: 'C', detail: '', kind: 'database', x: 700, y: 310, width: 200, height: 80 },
    { id: 'd', title: 'D', detail: '', kind: 'browser', x: 0, y: 100, width: 200, height: 80 },
  ], links: [
    { id: 'a-c', source: 'a', target: 'c', label: 'writes A', dashed: false, arrow: true, points: [[0,0],[1,1]] },
    { id: 'b-c', source: 'b', target: 'c', label: 'writes B', dashed: false, arrow: true, points: [[0,0],[1,1]] },
    { id: 'c-a', source: 'c', target: 'a', label: 'reads', dashed: true, arrow: true, points: [[0,0],[1,1]] },
    { id: 'a-b', source: 'a', target: 'b', label: 'replication', dashed: true, arrow: true, points: [[0,0],[1,1]] },
    { id: 'unattached', source: null, target: 'd', label: 'Connection', dashed: false, arrow: false, points: [[-300,-10],[0,100]] },
  ] };
  const teaching = content({ nodeRoles: { a: { lane: 2, order: 0 }, b: { lane: 2, order: 1 }, c: { lane: 3, order: 0 }, d: { lane: 0, order: 0 } },
    groups: [{ id: 'servers', title: 'Servers', description: 'The two supplied servers', members: ['a','b'] }],
    views: [{ id: 'write', title: 'A and its store', description: 'Only the declared subset', members: ['a','c'], layout: 'pipeline' }],
  });
  return { base, teaching, lesson: { scene: layoutSpatialScene('fixture', 'fixture', base, teaching), content: teaching } };
};
function segmentHits(a, b, node, clearance = 12) {
  const left = node.x - clearance, right = node.x + node.width + clearance, top = node.y - clearance, bottom = node.y + node.height + clearance;
  if (a[0] === b[0]) return a[0] > left + .001 && a[0] < right - .001 && Math.max(a[1], b[1]) > top + .001 && Math.min(a[1], b[1]) < bottom - .001;
  return a[1] > top + .001 && a[1] < bottom - .001 && Math.max(a[0], b[0]) > left + .001 && Math.min(a[0], b[0]) < right - .001;
}
function onBorder(point, node) {
  return (Math.abs(point[0] - node.x) < .001 || Math.abs(point[0] - node.x - node.width) < .001) && point[1] >= node.y && point[1] <= node.y + node.height ||
    (Math.abs(point[1] - node.y) < .001 || Math.abs(point[1] - node.y - node.height) < .001) && point[0] >= node.x && point[0] <= node.x + node.width;
}
function assertGeometry(scene) {
  const byId = new Map(scene.nodes.map(node => [node.id, node]));
  for (const node of scene.nodes) {
    assert.ok([node.x,node.y,node.width,node.height,node.lane].every(Number.isFinite), node.id);
    assert.equal(node.width, 112); assert.equal(node.height, 72); assert.ok(node.semanticId);
  }
  for (let i = 0; i < scene.nodes.length; i++) for (let j = i + 1; j < scene.nodes.length; j++) {
    const a = scene.nodes[i], b = scene.nodes[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `overlap ${a.id} / ${b.id}`);
  }
  for (const link of scene.links) {
    assert.ok(link.points.length >= 2, link.id);
    if (link.source) assert.ok(onBorder(link.points[0], byId.get(link.source)), `source border ${link.id}`);
    if (link.target) assert.ok(onBorder(link.points.at(-1), byId.get(link.target)), `target border ${link.id}`);
    for (let i = 1; i < link.points.length; i++) {
      const a = link.points[i - 1], b = link.points[i];
      assert.ok(a.every(Number.isFinite) && b.every(Number.isFinite), link.id);
      assert.ok(a[0] === b[0] || a[1] === b[1], `orthogonal ${link.id}`);
      for (const node of scene.nodes) if (node.id !== link.source && node.id !== link.target) assert.ok(!segmentHits(a,b,node), `clearance ${link.id} / ${node.id}`);
    }
  }
}

test('all 116 lessons preserve original components, directions, semantics, and relation origins in valid routed geometry', () => {
  const all = lessons(); assert.equal(all.length,116);
  for (const { chapter, step, lesson } of all) {
    validateSpatialLesson(lesson); assertGeometry(lesson.scene);
    const base = getSpatialScene(chapter.id,step.diagramId), byId = new Map(lesson.scene.links.map(link => [link.id,link]));
    assert.deepEqual(lesson.scene.nodes.map(node => node.id),base.nodes.map(node => node.id));
    assert.equal(lesson.scene.links.length,base.links.length);
    for (const link of base.links) {
      const learning = byId.get(link.id), authored = lesson.content.relationships?.[link.id];
      assert.equal(learning.source,authored?.source ?? link.source); assert.equal(learning.target,authored?.target ?? link.target);
      assert.equal(learning.arrow,link.arrow); assert.equal(learning.dashed,link.dashed); assert.equal(learning.label,link.label);
      assert.deepEqual(learning.origins,[link.id]);
      if (authored) { assert.equal(learning.meaning,authored.meaning); assert.equal(learning.condition,authored.condition); assert.equal(learning.explanation,authored.explanation); }
    }
    assert.deepEqual(getSpatialLesson(chapter.id,step.diagramId),lesson);
  }
});

test('layout is independent of SVG coordinates and retains semantic guides and equal node footprints', () => {
  for (const { chapter, step, lesson } of lessons()) {
    const base = getSpatialScene(chapter.id,step.diagramId), moved = clone(base);
    for (const node of moved.nodes) { node.x = 9000 - node.x * 7; node.y = -5000 + node.y * 3; node.width *= 4; node.height *= 2; }
    for (const link of moved.links) link.points = link.points.map(([x,y]) => [x * 11 + 7000,y * 9 - 8000]);
    assert.deepEqual(layoutSpatialScene(chapter.id,step.diagramId,moved,lesson.content),lesson.scene);
    if (base.guide) { assert.equal(lesson.scene.guide,base.guide); assert.ok(lesson.scene.guidePath.length > 1); assert.equal(lesson.scene.links.length,base.links.length); }
  }
});

test('repeated scaling roles retain their declared lane and order positions across lessons', () => {
  const positions = new Map(); let repeated = 0;
  for (const { chapter, lesson } of lessons().filter(item => item.chapter.id === 'scaling')) for (const node of lesson.scene.nodes) {
    const role = lesson.content.nodeRoles[node.id]; assert.ok(role && role.semanticId && Number.isInteger(role.order),node.id);
    assert.equal(node.lane,role.lane);
    const key = `${role.semanticId}:${role.lane}:${role.order}`, position = [node.x,node.y,node.width,node.height];
    if (positions.has(key)) { assert.deepEqual(position,positions.get(key)); repeated++; } else positions.set(key,position);
  }
  assert.ok(repeated > 12);
});

test('every authored collapse retains membership, aggregates only external relationships, and expands without moving other nodes', () => {
  for (const { lesson } of lessons()) for (const group of lesson.content.groups) {
    const before = clone(lesson), collapsed = presentSpatialLesson(lesson,{collapsed:[group.id]}), proxy = collapsed.scene.nodes.find(node => node.id === `group:${group.id}`);
    assert.ok(proxy,group.id); assert.deepEqual([...proxy.members].sort(),[...group.members].sort()); assertGeometry(collapsed.scene);
    const members = new Set(group.members), exterior = lesson.scene.links.filter(link => !(link.source && link.target && members.has(link.source) && members.has(link.target)));
    assert.deepEqual(collapsed.scene.links.flatMap(link => link.origins).sort(),exterior.map(link => link.id).sort());
    assert.ok(collapsed.scene.links.every(link => link.source !== link.target || link.source === null || !link.source.startsWith('group:')));
    for (const node of lesson.scene.nodes.filter(node => !members.has(node.id))) assert.deepEqual(collapsed.scene.nodes.find(n => n.id === node.id),node);
    assert.equal(collapsed.omittedNodes,0);
    assert.deepEqual(presentSpatialLesson(lesson,{collapsed:[]}).scene,lesson.scene);
    assert.deepEqual(lesson,before);
  }
});

test('focused views compact only declared members and original within-member relationships and accurately report omissions', () => {
  for (const { lesson } of lessons()) for (const view of lesson.content.views) {
    const focused = presentSpatialLesson(lesson,{collapsed:[],viewId:view.id}), members = new Set(view.members);
    const expected = lesson.scene.links.filter(link => link.source && link.target && members.has(link.source) && members.has(link.target) && (view.linkIds === undefined || view.linkIds.includes(link.id)));
    assert.deepEqual(focused.scene.nodes.map(node => node.id).sort(),[...members].sort());
    for (const node of focused.scene.nodes) assert.equal(node.semanticId,lesson.scene.nodes.find(original=>original.id===node.id).semanticId,`semantic continuity ${node.id}`);
    assert.deepEqual(focused.scene.links.map(link => link.id),expected.map(link => link.id));
    assert.equal(focused.omittedNodes,lesson.scene.nodes.length - members.size); assert.equal(focused.omittedLinks,lesson.scene.links.length - expected.length);
    assert.equal(focused.title,view.title); assert.equal(focused.description,view.description); assert.equal(focused.scene.guide,undefined); assertGeometry(focused.scene);
  }
});

test('explanation emphasis retains the overview; authored reveal, statuses, and filters only project original model', () => {
  const { lesson } = fixture(), before = clone(lesson), explanation = { id:'failure', title:'Server unavailable', description:'Inspect the supplied components', nodeIds:['a'],linkIds:['a-c'],statuses:{a:'unavailable',c:'under-pressure'} };
  const emphasized = presentSpatialLesson(lesson,{collapsed:[],explanation});
  assert.equal(emphasized.scene.nodes.length,4); assert.equal(emphasized.scene.links.length,5);
  assert.equal(emphasized.scene.nodes.find(n => n.id === 'a').status,'unavailable'); assert.equal(emphasized.scene.nodes.find(n => n.id === 'c').status,'under-pressure');
  const revealed = presentSpatialLesson(lesson,{collapsed:[],explanation:{...explanation,revealNodeIds:['a','c']}});
  assert.deepEqual(revealed.scene.nodes.map(n=>n.id),['a','c']); assert.deepEqual(revealed.scene.links.map(l=>l.id),['a-c','c-a']); assert.equal(revealed.omittedNodes,2); assert.equal(revealed.omittedLinks,3);
  const filtered = presentSpatialLesson(lesson,{collapsed:[],filter:'read'}); assert.deepEqual(filtered.scene.links.map(l=>l.id),['c-a']); assert.equal(filtered.scene.nodes.length,4);
  assert.deepEqual(lesson,before);
});

test('collapse combines matching external directions and meanings, retains conditional routes, and preserves explicit null endpoints', () => {
  const { lesson } = fixture(), projected = presentSpatialLesson(lesson,{collapsed:['servers']});
  const writes = projected.scene.links.find(link => link.source === 'group:servers' && link.target === 'c');
  assert.deepEqual(writes.origins,['a-c','b-c']); assert.equal(writes.meaning,'write'); assert.equal(writes.arrow,true); assert.equal(writes.dashed,false);
  const reverse = projected.scene.links.find(link => link.source === 'c'); assert.equal(reverse.target,'group:servers'); assert.equal(reverse.dashed,true); assert.deepEqual(reverse.origins,['c-a']);
  assert.equal(projected.scene.links.find(link=>link.id==='unattached').source,null); assert.equal(projected.scene.links.find(link=>link.id==='unattached').arrow,false);
  assert.equal(projected.omittedLinks,1); assertGeometry(projected.scene);
});

test('parallel links use distinct tracks and every route clears intervening cards', () => {
  const { base } = fixture(); base.links = [0,1,2].map(index=>({id:`parallel-${index}`,source:'a',target:'c',label:'request',dashed:false,arrow:true,points:[[0,0],[1,1]]}));
  const teaching = content({nodeRoles:{a:{lane:0,order:0},b:{lane:1,order:0},c:{lane:2,order:0},d:{lane:1,order:1}}});
  const scene = layoutSpatialScene('fixture','parallel',base,teaching); assertGeometry(scene);
  assert.equal(new Set(scene.links.map(link=>JSON.stringify(link.points))).size,3);
});

test('bad references, duplicate membership, unknown views/groups, and invalid statuses fail descriptively', () => {
  const { lesson } = fixture();
  const invalid = mutate => { const copy = clone(lesson); mutate(copy); return copy; };
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.scene.nodes[1].semanticId=l.scene.nodes[0].semanticId)),/duplicate semantic node identities/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.scene.links[0].source='missing')),/connection a-c references missing node missing/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.groups[0].members.push('missing'))),/group servers references missing node missing/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.groups[0].members.push('a'))),/duplicate members/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.views[0].members.push('missing'))),/view write references missing node missing/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.views[0].linkIds=['missing'])),/view write references missing connection missing/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.views[0].linkIds=['b-c'])),/view write connection b-c has endpoint outside declared members/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.views[0].linkIds=['unattached'])),/view write connection unattached has endpoint outside declared members/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.views[0].linkIds=['a-c','a-c'])),/view write has duplicate connection IDs/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.scenes.push({id:'bad',title:'Bad',description:'',nodeIds:['missing'],linkIds:[]}))),/scene bad references missing node missing/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.scenes.push({id:'bad',title:'Bad',description:'',nodeIds:[],linkIds:['missing']}))),/scene bad references missing connection missing/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.scenes.push({id:'bad',title:'Bad',description:'',nodeIds:[],linkIds:[],statuses:{a:'broken'}}))),/unknown status broken/);
  assert.throws(()=>validateSpatialLesson(invalid(l=>l.content.predictions.push({id:'bad',options:['a','b'],correctIndex:4,reveal:{nodeIds:[],linkIds:[]}}))),/invalid answer options/);
  assert.throws(()=>presentSpatialLesson(lesson,{collapsed:['missing']}),/missing collapse group missing/);
  assert.throws(()=>presentSpatialLesson(lesson,{collapsed:[],viewId:'missing'}),/missing teaching view missing/);
  assert.throws(()=>presentSpatialLesson(lesson,{collapsed:[],explanation:{id:'bad',title:'',description:'',nodeIds:[],linkIds:[],revealNodeIds:['missing']}}),/references missing node missing/);
});


test('lesson data loads in a fresh process without depending on diagram component import order', () => {
  const result = spawnSync(process.execPath, ['-e', String.raw`
    const fs = require('node:fs'), ts = require('typescript');
    for (const extension of ['.ts','.tsx']) require.extensions[extension] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename }).outputText, filename);
    const { getSpatialLesson } = require('./src/lib/spatial-learning.ts');
    const { chapters } = require('./src/content/chapters.ts');
    let count = 0;
    for (const chapter of chapters) for (const step of chapter.steps) { getSpatialLesson(chapter.id,step.diagramId); count++; }
    if (count !== 116) throw new Error('Expected all 116 live lessons');
  `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status,0,result.stderr || result.stdout);
});


test('saved prediction attempts reject malformed data and restore only valid choices with strict reveal flags', () => {
  const predictions = [
    { id:'first', options:['A','B','C'] }, { id:'second', options:['A','B'] }, { id:'third', options:['A','B'] },
  ];
  for (const value of [null,'','{','null','42','[]','"text"']) assert.deepEqual(decodeDiagramAttempts(value,predictions),{});
  assert.deepEqual(decodeDiagramAttempts(JSON.stringify({
    first:{choice:2,revealed:true}, second:{choice:0,revealed:'true'}, third:{choice:1,revealed:1}, unknown:{choice:0,revealed:true},
  }),predictions),{first:{choice:2,revealed:true},second:{choice:0,revealed:false},third:{choice:1,revealed:false}});
  for (const choice of [-1,3,1.5,'1',null]) assert.deepEqual(decodeDiagramAttempts(JSON.stringify({first:{choice,revealed:true}}),predictions),{});
  for (const attempt of [null,[],true,'choice',{}, {revealed:true}]) assert.deepEqual(decodeDiagramAttempts(JSON.stringify({first:attempt}),predictions),{});
  assert.deepEqual(decodeDiagramAttempts(JSON.stringify({first:{choice:0},second:{choice:1,revealed:false}}),predictions),{first:{choice:0,revealed:false},second:{choice:1,revealed:false}});
});

test('lesson continuity follows semantic identity across IDs, excludes other chapters, and remains stable on remount', () => {
  const { lesson } = fixture();
  const previous = { ...lesson.scene, chapterId:'continuity-test', lessonId:'before', title:'Before', nodes: [
    { ...lesson.scene.nodes[0], id:'old-a', semanticId:'component-a', title:'A' },
    { ...lesson.scene.nodes[1], id:'old-b', semanticId:'component-b', title:'B' },
    { ...lesson.scene.nodes[2], id:'old-c', semanticId:'component-c', title:'C' },
  ] };
  const current = { ...lesson.scene, chapterId:'continuity-test', lessonId:'after', title:'After', nodes: [
    { ...lesson.scene.nodes[0], id:'new-a', semanticId:'component-a', title:'A again' },
    { ...lesson.scene.nodes[1], id:'new-d', semanticId:'component-d', title:'D' },
  ] };
  const expected = { retained:1, added:['D'], removed:['B','C'], previousTitle:'Before' };
  assert.deepEqual(compareSpatialLessons(previous,current),expected);
  assert.equal(compareSpatialLessons(previous,{...current,chapterId:'another-chapter'}),null);
  assert.equal(compareSpatialLessons(previous,{...current,lessonId:'before'}),null);
  assert.equal(rememberSpatialLesson(previous),null);
  assert.equal(rememberSpatialLesson({...previous}),null);
  assert.deepEqual(rememberSpatialLesson(current),expected);
  assert.deepEqual(rememberSpatialLesson({...current}),expected);
  assert.deepEqual(rememberSpatialLesson(previous),{retained:1,added:['B','C'],removed:['D'],previousTitle:'After'});
  assert.equal(rememberSpatialLesson({...current,chapterId:'continuity-other'}),null);
});

test('all 116 lessons contain explanations and predictions, with authored subset reveals and compact focused views', () => {
  const all = lessons(); let subsetPredictions = 0, subsetScenes = 0, subsetViews = 0;
  assert.equal(all.length,116);
  for (const { step, lesson } of all) {
    assert.ok(lesson.content.scenes.length > 0,`explanations ${step.id}`);
    assert.ok(lesson.content.predictions.length > 0,`predictions ${step.id}`);
    const nodes = new Set(lesson.scene.nodes.map(node=>node.id));
    for (const scene of lesson.content.scenes) {
      assert.ok(scene.title.trim() && scene.description.trim(),`explanation prose ${scene.id}`);
      assert.ok(scene.nodeIds.length > 0,`explanation members ${scene.id}`);
      assert.ok(scene.nodeIds.every(id=>nodes.has(id)),scene.id);
      if (scene.nodeIds.length < nodes.size) subsetScenes++;
    }
    for (const prediction of lesson.content.predictions) {
      assert.ok(prediction.prompt.trim() && prediction.explanation.trim(),`prediction prose ${prediction.id}`);
      assert.ok(prediction.reveal.title.trim() && prediction.reveal.description.trim(),`reveal prose ${prediction.id}`);
      assert.ok(prediction.reveal.nodeIds.length > 0,`reveal members ${prediction.id}`);
      assert.ok(prediction.reveal.nodeIds.every(id=>nodes.has(id)),prediction.id);
      if (prediction.reveal.nodeIds.length < nodes.size) subsetPredictions++;
      const revealed = presentSpatialLesson(lesson,{collapsed:[],explanation:prediction.reveal});
      assert.ok(revealed.scene.nodes.length > 0,`visible reveal ${prediction.id}`);
      // Emphasis changes focus; only explicit authored visibility lists or views reduce membership.
      if (!prediction.reveal.revealNodeIds && !prediction.reveal.viewId) assert.equal(revealed.scene.nodes.length,lesson.scene.nodes.length);
    }
    for (const view of lesson.content.views) if (view.members.length < nodes.size) {
      const focused = presentSpatialLesson(lesson,{collapsed:[],viewId:view.id});
      assert.ok(focused.omittedNodes > 0,`genuine subset ${view.id}`); subsetViews++;
    }
  }
  assert.ok(subsetPredictions >= 90,`${subsetPredictions} prediction subsets`);
  assert.ok(subsetScenes >= 100,`${subsetScenes} explanation subsets`);
  assert.ok(subsetViews >= 100,`${subsetViews} focused subsets`);
});


test('explicit teaching-view relationships exclude conditional alternatives without changing original edges', () => {
  const cache = getSpatialLesson('scaling','cache');
  const hit = presentSpatialLesson(cache,{collapsed:[],viewId:'cache:view:hit'});
  assert.deepEqual(hit.scene.links.map(link=>link.id),['cache:relation:1','cache:relation:2']);
  assert.ok(!hit.scene.links.some(link=>link.id==='cache:relation:5'),'miss-only cache fill stays outside hit view');
  const { lesson } = fixture(); lesson.content.views[0].linkIds = ['a-c'];
  const before = clone(lesson), focused = presentSpatialLesson(lesson,{collapsed:[],viewId:'write'});
  assert.deepEqual(focused.scene.links.map(link=>link.id),['a-c']);
  const original = lesson.scene.links.find(link=>link.id==='a-c'), selected = focused.scene.links[0];
  for (const property of ['source','target','label','meaning','condition','explanation','arrow','dashed']) assert.equal(selected[property],original[property]);
  assert.deepEqual(selected.origins,['a-c']); assert.equal(focused.omittedLinks,4); assertGeometry(focused.scene);
  assert.deepEqual(presentSpatialLesson(lesson,{collapsed:[],viewId:'write',filter:'read'}).scene.links,[]);
  const collapsed = presentSpatialLesson(lesson,{collapsed:['servers'],viewId:'write'});
  assert.deepEqual(collapsed.scene.links.flatMap(link=>link.origins),['a-c']); assert.equal(collapsed.scene.links[0].source,'group:servers');
  focused.scene.nodes[0].title = 'Changed presentation'; selected.points[0][0] = -999; selected.origins.push('changed');
  assert.deepEqual(lesson,before);
  lesson.content.views[0].linkIds = [];
  const unconnected = presentSpatialLesson(lesson,{collapsed:[],viewId:'write'});
  assert.equal(unconnected.scene.nodes.length,2); assert.equal(unconnected.scene.links.length,0); assert.equal(unconnected.omittedLinks,lesson.scene.links.length);
});
