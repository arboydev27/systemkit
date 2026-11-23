// What a layout module plugs into the stage: a figure that is not a part, such as a hash ring, an append-only log or a
// timeline. The engine draws the parts, their links and messages; a figure draws its own things, places parts when it
// lays them out, and tells the camera and the links where it is. Each figure lives in its own module, loaded only by
// scenes that use it (see figures.ts), so a lesson without one never downloads it.
import type { StageModel } from "./model";
import type { Rect } from "./routing";
import type { FlowKind, StageEvent, StageScene } from "./types";

export type Point = { x: number; y: number };
/** Cancels what a step was doing when the learner moves on: a dead token makes `tween` and `after` reject. */
export type Token = { dead: boolean };
/** A flat label that floats over the drawing, such as a message pill; `place` redraws it at a label scale. */
export type Overlay = { x: number; y: number; sc: number; op: number; place(s: number): void };

export type FigureContext = {
  scene: StageScene;
  /** The learner prefers reduced motion: draw end states only, nothing travels. */
  reduce: boolean;
  /** Where a figure draws: under the links (floor), between the parts and their tags (mid), over the tags (top). */
  layers: { floor: SVGGElement; mid: SVGGElement; top: SVGGElement };
  /** A phone-sized stage (under 560px wide): tiers run down the screen and tags show names only. */
  narrow(): boolean;
  /** The camera's zoom now. */
  zoom(): number;
  /** The scale that keeps a flat label (tag, pill, note) its size on screen at zoom k, down to a floor. */
  labelScale(k?: number): number;
  /** The stage's state as drawn, and the step playing (-1 before the first). */
  model(): StageModel;
  step(): number;
  /** Where a part stands now (mid-move while parts move), and where it stands in a model. */
  at(id: string): Point | undefined;
  goal(id: string, m: StageModel): Point;
  /** How high a part's drawing stands above the middle of its base, and the box its tag takes, in world units. */
  top(id: string): number;
  tag(id: string): Rect | undefined;
  /** Time that pausing freezes; both reject with the cancel signal once `tk` is dead (let it propagate). */
  tween(ms: number, tk: Token, fn: (p: number) => void): Promise<void>;
  after(ms: number, tk: Token): Promise<void>;
  /** Time that runs on while paused, for small flourishes that must finish. */
  realtime(ms: number, fn: (p: number) => void): Promise<void>;
  ease: { inOut(t: number): number; out(t: number): number; in(t: number): number; back(t: number): number };
  /** The ring a part makes on the floor when something reaches it, and its little hop. */
  pulse(p: Point, kind?: "plain" | "work" | "hot", big?: boolean): void;
  bob(id: string): void;
  /** A message pill like the ones packets ride, drawn over everything; move it through `o` and call `o.place(labelScale())`. */
  pill(label: string, kind: FlowKind): { o: Overlay; remove(): void };
  /** Send a message along parts and their links exactly as a packet event does (trail, pill, ring on arrival), and,
   * for reduced motion or a linked step, leave it resting where it arrives. */
  message(path: string[], label: string, kind: FlowKind, tk: Token): Promise<void>;
  rest(path: string[], label: string, kind: FlowKind): void;
  /** How fast messages travel, in world units per ms, so a figure's messages keep the stage's pace. */
  speed: number;
  /** Make an SVG element with attributes, optionally appended to a parent. */
  el<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K];
};

export type Figure = {
  /** Which events this figure plays. A timeline also takes packets, which become messages between lifelines. */
  handles(e: StageEvent): boolean;
  /** Where a part stands when this figure lays the parts out (a ring, a timeline); undefined leaves it to the tiers. */
  place?(id: string, m: StageModel): Point | undefined;
  /** The box everything the figure draws for model m takes at zoom k, for the camera; `list` is what the step frames. */
  bounds(m: StageModel, k: number, list: string[]): Rect | null;
  /** On a phone, how much room (in label pixels, before label scaling) the figure takes under a part, so tiers space out. */
  below?(id: string, m: StageModel): number;
  /** Boxes beside a part that links must keep clear of, at label scale s. */
  obstacles?(id: string, at: Point, m: StageModel, s: number): Rect[];
  /** Bring the drawing to model m: animate the change unless `instant` (a linked step, reduced motion, a resize). */
  render(m: StageModel, tk: Token, instant: boolean): Promise<void> | void;
  /** Play one event arriving: `before` is drawn, `after` is the model once it has happened. Must leave `after` drawn. */
  play?(e: StageEvent, before: StageModel, after: StageModel, tk: Token): Promise<void>;
  /** Leave what a played event shows behind (its trail, its resting message) without playing it. */
  settle?(e: StageEvent, m: StageModel): void;
  /** Remove what events left behind for the step (trails, highlights, resting messages), not the lasting drawing. */
  clear(): void;
  /** The parts the step is about; the rest dim. */
  focus?(list: string[] | undefined): void;
  /** The camera moved or parts moved: put flat labels and attached things where they now belong. */
  layout?(): void;
  /** The stage switched between its phone and wide layouts; a full `render(m, tk, true)` follows. */
  resize?(): void;
  destroy?(): void;
};
export type FigureFactory = (ctx: FigureContext) => Figure;
