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
  /** How far the drawing rises above its floor centre, in drawing units, for placing notes, pills and the down mark. */
  top: number;
  /** The pack that draws it; core roles have none and load with every stage. */
  pack?: PackName;
  /** Its meter fills it: the stage passes the part's meter as `level`. */
  fill?: boolean;
};

/** What the stage needs of each role while it plays: its height, its pack, whether its meter fills it. */
export const ROLES = {
  // core: loaded by every stage
  client: { top: 36 },
  crowd: { top: 27 },
  dns: { top: 28 },
  balancer: { top: 20 },
  web: { top: 48 },
  cache: { top: 16 },
  database: { top: 40, fill: true },
  cdn: { top: 36 },
  storage: { top: 40 },
  queue: { top: 18 },
  worker: { top: 30 },
  monitor: { top: 39 },

  // devices: what stands at the edges, ours and other people's
  phone: { top: 36, pack: "devices" },
  sensor: { top: 35, pack: "devices" },
  sender: { top: 44, pack: "devices" },
  external: { top: 38, pack: "devices" },
  mailbox: { top: 34, pack: "devices" },

  // control: what checks, limits and lets through
  gateway: { top: 34, pack: "control" },
  gate: { top: 34, pack: "control" },
  breaker: { top: 31, pack: "control" },
  limiter: { top: 22, pack: "control" },
  bucket: { top: 32, pack: "control", fill: true },
  counter: { top: 23, pack: "control" },
  lock: { top: 41, pack: "control" },

  // time: clocks, timeouts and leases
  clock: { top: 33, pack: "time" },
  timer: { top: 43, pack: "time", fill: true },
  lease: { top: 40, pack: "time", fill: true },
  scheduler: { top: 32, pack: "time" },

  // services: machines that do one job
  socket: { top: 43, pack: "services" },
  fanout: { top: 28, pack: "services" },
  idgen: { top: 35, pack: "services" },
  transcoder: { top: 39, pack: "services" },
  fetcher: { top: 41, pack: "services" },
  router: { top: 37, pack: "services" },
  coordinator: { top: 32, pack: "services" },
  registry: { top: 40, pack: "services" },

  // logs: append-only records and what reads them
  logfile: { top: 28, pack: "logs" },
  broker: { top: 38, pack: "logs" },
  consumer: { top: 31, pack: "logs" },
  frontier: { top: 39, pack: "logs" },
  disk: { top: 18, pack: "logs" },

  // records: how data is laid out and found
  memtable: { top: 41, pack: "records", fill: true },
  sstable: { top: 33, pack: "records" },
  bloom: { top: 28, pack: "records" },
  tree: { top: 39, pack: "records" },
  shard: { top: 25, pack: "records" },
  index: { top: 35, pack: "records" },
  columns: { top: 43, pack: "records" },
  row: { top: 27, pack: "records" },
  doc: { top: 37, pack: "records" },
} satisfies Record<string, RoleInfo>;

export type StageRole = keyof typeof ROLES;

/**
 * Each role's default name (on its tag unless a scene names the part) and the options its drawing reads, with ranges:
 * "count:1-6 mark level". `lead` works on every role. Only the checks and the catalogue read this, so pages don't load it.
 */
export const ROLE_TERMS: Record<StageRole, [name: string, opts?: string]> = {
  // core: loaded by every stage
  client: ["Client", "many"],
  crowd: ["Users"],
  dns: ["DNS"],
  balancer: ["Load balancer"],
  web: ["Web server", "big many"],
  cache: ["Cache"],
  database: ["Database", "big replica level"],
  cdn: ["CDN edge"],
  storage: ["Object storage"],
  queue: ["Queue", "items:0-4"],
  worker: ["Worker"],
  monitor: ["Monitoring"],

  // devices: what stands at the edges, ours and other people's
  phone: ["Phone", "many items:0-3 level"],
  sensor: ["Sensor", "many"],
  sender: ["Outside sender"],
  external: ["Outside service"],
  mailbox: ["Inbox", "items:0-4"],

  // control: what checks, limits and lets through
  gateway: ["API gateway", "open"],
  gate: ["Gate", "open"],
  breaker: ["Circuit breaker", "open"],
  limiter: ["Rate limiter", "count:1-3"],
  bucket: ["Token bucket", "level items:0-8"],
  counter: ["Counter"],
  lock: ["Lock", "open"],

  // time: clocks, timeouts and leases
  clock: ["Clock", "level"],
  timer: ["Timer", "level"],
  lease: ["Lease", "level"],
  scheduler: ["Scheduler", "items:0-4"],

  // services: machines that do one job
  socket: ["WebSocket server", "items:0-8"],
  fanout: ["Fan-out", "count:2-6"],
  idgen: ["ID generator"],
  transcoder: ["Transcoder", "count:1-3"],
  fetcher: ["Fetcher"],
  router: ["Router", "count:2-4 mark"],
  coordinator: ["Coordinator", "count:2-5 items:0-5"],
  registry: ["Registry", "count:2-6 items:0-6"],

  // logs: append-only records and what reads them
  logfile: ["Log", "items:0-8 mark"],
  broker: ["Broker", "count:1-6 items:0-6 mark"],
  consumer: ["Consumer group", "count:1-4 mark"],
  frontier: ["URL frontier", "count:2-4 items:0-4 mark"],
  disk: ["Disk"],

  // records: how data is laid out and found
  memtable: ["Memtable", "level"],
  sstable: ["Sorted files", "count:1-5"],
  bloom: ["Bloom filter", "level"],
  tree: ["Tree", "count:2-3 mark"],
  shard: ["Shard", "count:2-6 mark"],
  index: ["Index", "mark:0-11"],
  columns: ["Column store", "count:3-6 items:0-6"],
  row: ["Row", "count:1-4 locked"],
  doc: ["Document", "count:1-3"],
};
export const ROLE_IDS = Object.keys(ROLES) as StageRole[];
const info = (role: StageRole): RoleInfo => ROLES[role];
export const roleName = (role: StageRole) => ROLE_TERMS[role][0];
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
    for (const o of (ROLE_TERMS[role][1] ?? "").split(" ").filter(Boolean)) {
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
      const pool = merged.count ?? (/(^| )count/.test(ROLE_TERMS[role][1] ?? "") ? undefined : merged.items);
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
