import test from "node:test";
import assert from "node:assert/strict";
import { emptyChallengeDraft, parseChallengeDraft, hasChallengeAttempt, formatChallengeDraft, challengeAnswerLimit, critiquePrompt, interviewerPrompt, designChallenge } from "../src/content/design-challenge.ts";

test("a partial or corrupt saved draft cannot expose the worked answers", () => {
  assert.deepEqual(parseChallengeDraft("not JSON"), emptyChallengeDraft());
  const partial = parseChallengeDraft(JSON.stringify({ answers: { estimate: "100 reads/s" }, reviewed: true }));
  assert.equal(hasChallengeAttempt(partial), false);
  assert.equal(partial.reviewed, false);
});
test("complete drafts and valid self-checks survive reloading", () => {
  const draft = { answers: { estimate: "Estimate", architecture: "Path", resilience: "Failure", adaptation: "Change" }, checked: ["units", "unknown"], reviewed: true };
  const restored = parseChallengeDraft(JSON.stringify(draft));
  assert.equal(hasChallengeAttempt(restored), true);
  assert.equal(restored.reviewed, true);
  assert.deepEqual(restored.checked, ["units"]);
  assert.match(formatChallengeDraft(restored), /Architecture and request paths\nPath/);
});
test("stored answers are bounded and unexpected values are ignored", () => {
  const restored = parseChallengeDraft(JSON.stringify({ answers: { estimate: "x".repeat(challengeAnswerLimit + 50), architecture: 22, resilience: [], adaptation: " " }, checked: "units" }));
  assert.equal(restored.answers.estimate.length, challengeAnswerLimit);
  assert.equal(restored.answers.architecture, "");
  assert.equal(hasChallengeAttempt(restored), false);
  assert.deepEqual(restored.checked, []);
});
test("timers survive reloading only when they are valid", () => {
  assert.deepEqual(parseChallengeDraft(JSON.stringify({ timer: { startedAt: 1000, minutes: 25 } })).timer, { startedAt: 1000, minutes: 25 });
  assert.equal(parseChallengeDraft(JSON.stringify({ timer: { startedAt: "soon", minutes: 25 } })).timer, undefined);
  assert.equal(parseChallengeDraft(JSON.stringify({ timer: { startedAt: 1000, minutes: 0 } })).timer, undefined);
});
test("chatbot prompts carry the brief and the learner's own answers", () => {
  const draft = { ...emptyChallengeDraft(), answers: { estimate: "UNIQUE-ESTIMATE", architecture: "Path", resilience: "Failure", adaptation: "Change" } };
  const critique = critiquePrompt(draft, designChallenge);
  assert.match(critique, /UNIQUE-ESTIMATE/);
  assert.ok(critique.includes(designChallenge.brief));
  assert.ok(critique.includes(designChallenge.rubric[0].title));
  const interviewer = interviewerPrompt(designChallenge);
  assert.ok(interviewer.includes(designChallenge.change));
  assert.doesNotMatch(interviewer, /UNIQUE-ESTIMATE/);
  assert.ok(!interviewer.includes(designChallenge.solutions[0].approach), "the interviewer prompt must not leak a worked answer");
});
