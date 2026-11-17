// The "time" pack: drawn to the rules in .claude/skills/pictogram-polish. Roles and their options are listed in roles.ts.
import type { GlyphOptions, StageRole } from "../roles.ts";
import type { Pack } from "../pictograms.ts";

const pack: Pack = {};

export default pack;

/** Options worth seeing on the comparison sheet, per role (the first is how scenes usually show it). */
export const samples: Partial<Record<StageRole, GlyphOptions[]>> = {};
