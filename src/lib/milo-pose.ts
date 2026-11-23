import { MILO } from "./milo-figure";
import { MILO_HANG } from "./milo-hang";

/** How Milo is shown: sitting on the ledge, or hanging on the side of the course's rod. */
export type MiloPose = "sit" | "hang";

/**
 * Where the home page hangs him on the rod rather than sitting him on the ledge: a screen held upright and narrower than
 * the wide layout, where height is what there's room for. Everywhere else, phones on their side included, he sits.
 */
export const ROD_MEDIA = "(max-width: 959px) and (min-height: 600px)";

/** A pose's figure geometry, by the figure's data-milo-pose. */
export const figureOf = (pose: string | undefined) => (pose === "hang" ? MILO_HANG : MILO);
