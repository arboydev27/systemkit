"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Box, PanelsTopLeft, Play } from "lucide-react";
import { trackOnce } from "@/lib/analytics";
import styles from "./DiagramView.module.css";

const SpatialDiagram = dynamic(() => import("./SpatialDiagram").then(m => m.SpatialDiagram), {
  ssr: false, loading: () => <div className={styles.loading} role="status">Preparing the 3D view…</div>,
});
const STORAGE_KEY = "systemkit:diagram-view:v1";

class SpatialBoundary extends Component<{ children: ReactNode; onStatic: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className={styles.loading}><p>The 3D view could not load.</p><button type="button" onClick={this.props.onStatic}>Use the static diagram</button></div> : this.props.children;
  }
}

/** `stage` swaps the static drawing for the animated, step-through lesson stage, which draws its own frame. */
export function DiagramView({ chapterId, diagramId, heading, hint, stage = false, children }: {
  chapterId: string; diagramId: string; heading: string; hint: string; stage?: boolean; children: ReactNode;
}) {
  const [mode, setMode] = useState<"static" | "3d">("static");
  const [notice, setNotice] = useState("");
  useEffect(() => { try { if (localStorage.getItem(STORAGE_KEY) === "3d") setMode("3d"); } catch { /* Optional preference storage. */ } }, []);
  function choose(next: "static" | "3d") {
    setMode(next); setNotice("");
    if (next === "3d") trackOnce("diagram_3d_opened");
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Viewing works without storage. */ }
  }
  function fallback() {
    choose("static"); setNotice(`3D is unavailable on this device. You can keep exploring the ${stage ? "steps" : "static diagram"}.`);
  }
  return <section className={`diagram-section ${stage ? "is-stage" : ""}`} aria-labelledby="diagram-heading">
    <div className={`section-heading-row ${styles.heading}`}>
      <div><span className="section-kicker">SYSTEM VIEW</span><h2 id="diagram-heading">{heading}</h2></div>
      <fieldset className={styles.segment}>
        <legend className={styles.srOnly}>Diagram view</legend>
        <label className={mode === "static" ? styles.selected : ""}><input type="radio" name="diagram-view" value="static" checked={mode === "static"} onChange={() => choose("static")}/>{stage ? <Play size={14} aria-hidden="true"/> : <PanelsTopLeft size={14} aria-hidden="true"/>}{stage ? "Steps" : "Static"}</label>
        <label className={mode === "3d" ? styles.selected : ""}><input type="radio" name="diagram-view" value="3d" checked={mode === "3d"} onChange={() => choose("3d")}/><Box size={14} aria-hidden="true"/>3D</label>
      </fieldset>
    </div>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <div className={`diagram-stage ${mode === "3d" ? styles.spatialStage : stage ? styles.bare : ""}`}>
      {mode === "static" ? children : <SpatialBoundary key={`${chapterId}/${diagramId}`} onStatic={fallback}><SpatialDiagram key={`${chapterId}/${diagramId}`} chapterId={chapterId} diagramId={diagramId} onUnavailable={fallback}/></SpatialBoundary>}
    </div>
    {stage && mode === "static" ? null : <div className="diagram-footnote"><span className="diagram-footnote-icon" aria-hidden="true">↗</span>{mode === "static" ? hint : `Explore the same lesson model in space. Switch back to ${stage ? "Steps to watch it work" : "Static for the full annotated drawing"}.`}</div>}
  </section>;
}
