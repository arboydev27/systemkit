---
name: pictogram-polish
description: Use when drawing, redrawing or polishing SystemKit's isometric system pictograms (the parts lesson stages are built from: the core set in src/lib/lesson-stage/pictograms.ts and the packs in src/lib/lesson-stage/packs/), when a lesson needs a part that doesn't exist yet, or when checking how parts look on the stage. Covers the drawing kit, the class vocabulary the stage colours, the role list and packs, the craft rules at pictogram scale, the comparison sheet, and how to verify in the lesson stages. The catalogue of parts is docs/pictogram-catalog.md.
---

# Pictograms

SystemKit's lesson stages draw every part of a system as a small isometric object in code: no image files, no icon library. This skill is for drawing those objects, adding new ones, and checking them on the stage. What exists, what each part looks like and which chapters use it: `docs/pictogram-catalog.md`.

## How the library is built

| File | What it holds |
|---|---|
| `src/lib/lesson-stage/roles.ts` | Every role: default name, `top` (height), `pack`, the options it reads (`opts: "count:1-6 mark level"`), `fill`. Also `GlyphOptions` and `StageRole`, which `types.ts` re-exports, and `roleProblems`, which `validate.ts` runs. |
| `src/lib/lesson-stage/draw.ts` | The kit: `iso`, `box`, `face`, `plane`, `cylinder`, `ball`, and face details (`recess`, `pocket`, `screw`, `slot`, `rule`, `etch`, `etchDot`, `plate`, `led`, `lamp`, `halo`). |
| `src/lib/lesson-stage/pictograms.ts` | The core twelve (every stage loads them), the base (`plinth`), the placeholder crate, the leader's flag (`lead`), `glyph(role, opts)`, `addPack`, `GLYPH_TOP`, `ROLE_NAMES`, and `PICTOGRAM_DEFS` (the shared gradients). |
| `src/lib/lesson-stage/packs/<pack>.ts` | One pack per family: `export default { role(o) { ... } }` and `export const samples` (options to show on the sheet). |
| `src/lib/lesson-stage/packs/index.ts` | `loadScenePacks(scene)`: dynamic imports, one chunk per pack. The engine calls it for any part whose drawing isn't loaded and redraws when it arrives; a loader can call it first so parts appear already drawn. |
| `src/components/lesson-stage/LessonStage.module.css` | The class vocabulary, coloured from page tokens in both themes (`--pk-*` on `.root`). |

A scene never imports drawings: it names roles, and the stage loads their packs. A role whose drawing is missing draws as a neutral crate, never a crash.

## Drawing a part

- **World units.** x and y on the floor, z up; the object's floor centre is (0, 0, 0). `iso(x, y, z)` projects. The stage scales a drawing by `GLYPH = 1.42` onto a base 56 across, so keep the footprint within about ±19 units and the height within about 46. The sheet flags parts that spill off the base or overhang its front (where links plug in).
- **Boxes.** `box(x, y, z, w, d, h, { top, left, right, bevel })` draws three faces (`pt`, `pl`, `pr`), a bevel of light under the top edges, faint creases and an ink silhouette. `face(b, "L" | "R" | "T", inner)` draws on a face in flat coordinates: u to the right, v **up** (on T, v runs toward the front). A rect at `y = v` covers v..v+h going up. `plane(origin, u, v, inner)` does the same on any tilted plane.
- **Round parts.** `cylinder(r, h, { x, y, z, rBottom, bands, level, levelHot, top, crease })` shades the side from one gradient, draws raised rings at `bands`, a fill rising to `level`, and an ellipse top. `ball(cx, cy, r)` for spheres and knobs.
- **Painter's order.** Draw back to front: the halo, then what's furthest from the viewer (smaller x + y), then nearer parts. A part that wraps another (a frame round a carriage) is split into back and front halves.
- **Options.** Read only the options your role lists in `roles.ts`, clamp them (`clamp`), and give every option a visible meaning: `count` repeats an element, `items` fills slots, `level` fills 0-1, `mark` picks one element (pull it out or raise it, and put a `lamp` or `led` on it), `open` raises an arm or trips a lever (`"half"` in between).
- **Height.** Set `top` in `roles.ts` to the drawing's real height (the sheet measures it). Notes, pills and the down mark sit on it.

## The class vocabulary

Drawings carry only these classes (the test fails on any other, and on any colour written into a drawing):

