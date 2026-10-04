import { useId, type ReactNode } from "react";

type NodeKind = "browser" | "dns" | "balancer" | "server" | "combined" | "database" | "cdn" | "cache" | "queue" | "worker" | "storage" | "router" | "region" | "telemetry";
type Tone = "request" | "read" | "write" | "sync";

type Node = {
  id: string;
  x: number;
  y: number;
  width: number;
  title: string;
  detail?: string;
  kind: NodeKind;
};

type Connection = {
  points: [number, number][];
  tone?: Tone;
  label?: string;
  labelAt?: [number, number];
  dashed?: boolean;
  arrow?: boolean;
};

type Scene = {
  title: string;
  summary: string;
  nodes: Node[];
  connections: Connection[];
  note?: string;
};

const scenes: Record<string, Scene> = {
  "single-server": {
    title: "One machine does everything",
    summary:
      "A person looks up the domain through DNS, then sends a request to one machine that runs both the web application and database. That machine is a single point of failure.",
    nodes: [
      { id: "visitor", x: 55, y: 193, width: 138, title: "Visitor", detail: "browser", kind: "browser" },
      { id: "dns", x: 288, y: 86, width: 145, title: "DNS", detail: "domain → IP", kind: "dns" },
      { id: "server", x: 592, y: 193, width: 235, title: "One server", detail: "web app + database", kind: "combined" },
    ],
    connections: [
      { points: [[193, 221], [249, 221], [249, 114], [288, 114]], label: "look up", labelAt: [220, 150] },
      { points: [[288, 137], [270, 137], [270, 244], [193, 244]], label: "IP address", labelAt: [329, 170] },
      { points: [[193, 236], [225, 236], [225, 317], [548, 317], [548, 236], [592, 236]], label: "HTTP request", labelAt: [389, 297] },
    ],
    note: "Simple to launch; one failure can take the whole service offline.",
  },
  "split-tiers": {
    title: "Separate app and data",
    summary:
      "Requests reach the web application, which talks to a database on another machine. Each tier can now be sized and operated independently, although each remains a single point of failure.",
    nodes: [
      { id: "visitor", x: 44, y: 183, width: 138, title: "Visitor", detail: "browser", kind: "browser" },
      { id: "web", x: 319, y: 183, width: 180, title: "Web server", detail: "application", kind: "server" },
      { id: "db", x: 686, y: 183, width: 180, title: "Database", detail: "persistent data", kind: "database" },
    ],
    connections: [
      { points: [[182, 211], [319, 211]], label: "HTTP", labelAt: [251, 192] },
      { points: [[499, 205], [686, 205]], tone: "read", label: "read", labelAt: [592, 187] },
      { points: [[499, 231], [686, 231]], tone: "write", label: "write", labelAt: [592, 260] },
    ],
    note: "Separating tiers lets each grow independently.",
  },
  "scale-web": {
    title: "Spread requests across web servers",
    summary:
      "A load balancer sends incoming requests to two web servers. If one web server fails, it can route requests to the other. The database is still shared and can remain a bottleneck.",
    nodes: [
      { id: "visitors", x: 28, y: 203, width: 148, title: "Visitors", detail: "many requests", kind: "browser" },
      { id: "balancer", x: 260, y: 203, width: 168, title: "Load balancer", detail: "healthy routes", kind: "balancer" },
      { id: "web-a", x: 525, y: 105, width: 164, title: "Web A", detail: "application", kind: "server" },
      { id: "web-b", x: 525, y: 299, width: 164, title: "Web B", detail: "application", kind: "server" },
      { id: "db", x: 785, y: 203, width: 164, title: "Database", detail: "shared data", kind: "database" },
    ],
    connections: [
      { points: [[176, 231], [260, 231]] },
      { points: [[428, 231], [470, 231], [470, 133], [525, 133]] },
      { points: [[428, 231], [470, 231], [470, 327], [525, 327]] },
      { points: [[689, 133], [739, 133], [739, 231], [785, 231]] },
      { points: [[689, 327], [739, 327], [739, 231], [785, 231]] },
    ],
    note: "The balancer removes unhealthy web servers from rotation.",
  },
  replication: {
    title: "Copy data for reads and recovery",
    summary:
      "The web tier sends writes to the primary database and reads to replicas. The primary copies changes to the replicas. Replicas hold copies of the same data, not different partitions.",
    nodes: [
      { id: "web", x: 38, y: 198, width: 175, title: "Web tier", detail: "application", kind: "server" },
      { id: "primary", x: 362, y: 198, width: 180, title: "Primary", detail: "accepts writes", kind: "database" },
      { id: "replica-a", x: 746, y: 98, width: 185, title: "Replica A", detail: "serves reads", kind: "database" },
      { id: "replica-b", x: 746, y: 303, width: 185, title: "Replica B", detail: "serves reads", kind: "database" },
    ],
    connections: [
      { points: [[213, 239], [362, 239]], tone: "write", label: "writes", labelAt: [287, 263] },
      { points: [[213, 208], [260, 208], [260, 126], [746, 126]], tone: "read", label: "reads", labelAt: [612, 103] },
      { points: [[213, 255], [260, 255], [260, 331], [746, 331]], tone: "read", label: "reads", labelAt: [612, 356] },
      { points: [[542, 219], [630, 219], [630, 142], [746, 142]], tone: "sync", label: "replicate", labelAt: [685, 165], dashed: true },
      { points: [[542, 253], [650, 253], [650, 346], [746, 346]], tone: "sync", dashed: true },
    ],
    note: "Read capacity and failover improve; writes still depend on one primary.",
  },
  "cache-cdn": {
    title: "Two caches, two jobs",
    summary:
      "A CDN serves nearby static assets and fetches an asset from origin on a miss. For dynamic data, the web server checks the application cache; on a miss, the web server queries the database and fills the cache.",
    nodes: [
      { id: "visitors", x: 24, y: 205, width: 145, title: "Visitors", detail: "browser", kind: "browser" },
      { id: "cdn", x: 242, y: 88, width: 164, title: "CDN edge", detail: "static assets", kind: "cdn" },
      { id: "web", x: 242, y: 302, width: 164, title: "Web tier", detail: "dynamic pages", kind: "server" },
      { id: "origin", x: 677, y: 88, width: 190, title: "Origin", detail: "source assets", kind: "storage" },
      { id: "cache", x: 487, y: 302, width: 166, title: "App cache", detail: "hot data", kind: "cache" },
      { id: "db", x: 755, y: 302, width: 160, title: "Database", detail: "source of truth", kind: "database" },
    ],
    connections: [
      { points: [[169, 226], [202, 226], [202, 116], [242, 116]], label: "assets", labelAt: [207, 156] },
      { points: [[169, 241], [202, 241], [202, 330], [242, 330]], label: "data", labelAt: [201, 300] },
      { points: [[406, 109], [677, 109]], label: "miss: fetch", labelAt: [540, 88] },
      { points: [[677, 132], [406, 132]], tone: "read", label: "return / fill", labelAt: [540, 153] },
      { points: [[406, 330], [487, 330]], tone: "read", label: "check / fill", labelAt: [446, 309] },
      { points: [[487, 348], [406, 348]], tone: "read", label: "hit / miss", labelAt: [446, 377] },
      { points: [[406, 353], [425, 353], [425, 397], [727, 397], [727, 348], [755, 348]], tone: "read", label: "on miss: web queries DB", labelAt: [585, 421] },
    ],
    note: "The web tier handles application cache misses; origin handles CDN misses.",
  },
  stateless: {
    title: "Keep sessions outside web servers",
    summary:
      "The load balancer can send each request to any web server. Both web servers use a shared session store, so a visitor stays signed in even when requests move between servers.",
    nodes: [
      { id: "visitor", x: 20, y: 205, width: 135, title: "Visitor", detail: "signed in", kind: "browser" },
      { id: "balancer", x: 213, y: 205, width: 168, title: "Load balancer", kind: "balancer" },
      { id: "web-a", x: 460, y: 94, width: 153, title: "Web A", detail: "stateless", kind: "server" },
      { id: "web-b", x: 460, y: 310, width: 153, title: "Web B", detail: "stateless", kind: "server" },
      { id: "session", x: 748, y: 205, width: 205, title: "Session store", detail: "durable shared state", kind: "cache" },
    ],
    connections: [
      { points: [[155, 233], [213, 233]] },
      { points: [[381, 233], [420, 233], [420, 122], [460, 122]] },
      { points: [[381, 233], [420, 233], [420, 338], [460, 338]] },
      { points: [[613, 122], [687, 122], [687, 233], [748, 233]], tone: "read", label: "session", labelAt: [690, 151] },
      { points: [[613, 338], [687, 338], [687, 248], [748, 248]], tone: "read" },
    ],
    note: "Any healthy web server can handle the next request.",
  },
  "multi-dc": {
    title: "Bring the service nearer to users",
    summary:
      "GeoDNS directs a visitor toward a healthy, nearby region. This example shows Region A as the writer and one-way data replication to Region B. Failover requires traffic rerouting and a data promotion plan.",
    nodes: [
      { id: "visitors", x: 22, y: 203, width: 132, title: "Visitors", detail: "worldwide", kind: "browser" },
      { id: "geodns", x: 212, y: 203, width: 150, title: "GeoDNS", detail: "region routing", kind: "dns" },
      { id: "us-web", x: 474, y: 83, width: 170, title: "Web A", detail: "regional tier", kind: "region" },
      { id: "us-db", x: 746, y: 83, width: 172, title: "Data A", detail: "regional data", kind: "database" },
      { id: "eu-web", x: 474, y: 320, width: 170, title: "Web B", detail: "regional tier", kind: "region" },
      { id: "eu-db", x: 746, y: 320, width: 172, title: "Data B", detail: "regional data", kind: "database" },
    ],
    connections: [
      { points: [[154, 231], [212, 231]] },
      { points: [[362, 231], [419, 231], [419, 111], [474, 111]], label: "near / healthy", labelAt: [430, 160] },
      { points: [[362, 231], [419, 231], [419, 348], [474, 348]] },
      { points: [[644, 111], [746, 111]], tone: "read" },
      { points: [[644, 348], [746, 348]], tone: "read" },
      { points: [[832, 139], [832, 320]], tone: "sync", label: "A → B copy", labelAt: [881, 230], dashed: true },
    ],
    note: "Illustrative one-way topology; promoting B safely requires a failover plan.",
  },
  queue: {
    title: "Move slow work out of the request",
    summary:
      "The web tier stores the original upload durably, then enqueues its object key. A worker reads that original asynchronously, resizes it, and writes a processed image to object storage. The queue absorbs bursts.",
    nodes: [
      { id: "visitor", x: 15, y: 205, width: 138, title: "Visitor", detail: "uploads photo", kind: "browser" },
      { id: "web", x: 209, y: 205, width: 155, title: "Web tier", detail: "accept upload", kind: "server" },
      { id: "queue", x: 425, y: 205, width: 155, title: "Job queue", detail: "pending work", kind: "queue" },
      { id: "worker-a", x: 647, y: 101, width: 147, title: "Worker A", detail: "resize", kind: "worker" },
      { id: "worker-b", x: 647, y: 309, width: 147, title: "Worker B", detail: "resize", kind: "worker" },
      { id: "storage", x: 831, y: 205, width: 150, title: "Storage", detail: "images", kind: "storage" },
    ],
    connections: [
      { points: [[153, 233], [209, 233]] },
      { points: [[364, 233], [425, 233]], tone: "write", label: "2. key", labelAt: [396, 210] },
      { points: [[364, 255], [391, 255], [391, 402], [919, 402], [919, 263]], tone: "write", label: "1. store original", labelAt: [492, 422] },
      { points: [[580, 233], [613, 233], [613, 129], [647, 129]], label: "consume", labelAt: [622, 165] },
      { points: [[580, 233], [613, 233], [613, 337], [647, 337]] },
      { points: [[867, 205], [867, 75], [720, 75], [720, 101]], tone: "read", label: "3. read original", labelAt: [790, 67] },
      { points: [[867, 263], [867, 385], [720, 385], [720, 367]], tone: "read" },
      { points: [[794, 144], [813, 144], [813, 233], [831, 233]], tone: "write" },
      { points: [[794, 337], [813, 337], [813, 248], [831, 248]], tone: "write" },
    ],
    note: "The queue holds a reference; object storage holds the original and result.",
  },
  sharding: {
    title: "Divide data by a stable key",
    summary:
      "The application uses a user's ID to choose one of three database shards. Each shard stores a different portion of users and accepts reads and writes for that portion. Shards are partitions, unlike replicas, which copy the same data.",
    nodes: [
      { id: "web", x: 32, y: 208, width: 165, title: "Web tier", detail: "request", kind: "server" },
      { id: "router", x: 274, y: 208, width: 185, title: "Shard router", detail: "user_id % 3", kind: "router" },
      { id: "shard-0", x: 721, y: 60, width: 202, title: "Shard 0", detail: "users 0, 3, 6…", kind: "database" },
      { id: "shard-1", x: 721, y: 206, width: 202, title: "Shard 1", detail: "users 1, 4, 7…", kind: "database" },
      { id: "shard-2", x: 721, y: 352, width: 202, title: "Shard 2", detail: "users 2, 5, 8…", kind: "database" },
    ],
    connections: [
      { points: [[197, 236], [274, 236]] },
      { points: [[459, 227], [550, 227], [550, 88], [721, 88]], label: "user_id % 3 = 0", labelAt: [640, 67] },
      { points: [[459, 236], [721, 234]], label: "user_id % 3 = 1", labelAt: [590, 213] },
      { points: [[459, 246], [550, 246], [550, 380], [721, 380]], label: "user_id % 3 = 2", labelAt: [640, 403] },
    ],
    note: "Each shard holds different records; distribution quality depends on the key.",
  },
  cache: {
    title: "Let the web tier manage a cache miss",
    summary: "The web server checks the application cache first. A hit returns quickly. On a miss, the web server reads the database, responds to the visitor, and fills the cache for later requests.",
    nodes: [
      { id: "visitor", x: 32, y: 205, width: 145, title: "Visitor", detail: "browser", kind: "browser" },
      { id: "web", x: 285, y: 205, width: 170, title: "Web tier", detail: "owns miss path", kind: "server" },
      { id: "cache", x: 697, y: 93, width: 180, title: "App cache", detail: "hot data", kind: "cache" },
      { id: "db", x: 697, y: 307, width: 180, title: "Database", detail: "source of truth", kind: "database" },
    ],
    connections: [
      { points: [[177, 233], [285, 233]], label: "request", labelAt: [231, 214] },
      { points: [[455, 217], [560, 217], [560, 121], [697, 121]], tone: "read", label: "1. check", labelAt: [612, 107] },
      { points: [[697, 143], [585, 143], [585, 238], [455, 238]], tone: "read", label: "2. hit / miss", labelAt: [635, 163] },
      { points: [[455, 253], [540, 253], [540, 335], [697, 335]], tone: "read", label: "3. miss: query DB", labelAt: [622, 317] },
      { points: [[697, 353], [510, 353], [510, 258], [455, 258]], tone: "read", label: "result", labelAt: [609, 376] },
      { points: [[455, 209], [488, 209], [488, 74], [697, 74], [697, 104]], tone: "write", label: "4. on miss: fill", labelAt: [592, 66] },
    ],
    note: "Keep persistent data in the database; set a TTL and invalidation policy.",
  },
  cdn: {
    title: "Serve assets near the visitor",
    summary: "The browser requests a versioned static asset from a nearby CDN edge. A cache hit returns it there. On a miss, the edge fetches the asset from origin and stores a copy for subsequent visitors.",
    nodes: [
      { id: "visitor", x: 38, y: 205, width: 150, title: "Visitor", detail: "browser", kind: "browser" },
      { id: "edge", x: 325, y: 205, width: 185, title: "CDN edge", detail: "nearby copy", kind: "cdn" },
      { id: "origin", x: 754, y: 205, width: 186, title: "Origin", detail: "source asset", kind: "storage" },
    ],
    connections: [
      { points: [[188, 220], [325, 220]], label: "asset request", labelAt: [254, 198] },
      { points: [[325, 246], [188, 246]], tone: "read", label: "hit: return", labelAt: [255, 273] },
      { points: [[510, 220], [754, 220]], label: "miss: fetch", labelAt: [633, 198] },
      { points: [[754, 246], [510, 246]], tone: "read", label: "return and fill", labelAt: [632, 273] },
    ],
    note: "Version asset URLs when a change must bypass older cached copies.",
  },
  observability: {
    title: "See what the system is doing",
    summary: "Requests pass through the load balancer to the web tier and its dependencies. The web tier, database, and cache send metrics, logs, and traces to a monitor, which can alert operators when service health degrades.",
    nodes: [
      { id: "visitor", x: 12, y: 205, width: 135, title: "Visitor", detail: "browser", kind: "browser" },
      { id: "balancer", x: 172, y: 205, width: 154, title: "Balancer", detail: "traffic", kind: "balancer" },
      { id: "web", x: 353, y: 205, width: 160, title: "Web tier", detail: "requests", kind: "server" },
      { id: "db", x: 580, y: 82, width: 170, title: "Database", detail: "query health", kind: "database" },
      { id: "cache", x: 580, y: 325, width: 170, title: "App cache", detail: "hit rate", kind: "cache" },
      { id: "monitor", x: 802, y: 205, width: 175, title: "Monitor", detail: "signals + alerts", kind: "telemetry" },
    ],
    connections: [
      { points: [[147, 233], [172, 233]] },
      { points: [[326, 233], [353, 233]] },
      { points: [[513, 219], [550, 219], [550, 110], [580, 110]], tone: "read" },
      { points: [[513, 247], [550, 247], [550, 353], [580, 353]], tone: "read" },
      { points: [[513, 233], [802, 233]], tone: "sync", label: "logs / traces", labelAt: [656, 211], dashed: true },
      { points: [[750, 110], [775, 110], [775, 217], [802, 217]], tone: "sync", dashed: true },
      { points: [[750, 353], [775, 353], [775, 249], [802, 249]], tone: "sync", dashed: true },
    ],
    note: "Track latency, errors, traffic, resource use, and dependency health.",
  },
  synthesis: {
    title: "Choose components for the workload",
    summary: "Static assets can go through a CDN. Dynamic requests pass through a load balancer to the web tier. The web tier checks a cache, reads the database on a miss, and sends slow work through a queue to workers. Add each component only for a clear bottleneck or reliability need.",
    nodes: [
      { id: "visitor", x: 20, y: 205, width: 142, title: "Visitor", detail: "browser", kind: "browser" },
      { id: "cdn", x: 215, y: 89, width: 155, title: "CDN edge", detail: "static assets", kind: "cdn" },
      { id: "balancer", x: 215, y: 307, width: 170, title: "Balancer", detail: "dynamic traffic", kind: "balancer" },
      { id: "web", x: 442, y: 307, width: 155, title: "Web tier", detail: "application", kind: "server" },
      { id: "queue", x: 653, y: 89, width: 155, title: "Job queue", detail: "slow tasks", kind: "queue" },
      { id: "worker", x: 835, y: 89, width: 150, title: "Worker", detail: "async work", kind: "worker" },
      { id: "cache", x: 653, y: 307, width: 155, title: "App cache", detail: "hot data", kind: "cache" },
      { id: "db", x: 835, y: 307, width: 150, title: "Database", detail: "durable data", kind: "database" },
    ],
    connections: [
      { points: [[162, 220], [185, 220], [185, 117], [215, 117]], label: "static", labelAt: [179, 163] },
      { points: [[162, 246], [185, 246], [185, 335], [215, 335]], label: "dynamic", labelAt: [179, 289] },
      { points: [[385, 335], [442, 335]] },
      { points: [[597, 323], [653, 323]], tone: "read", label: "check", labelAt: [625, 304] },
      { points: [[653, 307], [653, 289], [597, 289], [597, 307]], tone: "read", label: "cache hit", labelAt: [625, 278] },
      { points: [[597, 351], [620, 351], [620, 394], [816, 394], [816, 351], [835, 351]], tone: "read", label: "DB on cache miss", labelAt: [721, 417] },
      { points: [[520, 307], [520, 117], [653, 117]], tone: "write", label: "enqueue", labelAt: [550, 226] },
      { points: [[808, 117], [835, 117]], label: "consume", labelAt: [821, 72] },
    ],
    note: "Match each addition to a measured need; complexity has a cost.",
  },
};

