# SystemKit content guide

How to write or change a lesson. Run `node scripts/content-check.cjs <chapter-id>` before you finish; it enforces the numeric rules below.

## Voice

Plain, specific, and calm. Write for a working engineer who is smart but has not built this system. Teach why and what it costs, not just what. No hype, no filler, no "in today's world", and no phrases like "it's important to note". Use original wording and original examples: never reproduce or closely paraphrase a book, course, or article.

Name real systems when it helps the learner connect an idea to practice (Postgres, Redis, Kafka, S3, Cassandra, and so on), but only state things you are confident are true of them. Never invent a statistic, incident, or company detail. Mark example numbers as examples.

## A lesson (`Step`)

- `id`, `title`, `eyebrow`: keep existing ones stable, since URLs and saved progress depend on them.
- `seoTitle`: what someone would search for, using the common term for the idea, at most 62 characters. For example, `title` is "Allow controlled bursts with tokens" and `seoTitle` is "Token bucket rate limiting: allowing controlled bursts". Do not include "SystemKit".
- `summary`: one sentence.
- `body`: 2 to 4 paragraphs totalling 170 to 260 words.
- `takeaways`: 2 or 3 short lines that stand on their own.
- `scenario` and `scenarioAnswer`: a decision the learner writes about before seeing guidance. Favor a new situation over restating the lesson.

A good body covers: the problem, how the idea addresses it, one concrete worked example with numbers or a specific sequence of events, and what it costs or when you would not use it. Define a term the first time it appears.

## Checkpoint questions (`Question`)

Each lesson has 2 or 3 questions with exactly 4 options. Every wrong answer must be a mistake a thoughtful learner could actually make. The test: would someone who half-understood this choose it?

- No joke or throwaway options, such as anything about CSS, fonts, colors, or deleting the database.
- The correct answer must not stand out. Across a chapter it may be the longest option in at most 40% of questions, and it should never be much longer than every wrong answer. Bring wrong answers up to the same length and level of detail, and trim padding from the correct answer. Do not make wrong answers longer by adding nonsense.
- The correct answer must not be the only one using careful qualifiers. Wrong answers should sound equally reasonable until you think about them.
- Do not write absolutes ("always", "never", "only") mainly in wrong answers.
- Prefer questions that apply the idea to a new situation over ones that repeat a sentence from the lesson. A question's `difficulty` must be honest: `Recall` restates, `Apply` uses the idea in a new situation, `Diagnose` reasons from a symptom to a cause.
- `explanation`: say why the right answer is right, and where useful why the tempting wrong one fails. It is shown only after the learner gets the question right or asks to see the answer.

Keep `id`, `stepId`, and `correctIndex` stable on existing questions, because saved answers refer to them. Option order in the file does not matter to learners: display order is shuffled per question.

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
