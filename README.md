# SystemKit

SystemKit is an interactive reference for learning system design one architectural decision at a time. The first chapter follows the journey from a single server to a system that can serve a large audience.

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

The lessons, questions, and diagrams are original teaching material informed by Alex Xu's *System Design Interview: An Insider's Guide*, chapter 1, “Scale from Zero to Millions of Users.” The supplied *System Design Interview* PDF and *System Design Cheat Sheet* PDF were also available as background references. SystemKit does not bundle or reproduce those PDFs. The diagrams express the concepts in a new layout; they are not traced from the book.

The first chapter is designed around 12 short lessons, architecture stages, decision scenarios, and self-check questions. Multiple-choice explanations are guidance, not proof of mastery; learners should be able to explain the tradeoffs in their own words.
