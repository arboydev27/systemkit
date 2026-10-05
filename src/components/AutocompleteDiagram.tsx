import { useId } from 'react';

type Kind = 'client' | 'api' | 'index' | 'list' | 'stream' | 'trie' | 'cache' | 'worker' | 'policy' | 'storage' | 'router' | 'metric';
type Node = { x:number; y:number; w:number; title:string; detail:string; kind:Kind };
type Edge = { points:[number,number][] };
type Scene = { title:string; description:string; note:string; nodes:Node[]; edges:Edge[] };
const scenes: Record<string, Scene> = {
  "autocomplete-scope": {
    "title": "A prefix must keep its context",
    "description": "The current input and locale reach the suggestion service; late responses for older input are discarded.",
    "note": "Only suggestions for the latest input should appear.",
    "nodes": [
      {
        "x": 35,
        "y": 184,
        "w": 175,
        "title": "Typing client",
        "detail": "latest input",
        "kind": "client"
      },
      {
        "x": 292,
        "y": 184,
        "w": 190,
        "title": "Query API",
        "detail": "prefix + locale",
        "kind": "api"
      },
      {
        "x": 566,
        "y": 184,
        "w": 190,
        "title": "Ranked index",
        "detail": "public candidates",
        "kind": "index"
      },
      {
        "x": 798,
        "y": 184,
        "w": 170,
        "title": "Suggestion list",
        "detail": "five safe results",
        "kind": "list"
      }
    ],
    "edges": [
      {
        "points": [
          [
            210,
            221
          ],
          [
            292,
            221
          ]
        ]
      },
      {
        "points": [
          [
            482,
            221
          ],
          [
            566,
            221
          ]
        ]
      },
      {
        "points": [
          [
            756,
            221
          ],
          [
            798,
            221
          ]
        ]
      }
    ]
  },
  "autocomplete-traffic": {
    "title": "One search, several reads",
    "description": "Suggestion reads happen during typing; a completed-search event is a separate signal for ranking.",
    "note": "Count prefix reads and submitted searches separately.",
    "nodes": [
      {
        "x": 35,
        "y": 180,
        "w": 170,
        "title": "Typing client",
        "detail": "four requests",
        "kind": "client"
      },
      {
        "x": 300,
        "y": 105,
        "w": 205,
        "title": "Suggestion API",
        "detail": "read-heavy path",
        "kind": "api"
      },
      {
        "x": 300,
        "y": 295,
        "w": 205,
        "title": "Submit search",
        "detail": "one completion",
        "kind": "client"
      },
      {
        "x": 660,
        "y": 105,
        "w": 220,
        "title": "Serving index",
        "detail": "fast prefix reads",
        "kind": "index"
      },
      {
        "x": 660,
        "y": 295,
        "w": 220,
        "title": "Event log",
        "detail": "ranking signal",
        "kind": "stream"
      }
    ],
    "edges": [
      {
        "points": [
          [
            205,
            200
          ],
          [
            252,
            200
          ],
          [
            252,
            142
          ],
          [
            300,
            142
          ]
        ]
      },
      {
        "points": [
          [
            205,
            234
          ],
          [
            252,
            234
          ],
          [
            252,
            332
          ],
          [
            300,
            332
          ]
        ]
      },
      {
        "points": [
          [
            505,
            142
          ],
          [
            660,
            142
          ]
        ]
      },
      {
        "points": [
          [
            505,
            332
          ],
          [
            660,
            332
          ]
        ]
      }
    ]
  },
  "autocomplete-prefix": {
    "title": "Lookup is not top-K selection",
    "description": "A trie path locates a prefix; stored top-K candidates avoid scanning a broad subtree on every request.",
    "note": "Precomputed candidates save reads at a memory cost.",
    "nodes": [
      {
        "x": 35,
        "y": 180,
        "w": 160,
        "title": "Input: ca",
        "detail": "two characters",
        "kind": "client"
      },
      {
        "x": 268,
        "y": 180,
        "w": 160,
        "title": "Prefix node",
        "detail": "trie path O(p)",
        "kind": "trie"
      },
      {
        "x": 535,
        "y": 180,
        "w": 195,
        "title": "Top-K cache",
        "detail": "bounded candidates",
        "kind": "cache"
      },
      {
        "x": 795,
        "y": 180,
        "w": 170,
        "title": "Results",
        "detail": "ranked matches",
        "kind": "list"
      },
      {
        "x": 535,
        "y": 310,
        "w": 195,
        "title": "Descendants",
        "detail": "costly to scan",
        "kind": "trie"
      }
    ],
    "edges": [
      {
        "points": [
          [
            195,
            217
          ],
          [
            268,
            217
          ]
        ]
      },
      {
        "points": [
          [
            428,
            217
          ],
          [
            535,
            217
          ]
        ]
      },
      {
        "points": [
          [
            730,
            217
          ],
          [
            795,
            217
          ]
        ]
      },
      {
        "points": [
          [
            632,
            310
          ],
          [
            632,
            254
          ]
        ]
      }
    ]
  },
  "autocomplete-rank": {
    "title": "Rank, filter, then take five",
    "description": "Scores order a larger candidate pool; policy removal happens before the final visible top five.",
    "note": "Exactly five cached candidates may leave fewer than five after filtering.",
    "nodes": [
      {
        "x": 30,
        "y": 180,
        "w": 190,
        "title": "Count windows",
        "detail": "historical + recent",
        "kind": "stream"
      },
      {
        "x": 283,
        "y": 180,
        "w": 170,
        "title": "Score",
        "detail": "context + ties",
        "kind": "worker"
      },
      {
        "x": 535,
        "y": 180,
        "w": 190,
        "title": "Candidates",
        "detail": "more than five",
        "kind": "index"
      },
      {
        "x": 790,
        "y": 180,
        "w": 180,
        "title": "Policy filter",
        "detail": "remove unsafe",
        "kind": "policy"
      },
      {
        "x": 790,
        "y": 310,
        "w": 180,
        "title": "Visible top five",
        "detail": "safe ordering",
        "kind": "list"
      }
    ],
    "edges": [
      {
        "points": [
          [
            220,
            217
          ],
          [
            283,
            217
          ]
        ]
      },
      {
        "points": [
          [
            453,
            217
          ],
          [
            535,
            217
          ]
        ]
      },
      {
        "points": [
          [
            725,
            217
          ],
          [
            790,
            217
          ]
        ]
      },
      {
        "points": [
          [
            880,
            254
          ],
          [
            880,
            310
          ]
        ]
      }
    ]
  },
  "autocomplete-pipeline": {
    "title": "Publish a validated read model",
    "description": "Completed-search events become aggregates, then an immutable ranked snapshot rolled out to serving nodes.",
    "note": "Keep the prior snapshot for rollback.",
    "nodes": [
      {
        "x": 26,
        "y": 180,
        "w": 160,
        "title": "Search event",
        "detail": "submitted term",
        "kind": "client"
      },
      {
        "x": 233,
        "y": 180,
        "w": 160,
        "title": "Event stream",
        "detail": "retry-safe IDs",
        "kind": "stream"
      },
      {
        "x": 444,
        "y": 180,
        "w": 160,
        "title": "Aggregate",
        "detail": "term × window",
        "kind": "worker"
      },
      {
        "x": 655,
        "y": 180,
        "w": 155,
        "title": "Build index",
        "detail": "rank prefixes",
        "kind": "trie"
      },
      {
        "x": 852,
        "y": 180,
        "w": 130,
        "title": "Snapshot",
        "detail": "versioned",
        "kind": "storage"
      }
    ],
    "edges": [
      {
        "points": [
          [
            186,
            217
          ],
          [
            233,
            217
          ]
        ]
      },
      {
        "points": [
          [
            393,
            217
          ],
          [
            444,
            217
          ]
        ]
      },
      {
        "points": [
          [
            604,
            217
          ],
          [
            655,
            217
          ]
        ]
      },
      {
        "points": [
          [
            810,
            217
          ],
          [
            852,
            217
          ]
        ]
      }
    ]
  },
  "autocomplete-serve": {
    "title": "Serve from a versioned cache",
    "description": "A public context-aware prefix key reads candidates quickly; a miss loads the durable snapshot and fills cache.",
    "note": "Private history must not enter a shared cache.",
    "nodes": [
      {
        "x": 30,
        "y": 180,
        "w": 165,
        "title": "Client",
        "detail": "current prefix",
        "kind": "client"
      },
      {
        "x": 273,
        "y": 180,
        "w": 165,
        "title": "Query API",
        "detail": "validate + filter",
        "kind": "api"
      },
      {
        "x": 516,
        "y": 180,
        "w": 165,
        "title": "Fast cache",
        "detail": "prefix + locale",
        "kind": "cache"
      },
      {
        "x": 759,
        "y": 180,
        "w": 195,
        "title": "Snapshot store",
        "detail": "last good version",
        "kind": "storage"
      }
    ],
    "edges": [
      {
        "points": [
          [
            195,
            217
          ],
          [
            273,
            217
          ]
        ]
      },
      {
        "points": [
          [
            438,
            217
          ],
          [
            516,
            217
          ]
        ]
      },
      {
        "points": [
          [
            681,
            217
          ],
          [
            759,
            217
          ]
        ]
      },
      {
        "points": [
          [
            759,
            241
          ],
          [
            681,
            241
          ]
        ]
      }
    ]
  },
  "autocomplete-scale": {
    "title": "Route by measured prefix load",
    "description": "A versioned range map routes prefix reads; hot ranges can gain replicas or split into mergeable slices.",
    "note": "Cross-shard prefixes need a top-K merge.",
    "nodes": [
      {
        "x": 24,
        "y": 180,
        "w": 160,
        "title": "Query API",
        "detail": "one prefix",
        "kind": "api"
      },
      {
        "x": 235,
        "y": 180,
        "w": 185,
        "title": "Range map",
        "detail": "versioned routes",
        "kind": "router"
      },
      {
        "x": 488,
        "y": 96,
        "w": 185,
        "title": "Hot slice A",
        "detail": "replicated reads",
        "kind": "trie"
      },
      {
        "x": 488,
        "y": 276,
        "w": 185,
        "title": "Slice B",
        "detail": "split range",
        "kind": "trie"
      },
      {
        "x": 756,
        "y": 180,
        "w": 210,
        "title": "Merge top-K",
        "detail": "if fanout needed",
        "kind": "worker"
      }
    ],
    "edges": [
      {
        "points": [
          [
            184,
            217
          ],
          [
            235,
            217
          ]
        ]
      },
      {
        "points": [
          [
            420,
            200
          ],
          [
            450,
            200
          ],
          [
            450,
            133
          ],
          [
            488,
            133
          ]
        ]
      },
      {
        "points": [
          [
            420,
            234
          ],
          [
            450,
            234
          ],
          [
            450,
            313
          ],
          [
            488,
            313
          ]
        ]
      },
      {
        "points": [
          [
            673,
            133
          ],
          [
            715,
            133
          ],
          [
            715,
            200
          ],
          [
            756,
            200
          ]
        ]
      },
      {
        "points": [
          [
            673,
            313
          ],
          [
            715,
            313
          ],
          [
            715,
            234
          ],
          [
            756,
            234
          ]
        ]
      }
    ]
  },
  "autocomplete-ops": {
    "title": "Remove unsafe results end to end",
    "description": "Immediate serving filters, source correction, rollout checks, and a last-good snapshot support safe recovery.",
    "note": "A bad phrase should not reappear on the next build.",
    "nodes": [
      {
        "x": 26,
        "y": 180,
        "w": 170,
        "title": "Abuse signal",
        "detail": "report or anomaly",
        "kind": "metric"
      },
      {
        "x": 265,
        "y": 96,
        "w": 190,
        "title": "Serving filter",
        "detail": "suppress now",
        "kind": "policy"
      },
      {
        "x": 265,
        "y": 275,
        "w": 190,
        "title": "Source correction",
        "detail": "exclude future",
        "kind": "worker"
      },
      {
        "x": 565,
        "y": 180,
        "w": 195,
        "title": "Build + rollout",
        "detail": "validated version",
        "kind": "index"
      },
      {
        "x": 825,
        "y": 180,
        "w": 145,
        "title": "Fallback",
        "detail": "last good",
        "kind": "storage"
      }
    ],
    "edges": [
      {
        "points": [
          [
            196,
            200
          ],
          [
            226,
            200
          ],
          [
            226,
            133
          ],
          [
            265,
            133
          ]
        ]
      },
      {
        "points": [
          [
            196,
            234
          ],
          [
            226,
            234
          ],
          [
            226,
            312
          ],
          [
            265,
            312
          ]
        ]
      },
      {
        "points": [
          [
            455,
            312
          ],
          [
            508,
            312
          ],
          [
            508,
            234
          ],
          [
            565,
            234
          ]
        ]
      },
      {
        "points": [
          [
            455,
            133
          ],
          [
            508,
            133
          ],
          [
            508,
            200
          ],
          [
            565,
            200
          ]
        ]
      },
      {
        "points": [
          [
            760,
            217
          ],
          [
            825,
            217
          ]
        ]
      }
    ]
  }
};

