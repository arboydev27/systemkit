// Placeholder: the log figure is being drawn. It plays its events' lasting changes without drawing them.
import type { FigureFactory } from "./figure";

const TYPES = new Set(["append", "cursor", "read", "roll", "compact", "flush", "truncate", "record", "bracket"]);
export const logFigure: FigureFactory = () => ({
  handles: (e) => TYPES.has(e.type),
  bounds: () => null,
  render: () => {},
  clear: () => {},
});
