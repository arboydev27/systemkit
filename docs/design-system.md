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

The home page keeps words on the left and the working thing on the right, all the way down. The orb and the lesson panel open it, because they serve a new visitor and a returning learner alike; a lab follows, because being asked to answer is the point; then one real question from each other part of the course. Only the primary button is solid in the opening screen, so the eye has one place to land.

## Labs and charts

Charts use blue for successful work and orange for offered load, with validated light and dark values in `Lab.module.css`. Reference lines are neutral and dashed. Every chart has a legend, and its values are also available as text or a table. Draw charts at their container's real width so labels stay readable on phones.

## The course orb

The learning path opens as an orb, because the course is a connected structure rather than a table of contents. It is drawn in ink on the page, with no panel behind it: pale stippling in the light theme, starlight in the dark. Every dot is a lesson and every line is real: a chapter's thread winds through its lessons in order, and links from a lesson's `related` field dive through the middle. A dot's size says how many links it has, and its brightness says how far back it sits and whether the lesson is finished, so progress lights the orb up. The only mark that isn't course data is the faint rim that makes it read as a sphere. It turns slowly when left alone, at 15 frames a second on touch screens, and comes to rest after 45 seconds without interaction.

The chapter list stays in the page in either view, and it shows instead whenever the orb can't run. Anything that can be done on the orb can also be done in the panel beside it, in ruled rows.
