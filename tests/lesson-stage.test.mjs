import assert from "node:assert/strict";
import test from "node:test";
import { applyEvent, formatMetric, initialModel, metricsAt, stateBefore, stepEvents } from "../src/lib/lesson-stage/model.ts";
import { validateScene } from "../src/lib/lesson-stage/validate.ts";

const tiny = {
  id: "tiny",
  intro: "A tiny scene for tests.",
  metrics: [{ id: "load", label: "Load" }],
  nodes: [
    { id: "a", role: "client", label: "Visitor", at: [0, 0] },
    { id: "b", role: "web", label: "Server", at: [1, 0] },
    { id: "c", role: "web", label: "Second", at: [1, 1], appear: 1 },
  ],
  links: [{ from: "a", to: "b" }, { from: "a", to: "c" }],
  steps: [
    { title: "One", short: "One", text: "A request.", metrics: { load: 1 }, events: [{ type: "packet", path: ["a", "b"], label: "GET /" }, { type: "state", node: "b", light: "on", meter: 0.8, readout: "80%" }] },
    { title: "Two", short: "Two", text: "Another server.", metrics: { load: { n: 2, unit: "/s" } }, events: [{ type: "show", nodes: ["c"], at: { b: [1, -1] } }] },
    {
      title: "Three", short: "Three", text: "Choose.", events: [],
      control: { label: "Mode", options: [
        { label: "Calm", metrics: { load: 3 }, events: [{ type: "state", node: "c", light: "work" }] },
        { label: "Down", metrics: { load: "none" }, events: [{ type: "state", node: "c", down: true }] },
      ] },
    },
  ],
};

test("a part that appears later starts hidden and shows when its step's events run", () => {
  assert.equal(initialModel(tiny).nodes.c.visible, false);
  assert.equal(stateBefore(tiny, 1).nodes.c.visible, false);
  const after = stateBefore(tiny, 2);
  assert.equal(after.nodes.c.visible, true);
  assert.deepEqual(after.nodes.b.at, [1, -1]);
});

test("state carries forward and packets leave nothing behind", () => {
  const model = stateBefore(tiny, 1);
  assert.equal(model.nodes.b.light, "on");
  assert.equal(model.nodes.b.meter, 0.8);
  assert.equal(model.nodes.a.light, "idle");
  const copy = initialModel(tiny);
  applyEvent(copy, { type: "packet", path: ["a", "b"], label: "x" });
  assert.deepEqual(copy, initialModel(tiny));
});

test("a step's control option decides its events and numbers", () => {
  assert.equal(stateBefore(tiny, 3).nodes.c.light, "work");
  assert.equal(stateBefore(tiny, 3, { 2: 1 }).nodes.c.down, true);
  assert.equal(stepEvents(tiny, 2, { 2: 1 }).length, 1);
  assert.equal(metricsAt(tiny, 2).load, 3);
  assert.equal(metricsAt(tiny, 2, { 2: 1 }).load, "none");
  assert.deepEqual(metricsAt(tiny, 1).load, { n: 2, unit: "/s" });
  assert.deepEqual(metricsAt(tiny, -1), {});
});

test("numbers format with separators and units", () => {
  assert.equal(formatMetric({ n: 10000, unit: "/s" }), "10,000/s");
  assert.equal(formatMetric(3), "3");
  assert.equal(formatMetric("3 / 4"), "3 / 4");
  assert.equal(formatMetric(undefined), "—");
  assert.equal(formatMetric({ n: 900, unit: " req/s" }, 450.4), "450 req/s");
});

test("the validator catches broken references and long words", () => {
  assert.deepEqual(validateScene(tiny), []);
  const broken = structuredClone(tiny);
  broken.steps[0].events.push({ type: "packet", path: ["b", "c"], label: "x".repeat(40) });
  broken.steps[0].changes = ["added a thing"];
  const problems = validateScene(broken).join("\n");
  assert.match(problems, /hops b → c without a link/);
  assert.match(problems, /longer than 22 characters/);
  assert.match(problems, /passes c before it is shown/);
  assert.match(problems, /must start with/);
});

// Every staged scene in every chapter is validated and played through in lesson-stage-wiring.test.mjs.
