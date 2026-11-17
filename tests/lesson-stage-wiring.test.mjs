import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Source files import each other without extensions, so they load through require with TypeScript transpiling them.
// A scene file can import runtime values only by relative path; type imports are dropped.
const require = createRequire(import.meta.url);
const ts = require("typescript");
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }, fileName: filename });
  module._compile(output.outputText, filename);
};
const { chapters } = require("../src/content/chapters.ts");
const { hasStage, stagedLessons } = require("../src/content/lesson-stage/staged.ts");
const { stateBefore } = require("../src/lib/lesson-stage/model.ts");
const { validateScene } = require("../src/lib/lesson-stage/validate.ts");

const folder = (chapterId) => new URL(`../src/content/lesson-stage/${chapterId}/`, import.meta.url);
const isScene = (value) => value !== null && typeof value === "object" && "id" in value && "steps" in value && "nodes" in value;

for (const chapter of chapters) {
  test(`${chapter.id}: every staged lesson has a valid scene and one line in player.tsx`, () => {
    const dir = folder(chapter.id);
    assert.ok(existsSync(new URL("index.ts", dir)), "the chapter's folder has index.ts");
    assert.ok(existsSync(new URL("player.tsx", dir)), "the chapter's folder has player.tsx");
    const { staged } = require(fileURLToPath(new URL("index.ts", dir)));
    assert.ok(Array.isArray(staged));
    assert.equal(new Set(staged).size, staged.length, "no id is listed twice");
    const diagramIds = new Set(chapter.steps.map((step) => step.diagramId));
    for (const id of staged) {
      assert.ok(diagramIds.has(id), `${id} is one of the chapter's diagram ids`);
      const file = new URL(`${id}.ts`, dir);
      assert.ok(existsSync(file), `${id}.ts exists`);
      const scene = Object.values(require(fileURLToPath(file))).find(isScene);
      assert.ok(scene, `${id}.ts exports a scene`);
      assert.equal(scene.id, id);
      assert.deepEqual(validateScene(scene), []);
      // every step can be reached from the start without errors
      for (let i = 0; i <= scene.steps.length; i++) stateBefore(scene, i);
    }

    const player = readFileSync(new URL("player.tsx", dir), "utf8");
    const lines = [...player.matchAll(/^\s*"([^"]+)": dynamic\(\(\) => import\("\.\/([^"]+)"\)/gm)].map(([, key, target]) => `${key} ${target}`);
    assert.equal((player.match(/dynamic\(/g) ?? []).length, lines.length, `each player line reads "<id>": dynamic(() => import("./<id>")...`);
    assert.deepEqual(lines.toSorted(), staged.map((id) => `${id} ${id}`).toSorted(), "player.tsx has one line per staged id");

    const unlisted = readdirSync(dir).filter((name) => name.endsWith(".ts") && name !== "index.ts")
      .map((name) => name.replace(/\.ts$/, "")).filter((id) => !staged.includes(id));
    assert.deepEqual(unlisted, [], "every scene file is listed in index.ts");

    assert.deepEqual([...stagedLessons[chapter.id]], [...staged]);
    for (const step of chapter.steps) assert.equal(hasStage(chapter.id, step.diagramId), staged.includes(step.diagramId), `hasStage for ${step.diagramId}`);
  });
}

test("every lesson of Scale to a Million Users plays as a stage, in lesson order", () => {
  const scaling = chapters.find((chapter) => chapter.id === "scaling");
  assert.deepEqual([...stagedLessons.scaling], scaling.steps.map((step) => step.diagramId));
});

test("staged.ts and StagePlayer.tsx cover exactly the chapters in chapters.ts", () => {
  const ids = chapters.map((chapter) => chapter.id).toSorted();
  assert.deepEqual(Object.keys(stagedLessons).toSorted(), ids);
  assert.equal(hasStage("no-such-chapter", "cache"), false);
  const stagePlayer = readFileSync(new URL("../src/components/lesson-stage/StagePlayer.tsx", import.meta.url), "utf8");
  const loaded = [...stagePlayer.matchAll(/import\("@\/content\/lesson-stage\/([^/"]+)\/player"\)/g)].map(([, id]) => id);
  assert.deepEqual(loaded.toSorted(), ids);
});
