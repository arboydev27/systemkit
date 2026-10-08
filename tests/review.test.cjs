const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const directory = mkdtempSync(join(tmpdir(), "systemkit-review-tests-"));
const compiled = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"),
  "src/lib/review.ts", "src/content/review.ts", "--rootDir", "src", "--outDir", directory,
  "--module", "commonjs", "--target", "es2020", "--skipLibCheck"],
{ encoding: "utf8" });
if (compiled.status !== 0) throw new Error(compiled.stdout + compiled.stderr);
const {
  DAY, SESSION_LIMIT, REVIEW_STORAGE_KEY, emptyReviewState, recordQuizAttempt, recordRecall,
  markStudied, buildReviewSession, importLegacyStudy, parseReviewState, readReviewState, saveReviewState,
} = require(join(directory, "lib/review.js"));
const { reviewCards } = require(join(directory, "content/review.js"));
const { chapters } = require(join(directory, "content/chapters.js"));
test.after(() => rmSync(directory, { recursive: true, force: true }));

const now = 1_800_000_000_000;
const card = (id) => ({ id: `scaling/${id}`, chapterId: "scaling", stepId: id,
  chapterTitle: "Scaling", lessonTitle: id,
  prompts: [{ prompt: "First version", answer: "Guidance" }, { prompt: "Different context", answer: "Guidance" }] });
const input = { chapterId: "scaling", stepId: "cache", questionId: "q12", selectedIndex: 1, correctIndex: 0 };

test("a corrected retry preserves the original mistake and first-attempt time", () => {
  const initial = recordQuizAttempt(emptyReviewState(), input, now);
  const corrected = recordQuizAttempt(initial, { ...input, selectedIndex: 0 }, now + 1000);
  assert.deepEqual(corrected.firstAttempts["scaling/q12"], initial.firstAttempts["scaling/q12"]);
  assert.equal(corrected.firstAttempts["scaling/q12"].correct, false);
  assert.equal(corrected.studied["scaling/cache"], now);
  assert.deepEqual(initial, corrected);
});

test("newly studied ideas become due the next day and exclude unstudied lessons", () => {
  const state = recordQuizAttempt(emptyReviewState(), input, now);
  assert.equal(buildReviewSession([card("cache"), card("cdn")], state, now).length, 0);
  assert.equal(buildReviewSession([card("cache"), card("cdn")], state, now + DAY - 1).length, 0);
  assert.deepEqual(buildReviewSession([card("cache"), card("cdn")], state, now + DAY).map((item) => item.card.id), ["scaling/cache"]);
});

test("a session is bounded and prioritizes earlier mistakes among due studied ideas", () => {
  const cards = Array.from({ length: 9 }, (_, index) => card(`lesson-${index}`));
  let state = emptyReviewState();
  for (const item of cards) state = markStudied(state, "scaling", item.stepId, now - DAY);
  state = recordQuizAttempt(state, { ...input, stepId: "lesson-8" }, now - DAY);
  const session = buildReviewSession(cards, state, now);
  assert.equal(session.length, SESSION_LIMIT);
  assert.equal(session[0].card.id, "scaling/lesson-8");
});

test("successful recalls extend spacing, missed recalls reset it, and prompts vary", () => {
  const initial = markStudied(emptyReviewState(), "scaling", "cache", now - DAY);
  const first = recordRecall(initial, "scaling/cache", true, now);
  assert.equal(first.recalls["scaling/cache"].dueAt, now + 3 * DAY);
  assert.equal(buildReviewSession([card("cache")], first, now + 3 * DAY)[0].prompt.prompt, "Different context");
  const second = recordRecall(first, "scaling/cache", true, now + 3 * DAY);
  assert.equal(second.recalls["scaling/cache"].dueAt, now + 10 * DAY);
  const missed = recordRecall(second, "scaling/cache", false, now + 10 * DAY);
  assert.equal(missed.recalls["scaling/cache"].streak, 0);
  assert.equal(missed.recalls["scaling/cache"].dueAt, now + 11 * DAY);
  assert.equal(initial.recalls["scaling/cache"], undefined);
  assert.equal(recordRecall(initial, "scaling/unstudied", true, now), initial);
});

test("legacy progress imports study eligibility without inventing first attempts or changing values", () => {
  const legacy = JSON.stringify({ completed: ["cache", "unknown"], answers: { q16: 0 }, scenarioDrafts: { queue: "Try workers", stateless: " " }, activeStepId: "observability" });
  const values = new Map([["old-progress", legacy]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const sources = [{ id: "scaling", storageKey: "old-progress", steps: ["cache", "cdn", "queue", "stateless", "observability"].map((id) => ({ id })), questions: [{ id: "q16", stepId: "cdn", options: ["A", "B"] }] }];
  const state = importLegacyStudy(emptyReviewState(), storage, sources, now);
  assert.deepEqual(Object.keys(state.studied).sort(), ["scaling/cache", "scaling/cdn", "scaling/queue"]);
  assert.deepEqual(state.firstAttempts, {});
  assert.equal(buildReviewSession([card("cache")], state, now).length, 1);
  assert.equal(values.get("old-progress"), legacy);
  assert.equal(saveReviewState(storage, state), true);
  assert.deepEqual(readReviewState(storage), state);
  assert.ok(values.get(REVIEW_STORAGE_KEY));
});

test("blocked storage and corrupt values leave review helpers usable", () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(readReviewState(blocked), emptyReviewState());
  assert.equal(saveReviewState(blocked, emptyReviewState()), false);
  assert.deepEqual(parseReviewState("{broken"), emptyReviewState());
  assert.deepEqual(parseReviewState(JSON.stringify({ version: 1, studied: { invalid: -1 }, firstAttempts: { invalid: {} }, recalls: { invalid: {} } })), emptyReviewState());
  const memory = markStudied(emptyReviewState(), "scaling", "cache", now - DAY);
  assert.equal(buildReviewSession([card("cache")], memory, now).length, 1);
});

test("every live lesson has valid review content and foundation prompts vary", () => {
  assert.equal(reviewCards.length, chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0));
  assert.equal(new Set(reviewCards.map((item) => item.id)).size, reviewCards.length);
  for (const item of reviewCards) {
    assert.ok(chapters.some((chapter) => chapter.id === item.chapterId
      && chapter.steps.some((step) => step.id === item.stepId)), item.id);
    assert.ok(item.prompts.length > 0, item.id);
    for (const prompt of item.prompts) {
      assert.ok(prompt.prompt.trim());
      assert.ok(prompt.answer.trim());
      assert.ok(!prompt.answer.includes("undefined"));
    }
    if (item.chapterId === "framework" || item.chapterId === "scaling") {
      assert.ok(new Set(item.prompts.map((prompt) => prompt.prompt)).size >= 2, item.id);
    }
  }
});

test("a missed review is prioritized without an earlier quiz mistake", () => {
  let state = markStudied(emptyReviewState(), "scaling", "cache", now - DAY);
  state = markStudied(state, "scaling", "cdn", now - 5 * DAY);
  state = recordRecall(state, "scaling/cache", false, now);
  assert.equal(buildReviewSession([card("cache"), card("cdn")], state, now + DAY)[0].card.id, "scaling/cache");
});
