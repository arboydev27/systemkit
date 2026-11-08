// Milo, the home page's character, as rendered in Blender (Cycles) from the sitting pose: where things land on the
// image layers in public/milo, as fractions of the image's width and height. Generated with the renders; see
// docs/design-system.md for how they are made.

export const MILO = {
  width: 874,
  height: 1189,
  /** Width of the smaller layers, for phones. */
  small: 472,
  /** The middle of the seat, on the front edge of the ledge he sits on. */
  seat: [0.5, 0.8569],
  /** His eyes, left then right on the image, as ellipses on his face's screen. */
  eyes: [
    { x: 0.37922, y: 0.44172, rx: 0.03683, ry: 0.04423 },
    { x: 0.62826, y: 0.44172, rx: 0.03683, ry: 0.04423 },
  ],
  /** The screen his eyes are drawn on. */
  display: { x: 0.50374, y: 0.4454, rx: 0.2938, ry: 0.10053 },
  /** Where the head turns on the neck. */
  neck: [0.50374, 0.56138],
} as const;
