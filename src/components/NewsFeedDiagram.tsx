import { useId } from 'react';

type Icon = 'person' | 'post' | 'store' | 'queue' | 'worker' | 'inbox' | 'media' | 'cdn' | 'graph' | 'filter' | 'score' | 'cursor' | 'monitor';
type Node = { x:number; y:number; w:number; title:string; detail:string; icon:Icon };
type Edge = { path:string; label?:string; x?:number; y?:number; dashed?:boolean };
type Scene = { title:string; description:string; nodes:Node[]; edges:Edge[]; note:string };
const n=(x:number,y:number,w:number,title:string,detail:string,icon:Icon):Node=>({x,y,w,title,detail,icon});
const e=(path:string,label?:string,x?:number,y?:number,dashed?:boolean):Edge=>({path,label,x,y,dashed});

const scenes:Record<string,Scene>={
  'feed-scope': {
    title:'Three feed promises', description:'Publishing makes one durable post; distribution creates eligible candidates; retrieval delivers an authorized page to a reader.',
    nodes:[n(35,175,180,'Publisher','submits post','person'),n(275,94,186,'Accept','durable post ID','post'),n(523,94,185,'Distribute','eligible followers','queue'),n(770,175,190,'Reader','authorized page','person')],
    edges:[e('M215 216 H245 V135 H275','commit',246,120),e('M461 135 H523','later',492,117),e('M708 135 H738 V216 H770','retrieve',744,121)],
    note:'Publish success and feed visibility have separate latency targets.'
  },
  'feed-publish': {
    title:'The reliable publish handoff', description:'An authenticated request commits a canonical post and durable fanout intent; a relay and workers then create idempotent inbox references.',
    nodes:[n(30,174,171,'Client','key + content','person'),n(243,174,173,'Post API','validate + limit','post'),n(466,74,193,'Post store','canonical record','store'),n(466,273,193,'Outbox','durable intent','queue'),n(714,273,185,'Worker','retry by post ID','worker'),n(714,74,185,'Inboxes','small references','inbox')],
    edges:[e('M201 215 H243','submit',220,195),e('M416 196 H445 V115 H466','commit',447,98),e('M562 156 V273','same transaction',626,224),e('M659 314 H714','relay',686,295),e('M806 273 V156','idempotent',857,220)],
    note:'The outbox prevents a committed post from losing its fanout event.'
  },
  'feed-media': {
    title:'Media follows a separate path', description:'The client uploads bytes to object storage; processing creates approved variants, while the post stores references and the CDN serves readers.',
    nodes:[n(31,177,157,'Client','uploads bytes','person'),n(248,91,178,'Object store','original media','media'),n(248,276,178,'Post store','object key + ACL','post'),n(489,91,188,'Processor','scan + variants','worker'),n(741,91,201,'CDN','approved variants','cdn'),n(741,276,201,'Reader','authorized access','person')],
    edges:[e('M188 202 H216 V132 H248','upload',213,117),e('M188 234 H216 V317 H248','publish ref',214,350),e('M426 132 H489','process',458,114),e('M677 132 H741','deliver',710,114),e('M841 173 V276','fetch',879,229)],
    note:'A deleted private object needs an explicit revocation window.'
  },
  'feed-fanout': {
    title:'Push, pull, then merge', description:'Ordinary authors push post IDs into follower inboxes. Large audiences remain in an author index and are merged when an active reader opens the feed.',
    nodes:[n(28,86,195,'Ordinary author','bounded followers','person'),n(28,270,195,'Large author','millions follow','person'),n(286,86,178,'Fanout queue','push on write','queue'),n(286,270,178,'Author index','pull on read','store'),n(535,86,190,'Inbox IDs','precomputed','inbox'),n(535,270,190,'Merge','dedupe IDs','filter'),n(792,176,172,'Reader','one feed','person')],
    edges:[e('M223 127 H286','push',253,110),e('M464 127 H535','write',501,110),e('M223 311 H286','index',254,293),e('M630 168 V270','candidates',675,220),e('M464 311 H535','pull',499,294),e('M725 311 H758 V217 H792','read',759,296)],
    note:'Pick the hybrid threshold from measured fanout cost and read delay.'
  },
  'feed-read': {
    title:'Build an authorized feed page', description:'Gather inbox and pull candidates, filter current access, hydrate post and author details, then return a cursor page.',
    nodes:[n(30,86,173,'Inbox','pushed IDs','inbox'),n(30,270,173,'Author index','pulled IDs','store'),n(262,176,173,'Merge','dedupe + order','filter'),n(497,176,173,'Access check','current rules','filter'),n(733,90,209,'Post + user cache','hydrate details','store'),n(733,272,209,'Page','items + cursor','cursor')],
    edges:[e('M203 127 H231 V217 H262'),e('M203 311 H231 V217 H262'),e('M435 217 H497','IDs',467,199),e('M670 198 H704 V131 H733','allowed',707,115),e('M838 172 V272','render',879,224)],
    note:'Cached IDs are candidates; current access rules decide the response.'
  },
  'feed-ranking': {
    title:'Order eligible candidates', description:'The feed first gathers and authorizes posts. A chronological sort or a bounded ranking stage then orders the page, and a continuation token preserves paging.',
    nodes:[n(30,174,175,'Candidates','inbox + pull','inbox'),n(271,174,178,'Access check','allowed only','filter'),n(508,78,207,'Chronological','time + ID','cursor'),n(508,272,207,'Ranked','bounded scoring','score'),n(778,174,183,'Page token','stable continuation','cursor')],
    edges:[e('M205 215 H271'),e('M449 194 H477 V119 H508','recency',478,102),e('M449 235 H477 V313 H508','relevance',480,346),e('M715 119 H746 V198 H778'),e('M715 313 H746 V233 H778')],
    note:'A timestamp cursor cannot describe a changing ranked order.'
  },
  'feed-privacy': {
    title:'Visibility can change after fanout', description:'A relationship or post rule can change while stale inbox IDs remain. Read-time authorization blocks them and cleanup removes derived entries.',
    nodes:[n(30,86,196,'Post + audience','canonical rules','post'),n(30,270,196,'Relationship','follow / block','graph'),n(312,176,195,'Old inbox ID','derived pointer','inbox'),n(579,176,183,'Read filter','check now','filter'),n(819,91,143,'Allowed','show post','person'),n(819,269,143,'Denied','suppress','filter')],
    edges:[e('M226 127 H269 V199 H312','version',271,112),e('M226 311 H269 V237 H312','change',269,343),e('M507 217 H579','candidate',544,199),e('M762 197 H787 V132 H819','yes',787,115),e('M762 237 H787 V310 H819','no',789,343)],
    note:'Deletion tombstones also stop delayed workers from reviving old entries.'
  },
  'feed-operations': {
    title:'Measure end-to-end feed health', description:'Track post commits through durable handoff and fanout to what eligible readers actually see; repair lagging or lost derived state.',
    nodes:[n(29,174,167,'Post API','commit success','post'),n(246,174,170,'Outbox','handoff gap','queue'),n(467,174,170,'Workers','queue age','worker'),n(688,84,195,'Feed read','first-page latency','cursor'),n(688,269,195,'Monitor','visible delay','monitor')],
    edges:[e('M196 215 H246','persist',220,197),e('M416 215 H467','relay',442,197),e('M637 195 H658 V125 H688','inboxes',657,110),e('M786 166 V269','measure',827,219),e('M553 256 V310 H688','lag',623,295,true)],
    note:'A successful publish API cannot mask a stalled distribution pipeline.'
  },
};

