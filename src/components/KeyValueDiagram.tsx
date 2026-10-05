import { useId } from 'react';
import scenes from '../content/kv-diagrams.json';

type Tone = 'input' | 'process' | 'store' | 'result' | 'warning';
type Node = { x:number; y:number; w:number; title:string; detail:string; tone:Tone };
type Scene = { title:string; description:string; nodes:Node[]; arrows:number[][][]; note:string };

export function KeyValueDiagram({id,className}:{id:string;className?:string}) {
  const scene = (scenes as Record<string,Scene>)[id];
  const unique = useId().replace(/:/g,'');
  if (!scene) return null;
  const arrowId=`${unique}-arrow`, titleId=`${unique}-title`, descId=`${unique}-desc`, hintId=`${unique}-hint`;
  return <figure className={['kv-figure',className].filter(Boolean).join(' ')}>
    <div className="kv-scroll-hint" id={hintId}>Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="kv-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descId}>{scene.description}</desc>
        <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--kv-line)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--kv-paper)"/>
        <text x="28" y="38" className="kv-heading">{scene.title}</text>
        <path d="M28 53H972" stroke="var(--kv-rule)" strokeDasharray="3 7"/>
        {scene.arrows.map((points,index)=><path key={index} d={points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')} fill="none" stroke="var(--kv-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${arrowId})`}/>)}
        {scene.nodes.map((node,index)=><g key={index}>
          <rect x={node.x} y={node.y} width={node.w} height="82" rx="14" fill={`var(--kv-${node.tone})`} stroke="var(--kv-border)" strokeWidth="1.4"/>
          <text x={node.x+17} y={node.y+33} className="kv-node-title">{node.title}</text>
          <text x={node.x+17} y={node.y+59} className="kv-node-detail">{node.detail}</text>
        </g>)}
        <text x="28" y="427" className="kv-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .kv-figure{--kv-paper:#fff;--kv-input:#f8f8f8;--kv-process:#f3f3f3;--kv-store:#ececec;--kv-result:#e6e6e6;--kv-warning:#f1eee8;--kv-ink:#222;--kv-secondary:#555;--kv-border:#888;--kv-line:#555;--kv-rule:#ddd;margin:0;min-width:0;max-width:100%;container-type:inline-size}
      .kv-scroll-hint{display:none}
      .kv-viewport{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--kv-rule);border-radius:18px;background:var(--kv-paper);scrollbar-width:thin;touch-action:pan-x pan-y;overscroll-behavior-inline:contain}
      .kv-viewport:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
      .kv-viewport svg{display:block;width:100%;min-width:940px;height:auto}
      .kv-figure figcaption{margin-top:.7rem;color:var(--muted);font-size:.875rem;line-height:1.55}
      .kv-heading{fill:var(--kv-ink);font:600 18px system-ui,-apple-system,sans-serif;letter-spacing:-.02em}
      .kv-node-title{fill:var(--kv-ink);font:700 17px system-ui,-apple-system,sans-serif;letter-spacing:-.025em}
      .kv-node-detail,.kv-note{fill:var(--kv-secondary);font:13px system-ui,-apple-system,sans-serif}
      @container(max-width:940px){.kv-scroll-hint{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .5rem;color:var(--muted);font:600 .76rem system-ui,-apple-system,sans-serif}}
      @media(prefers-color-scheme:dark){.kv-figure{--kv-paper:#1d1d1f;--kv-input:#29292c;--kv-process:#333336;--kv-store:#39393d;--kv-result:#404044;--kv-warning:#403a32;--kv-ink:#f1f1f2;--kv-secondary:#c5c5c8;--kv-border:#a9a9ad;--kv-line:#b6b6ba;--kv-rule:#57575b}}
      @media(prefers-contrast:more){.kv-figure{--kv-secondary:var(--kv-ink);--kv-border:var(--kv-ink);--kv-line:var(--kv-ink);--kv-rule:var(--kv-ink)}}
    `}</style>
  </figure>;
}