const palette: Record<NodeKind, { fill: string; border: string }> = {
  browser: { fill: "var(--arch-paper)", border: "var(--arch-stroke)" },
  dns: { fill: "var(--arch-node-soft)", border: "var(--arch-stroke)" },
  balancer: { fill: "var(--arch-node-soft)", border: "var(--arch-stroke)" },
  server: { fill: "var(--arch-node)", border: "var(--arch-stroke)" },
  combined: { fill: "var(--arch-node)", border: "var(--arch-stroke)" },
  database: { fill: "var(--arch-node-deep)", border: "var(--arch-stroke)" },
  cdn: { fill: "var(--arch-node-soft)", border: "var(--arch-stroke)" },
  cache: { fill: "var(--arch-node-soft)", border: "var(--arch-stroke)" },
  queue: { fill: "var(--arch-node-deep)", border: "var(--arch-stroke)" },
  worker: { fill: "var(--arch-node)", border: "var(--arch-stroke)" },
  storage: { fill: "var(--arch-node)", border: "var(--arch-stroke)" },
  router: { fill: "var(--arch-node-soft)", border: "var(--arch-stroke)" },
  region: { fill: "var(--arch-node)", border: "var(--arch-stroke)" },
  telemetry: { fill: "var(--arch-node-deep)", border: "var(--arch-stroke)" },
};

