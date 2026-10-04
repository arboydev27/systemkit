import { useId } from "react";

type Kind = "question" | "input" | "method" | "decision" | "artifact";
type Card = { x: number; y: number; w: number; title: string; detail: string; kind: Kind; badge: string };
type Link = { points: [number, number][]; label?: string; at?: [number, number]; dashed?: boolean };
type Scene = { title: string; description: string; cards: Card[]; links: Link[]; note: string };

const c = (x: number, y: number, w: number, title: string, detail: string, kind: Kind, badge: string): Card => ({ x, y, w, title, detail, kind, badge });
const l = (points: [number, number][], label?: string, at?: [number, number], dashed?: boolean): Link => ({ points, label, at, dashed });

const scenes: Record<string, Scene> = {
  "framework-scope": {
    title: "Turn a vague prompt into a bounded problem",
    description: "Ask who the system serves and what success means, then state a practical boundary before designing components.",
    cards: [c(40, 173, 220, "Initial prompt", "Build a photo service", "question", "?"), c(382, 173, 224, "Clarifying questions", "users · jobs · boundaries", "method", "01"), c(722, 173, 230, "Agreed scope", "a testable first version", "artifact", "✓")],
    links: [l([[260, 210], [382, 210]], "ask before drawing", [320, 190]), l([[606, 210], [722, 210]], "state the boundary", [665, 190])],
    note: "A design needs an agreed problem before it needs a component list.",
  },
  "framework-requirements": {
    title: "Separate behavior from quality goals",
    description: "Collect what the product must do, how well it must work, and what is still assumed. Prioritize these into a design brief.",
    cards: [c(38, 88, 238, "Functional needs", "actions people can perform", "input", "F"), c(38, 196, 238, "Quality goals", "latency · availability · cost", "input", "Q"), c(38, 304, 238, "Assumptions", "unknowns to validate", "question", "?"), c(389, 196, 222, "Prioritize", "resolve the tradeoffs", "decision", "02"), c(736, 196, 222, "Design brief", "constraints + success checks", "artifact", "✓")],
    links: [l([[276, 125], [329, 125], [329, 221], [389, 221]]), l([[276, 233], [389, 233]]), l([[276, 341], [329, 341], [329, 245], [389, 245]], undefined, undefined, true), l([[611, 233], [736, 233]], "write down", [674, 212])],
    note: "Mark assumptions openly; they should not quietly become requirements.",
  },
  "framework-estimates": {
    title: "Use estimates to test a hypothesis",
    description: "Start with rough traffic and data assumptions, derive order-of-magnitude rates, then ask whether a proposed component can handle them.",
    cards: [c(42, 174, 238, "Assumed workload", "users · actions · bytes", "input", "≈"), c(382, 174, 234, "Derived demand", "QPS · storage · bandwidth", "method", "×"), c(719, 174, 238, "Capacity check", "headroom or bottleneck?", "decision", "?")],
    links: [l([[280, 211], [382, 211]], "calculate", [330, 190]), l([[616, 211], [719, 211]], "compare", [667, 190]), l([[838, 248], [838, 321], [160, 321], [160, 248]], "revise a weak assumption", [500, 344], true)],
    note: "The useful output is a decision and its uncertainty, not a precise-looking number.",
  },
  "framework-blueprint": {
    title: "Draw the smallest complete path",
    description: "Show the client, the request handler, and persistent data first. Add a component only when a requirement gives it a job.",
    cards: [c(40, 157, 216, "Client", "starts a user action", "input", "01"), c(378, 157, 232, "Service", "handles the request", "method", "02"), c(734, 157, 224, "Data store", "keeps durable state", "artifact", "03"), c(378, 287, 232, "Boundary notes", "ownership · failure · trust", "question", "!")],
    links: [l([[256, 194], [378, 194]], "request", [317, 175]), l([[610, 194], [734, 194]], "read / write", [671, 175]), l([[494, 231], [494, 287]], undefined, undefined, true)],
    note: "This is a starting model. Extend it when a need or failure demands it.",
  },
  "framework-flows": {
    title: "Trace the two important journeys",
    description: "Walk through a write and a read in order, naming what each step returns and what can fail.",
    cards: [c(36, 111, 202, "Write request", "create or change", "input", "W"), c(371, 111, 224, "Validate & persist", "check · store · confirm", "method", "→"), c(733, 111, 220, "Write response", "success or error", "artifact", "✓"), c(36, 280, 202, "Read request", "retrieve a view", "input", "R"), c(371, 280, 224, "Fetch & shape", "find · authorize · format", "method", "→"), c(733, 280, 220, "Read response", "data or error", "artifact", "✓")],
    links: [l([[238, 148], [371, 148]], "write path", [304, 129]), l([[595, 148], [733, 148]]), l([[238, 317], [371, 317]], "read path", [304, 298]), l([[595, 317], [733, 317]])],
    note: "A box diagram is incomplete until a real action can travel through it.",
  },
  "framework-iterate": {
    title: "Treat the first drawing as a draft",
    description: "Present a simple design, test it against requirements and feedback, and revise the design where evidence reveals a gap.",
    cards: [c(52, 132, 226, "Draft design", "state your choices", "method", "01"), c(386, 132, 226, "Test against goals", "trace flows & tradeoffs", "decision", "02"), c(721, 132, 226, "Get feedback", "surface weak spots", "question", "03"), c(386, 301, 226, "Revise one choice", "explain what changed", "artifact", "04")],
    links: [l([[278, 169], [386, 169]]), l([[612, 169], [721, 169]]), l([[834, 206], [834, 338], [612, 338]]), l([[386, 338], [165, 338], [165, 206]], "next draft", [280, 321], true)],
    note: "Record why a decision changed so the design remains explainable.",
  },
  "framework-deep-dive": {
    title: "Go deep where the risk is highest",
    description: "Choose a critical component or bottleneck, compare alternatives against the stated goals, and document the chosen tradeoff.",
    cards: [c(43, 177, 226, "Risk signal", "bottleneck or failure", "question", "!"), c(379, 177, 240, "Compare options", "cost · complexity · gain", "method", "↔"), c(730, 177, 228, "Chosen tradeoff", "decision + reason", "artifact", "✓")],
    links: [l([[269, 214], [379, 214]], "focus", [324, 194]), l([[619, 214], [730, 214]], "justify", [674, 194])],
    note: "Depth should follow risk; it does not require redesigning every part at once.",
  },
  "framework-review": {
    title: "Review the design before moving on",
    description: "Check failure behavior, day-to-day operations, and the next likely capacity limit. Turn unresolved risks into explicit follow-up work.",
    cards: [c(38, 91, 242, "Failure behavior", "what breaks first?", "question", "01"), c(38, 200, 242, "Operations", "observe · deploy · recover", "question", "02"), c(38, 309, 242, "Next scale curve", "which limit arrives next?", "question", "03"), c(388, 200, 226, "Record gaps", "risks · assumptions · owners", "method", "→"), c(732, 200, 226, "Next steps", "measurable follow-ups", "artifact", "✓")],
    links: [l([[280, 128], [331, 128], [331, 225], [388, 225]]), l([[280, 237], [388, 237]]), l([[280, 346], [331, 346], [331, 249], [388, 249]]), l([[614, 237], [732, 237]], "prioritize", [672, 216])],
    note: "A useful review leaves a clear record of what is known and what remains uncertain.",
  },
};

