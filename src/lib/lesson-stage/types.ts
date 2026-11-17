// The data a lesson stage plays: parts, the links between them, and steps of events.
// A scene is plain data, so a chapter can author its own and load it with its lessons.

// The parts a stage can draw and the options they read live in roles.ts, with the pictograms.
import type { GlyphOptions, StageRole } from "./roles.ts";
export type { GlyphOptions, StageRole };

/** Where a part stands. In tiers (the default layout): `[tier, lane]`, tiers running left to right (top to bottom on a
 * phone) and lanes stacking siblings. Around a ring: `[position, distance]`, the ring position it stands by (0 at the top,
 * clockwise) and how far out (0 the centre, 1 just outside the rim, 2 a part further out). On a timeline:
 * `[lifeline, 0]`, the order of its lifeline (0 first: the top row on a wide screen, the left column on a phone). */
export type Place = [a: number, b: number];

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
  /** Start together with the event before instead of after it. On a timeline it also starts at the same time. */
  with?: boolean;
  /** Milliseconds to wait after the events before, when not `with`. */
  gap?: number;
};
/** On a timeline: when something happens and how long it takes, in the timeline's units. Left out, it starts when the
 * timeline's last item ended (or with the item before, given `with`) and takes one beat (a message) or half a beat (a mark). */
type When = { t?: number; dur?: number };
/** A colour for a figure's mark: the labs' blue for work done, orange for trouble, muted for the quiet case. */
export type MarkTone = "work" | "hot" | "quiet";

export type PacketEvent = Timing & When & {
  type: "packet";
  /** Part ids the message passes through, in order. Each hop should follow a link. */
  path: string[];
  /** What the message says, kept short: "GET /product/42", "200 OK". */
  label: string;
  kind?: FlowKind;
  /** It never arrives: it falls short on its last hop and is marked with an ×. */
  lost?: boolean;
};
// On a timeline a packet is a message from one lifeline to another (a path of two parts, no link needed), and stays drawn.
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

// ---------- the hash ring (layout "ring") ----------
export type RingToken = {
  id: string;
  /** The part this token belongs to. A part can hold several tokens (virtual nodes). */
  node: string;
  /** Its position on the ring, 0 to size − 1. A token owns its own position and the ones back to the token before it. */
  at: number;
  /** The name on its flag, such as "A" or "A2"; the part's first letter when left out. */
  label?: string;
};
export type RingKey = { id: string; at: number; label?: string };
export type RingSpec = {
  /** Positions run 0 to size − 1, clockwise from the top. */
  size: number;
  /** Positions printed by the rim, such as [0, 25, 50, 75]. */
  marks?: number[];
  tokens?: RingToken[];
  keys?: RingKey[];
};
/** Tokens join or leave. A new token takes the slice back to the token before it from its successor; a removed
 * token's slice goes on to the next token clockwise. The slices that change owner move as the step plays. */
export type TokenEvent = Timing & { type: "token"; add?: RingToken[]; remove?: string[] };
/** A key lands on the ring at its hash and walks clockwise to the first token, whose part owns it; it then rests at its
 * position. `from` is a part it comes from; `at: null` takes the key off the ring. */
export type KeyEvent = Timing & { type: "key"; id: string; at: number | null; label?: string; from?: string };
/** Unnamed keys spread round the ring (the same spread for the same seed), to show how much moves; 0 clears them. */
export type ScatterEvent = Timing & { type: "scatter"; count: number; seed?: number };
/** A walk clockwise from a position collecting the first `count` tokens, skipping parts already chosen when
 * `distinct`, as a replica preference list does. It leaves the chosen tokens marked until the step ends. */
export type WalkEvent = Timing & { type: "walk"; from: number; count: number; distinct?: boolean; label?: string };
/** Marks a stretch of the ring, the positions after `from` up to and including `to` (it may wrap past 0). */
export type ArcEvent = Timing & { type: "arc"; id: string; from?: number; to?: number; label?: string; tone?: MarkTone; remove?: boolean };

// ---------- append-only logs, beside a part (layout "tiers") ----------
export type LogRecord = {
  /** What the record says, kept short: "812 paid", "8841 shipped". */
  text: string;
  /** The key it is about: compaction keeps each key's newest record only. */
  key?: string;
  /** A tombstone: its key was deleted. Compaction drops it along with everything older for its key. */
  tomb?: boolean;
  tone?: MarkTone;
};
export type LogSpec = {
  id: string;
  /** The part whose log this is; the strip lies beside it and shows while the part does. */
  node: string;
  /** Its name over the strip: "Partition 3", "WAL", "Memtable". */
  label?: string;
  /** The first record's offset, and how far each record moves it on (1 counts records, 4096 counts bytes). */
  start?: number;
  step?: number;
  /** Keep records in key order instead of arrival order, as a memtable does. */
  sorted?: boolean;
  /** Which side of the part it lies on, on a wide screen (right when left out). On a phone it lies below. */
  side?: "right" | "left" | "below";
  /** The step (0-based) where it first shows; an append or flush into it shows it too. */
  appear?: number;
  records?: LogRecord[];
};
/** Records join the log's end (or their key's place, in a sorted log), from a part when `from` is given. */
export type AppendEvent = Timing & { type: "append"; log: string; records: LogRecord[]; from?: string };
/** A reader's place: it sits at the record with offset `at`, "end" just past the last record, null takes it away.
 * `line` draws it as a boundary before that record (what has been synced, a watermark) instead of a pointer. */