function Icon({ kind, x, y }: { kind:Kind; x:number; y:number }) {
  const ink = { fill:'none', stroke:'var(--ac-ink)', strokeWidth:1.8, strokeLinecap:'round' as const, strokeLinejoin:'round' as const };
  return <g transform={`translate(${x} ${y})`} aria-hidden="true" {...ink}>
    {kind === 'client' && <><rect x="3" y="4" width="22" height="15" rx="2"/><path d="M1 23h26l-3-4H4z"/></>}
    {kind === 'api' && <><rect x="3" y="3" width="22" height="7" rx="2"/><rect x="3" y="15" width="22" height="7" rx="2"/><path d="M7 6h4M7 18h4"/></>}
    {kind === 'index' && <><path d="M4 2h20v24H4zM9 8h10M9 14h10M9 20h7"/></>}
    {kind === 'list' && <><path d="M8 6h16M8 14h16M8 22h16"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="14" r="1"/><circle cx="3" cy="22" r="1"/></>}
    {kind === 'stream' && <><rect x="4" y="3" width="20" height="5" rx="1"/><rect x="4" y="11" width="20" height="5" rx="1"/><rect x="4" y="19" width="20" height="5" rx="1"/></>}
    {kind === 'trie' && <><path d="M14 2v7M14 9 5 17M14 9l9 8M5 17v7M23 17v7"/><circle cx="14" cy="8" r="3"/><circle cx="5" cy="20" r="3"/><circle cx="23" cy="20" r="3"/></>}
    {kind === 'cache' && <><rect x="5" y="5" width="18" height="18" rx="3"/><path d="M9 2v3M18 2v3M9 23v3M18 23v3M2 9h3M2 18h3M23 9h3M23 18h3M10 10h8v8h-8z"/></>}
    {kind === 'worker' && <><circle cx="14" cy="14" r="9"/><circle cx="14" cy="14" r="3"/><path d="M14 1v4M14 23v4M1 14h4M23 14h4"/></>}
    {kind === 'policy' && <><path d="M14 2 24 6v8c0 6-4 10-10 13C8 24 4 20 4 14V6zM9 14l3 3 7-7"/></>}
    {kind === 'storage' && <><path d="M3 8h22l-2 16H5zM7 8V4h14v4M10 14h8"/></>}
    {kind === 'router' && <><path d="M3 14h9M12 14V5h13M12 14v9h13M20 3l5 2-5 2M20 21l5 2-5 2"/></>}
    {kind === 'metric' && <><path d="M3 24V4M3 24h23M7 19l5-6 4 3 7-9"/><circle cx="23" cy="7" r="1"/></>}
  </g>;
}

