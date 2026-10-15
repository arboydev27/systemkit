# SystemKit

SystemKit is an interactive reference for learning system design one decision at a time. Its fifteen-chapter path begins with a reusable framework and a growing service, then moves through estimation, familiar products, distributed storage, data placement, unique IDs, file sync, and web discovery.

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Next.js. Before sharing a release, run:

```bash
npm test
npm run typecheck
npm run test:spatial
npm run build
```

The test runner uses Node's TypeScript stripping flag and requires Node 22.6 or newer.

## Learning features

The approved launch features are now on `main`. Their original implementation branches are:

| Feature | Branch | Where to try it |
| --- | --- | --- |
| Concept search and permanent lesson links | `feature/lesson-search-links` | Sidebar search or Cmd/Ctrl+K; copy a lesson link from its heading |
| Cache failure lab | `feature/cache-failure-lab` | Scaling → Cache repeated work |
| Spaced review sessions | `feature/review-sessions` | Five-minute review in the sidebar, or `/review/` |
| Photo-sharing design challenge | `feature/design-challenge` | Scaling → Scale in response to evidence, below the checkpoints |

The `feature/spatial-diagrams` preview includes these features and adds the optional 3D view described below. The `review/intuitive-spatial-diagrams` branch builds on it with a simpler walkthrough-first interface. Both remain separate from `main` for review.

Every lesson has a static `/learn/<chapter>/<lesson>/` URL. Direct links take precedence over saved resume state; the library root resumes the last lesson on this device. Search covers titles, chapter names, summaries, and lesson explanations.

Reviews use studied lessons, preserve the first quiz attempt across retries, and select at most five ideas. New study becomes due the next day. Successful recalls expand the interval; missed recalls return the next day. Earlier mistakes take priority among due ideas. Learners can also practise early or select a lesson they already studied. The schedule is a simple local heuristic, and self-checks do not certify mastery.

The cache lab is a read-demand model with explicit assumptions, not a latency simulator or capacity benchmark. The design challenge saves writing and self-checks locally, then offers a rubric and two worked approaches after an initial response in all four sections. It does not automatically grade answers.

Verification on the combined branch: 21 tests, production static export with 116 lesson routes, and browser checks at desktop and 390px widths. Browser checks cover search keyboard navigation, mobile Escape/focus behavior, direct links, Back/Forward, copied links, saved lesson notes, review scheduling, cache failure/restoration/reset, and challenge draft/rubric restoration.

## First-release architecture

- **Next.js App Router + React + TypeScript** generate a static site. Lessons and diagrams are bundled with the site, so reading requires no database or server request.
- **CSS and inline SVG** provide the interface and architecture views. Original editable Excalidraw files are in `public/diagrams/`.
- **Browser local storage** keeps a learner's answers and chapter progress on that device. It is optional: the lessons remain readable if storage is blocked.
- **Optional Three.js view** loads on demand when a learner selects 3D. Static diagrams remain the default; both views read the same authored lesson data.
- **Vercel** is the intended hosting destination when deployment is requested. The static output can be delivered through an edge CDN without operating application servers.

This product teaches load balancing, caching, replication, queues, and sharding. Its own first release does not need those components. Add a shared data store, authentication, and server routes only when cross-device progress or other shared features are needed. Neon is one possible Postgres option at that point; choose it after measuring the data and query needs. The application should remain useful when progress storage fails.

## Spatial diagrams

Every lesson offers Static and 3D views. Static remains the default and the 3D code loads on demand. Both read the same component and connection facts. The view choice, reduced motion preference, and diagram prediction attempts stay on this device, separately from chapter completion.

| Learning tool | Behavior |
| --- | --- |
| Layouts for 3D | Consistent component footprints, authored tiers or pipelines, and obstacle-aware orthogonal routes replace SVG coordinates. Rings and timelines retain their conceptual geometry. |
| Guided explanations | Start with **Walk through the flow**, then read one of 292 authored steps at a time across 116 lessons. Previous and Next highlight the relevant components and relationships; Whole system leaves the walkthrough. |
| Expandable subsystems | 22 genuine subsystem groups collapse into counted proxies. External connections retain their direction, meaning, conditions, and original relationship references; internal connections return on expansion. |
| Focused teaching views | 176 declared subsets make a specific path easier to inspect. Hidden components and relationships are counted, and Whole system restores the full diagram. |
| Lesson continuity | Stable semantic identities let existing components move into the next layout while new and removed components fade. A changes disclosure lists what was added, removed, or retained. Continuity lasts within the browser session. |
| Meaningful relationships | Requests, responses, reads, writes, replication, work delivery, acknowledgements, and decisions have explicit types. Inspect conditions, filter by type, or inspect original connections represented by an aggregate. |
| Diagram predictions | An optional prediction follows the walkthrough, revealing relevant paths or authored component states with an explanation, retry, and device-local restoration. |

