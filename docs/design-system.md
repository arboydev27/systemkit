# SystemKit design system

SystemKit is a quiet learning workspace. Neutral surfaces leave the diagrams and explanations in focus; green and red are reserved for answer feedback. The stacked-layer mark stands for the system being assembled one tier at a time.

## Color roles

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | `#fafafa` | `#0b0b0b` | Page background |
| Surface | `#ffffff` | `#151515` | Reading and question cards |
| Soft surface | `#f5f5f5` | `#222222` | Quiet hover or grouping |
| Primary text and accent | `#171717` | `#f5f5f5` | Headings, focused actions |
| Secondary text | `#404040` | `#d0d0d0` | Body text |
| Muted text | `#595959` | `#b5b5b5` | Supporting labels |
| Accent tint | `#f2f2f2` | `#262626` | Selected or emphasized surfaces |
| Accent line | `#d6d6d6` | `#484848` | Decorative separation |
| Control border | `#8a8a8a` | `#777777` | Essential input and control outlines |
| Text on accent | `#ffffff` | `#111111` | Primary button label |
| Success on tint | `#187646` on `#eaf8f0` | `#8bdcae` on `#1a392b` | Correct answer feedback |
| Error on tint | `#9b3e2d` on `#fff3ed` | `#f2a594` on `#482a27` | Incorrect answer feedback |

These are semantic roles, with separate light and dark values. Do not make success or error understandable through color alone; keep the answer label, icon, and explanation. The SVG favicon reverses from a dark tile with white layers to a light tile with dark layers according to `prefers-color-scheme`. Its strokes are heavier than the larger brand mark so the stack remains legible in a browser tab.

## Contrast check

Ratios below use WCAG relative luminance for the listed sRGB pairs. Normal text needs at least 4.5:1; essential control outlines need at least 3:1 against adjacent colors.

| Pair | Light | Dark |
| --- | ---: | ---: |
| Primary text on surface | 17.93:1 | 16.75:1 |
| Secondary text on surface | 10.37:1 | 11.84:1 |
| Muted text on surface | 7.00:1 | 8.91:1 |
| Primary button label on accent | 17.93:1 | 17.32:1 |
| Success text on success tint | 5.16:1 | 7.78:1 |
| Error text on error tint | 6.18:1 | 6.47:1 |
| Accent line on surface | 1.45:1 | 2.00:1 |

`--accent-line` is suitable for decoration, but cannot alone define an essential input or control. Use `--control-border` where an outline carries the control shape: 3.45:1 on white and 3.17:1 on soft surface in light mode; 4.08:1 on surface and 3.55:1 on soft surface in dark mode. Keep keyboard focus explicit and check the rendered states after translucency and hover styles are applied.

## Interaction

Use immediate press feedback and restrained transitions for navigation or answer selection. Reserve spring motion for elements people directly manipulate; any such movement must remain interruptible. Respect `prefers-reduced-motion` with a static or short opacity response, and make translucent chrome solid under `prefers-reduced-transparency`. The favicon itself is static.

## Guidance used

Apple HIG `color.md › Best practices` and `dark-mode.md › Best practices` call for role-based colors that adapt to both appearances. `accessibility.md › Vision` provides the text contrast thresholds and asks that meaning not rely on color alone. `branding.md › Best practices` supports restrained brand color and content-first screens. `icons.md › Best practices` favors a simple vector shape. The Apple motion skill’s “Reduced motion & accessibility” and “Response” sections inform the interaction rules above. For this web app, the principles are translated into CSS custom properties and media queries.