export function AutocompleteDiagram({ id, className }: { id:string; className?:string }) {
  const scene = scenes[id];
  const key = useId().replace(/:/g, '');
  if (!scene) return null;
  return <figure className={["autocomplete-figure", className].filter(Boolean).join(' ')}>
    <div id={`${key}-hint`} className="autocomplete-scroll-hint">Swipe or scroll to explore the full diagram <span aria-hidden="true">→</span></div>
    <div className="autocomplete-viewport" tabIndex={0} aria-label={`Scrollable diagram: ${scene.title}. Use arrow keys to explore.`} aria-describedby={`${key}-hint`}>
      <svg viewBox="0 0 1000 450" role="img" aria-labelledby={`${key}-title ${key}-description`}>
        <title id={`${key}-title`}>{scene.title}</title><desc id={`${key}-description`}>{scene.description}</desc>
        <defs><marker id={`${key}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--ac-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
        <rect width="1000" height="450" rx="18" fill="var(--ac-paper)"/>
        <text x="28" y="35" className="autocomplete-heading">{scene.title}</text><path d="M28 52H972" stroke="var(--ac-rule)" strokeDasharray="3 7"/>
        {scene.edges.map((edge,i)=><path key={`e-${i}`} d={edge.points.map(([x,y],j)=>`${j?'L':'M'}${x} ${y}`).join(' ')} fill="none" stroke="var(--ac-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${key}-arrow)`}/>)}
        {scene.nodes.map((node,i)=><g key={`n-${i}`}><rect x={node.x} y={node.y} width={node.w} height="74" rx="14" fill="var(--ac-card)" stroke="var(--ac-border)" strokeWidth="1.5"/><rect x={node.x+11} y={node.y+18} width="37" height="37" rx="9" fill="var(--ac-icon-bg)" stroke="var(--ac-rule)"/><Icon kind={node.kind} x={node.x+15} y={node.y+22}/><text x={node.x+58} y={node.y+32} className="autocomplete-node-title">{node.title}</text><text x={node.x+58} y={node.y+53} className="autocomplete-node-detail">{node.detail}</text></g>)}
        <text x="28" y="430" className="autocomplete-note">{scene.note}</text>
      </svg>
    </div>
    <figcaption>{scene.description}</figcaption>
    <style>{`
      .autocomplete-figure { --ac-paper:#fff; --ac-card:#f6f6f7; --ac-icon-bg:#fff; --ac-ink:#252527; --ac-muted:#55555a; --ac-border:#99999d; --ac-line:#55555a; --ac-rule:#dadadd; margin:0; min-width:0; max-width:100%; color:var(--ac-ink); container-type:inline-size; }
      .autocomplete-scroll-hint { display:none; }
      .autocomplete-viewport { box-sizing:border-box; width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; border:1px solid var(--ac-rule); border-radius:18px; background:var(--ac-paper); scrollbar-width:thin; touch-action:pan-x pan-y; overscroll-behavior-inline:contain; }
      .autocomplete-viewport:focus-visible { outline:3px solid var(--accent, var(--ac-ink)); outline-offset:3px; }
      .autocomplete-viewport svg { display:block; width:100%; min-width:940px; height:auto; }
      .autocomplete-figure figcaption { margin-top:.7rem; color:var(--muted, var(--ac-muted)); font-size:.875rem; line-height:1.55; }
      .autocomplete-heading { font:650 18px system-ui,-apple-system,sans-serif; fill:var(--ac-ink); letter-spacing:-.02em; }
      .autocomplete-node-title { font:650 12px system-ui,-apple-system,sans-serif; fill:var(--ac-ink); letter-spacing:-.025em; }
      .autocomplete-node-detail { font:11px system-ui,-apple-system,sans-serif; fill:var(--ac-muted); }
      .autocomplete-note { font:13px system-ui,-apple-system,sans-serif; fill:var(--ac-muted); }
      @container (max-width:940px) { .autocomplete-scroll-hint { display:flex; justify-content:space-between; gap:1rem; margin:0 0 .5rem; color:var(--muted, var(--ac-muted)); font:600 .76rem system-ui,-apple-system,sans-serif; } }
      @media (prefers-color-scheme:dark) { .autocomplete-figure { --ac-paper:#1d1d1f; --ac-card:#303033; --ac-icon-bg:#242427; --ac-ink:#f1f1f2; --ac-muted:#c6c6ca; --ac-border:#aaaab0; --ac-line:#bdbdc2; --ac-rule:#57575c; } }
      @media (prefers-contrast:more) { .autocomplete-figure { --ac-muted:var(--ac-ink); --ac-border:var(--ac-ink); --ac-line:var(--ac-ink); --ac-rule:var(--ac-ink); } }
    `}</style>
  </figure>;
}
