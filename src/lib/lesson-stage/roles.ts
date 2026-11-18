// Every part a lesson stage can draw: its name, how tall it stands, the pack that draws it, and the options it reads.
// This file is the contract between scenes and drawings. A scene uses any role listed here; the stage loads the role's
// pack when the scene needs it (packs/index.ts), so a lesson never imports drawings itself. The catalogue, with what
// each part looks like and which chapters use it, is docs/pictogram-catalog.md.

/** Packs of drawings beyond the core set every stage loads. Each is its own file in packs/ and its own chunk. */
export type PackName = "devices" | "control" | "time" | "services" | "logs" | "records";

/** Options a drawing can read. Which ones a role understands is listed in ROLES (`opts`); the check rejects others. */
export type GlyphOptions = {
  /** A bigger machine (web server, database). */
  big?: boolean;
  /** A row of identical things instead of one (laptops, servers, phones, sensors). */
  many?: boolean;
  /** A read replica (database). */
  replica?: boolean;
  /** How many things it holds or waits on: a queue's backlog, a log's entries, letters in an inbox, tokens. */
  items?: number;
  /** How full it is, 0 to 1: a database's fill, a bucket's tokens, a timer's sand. Set from the part's meter on roles that `fill`. */
  level?: number;
  /** The fill is in trouble (the stage sets it when the part's tone is hot). */
  levelHot?: boolean;
  /** How many of its repeated parts it's built with: a broker's partitions, a shard's slices, a fan-out's outlets. */
  count?: number;
  /** Which one of those (0-based) is picked or lit: the chute taking the request, the slice that's this shard. */
  mark?: number;
  /** A gate or arm raised, a breaker tripped, a lock unlocked; "half" is in between (a half-open breaker). */
  open?: boolean | "half";
  /** Held by a lock (a row). */
  locked?: boolean;
  /** Carries the leader's flag (a replica or a node that leads). Any role can. */
  lead?: boolean;
};

type RoleInfo = {
  /** The default name on its tag (scenes usually set their own label). */
  name: string;
  /** How far the drawing rises above its floor centre, in drawing units, for placing notes, pills and the down mark. */
  top: number;
  /** The pack that draws it; core roles have none and load with every stage. */
  pack?: PackName;
  /** The options it reads, with ranges: "count:1-6 mark level". `lead` works on every role. */
  opts?: string;
  /** Its meter fills it: the stage passes the part's meter as `level`. */
  fill?: boolean;
};

export const ROLES = {
  // core: loaded by every stage
  client: { name: "Client", top: 36, opts: "many" },
  crowd: { name: "Users", top: 27 },
  dns: { name: "DNS", top: 28 },
  balancer: { name: "Load balancer", top: 20 },
  web: { name: "Web server", top: 50, opts: "big many" },
  cache: { name: "Cache", top: 16 },
  database: { name: "Database", top: 42, opts: "big replica level", fill: true },
  cdn: { name: "CDN edge", top: 36 },
  storage: { name: "Object storage", top: 40 },
  queue: { name: "Queue", top: 18, opts: "items:0-4" },
  worker: { name: "Worker", top: 30 },
  monitor: { name: "Monitoring", top: 39 },

  // devices: what stands at the edges, ours and other people's
  phone: { name: "Phone", top: 36, pack: "devices", opts: "many items:0-3 level" },
  sensor: { name: "Sensor", top: 35, pack: "devices", opts: "many" },
  sender: { name: "Outside sender", top: 44, pack: "devices" },
  external: { name: "Outside service", top: 38, pack: "devices" },
  mailbox: { name: "Inbox", top: 34, pack: "devices", opts: "items:0-4" },

  // control: what checks, limits and lets through
  gateway: { name: "API gateway", top: 34, pack: "control", opts: "open" },
  gate: { name: "Gate", top: 34, pack: "control", opts: "open" },
  breaker: { name: "Circuit breaker", top: 31, pack: "control", opts: "open" },
  limiter: { name: "Rate limiter", top: 22, pack: "control", opts: "count:1-3" },
  bucket: { name: "Token bucket", top: 32, pack: "control", opts: "level items:0-8", fill: true },
  counter: { name: "Counter", top: 23, pack: "control" },
  lock: { name: "Lock", top: 41, pack: "control", opts: "open" },

  // time: clocks, timeouts and leases
  clock: { name: "Clock", top: 33, pack: "time", opts: "level" },
  timer: { name: "Timer", top: 43, pack: "time", opts: "level", fill: true },
  lease: { name: "Lease", top: 40, pack: "time", opts: "level", fill: true },
  scheduler: { name: "Scheduler", top: 32, pack: "time", opts: "items:0-4" },

  // services: machines that do one job
  socket: { name: "WebSocket server", top: 43, pack: "services", opts: "items:0-8" },
  fanout: { name: "Fan-out", top: 28, pack: "services", opts: "count:2-6" },
  idgen: { name: "ID generator", top: 35, pack: "services" },
  transcoder: { name: "Transcoder", top: 39, pack: "services", opts: "count:1-3" },
  fetcher: { name: "Fetcher", top: 41, pack: "services" },
  router: { name: "Router", top: 37, pack: "services", opts: "count:2-4 mark" },
  coordinator: { name: "Coordinator", top: 32, pack: "services", opts: "count:2-5 items:0-5" },
  registry: { name: "Registry", top: 40, pack: "services", opts: "count:2-6 items:0-6" },

  // logs: append-only records and what reads them
  logfile: { name: "Log", top: 28, pack: "logs", opts: "items:0-8 mark" },
  broker: { name: "Broker", top: 38, pack: "logs", opts: "count:1-6 items:0-6 mark" },
  consumer: { name: "Consumer group", top: 31, pack: "logs", opts: "count:1-4 mark" },
  frontier: { name: "URL frontier", top: 39, pack: "logs", opts: "count:2-4 items:0-4 mark" },
  disk: { name: "Disk", top: 18, pack: "logs" },

  // records: how data is laid out and found
  memtable: { name: "Memtable", top: 41, pack: "records", opts: "level", fill: true },
  sstable: { name: "Sorted files", top: 33, pack: "records", opts: "count:1-5" },
  bloom: { name: "Bloom filter", top: 28, pack: "records", opts: "level" },
  tree: { name: "Tree", top: 39, pack: "records", opts: "count:2-3 mark" },
  shard: { name: "Shard", top: 25, pack: "records", opts: "count:2-6 mark" },
  index: { name: "Index", top: 35, pack: "records", opts: "mark:0-11" },
  columns: { name: "Column store", top: 43, pack: "records", opts: "count:3-6 items:0-6" },
  row: { name: "Row", top: 27, pack: "records", opts: "count:1-4 locked" },
  doc: { name: "Document", top: 37, pack: "records", opts: "count:1-3" },
} satisfies Record<string, RoleInfo>;

