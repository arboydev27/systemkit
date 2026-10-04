import { useId } from 'react';

type Kind = 'browser' | 'api' | 'store' | 'cache' | 'key' | 'clock' | 'shield' | 'metrics';
type Node = { x: number; y: number; w: number; title: string; detail: string; kind: Kind };
type Edge = { points: [number, number][]; label?: string; labelAt?: [number, number]; dashed?: boolean };
type Scene = { title: string; description: string; note: string; nodes: Node[]; edges: Edge[] };
const n = (x: number, y: number, w: number, title: string, detail: string, kind: Kind): Node => ({ x, y, w, title, detail, kind });
const e = (points: [number, number][], label?: string, labelAt?: [number, number], dashed?: boolean): Edge => ({ points, label, labelAt, dashed });

const scenes: Record<string, Scene> = {
  'url-scope': {
    title: 'Two actions, different workloads',
    description: 'Creation writes a durable short-to-long mapping. Many more visits read that mapping and redirect to the destination.',
    note: 'Example average: 1,160 creations/s · 11,600 redirects/s · plan for peaks.',
    nodes: [n(35, 110, 205, 'Creator', 'submits a long URL', 'browser'), n(378, 110, 235, 'Shortener', 'creates a new key', 'api'), n(750, 110, 215, 'Mapping', 'key → destination', 'store'), n(35, 277, 205, 'Visitor', 'opens a short URL', 'browser'), n(378, 277, 235, 'Redirect service', 'resolves the key', 'api'), n(750, 277, 215, 'Destination', 'receives the visitor', 'browser')],
    edges: [e([[240, 147], [378, 147]], 'create', [309, 129]), e([[613, 147], [750, 147]], 'persist', [682, 129]), e([[240, 314], [378, 314]], 'open', [309, 297]), e([[613, 314], [750, 314]], 'redirect', [682, 297]), e([[857, 191], [857, 238], [495, 238], [495, 277]], 'read mapping', [697, 229], true)],
  },
  'url-contract': {
    title: 'Creation and lookup share one durable record',
    description: 'POST validates and persists a unique key before returning it; GET finds that key and returns an HTTP redirect.',
    note: 'Record: key · destination · created_at · optional expires_at.',
    nodes: [n(35, 112, 205, 'POST /links', 'destination URL', 'browser'), n(363, 112, 245, 'Validate + assign', 'scheme · key · policy', 'api'), n(733, 112, 230, 'Unique record', 'atomic insert', 'store'), n(35, 278, 205, 'GET /{key}', 'visitor request', 'browser'), n(363, 278, 245, 'Find mapping', 'key lookup', 'api'), n(733, 278, 230, 'Location header', 'redirect response', 'browser')],
    edges: [e([[240, 149], [363, 149]]), e([[608, 149], [733, 149]], 'store first', [671, 132]), e([[240, 315], [363, 315]]), e([[608, 315], [733, 315]], 'respond', [671, 298]), e([[848, 190], [848, 242], [485, 242], [485, 278]], 'look up', [690, 233], true)],
  },
  'url-redirect': {
    title: 'Resolve, check lifetime, then redirect',
    description: 'A key lookup checks expiry before returning Location. Unknown or expired links take an error path instead.',
    note: '301 may be reused by clients; 302 better fits changeable links and later click observation.',
    nodes: [n(33, 174, 200, 'Visitor', 'GET /{key}', 'browser'), n(293, 174, 205, 'Lookup', 'load key record', 'store'), n(555, 174, 205, 'Expiry check', 'active or expired?', 'clock'), n(814, 95, 153, 'Redirect', 'Location header', 'browser'), n(814, 278, 153, 'Error', '404 or 410', 'shield')],
    edges: [e([[233, 211], [293, 211]]), e([[498, 211], [555, 211]]), e([[760, 195], [782, 195], [782, 132], [814, 132]], 'active', [780, 113]), e([[760, 228], [782, 228], [782, 315], [814, 315]], 'missing / expired', [810, 269])],
  },
  'url-keys': {
    title: 'Reserve a key atomically',
    description: 'An allocator or random generator proposes a base62 key. The database unique constraint accepts one owner or triggers a retry.',
    note: 'Seven base62 characters offer about 3.52 trillion combinations; uniqueness still needs enforcement.',
    nodes: [n(31, 174, 205, 'New link', 'validated destination', 'browser'), n(294, 174, 221, 'Generate key', 'ID→base62 or random', 'key'), n(574, 174, 216, 'Unique insert', 'database constraint', 'store'), n(830, 101, 140, 'Accepted', 'return link', 'api'), n(830, 278, 140, 'Collision', 'try a new key', 'shield')],
    edges: [e([[236, 211], [294, 211]]), e([[515, 211], [574, 211]]), e([[790, 195], [812, 195], [812, 138], [830, 138]], 'success', [815, 116]), e([[790, 228], [812, 228], [812, 315], [830, 315]], 'conflict', [812, 268]), e([[830, 342], [703, 342], [703, 384], [403, 384], [403, 248]], 'retry', [546, 376], true)],
  },
  'url-scale': {
    title: 'Read through the cache, then durable storage',
    description: 'A redirect server checks its mapping cache first. On a miss it reads the database, fills the cache, and returns the redirect.',
    note: 'A new link must be visible on its first read; replica lag and negative caching can break that promise.',
    nodes: [n(28, 174, 185, 'Visitor', 'opens short link', 'browser'), n(272, 174, 190, 'Redirect tier', 'stateless servers', 'api'), n(526, 100, 194, 'Mapping cache', 'hot keys', 'cache'), n(526, 280, 194, 'Database', 'durable mapping', 'store'), n(785, 174, 182, 'Destination', 'Location: URL', 'browser')],
    edges: [e([[213, 211], [272, 211]]), e([[462, 193], [488, 193], [488, 137], [526, 137]], 'read / fill', [507, 113]), e([[526, 159], [508, 159], [508, 224], [462, 224]], 'hit', [483, 174]), e([[462, 231], [488, 231], [488, 317], [526, 317]], 'miss', [501, 285]), e([[526, 302], [509, 302], [509, 242], [462, 242]], 'read', [500, 263]), e([[462, 218], [750, 218], [750, 211], [785, 211]], 'redirect', [751, 195])],
  },
  'url-operations': {
    title: 'Keep the redirect path reliable',
    description: 'Validation and rate limits protect creation. Redirects depend on mappings, while analytics is an asynchronous side path.',
    note: 'Watch errors · latency · cache hit rate · storage pressure · abuse reports.',
    nodes: [n(34, 109, 191, 'Creation', 'new destination', 'browser'), n(293, 109, 214, 'Guardrails', 'validate · rate limit', 'shield'), n(573, 109, 191, 'Durable store', 'confirm write', 'store'), n(34, 279, 191, 'Visitor', 'open existing link', 'browser'), n(293, 279, 214, 'Redirect tier', 'serve mapping', 'api'), n(573, 279, 191, 'Analytics queue', 'best-effort event', 'metrics'), n(809, 279, 157, 'Destination', 'visit continues', 'browser')],
    edges: [e([[225, 146], [293, 146]]), e([[507, 146], [573, 146]]), e([[225, 316], [293, 316]]), e([[507, 304], [573, 304]], 'event', [540, 287], true), e([[507, 328], [538, 328], [538, 383], [787, 383], [787, 316], [809, 316]], 'redirect', [752, 374]), e([[669, 190], [669, 244], [401, 244], [401, 279]], 'lookup', [542, 237], true)],
  },
};

