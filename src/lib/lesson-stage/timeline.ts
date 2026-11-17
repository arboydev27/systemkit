// Placeholder: the timeline figure is being drawn. It plays its events' lasting changes without drawing them.
import type { FigureFactory } from "./figure";

const TYPES = new Set(["packet", "mark", "span", "rewind"]);
export const timelineFigure: FigureFactory = () => ({
  handles: (e) => TYPES.has(e.type),
  bounds: () => null,
  render: () => {},
  clear: () => {},
});
