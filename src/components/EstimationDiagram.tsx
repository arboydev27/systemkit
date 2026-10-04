import { useId } from "react";

type Tone = "input" | "operation" | "result";
type Tile = { x: number; y: number; width: number; title: string; detail: string; tone: Tone };
type Arrow = { points: [number, number][]; label?: string; labelAt?: [number, number] };
type Scene = { title: string; description: string; tiles: Tile[]; arrows: Arrow[]; note: string };

const tile = (x: number, y: number, width: number, title: string, detail: string, tone: Tone): Tile => ({ x, y, width, title, detail, tone });
const arrow = (points: [number, number][], label?: string, labelAt?: [number, number]): Arrow => ({ points, label, labelAt });

const scenes: Record<string, Scene> = {
  "estimate-workload": {
    title: "Turn accounts into daily actions",
    description: "Five million accounts times a twenty percent active share yields one million daily active people. Ten feed opens each yield ten million reads per day.",
    tiles: [
      tile(25, 145, 205, "5M accounts", "registered people", "input"),
      tile(283, 145, 205, "× 20% active", "stated assumption", "operation"),
      tile(541, 145, 205, "1M daily active", "people using the app", "result"),
      tile(799, 145, 175, "× 10 opens", "per active person", "operation"),
      tile(390, 284, 220, "10M reads/day", "the workload to size", "result"),
    ],
    arrows: [arrow([[230, 185], [283, 185]]), arrow([[488, 185], [541, 185]]), arrow([[746, 185], [799, 185]]), arrow([[887, 227], [887, 318], [610, 318]])],
    note: "Changing the active share changes the answer; record it beside the calculation.",
  },
  "estimate-traffic": {
    title: "Daily volume is not peak capacity",
    description: "Divide 8.64 million daily reads by 86,400 seconds to get 100 average reads per second. A fourfold peak gives about 400 reads per second.",
    tiles: [
      tile(45, 164, 220, "8.64M reads/day", "daily volume", "input"),
      tile(390, 164, 220, "÷ 86,400", "seconds in a day", "operation"),
      tile(735, 164, 220, "100 reads/s", "daily average", "result"),
      tile(390, 295, 220, "× 4 busy peak", "observed or assumed", "operation"),
      tile(735, 295, 220, "400 reads/s", "starting peak target", "result"),
    ],
    arrows: [arrow([[265, 204], [390, 204]]), arrow([[610, 204], [735, 204]]), arrow([[845, 244], [845, 273], [500, 273], [500, 295]]), arrow([[610, 335], [735, 335]])],
    note: "Add failure and growth headroom after estimating the expected peak.",
  },
  "estimate-data": {
    title: "Separate stored bytes from delivered bytes",
    description: "Upload count and item size drive stored data. View count and bytes per view drive delivery. Replicas, renditions, and backups add physical storage.",
    tiles: [
      tile(35, 117, 210, "200k uploads/day", "new stored items", "input"),
      tile(289, 117, 180, "× 4 MB", "average item size", "operation"),
      tile(513, 117, 200, "800 GB/day", "logical storage", "result"),
      tile(757, 117, 210, "≈ 292 TB/year", "before extra copies", "result"),
      tile(35, 281, 210, "Views/day", "repeated reads", "input"),
      tile(289, 281, 180, "× bytes/view", "delivered size", "operation"),
      tile(513, 281, 200, "Transfer/day", "delivery capacity", "result"),
    ],
    arrows: [arrow([[245, 157], [289, 157]]), arrow([[469, 157], [513, 157]]), arrow([[713, 157], [757, 157]]), arrow([[245, 321], [289, 321]]), arrow([[469, 321], [513, 321]])],
    note: "A file can be stored once and delivered to many viewers.",
  },
  "estimate-limits": {
    title: "Quality targets become measurable budgets",
    description: "Example response path: 40 milliseconds of network, 30 of app, 110 of data, and 20 of reserve fit a 200 millisecond target. A 99.9 percent target allows 43.2 minutes of downtime in thirty days.",
    tiles: [
      tile(30, 139, 210, "40 ms network", "travel and transport", "input"),
      tile(272, 139, 210, "30 ms app", "business logic", "input"),
      tile(514, 139, 210, "110 ms data", "query and response", "input"),
      tile(756, 139, 210, "20 ms reserve", "remaining budget", "operation"),
      tile(272, 288, 210, "200 ms target", "full request path", "result"),
      tile(514, 288, 210, "99.9% uptime", "43.2 min / 30 days", "result"),
    ],
    arrows: [arrow([[240, 179], [272, 179]], "+", [256, 169]), arrow([[482, 179], [514, 179]], "+", [498, 169]), arrow([[724, 179], [756, 179]], "+", [740, 169]), arrow([[861, 219], [861, 264], [377, 264], [377, 288]])],
    note: "These are illustrative budgets; measure the actual path and its slow requests.",
  },
  "estimate-decisions": {
    title: "Capacity math changes the deployment choice",
    description: "At a peak of 1,200 requests per second and 210 usable requests per second per instance, six healthy instances are needed. A seventh provides room for one instance to fail.",
    tiles: [
      tile(28, 154, 218, "1,200 peak req/s", "expected busy load", "input"),
      tile(277, 154, 218, "÷ 210 req/s", "300 measured × 70%", "operation"),
      tile(526, 154, 218, "6 healthy", "round 5.72 upward", "result"),
      tile(775, 154, 198, "+ 1 spare", "survive one failure", "operation"),
      tile(390, 296, 220, "7 deployed", "verify in a load test", "result"),
    ],
    arrows: [arrow([[246, 194], [277, 194]]), arrow([[495, 194], [526, 194]]), arrow([[744, 194], [775, 194]]), arrow([[874, 234], [874, 330], [610, 330]])],
    note: "Change the peak or safe utilization and recalculate before committing.",
  },
};

