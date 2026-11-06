import test from "node:test";
import assert from "node:assert/strict";
import { emptyProgress, nextLessonInOrder, parseProgress, resumeLesson, resumeStepInChapter } from "../src/lib/progress.ts";
import { collectBackup, completedLessons, parseBackup, restoreBackup } from "../src/lib/backup.ts";
import { analyticsAllowed, dueReturnEvents, eventName, needsConsent, parseUsage } from "../src/lib/analytics.ts";
import { correctIsStrictlyLongest, longestOptionShare, optionOrder, quizIssues } from "../src/lib/quiz.ts";

function memoryStorage(initial = {}, { failOn } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { if (failOn === key) throw new Error("quota"); map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
    dump: () => Object.fromEntries(map),
  };
}

test("malformed progress falls back safely and keeps valid fields", () => {
  assert.deepEqual(parseProgress("nope"), emptyProgress);
  assert.deepEqual(parseProgress("[1]"), emptyProgress);
  const parsed = parseProgress(JSON.stringify({ completed: ["a", 2], answers: { q: 1, r: 1.5, s: "x" }, activeStepId: 3 }));
  assert.deepEqual(parsed.completed, ["a"]);
  assert.deepEqual(parsed.answers, { q: 1 });
  assert.equal(parsed.activeStepId, undefined);
});

test("resuming skips finished lessons rather than landing on one being revisited", () => {
  const steps = ["a", "b", "c", "d"];
  const progress = (completed, activeStepId) => ({ ...emptyProgress, completed, activeStepId });
  assert.equal(resumeStepInChapter(steps, progress([], undefined)), "a");
  assert.equal(resumeStepInChapter(steps, progress(["a"], "b")), "b");
  assert.equal(resumeStepInChapter(steps, progress(["a", "b"], "b")), "c");
  assert.equal(resumeStepInChapter(steps, progress(["b", "c", "d"], "d")), "a", "wraps to an earlier gap");
  assert.equal(resumeStepInChapter(steps, progress(steps, "d")), undefined);
});

test("course resume moves to the next chapter and reports nothing for a new visitor", () => {
  const outline = [
    { id: "one", number: "01", title: "One", part: "P", storageKey: "one", stepIds: ["a"] },
    { id: "two", number: "02", title: "Two", part: "P", storageKey: "two", stepIds: ["b", "c"] },
  ];
  const saved = { one: { ...emptyProgress, completed: ["a"], activeStepId: "a" }, two: emptyProgress };
  assert.equal(resumeLesson(outline, null, () => emptyProgress), null);
  assert.deepEqual(resumeLesson(outline, "one", (key) => saved[key]), { chapterId: "two", stepId: "b" });
  const allDone = { one: saved.one, two: { ...emptyProgress, completed: ["b", "c"] } };
  assert.equal(resumeLesson(outline, "two", (key) => allDone[key]), null);
});

test("a backup round trip restores exactly and ignores other sites' keys", () => {
  const source = memoryStorage({ "systemkit:chat:v1": JSON.stringify({ completed: ["x", "y"] }), "systemkit:goal:v1": "work", "other-app": "keep" });
  const backup = collectBackup(source, 1234);
  assert.equal(backup.items["other-app"], undefined);
  const parsed = parseBackup(JSON.stringify(backup));
  assert.equal(parsed.ok, true);
  assert.equal(completedLessons(parsed.backup.items), 2);
  const target = memoryStorage({ "systemkit:old:v1": "gone", "other-app": "stays" });
  assert.equal(restoreBackup(target, parsed.backup), true);
  assert.deepEqual(target.dump(), { "other-app": "stays", "systemkit:chat:v1": source.getItem("systemkit:chat:v1"), "systemkit:goal:v1": "work" });
});

test("a failed restore puts the earlier progress back", () => {
  const target = memoryStorage({ "systemkit:mine:v1": "precious" }, { failOn: "systemkit:huge:v1" });
  const backup = { app: "systemkit", version: 1, exportedAt: 1, items: { "systemkit:huge:v1": "x" } };
  assert.equal(restoreBackup(target, backup), false);
  assert.equal(target.getItem("systemkit:mine:v1"), "precious");
});

test("bad backup files are refused with a clear reason, and foreign keys are dropped", () => {
  assert.equal(parseBackup("not json").ok, false);
  assert.equal(parseBackup("[]").ok, false);
  assert.equal(parseBackup(JSON.stringify({ app: "other", version: 1, items: {} })).ok, false);
  const newer = parseBackup(JSON.stringify({ app: "systemkit", version: 99, items: {} }));
  assert.equal(newer.ok, false);
  assert.match(newer.error, /newer version/);
  const mixed = parseBackup(JSON.stringify({ app: "systemkit", version: 1, items: { "systemkit:a": "1", "evil": "2", "systemkit:b": 3 } }));
  assert.deepEqual(mixed.backup.items, { "systemkit:a": "1" });
});

test("return milestones fire once and never before they are reached", () => {
  const day = 86_400_000;
  assert.deepEqual(dueReturnEvents({ firstSeen: 0, sent: [] }, day - 1), []);
  assert.deepEqual(dueReturnEvents({ firstSeen: 0, sent: [] }, day), ["returned_d1"]);
  assert.deepEqual(dueReturnEvents({ firstSeen: 0, sent: ["returned_d1"] }, 8 * day), ["returned_d7"]);
  assert.deepEqual(parseUsage("broken", 5), { firstSeen: 5, sent: [] });
  assert.deepEqual(parseUsage(JSON.stringify({ firstSeen: 2, sent: ["a", 1] }), 5), { firstSeen: 2, sent: ["a"] });
});