export type StageRole = keyof typeof ROLES;
export const ROLE_IDS = Object.keys(ROLES) as StageRole[];
const info = (role: StageRole): RoleInfo => ROLES[role];
export const packOf = (role: StageRole): PackName | undefined => info(role).pack;
export const fills = (role: StageRole) => !!info(role).fill;

type SceneLike = {
  nodes: { id: string; role: string; opts?: GlyphOptions }[];
  steps: { events: unknown[]; control?: { options: { events: unknown[] }[] } }[];
};
type StateLike = { type: string; node?: string; nodes?: string[]; opts?: GlyphOptions };

/**
 * What a scene asks of its drawings that they can't do: an unknown role, an option a role doesn't read, a value out of
 * its range. Checks each node's options and every `state` event that changes them. validate.ts calls this.
 */
export function roleProblems(scene: SceneLike): string[] {
  const problems: string[] = [], roleOf = new Map<string, StageRole>(), optsOf = new Map<string, GlyphOptions>();
  const check = (id: string, opts: GlyphOptions, where: string) => {
    const role = roleOf.get(id);
    if (!role) return;
    const allowed = new Map<string, [number, number] | null>([["lead", null]]);
    for (const o of (info(role).opts ?? "").split(" ").filter(Boolean)) {
      const [name, range] = o.split(":");
      allowed.set(name, range ? (range.split("-").map(Number) as [number, number]) : null);
      if (name === "level") allowed.set("levelHot", null);
    }
    const merged = { ...optsOf.get(id), ...opts };
    for (const [key, value] of Object.entries(opts)) {
      if (!allowed.has(key)) { problems.push(`${where} gives "${id}" (${role}) option "${key}", which its drawing doesn't read (it reads ${[...allowed.keys()].join(", ")})`); continue; }
      const range = allowed.get(key);
      if (range && typeof value === "number" && (value < range[0] || value > range[1] || !Number.isInteger(value))) problems.push(`${where} sets "${id}" (${role}) ${key} to ${value}, outside ${range[0]}-${range[1]}`);
      if (key === "level" && typeof value === "number" && (value < 0 || value > 1)) problems.push(`${where} sets "${id}" (${role}) level to ${value}, outside 0-1`);
      // a mark picks one of the role's `count` parts, or of its `items` when it has no count (a log's entries)
      const pool = merged.count ?? (/(^| )count/.test(info(role).opts ?? "") ? undefined : merged.items);
      if (key === "mark" && typeof value === "number" && (value < 0 || (pool !== undefined && value >= pool))) problems.push(`${where} sets "${id}" (${role}) mark to ${value}, but it has ${pool ?? "no"} to pick from`);
    }
    optsOf.set(id, merged);
  };
  for (const n of scene.nodes) {
    if (!(n.role in ROLES)) {
      const near = ROLE_IDS.filter((r) => r.startsWith(n.role.slice(0, 3)) || n.role.startsWith(r.slice(0, 3)));
      problems.push(`node "${n.id}" has unknown role "${n.role}"${near.length ? ` (did you mean ${near.map((r) => `"${r}"`).join(" or ")}?)` : ""}; the parts are listed in docs/pictogram-catalog.md`);
      continue;
    }
    roleOf.set(n.id, n.role as StageRole);
    check(n.id, n.opts ?? {}, `node "${n.id}"`);
  }
  const events = (list: unknown[], where: string) => list.forEach((e, k) => {
    const s = e as StateLike;
    if (s.type === "state" && s.opts) for (const id of s.nodes ?? (s.node ? [s.node] : [])) check(id, s.opts, `${where} event ${k + 1}`);
  });
  scene.steps.forEach((step, i) => {
    events(step.events, `step ${i + 1}`);
    step.control?.options.forEach((o, j) => events(o.events, `step ${i + 1} option ${j + 1}`));
  });
  return problems;
}
