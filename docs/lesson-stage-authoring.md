# Authoring lesson stages

How to turn a lesson into a lesson stage: which layout to use, how to wire it, the scene and its events, the limits the checks enforce, how to pace and write the steps, where to place parts, and how to check and capture the result. `docs/design-system.md` (Diagrams) describes how a stage looks and behaves, and `docs/content-guide.md` sets the voice; this guide doesn't repeat them. The reference is `src/lib/lesson-stage/types.ts`, where every field has a doc comment.

A conversion touches only its chapter's folder, `src/content/lesson-stage/<chapter>/`. Don't edit the engine or the figures (`src/lib/lesson-stage/`), the pictograms, the stage components, `staged.ts`, the lesson text in `src/content/<chapter>.ts`, or another chapter's folder. If a lesson can't be told within the schema, say so in your report instead of changing shared code.

## What a stage is

A stage draws a lesson's system as isometric parts on a floor and plays it in 3 to 8 steps. Each step runs a list of events (a message travels, a part lights up, a record joins a log), and its text says what the picture now shows. The learner plays it, steps through it, jumps to a step's link (`#step-3`), or sees each step as a still picture with reduced motion.

Every scene has one layout:

| Layout | What it draws | Use it when the lesson is about |
|---|---|---|
| Tiers (the default) | Parts left to right (top to bottom on a phone), links lying on the floor, messages, load pills, failures | A request path, an architecture, load and capacity, a part failing |
| Tiers with logs | The same, with append-only logs lying beside parts | Order and position: records appended, read at an offset, compacted, cut by a crash |
| Ring | A hash ring lying on the floor, with tokens, keys and the stretch each token owns; parts stand round it | Where a key lives in a hash space, and what moves when membership changes |
| Timeline | One lifeline per part with time running along it; messages slant from one lifeline to another | Who did what when: interleavings, races, leases, votes, clocks |

Most lessons are tiers. A figure asks the learner to read a new kind of picture, so use one only when the lesson's mechanism lives in it. Lessons that fit a figure, as a starting point (read the lesson and decide):

| Figure | Lessons |
|---|---|
| Ring | consistent-hashing: `hash-ring` and `hash-membership` (written), `hash-vnodes`, `hash-replicas`, `hash-operate`; key-value: `kv-partition`, `kv-replication` |
| Log | streams: `st-log` (written), `st-delivery`, `st-cdc`, `st-event-time`, `st-schema`; storage-engines: `se-log`, `se-lsm`, the write-ahead log in `se-btree`; key-value: `kv-paths`; patterns: `pt-outbox`; google-drive: `drive-sync`; chat: `chat-ordering` |
| Timeline | transactions: `tx-lost-update` (written), `tx-read-committed`, `tx-snapshot`, `tx-write-skew`, `tx-serializable`; consensus: `cs-linearizability`, `cs-ordering`, `cs-fencing`, `cs-raft`, `cs-2pc`; replication: `rc-lag`, `rc-order`, `rc-failover`, `rc-multi`; unique-id: `id-clock`; rate-limiter: `rate-atomic`; patterns: `pt-idempotency`; google-drive: `drive-conflicts`; key-value: `kv-conflicts` |

A ring or a timeline can't also carry logs (logs are drawn in the tiers layout only), and a timeline draws no links.

The written samples, each worth reading before you write one of its kind:

- `consistent-hashing/hash-ring.ts`: a ring of 100 positions with A at 20, B at 50 and C at 80; keys 15, 63, 91 (which wraps past the top) and 50 (which lands on a token) find their owners; then sorted tokens and a binary search.
- `consistent-hashing/hash-membership.ts`: D joins at 35 and takes only 21–35 from B, 15% of the ring against the 25% expected, copied before ownership flips; then C leaves and its stretch goes on to A.
- `streams/st-log.ts`: an orders topic of 6 partitions; order 812's events land in partition 3 at offsets 1041–1043; a billing group with one consumer per partition, a search group reading the same records at its own offsets, order within a partition only, and a replacement consumer resuming from the last commit.
- `transactions/tx-lost-update.ts`: two payments both read $100 and the second write wipes out the first; then the race is replayed with an atomic update, where the second writer waits for the row lock, and with compare-and-set on a version.
- `scaling/`: twelve tiers scenes. `cache.ts` and `queue.ts` are good models for tone and pacing.

## Wire a lesson

A stage's id is the lesson's `diagramId`, which in every chapter today is also the lesson's `id` and its URL (`/learn/<chapter>/<id>/`). Wiring is three touches, all in `src/content/lesson-stage/<chapter>/`:

1. Write `<id>.ts`, exporting the scene as one const named `<camelCaseId>Stage` whose `id` is the file name. Import only types, by relative path:

   ```ts
   import type { StageScene } from "../../../lib/lesson-stage/types";

   // Lesson "Catch conflicts across different rows": what the stage shows, and the numbers it uses.
   export const txWriteSkewStage: StageScene = {
     id: "tx-write-skew",
     // ...
   };
   ```

