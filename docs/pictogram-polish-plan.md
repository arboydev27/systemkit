# Pictogram library

The lesson stages' parts are a library of small isometric drawings made in code. This page records how it came to be and how it's built; the `pictogram-polish` skill in `.claude/skills/pictogram-polish/` has the working rules and tools, and `docs/pictogram-catalog.md` lists every part.

## What changed in November 2026

The twelve parts shipped with the animated scaling lessons read well but were drawn plainly: every edge the same heavy ink line, flat faces, round parts split into two flat halves, flat filled rectangles for details, and a DNS signpost that didn't say "lookup". A sample redrawn to the anatomy skill's craft rules looked clearly more crafted at stage size at almost no cost in page weight, so:

- **The core twelve and their base were redrawn** to those rules: a strong ink silhouette over faint creases, four close face tones, bevels under top edges, smooth shading on round parts, recesses with shadowed walls, screws, closed vent slots, label plates, and one lit status light. DNS became a card index with the found card pulled up.
- **About forty new parts were drawn** for the other 21 chapters, from an inventory of every lesson: devices (phone, sensor, outside sender, outside service, inbox), control (API gateway, gate, circuit breaker, rate limiter, token bucket, counter, lock), time (clock, timer, lease, scheduler), services (WebSocket server, fan-out, ID generator, transcoder, fetcher, router, coordinator, registry), logs (log, broker, consumer group, URL frontier, disk) and records (memtable, sorted files, Bloom filter, tree, shard, index, column store, row, document). Each is a real object whose working is the idea: a breaker trips, a lease runs down like a parking meter, a log is a strip that only grows.
- **The parts were split into a core set and packs.** Every stage loads the core twelve; the other parts live in six packs, each its own chunk, and a lesson page downloads only the packs its scene uses.

## How it's built

| Piece | Where |
|---|---|
| The role list: names, heights, packs, the options each role reads | `src/lib/lesson-stage/roles.ts` (`types.ts` re-exports `StageRole` and `GlyphOptions`; `validate.ts` runs `roleProblems`) |
| The drawing kit: projection, boxes, turned bodies, face details | `src/lib/lesson-stage/draw.ts` |
| The core set, the base, the placeholder crate, the leader's flag, shared gradients | `src/lib/lesson-stage/pictograms.ts` |
| The packs and their loader | `src/lib/lesson-stage/packs/` |
| The class vocabulary, coloured from page tokens in both themes | `src/components/lesson-stage/LessonStage.module.css` |
| The comparison sheet | `.claude/skills/pictogram-polish/scripts/sheet.mjs` |
| The guard: every role drawn, well-formed, only known classes, no colours, a status light | `tests/pictograms.test.mjs` |

A scene names roles and never imports drawings. The engine loads the packs a scene needs (`loadScenePacks`) and redraws those parts when they arrive; until then, or if a drawing fails, a part stands as a neutral crate of its height. A lesson's loader can await `loadScenePacks(scene)` first so its parts appear already drawn.

Options a scene can set: `big`, `many`, `replica`, `items`, `level` (and `levelHot`), `count`, `mark`, `open` (true or "half"), `locked`, and `lead` (the leader's flag, on any part). Each role reads only the ones `roles.ts` lists for it, and `npm run check:content` rejects others.

## Constraints that still hold

- **Colour.** Page neutrals only, plus the labs' blue and orange on the status light. Both themes; light ships.
- **Size.** Every lesson page loads the core set, so keep it small; packs load only where used. Measure a lesson page's gzipped JavaScript with a production build.
- **Small sizes.** On a phone a part can be drawn at about 30–50px. The silhouette must still read there.
- **Engine contract.** The base stays 56 across and 7 high with its light on the front face (links plug into ports on the base). A role's `top` must match its drawing, or notes and pills sit wrong.