const fills: Record<Tone, string> = { input: "var(--ed-input)", operation: "var(--ed-operation)", result: "var(--ed-result)" };

export function EstimationDiagram({ id }: { id: string }) {
  const scene = scenes[id];
  if (!scene) return null;
  return <EstimationScene scene={scene} />;
}

function EstimationScene({ scene }: { scene: Scene }) {
  const uid = useId().replace(/:/g, "");
  const marker = `${uid}-arrow`;
  return <figure className="estimation-figure">
    <div className="estimation-scroll-hint">Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="estimation-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${uid}-title ${uid}-description`}>
        <title id={`${uid}-title`}>{scene.title}</title><desc id={`${uid}-description`}>{scene.description}</desc>
        <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--ed-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--ed-paper)" />
        <text x="28" y="37" className="estimation-heading">{scene.title}</text><path d="M28 53H972" stroke="var(--ed-rule)" strokeDasharray="3 7" />
        {scene.arrows.map((item, index) => <g key={index}><path d={item.points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")} fill="none" stroke="var(--ed-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${marker})`} />{item.label && item.labelAt ? <text x={item.labelAt[0]} y={item.labelAt[1]} className="estimation-operator" textAnchor="middle">{item.label}</text> : null}</g>)}
        {scene.tiles.map((item, index) => <g key={index}><rect x={item.x} y={item.y} width={item.width} height="80" rx="14" fill={fills[item.tone]} stroke="var(--ed-border)" strokeWidth="1.4" /><text x={item.x + 18} y={item.y + 34} className="estimation-tile-title">{item.title}</text><text x={item.x + 18} y={item.y + 59} className="estimation-tile-detail">{item.detail}</text></g>)}
        <text x="28" y="428" className="estimation-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .estimation-figure { --ed-paper:#fff; --ed-input:#f8f8f8; --ed-operation:#f1f1f1; --ed-result:#e9e9e9; --ed-ink:#222; --ed-secondary:#555; --ed-border:#888; --ed-line:#555; --ed-rule:#ddd; margin:0; min-width:0; max-width:100%; container-type:inline-size; }
      .estimation-scroll-hint { display:none; }
      .estimation-viewport { width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; border:1px solid var(--ed-rule); border-radius:18px; background:var(--ed-paper); scrollbar-width:thin; touch-action:pan-x pan-y; overscroll-behavior-inline:contain; }
      .estimation-viewport:focus-visible { outline:3px solid var(--accent); outline-offset:3px; }
      .estimation-viewport svg { display:block; width:100%; min-width:940px; height:auto; }
      .estimation-figure figcaption { margin-top:.7rem; color:var(--muted); font-size:.875rem; line-height:1.55; }
      .estimation-heading { fill:var(--ed-ink); font:600 18px system-ui,-apple-system,sans-serif; letter-spacing:-.02em; }
      .estimation-tile-title { fill:var(--ed-ink); font:700 18px system-ui,-apple-system,sans-serif; letter-spacing:-.025em; }
      .estimation-tile-detail { fill:var(--ed-secondary); font:13px system-ui,-apple-system,sans-serif; }
      .estimation-note { fill:var(--ed-secondary); font:13px system-ui,-apple-system,sans-serif; }
      .estimation-operator { fill:var(--ed-line); font:700 16px system-ui,-apple-system,sans-serif; paint-order:stroke; stroke:var(--ed-paper); stroke-width:5px; }
      @container (max-width:940px) { .estimation-scroll-hint { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:0 0 .5rem; color:var(--muted); font:600 .76rem system-ui,-apple-system,sans-serif; } }
      @media (prefers-color-scheme:dark) { .estimation-figure { --ed-paper:#1d1d1f; --ed-input:#29292c; --ed-operation:#333336; --ed-result:#3b3b3e; --ed-ink:#f1f1f2; --ed-secondary:#c5c5c8; --ed-border:#a9a9ad; --ed-line:#b6b6ba; --ed-rule:#57575b; } }
      @media (prefers-contrast:more) { .estimation-figure { --ed-secondary:var(--ed-ink); --ed-border:var(--ed-ink); --ed-line:var(--ed-ink); --ed-rule:var(--ed-ink); } }
    `}</style>
  </figure>;
}
