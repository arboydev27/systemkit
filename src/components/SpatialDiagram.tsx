"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Minus, Plus } from "lucide-react";
import { getSpatialScene } from "../lib/spatial-scenes";
import { createSpatialRuntime, type SpatialRuntime } from "../lib/spatial-runtime";
import styles from "./SpatialDiagram.module.css";

export function SpatialDiagram({ chapterId, diagramId, onUnavailable }: {
  chapterId: string; diagramId: string; onUnavailable: () => void;
}) {
  const model = useMemo(() => getSpatialScene(chapterId, diagramId), [chapterId, diagramId]);
  const host = useRef<HTMLDivElement>(null), runtime = useRef<SpatialRuntime | null>(null);
  const unavailable = useRef(onUnavailable); unavailable.current = onUnavailable;
  const [ready, setReady] = useState(false);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  // This component is loaded with ssr:false; read the client preference before drawing.
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [manualReduced, setManualReduced] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("systemkit:diagram-motion:v1") === "reduced"; } catch { return false; }
  });
  const [themeVersion, setThemeVersion] = useState(0);
  const [top, setTop] = useState(systemReduced || manualReduced);
  const reduced = systemReduced || manualReduced;
  const count = model.links.length || model.nodes.length;
  const selectedNode = model.nodes.find(n => n.id === nodeId);
  const selectedLink = index === null ? null : model.links[index];
  const source = model.nodes.find(n => n.id === selectedLink?.source);
  const target = model.nodes.find(n => n.id === selectedLink?.target);
  const walkthrough = model.links.length > 0;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const theme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncMotion = () => setSystemReduced(motion.matches);
    const syncTheme = () => setThemeVersion(v => v + 1);
    syncMotion(); motion.addEventListener("change", syncMotion); theme.addEventListener("change", syncTheme);
    return () => { motion.removeEventListener("change", syncMotion); theme.removeEventListener("change", syncTheme); };
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    try {
      const view = createSpatialRuntime(el, model, {
        reduced,
        onPick(id) { setPlaying(false); setIndex(null); setNodeId(id); },
        onUnavailable() { unavailable.current(); },
        onHidden() { setPlaying(false); },
      });
      runtime.current = view; setReady(true);
      return () => { runtime.current = null; view.dispose(); };
    } catch { unavailable.current(); }
  }, [model, themeVersion]);

  useEffect(() => { runtime.current?.reduce(reduced); if (reduced) { setPlaying(false); setTop(true); } else setTop(false); }, [reduced, ready, themeVersion]);
  useEffect(() => { runtime.current?.select(nodeId, model.links.length ? index : null); }, [nodeId, index, model, ready, themeVersion]);
  useEffect(() => { runtime.current?.playback(playing && !reduced); }, [playing, reduced, ready, themeVersion]);
  useEffect(() => {
    if (!playing || reduced) return;
    const timer = window.setTimeout(() => {
      if (index !== null && index >= count - 1) setPlaying(false);
      else setIndex(index === null ? 0 : index + 1);
    }, 3400);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, count, index]);
  useEffect(() => {
    if (!walkthrough && index !== null) setNodeId(model.nodes[index]?.id ?? null);
  }, [index, model, walkthrough]);

  function step(direction: number) {
    setPlaying(false); setNodeId(null);
    setIndex(current => current === null ? direction > 0 ? 0 : count - 1 : (current + direction + count) % count);
  }
  function overview() { setPlaying(false); setIndex(null); setNodeId(null); runtime.current?.reset(); setTop(reduced); }

  return <div className={styles.root}>
    <div className={styles.intro}>
      <div><h3>{model.title}</h3><p>{model.nodes.length} elements · {model.links.length} connections</p></div>
      <div className={styles.camera} aria-label="Camera controls">
        <button type="button" aria-pressed={!top} disabled={reduced || !ready} onClick={() => { setTop(false); runtime.current?.view(false); }}>Angled</button>
        <button type="button" aria-pressed={top} disabled={reduced || !ready} onClick={() => { setTop(true); runtime.current?.view(true); }}>Top</button>
        <button type="button" disabled={reduced || !ready} aria-label="Zoom out" onClick={() => runtime.current?.zoom(.85)}><Minus size={15}/></button>
        <button type="button" disabled={reduced || !ready} aria-label="Zoom in" onClick={() => runtime.current?.zoom(1.18)}><Plus size={15}/></button>
        <button type="button" disabled={!ready} aria-label="Reset 3D view" onClick={overview}><RotateCcw size={15}/></button>
      </div>
    </div>
    <div ref={host} className={styles.viewport} tabIndex={0} aria-label={`3D diagram: ${model.title}. ${reduced ? "Fixed camera. Use the element and walkthrough controls below." : "Drag or use arrow keys to rotate. Zoom using the buttons above."}`}>
      {!ready ? <p className={styles.loading} role="status">Preparing the 3D view…</p> : null}
    </div>
    <div className={styles.explore}>
      <div className={styles.playback}>
        {walkthrough ? <button type="button" className={styles.play} disabled={!ready || reduced} onClick={() => {
          if (playing) setPlaying(false);
          else { setNodeId(null); if (index === null || index === count - 1) setIndex(0); setPlaying(true); }
        }}>{playing ? <Pause size={14}/> : <Play size={14}/>}<span>{playing ? "Pause" : "Play walkthrough"}</span></button> : <span className={styles.walkLabel}>Explore the elements</span>}
        <button type="button" disabled={!ready} aria-label="Previous walkthrough step" onClick={() => step(-1)}><ArrowLeft size={16}/></button>
        <span className={styles.position}>{index === null ? "Overview" : `${index + 1} / ${count}`}</span>
        <button type="button" disabled={!ready} aria-label="Next walkthrough step" onClick={() => step(1)}><ArrowRight size={16}/></button>
      </div>
      <label className={styles.reduce}><input type="checkbox" checked={reduced} disabled={systemReduced} onChange={e => {
        setManualReduced(e.target.checked);
        try { localStorage.setItem("systemkit:diagram-motion:v1", e.target.checked ? "reduced" : "normal"); } catch { /* Optional preference storage. */ }
      }}/> Reduce motion{systemReduced ? <span> · System setting</span> : null}</label>
    </div>
    <div className={styles.inspector}>
      <span className={styles.kicker}>{selectedLink ? "CONNECTION WALKTHROUGH · EXPLANATORY ORDER" : selectedNode ? "SELECTED ELEMENT" : "EXPLORE THE DIAGRAM"}</span>
      <div aria-live="polite" aria-atomic="true">
        <h4>{selectedLink ? source && target ? `${source.title} → ${target.title}` : `Connection ${index! + 1}` : selectedNode?.title ?? "Same system. Another angle."}</h4>
        <p>{selectedLink ? selectedLink.label + (selectedLink.dashed ? " · Dashed in the static diagram" : "") : selectedNode?.detail || model.description}</p>
      </div>
      <div className={styles.elements} aria-label="Diagram elements">
        <button type="button" aria-pressed={!selectedNode && index === null} onClick={overview}>All</button>
        {model.nodes.map(n => <button type="button" key={n.id} aria-pressed={nodeId === n.id} onClick={() => { setPlaying(false); setIndex(null); setNodeId(n.id); }}>{n.title}</button>)}
      </div>
      <p className={styles.note}>{model.note}</p>
    </div>
    <p className={styles.hint}>{reduced ? `Motion is reduced. Use Next to inspect each ${walkthrough ? "relationship" : "element"}.` : "Drag to rotate · Arrow keys when focused · Select a block to inspect it"}<br/>Depth is for orientation. Highlights follow diagram arrows, not live traffic or measured timing.</p>
  </div>;
}
