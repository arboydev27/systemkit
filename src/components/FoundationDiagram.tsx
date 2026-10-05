import { useId } from 'react';
import scenes from '../content/foundation-diagrams.json';

type Item = { title:string; detail:string };
type Scene = { kind:'flow'|'ring'|'comparison'|'bits'|'timeline'; title:string; description:string; note:string; items:Item[] };

function Flow({scene,markerId}:{scene:Scene;markerId:string}) {
  const xs=[34,278,522,766];
  return <>
    {scene.kind!=='comparison' && scene.items.slice(0,3).map((_,i)=><g key={`edge-${i}`}><path d={`M${xs[i]+204} 207 H${xs[i+1]-10}`} fill="none" stroke="var(--foundation-line)" strokeWidth="2" markerEnd={`url(#${markerId})`}/></g>)}
    {scene.items.map((item,i)=><g key={item.title}>
      <rect x={xs[i]} y="155" width="204" height="104" rx="16" fill="var(--foundation-card)" stroke="var(--foundation-border)" strokeWidth="1.5"/>
      <rect x={xs[i]+16} y="174" width="30" height="30" rx="9" fill="var(--foundation-accent-bg)"/>
      <text x={xs[i]+31} y="195" textAnchor="middle" className="foundation-index">{String(i+1).padStart(2,'0')}</text>
      <text x={xs[i]+16} y="225" className="foundation-title">{item.title}</text>
      <text x={xs[i]+16} y="244" className="foundation-detail">{item.detail}</text>
    </g>)}
  </>;
}

function Ring({scene}:{scene:Scene}) {
  const total=scene.items.length;
  return <>
    <circle cx="500" cy="215" r="139" fill="none" stroke="var(--foundation-rule)" strokeWidth="17"/>
    <circle cx="500" cy="215" r="139" fill="none" stroke="var(--foundation-line)" strokeWidth="1.8"/>
    <path d="M603 122l28 2-2 28" fill="none" stroke="var(--foundation-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="500" y="205" textAnchor="middle" className="foundation-center">CLOCKWISE</text>
    <text x="500" y="228" textAnchor="middle" className="foundation-center-detail">successor lookup</text>
    {scene.items.map((item,i)=>{const a=(-90+i*360/total)*Math.PI/180,x=500+139*Math.cos(a),y=215+139*Math.sin(a),key=item.detail==='key';return <g key={`${item.title}-${i}`}>
      <circle cx={x} cy={y} r={key?28:33} fill={key?'var(--foundation-key)':'var(--foundation-card)'} stroke="var(--foundation-border)" strokeWidth="1.5"/>
      <text x={x} y={y+4} textAnchor="middle" className="foundation-ring-label">{item.title}</text>
    </g>})}
    <rect x="32" y="168" width="178" height="95" rx="13" fill="var(--foundation-card)" stroke="var(--foundation-rule)"/>
    <text x="48" y="197" className="foundation-title">Node tokens</text><text x="48" y="219" className="foundation-detail">placement positions</text>
    <text x="48" y="246" className="foundation-detail">Keys seek successor ↻</text>
    <rect x="790" y="168" width="178" height="95" rx="13" fill="var(--foundation-card)" stroke="var(--foundation-rule)"/>
    <text x="806" y="197" className="foundation-title">Membership</text><text x="806" y="219" className="foundation-detail">same map version</text>
    <text x="806" y="246" className="foundation-detail">for every client</text>
  </>;
}

function Bits({scene}:{scene:Scene}) {
  const widths=[108,406,142,142,142],colors=['var(--foundation-key)','var(--foundation-card)','var(--foundation-accent-bg)','var(--foundation-card)','var(--foundation-accent-bg)'];
  let x=30;
  return <>
    <text x="30" y="110" className="foundation-detail">64 bits total · segments visually enlarged for legibility</text>
    {scene.items.map((item,i)=>{const at=x;x+=widths[i];return <g key={item.title}><rect x={at} y="155" width={widths[i]-4} height="112" rx="12" fill={colors[i]} stroke="var(--foundation-border)" strokeWidth="1.5"/><text x={at+14} y="203" className="foundation-title">{item.title}</text><text x={at+14} y="234" className="foundation-detail">{item.detail}</text></g>})}
    <text x="30" y="322" className="foundation-detail">Higher bits → time ordering</text><text x="764" y="322" className="foundation-detail">← Lower bits · local sequence</text>
  </>;
}

