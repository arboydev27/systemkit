# SystemKit

SystemKit is an interactive reference for learning system design one decision at a time. Its fifteen-chapter path begins with a reusable framework and a growing service, then moves through estimation, familiar products, distributed storage, data placement, unique IDs, file sync, and web discovery.

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Next.js. Before sharing a release, run:

```bash
npm run typecheck
npm run test:spatial
npm run build
```

## First-release architecture

- **Next.js App Router + React + TypeScript** generate a static site. Lessons and diagrams are bundled with the site, so reading requires no database or server request.
- **CSS and inline SVG** provide the interface and architecture views. Original editable Excalidraw files are in `public/diagrams/`.
- **Browser local storage** keeps a learner's answers and chapter progress on that device. It is optional: the lessons remain readable if storage is blocked.
- **Optional Three.js view** loads on demand when a learner selects 3D. Static diagrams remain the default; both views read the same authored lesson data.
- **Vercel** is the intended hosting destination when deployment is requested. The static output can be delivered through an edge CDN without operating application servers.

This product teaches load balancing, caching, replication, queues, and sharding. Its own first release does not need those components. Add a shared data store, authentication, and server routes only when cross-device progress or other shared features are needed. Neon is one possible Postgres option at that point; choose it after measuring the data and query needs. The application should remain useful when progress storage fails.

## Spatial diagrams

Every lesson offers Static and 3D views. The 3D view has orbit and keyboard controls, explicit zoom/reset controls, upright labels, element inspection, and a connection walkthrough with pause and manual stepping. The choice of view and reduced motion stays on this device, separately from learning progress. Block depth is a display aid; walkthrough order is explanatory, not a simulation of traffic, latency, or execution.

The renderer honors the system's reduced-motion preference and the explicit Reduce motion control. Reduced motion fixes the camera and removes moving highlights; manual stepping remains available. Playback stops when its canvas leaves the screen or the tab is hidden. Geometry, materials, listeners, and WebGL contexts are released when the learner changes diagrams or returns to Static. If WebGL is unavailable, the static diagram remains usable.

[Visualyze](https://github.com/Solvent-Duck/Visualyze/tree/523a4dc060746846ae9bc613a06eb3d7233e9613) informed the approach: separate lesson facts from presentation, use spatial blocks with directed relationships, and inspect one element or relationship at a time. Its [README](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/README.md), [semantic contract](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/public/schema/architecture-format.md), and [teaching-view design](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/docs/decisions/0010-teaching-views.md) were reviewed through the GitHub connector. Its native Rust/Bevy runtime is proprietary, with licensing left open in [ADR 0001](https://github.com/Solvent-Duck/Visualyze/blob/523a4dc060746846ae9bc613a06eb3d7233e9613/docs/decisions/0001-repository-boundaries.md). SystemKit's browser implementation is original; no Visualyze source, shaders, or assets are bundled.

Five data tests validate all 116 lessons, preserve directed and conditional routes, reject invalid paths, and avoid invented connections in rings, bit layouts, and comparisons. Browser verification covers static/3D switching and preference restoration, block selection, keyboard orbit, playback/pause, reduced motion, canvas cleanup, and mobile layouts at 390px. The heavy renderer chunk is absent from the initial static HTML. A production build remains a static export with no Rust service or database required.

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
