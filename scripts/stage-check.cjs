#!/usr/bin/env node
// Checks animated lesson stages: node scripts/stage-check.cjs <chapter-id> [lesson-file ...]
// With no lesson files it checks every scene the chapter's index.ts lists, and names scene files it doesn't list yet as not wired.
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
if (!fs.existsSync(path.join(dir, "index.ts"))) { console.error(`No ${path.relative(root, path.join(dir, "index.ts"))}`); process.exit(2); }
const staged = require(path.join(dir, "index.ts")).staged;
const sceneFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts").map((f) => f.replace(/\.ts$/, ""));
const files = only.length ? only : staged;
let failed = false, written = 0;
for (const name of files) {
  const file = path.join(dir, `${name}.ts`);
  if (!fs.existsSync(file)) { console.log(`${name}: missing ${path.relative(root, file)}`); failed = true; continue; }
  // The scene is the first export with an id, steps and nodes, as the player finds it.
  const scene = Object.values(require(file)).find((value) => value && typeof value === "object" && "id" in value && "steps" in value && "nodes" in value);
  if (!scene) { console.log(`${name}: exports no scene`); failed = true; continue; }
  written++;
  const problems = validateScene(scene);
  if (scene.id !== name) problems.push(`${name}: scene id "${scene.id}" should match its file name`);
  console.log(`${name}: ${scene.steps.length} steps, ${scene.nodes.length} parts${problems.length ? "" : ", ok"}`);
  for (const p of problems) console.log(`  - ${p}`);
  if (problems.length) failed = true;
}
if (!only.length) for (const name of sceneFiles.filter((n) => !staged.includes(n))) console.log(`${name}: not wired (add it to index.ts and player.tsx)`);
console.log(failed ? "Problems found." : `${written} scene(s) passed.`);
process.exit(failed ? 1 : 0);
