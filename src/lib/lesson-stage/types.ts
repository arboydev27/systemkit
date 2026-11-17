// The data a lesson stage plays: parts, the links between them, and steps of events.
// A scene is plain data, so a chapter can author its own and load it with its lessons.

export type StageRole =
  | "client" | "crowd" | "dns" | "balancer" | "web" | "cache" | "database"
  | "cdn" | "storage" | "queue" | "worker" | "monitor";

/** Options a pictogram understands: a bigger machine, a read replica, a queue's backlog. */
export type GlyphOptions = { big?: boolean; replica?: boolean; items?: number; many?: boolean; level?: number; levelHot?: boolean };

/** Where a part stands: `[tier, lane]`. Tiers run left to right (top to bottom on a phone); lanes stack siblings. */
export type Place = [tier: number, lane: number];

export type StageNode = {
  id: string;
  role: StageRole;
  label: string;
  /** A short description under the name, a few words at most. */
  detail?: string;
  at: Place;
  /** The step (0-based) where this part first appears. Parts without it are there from the start. */
  appear?: number;
  opts?: GlyphOptions;
};

/** A link drawn between two parts. `unless` hides it while that part is on the stage. */
export type StageLink = { from: string; to: string; unless?: string };

/** request: ink; response and work: the labs' blue (work done); hot: the labs' orange (overload, failure); quiet: a muted reply such as a cache miss. */
export type FlowKind = "request" | "response" | "work" | "hot" | "quiet";
export type Light = "idle" | "on" | "work" | "hot";
export type Tone = "" | "hot";

type Timing = {
  /** Start together with the event before instead of after it. */
  with?: boolean;
  /** Milliseconds to wait after the events before, when not `with`. */
  gap?: number;
};

export type PacketEvent = Timing & {
  type: "packet";
  /** Part ids the message passes through, in order. Each hop should follow a link. */
  path: string[];
  /** What the message says, kept short: "GET /product/42", "200 OK". */
  label: string;
  kind?: FlowKind;
  /** It never arrives: it falls short on its last hop and is marked with an ×. */
  lost?: boolean;
};
export type NoteEvent = Timing & { type: "note"; node: string; text: string; tone?: "work" | "hot" };
export type StreamEvent = Timing & {
  type: "stream";
  /** Routes requests keep taking, chosen in proportion to their weight `w`. */
  routes: { path: string[]; w?: number; kind?: FlowKind }[];
  /** Milliseconds between requests (about 200-300 reads as busy without crowding). */
  every?: number;
};
export type StateEvent = Timing & {
  type: "state";
  node?: string;
  nodes?: string[];
  light?: Light;
  /** The load pill: a short reading such as "300 req/s" or "CPU 80%". */
  readout?: string;
  /** How full the part is, 0 to 1; a database fills like a tank. null removes the bar. */
  meter?: number | null;
  tone?: Tone;
  down?: boolean;
  label?: string;
  detail?: string;
  opts?: GlyphOptions;
  at?: Place;
};
export type ShowEvent = Timing & { type: "show"; nodes: string[]; at?: Record<string, Place> };
export type HideEvent = Timing & { type: "hide"; nodes: string[] };
export type MoveEvent = Timing & { type: "move"; at: Record<string, Place> };
export type PauseEvent = { type: "pause"; ms: number; with?: undefined; gap?: number };

export type StageEvent = PacketEvent | NoteEvent | StreamEvent | StateEvent | ShowEvent | HideEvent | MoveEvent | PauseEvent;

export type MetricValue = number | string | { n: number; unit?: string; tone?: Tone };
export type StageMetric = { id: string; label: string };

export type StageControl = {
  label: string;
  options: { label: string; metrics?: Record<string, MetricValue>; events: StageEvent[] }[];
};

export type StageStep = {
  title: string;
  /** Two or three words for the step list and the next button. */
  short: string;
  /** The text equivalent of the step: what happens and why, in one to three sentences. */
  text: string;
  /** Parts this step is about; the rest dim. On a phone the camera frames them. */
  focus?: string[];
  /** Parts the camera must frame on every screen. */
  frame?: string[];
  facts?: [string, string][];
  /** What this step changed, each starting "+ ", "− " or "~ ". */
  changes?: string[];
  metrics?: Record<string, MetricValue>;
  events: StageEvent[];
  /** One thing the learner can change, such as a hit rate. */
  control?: StageControl;
};

export type StageScene = {
  /** The lesson's id. */
  id: string;
  /** One sentence shown before the first step. */
  intro: string;
  metrics?: StageMetric[];
  nodes: StageNode[];
  links: StageLink[];
  steps: StageStep[];
};