The spatial presentation uses component types to distinguish volumes, with restrained category accents and directional lighting. The initial view shows a short explanation and one primary walkthrough action. Reset view and Expand diagram stay nearby. Selecting a component or connection opens contextual details. **Diagram options** holds camera, motion, and model settings; a separate **Explore components and relationships** disclosure provides keyboard-accessible inspection. Labels prioritize selected objects when the scene is crowded. Shapes, depth, colors, animation timing, and outage states are teaching aids; they do not measure traffic, latency, capacity, or execution. Predictions illustrate authored consequences rather than running a production failure simulator.

The renderer honors the system's reduced-motion preference and the Reduce motion option. Reduced motion fixes the camera and removes moving highlights; manual stepping remains available. Walkthroughs advance only when the learner chooses a step, with no autoplay or scene picker. Rendering pauses when the canvas leaves the screen or the tab is hidden. Geometry, materials, listeners, and WebGL contexts are released when the learner changes diagrams or returns to Static. If WebGL is unavailable, the static diagram remains usable.

[Visualyze](https://github.com/Solvent-Duck/Visualyze/tree/523a4dc060746846ae9bc613a06eb3d7233e9613) informed the approach: separate lesson facts from presentation, use spatial blocks with directed relationships, and inspect one element or relationship at a time. Its [README](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/README.md), [semantic contract](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/public/schema/architecture-format.md), and [teaching-view design](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/docs/decisions/0010-teaching-views.md) were reviewed through the GitHub connector. Its native Rust/Bevy runtime is proprietary, with licensing left open in [ADR 0001](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/docs/decisions/0001-repository-boundaries.md). SystemKit's browser implementation is original; no Visualyze source, shaders, or assets are bundled.

The model separates source facts (`spatial-scenes.ts`), chapter teaching scripts (`src/content/spatial-learning/`), pure layout and projections (`spatial-layout.ts`), controls and local attempts (`SpatialDiagram.tsx`), and the Three.js presentation (`spatial-runtime.ts`). Layout uses graph ranks for conceptual pipelines, explicit roles for architectural tiers, and orthogonal shortest paths around component footprints. Reconciliation matches semantic identities and uses interruptible, critically damped motion. It retains data-only snapshots across lesson remounts and releases outgoing render resources.

The spatial tests cover all 116 lessons, route clearance, direction and condition preservation, stable positions, group aggregation and provenance, honest focused-view omissions, invalid references, prediction storage decoding, and semantic continuity. A production build remains a static export with no Rust service or database required.

Verification for this preview: all 40 tests pass, TypeScript checks pass, and the production build exports 121 pages including 116 lesson routes. Browser checks cover authored scene playback and interaction pause, region and web-pool collapse/expansion, aggregated relationship inspection, focused view framing and omission counts, prediction reveal/retry/restoration, conceptual rings, and controls at 390px and 320px. Reduced motion keeps manual scenes available. An isolated WebGL fixture verifies stable neighbors, interrupted transitions, semantic lesson remounts, idle rendering, and geometry/canvas cleanup. Prediction scenarios remain illustrative and do not change quiz completion.

## Content and sources

The lessons, questions, and diagrams are original teaching material informed by Alex Xu's *System Design Interview: An Insider's Guide*. The supplied PDFs used as sources are:

- *System Design - The Framework.pdf*: chapter 3, “A Framework for System Design Interviews,” pages 1–9 of the supplied excerpt. SystemKit presents the method as general engineering practice under the title “System Design Framework.”
- *System Design - Scale to Million Users.pdf*: the scaling chapter, presented as Chapter 02 in SystemKit.
- *System Design Interview.pdf*: chapters 2, 4–13, and 15 inform the estimation, rate limiting, distributed storage, consistent hashing, unique ID, URL shortening, web crawling, notification, news feed, chat, search autocomplete, and Google Drive lessons. SystemKit presents them in a learning order rather than the book order.
- *System Design - Design Youtube.pdf*: the video platform chapter, presented as Chapter 06 in SystemKit.
- *System Design Cheat Sheet.pdf*: a background reference.

Additional primary references for the new chapters: [Amazon's Dynamo paper](https://www.amazon.science/publications/dynamo-amazons-highly-available-key-value-store) for distributed key-value tradeoffs, [Google Drive's change-log guide](https://developers.google.com/workspace/drive/api/guides/about-changes) for sync cursors, and [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) for robots.txt behavior.

SystemKit does not bundle or reproduce those PDFs. Its diagrams express the concepts in a new layout; they are not traced from the book.

Each chapter uses short lessons, visual explanations, decision scenarios, and self-check questions. Progress is saved separately per chapter. Multiple-choice explanations are guidance, not proof of mastery; learners should be able to explain the tradeoffs in their own words.
