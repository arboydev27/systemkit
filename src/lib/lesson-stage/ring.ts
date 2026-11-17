// Placeholder: the ring figure is being drawn. It plays its events' lasting changes without drawing them.
import type { FigureFactory } from "./figure";

const TYPES = new Set(["token", "key", "scatter", "walk", "arc"]);
export const ringFigure: FigureFactory = () => ({
  handles: (e) => TYPES.has(e.type),
  bounds: () => null,
  render: () => {},
  clear: () => {},
});