const icons: Record<Kind, React.ReactNode> = {
  browser: <><rect x="4" y="5" width="24" height="17" rx="2" /><path d="M2 26h28M12 22v4m8-4v4" /></>,
  api: <><rect x="5" y="5" width="22" height="22" rx="3" /><path d="M10 11h12M10 16h12M10 21h8" /></>,
  store: <><ellipse cx="16" cy="7" rx="11" ry="4" /><path d="M5 7v18c0 5 22 5 22 0V7M5 16c0 5 22 5 22 0" /></>,
  cache: <><rect x="6" y="6" width="20" height="20" rx="3" /><path d="M12 2v4m8-4v4M12 26v4m8-4v4M2 12h4m-4 8h4m20-8h4m-4 8h4M12 16h8" /></>,
  key: <><circle cx="11" cy="12" r="6" /><path d="M16 16l12 12m-4-4 3-3m-7-1 3-3" /></>,
  clock: <><circle cx="16" cy="16" r="12" /><path d="M16 8v8l6 3" /></>,
  shield: <><path d="M16 2 28 7v8c0 7-5 12-12 15C9 27 4 22 4 15V7zM11 16l4 4 7-8" /></>,
  metrics: <><path d="M4 26V6h24M9 21l5-6 4 3 7-9" /><circle cx="25" cy="9" r="1" /></>,
};

