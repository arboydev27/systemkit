import { useId } from "react";

type NodeKind = "person" | "network" | "server" | "database" | "cache" | "queue" | "storage";
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
      { id: "visitor", x: 55, y: 193, width: 138, title: "Visitor", detail: "browser", kind: "person" },
      { id: "dns", x: 288, y: 86, width: 145, title: "DNS", detail: "domain → IP", kind: "network" },
      { id: "server", x: 592, y: 193, width: 235, title: "One server", detail: "web app + database", kind: "server" },
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
      { id: "visitor", x: 44, y: 183, width: 138, title: "Visitor", detail: "browser", kind: "person" },
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
      { id: "visitors", x: 28, y: 203, width: 148, title: "Visitors", detail: "many requests", kind: "person" },
      { id: "balancer", x: 260, y: 203, width: 168, title: "Load balancer", detail: "healthy routes", kind: "network" },
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
      "A CDN serves nearby copies of static assets such as images. Dynamic requests reach the web server, which checks an application cache before querying the database on a cache miss.",
    nodes: [
      { id: "visitors", x: 24, y: 205, width: 145, title: "Visitors", detail: "browser", kind: "person" },
      { id: "cdn", x: 242, y: 88, width: 164, title: "CDN edge", detail: "static assets", kind: "cache" },
      { id: "web", x: 242, y: 302, width: 164, title: "Web tier", detail: "dynamic pages", kind: "server" },
      { id: "origin", x: 677, y: 88, width: 190, title: "Origin", detail: "source assets", kind: "storage" },
      { id: "cache", x: 487, y: 302, width: 166, title: "App cache", detail: "hot data", kind: "cache" },
      { id: "db", x: 755, y: 302, width: 160, title: "Database", detail: "source of truth", kind: "database" },
    ],
    connections: [
      { points: [[169, 226], [202, 226], [202, 116], [242, 116]], label: "assets", labelAt: [207, 156] },
      { points: [[169, 241], [202, 241], [202, 330], [242, 330]], label: "data", labelAt: [201, 300] },
      { points: [[406, 116], [677, 116]], label: "miss → fetch", labelAt: [540, 92] },
      { points: [[406, 330], [487, 330]], tone: "read", label: "check", labelAt: [446, 309] },
      { points: [[653, 330], [755, 330]], tone: "read", label: "miss", labelAt: [702, 309] },
    ],
    note: "A CDN reduces distance; an app cache reduces repeated database work.",
  },
  stateless: {
    title: "Keep sessions outside web servers",
    summary:
      "The load balancer can send each request to any web server. Both web servers use a shared session store, so a visitor stays signed in even when requests move between servers.",
    nodes: [
      { id: "visitor", x: 20, y: 205, width: 135, title: "Visitor", detail: "signed in", kind: "person" },
      { id: "balancer", x: 213, y: 205, width: 168, title: "Load balancer", kind: "network" },
      { id: "web-a", x: 460, y: 94, width: 153, title: "Web A", detail: "stateless", kind: "server" },
      { id: "web-b", x: 460, y: 310, width: 153, title: "Web B", detail: "stateless", kind: "server" },
      { id: "session", x: 748, y: 205, width: 205, title: "Session store", detail: "shared state", kind: "cache" },
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
      "GeoDNS directs a visitor toward a healthy, nearby data center. Each region has a web tier and data. Cross-region data replication keeps regions coordinated, though failover also needs careful traffic and data planning.",
    nodes: [
      { id: "visitors", x: 22, y: 203, width: 132, title: "Visitors", detail: "worldwide", kind: "person" },
      { id: "geodns", x: 212, y: 203, width: 150, title: "GeoDNS", detail: "region routing", kind: "network" },
      { id: "us-web", x: 474, y: 83, width: 170, title: "Region A", detail: "web tier", kind: "server" },
      { id: "us-db", x: 746, y: 83, width: 172, title: "Data A", detail: "regional data", kind: "database" },
      { id: "eu-web", x: 474, y: 320, width: 170, title: "Region B", detail: "web tier", kind: "server" },
      { id: "eu-db", x: 746, y: 320, width: 172, title: "Data B", detail: "regional data", kind: "database" },
    ],
    connections: [
      { points: [[154, 231], [212, 231]] },
      { points: [[362, 231], [419, 231], [419, 111], [474, 111]], label: "near / healthy", labelAt: [430, 160] },
      { points: [[362, 231], [419, 231], [419, 348], [474, 348]] },
      { points: [[644, 111], [746, 111]], tone: "read" },
      { points: [[644, 348], [746, 348]], tone: "read" },
      { points: [[832, 139], [832, 320]], tone: "sync", label: "data sync", labelAt: [854, 230], dashed: true, arrow: false },
    ],
    note: "A regional outage should route people to a healthy region.",
  },
  queue: {
    title: "Move slow work out of the request",
    summary:
      "The web tier accepts an upload and enqueues image processing. A worker takes the job asynchronously and saves processed images to object storage. The queue absorbs bursts when workers are busy.",
    nodes: [
      { id: "visitor", x: 15, y: 205, width: 138, title: "Visitor", detail: "uploads photo", kind: "person" },
      { id: "web", x: 209, y: 205, width: 155, title: "Web tier", detail: "accept upload", kind: "server" },
      { id: "queue", x: 425, y: 205, width: 155, title: "Job queue", detail: "pending work", kind: "queue" },
      { id: "worker-a", x: 647, y: 101, width: 147, title: "Worker A", detail: "resize", kind: "server" },
      { id: "worker-b", x: 647, y: 309, width: 147, title: "Worker B", detail: "resize", kind: "server" },
      { id: "storage", x: 831, y: 205, width: 150, title: "Storage", detail: "images", kind: "storage" },
    ],
    connections: [
      { points: [[153, 233], [209, 233]] },
      { points: [[364, 233], [425, 233]], tone: "write", label: "publish", labelAt: [396, 210] },
      { points: [[580, 233], [613, 233], [613, 129], [647, 129]], label: "consume", labelAt: [622, 165] },
      { points: [[580, 233], [613, 233], [613, 337], [647, 337]] },
      { points: [[794, 129], [813, 129], [813, 233], [831, 233]], tone: "write" },
      { points: [[794, 337], [813, 337], [813, 248], [831, 248]], tone: "write" },
    ],
    note: "The upload request can finish before processing finishes.",
  },
  sharding: {
    title: "Divide data by a stable key",
    summary:
      "The application uses a user's ID to choose one of three database shards. Each shard stores a different portion of users and accepts reads and writes for that portion. Shards are partitions, unlike replicas, which copy the same data.",
    nodes: [
      { id: "web", x: 32, y: 208, width: 165, title: "Web tier", detail: "request", kind: "server" },
      { id: "router", x: 274, y: 208, width: 185, title: "Shard router", detail: "hash user ID", kind: "network" },
      { id: "shard-0", x: 721, y: 60, width: 202, title: "Shard 0", detail: "users 0, 3, 6…", kind: "database" },
      { id: "shard-1", x: 721, y: 206, width: 202, title: "Shard 1", detail: "users 1, 4, 7…", kind: "database" },
      { id: "shard-2", x: 721, y: 352, width: 202, title: "Shard 2", detail: "users 2, 5, 8…", kind: "database" },
    ],
    connections: [
      { points: [[197, 236], [274, 236]] },
      { points: [[459, 227], [550, 227], [550, 88], [721, 88]], label: "key % 3 = 0", labelAt: [640, 67] },
      { points: [[459, 236], [721, 234]], label: "key % 3 = 1", labelAt: [590, 213] },
      { points: [[459, 246], [550, 246], [550, 380], [721, 380]], label: "key % 3 = 2", labelAt: [640, 403] },
    ],
    note: "Each shard holds different records; distribution quality depends on the key.",
  },
};