const lineColors: Record<Tone, string> = {
  request: "var(--arch-connection)",
  read: "var(--arch-read)",
  write: "var(--arch-write)",
  sync: "var(--arch-sync)",
};

function NodePictogram({ kind }: { kind: NodeKind }) {
  // Each pictogram has its own silhouette so a node is identifiable before its label is read.
  const marks: Record<NodeKind, ReactNode> = {
    browser: <><rect x="5" y="8" width="30" height="20" rx="2" /><path d="M5 13h30M3 32h34l-4-4H7z" /><circle cx="9" cy="11" r=".7" fill="currentColor" stroke="none" /></>,
    dns: <><circle cx="20" cy="20" r="14" /><path d="M6 20h28M20 6c-5 4-7 9-7 14s2 10 7 14M20 6c5 4 7 9 7 14s-2 10-7 14M9 13h22M9 27h22" /></>,
    balancer: <><path d="M4 20h11M15 20l7-10h5M15 20l7 10h5" /><rect x="27" y="5" width="9" height="10" rx="1" /><rect x="27" y="25" width="9" height="10" rx="1" /><path d="m9 16 4 4-4 4" /></>,
    server: <><rect x="7" y="5" width="26" height="30" rx="2" /><path d="M7 15h26M7 25h26M13 10h11M13 20h11M13 30h11" /><circle cx="28" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="28" cy="20" r="1" fill="currentColor" stroke="none" /><circle cx="28" cy="30" r="1" fill="currentColor" stroke="none" /></>,
    combined: <><rect x="4" y="6" width="18" height="28" rx="2" /><path d="M4 15h18M4 24h18M9 10h7M9 19h7M9 29h7" /><ellipse cx="30" cy="15" rx="7" ry="3" /><path d="M23 15v16c0 2 3 3 7 3s7-1 7-3V15M23 23c0 2 3 3 7 3s7-1 7-3" /></>,
    database: <><ellipse cx="20" cy="9" rx="13" ry="5" /><path d="M7 9v22c0 3 6 5 13 5s13-2 13-5V9M7 20c0 3 6 5 13 5s13-2 13-5" /></>,
    cdn: <><circle cx="20" cy="20" r="14" /><path d="M6 20h28M20 6c-4 5-6 9-6 14s2 9 6 14M20 6c4 5 6 9 6 14s-2 9-6 14" /><path d="M27 7h9v9M36 7l-8 8" /></>,
    cache: <><rect x="9" y="9" width="22" height="22" rx="2" /><path d="M14 3v6M22 3v6M29 3v6M14 31v6M22 31v6M29 31v6M3 14h6M3 22h6M3 29h6M31 14h6M31 22h6M31 29h6M22 13l-6 9h6l-3 6 8-10h-6l1-5" /></>,
    queue: <><rect x="6" y="7" width="24" height="7" rx="1" /><rect x="10" y="17" width="24" height="7" rx="1" /><rect x="6" y="27" width="24" height="7" rx="1" /><path d="m31 28 4 3-4 3" /></>,
    worker: <><circle cx="20" cy="20" r="11" /><circle cx="20" cy="20" r="4" /><path d="M20 4v5M20 31v5M4 20h5M31 20h5M9 9l4 4M27 27l4 4M31 9l-4 4M13 27l-4 4" /></>,
    storage: <><path d="M7 12h26l-3 23H10z" /><ellipse cx="20" cy="12" rx="13" ry="5" /><path d="M13 29l5-6 4 4 3-3 4 5z" /><circle cx="15" cy="20" r="1" fill="currentColor" stroke="none" /></>,
    router: <><rect x="4" y="15" width="10" height="10" rx="1" /><path d="M14 20h8M22 20V7h6M22 20h6M22 20v13h6" /><rect x="28" y="3" width="9" height="8" rx="1" /><rect x="28" y="16" width="9" height="8" rx="1" /><rect x="28" y="29" width="9" height="8" rx="1" /></>,
    region: <><path d="M4 14h32M7 14V35h26V14M12 14V7h16v7M13 21h5M23 21h5M13 27h5M23 27h5M17 35v-4h6v4" /></>,
    telemetry: <><rect x="5" y="6" width="30" height="28" rx="2" /><path d="M9 26h4l3-10 5 13 4-8 3 3h3M10 11h20" /></>,
  };

  return <g className="architecture-pictogram" transform="translate(8 9)" aria-hidden="true">{marks[kind]}</g>;
}

