// Milo's turn frames, rendered in Blender with the same light and camera as his plain layers (see milo-figure.ts),
// and packed into one sprite per layer, theme and size in public/milo (<theme>-turns-head[-s] and -turns-body, AVIF
// with a WebP fallback). Generated with the renders by the Milo project's assets.py; see docs/design-system.md.
//
// The head's frames are a grid of nods (rows: degrees down) by yaws (columns: degrees toward the image's right); the
// body's are a row of twists of his torso on still hips, legs and fists (degrees toward the image's right). Each
// sprite's cells share one box, given as [x, y, width, height] in fractions of the figure, and are `cell` pixels in
// the full sprite and `smallCell` in the -s one, for phones. The straight-ahead cell is empty: that frame is the plain
// layer. For each head frame, `affine` is the SVG matrix, in the figure's pixels (MILO.width by MILO.height), that
// carries his eyes as drawn for the straight frame onto that frame's turned screen; for each body frame, `neck` is how
// far the neck, and so the head on it, moves, in fractions of the figure.

export const MILO_TURNS = {
  yaws: [-21, -14, -7, 0, 7, 14, 21],
  nods: [-8, 0, 10],
  twists: [-8, -4, 0, 4, 8],
  head: {
    box: [0.08134, 0.0163, 0.84478, 0.58935],
    cell: [755, 723],
    smallCell: [453, 434],
    affine: [
      [0.93358, 0.09878, -0.05236, 1.0273, 0.46, -139.7],
      [0.9703, 0.06668, -0.03535, 1.02877, -9.9, -116.78],
      [0.99255, 0.03359, -0.01781, 1.02967, -10.06, -93.69],
      [1, 0, 0, 1.02997, 0, -70.76],
      [0.99255, -0.03359, 0.01781, 1.02967, 20.12, -48.35],
      [0.9703, -0.06668, 0.03535, 1.02877, 50, -26.77],
      [0.93358, -0.09878, 0.05236, 1.0273, 89.19, -6.36],
      [0.93358, 0.09878, -0.0005, 0.99997, -56.11, -71.82],
      [0.9703, 0.06668, -0.00034, 0.99999, -48.09, -47.31],
      [0.99255, 0.03359, -0.00017, 1, -29.3, -23.25],
      [1, 0, 0, 1, 0, 0],
      [0.99255, -0.03359, 0.00017, 1, 39.36, 22.09],
      [0.9703, -0.06668, 0.00034, 0.99999, 88.19, 42.7],
      [0.93358, -0.09878, 0.0005, 0.99997, 145.76, 61.51],
      [0.93358, 0.09878, 0.06422, 0.93855, -123.94, 40.17],
      [0.9703, 0.06668, 0.04335, 0.93673, -93.88, 66.6],
      [0.99255, 0.03359, 0.02184, 0.93564, -52.36, 91.82],
      [1, 0, 0, 0.93527, 0, 115.46],
      [0.99255, -0.03359, -0.02184, 0.93563, 62.42, 137.16],
      [0.9703, -0.06668, -0.04335, 0.93673, 133.97, 156.61],
      [0.93358, -0.09878, -0.06422, 0.93855, 213.59, 173.5],
    ],
  },
  body: {
    box: [0.07164, 0.50516, 0.8597, 0.48778],
    cell: [768, 599],
    smallCell: [461, 359],
    neck: [
      [0.00319, 0.00015],
      [0.0016, 0.00007],
      [0, 0],
      [-0.00162, -0.00004],
      [-0.00325, -0.00005],
    ],
  },
} as const;
