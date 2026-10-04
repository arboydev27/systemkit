import { useId } from 'react';

type Icon = 'phone' | 'gateway' | 'store' | 'group' | 'queue' | 'push' | 'cursor' | 'pulse' | 'service' | 'shield' | 'clock';
type Node = { x: number; y: number; w: number; title: string; detail: string; icon: Icon };
type Edge = { path: string; label?: string; x?: number; y?: number; dashed?: boolean };
type Scene = { title: string; description: string; nodes: Node[]; edges: Edge[]; note: string };
const n = (x:number,y:number,w:number,title:string,detail:string,icon:Icon):Node => ({x,y,w,title,detail,icon});
const e = (path:string,label?:string,x?:number,y?:number,dashed?:boolean):Edge => ({path,label,x,y,dashed});

const scenes: Record<string,Scene> = {
  'chat-scope': {
    title:'Three different message promises', description:'A sender receives durable acceptance; connected devices get a live event; disconnected devices catch up from history.',
    nodes:[n(36,160,202,'Sender','submits text','phone'),n(307,87,210,'Acceptance','persisted + ID','shield'),n(307,263,210,'Live delivery','connected devices','gateway'),n(696,263,256,'Offline recovery','retrieve from history','store')],
    edges:[e('M238 201 H265 V128 H307','write',274,114),e('M412 169 V263','online',451,225),e('M517 128 H655 V304 H696','offline later',605,111)],
    note:'Acceptance, online delivery, and offline recovery are separate guarantees.'
  },
  'chat-transport': {
    title:'Choose the cost of keeping up', description:'Polling repeatedly checks, long polling waits for an update or timeout, and WebSocket keeps a bidirectional connection.',
    nodes:[n(38,82,220,'Polling','repeated empty checks','clock'),n(38,190,220,'Long polling','wait; reopen on reply','clock'),n(38,298,220,'WebSocket','persistent two-way','gateway'),n(396,188,210,'Chat gateway','receives and pushes','service'),n(735,188,215,'Recipient','gets live update','phone')],
    edges:[e('M258 123 H330 V215 H396','ask again',330,111,true),e('M258 231 H396','hold request',326,214),e('M258 339 H330 V250 H396','live channel',330,365),e('M606 229 H735','update',671,210)],
    note:'The live transport is a separate decision from durable history and mobile push.'
  },
  'chat-connections': {
    title:'A route for each connected device', description:'Placement sends each authenticated device to a gateway with capacity; reconnect and replay recover after failure.',
    nodes:[n(36,80,184,'Phone','device A','phone'),n(36,270,184,'Laptop','device B','phone'),n(278,173,205,'Placement','healthy capacity','service'),n(557,76,189,'Gateway 1','live socket A','gateway'),n(557,268,189,'Gateway 2','live socket B','gateway'),n(808,173,150,'Routes','device → host','store')],
    edges:[e('M220 121 H248 V200 H278'),e('M220 311 H248 V228 H278'),e('M483 201 H520 V117 H557'),e('M483 227 H520 V309 H557'),e('M746 117 H784 V203 H808'),e('M746 309 H784 V225 H808')],
    note:'When a gateway disappears, reconnect to a new one and fetch missed messages.'
  },
  'chat-delivery': {
    title:'Persist first, then deliver', description:'A submitted message is validated, assigned an ID, stored, and acknowledged before live or offline delivery is attempted.',
    nodes:[n(34,173,176,'Sender','key + text','phone'),n(265,173,177,'Chat service','validate + assign ID','service'),n(505,84,188,'History','canonical record','store'),n(505,271,188,'Delivery job','retryable fanout','queue'),n(756,84,205,'Online device','socket event','gateway'),n(756,271,205,'Offline device','push + later fetch','push')],
    edges:[e('M210 214 H265','submit',236,195),e('M442 199 H470 V125 H505','commit',475,109),e('M599 166 V271','after commit',640,224),e('M693 312 H756','notify',725,295),e('M693 300 H722 V125 H756','deliver',724,103)],
    note:'A retry with the same client key returns the same stored message.'
  },
  'chat-ordering': {
    title:'One timeline, two device cursors', description:'A server-defined position orders one conversation; each device replays after its own applied cursor.',
    nodes:[n(36,165,205,'Conversation','positions 40–46','store'),n(342,165,218,'Ordered history','conversation + sequence','cursor'),n(697,78,248,'Phone','cursor 44 → fetch 45–46','phone'),n(697,270,248,'Laptop','cursor 39 → fetch 40–46','phone')],
    edges:[e('M241 206 H342','assign order',291,185),e('M560 190 H625 V119 H697','after 44',632,102),e('M560 230 H625 V311 H697','after 39',632,341)],
    note:'A device cursor records progress; timestamps alone do not settle order.'
  },
  'chat-presence': {
    title:'A temporary signal, not a delivery rule', description:'Device heartbeats renew leases; account status aggregates leases and publishes changes to interested viewers.',
    nodes:[n(36,91,204,'Phone','heartbeat lease','phone'),n(36,274,204,'Laptop','heartbeat lease','phone'),n(326,174,223,'Presence service','expire with grace','pulse'),n(631,174,155,'Account','any live device','group'),n(822,174,135,'Viewer','status hint','phone')],
    edges:[e('M240 132 H282 V203 H326'),e('M240 315 H282 V230 H326'),e('M549 215 H631','aggregate',589,196),e('M786 215 H822','selective',806,197)],
    note:'Store messages even when presence claims the recipient is online.'
  },
  'chat-groups': {
    title:'Bound the write fanout', description:'Save one canonical group message, then enqueue delivery references for a small set of eligible members.',
    nodes:[n(32,170,169,'Sender','member A','phone'),n(250,170,194,'Group service','authorize + order','group'),n(502,82,192,'Channel log','one durable message','store'),n(502,268,192,'Fanout job','member references','queue'),n(764,84,196,'Member B','inbox + socket','phone'),n(764,268,196,'Member C','inbox + socket','phone')],
    edges:[e('M201 211 H250'),e('M444 196 H466 V123 H502','persist',464,104),e('M598 164 V268','after save',642,220),e('M694 309 H731 V125 H764'),e('M694 309 H764')],
    note:'For huge channels, copying to every member may cost more than read-time pull.'
  },
  'chat-recovery': {
    title:'Recover through replay and idempotency', description:'Durable history survives process failure; retryable work, reconnect, and stable message IDs rebuild delivery without duplicate records.',
    nodes:[n(34,167,179,'Client','saved cursor','phone'),n(269,86,203,'Gateway','replaceable sockets','gateway'),n(269,269,203,'Worker','retryable tasks','queue'),n(557,86,185,'History','replicated records','store'),n(557,269,185,'Job queue','unacked work','queue'),n(800,167,160,'Monitor','lag + reconnects','pulse')],
    edges:[e('M213 208 H240 V127 H269','reconnect',242,110),e('M557 127 H472','replay',514,110),e('M472 310 H557','ack / retry',513,293),e('M742 127 H770 V195 H800'),e('M742 310 H770 V220 H800'),e('M371 167 V269',undefined,undefined,undefined,true)],
    note:'At-least-once delivery needs deduplication by stable message ID.'
  },
};