const palette: Record<NodeKind, { fill: string; border: string }> = {
  person: { fill: "var(--arch-paper)", border: "var(--arch-stroke)" },
  network: { fill: "var(--arch-node-soft)", border: "var(--arch-stroke)" },
  server: { fill: "var(--arch-node)", border: "var(--arch-stroke)" },
  database: { fill: "var(--arch-node-deep)", border: "var(--arch-stroke)" },
  cache: { fill: "var(--arch-node-soft)", border: "var(--arch-stroke)" },
  queue: { fill: "var(--arch-node-deep)", border: "var(--arch-stroke)" },
  storage: { fill: "var(--arch-node)", border: "var(--arch-stroke)" },
};

const lineColors: Record<Tone, string> = {
  request: "var(--arch-connection)",
  read: "var(--arch-read)",
  write: "var(--arch-write)",
  sync: "var(--arch-sync)",
};

function HandDrawnNode({ node }: { node: Node }) {
  const { x, y, width, title, detail, kind } = node;
  const height = 58;
  const colors = palette[kind];
  const outline = `M ${x + 10} ${y + 1} L ${x + width - 8} ${y + 2} Q ${x + width + 1} ${y + 3} ${x + width} ${y + 11} L ${x + width - 1} ${y + height - 8} Q ${x + width - 2} ${y + height + 1} ${x + width - 11} ${y + height} L ${x + 8} ${y + height - 1} Q ${x - 1} ${y + height - 2} ${x} ${y + height - 10} L ${x + 1} ${y + 9} Q ${x + 2} ${y + 1} ${x + 10} ${y + 1} Z`;

  return (
    <g>
      <path d={outline} fill={colors.fill} stroke={colors.border} strokeWidth="2" strokeLinejoin="round" strokeDasharray={kind === "network" ? "7 4" : undefined} />
      <path
        d={`M ${x + 12} ${y + 4} L ${x + width - 10} ${y + 5} M ${x + 4} ${y + 13} L ${x + 4} ${y + height - 12}`}
        fill="none"
        stroke={colors.border}
        strokeOpacity="0.44"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <text x={x + width / 2} y={y + (detail ? 27 : 36)} textAnchor="middle" className="architecture-node-title">
        {title}
      </text>
      {detail && (
        <text x={x + width / 2} y={y + 45} textAnchor="middle" className="architecture-node-detail">
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
          margin: 0; min-width: 0; max-width: 100%; color: var(--arch-ink); container-type: inline-size;
        }
        .architecture-scroll-hint { display: none; }
        .architecture-viewport { box-sizing: border-box; width: 100%; max-width: 100%; overflow-x: auto; overflow-y: hidden; border: 1px solid var(--arch-border); border-radius: 18px; background: var(--arch-paper); scrollbar-width: thin; touch-action: pan-x pan-y; overscroll-behavior-inline: contain; }
        .architecture-viewport:focus-visible { outline: 3px solid var(--accent, var(--arch-ink)); outline-offset: 3px; }
        .architecture-viewport svg { display: block; width: 100%; min-width: 960px; height: auto; }
        .architecture-figure figcaption { margin-top: 0.7rem; color: var(--muted, var(--arch-secondary)); font-size: 0.875rem; line-height: 1.55; }
        .architecture-heading { font: 600 18px system-ui, -apple-system, sans-serif; fill: var(--arch-ink); letter-spacing: -0.02em; }
        .architecture-node-title { font: 650 16px system-ui, -apple-system, sans-serif; fill: var(--arch-ink); letter-spacing: -0.015em; }
        .architecture-node-detail { font: 13px system-ui, -apple-system, sans-serif; fill: var(--arch-secondary); }
        .architecture-edge-label { font: 600 13px system-ui, -apple-system, sans-serif; fill: var(--arch-connection); paint-order: stroke; stroke: var(--arch-paper); stroke-width: 5px; stroke-linejoin: round; }
        .architecture-read { fill: var(--arch-read); }
        .architecture-write { fill: var(--arch-write); }
        .architecture-sync { fill: var(--arch-sync); }
        .architecture-note { font: 13px system-ui, -apple-system, sans-serif; fill: var(--arch-secondary); }
        @container (max-width: 760px) {
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
          }
        }
        @media (prefers-reduced-motion: reduce) { .architecture-figure *, .architecture-figure *::before, .architecture-figure *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
        @media (prefers-contrast: more) { .architecture-figure { --arch-stroke: var(--arch-ink); --arch-secondary: var(--arch-ink); --arch-border: var(--arch-ink); --arch-connection: var(--arch-ink); --arch-read: var(--arch-ink); --arch-write: var(--arch-ink); --arch-sync: var(--arch-ink); } }
      `}</style>
    </figure>
  );
}