function Timeline({scene,markerId}:{scene:Scene;markerId:string}) {
  const xs=[70,308,546,784];
  return <><path d="M72 214 H940" stroke="var(--foundation-line)" strokeWidth="3" markerEnd={`url(#${markerId})`}/>
    {scene.items.map((item,i)=><g key={item.title}><circle cx={xs[i]} cy="214" r="9" fill="var(--foundation-ink)"/><rect x={xs[i]-60} y={i%2===0?103:258} width="166" height="75" rx="13" fill="var(--foundation-card)" stroke="var(--foundation-border)"/><text x={xs[i]-46} y={i%2===0?134:289} className="foundation-title">{item.title}</text><text x={xs[i]-46} y={i%2===0?156:311} className="foundation-detail">{item.detail}</text><path d={`M${xs[i]} ${i%2===0?178:258} V${i%2===0?204:224}`} stroke="var(--foundation-line)" strokeWidth="1.7"/></g>)}
  </>;
}

export function FoundationDiagram({id,className}:{id:string;className?:string}) {
  const scene=(scenes as Record<string,Scene>)[id];
  const unique=useId().replace(/:/g,'');
  if(!scene) return null;
  const titleId=`${unique}-title`,descId=`${unique}-desc`,hintId=`${unique}-hint`,markerId=`${unique}-arrow`,timelineMarkerId=`${unique}-timeline-arrow`;
  return <figure className={['foundation-figure',className].filter(Boolean).join(' ')}>
    <div className="foundation-scroll-hint" id={hintId}>Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="foundation-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 430" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descId}>{scene.description}</desc>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--foundation-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker><marker id={timelineMarkerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--foundation-line)" strokeWidth="1.5"/></marker></defs>
        <rect width="1000" height="430" rx="18" fill="var(--foundation-paper)"/>
        <text x="28" y="35" className="foundation-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--foundation-rule)" strokeDasharray="3 7"/>
        {scene.kind==='ring'?<Ring scene={scene}/>:scene.kind==='bits'?<Bits scene={scene}/>:scene.kind==='timeline'?<Timeline scene={scene} markerId={timelineMarkerId}/>:<Flow scene={scene} markerId={markerId}/>}
        <text x="28" y="405" className="foundation-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .foundation-figure{--foundation-paper:#fff;--foundation-card:#f5f6f7;--foundation-key:#e8eef1;--foundation-accent-bg:#e4edf3;--foundation-ink:#252c30;--foundation-secondary:#4b555a;--foundation-line:#5b6a72;--foundation-border:#859299;--foundation-rule:#d2d9dc;margin:0;min-width:0;max-width:100%;color:var(--foundation-ink);container-type:inline-size}
      .foundation-scroll-hint{display:none}.foundation-viewport{box-sizing:border-box;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--foundation-rule);border-radius:18px;background:var(--foundation-paper);scrollbar-width:thin;touch-action:pan-x pan-y;overscroll-behavior-inline:contain}.foundation-viewport:focus-visible{outline:3px solid var(--accent,var(--foundation-ink));outline-offset:3px}.foundation-viewport svg{display:block;width:100%;min-width:940px;height:auto}.foundation-figure figcaption{margin-top:.7rem;color:var(--muted,var(--foundation-secondary));font-size:.875rem;line-height:1.55}
      .foundation-heading{font:600 18px system-ui,-apple-system,sans-serif;fill:var(--foundation-ink);letter-spacing:-.02em}.foundation-title{font:650 14px system-ui,-apple-system,sans-serif;fill:var(--foundation-ink)}.foundation-detail{font:11px system-ui,-apple-system,sans-serif;fill:var(--foundation-secondary)}.foundation-index{font:700 11px system-ui,-apple-system,sans-serif;fill:var(--foundation-secondary)}.foundation-ring-label{font:700 13px system-ui,-apple-system,sans-serif;fill:var(--foundation-ink)}.foundation-center{font:700 13px system-ui,-apple-system,sans-serif;fill:var(--foundation-ink);letter-spacing:.1em}.foundation-center-detail{font:11px system-ui,-apple-system,sans-serif;fill:var(--foundation-secondary)}.foundation-note{font:12px system-ui,-apple-system,sans-serif;fill:var(--foundation-secondary)}
      @container (max-width:940px){.foundation-scroll-hint{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .5rem;color:var(--muted,var(--foundation-secondary));font:600 .76rem system-ui,-apple-system,sans-serif}.foundation-scroll-hint span{font-size:1.05rem}}
      @media (prefers-color-scheme:dark){.foundation-figure{--foundation-paper:#1d1d1f;--foundation-card:#2b2d30;--foundation-key:#364148;--foundation-accent-bg:#354651;--foundation-ink:#f2f3f4;--foundation-secondary:#c7d0d4;--foundation-line:#b6c1c7;--foundation-border:#aab4ba;--foundation-rule:#596168}}
      @media (prefers-contrast:more){.foundation-figure{--foundation-secondary:var(--foundation-ink);--foundation-line:var(--foundation-ink);--foundation-border:var(--foundation-ink);--foundation-rule:var(--foundation-ink)}}
    `}</style>
  </figure>;
}
