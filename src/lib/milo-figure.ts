// Milo, the home page's character, as rendered in Blender (Cycles) from the sitting pose: where things land on the
// image layers in public/milo, as fractions of the image's width and height. Generated with the renders; see
// docs/design-system.md for how they are made.

export const MILO = {
  width: 854,
  height: 1189,
  /** Width of the smaller layers, for phones. */
  small: 461,
  /** The middle of the seat, on the front edge of the ledge he sits on. */
  seat: [0.5, 0.82606],
  /** His eyes, left then right on the image, as ellipses on his face's screen. */
  eyes: [
    { x: 0.37639, y: 0.40712, rx: 0.03769, ry: 0.04422 },
    { x: 0.63126, y: 0.40712, rx: 0.03769, ry: 0.04422 },
  ],
  /** The screen his eyes are drawn on. */
  display: { x: 0.50383, y: 0.4121, rx: 0.30067, ry: 0.09876 },
  /** Where the head turns on the neck. */
  neck: [0.50383, 0.5269],
} as const;
