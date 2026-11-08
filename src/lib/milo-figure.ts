// Milo, the home page's character, as rendered in Blender (Cycles) from the sitting pose: where things land on the
// image layers in public/milo, as fractions of the image's width and height. Generated with the renders; see
// docs/design-system.md for how they are made.

export const MILO = {
  width: 1340,
  height: 1841,
  /** Width of the smaller layers, for phones. */
  small: 724,
  /** The middle of the seat, on the front edge of the ledge he sits on. */
  seat: [0.5, 0.86162],
  /** His eyes, left then right on the image, as ellipses on his face's screen. */
  eyes: [
    { x: 0.38184, y: 0.42385, rx: 0.03604, ry: 0.04285 },
    { x: 0.62548, y: 0.42385, rx: 0.03604, ry: 0.04285 },
  ],
  /** The screen his eyes are drawn on. */
  display: { x: 0.50366, y: 0.42742, rx: 0.28743, ry: 0.09739 },
  /** Where the head turns on the neck. */
  neck: [0.50366, 0.53977],
} as const;