test("visitors in Europe are asked first, and an explicit choice always wins", () => {
  for (const zone of ["Europe/Berlin", "Europe/London", "Atlantic/Reykjavik", "Asia/Nicosia", undefined]) assert.equal(needsConsent(zone), true, String(zone));
  for (const zone of ["America/Chicago", "Asia/Tokyo", "Africa/Lagos", "Asia/Tbilisi"]) assert.equal(needsConsent(zone), false, zone);
  assert.equal(analyticsAllowed(null, "Europe/Paris"), false);
  assert.equal(analyticsAllowed("granted", "Europe/Paris"), true);
  assert.equal(analyticsAllowed(null, "America/Chicago"), true);
  assert.equal(analyticsAllowed("denied", "America/Chicago"), false);
});

test("event names meet Google's rules", () => {
  assert.equal(eventName("lab_run_rate-limiters"), "lab_run_rate_limiters");
  assert.equal(eventName("challenge_started_address-autocomplete"), "challenge_started_address_autocomplete");
  assert.ok(eventName("x".repeat(60)).length <= 40);
  assert.match(eventName("goal_work"), /^[a-zA-Z0-9_]+$/);
});

test("a backup never carries one device's analytics choice to another", () => {
  const source = memoryStorage({ "systemkit-analytics-consent": "granted", "systemkit:goal:v1": "work" });
  assert.deepEqual(Object.keys(collectBackup(source, 1).items), ["systemkit:goal:v1"]);
  const target = memoryStorage({ "systemkit-analytics-consent": "denied" });
  restoreBackup(target, { app: "systemkit", version: 1, exportedAt: 1, items: {} });
  assert.equal(target.getItem("systemkit-analytics-consent"), "denied");
});

test("option order is stable, complete, and differs between questions", () => {
  assert.deepEqual(optionOrder("q1", 4), optionOrder("q1", 4));
  assert.deepEqual([...optionOrder("q1", 4)].sort(), [0, 1, 2, 3]);
  const orders = new Set(Array.from({ length: 50 }, (_, index) => optionOrder(`question-${index}`, 4).join()));
  assert.ok(orders.size > 8);
  const positions = [0, 0, 0, 0];
  for (let index = 0; index < 4000; index++) positions[optionOrder(`q${index}`, 4).indexOf(1)]++;
  for (const count of positions) assert.ok(count > 800 && count < 1200, `an option's position is close to uniform: ${positions}`);
});

test("quiz checks catch the patterns that let a learner pass without understanding", () => {
  const question = (options, correctIndex = 0) => ({ id: "q", options, correctIndex });
  assert.deepEqual(quizIssues(question(["Use a queue", "Use a cache", "Add replicas", "Shard it"])), []);
  assert.ok(quizIssues(question(["A long and carefully qualified correct answer", "Short", "Tiny", "Brief"])).length >= 1);
  assert.ok(quizIssues(question(["Measure the request rate", "Change the CSS on the page", "Add more shards here", "Restart every node"])).some((issue) => issue.includes("throwaway")));
  assert.equal(correctIsStrictlyLongest(question(["aaaa", "bb", "cc", "dd"])), true);
  assert.equal(correctIsStrictlyLongest(question(["aaaa", "bbbb", "cc", "dd"])), false);
  assert.equal(longestOptionShare([question(["aaaa", "bb", "cc", "dd"]), question(["aa", "bbbb", "cc", "dd"])]), 0.5);
});

test("the next lesson follows the order given, for new and returning visitors", () => {
  const outline = [
    { id: "a", number: "1", title: "A", part: "P", storageKey: "ka", stepIds: ["a1", "a2"] },
    { id: "b", number: "2", title: "B", part: "P", storageKey: "kb", stepIds: ["b1"] },
    { id: "c", number: "3", title: "C", part: "P", storageKey: "kc", stepIds: ["c1"] },
  ];
  const saved = (progress) => (key) => progress[key] ?? emptyProgress;
  assert.deepEqual(nextLessonInOrder(outline, null, saved({})), { chapterId: "a", stepId: "a1" });
  assert.deepEqual(nextLessonInOrder([...outline].reverse(), null, saved({})), { chapterId: "c", stepId: "c1" });
  assert.deepEqual(nextLessonInOrder(outline, "removed-chapter", saved({})), { chapterId: "a", stepId: "a1" });
  assert.deepEqual(nextLessonInOrder(outline, "b", saved({})), { chapterId: "b", stepId: "b1" });
  const mid = { ka: { ...emptyProgress, completed: ["a1"] } };
  assert.deepEqual(nextLessonInOrder(outline, "a", saved(mid)), { chapterId: "a", stepId: "a2" });
  const everything = { ka: { ...emptyProgress, completed: ["a1", "a2"] }, kb: { ...emptyProgress, completed: ["b1"] }, kc: { ...emptyProgress, completed: ["c1"] } };
  assert.equal(nextLessonInOrder(outline, "a", saved(everything)), null);
  assert.equal(nextLessonInOrder([], null, saved({})), null);
});
