#!/usr/bin/env node
// Checks animated lesson stages: node scripts/stage-check.cjs <chapter-id> [lesson-file ...]
// With no lesson files it checks every scene the chapter has written so far (lessons without one are listed, not failed).
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
require.extensions[".ts"] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(output.outputText, filename);
};
const [chapter, ...only] = process.argv.slice(2);
if (!chapter) { console.error("Usage: node scripts/stage-check.cjs <chapter-id> [lesson-file ...]"); process.exit(2); }
const { validateScene } = require(path.join(root, "src/lib/lesson-stage/validate.ts"));
const dir = path.join(root, "src/content/lesson-stage", chapter);
const files = (only.length ? only : fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts").map((f) => f.replace(/\.ts$/, "")));
let failed = false, written = 0;
for (const name of files) {
  const module = require(path.join(dir, `${name}.ts`));
  const scene = Object.values(module)[0];
  if (!scene) { console.log(`${name}: not written yet`); continue; }
  written++;
  const problems = validateScene(scene);
  if (scene.id !== name) problems.push(`${name}: scene id "${scene.id}" should match its file name`);
  console.log(`${name}: ${scene.steps.length} steps, ${scene.nodes.length} parts${problems.length ? "" : ", ok"}`);
  for (const p of problems) console.log(`  - ${p}`);
  if (problems.length) failed = true;
}
console.log(failed ? "Problems found." : `${written} scene(s) passed.`);
process.exit(failed ? 1 : 0);
