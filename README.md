# SystemKit

Learn system design by making the decisions: predict what breaks, run the numbers, write your own design, and keep the ideas with spaced review. Free, with no signup, for interview prep and real design work.

**[systemkit.arboy.studio](https://systemkit.arboy.studio)**

## What's inside

- **Lessons:** a path from how to approach a design, through how data behaves, to complete product designs.
- **Labs:** small computed models where you call the outcome first, each at its own URL.
- **Design challenges:** a full design with an optional timer and a requirement that changes partway through, then worked approaches to compare, or a prompt for your own chatbot.
- **Estimation drills:** fresh numbers each time, checked against a worked answer.
- **Spaced review:** five-minute sessions that bring back what you studied.
- **3D diagrams:** an optional walkthrough of each lesson's diagram.

There are no accounts. Progress stays in the browser, and a backup file moves it between devices.

## Run it

```bash
npm install
npm run dev
```

Before a release, on Node 22.6 or newer:

```bash
npm test
npm run typecheck
npm run build
```

The build is a static site in `out/`, with no database or server. Vercel detects the production domain for canonical links and the sitemap; elsewhere, set `NEXT_PUBLIC_SITE_URL`.

## Where things live

| Path | Contents |
| --- | --- |
| `src/content/` | Chapters, lessons, questions, challenges, and labs. `chapters.ts` sets the teaching order. |
| `src/lib/` | Tested logic: lab models, drills, progress, backup, the review schedule, and quiz rules |
| `src/components/` | Lessons, diagrams, labs, and the pages outside a lesson |
| `public/diagrams/` | Editable Excalidraw sources |

Chapter, lesson, and question ids and storage keys must stay stable, because URLs and saved progress depend on them. Chapter order and numbers can change freely.

## Adding content

Follow [docs/content-guide.md](docs/content-guide.md), then check your chapter:

```bash
npm run check:content -- <chapter-id>
```

[docs/design-system.md](docs/design-system.md) covers color, contrast, and interaction.

## Analytics

Vercel Web Analytics counts every page visit. Google Analytics adds returning visitors and milestones such as a first correct answer, with its advertising features off (see `src/lib/analytics.ts`). Set `NEXT_PUBLIC_GA_ID` to turn it on; without it, Google never loads. Visitors in a European time zone see a consent banner, and nothing loads from Google for them unless they allow it. Anyone can change their choice under Analytics settings in the footer. Nothing a learner writes is ever sent.

## Sources

Lessons, questions, and diagrams are original teaching material informed by Alex Xu's *System Design Interview*, Martin Kleppmann's *Designing Data-Intensive Applications*, and primary sources such as the [Dynamo paper](https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store) and [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html). The 3D approach was informed by [Visualyze](https://github.com/Solvent-Duck/Visualyze/tree/523a4dc060746846ae9bc613a06eb3d7233e9613); none of its code or assets are included.

## License

[MIT](LICENSE)