export type CursorEvent = Timing & { type: "cursor"; log: string; id: string; at: number | "end" | null; label?: string; tone?: MarkTone; line?: boolean };
/** A record is read: it lights up, and when `to` names a part a message carries it there. Leaves nothing behind. */
export type ReadEvent = Timing & { type: "read"; log: string; at: number; to?: string; label?: string; kind?: FlowKind };
/** The current segment closes; later records start a new one. */
export type RollEvent = Timing & { type: "roll"; log: string };
/** Keeps the newest record per key and drops tombstones, into one segment. `merge` names older logs whose records join
 * in (oldest first); they empty and go. */
export type CompactEvent = Timing & { type: "compact"; log: string; merge?: string[] };
/** Moves every record of one log to the end of another, as a memtable is written out to a file. */
export type FlushEvent = Timing & { type: "flush"; from: string; to: string };
/** A crash cuts the log after the record at offset `after`: what was never synced is gone. */
export type TruncateEvent = Timing & { type: "truncate"; log: string; after: number };
/** Changes one record in place: its words, colour or tombstone. A tone of "" clears the colour. */
export type RecordEvent = Timing & { type: "record"; log: string; at: number; text?: string; tone?: MarkTone | ""; tomb?: boolean };
/** Brackets the records from offset `from` to `to`, such as a time window; `remove` takes it away. */
export type BracketEvent = Timing & { type: "bracket"; log: string; id: string; from?: number; to?: number; label?: string; tone?: MarkTone; remove?: boolean };

// ---------- the timeline (layout "timeline"): each part is a lifeline, and time runs along it ----------
export type TimelineSpec = {
  /** How much time the whole timeline spans, so its scale holds still; worked out from the steps when left out. */
  span?: number;
  /** Times printed along the axis, such as [0, 10, 20, 30, 40]; no axis when left out. */
  ticks?: number[];
  /** The unit after the axis's last time and in a clock metric, such as "ms". */
  unit?: string;
};
/** Something happens on a lifeline at a moment: a read, a commit, a crash. It stays drawn. */
export type MarkEvent = Timing & When & { type: "mark"; node: string; text: string; tone?: MarkTone };
/** Something lasts on a lifeline: a lock held, a lease, a pause. Give `node` and `label` to start it; `end: true` with
 * the same id ends it. One left open runs on to now. */
export type SpanEvent = Timing & When & { type: "span"; id: string; node?: string; label?: string; tone?: MarkTone; end?: boolean };
/** Clears the timeline and starts its time again from 0, to replay the story another way. */
export type RewindEvent = Timing & { type: "rewind" };

export type RingEvent = TokenEvent | KeyEvent | ScatterEvent | WalkEvent | ArcEvent;
export type LogEvent = AppendEvent | CursorEvent | ReadEvent | RollEvent | CompactEvent | FlushEvent | TruncateEvent | RecordEvent | BracketEvent;
export type TimelineEvent = MarkEvent | SpanEvent | RewindEvent;
export type StageEvent = PacketEvent | NoteEvent | StreamEvent | StateEvent | ShowEvent | HideEvent | MoveEvent | PauseEvent | RingEvent | LogEvent | TimelineEvent;

export type MetricValue = number | string | { n: number; unit?: string; tone?: Tone };
/** A number the stage works out itself instead of a step setting it: the share of the ring a part owns, the share that
 * changed owner during the step, how many records a cursor is behind the log's end, or the timeline's time so far. */
export type MetricDerive = { share: string } | { moved: true } | { lag: [log: string, cursor: string] } | { clock: true };
export type StageMetric = { id: string; label: string; derive?: MetricDerive };

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
  /** How the parts are laid out: in tiers (the default), around a hash ring, or as lifelines on a timeline. */
  layout?: "tiers" | "ring" | "timeline";
  /** The hash ring, for the ring layout. */
  ring?: RingSpec;
  /** The timeline's scale and axis, for the timeline layout. */
  timeline?: TimelineSpec;
  /** Append-only logs, each drawn beside its part (tiers layout). */
  logs?: LogSpec[];
  /** One sentence shown before the first step. */
  intro: string;
  metrics?: StageMetric[];
  nodes: StageNode[];
  links: StageLink[];
  steps: StageStep[];
};