const fills: Record<Kind, string> = { question: "var(--fw-question)", input: "var(--fw-input)", method: "var(--fw-method)", decision: "var(--fw-decision)", artifact: "var(--fw-artifact)" };

function CardShape({ card }: { card: Card }) {
  return <g>
    <rect x={card.x} y={card.y} width={card.w} height="74" rx="14" fill={fills[card.kind]} stroke="var(--fw-border)" strokeWidth="1.5" />
    <path d={`M${card.x + 12} ${card.y + 1}h${card.w - 24}`} stroke="var(--fw-edge)" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx={card.x + 31} cy={card.y + 37} r="17" fill="var(--fw-paper)" stroke="var(--fw-border)" strokeWidth="1.2" />
    <text x={card.x + 31} y={card.y + 42} textAnchor="middle" className="framework-card-tag" aria-hidden="true">{card.badge}</text>
    <text x={card.x + 58} y={card.y + 32} className="framework-card-title">{card.title}</text>
    <text x={card.x + 58} y={card.y + 52} className="framework-card-detail">{card.detail}</text>
  </g>;
}

function LinkShape({ link, markerId }: { link: Link; markerId: string }) {
  const d = link.points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
  return <g>
    <path d={d} fill="none" stroke="var(--fw-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={link.dashed ? "4 5" : undefined} markerEnd={`url(#${markerId})`} />
    {link.label && link.at && <text x={link.at[0]} y={link.at[1]} textAnchor="middle" className="framework-link-label">{link.label}</text>}
  </g>;
}

