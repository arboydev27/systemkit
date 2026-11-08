# SystemKit design system

A quiet learning workspace. Neutral surfaces keep diagrams and explanations in focus, and green and red are reserved for answer feedback.

## Color

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | `#fafafa` | `#0b0b0b` | Page background |
| Surface | `#ffffff` | `#151515` | Reading and question cards |
| Soft surface | `#f5f5f5` | `#222222` | Quiet hover or grouping |
| Primary text and accent | `#171717` | `#f5f5f5` | Headings, focused actions |
| Secondary text | `#404040` | `#d0d0d0` | Body text |
| Muted text | `#595959` | `#b5b5b5` | Supporting labels |
| Accent tint | `#f2f2f2` | `#262626` | Selected or emphasized surfaces |
| Accent line | `#d6d6d6` | `#484848` | Decorative separation only |
| Control border | `#8a8a8a` | `#777777` | Input and control outlines |
| Text on accent | `#ffffff` | `#111111` | Primary button label |
| Success on tint | `#187646` on `#eaf8f0` | `#8bdcae` on `#1a392b` | Correct answers |
| Error on tint | `#9b3e2d` on `#fff3ed` | `#f2a594` on `#482a27` | Incorrect answers |

Body text meets at least 4.5:1 contrast in both themes, and control outlines at least 3:1. Never rely on color alone: keep the label, icon, or explanation.

## Interaction

Give immediate press feedback, with restrained transitions. Keep keyboard focus explicit. Respect `prefers-reduced-motion`, and make translucent chrome solid under `prefers-reduced-transparency`.

## Diagrams

Use one recognizable pictogram per system role, always with a visible label and a short description. Make the direction of a data flow explicit, and give each lesson its own diagram when the architecture differs. Keep the on-page diagram and its Excalidraw source aligned. On narrow screens, keep the full diagram scrollable rather than shrinking labels.

## Pages outside a lesson

The home, chapter, labs, and practice pages share these tokens. List chapters and lessons as ruled rows rather than grids of cards. Headings stand alone, with no small label above them. Show the product working instead of describing it.

## The home page

Milo sits on the course, and the course is the home page's navigation, so the page opens on a single pinned stage rather than a stack of sections. A thin line runs across the stage like a horizon. Where it passes under Milo it is the course: a tick for every lesson in order (every chapter on a phone), with the four parts sharing it equally so even the smallest has room for its name. Finished lessons are inked in, and the next one is the one orange mark on the line. Milo sits over the visitor's next lesson, so a returning learner finds him further along, and what he says, in a glass speech bubble by his ear, starts it: that bubble is the page's one main action. The four parts are named in a row under his boots, each under its stretch of the line, and open the course where they point. Pointing along the line names the lesson there and clicking opens it; a tap on a phone shows its chapter first; the arrow keys walk it. The site's four sections sit in a row of glass at the top; on a phone they are a dock at the bottom. Browsing happens in one glass panel that replaces the words beside him: a part, then its chapters, then a chapter's lessons, with the line inking in whatever the panel shows and Milo reading it with the visitor. There is no separate list view, though the list stays in the page for search engines and screen readers, and shows whenever the line can't run.

Scrolling from Milo to what's below dives in through his eye. The camera goes for the eye nearer the pointer (or nearer the middle of the screen), the eye's pupil opens like an iris, and through it is a neuron: through the cell's membrane, down the hillock and along the axon, past a node of Ranvier for each lesson on the real route from the visitor's next lesson to a lesson about scaling, with each lesson's name on its node and side branches for its other links. Milo himself comes with the camera until it is inside: the dive's first frame is an exact copy of him, drawn from the same images the page shows, where the page has put them, so nothing jumps when it takes over. Inside, it looks like an electron micrograph that's moving, in the same neutrals: structure is grey with bright edges, and only the signal glows, as a long front that lights each node's ring of channels as it jumps ahead. The terminal's vesicles flare, its membrane opens on the game's map where its requests start, and the signal carries on as the first request. It's drawn in WebGL at whatever size the device can manage, and anything without WebGL 2, or too slow for it, follows the same route through the course's own lines instead. Inside the dive, one wheel turn, swipe or key press plays all of it, into the eye and out onto the game or all the way back, in about a second, and the rest of that gesture, momentum and all, is held back, so no flick can carry the page past the game. Gestures that start outside the dive scroll the page as usual and are held at the game while they last. Anything else that moves the page, a link or the scroll bar, the dive only follows: it takes at least 0.6 seconds however far the page jumps, and when scrolling stops partway it finishes the way the visitor was going. It loads after the first screen. Before then, without JavaScript, or with reduced motion, there is no dive: the stage fades, or with reduced motion simply scrolls away.

