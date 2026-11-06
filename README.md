# SystemKit

SystemKit is a free, no-signup place to learn system design by making the decisions: predict what breaks, run the numbers, write a design of your own, and keep the ideas with spaced review. It's meant for interview preparation and for design decisions at work.

## What's in it

| | |
| --- | --- |
| **Lessons** | A path from how to approach a design, through how data behaves, to complete product designs. Each lesson has a diagram, an explanation, a decision to reason through in writing, and checkpoints. |
| **Labs** | Small computed models you call the outcome of first: retry storms, rate limiter algorithms, quorum reads, and cache failure. Each has its own URL, and its settings live in the link. |
| **Design challenges** | A full design on a different product from the chapter, with an optional timer and a requirement that changes partway through. You then compare against a checklist and two worked approaches, or copy a prompt into your own chatbot to be critiqued or interviewed. |
| **Estimation drills** | Fresh numbers each time, checked against a worked answer. |
| **Spaced review** | Five-minute sessions that bring back what you studied, on a calendar-day schedule. |
| **3D diagrams** | An optional walkthrough view of each lesson's diagram, loaded on demand. |

## Principles

- **No accounts, ever.** Progress stays in the browser's local storage. People move it between devices or protect it with a backup file, from the home page. There is no server to sign in to, and nothing a learner writes leaves their browser.
- **Commit before you see the answer.** Explanations appear after a right answer or a request, guidance after some written reasoning, and lab results after a prediction.
- **Honest models.** Labs compute results from the settings given and state what they assume. They teach how a failure behaves, not what your latency will be. Self-checks don't certify mastery.

## Run it

```bash
npm install
npm run dev
```

Before sharing a release:

```bash
npm test
npm run typecheck
npm run build
```

The test runner uses Node's TypeScript stripping and needs Node 22.6 or newer.

`npm run build` produces a static site in `out/`. Set `NEXT_PUBLIC_SITE_URL` to the public address so canonical links, the sitemap, and social cards use it. On Vercel, the production domain is detected if it isn't set.

## How it's built

Next.js App Router, React, and TypeScript generate a static export, so there is no database or application server.

| Path | What's there |
| --- | --- |
| `src/content/` | Chapters, lessons, and questions (`chapters.ts` sets the teaching order) |
| `src/content/challenges/` | One design challenge per file |
| `src/content/labs.ts` | The lab index and the text on each lab's page |
| `src/content/diagrams/` | Diagram scenes for chapters drawn by `FoundationDiagram` |
| `src/content/spatial-learning/` | Walkthrough steps and predictions for the 3D view |
| `src/lib/labs/`, `src/lib/estimation-drills.ts` | Pure, tested models behind the labs and drills |
| `src/lib/progress.ts`, `backup.ts`, `review.ts` | Local progress, backup and restore, and the review schedule |
| `src/lib/quiz.ts` | Option display order and the rules checkpoints must meet |
| `src/components/site/` | The home page, chapter pages, and other pages outside a lesson |
| `public/diagrams/` | Editable Excalidraw sources for the diagrams |

Each lesson page loads only its own chapter's content and drawing code. The search index, the 3D view, and the labs all load on demand.

Chapter ids, lesson ids, question ids, and storage keys are stable, because URLs and saved progress depend on them. Chapter order and numbers can change freely.

## Measuring use

Vercel Analytics counts pages with no cookies or identifiers. Milestones such as a first correct answer or returning after seven days are sent as page paths under `/_event/` (see `src/lib/analytics.ts`), because Vercel's custom events need a paid plan and page paths are visible on every plan. They'll appear in the Pages panel. No lesson content or written answer is ever sent.

## Contributing content

Read [docs/content-guide.md](docs/content-guide.md), then check your chapter:

```bash
node scripts/content-check.cjs <chapter-id>
```

It enforces the rules that keep checkpoints honest, such as the correct answer not standing out by length, and that lessons have enough substance. Run `npm test` to check the whole course. [docs/design-system.md](docs/design-system.md) covers color, contrast, and interaction.

## Content and sources

The lessons, questions, and diagrams are original teaching material informed by Alex Xu's *System Design Interview: An Insider's Guide*, Martin Kleppmann's *Designing Data-Intensive Applications*, and primary sources, including [Amazon's Dynamo paper](https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store), [Google Drive's change-log guide](https://developers.google.com/workspace/drive/api/guides/about-changes), and [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html). SystemKit doesn't bundle or reproduce those books, and its diagrams express the concepts in a new layout.

The 3D diagram approach was informed by [Visualyze](https://github.com/Solvent-Duck/Visualyze/tree/523a4dc060746846ae9bc613a06eb3d7233e9613): separating lesson facts from presentation, using spatial blocks with directed relationships, and inspecting one element at a time. SystemKit's browser implementation is original, with no Visualyze source, shaders, or assets bundled.
