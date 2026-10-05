import { useId } from 'react';
import rawScenes from '../content/crawler-diagrams.json';

type Kind = 'url' | 'policy' | 'index' | 'storage' | 'queue' | 'worker' | 'parser' | 'filter' | 'clock' | 'scheduler' | 'rank' | 'hash' | 'network';
type Node = [number, number, number, string, string, Kind];
type Scene = { title: string; description: string; note: string; nodes: Node[]; edges: [number, number][][] };
const scenes = rawScenes as unknown as Record<string, Scene>;

function Icon({ kind, x, y }: { kind: Kind; x: number; y: number }) {
  const ink = { fill: 'none', stroke: 'var(--cr-ink)', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <g transform={`translate(${x} ${y})`} aria-hidden="true" {...ink}>
    {kind === 'url' && <><path d="M4 3h15l5 5v17H4zM19 3v6h5M8 14h11M8 19h8"/></>}
    {kind === 'policy' && <><path d="M14 2 24 6v8c0 6-4 10-10 13C8 24 4 20 4 14V6zM9 14l3 3 7-7"/></>}
    {kind === 'index' && <><rect x="4" y="3" width="20" height="23" rx="2"/><path d="M8 9h12M8 14h12M8 19h8"/></>}
    {kind === 'storage' && <><ellipse cx="14" cy="5" rx="10" ry="3"/><path d="M4 5v18c0 4 20 4 20 0V5M4 14c0 4 20 4 20 0"/></>}
    {kind === 'queue' && <><rect x="2" y="5" width="24" height="5" rx="1"/><rect x="2" y="13" width="24" height="5" rx="1"/><rect x="2" y="21" width="24" height="5" rx="1"/></>}
    {kind === 'worker' && <><circle cx="14" cy="14" r="9"/><circle cx="14" cy="14" r="3"/><path d="M14 1v4M14 23v4M1 14h4M23 14h4"/></>}
    {kind === 'parser' && <><path d="M9 6 3 14l6 8M19 6l6 8-6 8M16 4l-4 21"/></>}
    {kind === 'filter' && <><path d="M3 5h22l-9 10v8l-4 3V15z"/></>}
    {kind === 'clock' && <><circle cx="14" cy="14" r="11"/><path d="M14 7v8l5 3"/></>}
    {kind === 'scheduler' && <><path d="M3 6h13M16 6l-4-4M16 6l-4 4M3 14h21M3 22h13M16 22l-4-4M16 22l-4 4"/></>}
    {kind === 'rank' && <><path d="M4 23h5v-6H4zM12 23h5V11h-5zM20 23h5V4h-5z"/></>}
    {kind === 'hash' && <><path d="M9 3 6 25M19 3l-3 22M3 10h23M2 18h23"/></>}
    {kind === 'network' && <><circle cx="14" cy="14" r="11"/><path d="M3 14h22M14 3c-5 5-5 17 0 22M14 3c5 5 5 17 0 22"/></>}
  </g>;
}

export function WebCrawlerDiagram({ id, className }: { id: string; className?: string }) {
  const scene = scenes[id];
  const key = useId().replace(/:/g, '');
  if (!scene) return null;
  return <figure className={['crawler-figure', className].filter(Boolean).join(' ')}>
    <div id={`${key}-hint`} className="crawler-scroll-hint">Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="crawler-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={`${key}-hint`}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${key}-title ${key}-description`}>
        <title id={`${key}-title`}>{scene.title}</title><desc id={`${key}-description`}>{scene.description}</desc>
        <defs><marker id={`${key}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--cr-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--cr-paper)"/>
        <text x="28" y="35" className="crawler-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--cr-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge, i) => <path key={`e-${i}`} d={edge.map(([x,y], j) => `${j ? 'L' : 'M'}${x} ${y}`).join(' ')} fill="none" stroke="var(--cr-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${key}-arrow)`}/>)}
        {scene.nodes.map(([x,y,w,title,detail,kind], i) => <g key={`n-${i}`}><rect x={x} y={y} width={w} height="74" rx="14" fill="var(--cr-card)" stroke="var(--cr-border)" strokeWidth="1.5"/><rect x={x+11} y={y+18} width="37" height="37" rx="9" fill="var(--cr-icon-bg)" stroke="var(--cr-rule)"/><Icon kind={kind} x={x+15} y={y+22}/><text x={x+58} y={y+32} className="crawler-node-title">{title}</text><text x={x+58} y={y+53} className="crawler-node-detail">{detail}</text></g>)}
        <text x="28" y="430" className="crawler-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .crawler-figure { --cr-paper:#fff; --cr-card:#f6f6f7; --cr-icon-bg:#fff; --cr-ink:#252527; --cr-muted:#55555a; --cr-border:#99999d; --cr-line:#55555a; --cr-rule:#dadadd; margin:0; min-width:0; max-width:100%; color:var(--cr-ink); container-type:inline-size; }
      .crawler-scroll-hint { display:none; }
      .crawler-viewport { box-sizing:border-box; width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; border:1px solid var(--cr-rule); border-radius:18px; background:var(--cr-paper); scrollbar-width:thin; touch-action:pan-x pan-y; overscroll-behavior-inline:contain; }
      .crawler-viewport:focus-visible { outline:3px solid var(--accent, var(--cr-ink)); outline-offset:3px; }
      .crawler-viewport svg { display:block; width:100%; min-width:940px; height:auto; }
      .crawler-figure figcaption { margin-top:.7rem; color:var(--muted, var(--cr-muted)); font-size:.875rem; line-height:1.55; }
      .crawler-heading { font:650 18px system-ui,-apple-system,sans-serif; fill:var(--cr-ink); letter-spacing:-.02em; }
      .crawler-node-title { font:650 12px system-ui,-apple-system,sans-serif; fill:var(--cr-ink); letter-spacing:-.025em; }
      .crawler-node-detail { font:11px system-ui,-apple-system,sans-serif; fill:var(--cr-muted); }
      .crawler-note { font:13px system-ui,-apple-system,sans-serif; fill:var(--cr-muted); }
      @container (max-width:940px) { .crawler-scroll-hint { display:flex; justify-content:space-between; gap:1rem; margin:0 0 .5rem; color:var(--muted, var(--cr-muted)); font:600 .76rem system-ui,-apple-system,sans-serif; } }
      @media (prefers-color-scheme:dark) { .crawler-figure { --cr-paper:#1d1d1f; --cr-card:#303033; --cr-icon-bg:#242427; --cr-ink:#f1f1f2; --cr-muted:#c6c6ca; --cr-border:#aaaab0; --cr-line:#bdbdc2; --cr-rule:#57575c; } }
      @media (prefers-contrast:more) { .crawler-figure { --cr-muted:var(--cr-ink); --cr-border:var(--cr-ink); --cr-line:var(--cr-ink); --cr-rule:var(--cr-ink); } }
    `}</style>
  </figure>;
}