| Class | What it is |
|---|---|
| `pt`, `pl`, `pm`, `pr`, `pd` | Faces, lightest to deepest: top, left, mid, right, deep |
| `bevel`, `bevel-r` | The light strip under a top edge (left and right faces) |
| `edge`, `edge-open` | The ink silhouette, about 1.05 (`edge-open` for an outline that isn't closed) |
| `crease` | A faint line where faces meet, 0.7 at 22% ink |
| `rule`, `etch`, `etch-dot` | Muted detail lines (printed text, engraving), and a dot to end one on |
| `recess`, `wall`, `rim` | A recess's floor, its shadowed inner wall, its faint outline |
| `screw`, `slot`, `plate`, `key`, `finger`, `leg`, `tape`, `gear` | Small real details |
| `card`, `card-lit` | A card with a thin or full outline |
| `handle`, `pole` | A wire or pole drawn as a line |
| `flag`, `ink` | Small solid marks in ink (use sparingly) |
| `spark` | A chart line on a screen |
| `ring-shade`, `ring-light` | A raised ring on a turned body |
| `liquid` (`is-hot`), `surface` | A fill and its surface line |
| `led`, `lamp` | The status light (a stroke, a dot): grey idle, ink on, blue work, orange hot |
| `url(#sk-round)`, `url(#sk-ball)`, `url(#sk-halo)` | Round shading, a lit ball, a contact shadow (`halo()`) |

Fine details (`rule`, `etch`, `rim`, `led`, the `NS` attribute) keep their width on screen; faces and silhouettes scale with the drawing. If a drawing truly needs a new class, add it to the CSS (both themes) and this table in the same change.

## The craft rules at pictogram scale

From the anatomy skill (`~/.claude/skills/anatomy/references/craft.md`), cut down for parts drawn at about 30–110px:

1. **A real object you could build, whose working is the idea.** A breaker trips; a lease runs down like a parking meter; a log is a strip that only grows. Never an abstract slab or a floating icon.
2. **Silhouette over creases.** The outline is ink at about 1.05; where faces meet, a faint crease.
3. **Four close tones.** Top lightest, then left, then right. Bevels catch light under top edges.
4. **Round parts shade smoothly** from the gradient, never a hard two-tone split. Rings are a shadow line under a light line.
5. **Details are real and end on edges.** Recesses have a floor and a shadowed wall. Screws sit at plate corners. Vents are closed slots. Label plates carry two rule lines. Every line ends on an edge, a seam or a dot.
6. **One lit accent.** The status light is the only bright mark; a picked element may carry it too.
7. **Read at 32px.** The silhouette alone must say what it is at the size of a phone stage. Fine detail may turn to texture there, never to noise: fewer, larger details beat many small ones.
8. **No text, logos, brands or colours** on parts. Names live on the tag under the base; numbers in the pill.

## Workflow

1. **Read** `docs/pictogram-catalog.md` for the part's object and options, and look at the core drawings in `pictograms.ts` for the finish to match.
2. **Draw** in the pack's file (or `pictograms.ts` for a core part), list options worth seeing in the pack's `samples`, and set `top` in `roles.ts`.
3. **Compare** on the sheet, built from the real drawings and the stage's real CSS:
   ```
   node .claude/skills/pictogram-polish/scripts/sheet.mjs --out /tmp/pictograms.html [--packs logs,time] [--no-core]
   node ~/.claude/skills/anatomy/scripts/drive.mjs /tmp/pictograms.html '[["shot","/tmp/logs.png","#pack-logs",1],["shot","/tmp/logs-2x.png","#pack-logs .light",2]]' --width 1500
   ```
   Core parts show today's drawing (`--today`, default `origin/main`) beside the new one. Every part shows at 108, 48 and 32 px, with its samples and the work and hot lights, in both themes. A red note under a part means its `top` is wrong or it spills off its base. Read every image: 2× for line ends and tone steps, 32px for whether the silhouette still reads.
4. **Test:** `node --test tests/pictograms.test.mjs` (every role drawn by its pack, well-formed markup, only known classes, no colours, a status light) and `npm run typecheck`.
5. **Check it in the lessons**, not only on the sheet:
   - Every step opens directly at `/learn/<chapter>/<lesson>/#step-N`. Capture at 1440×900 and 390×844, light and dark.
   - The anatomy skill's `scripts/drive.mjs` does headless captures. Its element shots use `captureBeyondViewport`, which lays the page out narrow and can flip the stage into its phone layout: for desktop shots, capture the viewport with a clip.
   - The Browser pane stalls animation while it's hidden; use headless captures.
   - Check a production build too (`npm run build`, then serve `out/` with a Node static server; `python -m http.server` drops lazily loaded chunks such as packs).
6. **Run the checks:** `npm test`, `npm run typecheck`, `npm run build`, `npm run check:content -- <chapter>`. Every lesson page loads the core set, so keep it small: a scaling lesson's stage chunk was 21.3 KB gzipped before the library (56.3 KB raw); packs load only where used.

## Adding a part

Add the role to `roles.ts` (name, top, pack, opts), draw it in that pack, add a row to `docs/pictogram-catalog.md`, and run the sheet and the test. No change to `types.ts`, `validate.ts`, the engine or the CSS. A new pack also needs a loader line in `packs/index.ts` and its name in `PackName`.

## Done looks like

A sheet you'd show proudly in both themes; the lessons that use the part checked at desktop and phone sizes; checks passing; size within budget. Commits and PRs carry only the user's identity.