function HandDrawnNode({ node }: { node: Node }) {
  const { x, y, width, title, detail, kind } = node;
  const height = 58;
  const colors = palette[kind];
  const outline = `M ${x + 10} ${y + 1} L ${x + width - 8} ${y + 2} Q ${x + width + 1} ${y + 3} ${x + width} ${y + 11} L ${x + width - 1} ${y + height - 8} Q ${x + width - 2} ${y + height + 1} ${x + width - 11} ${y + height} L ${x + 8} ${y + height - 1} Q ${x - 1} ${y + height - 2} ${x} ${y + height - 10} L ${x + 1} ${y + 9} Q ${x + 2} ${y + 1} ${x + 10} ${y + 1} Z`;

  return (
    <g>
      <path d={outline} fill={colors.fill} stroke={colors.border} strokeWidth="2" strokeLinejoin="round" />
      <path
        d={`M ${x + 12} ${y + 4} L ${x + width - 10} ${y + 5} M ${x + 4} ${y + 13} L ${x + 4} ${y + height - 12}`}
        fill="none"
        stroke={colors.border}
        strokeOpacity="0.44"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <g transform={`translate(${x} ${y})`}><rect x="7" y="8" width="42" height="42" rx="9" fill="var(--arch-icon-fill)" stroke="var(--arch-icon-border)" strokeWidth="1" /><NodePictogram kind={kind} /></g>
      <text x={x + 54} y={y + (detail ? 27 : 35)} className="architecture-node-title">
        {title}
      </text>
      {detail && (
        <text x={x + 54} y={y + 45} className="architecture-node-detail">
          {detail}
        </text>
      )}
    </g>
  );
}

