#!/usr/bin/env node
// Builds a standalone page comparing today's pictograms with a candidate set, in both themes at stage and small sizes.
//   node .claude/skills/pictogram-polish/scripts/compare-sheet.mjs [candidate.js] [--out sheet.html]
// The candidate exports POLISHED (role -> () => svg), plinthPolished() and defs(gid); see reference/polished-sample.js.
// Run from the repo root (it reads src/lib/lesson-stage/pictograms.ts and uses the project's typescript).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
const out = resolve(outAt >= 0 ? args[outAt + 1] : "pictogram-sheet.html");
const candidatePath = resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out") ?? join(here, "../reference/polished-sample.js"));

const ts = createRequire(join(root, "package.json"))("typescript");
const today = ts.transpileModule(readFileSync(join(root, "src/lib/lesson-stage/pictograms.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;

// Each module runs in its own scope so their helpers can share names.
const scoped = (source, names) =>
  `const { ${names.join(", ")} } = (() => {\n${source.replace(/^\s*import .*?;\n/gm, "").replace(/^export /gm, "")}\nreturn { ${names.join(", ")} };\n})();\n`;
const modules = scoped(today, ["glyph", "plinth", "ROLE_NAMES"]) + scoped(readFileSync(candidatePath, "utf8"), ["POLISHED", "plinthPolished", "defs"]);

const page = readFileSync(join(here, "../reference/sheet-template.html"), "utf8")
  .replace("__MODULES__", () => modules)
  .replace("__CANDIDATE__", () => relative(root, candidatePath));
writeFileSync(out, page);
console.log(`wrote ${out}`);
