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
const { MILO_TURNS } = require('../src/lib/milo-turns.ts');
const { MILO_3D } = require('../src/lib/milo-3d.ts');

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

test('his head carries most of a turn toward what he looks at, and his torso a little of it', () => {
  const T = MILO_TURNS;
  const right = milo.turnFor(milo.gaze(10, 0), T);
  const left = milo.turnFor(milo.gaze(-10, 0), T);
  assert.ok(right.yaw > 18 && right.yaw <= T.yaws.at(-1) + 1e-9, `far right turns the head ${right.yaw}`);
  assert.ok(left.yaw < -18 && left.yaw >= T.yaws[0] - 1e-9);
  assert.ok(right.twist > 5 && right.twist <= 8 && right.twist < right.yaw / 2, 'the torso follows least');
  assert.ok(milo.turnFor(milo.gaze(0, 10), T).nod > 0 && milo.turnFor(milo.gaze(0, -10), T).nod < 0, 'down is a nod down');
  assert.deepEqual(milo.turnFor({ x: 0, y: 0 }, T), { yaw: 0, nod: 0, twist: 0 });
});

test('the head comes to rest on a rendered frame, and doesn\'t flick between two near the middle', () => {
  const yaws = MILO_TURNS.yaws;
  assert.equal(milo.detent(yaws, 0, 2), 0);
  assert.equal(milo.detent(yaws, 0, 4), 0, 'just past the middle it stays');
  assert.equal(milo.detent(yaws, 0, 5.5), 7, 'well past the middle it moves on');
  assert.equal(milo.detent(yaws, 7, 3), 7, 'and coming back it stays a little longer');
  assert.equal(milo.detent(yaws, 7, 1.5), 0);
  assert.equal(milo.detent(yaws, 0, 20), 21, 'a far target goes straight to the far frame');
  assert.equal(milo.detent(yaws, 0, -40), -21);
});

test('the frames showing for a turn add up to one, and at a frame only that frame shows', () => {
  const { yaws, nods, twists } = MILO_TURNS;
  for (let yaw = -25; yaw <= 25; yaw += 1.75) {
    for (let nod = -10; nod <= 12; nod += 1.5) {
      const weights = milo.headWeights(yaws, nods, yaw, nod);
      const sum = [...weights.values()].reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9 && weights.size <= 4, `yaw ${yaw} nod ${nod}`);
      for (const cell of weights.keys()) assert.ok(cell >= 0 && cell < yaws.length * nods.length);
    }
  }
  yaws.forEach((yaw, column) => nods.forEach((nod, row) => assert.deepEqual([...milo.headWeights(yaws, nods, yaw, nod)], [[row * yaws.length + column, 1]])));
  twists.forEach((twist, index) => assert.deepEqual([...milo.rowWeights(twists, twist)], [[index, 1]]));
  // Halfway between two frames, both show equally; a quarter of the way, the nearer one shows more than three quarters.
  assert.deepEqual([...milo.rowWeights(twists, (twists[0] + twists[1]) / 2)].map(([, w]) => w), [0.5, 0.5]);
  assert.ok(milo.rowWeights(twists, twists[0] + (twists[1] - twists[0]) / 4).get(0) > 0.75);
  const mixed = milo.mixAffine([[1, 0, 0, 1, 0, 0], [3, 0, 0, 1, 10, 0]], new Map([[0, 0.5], [1, 0.5]]));
  assert.deepEqual(mixed, [2, 0, 0, 1, 5, 0]);
});

test('the turn frames\' geometry fits the figure, and the straight-ahead frame is the plain layer', () => {
  const { yaws, nods, twists, head, body } = MILO_TURNS;
  assert.ok(yaws.includes(0) && nods.includes(0) && twists.includes(0));
  for (const values of [yaws, nods, twists]) for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1]);
  assert.equal(head.affine.length, yaws.length * nods.length);
  assert.equal(body.neck.length, twists.length);
  assert.deepEqual([...head.affine[nods.indexOf(0) * yaws.length + yaws.indexOf(0)]], [1, 0, 0, 1, 0, 0]);
  assert.deepEqual([...body.neck[twists.indexOf(0)]], [0, 0]);
  for (const box of [head.box, body.box]) {
    assert.ok(box[0] >= 0 && box[1] >= 0 && box[0] + box[2] <= 1 + 1e-9 && box[1] + box[3] <= 1 + 1e-9, `${box}`);
  }
  // Turning toward the image's right carries his eyes right; nodding down carries them down.
  const at = (yaw, nod) => head.affine[nods.indexOf(nod) * yaws.length + yaws.indexOf(yaw)];
  const eye = [MILO.display.x * MILO.width, MILO.display.y * MILO.height];
  const move = (m) => [m[0] * eye[0] + m[2] * eye[1] + m[4] - eye[0], m[1] * eye[0] + m[3] * eye[1] + m[5] - eye[1]];
  assert.ok(move(at(yaws.at(-1), 0))[0] > 0 && move(at(yaws[0], 0))[0] < 0);
  assert.ok(move(at(0, nods.at(-1)))[1] > 0 && move(at(0, nods[0]))[1] < 0);
  // The neck barely moves as the torso twists: the head rides on it.
  for (const [dx, dy] of body.neck) assert.ok(Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02);
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

