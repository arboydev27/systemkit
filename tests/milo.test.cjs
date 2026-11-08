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
const milo = require('../src/lib/milo.ts');
const { MILO } = require('../src/lib/milo-figure.ts');

const graph = buildOrbGraph(chapters);
const ledge = milo.ledgeOf(graph);
const chapterOf = (lesson) => { let chapter = 0; while (graph.chapterStarts[chapter + 1] <= lesson) chapter++; return chapter; };

test('every lesson has a tick on the line, in course order, inside its part', () => {
  assert.equal(ledge.lessons.length, graph.titles.length);
  for (let lesson = 0; lesson < ledge.lessons.length; lesson++) {
    const at = ledge.lessons[lesson];
    assert.ok(at >= 0 && at <= 1, `lesson ${lesson} at ${at}`);
    if (lesson > 0) assert.ok(at > ledge.lessons[lesson - 1], `lesson ${lesson} comes after the one before`);
    const part = ledge.parts[graph.chapterParts[chapterOf(lesson)]];
    assert.ok(at > part.start && at < part.end, `lesson ${lesson} sits in its part`);
  }
});

test('the four parts share the line equally, so even the smallest has room for its name', () => {
  assert.equal(ledge.parts.length, graph.partTitles.length);
  const widths = ledge.parts.map((part) => part.end - part.start);
  for (const width of widths) assert.ok(Math.abs(width - widths[0]) < 1e-9);
  assert.ok(Math.abs(ledge.parts[0].start) < 1e-9 && Math.abs(ledge.parts.at(-1).end - 1) < 1e-9);
  for (let part = 1; part < ledge.parts.length; part++) assert.ok(ledge.parts[part].start > ledge.parts[part - 1].end, 'a gap between parts');
});

test('chapters are told apart by a wider step between them than between their own lessons', () => {
  for (let lesson = 1; lesson < ledge.lessons.length; lesson++) {
    if (chapterOf(lesson) === chapterOf(lesson - 1) || graph.chapterParts[chapterOf(lesson)] !== graph.chapterParts[chapterOf(lesson - 1)]) continue;
    const across = ledge.lessons[lesson] - ledge.lessons[lesson - 1];
    const within = ledge.lessons[lesson + 1] - ledge.lessons[lesson];
    if (chapterOf(lesson + 1) === chapterOf(lesson)) assert.ok(across > within * 1.5, `the step into chapter ${chapterOf(lesson)} is wider`);
  }
});

test('the line is the same every time', () => {
  assert.deepEqual(milo.ledgeOf(graph), ledge);
});

test('pointing anywhere on the line finds the nearest lesson, and each tick finds its own', () => {
  for (let lesson = 0; lesson < ledge.lessons.length; lesson++) assert.equal(milo.nearestLesson(ledge.lessons, ledge.lessons[lesson]), lesson);
  assert.equal(milo.nearestLesson(ledge.lessons, -1), 0);
  assert.equal(milo.nearestLesson(ledge.lessons, 2), ledge.lessons.length - 1);
  for (let at = 0; at <= 1; at += 0.013) {
    const found = milo.nearestLesson(ledge.lessons, at);
    const best = Math.min(...ledge.lessons.map((x) => Math.abs(x - at)));
    assert.ok(Math.abs(Math.abs(ledge.lessons[found] - at) - best) < 1e-12);
  }
});

test('Milo sits over his lesson, but never hangs off either end of the stage', () => {
  const line = { left: 600, width: 760 };
  const bounds = { left: 16, right: 1424 };
  assert.equal(milo.seatX(0.5, line, 400, bounds), 980);
  assert.equal(milo.seatX(1, line, 400, bounds), 1224);
  assert.equal(milo.seatX(0, line, 400, bounds), 600);
  assert.equal(milo.seatX(0, { left: 16, width: 358 }, 260, { left: 16, right: 374 }), 146);
  // A stage narrower than he is keeps him in its middle.
  assert.equal(milo.seatX(0.3, line, 500, { left: 0, right: 300 }), 150);
});

test('his eyes follow a target but never leave his screen, and look straight ahead at nothing', () => {
  assert.deepEqual(milo.gaze(0, 0), { x: 0, y: 0 });
  const { display, eyes } = MILO;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
    for (const far of [0.05, 0.4, 3, 400]) {
      const look = milo.gaze(Math.cos(angle) * far, Math.sin(angle) * far);
      for (const eye of eyes) {
        assert.ok(Math.abs(eye.x + look.x - display.x) + eye.rx <= display.rx * 0.98, 'inside sideways');
        assert.ok(Math.abs(eye.y + look.y - display.y) + eye.ry <= display.ry * 0.98, 'inside up and down');
      }
      // They look the way the target is.
      if (Math.abs(Math.cos(angle)) > 0.2) assert.equal(Math.sign(look.x), Math.sign(Math.cos(angle)));
      if (Math.abs(Math.sin(angle)) > 0.2) assert.equal(Math.sign(look.y), Math.sign(Math.sin(angle)));
    }
  }
  // Nearer targets pull less than far ones.
  assert.ok(Math.abs(milo.gaze(0.1, 0).x) < Math.abs(milo.gaze(1, 0).x));
});