function Pictogram({kind,x,y}:{kind:Icon;x:number;y:number}) {
  const p={fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <g transform={`translate(${x} ${y})`} className="chat-icon" aria-hidden="true">
    {kind==='phone' && <><rect x="5" y="1" width="18" height="27" rx="3" {...p}/><path d="M10 5h8M12 24h4" {...p}/></>}
    {kind==='gateway' && <><rect x="3" y="3" width="22" height="22" rx="3" {...p}/><path d="M8 9h12M8 14h12M8 19h7" {...p}/><circle cx="20" cy="19" r="1" fill="currentColor"/></>}
    {kind==='store' && <><ellipse cx="14" cy="5" rx="10" ry="4" {...p}/><path d="M4 5v18c0 5 20 5 20 0V5M4 14c0 5 20 5 20 0" {...p}/></>}
    {kind==='group' && <><circle cx="10" cy="9" r="4" {...p}/><circle cx="20" cy="11" r="3" {...p}/><path d="M2 25c1-7 15-7 16 0M17 21c5-2 8 0 9 4" {...p}/></>}
    {kind==='queue' && <><rect x="3" y="3" width="22" height="5" rx="1" {...p}/><rect x="3" y="12" width="22" height="5" rx="1" {...p}/><rect x="3" y="21" width="22" height="5" rx="1" {...p}/></>}
    {kind==='push' && <><path d="M7 11a7 7 0 0114 0v7l3 4H4l3-4zM11 25h6" {...p}/></>}
    {kind==='cursor' && <><path d="M6 4h16M6 11h16M6 18h10M6 25h8" {...p}/><path d="m18 18 5 4-5 4" {...p}/></>}
    {kind==='pulse' && <><path d="M2 15h5l3-8 5 15 3-7h8" {...p}/></>}
    {kind==='service' && <><rect x="2" y="5" width="24" height="18" rx="3" {...p}/><path d="M8 11h12M8 17h8" {...p}/></>}
    {kind==='shield' && <><path d="M14 2 24 6v8c0 7-5 10-10 13C9 24 4 21 4 14V6z" {...p}/><path d="m9 14 3 3 7-7" {...p}/></>}
    {kind==='clock' && <><circle cx="14" cy="14" r="11" {...p}/><path d="M14 7v8l5 3" {...p}/></>}
  </g>;
}

export function ChatDiagram({id,className}:{id:string;className?:string}) {
  const scene=scenes[id]; const unique=useId().replace(/:/g,'');
  if(!scene) return null;
  const titleId=`${unique}-title`, descId=`${unique}-desc`, hintId=`${unique}-hint`, markerId=`${unique}-arrow`;
  return <figure className={['chat-figure',className].filter(Boolean).join(' ')}>
    <div className="chat-scroll-hint" id={hintId}>Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="chat-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descId}>{scene.description}</desc>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--chat-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--chat-paper)"/>
        <text x="28" y="35" className="chat-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--chat-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge,i)=><g key={i}><path d={edge.path} fill="none" stroke="var(--chat-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={edge.dashed?'4 5':undefined} markerEnd={`url(#${markerId})`}/>{edge.label && <text x={edge.x} y={edge.y} textAnchor="middle" className="chat-edge-label">{edge.label}</text>}</g>)}
        {scene.nodes.map((node,i)=><g key={i}><rect x={node.x} y={node.y} width={node.w} height="82" rx="14" fill="var(--chat-card)" stroke="var(--chat-border)" strokeWidth="1.4"/><rect x={node.x+12} y={node.y+16} width="47" height="47" rx="12" fill="var(--chat-icon-bg)"/><Pictogram kind={node.icon} x={node.x+22} y={node.y+25}/><text x={node.x+68} y={node.y+35} className="chat-node-title">{node.title}</text><text x={node.x+68} y={node.y+56} className="chat-node-detail">{node.detail}</text></g>)}
        <text x="28" y="429" className="chat-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .chat-figure{--chat-paper:#fff;--chat-card:#f5f6f7;--chat-icon-bg:#e8eef1;--chat-ink:#252c30;--chat-secondary:#4b555a;--chat-line:#5b6a72;--chat-border:#859299;--chat-rule:#d2d9dc;margin:0;min-width:0;max-width:100%;color:var(--chat-ink);container-type:inline-size}
      .chat-scroll-hint{display:none}.chat-viewport{box-sizing:border-box;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--chat-rule);border-radius:18px;background:var(--chat-paper);scrollbar-width:thin;touch-action:pan-x pan-y;overscroll-behavior-inline:contain}.chat-viewport:focus-visible{outline:3px solid var(--accent,var(--chat-ink));outline-offset:3px}.chat-viewport svg{display:block;width:100%;min-width:940px;height:auto}.chat-figure figcaption{margin-top:.7rem;color:var(--muted,var(--chat-secondary));font-size:.875rem;line-height:1.55}
      .chat-heading{font:600 18px system-ui,-apple-system,sans-serif;fill:var(--chat-ink);letter-spacing:-.02em}.chat-node-title{font:650 13px system-ui,-apple-system,sans-serif;fill:var(--chat-ink)}.chat-node-detail{font:11px system-ui,-apple-system,sans-serif;fill:var(--chat-secondary)}.chat-icon{color:var(--chat-ink)}.chat-edge-label{font:600 11px system-ui,-apple-system,sans-serif;fill:var(--chat-line);paint-order:stroke;stroke:var(--chat-paper);stroke-width:5px;stroke-linejoin:round}.chat-note{font:12px system-ui,-apple-system,sans-serif;fill:var(--chat-secondary)}
      @container (max-width:940px){.chat-scroll-hint{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .5rem;color:var(--muted,var(--chat-secondary));font:600 .76rem system-ui,-apple-system,sans-serif}.chat-scroll-hint span{font-size:1.05rem}}
      @media (prefers-color-scheme:dark){.chat-figure{--chat-paper:#1d1d1f;--chat-card:#2b2d30;--chat-icon-bg:#364148;--chat-ink:#f2f3f4;--chat-secondary:#c7d0d4;--chat-line:#b6c1c7;--chat-border:#aab4ba;--chat-rule:#596168}}
      @media (prefers-contrast:more){.chat-figure{--chat-secondary:var(--chat-ink);--chat-line:var(--chat-ink);--chat-border:var(--chat-ink);--chat-rule:var(--chat-ink)}}
    `}</style>
  </figure>;
}