function ConnectionLine({ connection, markerIds }: { connection: Connection; markerIds: Record<Tone, string> }) {
  const tone = connection.tone ?? "request";
  const path = connection.points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={lineColors[tone]}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={tone === "write" ? "8 4" : tone === "sync" || connection.dashed ? "2 5" : undefined}
        markerEnd={connection.arrow === false ? undefined : `url(#${markerIds[tone]})`}
      />
      {connection.label && connection.labelAt && (
        <text x={connection.labelAt[0]} y={connection.labelAt[1]} textAnchor="middle" className={`architecture-edge-label architecture-${tone}`}>
          {connection.label}
        </text>
      )}
    </g>
  );
}

export function ArchitectureDiagram({ id, className }: { id: string; className?: string }) {
  const scene = scenes[id] ?? scenes["single-server"];
  const uniqueId = useId().replace(/:/g, "");
  const titleId = `${uniqueId}-title`;
  const descriptionId = `${uniqueId}-description`;
  const scrollHintId = `${uniqueId}-scroll-hint`;
  const markerIds: Record<Tone, string> = {
    request: `${uniqueId}-request-arrow`,
    read: `${uniqueId}-read-arrow`,
    write: `${uniqueId}-write-arrow`,
    sync: `${uniqueId}-sync-arrow`,
  };

  return (
    <figure className={["architecture-figure", className].filter(Boolean).join(" ")}>
      <div id={scrollHintId} className="architecture-scroll-hint">
        <span>Swipe or scroll to explore the full diagram</span><span aria-hidden="true">→</span>
      </div>
      <div className="architecture-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={scrollHintId}>
        <svg viewBox="0 0 1000 470" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
          <title id={titleId}>{scene.title}</title>
          <desc id={descriptionId}>{scene.summary}</desc>
          <defs>
            {(Object.keys(lineColors) as Tone[]).map((tone) => (
              <marker key={tone} id={markerIds[tone]} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={lineColors[tone]} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            ))}
          </defs>
          <rect width="1000" height="470" rx="18" fill="var(--arch-paper)" />
          <path d="M 28 51 L 970 51" stroke="var(--arch-rule)" strokeWidth="1" strokeDasharray="3 7" />
          <text x="28" y="34" className="architecture-heading">{scene.title}</text>
          {id === "multi-dc" && (
            <g aria-hidden="true">
              <rect x="450" y="63" width="490" height="109" rx="13" fill="var(--arch-region-fill)" stroke="var(--arch-rule)" strokeWidth="1.5" />
              <text x="461" y="78" className="architecture-region-label">REGION A</text>
              <rect x="450" y="300" width="490" height="110" rx="13" fill="var(--arch-region-fill)" stroke="var(--arch-rule)" strokeWidth="1.5" />
              <text x="461" y="315" className="architecture-region-label">REGION B</text>
            </g>
          )}
          {scene.connections.map((connection, index) => (
            <ConnectionLine key={index} connection={connection} markerIds={markerIds} />
          ))}
          {scene.nodes.map((node) => <HandDrawnNode key={node.id} node={node} />)}
          <text x="28" y="448" className="architecture-note">{scene.note}</text>
        </svg>
      </div>
      <figcaption>{scene.summary}</figcaption>
      <style>{`
        .architecture-figure {
          --arch-paper: #ffffff;
          --arch-node: #f7f7f7;
          --arch-node-soft: #f2f2f2;
          --arch-node-deep: #eaeaea;
          --arch-ink: #222222;
          --arch-secondary: #505050;
          --arch-stroke: #4b4b4b;
          --arch-connection: #555555;
          --arch-read: #292929;
          --arch-write: #343434;
          --arch-sync: #646464;
          --arch-rule: #d5d5d5;
          --arch-border: #c8c8c8;
          --arch-icon-fill: #ffffff;
          --arch-icon-border: #bcbcbc;
          --arch-region-fill: #fafafa;
          margin: 0; min-width: 0; max-width: 100%; color: var(--arch-ink); container-type: inline-size;
        }
        .architecture-scroll-hint { display: none; }
        .architecture-viewport { box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: auto; overflow-y: hidden; border: 1px solid var(--arch-border); border-radius: 18px; background: var(--arch-paper); scrollbar-width: thin; touch-action: pan-x pan-y; overscroll-behavior-inline: contain; }
        .architecture-viewport:focus-visible { outline: 3px solid var(--accent, var(--arch-ink)); outline-offset: 3px; }
        .architecture-viewport svg { display: block; width: 100%; min-width: 940px; height: auto; }
        .architecture-figure figcaption { margin-top: 0.7rem; color: var(--muted, var(--arch-secondary)); font-size: 0.875rem; line-height: 1.55; }
        .architecture-heading { font: 600 18px system-ui, -apple-system, sans-serif; fill: var(--arch-ink); letter-spacing: -0.02em; }
        .architecture-node-title { font: 650 14px system-ui, -apple-system, sans-serif; fill: var(--arch-ink); letter-spacing: -0.025em; }
        .architecture-node-detail { font: 12px system-ui, -apple-system, sans-serif; fill: var(--arch-secondary); }
        .architecture-pictogram { color: var(--arch-ink); fill: none; stroke: currentColor; stroke-width: 1.85; stroke-linecap: round; stroke-linejoin: round; }
        .architecture-edge-label { font: 600 13px system-ui, -apple-system, sans-serif; fill: var(--arch-connection); paint-order: stroke; stroke: var(--arch-paper); stroke-width: 5px; stroke-linejoin: round; }
        .architecture-read { fill: var(--arch-read); }
        .architecture-write { fill: var(--arch-write); }
        .architecture-sync { fill: var(--arch-sync); }
        .architecture-note { font: 13px system-ui, -apple-system, sans-serif; fill: var(--arch-secondary); }
        .architecture-region-label { font: 700 9px system-ui, -apple-system, sans-serif; letter-spacing: 0.08em; fill: var(--arch-secondary); }
        @container (max-width: 940px) {
          .architecture-scroll-hint { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 0 0 0.5rem; color: var(--muted, var(--arch-secondary)); font: 600 0.76rem system-ui, -apple-system, sans-serif; }
          .architecture-scroll-hint span:last-child { font-size: 1.05rem; }
        }
        @media (prefers-color-scheme: dark) {
          .architecture-figure {
            --arch-paper: #1d1d1f;
            --arch-node: #29292c;
            --arch-node-soft: #323235;
            --arch-node-deep: #3a3a3d;
            --arch-ink: #f1f1f2;
            --arch-secondary: #c5c5c8;
            --arch-stroke: #bcbcc0;
            --arch-connection: #b6b6ba;
            --arch-read: #f0f0f1;
            --arch-write: #d8d8db;
            --arch-sync: #bcbcc0;
            --arch-rule: #57575b;
            --arch-border: #67676c;
            --arch-icon-fill: #1d1d1f;
            --arch-icon-border: #77777b;
            --arch-region-fill: #242427;
          }
        }
        @media (prefers-reduced-motion: reduce) { .architecture-figure *, .architecture-figure *::before, .architecture-figure *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
        @media (prefers-contrast: more) { .architecture-figure { --arch-stroke: var(--arch-ink); --arch-secondary: var(--arch-ink); --arch-border: var(--arch-ink); --arch-icon-border: var(--arch-ink); --arch-connection: var(--arch-ink); --arch-read: var(--arch-ink); --arch-write: var(--arch-ink); --arch-sync: var(--arch-ink); } }
      `}</style>
    </figure>
  );
}