function IconShape({kind,x,y}:{kind:Icon;x:number;y:number}) {
  const p={fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <g transform={`translate(${x} ${y})`} className="feed-icon" aria-hidden="true">
    {kind==='person' && <><circle cx="14" cy="8" r="5" {...p}/><path d="M3 26c1-9 21-9 22 0" {...p}/></>}
    {kind==='post' && <><rect x="3" y="2" width="22" height="25" rx="3" {...p}/><path d="M8 9h12M8 14h12M8 19h8" {...p}/></>}
    {kind==='store' && <><ellipse cx="14" cy="5" rx="10" ry="4" {...p}/><path d="M4 5v18c0 5 20 5 20 0V5M4 14c0 5 20 5 20 0" {...p}/></>}
    {kind==='queue' && <><rect x="3" y="3" width="22" height="5" rx="1" {...p}/><rect x="3" y="12" width="22" height="5" rx="1" {...p}/><rect x="3" y="21" width="22" height="5" rx="1" {...p}/></>}
    {kind==='worker' && <><circle cx="14" cy="14" r="7" {...p}/><circle cx="14" cy="14" r="2" {...p}/><path d="M14 1v5M14 22v5M1 14h5M22 14h5M5 5l4 4M19 19l4 4M23 5l-4 4M9 19l-4 4" {...p}/></>}
    {kind==='inbox' && <><path d="M3 5h22v20H3zM3 17h7l3 3h3l3-3h6" {...p}/></>}
    {kind==='media' && <><rect x="2" y="4" width="24" height="20" rx="3" {...p}/><circle cx="9" cy="10" r="2" {...p}/><path d="m5 21 6-6 4 3 4-6 5 8" {...p}/></>}
    {kind==='cdn' && <><circle cx="14" cy="14" r="11" {...p}/><path d="M3 14h22M14 3c-7 7-7 15 0 22M14 3c7 7 7 15 0 22" {...p}/></>}
    {kind==='graph' && <><circle cx="5" cy="6" r="3" {...p}/><circle cx="23" cy="7" r="3" {...p}/><circle cx="14" cy="23" r="3" {...p}/><path d="M8 6h12M6 9l6 11M22 10l-6 10" {...p}/></>}
    {kind==='filter' && <><path d="M2 4h24l-9 10v8l-6 4V14z" {...p}/></>}
    {kind==='score' && <><path d="m14 2 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1z" {...p}/></>}
    {kind==='cursor' && <><path d="M5 5h18M5 12h18M5 19h12M5 26h10M19 20l5 3-5 3" {...p}/></>}
    {kind==='monitor' && <><rect x="2" y="3" width="24" height="18" rx="2" {...p}/><path d="M7 14h4l2-5 3 8 2-4h4M10 26h8M14 21v5" {...p}/></>}
  </g>;
}

export function NewsFeedDiagram({id,className}:{id:string;className?:string}) {
  const scene=scenes[id], unique=useId().replace(/:/g,'');
  if(!scene) return null;
  const titleId=`${unique}-title`, descId=`${unique}-desc`, hintId=`${unique}-hint`, arrowId=`${unique}-arrow`;
  return <figure className={['feed-figure',className].filter(Boolean).join(' ')}>
    <div className="feed-scroll-hint" id={hintId}>Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="feed-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descId}>{scene.description}</desc>
        <defs><marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--feed-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--feed-paper)"/>
        <text x="28" y="35" className="feed-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--feed-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge,i)=><g key={i}><path d={edge.path} fill="none" stroke="var(--feed-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={edge.dashed?'4 5':undefined} markerEnd={`url(#${arrowId})`}/>{edge.label&&<text x={edge.x} y={edge.y} textAnchor="middle" className="feed-edge-label">{edge.label}</text>}</g>)}
        {scene.nodes.map((node,i)=><g key={i}><rect x={node.x} y={node.y} width={node.w} height="82" rx="14" fill="var(--feed-card)" stroke="var(--feed-border)" strokeWidth="1.4"/><rect x={node.x+12} y={node.y+16} width="47" height="47" rx="12" fill="var(--feed-icon-bg)"/><IconShape kind={node.icon} x={node.x+22} y={node.y+25}/><text x={node.x+68} y={node.y+35} className="feed-node-title">{node.title}</text><text x={node.x+68} y={node.y+56} className="feed-node-detail">{node.detail}</text></g>)}
        <text x="28" y="429" className="feed-note">{scene.note}</text>
      </svg>
    </div><figcaption>{scene.description}</figcaption>
    <style>{`
      .feed-figure{--feed-paper:#fff;--feed-card:#f5f6f7;--feed-icon-bg:#e8eef1;--feed-ink:#252c30;--feed-secondary:#4b555a;--feed-line:#5b6a72;--feed-border:#859299;--feed-rule:#d2d9dc;margin:0;min-width:0;max-width:100%;color:var(--feed-ink);container-type:inline-size}
      .feed-scroll-hint{display:none}.feed-viewport{box-sizing:border-box;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--feed-rule);border-radius:18px;background:var(--feed-paper);scrollbar-width:thin;touch-action:pan-x pan-y;overscroll-behavior-inline:contain}.feed-viewport:focus-visible{outline:3px solid var(--accent,var(--feed-ink));outline-offset:3px}.feed-viewport svg{display:block;width:100%;min-width:940px;height:auto}.feed-figure figcaption{margin-top:.7rem;color:var(--muted,var(--feed-secondary));font-size:.875rem;line-height:1.55}
      .feed-heading{font:600 18px system-ui,-apple-system,sans-serif;fill:var(--feed-ink);letter-spacing:-.02em}.feed-node-title{font:650 13px system-ui,-apple-system,sans-serif;fill:var(--feed-ink)}.feed-node-detail{font:11px system-ui,-apple-system,sans-serif;fill:var(--feed-secondary)}.feed-icon{color:var(--feed-ink)}.feed-edge-label{font:600 11px system-ui,-apple-system,sans-serif;fill:var(--feed-line);paint-order:stroke;stroke:var(--feed-paper);stroke-width:5px;stroke-linejoin:round}.feed-note{font:12px system-ui,-apple-system,sans-serif;fill:var(--feed-secondary)}
      @container (max-width:940px){.feed-scroll-hint{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .5rem;color:var(--muted,var(--feed-secondary));font:600 .76rem system-ui,-apple-system,sans-serif}.feed-scroll-hint span{font-size:1.05rem}}
      @media (prefers-color-scheme:dark){.feed-figure{--feed-paper:#1d1d1f;--feed-card:#2b2d30;--feed-icon-bg:#364148;--feed-ink:#f2f3f4;--feed-secondary:#c7d0d4;--feed-line:#b6c1c7;--feed-border:#aab4ba;--feed-rule:#596168}}
      @media (prefers-contrast:more){.feed-figure{--feed-secondary:var(--feed-ink);--feed-line:var(--feed-ink);--feed-border:var(--feed-ink);--feed-rule:var(--feed-ink)}}
    `}</style>
  </figure>;
}
