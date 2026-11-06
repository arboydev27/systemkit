# SystemKit content guide

How to write or change a lesson. Run `npm run check:content -- <chapter-id>` before you finish; it enforces the numeric rules below.

## Voice

Plain, specific, and calm. Write for a working engineer who hasn't built this system. Teach why and what it costs, not just what. No hype or filler. Use original wording and examples: never reproduce or closely paraphrase a book, course, or article.

Name real systems when it helps the learner connect an idea to practice (Postgres, Redis, Kafka, S3, Cassandra, and so on), but only state things you are confident are true of them. Never invent a statistic, incident, or company detail. Mark example numbers as examples, and choose your own: don't reuse the inputs of a book's or course's worked example, even when the arithmetic is generic.

## A lesson (`Step`)

- `id`, `title`, `eyebrow`: keep existing ones stable, since URLs and saved progress depend on them.
- `seoTitle`: what someone would search for, using the common term for the idea, at most 62 characters. For example, `title` is "Allow controlled bursts with tokens" and `seoTitle` is "Token bucket rate limiting: allowing controlled bursts". Do not include "SystemKit".
- `summary`: one sentence.
- `body`: 2 to 4 paragraphs totalling 170 to 260 words.
- `takeaways`: 2 or 3 short lines that stand on their own.
- `scenario` and `scenarioAnswer`: a decision the learner writes about before seeing guidance. Favor a new situation over restating the lesson.
- `related` (optional): links to lessons this one builds on or uses, each with `chapterId`, `stepId`, and a short `reason` saying what the other lesson adds. Most lessons have 0 to 2. Skip the lessons directly before and after in the chapter, and don't link for coverage.

A good body covers: the problem, how the idea addresses it, one concrete worked example with numbers or a specific sequence of events, and what it costs or when you would not use it. Define a term the first time it appears.

## Checkpoint questions (`Question`)

Each lesson has 2 or 3 questions with exactly 4 options. Every wrong answer must be a mistake a thoughtful learner could actually make. The test: would someone who half-understood this choose it?

- No joke or throwaway options.
- The correct answer must not stand out by length, detail, or careful qualifiers. Across a chapter it may be the longest option in at most 40% of questions. Don't pad wrong answers with nonsense, and don't save absolutes like "always" and "never" for wrong answers.
- Prefer applying the idea to a new situation over repeating the lesson. Keep `difficulty` honest: `Recall` restates, `Apply` uses the idea somewhere new, `Diagnose` reasons from a symptom to a cause.
- `explanation` says why the right answer is right and, where useful, why the tempting wrong one fails. Learners see it only after a right answer or on request.

Keep `id`, `stepId`, and `correctIndex` stable, because saved answers refer to them. Display order is shuffled per question.

## Review prompts

Every lesson has an entry in `src/content/review/<chapter-id>.ts`: two prompts and one answer that covers both. Spaced review shows a prompt days later, away from the lesson, so each must stand alone and put the idea in a new situation, not repeat a checkpoint question, a diagram prediction, or the scenario. The answer is 2 to 4 short sentences naming the ideas to look for, including the tradeoff.

## Diagram predictions

Predictions in `src/content/spatial-learning/` follow the same option rules. A prediction's prompt must not repeat a checkpoint question from the same chapter: pose a new scenario whose answer is revealed by the same part of the diagram.

## Design challenges

A design challenge asks the learner to transfer a chapter to a different product rather than repeat the one taught, for example a pastebin for the URL shortener chapter. Each file in `src/content/challenges/` exports one `DesignChallengeContent` (see `src/content/design-challenge.ts`, which has the full photo-sharing example):

- `id`, `chapterId`, `stepId` (the chapter's last lesson), `title`, `summary`, `brief`, `minutes` (a realistic time box, 20 to 35).
- `assumptions`: 4 or 5 numbers and constraints that make estimation possible.
- `change`: a requirement that changes partway through, and `adaptationTitle`: a short heading for how each solution handles it.
- `fields`: exactly four with the ids `estimate`, `architecture`, `resilience`, `adaptation`, each with `title`, `prompt`, and `placeholder`.
- `rubric`: exactly five statements a learner can honestly check against their own answer.
- `estimateGuide`: the worked arithmetic for the assumptions. Check it twice.
- `solutions`: exactly two defensible approaches with different tradeoffs, not a right and a wrong one. Each has `id`, `title`, `approach`, `paths` (2 or 3 request paths), `failure`, `adaptation`, and `tradeoff`.

## Diagrams for new chapters

Each new chapter has `src/content/diagrams/<chapter-id>.json`, keyed by `diagramId`. Prefix diagram ids with a short chapter code so they stay unique across the site.

```json
{
  "tx-lost-update": {
    "kind": "flow",
    "title": "Two writers read the same balance",
    "description": "One sentence describing what the diagram shows, used as alt text and caption.",
    "note": "A short closing point, at most 90 characters.",
    "items": [
      { "title": "Read balance", "detail": "both see 100" }
    ]
  }
}
```

`kind` is `flow` (each item leads to the next) or `comparison` (independent alternatives). Every scene has exactly 4 items. Item `title` is at most 20 characters, `detail` at most 28, and scene `title` at most 60. Never put meaning in a diagram that the lesson text does not also state.

After changing a scene, run `node scripts/export-excalidraw.cjs` to regenerate its editable source in `public/diagrams/`.

Teaching content for a new chapter's 3D view goes in `src/content/spatial-learning/<chapter-id>.ts`. It uses the `flowLesson` helper and exports `<camelCaseChapter>TeachingContent`, keyed by `diagramId`. Each lesson has 2 or 3 `points` and one `prediction`. Item numbers index into the scene's `items`. `semanticIds` are stable names for each item; reuse a name when the same thing appears in another lesson of the chapter, and never repeat one within a lesson.

```ts
import { flowLesson } from "./flow-lesson";

export const transactionsTeachingContent = {
  "tx-lost-update": flowLesson("tx-lost-update", {
    kind: "flow",
    semanticIds: ["read-a", "read-b", "write-a", "write-b"],
    points: [
      { title: "Both readers see 100", description: "Two transactions read the same balance before either writes.", items: [0, 1] },
      { title: "The second write wins", description: "Each computes from its stale read, so one update disappears.", items: [0, 1, 2, 3] },
    ],
    prediction: {
      prompt: "A new scenario, not a checkpoint question.",
      options: ["...", "...", "...", "..."],
      correctIndex: 2,
      explanation: "Why the answer follows.",
      items: [2, 3],
    },
  }),
};
```
