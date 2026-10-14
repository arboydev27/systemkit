"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Box, PanelsTopLeft } from "lucide-react";
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

export function DiagramView({ chapterId, diagramId, heading, hint, children }: {
  chapterId: string; diagramId: string; heading: string; hint: string; children: ReactNode;
}) {
  const [mode, setMode] = useState<"static" | "3d">("static");
  const [notice, setNotice] = useState("");
  useEffect(() => { try { if (localStorage.getItem(STORAGE_KEY) === "3d") setMode("3d"); } catch { /* Optional preference storage. */ } }, []);
  function choose(next: "static" | "3d") {
    setMode(next); setNotice("");
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Viewing works without storage. */ }
  }
  function fallback() {
    choose("static"); setNotice("3D is unavailable on this device. You can keep exploring the static diagram.");
  }
  return <section className="diagram-section" aria-labelledby="diagram-heading">
    <div className={`section-heading-row ${styles.heading}`}>
      <div><span className="section-kicker">SYSTEM VIEW</span><h2 id="diagram-heading">{heading}</h2></div>
      <fieldset className={styles.segment}>
        <legend className={styles.srOnly}>Diagram view</legend>
        <label className={mode === "static" ? styles.selected : ""}><input type="radio" name="diagram-view" value="static" checked={mode === "static"} onChange={() => choose("static")}/><PanelsTopLeft size={14} aria-hidden="true"/>Static</label>
        <label className={mode === "3d" ? styles.selected : ""}><input type="radio" name="diagram-view" value="3d" checked={mode === "3d"} onChange={() => choose("3d")}/><Box size={14} aria-hidden="true"/>3D</label>
      </fieldset>
    </div>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <div className={`diagram-stage ${mode === "3d" ? styles.spatialStage : ""}`}>
      {mode === "static" ? children : <SpatialBoundary key={`${chapterId}/${diagramId}`} onStatic={fallback}><SpatialDiagram key={`${chapterId}/${diagramId}`} chapterId={chapterId} diagramId={diagramId} onUnavailable={fallback}/></SpatialBoundary>}
    </div>
    <div className="diagram-footnote"><span className="diagram-footnote-icon" aria-hidden="true">↗</span>{mode === "static" ? hint : "Explore the same lesson model in space. Switch back to Static for the full annotated drawing."}</div>
  </section>;
}
