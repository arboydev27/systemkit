# SystemKit

SystemKit is an interactive reference for learning system design one decision at a time. Its six-chapter core path begins with a reusable framework and a growing service, then moves through estimation, URL shortening, chat, and video delivery.

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Next.js. Before sharing a release, run:

```bash
npm run typecheck
npm run build
```

## First-release architecture

- **Next.js App Router + React + TypeScript** generate a static site. Lessons and diagrams are bundled with the site, so reading requires no database or server request.
- **CSS and inline SVG** provide the interface and architecture views. Original editable Excalidraw files are in `public/diagrams/`.
- **Browser local storage** keeps a learner's answers and chapter progress on that device. It is optional: the lessons remain readable if storage is blocked.
- **Vercel** is the intended hosting destination when deployment is requested. The static output can be delivered through an edge CDN without operating application servers.

This product teaches load balancing, caching, replication, queues, and sharding. Its own first release does not need those components. Add a shared data store, authentication, and server routes only when cross-device progress or other shared features are needed. Neon is one possible Postgres option at that point; choose it after measuring the data and query needs. The application should remain useful when progress storage fails.

## Content and sources

The lessons, questions, and diagrams are original teaching material informed by Alex Xu's *System Design Interview: An Insider's Guide*. The supplied PDFs used as sources are:

- *System Design - The Framework.pdf*: chapter 3, “A Framework for System Design Interviews,” pages 1–9 of the supplied excerpt. SystemKit presents the method as general engineering practice under the title “System Design Framework.”
- *System Design - Scale to Million Users.pdf*: the scaling chapter, presented as Chapter 02 in SystemKit.
- *System Design Interview.pdf*: chapter 2 on estimation, chapter 8 on URL shortening, and chapter 12 on chat, presented as Chapters 03–05 in SystemKit.
- *System Design - Design Youtube.pdf*: the video platform chapter, presented as Chapter 06 in SystemKit.
- *System Design Cheat Sheet.pdf*: a background reference.

SystemKit does not bundle or reproduce those PDFs. Its diagrams express the concepts in a new layout; they are not traced from the book.

Each chapter uses short lessons, visual explanations, decision scenarios, and self-check questions. Progress is saved separately per chapter. Multiple-choice explanations are guidance, not proof of mastery; learners should be able to explain the tradeoffs in their own words.
