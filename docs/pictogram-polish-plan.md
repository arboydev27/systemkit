# Pictogram polish plan

A planned pass on the lesson stage's system pictograms (`src/lib/lesson-stage/pictograms.ts`). Not started. When it is, use the `pictogram-polish` skill in `.claude/skills/pictogram-polish/`, which has the rules, a sample of six polished drawings, and a script that builds a today-vs-new comparison sheet.

## Why

The pictograms shipped with the animated scaling lessons read well, but they are drawn plainly: every edge is the same heavy ink line, faces are flat, round parts split into two flat halves, details are flat filled rectangles, and the DNS signpost doesn't say "lookup". A sample redrawn to the anatomy skill's craft rules (sent for review in November 2026, kept in the skill's `reference/`) looked clearly more crafted at stage size, at almost no cost in page weight.

## What changes

The rules, at pictogram scale:

- **Lines.** A strong ink silhouette (about 1.05 units) over faint creases where faces meet (about 0.6–0.7, ink at 22%). Details in the muted tone at about 0.6.
- **Volume.** Four close face tones from the page neutrals, a thin bevel of light under every top edge, smooth shading on round parts from one gradient, and a soft radial halo under the base instead of the flat grey ellipse.
- **Real details that end on edges.** Recesses with an inner wall (bays, ports, screens), screws at plate corners, closed vent slots, label plates with two rule lines. No line stops in mid-air.
- **One lit accent.** The status light stays the only bright mark: ink when on, the labs' blue for work, the labs' orange when hot.
- **Objects you could build.** Where a pictogram is a metaphor, it should be a real object whose working is the idea.

Per part:

| Part | Today | Planned |
|---|---|---|
| Web server | Tower with flat bays | Label plate, recessed drive bays with pulls and lights, vent grille, side vents, lid seam and screws |
| Database | Two-tone cylinder with lines | Smoothly shaded drum, raised rings, cap; the fill level keeps working |
| Cache | Board with chips | Bevelled board, chips with legs, gold contacts on the edge, one light |
| Load balancer | Box with a fan symbol | A 1U appliance: recessed ports with link lights, the fan-out etched in the lid, screws |
| DNS | Signpost | Card index: an open box of address cards, one card pulled up (the entry found) |
| Queue | Tray with cubes | Tray on rollers with an end stop, taped parcels (darker than the sample), direction etched on the lip |
| Client | Laptop | Recessed screen with an inner wall, keyboard rows, trackpad recess |
| Users | Crowd of capsules | Same crowd, smooth shading on bodies and heads |
| CDN edge | Globe on a plinth | Smoothly shaded sphere, meridians clipped to it, edge lights as the one accent |
| Object storage | Bucket | Smooth cone shading, a rim with an inner wall, the handle |
| Worker | Box with a gear | Recessed gear on the face, vent slots, screws |
| Monitoring | Screen on a stand | Recessed screen with the sparkline, stand and foot with screws |
| Base | Rounded slab | Bevel strip on the rim, faint crease where top meets side, halo |

The options scenes already use keep working: `big` (web server, database), `many` (client, web server), `replica`, `items` (queue backlog) and the database fill `level`.

## Constraints

- **Colour.** Page neutrals only, plus the labs' blue and orange for status. Both themes; light ships.
- **Size.** Every lesson page loads the pictograms, so the drawing code may grow by about 2 KB gzipped at most. Measure with a production build.
- **Small sizes.** On a phone a part can be drawn at about 30–50px. The silhouette must still read there; fine detail may turn to texture but must not turn to noise. If it does, add a level of detail: the engine passes a `detail` option when the camera's zoom is below about 0.5 and the drawings skip their finest parts.
- **Engine contract.** Faces keep their classes so the stage can colour them. New gradients (round shading, halo) go in the engine's `<defs>`, which works because a stage has one theme at a time. `GLYPH_TOP` must match any height change, or notes and pills will sit wrong.

## Steps

1. Port the six sample drawings from the skill's `reference/polished-sample.js` into `pictograms.ts`, then draw the other six and the base to the same rules.
2. Add the new classes and gradients to `LessonStage.module.css` and the engine's `<defs>`.
3. Build the comparison sheet with the skill's script and review it in both themes at 108px and 48px, then at 2× for line ends and tone steps.
4. Check every step of all twelve scaling lessons at 1440×900 and 390×844 in both themes.
5. Run `npm test`, `npm run typecheck`, `npm run build` and `npm run check:content -- scaling`, and compare the scaling lesson's JavaScript size with today's (about 220 KB gzipped).
6. Open a draft PR with the comparison sheet and stage screenshots.

A rough size: one focused session for the twelve drawings and the base, plus a QA pass on the twelve lessons.
