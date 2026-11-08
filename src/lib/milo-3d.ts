// Milo in 3D, for the home page: the sitting pose exported from Blender as a light glTF model (public/milo/3d), lit
// by matcaps rendered from the Cycles studio, with the camera framed on the same crop box as his image layers. Generated
// by the Milo project's web.py and web_assets.py; glTF coordinates (Y up).

export const MILO_3D = {
  model: "/milo/3d/milo.glb",
  materials: ["ear-panel", "graphite-joints", "obsidian-display", "pill-light", "seam", "shell", "soft-white-eyes", "sole"],
  camera: {
    position: [0, 10.5691, 28.8378],
    forward: [0, -0.27564, -0.96126],
    up: [0, 0.96126, -0.27564],
    /** The figure's crop box in the camera's view, so the canvas lines up with his images. */
    frustum: { left: -1.81256, right: 1.81256, top: 2.74319, bottom: -2.23729 },
  },
  /** Each joint the page turns him about, where it is as he sits, and the joint it hangs from. */
  joints: {
    "torso": { at: [0, 1.12, -0], parent: "root" },
    "head": { at: [0.01327, 2.33304, -0.08378], parent: "torso" },
    "upper_arm.L": { at: [-0.51512, 1.88413, -0.13569], parent: "torso" },
    "forearm.L": { at: [-0.80104, 1.44137, -0.32491], parent: "upper_arm.L" },
    "hand.L": { at: [-1.06139, 1.01147, -0.45835], parent: "forearm.L" },
    "upper_arm.R": { at: [0.53183, 1.88413, 0.03013], parent: "torso" },
    "forearm.R": { at: [0.86902, 1.43849, -0.00599], parent: "upper_arm.R" },
    "hand.R": { at: [1.15964, 1.0073, -0.00269], parent: "forearm.R" },
  },
  /** The centres of his eyes on his screen, and the screen's up, as he sits. */
  eyes: { left: [-0.42833, 3.15304, 0.68116], right: [0.45487, 3.15304, 0.68116], up: [0, 1, -0] },
} as const;
