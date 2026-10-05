import { useId } from 'react';

type Icon = 'event' | 'contract' | 'queue' | 'worker' | 'store' | 'policy' | 'device' | 'provider' | 'email' | 'sms' | 'clock' | 'monitor' | 'user';
type Node = { x: number; y: number; w: number; title: string; detail: string; icon: Icon };
type Edge = { path: string; label?: string; x?: number; y?: number; dashed?: boolean };
type Scene = { title: string; description: string; nodes: Node[]; edges: Edge[]; note: string };
const n = (x: number, y: number, w: number, title: string, detail: string, icon: Icon): Node => ({ x, y, w, title, detail, icon });
const e = (path: string, label?: string, x?: number, y?: number, dashed?: boolean): Edge => ({ path, label, x, y, dashed });

const scenes: Record<string, Scene> = {
  'notification-scope': {
    title: 'Four distinct observations', description: 'A product event becomes an accepted intent, a provider handoff, and possibly a later user action; none of these states implies the next.',
    nodes: [n(35, 178, 185, 'Product event', 'reason to notify', 'event'), n(287, 178, 193, 'Accepted intent', 'durably recorded', 'contract'), n(548, 178, 190, 'Provider', 'accepts request', 'provider'), n(805, 178, 160, 'Person', 'may act later', 'user')],
    edges: [e('M220 219 H287', 'submit', 252, 201), e('M480 219 H548', 'handoff', 514, 201), e('M738 219 H805', 'not guaranteed', 770, 157, true)],
    note: 'Promise a measurable state: acceptance, handoff, provider response, or engagement.'
  },
  'notification-ingest': {
    title: 'Persist the intent before acknowledgement', description: 'An authenticated product service writes a durable notification intent; a dispatcher can retry publishing it to a channel queue.',
    nodes: [n(32, 179, 176, 'Product', 'event + stable ID', 'event'), n(270, 179, 190, 'Send API', 'verify + validate', 'contract'), n(530, 90, 184, 'Intent store', 'outbox + status', 'store'), n(777, 90, 180, 'Channel queue', 'durable buffer', 'queue'), n(777, 275, 180, 'Worker', 'process later', 'worker')],
    edges: [e('M208 220 H270', 'request', 238, 202), e('M460 200 H490 V131 H530', 'commit', 492, 113), e('M714 131 H777', 'publish', 747, 113), e('M867 172 V275', 'consume', 905, 228)],
    note: 'A crash after the product commit is recoverable when the outbox remains.'
  },
  'notification-personalize': {
    title: 'Resolve eligibility at send time', description: 'The policy resolver reads current consent, destinations, and a versioned template before creating eligible attempts.',
    nodes: [n(33, 179, 190, 'Send intent', 'category + recipient', 'event'), n(292, 179, 195, 'Resolver', 'evaluate policy', 'policy'), n(553, 86, 179, 'Preferences', 'current consent', 'store'), n(553, 275, 179, 'Template', 'versioned content', 'contract'), n(798, 179, 168, 'Attempts', 'eligible channels', 'queue')],
    edges: [e('M223 220 H292'), e('M487 201 H518 V127 H553', 'read', 520, 108), e('M487 239 H518 V316 H553', 'render', 522, 344), e('M732 127 H764 V201 H798'), e('M732 316 H764 V239 H798')],
    note: 'Suppression is a recorded outcome; a queued campaign does not override a later opt-out.'
  },
  'notification-channels': {
    title: 'Isolate each delivery channel', description: 'Channel workers call their own provider adapters; a slow SMS provider does not block push or email.',
    nodes: [n(30, 179, 172, 'Eligible work', 'channel-specific', 'queue'), n(277, 72, 184, 'Push worker', 'device token', 'device'), n(277, 180, 184, 'Email worker', 'address', 'email'), n(277, 288, 184, 'SMS worker', 'phone number', 'sms'), n(629, 72, 180, 'Push service', 'platform provider', 'provider'), n(629, 180, 180, 'Email service', 'mail provider', 'provider'), n(629, 288, 180, 'SMS service', 'text gateway', 'provider')],
    edges: [e('M202 202 H239 V113 H277'), e('M202 220 H277'), e('M202 238 H239 V329 H277'), e('M461 113 H629'), e('M461 221 H629'), e('M461 329 H629')],
    note: 'Provider acceptance is not proof that a device displayed or a person read the alert.'
  },
  'notification-reliability': {
    title: 'Bound retries and preserve identity', description: 'Retry transient failures with the same logical identity; quarantine permanent or exhausted attempts for investigation.',
    nodes: [n(35, 177, 182, 'Attempt queue', 'at-least-once', 'queue'), n(287, 177, 186, 'Worker', 'stable attempt ID', 'worker'), n(550, 88, 185, 'Provider', 'accept / timeout', 'provider'), n(550, 274, 185, 'Attempt log', 'state + evidence', 'store'), n(803, 274, 163, 'Dead letter', 'inspect + replay', 'queue')],
    edges: [e('M217 218 H287'), e('M473 199 H514 V129 H550', 'send', 513, 112), e('M642 170 V274', 'record', 682, 226), e('M735 315 H803', 'exhausted', 768, 297), e('M550 149 H512 V260 H473', 'transient retry', 501, 157, true)],
    note: 'A timeout can be ambiguous; idempotency reduces duplicates but cannot always remove them.'
  },
  'notification-pacing': {
    title: 'Release work at a sustainable rate', description: 'The scheduler releases bounded batches under user frequency and provider capacity limits while reserving room for urgent work.',
    nodes: [n(34, 179, 186, 'Schedule', 'due time + zone', 'clock'), n(283, 179, 189, 'Pacer', 'consent + limits', 'policy'), n(545, 85, 190, 'Urgent lane', 'reserved capacity', 'queue'), n(545, 276, 190, 'Campaign lane', 'bounded batches', 'queue'), n(804, 179, 162, 'Provider', 'throughput quota', 'provider')],
    edges: [e('M220 220 H283'), e('M472 201 H511 V126 H545'), e('M472 239 H511 V317 H545'), e('M735 126 H769 V200 H804'), e('M735 317 H769 V239 H804')],
    note: 'Track oldest-item age; a steady queue length can still hide late messages.'
  },
  'notification-operations': {
    title: 'Trace one notification end to end', description: 'A stable ID connects intent, queue, provider response, and later callback, while monitoring detects slow or failing stages.',
    nodes: [n(32, 140, 171, 'Intent', 'accepted / suppressed', 'event'), n(268, 140, 175, 'Queue', 'waiting / retrying', 'queue'), n(509, 140, 183, 'Provider', 'accepted / rejected', 'provider'), n(762, 140, 197, 'Callback', 'bounce / delivered', 'contract'), n(395, 292, 245, 'Monitor', 'lag, errors, dead letters', 'monitor')],
    edges: [e('M203 181 H268'), e('M443 181 H509'), e('M692 181 H762'), e('M356 222 V261 H474 V292', 'queue age', 390, 259), e('M600 222 V292', 'errors', 632, 260)],
    note: 'Opens and clicks are incomplete signals, not proof of receipt.'
  },
};

