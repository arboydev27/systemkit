import { useId } from 'react';
import scenes from '../content/drive-diagrams.json';

type Kind = 'device' | 'api' | 'database' | 'storage' | 'check' | 'shield' | 'bell' | 'version' | 'metric' | 'worker';
type Node = { x: number; y: number; w: number; title: string; detail: string; kind: Kind };
type Edge = { from: number[]; to: number[]; label: string };
type Scene = { title: string; description: string; note: string; nodes: Node[]; edges: Edge[] };

function Icon({ kind, x, y }: { kind: Kind; x: number; y: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <g transform={`translate(${x} ${y})`} className="drive-icon" aria-hidden="true">
    {kind === 'device' && <><rect x="4" y="2" width="20" height="25" rx="3" {...p}/><path d="M9 22h10" {...p}/></>}
    {kind === 'api' && <><rect x="3" y="4" width="22" height="7" rx="2" {...p}/><rect x="3" y="16" width="22" height="7" rx="2" {...p}/><path d="M7 7h3M7 19h3" {...p}/></>}
    {kind === 'database' && <><ellipse cx="14" cy="6" rx="10" ry="4" {...p}/><path d="M4 6v16c0 5 20 5 20 0V6M4 14c0 5 20 5 20 0" {...p}/></>}
    {kind === 'storage' && <><path d="M3 8h22l-2 17H5zM7 8V4h14v4M10 15h8" {...p}/></>}
    {kind === 'check' && <><circle cx="14" cy="14" r="11" {...p}/><path d="m8 14 4 4 8-9" {...p}/></>}
    {kind === 'shield' && <><path d="M14 2 24 6v8c0 6-4 10-10 13C8 24 4 20 4 14V6zM9 14l3 3 7-7" {...p}/></>}
    {kind === 'bell' && <><path d="M6 19h16l-3-4V10a5 5 0 0 0-10 0v5zM11 23a3 3 0 0 0 6 0" {...p}/></>}
    {kind === 'version' && <><path d="M6 2h11l5 5v19H6zM17 2v6h5M9 13h10M9 18h10M9 23h7" {...p}/></>}
    {kind === 'metric' && <><path d="M3 24V4M3 24h23M7 19l5-6 4 3 7-9" {...p}/><circle cx="23" cy="7" r="1" fill="currentColor"/></>}
    {kind === 'worker' && <><circle cx="14" cy="14" r="9" {...p}/><circle cx="14" cy="14" r="3" {...p}/><path d="M14 1v4M14 23v4M1 14h4M23 14h4" {...p}/></>}
  </g>;
}

export function GoogleDriveDiagram({ id, className }: { id: string; className?: string }) {
  const scene = (scenes as Record<string, Scene>)[id];
  const unique = useId().replace(/:/g, '');
  if (!scene) return null;
  const titleId = `${unique}-title`, descId = `${unique}-desc`, hintId = `${unique}-hint`, arrowId = `${unique}-arrow`;
  return <figure className={['drive-figure', className].filter(Boolean).join(' ')}>
    <div className="drive-scroll-hint" id={hintId}>Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="drive-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 430" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descId}>{scene.description}</desc>
        <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--drive-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="430" rx="18" fill="var(--drive-paper)"/>
        <text x="28" y="35" className="drive-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--drive-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge, i) => { const [x1, y1] = edge.from, [x2, y2] = edge.to; return <g key={i}><path d={`M${x1} ${y1} L${x2} ${y2}`} fill="none" stroke="var(--drive-line)" strokeWidth="2" strokeLinecap="round" markerEnd={`url(#${arrowId})`}/><text x={(x1+x2)/2} y={(y1+y2)/2-10} textAnchor="middle" className="drive-edge-label">{edge.label}</text></g>; })}
        {scene.nodes.map((node, i) => <g key={i}><rect x={node.x} y={node.y} width={node.w} height="82" rx="14" fill="var(--drive-card)" stroke="var(--drive-border)" strokeWidth="1.4"/><rect x={node.x+11} y={node.y+17} width="42" height="42" rx="11" fill="var(--drive-icon-bg)"/><Icon kind={node.kind} x={node.x+18} y={node.y+24}/><text x={node.x+62} y={node.y+34} className="drive-node-title">{node.title}</text><text x={node.x+62} y={node.y+55} className="drive-node-detail">{node.detail}</text></g>)}
        <text x="28" y="408" className="drive-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .drive-figure{--drive-paper:#fff;--drive-card:#f6f8f8;--drive-icon-bg:#e8f0ee;--drive-ink:#23302d;--drive-secondary:#4d5a57;--drive-line:#55726b;--drive-border:#8ea49e;--drive-rule:#d2ddd9;margin:0;min-width:0;max-width:100%;color:var(--drive-ink);container-type:inline-size}
      .drive-scroll-hint{display:none}.drive-viewport{box-sizing:border-box;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--drive-rule);border-radius:18px;background:var(--drive-paper);scrollbar-width:thin;touch-action:pan-x pan-y;overscroll-behavior-inline:contain}.drive-viewport:focus-visible{outline:3px solid var(--accent,var(--drive-ink));outline-offset:3px}.drive-viewport svg{display:block;width:100%;min-width:940px;height:auto}.drive-figure figcaption{margin-top:.7rem;color:var(--muted,var(--drive-secondary));font-size:.875rem;line-height:1.55}
      .drive-heading{font:650 18px system-ui,-apple-system,sans-serif;fill:var(--drive-ink);letter-spacing:-.02em}.drive-node-title{font:650 13px system-ui,-apple-system,sans-serif;fill:var(--drive-ink)}.drive-node-detail{font:11px system-ui,-apple-system,sans-serif;fill:var(--drive-secondary)}.drive-icon{color:var(--drive-ink)}.drive-edge-label{font:600 11px system-ui,-apple-system,sans-serif;fill:var(--drive-line);paint-order:stroke;stroke:var(--drive-paper);stroke-width:5px;stroke-linejoin:round}.drive-note{font:12px system-ui,-apple-system,sans-serif;fill:var(--drive-secondary)}
      @container (max-width:940px){.drive-scroll-hint{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .5rem;color:var(--muted,var(--drive-secondary));font:600 .76rem system-ui,-apple-system,sans-serif}.drive-scroll-hint span{font-size:1.05rem}}
      @media (prefers-color-scheme:dark){.drive-figure{--drive-paper:#1d1d1f;--drive-card:#2d3231;--drive-icon-bg:#354b45;--drive-ink:#f1f5f3;--drive-secondary:#c4d3ce;--drive-line:#a8c6bd;--drive-border:#9db8ae;--drive-rule:#57665f}}
      @media (prefers-contrast:more){.drive-figure{--drive-secondary:var(--drive-ink);--drive-line:var(--drive-ink);--drive-border:var(--drive-ink);--drive-rule:var(--drive-ink)}}
    `}</style>
  </figure>;
}