Below the stage, keep words to a minimum and let the working thing make the point. A small game waits there: an app goes viral, and each call changes a live map of the system, with requests moving through it and a big number for how many are failing. When the trouble is the API call rather than a tier, the call itself goes on the map, hanging from the wire it travels along, and a dot's area shows the work in a request. Then four tiles, each with a verb for a title and a chart that draws itself: Break it, Remember it, Estimate it, Design it. A lab's chart runs that lab's own model, so its shape is what the lab really shows. Pick a sample people already wonder about, such as scaling or caching, rather than one that takes explaining.

On the home page, ink means working and the labs' orange means overloaded, with a darker orange for text so it stays readable. Charts sit finished for anyone who prefers reduced motion or has no JavaScript, and they only move while on screen.

### Glass

Glass only appears on the home page, in the same neutrals as everything else. Its tokens are on `.pageHome` in `Site.module.css`. Reach for it where something floats over Milo's stage or the field of soft light behind the page, because that gives the blur something to bend; a glass card on a plain background is just a grey card. Touch screens drop the blur on panels that scroll, leaving it on the lens, the dock, and the sheet. Glass goes solid under `prefers-reduced-transparency` and `prefers-contrast: more`, and blur never carries meaning on its own.

## Labs and charts

Charts use blue for successful work and orange for offered load, with validated light and dark values in `Lab.module.css`. Reference lines are neutral and dashed. Every chart has a legend, and its values are also available as text or a table. Draw charts at their container's real width so labels stay readable on phones.

## Milo

Milo is the site's character: a small robot with a screen for a face, sitting on the course line. He's original to SystemKit, designed from concept art and built in Blender, and he stays in the site's neutrals: white satin in the light theme, charcoal in the dark, with only his eyes and the little lights on his chin and chest glowing. The page shows him as two Cycles renders, his body (with the ledge's contact shadow folded in) and his head, each a WebP of a few tens of kilobytes in each theme, chosen by `prefers-color-scheme`. His face's screen is left blank in the renders and his eyes are drawn on it by the page, so they can blink, look at the pointer or at whatever the page is pointing at, squint happily when the main action is pointed at, and open for the dive. His head leans a little after his eyes and he breathes; all of it is a transform or a CSS variable, it stops when he's off screen or nothing has happened for 45 seconds, and none of it runs for anyone who prefers reduced motion. Where he sits on the line is a transform too, so moving him never shifts the layout.

His shape follows the concept art. His head is tall and round, its cheeks curving round his screen, and its crown grows two thick horn-like ears. Each ear curls out at the tip, with a dark crescent along its inner edge. The screen sits flush in a face plate that is part of the head, bounded by a thin seam, with a separate chin plate below holding the chin light. Short seams split the forehead under a crown line that runs along the ears' bases. His body is a bell-shaped torso with a flush shield on the chest. It has a dark neck in a collar well, dark ball shoulders the arms hang from, tapered arms, fists of white finger segments over a dark palm, and dark knees seated in flared boots on dark soles. In the light theme he renders white under broad soft light. In the dark theme he is charcoal, with thin rim light tracing his outline. The visor is dark gloss glass, and the chin and chest lights glow.

The sources are in the Milo project (`systemkit-milo`). `Milo-sitting-v2-light.blend` and `Milo-sitting-v2-dark.blend` hold the pose, the ledge as a shadow catcher, and the studio light. The `sitting` folder has the scripts that rebuild them, in order:
1. `head.py`, `body.py` and `hand.py` build the head, the body and the left fist as signed-distance shapes, meshed with marching cubes (they need numpy and scikit-image). Their numbers are in `head.json`, `body.json` and `hand.json`; `hand.py` also reads the hand bone's frame from `rig.json`, which `rig.py` writes.
2. `final.sh` puts those meshes on the rig (`shape.py`; `hands.py` mirrors the fist onto the right hand), poses him, applies the studio look from `look-light.json` / `look-dark.json`, and renders both themes' layers.
3. `KEEP_W=854 python3 assets.py <out> <repo>` crops the layers into `public/milo` and prints the figure geometry. `KEEP_W` keeps the width the page was laid out for. Copy the printed numbers into `src/lib/milo-figure.ts` by hand.

The geometry the page needs from those renders, where his eyes, screen, neck and seat land on the images, is in `src/lib/milo-figure.ts`. Regenerate it with the renders whenever the pose, the camera or his outline changes. The images' aspect ratio, seat and neck are also written into `Milo.module.css`, `MiloHome.module.css` and `CourseNav.module.css`. The images' `sizes` hints in `MiloHome.tsx` and `CourseMap.tsx` are his height on each layout times that aspect ratio. Tests check all of these agree with `milo-figure.ts`.

The chapter list stays in the page for search engines and screen readers, and it shows instead whenever the course line can't run. Anything that can be done on the line can also be done in the panel beside it, in ruled rows. The learning path page uses the same line, with Milo at the next lesson and the shown chapter's lessons beside him.
