// The home page's small game: one app, three surges of traffic, and a call to make at each. The numbers are
// a deliberately simple capacity model, not a benchmark, but the reasons a fix does or doesn't help are real.

export type ScaleSystem = {
  servers: number;
  /** How many times bigger than the starting machine each server is. */
  serverPower: number;
  balancer: boolean;
  databasePower: number;
  /** The share of reads the cache answers, or 0 with no cache. */
  cacheHit: number;
  /** Read copies beside the primary database. */
  replicas: number;
  shards: number;
};

export type ScaleFix = { id: string; label: string; change: Partial<ScaleSystem>; note: string };
export type ScaleRound = { users: number; requests: number; system: ScaleSystem; fixes: ScaleFix[]; answer: string };

const SERVER_CAPACITY = 1_000;
const DATABASE_CAPACITY = 5_000;
const WRITE_SHARE = 0.1;

export const SCALE_START: ScaleSystem = { servers: 1, serverPower: 1, balancer: false, databasePower: 1, cacheHit: 0, replicas: 0, shards: 1 };
/** The quiet moment before the surge. */
export const SCALE_CALM = { users: 10_000, requests: 140 };

/** How hard each tier is working, where 1 is full, and the share of requests lost to the tightest one. */
export function systemLoad(system: ScaleSystem, requests: number) {
  const server = requests / (system.servers * system.serverPower * SERVER_CAPACITY);
  const writes = requests * WRITE_SHARE;
  const reads = (requests - writes) * (1 - system.cacheHit);
  // Writes reach every copy, so replicas only share out the reads. Shards split everything.
  const database = (writes + reads / (1 + system.replicas)) / system.shards / (DATABASE_CAPACITY * system.databasePower);
  return { server, database, failing: 1 - Math.min(1, 1 / Math.max(server, database)) };
}

export const SCALE_ROUNDS: ScaleRound[] = [
  {
    users: 250_000,
    requests: 3_500,
    system: SCALE_START,
    answer: "more-servers",
    fixes: [
      { id: "bigger-server", label: "Bigger server", change: { serverPower: 2 }, note: "Twice the machine. Still not enough." },
      { id: "more-servers", label: "More servers", change: { servers: 4, balancer: true }, note: "A load balancer shares the traffic." },
      { id: "add-cache", label: "Add a cache", change: { cacheHit: 0.8 }, note: "The database relaxes. The server is still drowning." },
    ],
  },
  {
    users: 1_000_000,
    requests: 14_000,
    system: { ...SCALE_START, servers: 16, balancer: true },
    answer: "add-cache",
    fixes: [
      { id: "add-cache", label: "Add a cache", change: { cacheHit: 0.8 }, note: "Most reads repeat. Now they skip the database." },
      { id: "bigger-database", label: "Bigger database", change: { databasePower: 2 }, note: "Better, but you can only buy so big." },
      { id: "more-servers", label: "More servers", change: { servers: 32 }, note: "The servers were fine. The database wasn’t." },
    ],
  },
  {
    users: 10_000_000,
    requests: 140_000,
    system: { ...SCALE_START, servers: 160, balancer: true, cacheHit: 0.8 },
    answer: "shard",
    fixes: [
      { id: "replicas", label: "Read replicas", change: { replicas: 3 }, note: "Every copy still takes every write." },
      { id: "shard", label: "Shard the database", change: { shards: 16 }, note: "Each shard takes its own slice of the writes." },
      { id: "bigger-cache", label: "Bigger cache", change: { cacheHit: 0.95 }, note: "Reads are quiet, but writes can’t be cached." },
    ],
  },
];

export function withFix(round: ScaleRound, fixId: string | null): ScaleSystem {
  const fix = round.fixes.find((item) => item.id === fixId);
  return fix ? { ...round.system, ...fix.change } : round.system;
}

export function formatUsers(users: number) {
  return users >= 1_000_000 ? `${users / 1_000_000}M` : `${users / 1_000}K`;
}

export const formatPercent = (share: number) => `${Math.round(share * 100)}%`;

export type ScaleNode = {
  id: string;
  kind: "users" | "balancer" | "server" | "cache" | "database";
  /** Across and down the map, from 0 to 1. */
  x: number;
  y: number;
  /** Only the last node of a stacked tier carries the tier's label. */
  label: string | null;
  /** The tier's load, for the ring around it. */
  load: number | null;
};

const STACK = [0.14, 0.44, 0.74];
const MIDDLE = 0.44;

function plural(count: number, one: string, many: string) {
  return count > 1 ? `${count} ${many}` : one;
}

/** The system as a map: tiers from left to right, with a stack of three standing for any tier of many. */
export function scaleNodes(system: ScaleSystem, requests: number): ScaleNode[] {
  const load = systemLoad(system, requests);
  const copies = system.shards > 1 ? system.shards : system.replicas + 1;
  const tiers: { kind: ScaleNode["kind"]; count: number; label: string; load: number | null }[] = [
    { kind: "users", count: 1, label: "Users", load: null },
    ...(system.balancer ? [{ kind: "balancer" as const, count: 1, label: "Balancer", load: null }] : []),
    { kind: "server", count: system.servers, label: plural(system.servers, "Server", "servers"), load: load.server },
    ...(system.cacheHit > 0 ? [{ kind: "cache" as const, count: 1, label: "Cache", load: null }] : []),
    { kind: "database", count: copies, label: system.shards > 1 ? `${system.shards} shards` : system.replicas > 0 ? `${copies} copies` : "Database", load: load.database },
  ];
  return tiers.flatMap((tier, column) => {
    const x = 0.08 + (column / (tiers.length - 1)) * 0.84;
    if (tier.count === 1) return [{ id: `${tier.kind}-1`, kind: tier.kind, x, y: MIDDLE, label: tier.label, load: tier.load }];
    return STACK.map((y, index) => ({ id: `${tier.kind}-${index === 1 ? 1 : index === 0 ? 0 : 2}`, kind: tier.kind, x, y, label: index === STACK.length - 1 ? tier.label : null, load: tier.load }));
  });
}

/** Every path a request can take through the map, one node from each tier. */
export function scaleRoutes(nodes: ScaleNode[]): string[][] {
  const tiers = new Map<string, string[]>();
  for (const node of nodes) tiers.set(node.kind, [...(tiers.get(node.kind) ?? []), node.id]);
  return [...tiers.values()].reduce<string[][]>((routes, tier) => routes.flatMap((route) => tier.map((id) => [...route, id])), [[]]);
}

/** What happens to a request reaching each node: lost to overload, or answered there and going no further. */
export function scaleFlow(system: ScaleSystem, requests: number, nodes: ScaleNode[]) {
  const load = systemLoad(system, requests);
  const lost = (tierLoad: number) => 1 - Math.min(1, 1 / tierLoad);
  const drop: Record<string, number> = {};
  const absorb: Record<string, number> = {};
  for (const node of nodes) {
    if (node.kind === "server") drop[node.id] = lost(load.server);
    if (node.kind === "database") drop[node.id] = lost(load.database);
    if (node.kind === "cache") absorb[node.id] = system.cacheHit * (1 - WRITE_SHARE);
  }
  // A slow trickle of dots can still show a quiet system and a flood can show a busy one, without one dot per request.
  return { routes: scaleRoutes(nodes), rate: 8 + 8 * Math.log10(Math.max(1, requests / 100)), drop, absorb };
}