test('the head leans the way the eyes look, and only a little', () => {
  const right = milo.lean(milo.gaze(10, 0));
  const left = milo.lean(milo.gaze(-10, 0));
  assert.ok(right.tilt > 0 && left.tilt < 0);
  assert.ok(Math.abs(right.tilt) <= 2.2 + 1e-9);
  assert.deepEqual(milo.lean({ x: 0, y: 0 }), { tilt: 0, x: 0, y: 0 });
});

test('blinks come every few seconds, now and then twice', () => {
  for (let random = 0; random <= 1; random += 0.05) {
    const wait = milo.nextBlink(random, false);
    assert.ok(wait >= 2600 && wait <= 6800);
  }
  assert.equal(milo.nextBlink(0.1, true), 180);
  assert.ok(milo.nextBlink(0.5, true) >= 2600);
});

test('the speech bubble goes on the roomier side', () => {
  assert.equal(milo.bubbleSide(300, { left: 0, right: 1440 }), 'right');
  assert.equal(milo.bubbleSide(1200, { left: 0, right: 1440 }), 'left');
});

test('the figure geometry has two eyes side by side on the screen, and the seat below them', () => {
  const [left, right] = MILO.eyes;
  assert.ok(left.x < right.x);
  assert.ok(Math.abs(left.y - right.y) < 0.01);
  assert.ok(MILO.seat[1] > MILO.neck[1] && MILO.neck[1] > MILO.display.y);
  for (const name of ['light-body', 'light-head', 'dark-body', 'dark-head']) {
    for (const size of ['', '-s']) assert.ok(fs.existsSync(`public/milo/${name}${size}.webp`), `${name}${size}.webp`);
  }
});

test('the images are the size the figure geometry says', () => {
  // A WebP's canvas size, from its VP8X (extended) or VP8L (lossless) header.
  const size = (file) => {
    const b = fs.readFileSync(file);
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]; }
    throw new Error(`${file}: unexpected WebP chunk ${chunk}`);
  };
  for (const name of ['light-body', 'light-head', 'dark-body', 'dark-head']) {
    assert.deepEqual(size(`public/milo/${name}.webp`), [MILO.width, MILO.height], name);
    // The smaller layers are scaled in each direction and rounded separately, so the height may be a pixel off the ratio.
    const [sw, sh] = size(`public/milo/${name}-s.webp`);
    assert.equal(sw, MILO.small, `${name}-s width`);
    assert.ok(Math.abs(sh - MILO.height * MILO.small / MILO.width) <= 1, `${name}-s height ${sh}`);
  }
});

test('the stylesheets lay him out with the renders\' own proportions, seat and neck', () => {
  const css = (name) => fs.readFileSync(`src/components/site/${name}.module.css`, 'utf8');
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-4, `${what}: ${a} against ${b}`);
  const milo = css('Milo');
  const [, w, h] = milo.match(/aspect-ratio: (\d+) \/ (\d+)/);
  assert.deepEqual([+w, +h], [MILO.width, MILO.height], 'figure aspect ratio');
  const [, ox, oy] = milo.match(/transform-origin: ([\d.]+)% ([\d.]+)%/);
  near(ox / 100, MILO.neck[0], 'head turns on the neck (x)');
  near(oy / 100, MILO.neck[1], 'head turns on the neck (y)');
  for (const name of ['MiloHome', 'CourseNav']) {
    const sheet = css(name);
    const ratios = [...sheet.matchAll(/var\(--milo-h\) \* (\d+) \/ (\d+)/g)];
    assert.ok(ratios.length > 0, `${name}: width from height`);
    for (const [, a, b] of ratios) assert.deepEqual([+a, +b], [MILO.width, MILO.height], `${name}: width from height`);
    near(+sheet.match(/--line-y: calc\(var\(--milo-h\) \* ([\d.]+)/)[1], MILO.seat[1], `${name}: the line at his seat`);
    near(+sheet.match(/top: calc\(var\(--line-y\) - var\(--milo-h\) \* ([\d.]+)\)/)[1], MILO.seat[1], `${name}: the figure placed on the line`);
  }
});

test('the images\' sizes hints are his height on each layout times the renders\' aspect', () => {
  const read = (file) => fs.readFileSync(`src/components/site/${file}`, 'utf8');
  const width = (heights) => heights.split(',').map((term) => {
    const [, value, unit] = term.trim().match(/^([\d.]+)(svh|vw|px)$/);
    return `${Math.round(value * MILO.width / MILO.height)}${unit === 'svh' ? 'vh' : unit}`;
  }).join(', ');
  const hint = read('MiloHome.tsx').match(/const FIGURE_SIZES = "([^"]+)"/)[1];
  const layouts = [...read('MiloHome.module.css').matchAll(/--milo-h: min\(([^)]+)\)/g)].map((match) => match[1]);
  assert.equal(layouts.length, 3);
  for (const heights of layouts) assert.ok(hint.includes(`min(${width(heights)})`), `home: min(${heights}) wants min(${width(heights)})`);
  const learn = read('CourseNav.module.css').match(/--milo-h: clamp\(([^)]+)\)/)[1];
  assert.ok(read('CourseMap.tsx').includes(`sizes="clamp(${width(learn)})"`), `learn: clamp(${width(learn)})`);
});
