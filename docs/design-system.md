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

The orb is the home page's navigation, so the page opens on a single pinned stage rather than a stack of sections. The glass lens in the middle of the orb starts the next lesson, and it is the one main action. The names on the rim, and any dot, open the course where they point. The site's four sections sit on an orbit to its right and dock in a row at the top once the page scrolls past; on a phone they are a dock at the bottom. Browsing happens in one glass panel that replaces the words beside the orb: a part, then its chapters, then a chapter's lessons, with the orb turning to match. There is no separate list view, though the list stays in the page for search engines and screen readers, and shows whenever the orb can't run.

Scrolling from the orb to what's below dives through it, a stop at a time. The camera is drawn into a dot facing the visitor, the one under the pointer if there is one, punches through the cell's membrane and stops inside the cell body, beside its nucleus. Each further scroll takes it down the axon to the node of Ranvier of the next lesson on the real route from that dot to a lesson about scaling, two at most, and one more opens the terminal on the game, where the signal carries on as the first request. At each stop a dark glass caption names the lesson and its chapter and says why it follows the one before, from the course's own `related` reasons or else its summary, with a link to open it. The cell goes on living while the camera rests: the channels at the lit node flicker and it fires again, vesicles are carried along the microtubules both ways, and the camera drifts like a hand-held one. It looks like an electron micrograph that's moving, in the same neutrals: structure is grey with bright edges, and only the signal glows. It's drawn in WebGL at whatever size the device can manage, and anything without WebGL 2, or too slow for it, follows the same route and stops through the orb's own lines instead. Inside the dive, a wheel, swipe or key press moves one stop and no further, at a pace slow enough to take in (about two seconds into the cell, under two between nodes), and the rest of that gesture, momentum and all, is held back, so no flick can skip the game. Going back up retraces the same route. Gestures that start outside the dive scroll the page as usual and are held at the next stop. Home, End, links to the game, the Skip to the game button and focus on the hidden orb all jump straight through. It loads after the first screen. Before then, without JavaScript, or with reduced motion, there is no dive: the stage fades, or with reduced motion simply scrolls away.

Below the stage, keep words to a minimum and let the working thing make the point. A small game waits there: an app goes viral, and each call changes a live map of the system, with requests moving through it and a big number for how many are failing. When the trouble is the API call rather than a tier, the call itself goes on the map, hanging from the wire it travels along, and a dot's area shows the work in a request. Then four tiles, each with a verb for a title and a chart that draws itself: Break it, Remember it, Estimate it, Design it. A lab's chart runs that lab's own model, so its shape is what the lab really shows. Pick a sample people already wonder about, such as scaling or caching, rather than one that takes explaining.

On the home page, ink means working and the labs' orange means overloaded, with a darker orange for text so it stays readable. Charts sit finished for anyone who prefers reduced motion or has no JavaScript, and they only move while on screen.

### Glass

Glass only appears on the home page, in the same neutrals as everything else. Its tokens are on `.pageHome` in `Site.module.css`. Reach for it where something floats over the orb or the field of soft light behind the page, because that gives the blur something to bend; a glass card on a plain background is just a grey card. Touch screens drop the blur on panels that scroll, leaving it on the lens, the dock, and the sheet. Glass goes solid under `prefers-reduced-transparency` and `prefers-contrast: more`, and blur never carries meaning on its own.

## Labs and charts

Charts use blue for successful work and orange for offered load, with validated light and dark values in `Lab.module.css`. Reference lines are neutral and dashed. Every chart has a legend, and its values are also available as text or a table. Draw charts at their container's real width so labels stay readable on phones.

## The course orb

The learning path is an orb, because the course is a connected structure rather than a table of contents. It is drawn as neural tissue: in ink like a Golgi stain in the light theme, and glowing like a fluorescence image in the dark. Every lesson is a neuron, a pyramidal cell body pointing outward with its apical dendrite and a skirt of basal dendrites that thin at each fork, and every line is real: a chapter's thread winds through its lessons in order, and links from a lesson's `related` field are axons that dive through the middle, beaded where they make contact. As with the real stain, only some cells show in full, about one in five, plus every finished lesson and whatever is pointed at, so progress grows the brain. A cell body's size says how many links it has, and its brightness says how far back it sits; behind, dendrites draw wider and fainter, which reads as out of focus. The orb lands on the poster's dots and grows its arbors a chapter at a time. Signals light an axon itself, jumping node to node, and the cell they reach flashes the way a calcium indicator does; now and then a cell flashes on its own. The only marks that aren't course data are the faint rim and, on the home page, the highlight that makes it read as a glass sphere. It turns slowly when left alone, at 15 frames a second on touch screens, and comes to rest after 45 seconds without interaction.

The chapter list stays in the page for search engines and screen readers, and it shows instead whenever the orb can't run. Anything that can be done on the orb can also be done in the panel beside it, in ruled rows.
