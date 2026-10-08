import test from "node:test";
import assert from "node:assert/strict";
import { emptyChallengeDraft, parseChallengeDraft, hasChallengeAttempt, formatChallengeDraft, challengeAnswerLimit } from "../src/content/design-challenge.ts";

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