function Pictogram({ kind, x, y }: { kind: Icon; x: number; y: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <g transform={`translate(${x} ${y})`} className="notification-icon" aria-hidden="true">
    {kind === 'event' && <><path d="M4 6h20v16H4zM8 2v8M20 2v8M8 15h12" {...p}/></>}
    {kind === 'contract' && <><path d="M6 2h13l5 5v19H6zM18 2v6h6M10 13h10M10 18h10M10 23h7" {...p}/></>}
    {kind === 'queue' && <><rect x="3" y="3" width="22" height="5" rx="1" {...p}/><rect x="3" y="12" width="22" height="5" rx="1" {...p}/><rect x="3" y="21" width="22" height="5" rx="1" {...p}/></>}
    {kind === 'worker' && <><circle cx="14" cy="14" r="6" {...p}/><circle cx="14" cy="14" r="2" {...p}/><path d="M14 1v5M14 22v5M1 14h5M22 14h5M5 5l4 4M19 19l4 4M23 5l-4 4M9 19l-4 4" {...p}/></>}
    {kind === 'store' && <><ellipse cx="14" cy="5" rx="10" ry="4" {...p}/><path d="M4 5v18c0 5 20 5 20 0V5M4 14c0 5 20 5 20 0" {...p}/></>}
    {kind === 'policy' && <><path d="M14 2 24 6v8c0 7-5 10-10 13C9 24 4 21 4 14V6zM9 14l3 3 7-7" {...p}/></>}
    {kind === 'device' && <><rect x="5" y="1" width="18" height="27" rx="3" {...p}/><path d="M10 5h8M12 24h4" {...p}/></>}
    {kind === 'provider' && <><path d="M4 21h20M7 21V9l7-5 7 5v12M10 12h8M10 16h8" {...p}/></>}
    {kind === 'email' && <><rect x="2" y="5" width="24" height="18" rx="2" {...p}/><path d="m3 7 11 9 11-9" {...p}/></>}
    {kind === 'sms' && <><path d="M3 4h22v16H11l-6 5v-5H3zM8 10h12M8 15h8" {...p}/></>}
    {kind === 'clock' && <><circle cx="14" cy="14" r="11" {...p}/><path d="M14 7v8l5 3" {...p}/></>}
    {kind === 'monitor' && <><rect x="2" y="4" width="24" height="17" rx="2" {...p}/><path d="M8 26h12M14 21v5M5 13h4l2-4 4 8 2-4h5" {...p}/></>}
    {kind === 'user' && <><circle cx="14" cy="8" r="5" {...p}/><path d="M3 27c0-11 22-11 22 0" {...p}/></>}
  </g>;
}

export function NotificationDiagram({ id, className }: { id: string; className?: string }) {
  const scene = scenes[id];
  const unique = useId().replace(/:/g, '');
  if (!scene) return null;
  const titleId = `${unique}-title`, descId = `${unique}-desc`, hintId = `${unique}-hint`, markerId = `${unique}-arrow`;
  return <figure className={['notification-figure', className].filter(Boolean).join(' ')}>
    <div className="notification-scroll-hint" id={hintId}>Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="notification-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={hintId}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descId}>{scene.description}</desc>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--notification-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--notification-paper)"/>
        <text x="28" y="35" className="notification-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--notification-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge, i) => <g key={i}><path d={edge.path} fill="none" stroke="var(--notification-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={edge.dashed ? '4 5' : undefined} markerEnd={`url(#${markerId})`}/>{edge.label && <text x={edge.x} y={edge.y} textAnchor="middle" className="notification-edge-label">{edge.label}</text>}</g>)}
        {scene.nodes.map((node, i) => <g key={i}><rect x={node.x} y={node.y} width={node.w} height="82" rx="14" fill="var(--notification-card)" stroke="var(--notification-border)" strokeWidth="1.4"/><rect x={node.x + 12} y={node.y + 16} width="47" height="47" rx="12" fill="var(--notification-icon-bg)"/><Pictogram kind={node.icon} x={node.x + 22} y={node.y + 25}/><text x={node.x + 68} y={node.y + 35} className="notification-node-title">{node.title}</text><text x={node.x + 68} y={node.y + 56} className="notification-node-detail">{node.detail}</text></g>)}
        <text x="28" y="429" className="notification-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .notification-figure{--notification-paper:#fff;--notification-card:#f5f6f7;--notification-icon-bg:#e8eef1;--notification-ink:#252c30;--notification-secondary:#4b555a;--notification-line:#5b6a72;--notification-border:#859299;--notification-rule:#d2d9dc;margin:0;min-width:0;max-width:100%;color:var(--notification-ink);container-type:inline-size}
      .notification-scroll-hint{display:none}.notification-viewport{box-sizing:border-box;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;border:1px solid var(--notification-rule);border-radius:18px;background:var(--notification-paper);scrollbar-width:thin;touch-action:pan-x pan-y;overscroll-behavior-inline:contain}.notification-viewport:focus-visible{outline:3px solid var(--accent,var(--notification-ink));outline-offset:3px}.notification-viewport svg{display:block;width:100%;min-width:940px;height:auto}.notification-figure figcaption{margin-top:.7rem;color:var(--muted,var(--notification-secondary));font-size:.875rem;line-height:1.55}
      .notification-heading{font:600 18px system-ui,-apple-system,sans-serif;fill:var(--notification-ink);letter-spacing:-.02em}.notification-node-title{font:650 13px system-ui,-apple-system,sans-serif;fill:var(--notification-ink)}.notification-node-detail{font:11px system-ui,-apple-system,sans-serif;fill:var(--notification-secondary)}.notification-icon{color:var(--notification-ink)}.notification-edge-label{font:600 11px system-ui,-apple-system,sans-serif;fill:var(--notification-line);paint-order:stroke;stroke:var(--notification-paper);stroke-width:5px;stroke-linejoin:round}.notification-note{font:12px system-ui,-apple-system,sans-serif;fill:var(--notification-secondary)}
      @container (max-width:940px){.notification-scroll-hint{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .5rem;color:var(--muted,var(--notification-secondary));font:600 .76rem system-ui,-apple-system,sans-serif}.notification-scroll-hint span{font-size:1.05rem}}
      @media (prefers-color-scheme:dark){.notification-figure{--notification-paper:#1d1d1f;--notification-card:#2b2d30;--notification-icon-bg:#364148;--notification-ink:#f2f3f4;--notification-secondary:#c7d0d4;--notification-line:#b6c1c7;--notification-border:#aab4ba;--notification-rule:#596168}}
      @media (prefers-contrast:more){.notification-figure{--notification-secondary:var(--notification-ink);--notification-line:var(--notification-ink);--notification-border:var(--notification-ink);--notification-rule:var(--notification-ink)}}
    `}</style>
  </figure>;
}