export function FrameworkDiagram({ id, className }: { id: string; className?: string }) {
  const scene = scenes[id];
  if (!scene) return null;
  return <FrameworkScene scene={scene} className={className} />;
}

function FrameworkScene({ scene, className }: { scene: Scene; className?: string }) {
  const uniqueId = useId().replace(/:/g, "");
  const titleId = `${uniqueId}-title`;
  const descriptionId = `${uniqueId}-description`;
  const scrollHintId = `${uniqueId}-scroll-hint`;
  const markerId = `${uniqueId}-arrow`;
  return <figure className={["framework-figure", className].filter(Boolean).join(" ")}>
    <div id={scrollHintId} className="framework-scroll-hint"><span>Swipe or scroll to explore the full diagram</span><span aria-hidden="true">→</span></div>
    <div className="framework-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={scrollHintId}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
        <title id={titleId}>{scene.title}</title><desc id={descriptionId}>{scene.description}</desc>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--fw-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--fw-paper)" />
        <text x="28" y="34" className="framework-heading">{scene.title}</text><path d="M28 51H972" stroke="var(--fw-rule)" strokeDasharray="3 7" />
        {scene.links.map((link, index) => <LinkShape key={index} link={link} markerId={markerId} />)}
        {scene.cards.map((card, index) => <CardShape key={index} card={card} />)}
        <text x="28" y="430" className="framework-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .framework-figure { --fw-paper:#fff; --fw-question:#f9f9f9; --fw-input:#f6f6f6; --fw-method:#f1f1f1; --fw-decision:#ececec; --fw-artifact:#e8e8e8; --fw-ink:#222; --fw-secondary:#505050; --fw-border:#777; --fw-edge:#aaa; --fw-line:#555; --fw-rule:#d5d5d5; margin:0; min-width:0; max-width:100%; color:var(--fw-ink); container-type:inline-size; }
      .framework-scroll-hint { display:none; }
      .framework-viewport { box-sizing:border-box; width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; border:1px solid var(--fw-rule); border-radius:18px; background:var(--fw-paper); scrollbar-width:thin; touch-action:pan-x pan-y; overscroll-behavior-inline:contain; }
      .framework-viewport:focus-visible { outline:3px solid var(--accent, var(--fw-ink)); outline-offset:3px; }
      .framework-viewport svg { display:block; width:100%; min-width:940px; height:auto; }
      .framework-figure figcaption { margin-top:.7rem; color:var(--muted, var(--fw-secondary)); font-size:.875rem; line-height:1.55; }
      .framework-heading { font:600 18px system-ui,-apple-system,sans-serif; fill:var(--fw-ink); letter-spacing:-.02em; }
      .framework-card-tag { font:650 13px system-ui,-apple-system,sans-serif; fill:var(--fw-ink); }
      .framework-card-title { font:650 14px system-ui,-apple-system,sans-serif; fill:var(--fw-ink); letter-spacing:-.025em; }
      .framework-card-detail { font:12px system-ui,-apple-system,sans-serif; fill:var(--fw-secondary); }
      .framework-link-label { font:600 12px system-ui,-apple-system,sans-serif; fill:var(--fw-line); paint-order:stroke; stroke:var(--fw-paper); stroke-width:5px; stroke-linejoin:round; }
      .framework-note { font:13px system-ui,-apple-system,sans-serif; fill:var(--fw-secondary); }
      @container (max-width:940px) { .framework-scroll-hint { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:0 0 .5rem; color:var(--muted, var(--fw-secondary)); font:600 .76rem system-ui,-apple-system,sans-serif; } .framework-scroll-hint span:last-child { font-size:1.05rem; } }
      @media (prefers-color-scheme:dark) { .framework-figure { --fw-paper:#1d1d1f; --fw-question:#262629; --fw-input:#29292c; --fw-method:#303033; --fw-decision:#363639; --fw-artifact:#3a3a3d; --fw-ink:#f1f1f2; --fw-secondary:#c5c5c8; --fw-border:#a9a9ad; --fw-edge:#77777b; --fw-line:#b6b6ba; --fw-rule:#57575b; } }
      @media (prefers-contrast:more) { .framework-figure { --fw-secondary:var(--fw-ink); --fw-border:var(--fw-ink); --fw-line:var(--fw-ink); --fw-rule:var(--fw-ink); } }
    `}</style>
  </figure>;
}
