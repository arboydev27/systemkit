import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { GLYPH_TOP, ROLE_NAMES, addPack, glyph, isDrawn, plinth } from "../src/lib/lesson-stage/pictograms.ts";
import { ROLES, ROLE_IDS, roleProblems } from "../src/lib/lesson-stage/roles.ts";
import { validateScene } from "../src/lib/lesson-stage/validate.ts";

const packDir = new URL("../src/lib/lesson-stage/packs/", import.meta.url);
const packs = {};
for (const file of readdirSync(packDir).filter((f) => f.endsWith(".ts") && f !== "index.ts")) {
  const m = await import(new URL(file, packDir).href);
  packs[file.replace(/\.ts$/, "")] = m;
}
// the classes the stage colours (LessonStage.module.css), the only ones a drawing may use
const css = readFileSync(new URL("../src/components/lesson-stage/LessonStage.module.css", import.meta.url), "utf8");
const CLASSES = new Set([...css.matchAll(/:global\(\.pk \.([a-z][\w-]*)/g)].map((m) => m[1]).concat(["strip", "is-hot"]));
// PICTOGRAM_PACKS=logs,time checks only the core and those packs (for drawing one pack while others are unfinished)
const only = (process.env.PICTOGRAM_PACKS ?? "").split(",").filter(Boolean);
const ROLES_CHECKED = ROLE_IDS.filter((r) => !only.length || !ROLES[r].pack || only.includes(ROLES[r].pack));
const optionsOf = (role) => (ROLES[role].opts ?? "").split(" ").filter(Boolean);

function wellFormed(svg) {
  const stack = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (!m[1]) stack.push(m[2]);
    else if (stack.pop() !== m[2]) return false;
  }
  return stack.length === 0 && !/NaN|undefined|Infinity/.test(svg);
}
function samplesOf(role) {
  const list = [{}];
  for (const o of optionsOf(role)) {
    const [name, range] = o.split(":");
    if (range) { const [lo, hi] = range.split("-").map(Number); list.push({ [name]: lo }, { [name]: hi }); }
    else if (name === "level") list.push({ level: 0 }, { level: 0.5 }, { level: 1, levelHot: true });
    else if (name === "mark") list.push({ mark: 0, count: 2 });
    else if (name === "open") list.push({ open: true }, { open: "half" });
    else list.push({ [name]: true });
  }
  return list.concat([{ lead: true }]);
}

test("every role has a name, a height and either a core drawing or a pack that draws it", () => {
  for (const role of ROLES_CHECKED) {
    assert.ok(ROLE_NAMES[role] && ROLE_NAMES[role].length <= 16, `${role} needs a name of at most 16 characters`);
    assert.ok(GLYPH_TOP[role] > 0, `${role} needs a top`);
    const pack = ROLES[role].pack;
    if (!pack) assert.ok(isDrawn(role), `core role ${role} has no drawing`);
    else {
      assert.ok(packs[pack], `${role} belongs to pack "${pack}", which has no file in packs/`);
      assert.ok(typeof packs[pack].default[role] === "function", `pack "${pack}" doesn't draw ${role}`);
    }
  }
  for (const [name, m] of Object.entries(packs)) if (!only.length || only.includes(name)) for (const role of Object.keys(m.default))
    assert.equal(ROLES[role]?.pack, name, `pack "${name}" draws ${role}, which roles.ts doesn't list in that pack`);
});

test("drawings are well-formed, use only the stage's classes and carry no colours of their own", () => {
  for (const m of Object.values(packs)) addPack(m.default);
  for (const role of ROLES_CHECKED) {
    for (const opts of [...samplesOf(role), ...(packs[ROLES[role].pack]?.samples?.[role] ?? [])]) {
      const svg = glyph(role, opts), where = `${role} ${JSON.stringify(opts)}`;
      assert.ok(svg.length > 200, `${where} drew nothing`);
      assert.ok(wellFormed(svg), `${where} isn't well-formed markup`);
      for (const m of svg.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(" ")) assert.ok(CLASSES.has(c), `${where} uses class "${c}", which the stage doesn't style`);
      assert.ok(!/(fill|stroke|stop-color)="#|style=|rgb\(/.test(svg), `${where} sets a colour itself`);
      for (const m of svg.matchAll(/url\(#([\w-]+)\)/g)) assert.ok(/^sk-(round|ball|halo|globe-\d+|clip-[\w-]+)$/.test(m[1]), `${where} refers to an unknown gradient #${m[1]}`);
      if (role !== "crowd") assert.ok(/class="(led|lamp)/.test(svg), `${where} has no status light (people in a crowd are the one exception)`);
    }
  }
  assert.ok(wellFormed(plinth()));
});

test("a part whose pack isn't loaded draws as a neutral crate", () => {
  const svg = glyph("no-such-role");
  assert.ok(wellFormed(svg) && svg.includes('class="edge"'));
});

test("the role check names unknown roles, options a role doesn't read and values out of range", () => {
  const scene = (nodes, events = []) => ({ nodes, steps: [{ events }] });
  assert.deepEqual(roleProblems(scene([{ id: "a", role: "web", opts: { big: true, lead: true } }])), []);
  assert.match(roleProblems(scene([{ id: "a", role: "brokr" }])).join(), /unknown role "brokr" \(did you mean "broker"\?\)/);
  assert.match(roleProblems(scene([{ id: "a", role: "queue", opts: { count: 3 } }])).join(), /option "count", which its drawing doesn't read/);
  assert.match(roleProblems(scene([{ id: "a", role: "broker", opts: { count: 9 } }])).join(), /count to 9, outside 1-6/);
  assert.match(roleProblems(scene([{ id: "a", role: "broker", opts: { count: 3 } }], [{ type: "state", node: "a", opts: { mark: 3 } }])).join(), /step 1 event 1 sets "a" \(broker\) mark to 3, but it has 3 to pick from/);
  const tiny = { id: "t", intro: "x", nodes: [{ id: "a", role: "phone", label: "A", at: [0, 0] }, { id: "b", role: "gatway", label: "B", at: [1, 0] }], links: [{ from: "a", to: "b" }],
    steps: [1, 2, 3].map((i) => ({ title: `S${i}`, short: `S${i}`, text: "x", events: [{ type: "packet", path: ["a", "b"], label: "hi" }] })) };
  assert.deepEqual(validateScene(tiny), ['t: node "b" has unknown role "gatway" (did you mean "gateway" or "gate"?); the parts are listed in docs/pictogram-catalog.md']);
});
