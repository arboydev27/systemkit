---
name: pictogram-polish
description: Use when redrawing, polishing or adding SystemKit's isometric system pictograms in src/lib/lesson-stage/pictograms.ts (client, users, DNS, load balancer, web server, cache, database, CDN edge, object storage, queue, worker, monitoring, and the base they stand on), or when a lesson stage needs a new kind of part. Covers the craft rules at pictogram scale, the engine and CSS contract, a today-vs-candidate comparison sheet, and how to verify in the lesson stages. The plan for the pending polish pass is docs/pictogram-polish-plan.md.
---

# Pictogram polish

SystemKit's lesson stages draw every part of a system as a small isometric object in code: `src/lib/lesson-stage/pictograms.ts`. No image files or icon library. This skill is for making those drawings better, or adding new ones, without breaking the stage. Read `docs/pictogram-polish-plan.md` first: it says what's planned and why.

## How the drawings work

- World units: x and y on the floor, z up; each object's floor centre is (0, 0, 0). `iso(x, y, z)` projects to the screen.
- Primitives: `box` (three faces), `cylinder` (round parts), `face(box, "L" | "R" | "T", inner)` to draw flat details onto a face in u/v coordinates (u left to right, v up), and `roundSide` for shaded round bodies.
- One function per role in `G`, returning SVG markup as a string. `glyph(role, opts)` picks it. `plinth()` draws the rounded base, whose front edge carries the status light.
- The stage scales a glyph by `GLYPH = 1.42` and lifts it by the base height `PH = 7` (`src/lib/lesson-stage/engine.ts`). `GLYPH_TOP` gives each role's height above its floor, which places notes, pills and the down mark. Change it with any height change.
- Colours never live in the drawings. Parts carry classes (`pt`, `pl`, `pr` for top, left and right faces; `led` for the status light; `dl`, `gl` and so on for details) and `src/components/lesson-stage/LessonStage.module.css` colours them from page tokens, inside `.stage :global(...)`. That's how one drawing serves both themes and how a light turns blue (work) or orange (hot).
- Options scenes rely on: `big` (web server, database), `many` (client, web server), `replica` (database ring), `items` (queue backlog 0-4), `level` and `levelHot` (database fill, set by the engine from a part's meter). Keep them working.

## The craft rules at pictogram scale

From the anatomy skill, cut down for parts drawn at about 30–110px:

1. **Silhouette over creases.** The outline is ink at about 1.05 units. Where faces meet, a faint crease (ink at about 22%, 0.6–0.7). Today every edge is drawn the same heavy weight; that is the single biggest change.
2. **Four close tones.** Top lightest, then left, then right, about 3% apart, all page neutrals. In light: `#fff`, `#f5f5f5`, `#f2f2f2`, `#e5e5e5`, `#d6d6d6`. In dark: `#303030`, `#262626`, `#222`, `#151515`, `#0b0b0b`.
3. **Bevels catch light.** A thin strip (about 0.5–1 unit) under each top edge, in the lightest tone.
4. **Round parts shade smoothly** from one horizontal gradient (light about 30% across, dark at the right), never a hard two-tone split. Rings are a shadow line under a light line.
5. **Details are real and end on edges.** Recesses have a floor and a shadowed inner wall under their top edge. Screws are dots of about 0.55 at plate corners. Vents are closed slots. Label plates carry two rule lines. Every line ends on an edge, a seam or a dot: no line stops in mid-air.
6. **One lit accent.** The status light is the only bright mark on a part.
7. **A real object.** A metaphor should be an object whose working is the idea: DNS is a card index of names with the found card pulled up, not a signpost.
8. **Halo, not a grey ellipse.** A soft radial shadow under the base.

What not to do: colour other than page neutrals and the status light, text drawn on parts (names live on the tag under the base), heavy detail that turns to noise at 48px, gradients that carry meaning.

## Workflow

1. **Start from the sample.** `reference/polished-sample.js` has six roles already redrawn to these rules (web server, database, cache, load balancer, DNS, queue) and a polished base, plus the gradients they need (`defs(gid)`). Copy it as your candidate file and extend it role by role.
2. **Compare as you go.** From the repo root:
   ```
   node .claude/skills/pictogram-polish/scripts/compare-sheet.mjs path/to/candidate.js --out /tmp/pictograms.html
   ```
   It renders today's drawing (from `pictograms.ts`) next to the candidate's, in both themes, at 108px and 48px. Open the file in a browser, or capture it headless (the anatomy skill's `scripts/capture.mjs` takes `--zoom x,y,w,h --zoom-scale 2` for close-ups). Read every image. Look at 2× for line ends and tone steps, and at 48px for whether the silhouette still reads.
3. **Port into the site.** Move the drawings into `pictograms.ts` (typed, same exports). Gradients a drawing needs go in the engine's `<defs>` in `createStage` (a stage has one theme at a time, so plain ids like `sk-round` are safe there; the comparison sheet suffixes ids per panel with `GID`). Add the new classes to `LessonStage.module.css` under `.stage :global(...)`, with dark values in the `prefers-color-scheme: dark` block on `.root`. Update `GLYPH_TOP` for any height change.
4. **A new role** needs: the drawing in `G`, its `GLYPH_TOP` and `ROLE_NAMES` entries, the `StageRole` union in `src/lib/lesson-stage/types.ts`, and the `ROLES` set in `src/lib/lesson-stage/validate.ts`.
5. **Check it in the lessons**, not only on the sheet:
   - Every step of all twelve scaling lessons opens directly at `/learn/scaling/<lesson>/#step-N` (`npm run dev`). Capture at 1440×900 and 390×844, light and dark.
   - The anatomy skill's `scripts/drive.mjs` does headless captures and motion contact sheets. Its element shots use `captureBeyondViewport`, which briefly lays the page out narrow and can flip the stage into its phone layout: for desktop shots, capture the viewport (`"html"` with a clip) instead.
   - The Browser pane stalls animation while it's hidden; use headless captures for motion.
   - Check a production build too (`npm run build`, then serve `out/` with a server that doesn't drop lazy-loaded assets): stylesheet order differs from dev.
6. **Run the checks:** `npm test`, `npm run typecheck`, `npm run build`, `npm run check:content -- scaling`. Every lesson page loads the pictograms, so compare a scaling lesson's gzipped JavaScript before and after (it was about 220 KB). Keep the growth to about 2 KB.

## Done looks like

A comparison sheet you'd show proudly in both themes; all twelve lessons checked at desktop and phone sizes; checks passing; size within budget; a draft PR with the sheet and stage screenshots. Commits and PRs carry only the user's identity.