2. Add the id to `staged` in `index.ts`, in lesson order:

   ```ts
   export const staged: readonly string[] = ["tx-lost-update", "tx-write-skew"];
   ```

3. Add its line to `players` in `player.tsx`, in exactly this form, since the checks read it:

   ```tsx
     "tx-write-skew": dynamic(() => import("./tx-write-skew").then(played)),
   ```

Nothing else. Lesson pages ask `staged.ts` which lessons have a stage, and `StagePlayer.tsx` already loads every chapter's `player.tsx`. A listed lesson shows its stage in place of its drawing; the others keep their drawings, so a chapter can be part converted. Every `.ts` file in the folder other than `index.ts` must be listed, so a scene file you haven't wired yet fails the chapter's checks: check it by name while you work (`node scripts/stage-check.cjs <chapter> <id>`), and wire it before you finish.

## The scene

A complete tiers scene, small but valid (its content is only an illustration):

```ts
export const exampleStage: StageScene = {
  id: "example",
  intro: "Watch one order page wait on the database, then answer.",
  metrics: [{ id: "queries", label: "Queries" }, { id: "wait", label: "Visitor waits" }],
  nodes: [
    { id: "visitor", role: "client", label: "Visitor", detail: "browser", at: [0, 0] },
    { id: "web", role: "web", label: "Web server", detail: "runs the app", at: [1, 0] },
    { id: "db", role: "database", label: "Database", detail: "orders table", at: [2, 0], appear: 1 },
  ],
  links: [{ from: "visitor", to: "web" }, { from: "web", to: "db" }],
  steps: [
    {
      title: "A request arrives",
      short: "Request",
      text: "A visitor asks for order 7. The web server needs the order's row before it can answer.",
      changes: ["+ GET /orders/7"],
      events: [
        { type: "packet", path: ["visitor", "web"], label: "GET /orders/7" },
        { type: "state", node: "web", light: "on" },
      ],
    },
    {
      title: "The web server queries the database",
      short: "Query",
      text: "The web server sends one query and waits 40 ms for the row.",
      focus: ["web", "db"],
      metrics: { queries: 1, wait: { n: 40, unit: " ms" } },
      changes: ["+ Database", "+ 1 query"],
      events: [
        { type: "packet", path: ["web", "db"], label: "SELECT … id = 7" },
        { type: "packet", path: ["db", "web"], label: "row", kind: "response" },
      ],
    },
    {
      title: "The page goes back",
      short: "Answer",
      text: "With the row in hand, the web server renders the page and answers. The visitor waited 40 ms on the database alone.",
      changes: ["~ Visitor answered"],
      events: [
        { type: "packet", path: ["web", "visitor"], label: "200 OK", kind: "response" },
        { type: "state", node: "web", light: "work" },
      ],
    },
  ],
};
```

| Scene field | What it holds |
|---|---|
| `id` | The lesson's diagram id; the same as the file name. |
| `layout` | `"tiers"` (left out), `"ring"` or `"timeline"`. |
| `ring` | Ring layout only. `size`: positions 0 to size − 1, clockwise from the top. `marks`: positions printed by the rim, such as `[0, 25, 50, 75]`. `tokens` and `keys` already on the ring at the start. |
| `timeline` | Timeline layout only. `span`: the total time, so the scale holds still (worked out from the steps when left out). `ticks`: times printed along the axis, such as `[0, 10, 20, 30]` (no axis without them). `unit`: shown after the last tick and in a clock metric, such as `"ms"`. |
| `logs` | Tiers only. Each log lies beside its part; see Logs below. |
| `intro` | One sentence shown before the first step. |
| `metrics` | The numbers over the stage; see Metrics. |
| `nodes`, `links`, `steps` | The parts, the cables between them, and 3 to 8 steps. |

### Parts

A part is `{ id, role, label, detail?, at, appear?, opts? }`.

