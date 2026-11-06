#!/usr/bin/env node
// Checks one chapter against docs/content-guide.md: node scripts/content-check.cjs <chapter-id>
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};

const contentFiles = { scaling: "chapter", url: "url-shortener", notification: "notifications" };
const teachingFiles = { url: "url", "news-feed": "news-feed" };
const MIN_WORDS = 150, MAX_WORDS = 320, TARGET_MEAN = 170;

const { quizIssues, longestOptionShare, MAX_LONGEST_SHARE } = require(path.join(root, "src/lib/quiz.ts"));
const { spatialScene } = require(path.join(root, "src/lib/spatial-model.ts"));
const { layoutSpatialScene, validateSpatialLesson } = require(path.join(root, "src/lib/spatial-layout.ts"));

function exportEndingWith(module, suffix) {
  const key = Object.keys(module).find((name) => name.toLowerCase().endsWith(suffix));
  if (!key) throw new Error(`No export ending in "${suffix}"`);
  return module[key];
}

function checkChapter(id) {
  const problems = [];
  const contentPath = path.join(root, "src/content", `${contentFiles[id] ?? id}.ts`);
  if (!fs.existsSync(contentPath)) return [`missing ${path.relative(root, contentPath)}`];
  const content = require(contentPath);
  const steps = exportEndingWith(content, "steps");
  const questions = exportEndingWith(content, "questions");
  const stepIds = new Set(steps.map((step) => step.id));

  const words = steps.map((step) => step.body.join(" ").trim().split(/\s+/).length);
  steps.forEach((step, index) => {
    if (words[index] < MIN_WORDS) problems.push(`${step.id}: body has ${words[index]} words, needs at least ${MIN_WORDS}`);
    if (words[index] > MAX_WORDS) problems.push(`${step.id}: body has ${words[index]} words, keep it under ${MAX_WORDS}`);
    if (!step.seoTitle) problems.push(`${step.id}: missing seoTitle`);
    else if (step.seoTitle.length > 62) problems.push(`${step.id}: seoTitle is ${step.seoTitle.length} characters, keep it to 62`);
    if (step.takeaways.length < 2) problems.push(`${step.id}: needs at least 2 takeaways`);
    if (!step.scenario || !step.scenarioAnswer) problems.push(`${step.id}: needs a scenario and scenarioAnswer`);
    const count = questions.filter((question) => question.stepId === step.id).length;
    if (count < 2) problems.push(`${step.id}: has ${count} questions, needs at least 2`);
  });
  const mean = words.reduce((sum, value) => sum + value, 0) / (words.length || 1);
  if (mean < TARGET_MEAN) problems.push(`chapter mean is ${Math.round(mean)} body words, target ${TARGET_MEAN}+`);

  const ids = new Set();
  for (const question of questions) {
    if (ids.has(question.id)) problems.push(`${question.id}: duplicate question id`);
    ids.add(question.id);
    if (!stepIds.has(question.stepId)) problems.push(`${question.id}: unknown stepId ${question.stepId}`);
    if (!["Recall", "Apply", "Diagnose"].includes(question.difficulty)) problems.push(`${question.id}: unknown difficulty`);
    for (const issue of quizIssues(question)) problems.push(`${question.id}: ${issue}`);
  }
  const share = longestOptionShare(questions);
  if (share > MAX_LONGEST_SHARE) problems.push(`correct option is the longest in ${Math.round(share * 100)}% of questions, keep it at or under ${MAX_LONGEST_SHARE * 100}%`);

  // Diagram predictions are shown to learners too, so the same rules apply.
  const teachingPath = path.join(root, "src/content/spatial-learning", `${teachingFiles[id] ?? id}.ts`);
  const stems = new Set(questions.map((question) => question.prompt.trim().toLowerCase()));
  if (!fs.existsSync(teachingPath)) problems.push(`missing ${path.relative(root, teachingPath)}`);
  else {
    const teaching = exportEndingWith(require(teachingPath), "teachingcontent");
    for (const [diagramId, lesson] of Object.entries(teaching)) {
      for (const prediction of lesson.predictions) {
        for (const issue of quizIssues(prediction)) problems.push(`prediction ${prediction.id}: ${issue}`);
        if (stems.has(prediction.prompt.trim().toLowerCase())) problems.push(`prediction ${prediction.id}: prompt repeats a quiz question`);
      }
      const scenePath = path.join(root, "src/content/diagrams", `${id}.json`);
      if (fs.existsSync(scenePath)) {
        const raw = JSON.parse(fs.readFileSync(scenePath, "utf8"))[diagramId];
        if (!raw) { problems.push(`${diagramId}: teaching content has no matching diagram`); continue; }
        try {
          const lessonId = steps.find((step) => step.diagramId === diagramId)?.id ?? diagramId;
          validateSpatialLesson({ scene: layoutSpatialScene(id, lessonId, spatialScene(diagramId, raw, 104), lesson), content: lesson });
        } catch (error) { problems.push(`${diagramId}: ${error.message}`); }
      }
    }
    const missing = steps.filter((step) => !teaching[step.diagramId]);
    for (const step of missing) problems.push(`${step.id}: no teaching content for diagram ${step.diagramId}`);
  }

  const scenePath = path.join(root, "src/content/diagrams", `${id}.json`);
  if (fs.existsSync(scenePath)) {
    const scenes = JSON.parse(fs.readFileSync(scenePath, "utf8"));
    for (const step of steps) if (!scenes[step.diagramId]) problems.push(`${step.id}: no diagram ${step.diagramId}`);
    for (const [diagramId, scene] of Object.entries(scenes)) {
      if (!["flow", "comparison"].includes(scene.kind)) problems.push(`${diagramId}: kind must be flow or comparison`);
      if (scene.items?.length !== 4) problems.push(`${diagramId}: needs exactly 4 items`);
      for (const item of scene.items ?? []) {
        if (item.title.length > 20) problems.push(`${diagramId}: item title "${item.title}" is over 20 characters`);
        if (item.detail.length > 28) problems.push(`${diagramId}: item detail "${item.detail}" is over 28 characters`);
      }
      if (scene.title.length > 60) problems.push(`${diagramId}: title is over 60 characters`);
      if (scene.note.length > 90) problems.push(`${diagramId}: note is over 90 characters`);
    }
  }

  const challengeDir = path.join(root, "src/content/challenges");
  if (fs.existsSync(challengeDir)) {
    for (const file of fs.readdirSync(challengeDir).filter((name) => name.endsWith(".ts") && name !== "index.ts")) {
      const challenge = exportEndingWith(require(path.join(challengeDir, file)), "challenge");
      if (challenge.chapterId !== id) continue;
      if (!stepIds.has(challenge.stepId)) problems.push(`challenge ${challenge.id}: unknown stepId ${challenge.stepId}`);
      const fieldIds = challenge.fields.map((field) => field.id).join();
      if (fieldIds !== "estimate,architecture,resilience,adaptation") problems.push(`challenge ${challenge.id}: fields must be estimate, architecture, resilience, adaptation`);
      if (challenge.rubric.length !== 5) problems.push(`challenge ${challenge.id}: needs 5 rubric items`);
      if (challenge.solutions.length !== 2) problems.push(`challenge ${challenge.id}: needs 2 solutions`);
      for (const key of ["title", "summary", "brief", "change", "estimateGuide", "adaptationTitle"]) if (!challenge[key]) problems.push(`challenge ${challenge.id}: missing ${key}`);
      if (!(challenge.minutes > 0)) problems.push(`challenge ${challenge.id}: missing minutes`);
    }
  }

  console.log(`${id}: ${steps.length} lessons, ${questions.length} questions, ${Math.round(mean)} mean body words (${Math.min(...words)}-${Math.max(...words)}), correct option longest in ${Math.round(share * 100)}%`);
  return problems;
}

const targets = process.argv.slice(2);
if (!targets.length) { console.error("Usage: node scripts/content-check.cjs <chapter-id> [more ids]"); process.exit(2); }
let failed = false;
for (const id of targets) {
  const problems = checkChapter(id);
  if (problems.length) failed = true;
  for (const problem of problems) console.log(`  - ${problem}`);
}
console.log(failed ? "Problems found." : "All checks passed.");
process.exit(failed ? 1 : 0);
