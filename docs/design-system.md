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

The brain is the home page's navigation, so the page opens on a single pinned stage rather than a stack of sections. The glass lens in the middle of the brain starts the next lesson, and it is the one main action. The part names on their lobes, and any dot, open the course where they point. The site's four sections sit on an orbit to its right and dock in a row at the top once the page scrolls past; on a phone they are a dock at the bottom. Browsing happens in one glass panel that replaces the words beside the brain: a part, then its chapters, then a chapter's lessons, with the brain turning to match. There is no separate list view, though the list stays in the page for search engines and screen readers, and shows whenever the brain can't run.

Scrolling from the brain to what's below dives through it. The camera is drawn into a dot facing the visitor, the one under the pointer if there is one, and the dot opens onto a neuron: through the cell's membrane, down the hillock and along the axon, past a node of Ranvier for each lesson on the real route from that dot to a lesson about scaling, with each lesson's name on its node and side branches for its other links. The brain's body, grooves and neurons, as drawn when the dive begins, come with it until the camera is inside. It looks like an electron micrograph that's moving, in the same neutrals: structure is grey with bright edges, and only the signal glows, as a long front that lights each node's ring of channels as it jumps ahead. The terminal's vesicles flare, its membrane opens on the game's map where its requests start, and the signal carries on as the first request. It's drawn in WebGL at whatever size the device can manage, and anything without WebGL 2, or too slow for it, follows the same route through the brain's own lines instead. Inside the dive, one wheel turn, swipe or key press plays all of it, into the dot and out onto the game or all the way back, in about a second, and the rest of that gesture, momentum and all, is held back, so no flick can carry the page past the game. Gestures that start outside the dive scroll the page as usual and are held at the game while they last. Anything else that moves the page, a link or the scroll bar, the dive only follows: it takes at least 0.6 seconds however far the page jumps, and when scrolling stops partway it finishes the way the visitor was going. It loads after the first screen. Before then, without JavaScript, or with reduced motion, there is no dive: the stage fades, or with reduced motion simply scrolls away.

Below the stage, keep words to a minimum and let the working thing make the point. A small game waits there: an app goes viral, and each call changes a live map of the system, with requests moving through it and a big number for how many are failing. When the trouble is the API call rather than a tier, the call itself goes on the map, hanging from the wire it travels along, and a dot's area shows the work in a request. Then four tiles, each with a verb for a title and a chart that draws itself: Break it, Remember it, Estimate it, Design it. A lab's chart runs that lab's own model, so its shape is what the lab really shows. Pick a sample people already wonder about, such as scaling or caching, rather than one that takes explaining.

On the home page, ink means working and the labs' orange means overloaded, with a darker orange for text so it stays readable. Charts sit finished for anyone who prefers reduced motion or has no JavaScript, and they only move while on screen.

### Glass

Glass only appears on the home page, in the same neutrals as everything else. Its tokens are on `.pageHome` in `Site.module.css`. Reach for it where something floats over the brain or the field of soft light behind the page, because that gives the blur something to bend; a glass card on a plain background is just a grey card. Touch screens drop the blur on panels that scroll, leaving it on the lens, the dock, and the sheet. Glass goes solid under `prefers-reduced-transparency` and `prefers-contrast: more`, and blur never carries meaning on its own.

## Labs and charts

Charts use blue for successful work and orange for offered load, with validated light and dark values in `Lab.module.css`. Reference lines are neutral and dashed. Every chart has a legend, and its values are also available as text or a table. Draw charts at their container's real width so labels stay readable on phones.

## The course brain

The learning path is a brain, because the course is a connected structure rather than a table of contents, and because systems thinking is what it trains. It is drawn as a specimen in the site's neutrals, never pink: a pale body with a fine, even outline and a tone that lightens toward the upper left, and two hemispheres either side of the longitudinal fissure, with the cerebellum tucked under the back and the brainstem below. The shape is a smooth union of ellipsoids fitted to the MNI152 average adult brain. It rests in the view anatomy plates use: the frontal lobe on the left, seen a little from above so the fissure shows.

Every mark on it is course data except its outline and shading. Each of the four parts is a lobe in both hemispheres, chosen for what the lobe does. Thinking like a designer, which is estimating and judging scale, is the parietal lobe. How data behaves, which is memory, is the temporal lobe, running back into the occipital lobe as it does on a real brain. Keeping systems healthy, which is balance and timing, is the cerebellum. Designing real products, which is planning and doing, is the frontal lobe. Each chapter is a gyrus, its thread running along the crest, and the grooves are where neighbouring lessons aren't joined by a thread. They are faint broken strokes inside a chapter, firmer between chapters, and heaviest between lobes and down the fissure, so the central and Sylvian sulci come from the course's own structure. The cerebellum's fine folia are the one drawn texture, shading its form so it reads at a glance. The part names sit on their lobes, as names sit on the structures in an anatomy plate, on whichever hemisphere faces the viewer.

Every lesson is a neuron, a pyramidal cell body pointing outward with its apical dendrite and a skirt of basal dendrites that thin at each fork. Links from a lesson's `related` field are axons that run through the inside of the brain, beaded where they make contact. As with Golgi's stain, only some cells show in full: about one in five, plus every finished lesson and whatever is pointed at, so progress grows the brain. A cell body's size says how many links it has, and its brightness says how far back it sits. The brain lands on the poster, its first paint, which has the same outline worked out at build time. Then the grooves etch in and the neurons grow, a chapter at a time.

The labs' orange appears only where a signal fires: a cell lighting up like a calcium indicator, the front of a signal jumping node to node along an axon, and the ring that goes out from the lesson to do next. Everything else stays ink. The brain turns slowly about its vertical axis when left alone, at 15 frames a second on touch screens, and comes to rest after 45 seconds without interaction.

The chapter list stays in the page for search engines and screen readers, and it shows instead whenever the brain can't run. Anything that can be done on the brain can also be done in the panel beside it, in ruled rows.