- `role` picks the pictogram: `client`, `crowd`, `dns`, `balancer`, `web`, `cache`, `database`, `cdn`, `storage`, `queue`, `worker`, `monitor`. Use one role per kind of part, consistently across a chapter.
- `label` is the part's name on its tag (16 characters); `detail` is a few words under it (20 characters). A phone shows the name only, so the name must say what the part is.
- `appear` is the step, counted from 0, where the part first shows; it arrives at the start of that step unless the step shows it itself. Leave it out for parts there from the start. (Step links count from 1: `appear: 2` arrives in `#step-3`.)
- `opts` adjusts the pictogram: `big` (web, database), `many` (client, web: a row of them), `replica` (database), `items` (queue: how many parcels, 0 to 4), `level` (database fill, normally set by a `state` event's `meter`).

`at` is a `Place`, `[a, b]`, and means something different in each layout:

| Layout | `at` | Meaning |
|---|---|---|
| Tiers | `[tier, lane]` | Tiers run left to right on a wide screen and top to bottom on a phone. Lanes are siblings within a tier: on a wide screen a lane steps down the floor's diagonal (one tier is 226 world units across; one lane moves 64 across and 104 down), on a phone lanes sit side by side in the tier's row. Fractions and negative lanes are fine (`[3.4, -1.5]`). |
| Ring | `[position, distance]` | The ring position the part stands by (0 at the top, clockwise) and how far out: 0 the centre, 1 just outside the rim, clear of its marks and flags, up to 3. Between 0 and 1 the part stands part way out; past 1 each unit is about 110 world units further. |
| Timeline | `[lifeline, 0]` | The lifeline's order, a whole number, one part per lifeline: 0 is the top row on a wide screen and the left column on a phone. |

### Links

A link is `{ from, to, unless? }`: a cable lying on the floor between two parts, drawn once both are on the stage. `unless` hides it while another part is on the stage, such as a direct link that a load balancer replaces (`{ from: "visitors", to: "a", unless: "lb" }`). Every hop of a packet or a stream must follow a link, in either direction. A ring scene can have links (or none, as the samples do); a timeline has none.

### Steps

| Step field | What it holds |
|---|---|
| `title` | The step's point as a plain statement, 44 characters: "A writes 70 and commits". |
| `short` | Two or three words for the step list and the next button, 18 characters: "Both read". |
| `text` | What the picture shows and why, in one to three sentences, 60 words at most. It is the step's text equivalent. |
| `focus` | Parts this step is about; the rest dim. |
| `frame` | Parts the camera must frame on every screen. |
| `facts` | Label and value pairs shown with the text: `[["Should be", "$20"], ["Is", "$50"]]`. |
| `changes` | What the step changed, each starting `"+ "`, `"− "` or `"~ "`. |
| `metrics` | New values for the scene's metrics. |
| `events` | What happens, in order (see Events). Empty only on a step with a control. |
| `control` | One thing the learner can change, such as a hit rate. |

**Focus and frame.** `focus` dims every other part with its links and log strips. On a ring the focused parts' stretches turn ink and everything of the others dims; a log's readers named after a dimmed part dim with it; on a timeline, items on a dimmed lifeline dim, and a message unless both its ends are in focus. On a wide screen focus doesn't move the camera. On a phone the camera frames the focused parts, which brings them close but can push the rest out of view: give `frame` the parts that must stay in view (the cache lesson focuses on two parts and frames all four). A ring or a timeline is always framed whole.

**Facts.** Short pairs for the numbers worth keeping in view: the ring's tokens, the partition count, the guard clause. One to three per step. Labels must differ within a step.

**Changes.** What is new (`+`), gone (`−`) or different (`~`) after the step, each a short phrase. The minus is the Unicode minus sign (U+2212), not a hyphen: `"− A’s $30 debit"`. Entries must differ within a step.

**Metrics.** The scene lists its numbers once, `metrics: [{ id, label }]`, and steps set them: `metrics: { queries: 1 }`. A value carries forward until a step changes it, shows "—" until it is first set, and counts up or down to a new number. A value is a number, a string (`"$70"`, `"A"`), or `{ n, unit?, tone? }`, where the unit is appended as written, so include its space (`{ n: 1, unit: " of 2" }`, `{ n: 40, unit: " ms" }`, `{ n: 500, unit: "/s" }`) and `tone: "hot"` turns it orange. Numbers are rounded to whole numbers for display. Keep to two or three metrics with short labels; on a phone the chips scroll sideways when they don't fit.

**Derived metrics** are worked out by the stage, and a step can't set them:

| `derive` | Shows | Layout |
|---|---|---|
| `{ share: "a" }` | The share of the ring part `a` owns after the step, as a percentage | Ring |
| `{ moved: true }` | The share of ring positions whose owner changed during the step (0% on a step that moves nothing) | Ring |
| `{ lag: ["p3", "billing"] }` | How many records of log `p3` are at or after cursor `billing`: what it has left to read | Any with logs |
| `{ clock: true }` | The timeline's time after the step, with the timeline's unit | Timeline |

```ts
metrics: [
  { id: "moved", label: "Moved", derive: { moved: true } },
  { id: "expected", label: "Expected" },
  { id: "a", label: "A owns", derive: { share: "a" } },
],
```

**Controls.** A step can offer one choice: `control: { label, options: [{ label, metrics?, events }] }`, with at least two options. The first option plays with the step; its events run after the step's own. Choosing another jumps to that option's end state and replays only what passes (messages, notes, traffic, walks, reads). Autoplay stops at a step with a control. The chosen option carries into the steps after it, so put a control on the last step, or make every option leave a state the next steps can build on. Say in the step's text what each option shows.

```ts
control: {
  label: "Hit rate",
  options: [
    { label: "95%", metrics: { queries: { n: 500, unit: "/s" } },
      events: [{ type: "state", node: "db", light: "on", readout: "500 queries/s", meter: 0.05 }] },
    { label: "Cache down", metrics: { queries: { n: 10000, unit: "/s", tone: "hot" } },
      events: [{ type: "state", node: "cache", down: true }, { type: "state", node: "db", light: "hot", readout: "10,000 queries/s", meter: 1, tone: "hot" }] },
  ],
},
```

### Ring, logs and timeline settings

```ts
// a ring scene
layout: "ring",
ring: { size: 100, marks: [0, 25, 50, 75], tokens: [{ id: "A", node: "a", at: 20, label: "A" }, { id: "B", node: "b", at: 50, label: "B" }] },
```

A token is `{ id, node, at, label? }`: its id, the part it belongs to (a part can hold several tokens, as virtual nodes), its position, and the name on its flag (3 characters). Left out, the label is the first letter of the part's label, so a part called "Node A" gets "N": set labels yourself. A token owns its own position and every position back to the token before it.

```ts
// logs, in a tiers scene
logs: [
  { id: "p3", node: "topic", label: "P3", start: 1038, records: [{ text: "809 paid", key: "809" }, { text: "811 new", key: "811" }] },
  { id: "mem", node: "db", label: "Memtable", sorted: true, side: "left", appear: 1 },
],
```

A log is `{ id, node, label?, start?, step?, sorted?, side?, appear?, records? }`. `start` is the first record's offset (0 when left out) and `step` how far each record moves the offset on (1 counts records; 4096 counts bytes). A `sorted` log keeps one record per key in key order, as a memtable does; a record's key is its `key`, or its text without one. `side` is where the strip lies on a wide screen (`"right"` by default, `"left"` or `"below"`); on a phone it always lies below. `appear` works as a part's does, and an append or flush into the log shows it too. A record is `{ text, key?, tomb?, tone? }`: 12 characters of text, the key compaction groups by, a tombstone flag, and a tone.

```ts
// a timeline scene
layout: "timeline",
timeline: { ticks: [0, 10, 20, 30, 40], unit: "ms" },
```

## Events

### Timing

Events in a step run in order. An event waits until everything started before it has finished, then waits `gap` milliseconds (320 when left out) and starts. `with: true` starts it together with the event before instead. `{ type: "pause", ms: 600 }` waits without doing anything. With reduced motion, gaps and pauses are skipped and every event jumps to its end.

On a timeline, time is the timeline's own, in its units, separate from playing time. `t` sets when an item starts; left out, it starts at the timeline's clock (the furthest any item has reached so far), or with `with: true` at the same moment as the item before. `dur` is how long it takes: a message's travel time (1 when left out), the time a mark moves the clock on (0.5), and for a span's start or end how far it moves the clock (0). `t` and `dur` are allowed only on a timeline.

```ts
{ type: "packet", path: ["a", "wallet"], label: "read" },
{ type: "packet", path: ["b", "wallet"], label: "read", with: true },   // the same moment, side by side
{ type: "mark", node: "wallet", text: "100 → 70", tone: "work", dur: 1.5 },   // time passes while B waits
{ type: "span", id: "lease", node: "n1", label: "lease", tone: "work", t: 0 },
{ type: "span", id: "lease", end: true, t: 10 },
```

### Lasting and passing

Lasting events change the stage, and the change carries into later steps: `state`, `show`, `hide`, `move`, every ring event except `walk`, every log event except `read`, `mark`, `span`, `rewind`, and packets on a timeline (a message stays drawn). Going back animates them in reverse. Passing events play and leave at most a trace until the step ends: `packet` in tiers and on a ring, `note`, `stream` (traffic runs until the step ends), `pause`, `walk` and `read`.

A step's link, and every step under reduced motion, shows the step's end state as a still picture. Notes, a walk's numbered tokens, a read's lit record, ongoing traffic and a lost message's × are put back; other messages show only under reduced motion, resting short of where they arrive. So a step whose point is a message should also leave a note, a light, a readout or a metric that says it, or its link shows nothing of it.

### Core events

| Event | What it does | Example |
|---|---|---|
| `packet` | A message travels along `path`, a chain of linked parts; `label` up to 22 characters. `kind`: `request` (ink, the default), `response` or `work` (blue), `hot` (orange), `quiet` (muted). `lost: true` falls short on its last hop with an ×. | `{ type: "packet", path: ["web", "db"], label: "SELECT … id = 42" }` |
| `note` | A short note floats over a part for the rest of the step, 26 characters; `tone` `work` or `hot`. | `{ type: "note", node: "cache", text: "miss" }` |
| `stream` | Traffic keeps flowing along `routes`, each chosen in proportion to its weight `w`, one request every `every` ms (200–300 reads as busy). Not on a timeline. | `{ type: "stream", every: 170, routes: [{ path: ["visitor", "web", "cache"], w: 19, kind: "work" }, { path: ["visitor", "web", "db"], w: 1 }] }` |
| `state` | Changes a part (`node`) or several (`nodes`): `light` (`idle` grey, `on` ink, `work` blue, `hot` orange), `readout` (the load pill), `meter` (0 to 1.5, a database fills like a tank; `null` removes it), `tone` (`"hot"` or `""`), `down`, `label`, `detail`, `opts`, `at`. | `{ type: "state", node: "db", light: "hot", readout: "10,000 queries/s", meter: 1, tone: "hot" }` |
| `show` | Brings parts on; `at` can place them and move others at the same time. | `{ type: "show", nodes: ["worker2"], at: { worker1: [3.4, -1.5] } }` |
| `hide` | Parts fade and sink away. | `{ type: "hide", nodes: ["checkout"] }` |
| `move` | Parts move to new places. Not on a timeline. | `{ type: "move", at: { a: [2.3, -1] } }` |
| `pause` | Waits; skipped with reduced motion. | `{ type: "pause", ms: 900 }` |

### Ring events

| Event | What it does | Example |
|---|---|---|
| `token` | Tokens join (`add`) or leave (`remove`). A new token takes the slice back to the token before it from its successor; a removed token's slice goes on to the next token clockwise. The slice that changes owner sweeps across in blue, carrying its keys and dots. Adding an existing id moves that token. | `{ type: "token", add: [{ id: "D", node: "d", at: 35, label: "D" }] }`, `{ type: "token", remove: ["C"] }` |
| `key` | A named key lands at its hash (flying from part `from` when given), walks clockwise to the first token, whose part owns it, and rests at its position. The same id again moves it; `at: null` takes it off. `label` 8 characters (the id when left out). | `{ type: "key", id: "k15", at: 15, label: "15", from: "app" }` |
| `scatter` | Unnamed dots spread round the ring, the same spread for the same `seed`, to show how much moves; `count: 0` clears them. | `{ type: "scatter", count: 40, seed: 7 }` |
| `walk` | Passing. A cursor walks clockwise from `from`, numbering the first `count` tokens; with `distinct` it skips parts already chosen, as a replica preference list does. `label` shows as a note. The numbers stay until the step ends. | `{ type: "walk", from: 42, count: 3, distinct: true, label: "replicas of key 42" }` |
| `arc` | Marks the positions after `from` up to and including `to` (wrapping past 0; `from` equal to `to` is the whole ring), labelled outside the rim; `tone` `work`, `hot` or `quiet`. The same id updates it, keeping what you leave out; `remove: true` takes it away. To mark one position p, use `from: p - 1, to: p`. | `{ type: "arc", id: "take", from: 20, to: 35, label: "21–35 → D", tone: "work" }` |

### Log events

| Event | What it does | Example |
|---|---|---|
| `append` | Records join the log's end (a sorted log puts each at its key's place, replacing that key's record), taking the next offsets. With `from`, a message carries them from that part first; link the two so it rides a cable. | `{ type: "append", log: "p3", from: "checkout", records: [{ text: "812 new", key: "812" }] }` |
| `cursor` | A reader's place: a pointer at the record with offset `at`. `"end"` is just past the last record now (it doesn't follow later appends); `null` takes it away. `line: true` draws a boundary before that record instead, for what has been synced or a watermark. The same id moves it, keeping its label, tone and line. | `{ type: "cursor", log: "p3", id: "billing", at: 1041, label: "billing" }` |
| `read` | Passing. The record at `at` lights; with `to`, a message carries it to that part (`label` defaults to the record's text, `kind` to `response`). The offset must be in the log. | `{ type: "read", log: "p3", at: 1041, to: "billing" }` |
| `roll` | Closes the current segment; later records start a new one. | `{ type: "roll", log: "wal" }` |
| `compact` | Keeps each key's newest record and drops tombstones with everything older for their key, into one segment; records without a key stay. `merge` names older logs, oldest first, whose records join in; they empty and go. | `{ type: "compact", log: "seg2", merge: ["seg1"] }` |
| `flush` | Moves every record of one log to the end of another, as a memtable is written to a file; the target takes new offsets and shows. | `{ type: "flush", from: "mem", to: "sst1" }` |
| `truncate` | A crash cuts the log after offset `after`; the tail falls away. | `{ type: "truncate", log: "wal", after: 5 }` |
| `record` | Changes one record in place: `text`, `tone` (`""` clears it) or `tomb`. | `{ type: "record", log: "p3", at: 1043, tone: "hot" }` |
| `bracket` | A bracket over the records from offset `from` to `to` with a label, such as a time window; the same id updates it; `remove: true` takes it away. | `{ type: "bracket", log: "clicks", id: "w1", from: 0, to: 3, label: "12:00–12:05" }` |

### Timeline events

| Event | What it does | Example |
|---|---|---|
| `packet` | A message from one lifeline to another: `path` is exactly two parts, and no link is needed. It slants by its travel time and stays drawn; `lost` stops short with an ×. | `{ type: "packet", path: ["b", "wallet"], label: "write 50" }` |
| `mark` | Something happens on a lifeline at a moment: a value read, a commit, a crash. 18 characters. | `{ type: "mark", node: "wallet", text: "commit 50", tone: "hot" }` |
| `span` | Something lasts on a lifeline: a lock held, a lease, a pause. Start it with `node` and `label` (14 characters); end it with the same `id` and `end: true`. One left open runs on to now. `tone` `work` (blue), `hot` (orange), `quiet` (dashed). | `{ type: "span", id: "lock", node: "a", label: "holds row lock", tone: "work" }`, `{ type: "span", id: "lock", end: true }` |
| `rewind` | Clears the timeline and starts its time again from 0, to replay the story another way. Put it first in the step that replays. | `{ type: "rewind" }` |

Notes and `state` work on a timeline too: notes float over the heads, and readouts show on them. `stream` and `move` don't.

## Limits

`node scripts/stage-check.cjs` enforces these (`STAGE_LIMITS` in `src/lib/lesson-stage/validate.ts`). Counts marked "at once" are checked by playing every step and every control option.

| What | Limit |
|---|---|
| Steps | 3 to 8 |
| Step title / short name / text | 44 characters / 18 characters / 60 words |
| Part label / detail | 16 / 20 characters (a `state` event's `label` too; keep its `detail` to 20 as well, though only a part's own is checked) |
| Packet and read label / note and walk label | 22 / 26 characters |
| Meter | 0 to 1.5 |
| Control options | at least 2 |
| Ring size / marks | 8 to 1,000 positions / 8 marks |
| Tokens / named keys / arcs, at once | 16 / 8 / 3 |
| Token label / key label / arc label | 3 / 8 / 16 characters |
| Scattered dots / tokens a walk collects | 0 to 64 / 1 to 6 |
| Part distance on a ring | 0 to 3 |
| Logs per scene / per part | 8 / 6 |
| Records per log, at once / record text / log label | 40 / 12 / 16 characters |
| Cursors per log / cursor label | 3 / 12 characters |
| Brackets per log / bracket label | 2 / 14 characters |
| Lifelines (parts on a timeline) | 2 to 6 |
| Timeline items, at once / ticks / unit | 40 / 8, rising / 4 characters |
| Mark text / span label | 18 / 14 characters |

The checks also catch: unknown roles and ids; a duplicate part or log; `appear` outside steps 1 to last; a packet hop without a link, or through a part not yet shown (or hidden); a key, append, read, mark or span naming a part before it is shown; a read or record at an offset the log doesn't hold; a cursor past a log's end; removing a token that isn't on the ring; a walk on a ring with no tokens; ending a span that isn't open, or starting one that is; a figure event in the wrong layout, or logs outside the tiers layout; `t` or `dur` off a timeline; on a timeline, links, a `stream` or `move`, a packet that isn't between two parts, or two parts on one lifeline; a derived metric in a layout that can't work it out; a step that sets a derived or unknown metric; a change without its sign; a step with no events and no control; an empty intro; and a scene id that differs from its file name.

## Pacing and writing

**How long things take.** The engine's timings (`T` in `src/lib/lesson-stage/engine.ts`):

| Moment | Time |
|---|---|
| Parts leaving, then parts moving | 420 ms, then 820 ms |
| A part arriving | 680 ms, each next one 130 ms later |
| A link drawing itself | 560 ms, each next one 90 ms later |
| The camera moving | 820 ms |
| Before a step's first event | 260 ms |
| Between events (the default `gap`) | 320 ms |
| A message | about 1 s per tier hop (0.22 world units per ms), at least 160 ms a hop, 160 ms between hops |
| Autoplay's hold after a step | 1,000 ms + 220 ms per word of text + 500 ms per change, kept between 3 and 13 s |

A step whose events take more than about six seconds to play feels slow; that is roughly five one-hop messages in sequence. Run things that happen together with `with: true`, and use a short `pause` (300 to 1,200 ms in the samples) only where time passing is the point.

**Steps.** 3 to 8; the samples use 5 to 8. Follow the lesson's body: the problem, the mechanism, one worked example with its numbers, and the cost or the case where you wouldn't use it. One idea per step: one mechanism, one change, or one consequence. If a step's text needs "then" twice, split it.

**A step's text** says what the picture shows, with its numbers, what changed, and why it matters, so someone who can't see the stage gets the step from the text alone. Name parts by their labels, in the present tense. 25 to 45 words in two or three sentences reads well (60 words is the limit). On a step with a control, say what to try and what each option shows. The title states the step's point; `short` names it in two or three words.

**Numbers stay faithful to the lesson.** Read the lesson's body in `src/content/<chapter>.ts` first and use its example and its numbers, its names and its order of events. Never introduce a statistic or a claim about a real system that the lesson doesn't make. Where the lesson has no worked numbers, choose example numbers that fit it and keep them the same in the text, facts, changes, metrics, labels and the picture. Check every number twice: the ring's ownership ranges, the offsets after each append, the balance after each write.

**Colour carries one meaning.** Ink is a request, blue (`work`, `response`) is work done and replies, orange (`hot`) only trouble: overload, loss, a conflict, a crash. Muted (`quiet`) is the quiet case, such as a cache miss or a wait. Never rely on colour alone: a note, a mark or the text says it too.

**The intro** is one sentence that says what to watch: "Watch two payments debit one wallet at the same moment, then replay the race with fixes that keep both debits."

## Layout

### Tiers

Lay the request path out left to right in tiers 0, 1, 2…, with siblings in lanes of the same tier (`[2, -1]` and `[2, 1]` sit either side of the tier's middle). Leave the space a part's tag and load pill need: a load pill sits to the right of its part on a wide screen. Parts that arrive later can have their places from the start (`appear`) or be placed as they arrive (`show` with `at`), and parts can make room with `move`. Keep a scene to about six parts on screen at once; eight is the most any scaling scene uses.

### Ring

- Stand each owner by its token, at `[its token's position, 1]`, and a client or app at the centre (`[0, 0]`) or outside at distance 2. Parts stand round the ring in the order the scene lists them, centre first, and keep clear of each other, so two parts by tokens close together are pushed apart: keep owners' positions at least a tenth of the ring apart, or let several tokens share one part (virtual nodes) rather than giving every token a part.
- On a phone, parts at distance 1 stand above or below the ring within its width: the back half (positions within a quarter turn of 0) above, the front half below. Spread owners over both halves.
- Four marks (`[0, 25, 50, 75]` on a ring of 100) read best; a phone shows every other mark when there are more than four.
- A ring of 100 keeps positions easy to read. Use another size only when the lesson's numbers need it.
- Name the keys that tell the story (8 at most, labelled with their hash: `"15"`) and use `scatter` for the many.
- A crowded ring is drawn larger on a wide screen, and a part at the centre makes it larger too; check the result on a phone.

### Logs

- On a wide screen a strip lies to the right of its part by default, its rows rising behind the part's base, up to about 8 records and two tiers wide. Keep that space free: no part in the next tier in the same lane. The parts that talk to the log can stand in front of it in the same tier (`st-log` puts its producer and consumers at `[1, 1.65]` beside the topic at `[1, 0]`), or in the tier before it. Use `side: "left"` when the free space is on the left.
- On a phone the strips lie under the part, and the strips of every part in that tier's row stack under the row. Keep a tier with logs to one or two parts.
- Tiles are as wide as the longest record text in the scene, so one long record widens every tile and fewer fit. Keep record texts short and alike: `"812 paid"`, `"x = 2"`.
- A strip shows the newest records that fit, 8 on a wide screen and 5 on a phone, with older ones behind an ellipsis and the first shown offset. Start offsets where the story needs them (`start: 1038`) rather than appending filler.
- A part with more than three logs (two on a phone) folds the logs a step doesn't touch to slivers; a step of cursor moves only opens the logs those cursors are on.
- Name a reader's cursor after its part's id (`id: "billing"` for part `billing`), so it dims when that part is out of focus.

### Timeline

- Order lifelines so messages go between neighbours. Put a shared resource between the parties that race for it (Payment A, Wallet, Payment B), so their messages don't cross. Use 2 to 6 lifelines; 5 for a Raft majority.
- The scale holds for the whole scene and is sized so one beat (the median message `dur`, 1 by default) has room for its label: 64 px across a wide stage, 33 px down a phone. A run longer than about eight beats between rewinds shrinks the drawing, so keep each run short and use `rewind` to replay.
- Let the clock run (no `t`) unless times are the lesson's point: linearizability intervals, a lease's expiry, a GC pause. Then give `t`, `dur`, `ticks` and a `unit`, and use whole numbers if you show a `{ clock: true }` metric.
- On a phone time runs down the screen with lifelines as columns; on a phone-width stage that is short rather than tall it may run across instead. With five or six lifelines, keep labels short.

### Phones

A 390×844 phone gives the stage about 370×590 px and a 375×667 phone about 355×467 px, of which the metric chips take the top 76 px and the playback bar the bottom 84 px. The stage switches to its phone layout when it is under 560 px wide: tiers run down the screen, tags show names only, load pills sit over their parts, and the camera frames the step's focus. Tags, pills and notes keep their size as the camera zooms out, down to a floor, and past it shrink with the drawing; every label must still read at 10 px or more, so a phone that has to zoom out that far is showing too much at once. Keep a tier to two parts side by side (three at most), notes short, and give `frame` whatever must stay in view.

## Checking

### Commands

```sh
node scripts/stage-check.cjs <chapter>         # every listed scene: limits and references; names files not yet wired
node scripts/stage-check.cjs <chapter> <id>    # one scene file, before it is wired
npm run check:content -- <chapter>             # the chapter's content rules, its stages and its player lines
npm test                                       # includes the wiring test for every chapter
npm run typecheck
```

All of them must pass before you hand back.

### Seeing it

Run the dev server (`npm run dev`, or the `stage-dev` entry in `.claude/launch.json`, port 47320) and open `/learn/<chapter>/<id>/`, or a step directly at `/learn/<chapter>/<id>/#step-3`. Reuse a dev server that is already running for your checkout; don't start a second one, and don't run `npm run build` in a checkout whose dev server is running, since both write `.next`.

Play it the ways a learner will: straight through with Space; Back (←) from every step, where reversals should animate smoothly; the number keys to jump; Space mid-animation to pause and again to resume; Home to reset; and a resize from wide to phone and back on the same step. The console must stay free of errors.

### Screenshots

Capture with headless Chrome driven over the DevTools protocol: `node scripts/stage-shot.mjs jobs.json` does this (its header lists every action). Don't use the app's Browser pane for animation: while the pane is hidden its page runs as a background tab, `requestAnimationFrame` stops, and the stage freezes mid-step.

- Set the device metrics for each size (1440×900, 390×844, 375×667) at device scale 2, with mobile and touch emulation under 600 px wide, and emulate `prefers-color-scheme` (light, dark) and `prefers-reduced-motion`.
- Capture with `captureBeyondViewport: false` and a clip of the element's box within the viewport. A capture beyond the viewport lays the page out again at the capture's size, which can take the stage under 560 px and flip it to its phone layout.
- Open steps by their links (`#step-N`, reloading for each), and capture animations as frame sheets: press → on the step before, then take 10 to 14 frames 120 to 180 ms apart.
- For a static build, `npm run build` writes `out/`. Serve it with `node scripts/serve-out.mjs out 4400`, not `python3 -m http.server`: its listen backlog of 5 drops requests when a page fires a burst of them (Next prefetches links at idle), and assets that load late silently fail, which looks like a broken page.

A job for that script looks like this; the actions are `ready` (wait until the stage has drawn and scroll it into view), `wait`, `key`, `click`, `hash`, `shot` (`stage`, `card` for the stage with its steps, `viewport` or `page`), `sheet`, `eval` and `viewport` (resize in place):

```json
[
  { "url": "http://127.0.0.1:4400/learn/transactions/tx-write-skew/#step-3", "width": 1440, "height": 900, "theme": "light",
    "actions": [["ready"], ["wait", 1500], ["shot", "shots/tx-write-skew/1440-light-3.png", "card"]] },
  { "url": "http://127.0.0.1:4400/learn/transactions/tx-write-skew/#step-2", "width": 390, "height": 844, "theme": "dark",
    "actions": [["ready"], ["key", "ArrowRight"], ["sheet", "shots/tx-write-skew/390-dark-3-play", 12, 150, "stage"]] },
  { "url": "http://127.0.0.1:4400/learn/transactions/tx-write-skew/#step-5", "width": 375, "height": 667, "theme": "light", "reduced": true,
    "actions": [["ready"], ["wait", 800], ["shot", "shots/tx-write-skew/375-light-reduced-5.png", "stage"]] }
]
```

To check a change didn't move anything it shouldn't, capture the same steps from two builds with reduced motion and compare them with `node scripts/png-diff.mjs pairs.json`: stills of one build match at its threshold, so anything over about 0.05% is a real change.

Look at every image yourself. Most problems show only in a picture: a label over a part, a strip clipped by the stage's edge, a pill under the metric chips, a dimmed part that should be in focus.

## What to capture for a PR

For each lesson converted:

- Every step at 1440×900, light, by its link, as the card (the stage with its steps panel).
- Every step at 390×844, dark, as the stage.
- The busiest step at 375×667, in light and dark.
- The busiest step with reduced motion, at 1440×900 and 390×844.
- A frame sheet of each figure animation the lesson relies on (a key's walk, a slice sweeping to a new owner, records dropping in, a compaction, messages racing on a timeline) and of any step whose point is motion.

Name files `<id>/<width>-<theme>[-reduced]-<step>.png` and keep them together, one folder per lesson. In the PR (or your report), list the lessons converted with the layout each uses, attach six to ten of the best images per chapter covering wide and phone, light and dark (a preview deployment may sit behind a login, so images are what reviewers see), give the folder for the rest, paste the results of the check commands, and name anything you couldn't meet and any lesson you left as a drawing, with the reason.

## Review checklist

Content

- [ ] The stage tells the lesson's story with the lesson's numbers, names and order of events, and claims nothing the lesson doesn't.
- [ ] Every number agrees across the text, facts, changes, metrics, labels and the picture.
- [ ] One idea per step; the steps follow the lesson from problem to cost.
- [ ] The layout is the one whose drawing is the lesson's point.

Text

- [ ] Each step's text says what the picture shows, with its numbers, what changed and why, and stands alone without the picture.
- [ ] Titles state the point; short names are two or three words; the intro is one sentence.
- [ ] Changes start with `+ `, `− ` (U+2212) or `~ `.

Picture

- [ ] Each step's end state, as its link shows it, says what the text says.
- [ ] Nothing overlaps: tags, pills, notes, flags, strips, marks and messages keep clear of each other and of the stage's edges, the chips and the playback bar.
- [ ] Ink for requests, blue for work and replies, orange only for trouble; meaning never rests on colour alone.
- [ ] Focus dims the right parts; the camera keeps what matters in view on every screen.
- [ ] Light and dark both read well.

Phone

- [ ] At 390×844 and 375×667 every label is readable, nothing is clipped, and the part names alone say what each part is.
- [ ] A ring's parts, a log's strips and a timeline's lifelines fit without crowding.

Motion

- [ ] Playing straight through feels calm; no step drags or rushes.
- [ ] Back from every step animates smoothly; pausing freezes everything; jumps and resizes land on the right picture.
- [ ] Reduced motion shows a clear still picture for every step.
- [ ] The console has no errors.

Wiring

- [ ] Only the chapter's folder changed: `<id>.ts`, its id in `index.ts`, its line in `player.tsx`.
- [ ] The file exports one `<camelCaseId>Stage` with `id` equal to the file name and imports only types.
- [ ] `stage-check`, `check:content`, `npm test` and `npm run typecheck` pass.
