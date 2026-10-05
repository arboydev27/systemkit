import { useId } from 'react';
import scenes from '../content/rate-diagrams.json';

type Icon = 'person' | 'key' | 'clock' | 'check' | 'shield' | 'store' | 'server' | 'bucket' | 'chart';
type Node = { x:number; y:number; w:number; title:string; detail:string; kind:string };
type Edge = { from:number[]; to:number[]; label:string };
type Scene = { title:string; description:string; note:string; nodes:Node[]; edges:Edge[] };

function Pictogram({ kind, x, y }:{kind:Icon;x:number;y:number}) {
  const p={fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <g transform={`translate(${x} ${y})`} className="rate-icon" aria-hidden="true">
    {kind==='person' && <><circle cx="14" cy="8" r="5" {...p}/><path d="M3 27c0-11 22-11 22 0" {...p}/></>}
    {kind==='key' && <><circle cx="8" cy="11" r="5" {...p}/><path d="M13 11h13m-4 0v5m-5-5v4" {...p}/></>}
    {kind==='clock' && <><circle cx="14" cy="14" r="11" {...p}/><path d="M14 7v8l5 3" {...p}/></>}
    {kind==='check' && <><circle cx="14" cy="14" r="11" {...p}/><path d="m8 14 4 4 8-9" {...p}/></>}
    {kind==='shield' && <><path d="M14 2 24 6v8c0 7-5 10-10 13C9 24 4 21 4 14V6z" {...p}/><path d="M14 9v8m0 4h.01" {...p}/></>}
    {kind==='store' && <><ellipse cx="14" cy="5" rx="10" ry="4" {...p}/><path d="M4 5v18c0 5 20 5 20 0V5M4 14c0 5 20 5 20 0" {...p}/></>}
    {kind==='server' && <><rect x="3" y="3" width="22" height="22" rx="3" {...p}/><path d="M8 9h12M8 15h12M8 21h8" {...p}/></>}
    {kind==='bucket' && <><path d="M4 8h20l-3 18H7zM2 8h24M8 8c0-7 12-7 12 0" {...p}/></>}
    {kind==='chart' && <><path d="M3 25V4m0 21h23M8 21v-7m6 7V8m6 13V12" {...p}/></>}
  </g>;
}

export function RateLimiterDiagram({id,className}:{id:string;className?:string}) {
  const scene=(scenes as Record<string,Scene>)[id];
  const unique=useId().replace(/:/g,'');
  if (!scene) return null;
  const titleId=`${unique}-title`, descId=`${unique}-desc`, hintId=`${unique}-hint`, markerId=`${unique}-arrow`;
  return <figure className={['rate-figure',className].filter(Boolean).join(' ')}>
    <div className="rate-scroll-hint" id={hintId}>Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="rate-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 430" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descId}>{scene.description}</desc>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--rate-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="430" rx="18" fill="var(--rate-paper)"/>
        <text x="28" y="35" className="rate-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--rate-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge,i)=>{const [x1,y1]=edge.from,[x2,y2]=edge.to;const mx=(x1+x2)/2,my=(y1+y2)/2-9;return <g key={i}><path d={`M${x1} ${y1} L${x2} ${y2}`} fill="none" stroke="var(--rate-line)" strokeWidth="2" strokeLinecap="round" markerEnd={`url(#${markerId})`}/><text x={mx} y={my} textAnchor="middle" className="rate-edge-label">{edge.label}</text></g>})}
        {scene.nodes.map((node,i)=><g key={i}><rect x={node.x} y={node.y} width={node.w} height="82" rx="14" fill="var(--rate-card)" stroke="var(--rate-border)" strokeWidth="1.4"/><rect x={node.x+12} y={node.y+16} width="47" height="47" rx="12" fill="var(--rate-icon-bg)"/><Pictogram kind={node.kind as Icon} x={node.x+22} y={node.y+25}/><text x={node.x+68} y={node.y+35} className="rate-node-title">{node.title}</text><text x={node.x+68} y={node.y+56} className="rate-node-detail">{node.detail}</text></g>)}
        <text x="28" y="408" className="rate-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .rate-figure{--rate-paper:#fff;--rate-card:#f5f6f7;--rate-icon-bg:#e8eef1;--rate-ink:#252c30;--rate-secondary:#4b555a;--rate-line:#5b6a72;--rate-border:#859299;--rate-rule:#d2d9dc;margin:0;min-width:0;max-width:100%;color:var(--rate-ink);container-type:inline-size}
      .rate-scroll-hint{display:none}.rate-viewport{box-sizing:border-box;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--rate-rule);border-radius:18px;background:var(--rate-paper);scrollbar-width:thin;touch-action:pan-x pan-y;overscroll-behavior-inline:contain}.rate-viewport:focus-visible{outline:3px solid var(--accent,var(--rate-ink));outline-offset:3px}.rate-viewport svg{display:block;width:100%;min-width:940px;height:auto}.rate-figure figcaption{margin-top:.7rem;color:var(--muted,var(--rate-secondary));font-size:.875rem;line-height:1.55}
      .rate-heading{font:600 18px system-ui,-apple-system,sans-serif;fill:var(--rate-ink);letter-spacing:-.02em}.rate-node-title{font:650 13px system-ui,-apple-system,sans-serif;fill:var(--rate-ink)}.rate-node-detail{font:11px system-ui,-apple-system,sans-serif;fill:var(--rate-secondary)}.rate-icon{color:var(--rate-ink)}.rate-edge-label{font:600 11px system-ui,-apple-system,sans-serif;fill:var(--rate-line);paint-order:stroke;stroke:var(--rate-paper);stroke-width:5px;stroke-linejoin:round}.rate-note{font:12px system-ui,-apple-system,sans-serif;fill:var(--rate-secondary)}
      @container (max-width:940px){.rate-scroll-hint{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .5rem;color:var(--muted,var(--rate-secondary));font:600 .76rem system-ui,-apple-system,sans-serif}.rate-scroll-hint span{font-size:1.05rem}}
      @media (prefers-color-scheme:dark){.rate-figure{--rate-paper:#1d1d1f;--rate-card:#2b2d30;--rate-icon-bg:#364148;--rate-ink:#f2f3f4;--rate-secondary:#c7d0d4;--rate-line:#b6c1c7;--rate-border:#aab4ba;--rate-rule:#596168}}
      @media (prefers-contrast:more){.rate-figure{--rate-secondary:var(--rate-ink);--rate-line:var(--rate-ink);--rate-border:var(--rate-ink);--rate-rule:var(--rate-ink)}}
    `}</style>
  </figure>;
}
