const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};
const { chapters, coursePartTitles, goalPaths } = require('../src/content/chapters.ts');
const { designChallenges } = require('../src/content/challenges/index.ts');
const { labs } = require('../src/content/labs.ts');
const { getSpatialLesson } = require('../src/lib/spatial-learning.ts');
const { correctIsStrictlyLongest, longestOptionShare, MAX_LONGEST_SHARE, optionOrder, quizIssues } = require('../src/lib/quiz.ts');

const allQuestions = chapters.flatMap(chapter => chapter.questions);
const words = step => step.body.join(' ').trim().split(/\s+/).length;

test('no chapter lets a learner pass by picking the longest option', () => {
  for (const chapter of chapters) assert.ok(longestOptionShare(chapter.questions) <= MAX_LONGEST_SHARE, `${chapter.id}: ${longestOptionShare(chapter.questions)}`);
  const score = allQuestions.filter(correctIsStrictlyLongest).length / allQuestions.length;
  assert.ok(score <= 0.3, `across the course the longest option is correct ${Math.round(score * 100)}% of the time`);
});

test('every checkpoint and diagram prediction meets the option rules', () => {
  for (const question of allQuestions) assert.deepEqual(quizIssues(question), [], question.id);
  for (const chapter of chapters) for (const step of chapter.steps) {
    for (const prediction of getSpatialLesson(chapter.id, step.diagramId).content.predictions) assert.deepEqual(quizIssues(prediction), [], prediction.id);
  }
});

test('the correct answer is spread evenly across displayed positions', () => {
  const positions = [0, 0, 0, 0];
  for (const question of allQuestions) positions[optionOrder(question.id, question.options.length).indexOf(question.correctIndex)]++;
  for (const count of positions) {
    const share = count / allQuestions.length;
    assert.ok(share > 0.17 && share < 0.33, `positions ${positions}`);
  }
});

test('diagram predictions ask something other than the checkpoints', () => {
  for (const chapter of chapters) {
    const stems = new Set(chapter.questions.map(question => question.prompt.trim().toLowerCase()));
    for (const step of chapter.steps) for (const prediction of getSpatialLesson(chapter.id, step.diagramId).content.predictions) {
      assert.ok(!stems.has(prediction.prompt.trim().toLowerCase()), prediction.id);
    }
  }
});

test('every lesson has a real explanation, a searchable title, a decision, and checkpoints', () => {
  const seoTitles = new Set();
  for (const chapter of chapters) for (const step of chapter.steps) {
    const id = `${chapter.id}/${step.id}`;
    assert.ok(words(step) >= 150 && words(step) <= 320, `${id}: ${words(step)} words`);
    assert.ok(step.seoTitle && step.seoTitle.length <= 62, `${id}: seoTitle`);
    assert.ok(!seoTitles.has(step.seoTitle), `${id}: duplicate seoTitle ${step.seoTitle}`);
    seoTitles.add(step.seoTitle);
    assert.ok(step.scenario && step.scenarioAnswer, `${id}: decision point`);
    assert.ok(chapter.questions.filter(question => question.stepId === step.id).length >= 2, `${id}: checkpoints`);
  }
});

test('ids stay unique, because links and saved progress depend on them', () => {
  const unique = values => assert.equal(new Set(values).size, values.length);
  unique(chapters.map(chapter => chapter.id));
  unique(chapters.map(chapter => chapter.storageKey));
  for (const chapter of chapters) unique(chapter.questions.map(question => question.id));
  unique(chapters.flatMap(chapter => chapter.steps.map(step => `${chapter.id}/${step.diagramId}`)));
});

test('earlier chapters keep their original storage keys so existing learners keep their progress', () => {
  const key = id => chapters.find(chapter => chapter.id === id).storageKey;
  assert.equal(key('scaling'), 'systemkit:chapter-one:v1');
  assert.equal(key('framework'), 'systemkit:framework:v1');
  assert.equal(key('url'), 'systemkit:url-shortener:v1');
});

test('chapters run in teaching order within parts, with numbers that follow', () => {
  chapters.forEach((chapter, index) => assert.equal(chapter.number, String(index + 1).padStart(2, '0')));
  const seen = chapters.map(chapter => chapter.part).filter((part, index, all) => part !== all[index - 1]);
  assert.deepEqual(seen, [...coursePartTitles], 'each part appears once, in order');
  const position = id => chapters.findIndex(chapter => chapter.id === id);
  assert.ok(position('estimation') < position('scaling'), 'the scaling capstone needs estimation');
  assert.ok(position('consistent-hashing') < position('key-value'), 'key-value uses the ring');
  assert.ok(position('unique-id') < position('url'), 'the URL shortener uses generated ids');
});

test('every goal path covers every chapter exactly once', () => {
  const all = chapters.map(chapter => chapter.id).sort();
  for (const [goal, path] of Object.entries(goalPaths)) assert.deepEqual([...path.order].sort(), all, goal);
});

test('every challenge is complete, placed on a real lesson, and unique', () => {
  const ids = new Set();
  assert.ok(designChallenges.length >= 12);
  for (const challenge of designChallenges) {
    assert.ok(!ids.has(challenge.id), challenge.id); ids.add(challenge.id);
    const chapter = chapters.find(item => item.id === challenge.chapterId);
    assert.ok(chapter, challenge.id);
    assert.equal(challenge.stepId, chapter.steps.at(-1).id, `${challenge.id} belongs on its chapter's last lesson`);
    assert.deepEqual(challenge.fields.map(field => field.id), ['estimate', 'architecture', 'resilience', 'adaptation']);
    assert.equal(challenge.rubric.length, 5);
    assert.equal(challenge.solutions.length, 2);
    assert.ok(challenge.minutes >= 15 && challenge.minutes <= 45);
  }
});

test('every lab points at a lesson that exists', () => {
  for (const lab of labs) {
    const chapter = chapters.find(item => item.id === lab.lesson.chapterId);
    const step = chapter?.steps.find(item => item.id === lab.lesson.stepId);
    assert.ok(step, lab.id);
    assert.equal(lab.lesson.title, step.title, `${lab.id} link text should match the lesson`);
  }
});

test('the lab pages and lessons agree on where each lab lives', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/LearningExperience.tsx'), 'utf8');
  for (const lab of labs) assert.ok(source.includes(`"${lab.lesson.chapterId}/${lab.lesson.stepId}"`), lab.id);
});
