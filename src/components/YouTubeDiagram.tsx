import { useId } from 'react';

type Kind = 'client' | 'api' | 'storage' | 'queue' | 'worker' | 'manifest' | 'cdn' | 'player' | 'database' | 'metric' | 'policy';
type Node = { x: number; y: number; w: number; title: string; detail: string; kind: Kind };
type Edge = { points: [number, number][]; label?: string; labelAt?: [number, number]; dashed?: boolean };
type Scene = { title: string; description: string; nodes: Node[]; edges: Edge[]; note: string };

// These coordinate data also seed the native editable Excalidraw files.
const scenes: Record<string, Scene> = {
  "youtube-scope": {
    "title": "Find the load behind the video feature",
    "description": "Upload and playback are separate workloads whose bytes, peaks, and retention shape storage, compute, and delivery.",
    "nodes": [
      {"x": 34, "y": 100, "w": 200, "title": "Creators", "detail": "uploads × source size", "kind": "client"},
      {"x": 34, "y": 275, "w": 200, "title": "Viewers", "detail": "plays × bytes", "kind": "player"},
      {"x": 375, "y": 100, "w": 220, "title": "Source + variants", "detail": "storage × retention", "kind": "storage"},
      {"x": 375, "y": 275, "w": 220, "title": "CDN traffic", "detail": "egress × region", "kind": "cdn"},
      {"x": 745, "y": 188, "w": 220, "title": "Capacity decision", "detail": "peak, cost, and risk", "kind": "metric"}
    ],
    "edges": [
      {"points": [[234, 137], [375, 137]], "label": "bytes in", "labelAt": [304, 118]},
      {"points": [[234, 312], [375, 312]], "label": "bytes out", "labelAt": [304, 293]},
      {"points": [[595, 137], [670, 137], [670, 225], [745, 225]]},
      {"points": [[595, 312], [670, 312], [670, 238], [745, 238]]}
    ],
    "note": "One user count is not a traffic or storage estimate."
  },
  "youtube-upload": {
    "title": "Authorize, upload, then verify",
    "description": "The API grants narrow upload access; the client sends bytes to object storage and verification advances the pending record.",
    "nodes": [
      {"x": 40, "y": 169, "w": 185, "title": "Creator", "detail": "resumable parts", "kind": "client"},
      {"x": 305, "y": 86, "w": 195, "title": "Upload API", "detail": "auth + scoped grant", "kind": "api"},
      {"x": 305, "y": 287, "w": 195, "title": "Pending record", "detail": "owner + status", "kind": "database"},
      {"x": 679, "y": 169, "w": 230, "title": "Original storage", "detail": "parts + checksum", "kind": "storage"}
    ],
    "edges": [
      {"points": [[225, 191], [260, 191], [260, 123], [305, 123]], "label": "request grant", "labelAt": [188, 105]},
      {"points": [[402, 160], [402, 287]], "label": "create", "labelAt": [440, 226]},
      {"points": [[225, 229], [679, 229]], "label": "direct upload", "labelAt": [583, 210]},
      {"points": [[794, 244], [794, 347], [500, 347], [500, 325]], "label": "verify / finalize", "labelAt": [641, 369]}
    ],
    "note": "Received original ≠ ready to watch."
  },
  "youtube-pipeline": {
    "title": "Schedule work by dependency",
    "description": "An inspected source enters a queued task graph; independent workers produce renditions and thumbnails before publication.",
    "nodes": [
      {"x": 25, "y": 185, "w": 150, "title": "Original", "detail": "stored source", "kind": "storage"},
      {"x": 212, "y": 185, "w": 150, "title": "Inspect", "detail": "check source", "kind": "worker"},
      {"x": 399, "y": 185, "w": 150, "title": "Task queue", "detail": "leased work", "kind": "queue"},
      {"x": 602, "y": 93, "w": 160, "title": "Encode", "detail": "video + audio", "kind": "worker"},
      {"x": 602, "y": 278, "w": 160, "title": "Thumbnail", "detail": "parallel task", "kind": "worker"},
      {"x": 810, "y": 185, "w": 165, "title": "Outputs", "detail": "verify + publish", "kind": "manifest"}
    ],
    "edges": [
      {"points": [[175, 222], [212, 222]]},
      {"points": [[362, 222], [399, 222]]},
      {"points": [[549, 207], [572, 207], [572, 130], [602, 130]]},
      {"points": [[549, 238], [572, 238], [572, 315], [602, 315]]},
      {"points": [[762, 130], [786, 130], [786, 207], [810, 207]]},
      {"points": [[762, 315], [786, 315], [786, 238], [810, 238]]}
    ],
    "note": "A retry must not create a second visible output."
  },
  "youtube-renditions": {
    "title": "One source, an adaptive ladder",
    "description": "Encode a bounded set of qualities, align their segment boundaries, and list them in a playback manifest.",
    "nodes": [
      {"x": 35, "y": 183, "w": 172, "title": "Source", "detail": "one uploaded file", "kind": "storage"},
      {"x": 279, "y": 86, "w": 185, "title": "High bitrate", "detail": "aligned segments", "kind": "worker"},
      {"x": 279, "y": 183, "w": 185, "title": "Medium bitrate", "detail": "aligned segments", "kind": "worker"},
      {"x": 279, "y": 280, "w": 185, "title": "Low bitrate", "detail": "aligned segments", "kind": "worker"},
      {"x": 608, "y": 183, "w": 175, "title": "Manifest", "detail": "lists renditions", "kind": "manifest"},
      {"x": 821, "y": 183, "w": 154, "title": "Player", "detail": "choose next", "kind": "player"}
    ],
    "edges": [
      {"points": [[207, 205], [246, 205], [246, 123], [279, 123]]},
      {"points": [[207, 220], [279, 220]]},
      {"points": [[207, 238], [246, 238], [246, 317], [279, 317]]},
      {"points": [[464, 123], [540, 123], [540, 202], [608, 202]]},
      {"points": [[464, 220], [608, 220]]},
      {"points": [[464, 317], [540, 317], [540, 238], [608, 238]]},
      {"points": [[783, 220], [821, 220]]}
    ],
    "note": "Quality can change at aligned segment boundaries."
  },
  "youtube-metadata": {
    "title": "Ready is a verified state",
    "description": "Completion verifies stored media before the metadata status changes and a watch request can receive a playback location.",
    "nodes": [
      {"x": 30, "y": 126, "w": 180, "title": "Processing job", "detail": "completion event", "kind": "queue"},
      {"x": 300, "y": 126, "w": 180, "title": "Verify outputs", "detail": "media segments", "kind": "worker"},
      {"x": 595, "y": 126, "w": 180, "title": "Metadata DB", "detail": "processing → ready", "kind": "database"},
      {"x": 595, "y": 288, "w": 180, "title": "Metadata cache", "detail": "refresh or evict", "kind": "database"},
      {"x": 30, "y": 288, "w": 180, "title": "Viewer", "detail": "open watch page", "kind": "player"},
      {"x": 300, "y": 288, "w": 180, "title": "Watch API", "detail": "status + access", "kind": "api"}
    ],
    "edges": [
      {"points": [[210, 163], [300, 163]]},
      {"points": [[480, 163], [595, 163]], "label": "publish", "labelAt": [540, 145]},
      {"points": [[685, 201], [685, 288]]},
      {"points": [[210, 325], [300, 325]]},
      {"points": [[480, 310], [535, 310], [535, 180], [595, 180]], "label": "read", "labelAt": [522, 262]},
      {"points": [[595, 342], [480, 342]], "dashed": true}
    ],
    "note": "An event is not proof that required playback files exist."
  },
  "youtube-playback": {
    "title": "Control through API, bytes through CDN",
    "description": "The API checks access; the player fetches manifest and segments from an edge, which fills misses from origin.",
    "nodes": [
      {"x": 34, "y": 175, "w": 166, "title": "Viewer", "detail": "adaptive player", "kind": "player"},
      {"x": 277, "y": 86, "w": 180, "title": "Watch API", "detail": "metadata + access", "kind": "api"},
      {"x": 277, "y": 270, "w": 180, "title": "CDN edge", "detail": "media segments", "kind": "cdn"},
      {"x": 620, "y": 270, "w": 175, "title": "Origin", "detail": "cache miss", "kind": "storage"},
      {"x": 620, "y": 86, "w": 175, "title": "Metadata DB", "detail": "status + policy", "kind": "database"}
    ],
    "edges": [
      {"points": [[200, 196], [236, 196], [236, 123], [277, 123]], "label": "open page", "labelAt": [191, 105]},
      {"points": [[457, 123], [620, 123]]},
      {"points": [[200, 225], [236, 225], [236, 307], [277, 307]], "label": "play", "labelAt": [214, 288]},
      {"points": [[457, 307], [620, 307]], "label": "miss", "labelAt": [539, 288]},
      {"points": [[620, 331], [457, 331]], "label": "fill", "labelAt": [539, 354]},
      {"points": [[277, 342], [120, 342], [120, 249]], "label": "segments", "labelAt": [199, 365]}
    ],
    "note": "A CDN copy accelerates delivery; origin remains durable."
  },
  "youtube-cost": {
    "title": "Match placement to observed demand",
    "description": "Popularity and geography guide edge caching; cold content may stay at origin with a measured startup tradeoff.",
    "nodes": [
      {"x": 30, "y": 179, "w": 188, "title": "View history", "detail": "popularity × region", "kind": "metric"},
      {"x": 324, "y": 179, "w": 188, "title": "Placement policy", "detail": "latency vs bytes", "kind": "policy"},
      {"x": 651, "y": 96, "w": 220, "title": "Hot → edge", "detail": "fast repeated reads", "kind": "cdn"},
      {"x": 651, "y": 275, "w": 220, "title": "Cold → origin", "detail": "lower cost, slower start", "kind": "storage"}
    ],
    "edges": [
      {"points": [[218, 216], [324, 216]]},
      {"points": [[512, 201], [566, 201], [566, 133], [651, 133]], "label": "popular", "labelAt": [606, 115]},
      {"points": [[512, 235], [566, 235], [566, 312], [651, 312]], "label": "rare", "labelAt": [606, 297]}
    ],
    "note": "Re-evaluate placement when a cold video becomes hot."
  },
  "youtube-operations": {
    "title": "Observe, recover, and remove across paths",
    "description": "Independent upload and watch signals reach operations; takedown must affect metadata, authorization, and edge copies.",
    "nodes": [
      {"x": 30, "y": 105, "w": 185, "title": "Upload path", "detail": "queue age + success", "kind": "storage"},
      {"x": 30, "y": 280, "w": 185, "title": "Watch path", "detail": "startup + buffering", "kind": "player"},
      {"x": 346, "y": 193, "w": 190, "title": "Operations", "detail": "alerts + traces", "kind": "metric"},
      {"x": 682, "y": 105, "w": 245, "title": "Recover", "detail": "retry, replay, restore", "kind": "worker"},
      {"x": 682, "y": 280, "w": 245, "title": "Remove access", "detail": "metadata + CDN purge", "kind": "policy"}
    ],
    "edges": [
      {"points": [[215, 142], [274, 142], [274, 215], [346, 215]]},
      {"points": [[215, 317], [274, 317], [274, 245], [346, 245]]},
      {"points": [[536, 215], [612, 215], [612, 142], [682, 142]]},
      {"points": [[536, 245], [612, 245], [612, 317], [682, 317]]}
    ],
    "note": "Removing a DB row alone does not invalidate cached media."
  }
};

