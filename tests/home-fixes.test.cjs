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
const { chapters, coursePartTitles } = require('../src/content/chapters.ts');
const { designChallenges } = require('../src/content/challenges/index.ts');
const { labs } = require('../src/content/labs.ts');
const { homeFixes, retryFix } = require('../src/content/home-fixes.ts');

const lessonOf = (fix) => {
  const chapter = chapters.find((item) => item.id === fix.chapterId);
  const step = chapter?.steps.find((item) => item.id === fix.stepId);
  return { chapter, step, text: step ? [step.summary, ...step.body, ...step.takeaways].join(' ') : '' };
};

test('the home page shows one lesson from each part of the course, in order', () => {
  assert.deepEqual(homeFixes.map((fix) => lessonOf(fix).chapter?.part), [...coursePartTitles]);
});

test("each tile's figures come from its lesson's own text", () => {
  for (const fix of homeFixes) {
    const { step, text } = lessonOf(fix);
    assert.ok(step, `${fix.chapterId}/${fix.stepId} is not a lesson`);
    for (const quote of fix.quotes) assert.ok(text.includes(quote), `${fix.stepId} no longer says “${quote}”`);
    for (const value of fix.readout ? [fix.readout.now, fix.readout.was] : []) {
      const number = value.match(/[\d.]+/)[0];
      assert.ok(text.includes(number), `${fix.stepId}'s readout shows ${value}, which its lesson doesn't mention`);
    }
  }
});

test("the retries tile is the retry storm lab's own run, which recovers only with the lesson's protections", () => {
  const { before, after, readout } = retryFix();
  assert.equal(before.recoveryAfter, null);
  assert.ok(after.recoveryAfter !== null && after.recoveryAfter > 0);
  assert.equal(readout.was, 'never');
  assert.match(readout.now, /^\d+ min$/);
});

test('each tile offers something to try after the lesson: its lab, or its chapter’s design challenge', () => {
  for (const fix of homeFixes) {
    const lab = labs.find((item) => item.lesson.chapterId === fix.chapterId && item.lesson.stepId === fix.stepId);
    const challenge = designChallenges.find((item) => item.chapterId === fix.chapterId);
    assert.ok(lab || challenge, `${fix.stepId} has nothing to try`);
  }
});

test("no tile repeats a fix the scaling game already plays", () => {
  const played = new Set(['scale-web', 'replication', 'cache', 'sharding']);
  for (const fix of homeFixes) assert.ok(!(fix.chapterId === 'scaling' && played.has(fix.stepId)), `${fix.stepId} is already in the game`);
});