function NodeShape({ node }: { node: Node }) {
  return <g>
    <rect x={node.x} y={node.y} width={node.w} height="74" rx="14" fill="var(--url-card)" stroke="var(--url-border)" strokeWidth="1.5" />
    <rect x={node.x + 12} y={node.y + 15} width="43" height="43" rx="11" fill="var(--url-icon-bg)" stroke="var(--url-rule)" />
    <g transform={`translate(${node.x + 17.5} ${node.y + 20.5}) scale(1)`} fill="none" stroke="var(--url-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[node.kind]}</g>
    <text x={node.x + 67} y={node.y + 31} className="url-node-title">{node.title}</text>
    <text x={node.x + 67} y={node.y + 52} className="url-node-detail">{node.detail}</text>
  </g>;
}

function EdgeShape({ edge, markerId }: { edge: Edge; markerId: string }) {
  return <g>
    <path d={edge.points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} fill="none" stroke="var(--url-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={edge.dashed ? '4 5' : undefined} markerEnd={`url(#${markerId})`} />
    {edge.label && edge.labelAt && <text x={edge.labelAt[0]} y={edge.labelAt[1]} textAnchor="middle" className="url-edge-label">{edge.label}</text>}
  </g>;
}

export function UrlShortenerDiagram({ id, className }: { id: string; className?: string }) {
  const scene = scenes[id];
  if (!scene) return null;
  return <SceneFigure scene={scene} className={className} />;
}

function SceneFigure({ scene, className }: { scene: Scene; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const titleId = `${uid}-title`, descriptionId = `${uid}-description`, hintId = `${uid}-hint`, markerId = `${uid}-arrow`;
  return <figure className={['url-figure', className].filter(Boolean).join(' ')}>
    <div id={hintId} className="url-scroll-hint"><span>Swipe or scroll to explore the full diagram</span><span aria-hidden="true">→</span></div>
    <div className="url-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descriptionId}>{scene.description}</desc>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--url-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--url-paper)" />
        <text x="28" y="35" className="url-heading">{scene.title}</text><path d="M28 51H972" stroke="var(--url-rule)" strokeDasharray="3 7" />
        {scene.edges.map((edge, i) => <EdgeShape key={i} edge={edge} markerId={markerId} />)}
        {scene.nodes.map((node, i) => <NodeShape key={i} node={node} />)}
        <text x="28" y="430" className="url-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .url-figure { --url-paper:#fff; --url-card:#f7f7f8; --url-icon-bg:#fff; --url-ink:#222; --url-secondary:#505050; --url-border:#777; --url-line:#555; --url-rule:#d5d5d5; margin:0; min-width:0; max-width:100%; color:var(--url-ink); container-type:inline-size; }
      .url-scroll-hint { display:none; }
      .url-viewport { box-sizing:border-box; width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; border:1px solid var(--url-rule); border-radius:18px; background:var(--url-paper); scrollbar-width:thin; touch-action:pan-x pan-y; overscroll-behavior-inline:contain; }
      .url-viewport:focus-visible { outline:3px solid var(--accent, var(--url-ink)); outline-offset:3px; }
      .url-viewport svg { display:block; width:100%; min-width:940px; height:auto; }
      .url-figure figcaption { margin-top:.7rem; color:var(--muted, var(--url-secondary)); font-size:.875rem; line-height:1.55; }
      .url-heading { font:600 18px system-ui,-apple-system,sans-serif; fill:var(--url-ink); letter-spacing:-.02em; }
      .url-node-title { font:650 13px system-ui,-apple-system,sans-serif; fill:var(--url-ink); letter-spacing:-.02em; }
      .url-node-detail { font:11.5px system-ui,-apple-system,sans-serif; fill:var(--url-secondary); }
      .url-edge-label { font:600 11px system-ui,-apple-system,sans-serif; fill:var(--url-line); paint-order:stroke; stroke:var(--url-paper); stroke-width:5px; stroke-linejoin:round; }
      .url-note { font:12.5px system-ui,-apple-system,sans-serif; fill:var(--url-secondary); }
      @container (max-width:940px) { .url-scroll-hint { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:0 0 .5rem; color:var(--muted, var(--url-secondary)); font:600 .76rem system-ui,-apple-system,sans-serif; } .url-scroll-hint span:last-child { font-size:1.05rem; } }
      @media (prefers-color-scheme:dark) { .url-figure { --url-paper:#1d1d1f; --url-card:#29292c; --url-icon-bg:#353539; --url-ink:#f1f1f2; --url-secondary:#c5c5c8; --url-border:#a9a9ad; --url-line:#b6b6ba; --url-rule:#57575b; } }
      @media (prefers-contrast:more) { .url-figure { --url-secondary:var(--url-ink); --url-border:var(--url-ink); --url-line:var(--url-ink); --url-rule:var(--url-ink); } }
    `}</style>
  </figure>;
}