function Icon({ kind, x, y }: { kind: Kind; x: number; y: number }) {
  const common = { fill: 'none', stroke: 'var(--yt-ink)', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <g transform={`translate(${x} ${y})`} aria-hidden="true" {...common}>
    {kind === 'client' && <><rect x="3" y="4" width="22" height="15" rx="2"/><path d="M1 22h26l-3-3H4z"/></>}
    {kind === 'player' && <><rect x="2" y="3" width="24" height="21" rx="4"/><path d="m11 8 9 5.5-9 5.5z"/></>}
    {kind === 'api' && <><rect x="3" y="3" width="22" height="7" rx="2"/><rect x="3" y="14" width="22" height="7" rx="2"/><path d="M7 6.5h3M7 17.5h3"/></>}
    {kind === 'database' && <><ellipse cx="14" cy="6" rx="11" ry="4"/><path d="M3 6v15c0 2 5 4 11 4s11-2 11-4V6M3 13c0 2 5 4 11 4s11-2 11-4"/></>}
    {kind === 'storage' && <><path d="M3 8h22l-2 16H5zM7 8V4h14v4M10 14h8"/></>}
    {kind === 'queue' && <><rect x="4" y="3" width="20" height="5" rx="1"/><rect x="4" y="11" width="20" height="5" rx="1"/><rect x="4" y="19" width="20" height="5" rx="1"/></>}
    {kind === 'worker' && <><circle cx="14" cy="14" r="9"/><circle cx="14" cy="14" r="3"/><path d="M14 1v4M14 23v4M1 14h4M23 14h4M5 5l3 3M20 20l3 3M5 23l3-3M20 8l3-3"/></>}
    {kind === 'manifest' && <><path d="M6 2h11l5 5v19H6zM17 2v6h5M9 13h10M9 18h10M9 23h7"/></>}
    {kind === 'cdn' && <><circle cx="14" cy="14" r="11"/><path d="M3 14h22M14 3c-7 5-7 17 0 22M14 3c7 5 7 17 0 22M5 8h18M5 20h18"/></>}
    {kind === 'metric' && <><path d="M3 24V4M3 24h23M7 19l5-6 4 3 7-9"/><circle cx="23" cy="7" r="1" fill="var(--yt-ink)"/></>}
    {kind === 'policy' && <><path d="M14 2 24 6v8c0 6-4 10-10 13C8 24 4 20 4 14V6zM9 14l3 3 7-7"/></>}
  </g>;
}

function YouTubeScene({ scene, className }: { scene: Scene; className?: string }) {
  const key = useId().replace(/:/g, '');
  const arrow = `${key}-arrow`;
  const title = `${key}-title`;
  const description = `${key}-description`;
  const hint = `${key}-hint`;
  return <figure className={["youtube-figure", className].filter(Boolean).join(' ')}>
    <div id={hint} className="youtube-scroll-hint">Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="youtube-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hint}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${title} ${description}`}>
        <title id={title}>{scene.title}</title><desc id={description}>{scene.description}</desc>
        <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--yt-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--yt-paper)"/>
        <text x="28" y="35" className="youtube-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--yt-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge, index) => <g key={`edge-${index}`}><path d={edge.points.map(([x,y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')} fill="none" stroke="var(--yt-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={edge.dashed ? '4 5' : undefined} markerEnd={`url(#${arrow})`}/>{edge.label && edge.labelAt && <text x={edge.labelAt[0]} y={edge.labelAt[1]} textAnchor="middle" className="youtube-link-label">{edge.label}</text>}</g>)}
        {scene.nodes.map((node, index) => <g key={`node-${index}`}><rect x={node.x} y={node.y} width={node.w} height="74" rx="14" fill="var(--yt-card)" stroke="var(--yt-border)" strokeWidth="1.5"/><rect x={node.x+11} y={node.y+18} width="37" height="37" rx="9" fill="var(--yt-icon-bg)" stroke="var(--yt-rule)"/><Icon kind={node.kind} x={node.x+15} y={node.y+22}/><text x={node.x+58} y={node.y+32} className="youtube-node-title">{node.title}</text><text x={node.x+58} y={node.y+53} className="youtube-node-detail">{node.detail}</text></g>)}
        <text x="28" y="430" className="youtube-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .youtube-figure { --yt-paper:#fff; --yt-card:#f6f6f7; --yt-icon-bg:#fff; --yt-ink:#252527; --yt-muted:#55555a; --yt-border:#99999d; --yt-line:#55555a; --yt-rule:#dadadd; margin:0; min-width:0; max-width:100%; color:var(--yt-ink); container-type:inline-size; }
      .youtube-scroll-hint { display:none; }
      .youtube-viewport { box-sizing:border-box; width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; border:1px solid var(--yt-rule); border-radius:18px; background:var(--yt-paper); scrollbar-width:thin; touch-action:pan-x pan-y; overscroll-behavior-inline:contain; }
      .youtube-viewport:focus-visible { outline:3px solid var(--accent, var(--yt-ink)); outline-offset:3px; }
      .youtube-viewport svg { display:block; width:100%; min-width:940px; height:auto; }
      .youtube-figure figcaption { margin-top:.7rem; color:var(--muted, var(--yt-muted)); font-size:.875rem; line-height:1.55; }
      .youtube-heading { font:650 18px system-ui,-apple-system,sans-serif; fill:var(--yt-ink); letter-spacing:-.02em; }
      .youtube-node-title { font:650 13px system-ui,-apple-system,sans-serif; fill:var(--yt-ink); letter-spacing:-.025em; }
      .youtube-node-detail { font:11px system-ui,-apple-system,sans-serif; fill:var(--yt-muted); }
      .youtube-link-label { font:600 11px system-ui,-apple-system,sans-serif; fill:var(--yt-line); paint-order:stroke; stroke:var(--yt-paper); stroke-width:5px; stroke-linejoin:round; }
      .youtube-note { font:13px system-ui,-apple-system,sans-serif; fill:var(--yt-muted); }
      @container (max-width:940px) { .youtube-scroll-hint { display:flex; justify-content:space-between; gap:1rem; margin:0 0 .5rem; color:var(--muted, var(--yt-muted)); font:600 .76rem system-ui,-apple-system,sans-serif; } }
      @media (prefers-color-scheme:dark) { .youtube-figure { --yt-paper:#1d1d1f; --yt-card:#303033; --yt-icon-bg:#242427; --yt-ink:#f1f1f2; --yt-muted:#c6c6ca; --yt-border:#aaaab0; --yt-line:#bdbdc2; --yt-rule:#57575c; } }
      @media (prefers-contrast:more) { .youtube-figure { --yt-muted:var(--yt-ink); --yt-border:var(--yt-ink); --yt-line:var(--yt-ink); --yt-rule:var(--yt-ink); } }
    `}</style>
  </figure>;
}

export function YouTubeDiagram({ id, className }: { id: string; className?: string }) {
  const scene = scenes[id];
  if (!scene) return null;
  return <YouTubeScene scene={scene} className={className}/>;
}