test('the turn sprites are the size their geometry says, in AVIF and WebP', () => {
  const webp = (file) => {
    const b = fs.readFileSync(file);
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)]; }
    throw new Error(`${file}: unexpected WebP chunk ${chunk}`);
  };
  // An AVIF's size, from its image spatial extents ('ispe') property.
  const avif = (file) => {
    const b = fs.readFileSync(file);
    const at = b.indexOf('ispe');
    assert.ok(at > 0, `${file}: no ispe`);
    return [b.readUInt32BE(at + 8), b.readUInt32BE(at + 12)];
  };
  const { yaws, nods, twists, head, body } = MILO_TURNS;
  for (const theme of ['light', 'dark']) {
    for (const [name, layer, columns, rows] of [['head', head, yaws.length, nods.length], ['body', body, twists.length, 1]]) {
      for (const [suffix, cell] of [['', layer.cell], ['-s', layer.smallCell]]) {
        const want = [cell[0] * columns, cell[1] * rows];
        const base = `public/milo/${theme}-turns-${name}${suffix}`;
        assert.deepEqual(avif(`${base}.avif`), want, `${base}.avif`);
        assert.deepEqual(webp(`${base}.webp`), want, `${base}.webp`);
      }
      // Each cell is the same shape as the box it fills, give or take rounding.
      const ratio = (layer.box[2] * MILO.width) / (layer.box[3] * MILO.height);
      assert.ok(Math.abs(layer.cell[0] / layer.cell[1] - ratio) < 0.01, `${name} cell shape`);
    }
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
  for (const name of ['body', 'bodyBreath']) {
    const [, sx, sy] = milo.match(new RegExp(`\\.${name} \\{[^}]*transform-origin: ([\\d.]+)% ([\\d.]+)%`));
    near(sx / 100, MILO.seat[0], `${name} turns about the seat (x)`);
    near(sy / 100, MILO.seat[1], `${name} turns about the seat (y)`);
  }
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

test('the map that carries his eyes onto a turned screen takes three points exactly where they go', () => {
  const from = [[100, 200], [300, 200], [100, 260]];
  const map = [0.93, -0.1, 0.05, 1.03, 12, -7];
  const to = from.map(([x, y]) => [map[0] * x + map[2] * y + map[4], map[1] * x + map[3] * y + map[5]]);
  const found = milo.affineFrom(from, to);
  found.forEach((value, i) => assert.ok(Math.abs(value - map[i]) < 1e-9, `${i}: ${value}`));
  assert.deepEqual(milo.affineFrom([[0, 0], [1, 1], [2, 2]], to), [1, 0, 0, 1, 0, 0], 'points in a line give no map');
});

test('the 3D Milo has its model, a matcap for every material in both themes, its shadow and the decoder', () => {
  assert.ok(fs.existsSync(`public${MILO_3D.model}`));
  for (const theme of ['light', 'dark']) {
    for (const material of MILO_3D.materials) assert.ok(fs.existsSync(`public/milo/3d/matcap-${theme}-${material}.webp`), `${theme} ${material}`);
    assert.ok(fs.existsSync(`public/milo/${theme}-shadow.webp`));
  }
  for (const file of ['draco_decoder.wasm', 'draco_wasm_wrapper.js']) assert.ok(fs.existsSync(`public/draco/${file}`), file);
  assert.ok(MILO_3D.materials.includes('shell'), 'parts without a known material fall back to the shell');
  for (const [name, joint] of Object.entries(MILO_3D.joints)) assert.ok(joint.parent === 'root' || joint.parent in MILO_3D.joints, `${name} hangs from a joint`);
  // His eyes sit side by side on his screen, the screen's up pointing up.
  assert.ok(MILO_3D.eyes.left[0] < MILO_3D.eyes.right[0] && Math.abs(MILO_3D.eyes.left[1] - MILO_3D.eyes.right[1]) < 0.01 && MILO_3D.eyes.up[1] > 0.9);
});
