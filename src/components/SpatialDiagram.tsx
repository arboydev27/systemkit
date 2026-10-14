"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Minus, Plus, Focus, Maximize2, Minimize2, ChevronLeft } from "lucide-react";
import { getSpatialLesson, rememberSpatialLesson, decodeDiagramAttempts, relationshipLabels, type DiagramAttempt, type LessonChanges } from "../lib/spatial-learning";
import { presentSpatialLesson } from "../lib/spatial-layout";
import { createSpatialRuntime, type SpatialRuntime } from "../lib/spatial-runtime";
import type { RelationMeaning } from "../lib/spatial-learning-types";
import styles from "./SpatialDiagram.module.css";

type Mode = "explore" | "guide" | "predict";
const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function SpatialDiagram({ chapterId, diagramId, onUnavailable }: {
  chapterId: string; diagramId: string; onUnavailable: () => void;
}) {
  const lesson = useMemo(() => getSpatialLesson(chapterId, diagramId), [chapterId, diagramId]);
  const { scene: original, content } = lesson;
  const host = useRef<HTMLDivElement>(null), runtime = useRef<SpatialRuntime | null>(null);
  const unavailable = useRef(onUnavailable); unavailable.current = onUnavailable;
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("explore");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [predictionIndex, setPredictionIndex] = useState(0);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [viewChoice, setViewChoice] = useState("overview");
  const [filter, setFilter] = useState<RelationMeaning | "all">("all");
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [changes, setChanges] = useState<LessonChanges | null>(null);
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [manualReduced, setManualReduced] = useState(() => {
    try { return localStorage.getItem("systemkit:diagram-motion:v1") === "reduced"; } catch { return false; }
  });
  const reduced = systemReduced || manualReduced;
  const [top, setTop] = useState(reduced);
  const [themeVersion, setThemeVersion] = useState(0);
  const predictionKey = `systemkit:diagram-predictions:v1:${chapterId}/${diagramId}`;
  const [attempts, setAttempts] = useState<Record<string, DiagramAttempt>>(() => {
    try { return decodeDiagramAttempts(localStorage.getItem(predictionKey), content.predictions); } catch { return {}; }
  });
  const prediction = content.predictions[predictionIndex];
  const attempt = prediction ? attempts[prediction.id] : undefined;
  const explanation = mode === "guide" ? content.scenes[sceneIndex] : mode === "predict" && attempt?.revealed ? prediction?.reveal : undefined;
  const viewId = viewChoice === "auto" ? explanation?.viewId : viewChoice === "overview" ? undefined : viewChoice;
  const effectiveCollapsed = useMemo(() => collapsed.filter(id => !explanation || !content.groups.find(group => group.id === id)?.members.some(member => explanation.nodeIds.includes(member))), [collapsed, explanation, content.groups]);
  const presentation = useMemo(() => presentSpatialLesson(lesson, {
    collapsed: effectiveCollapsed, viewId, explanation: explanation ? { ...explanation, viewId } : undefined,
    filter: mode === "explore" ? filter : "all",
  }), [lesson, effectiveCollapsed, viewId, explanation, filter, mode]);
  const presentationRef = useRef(presentation.scene); presentationRef.current = presentation.scene;
  const scope = viewId ?? explanation?.revealNodeIds?.join(",") ?? "overview";
  const framedScope = useRef(scope);
  const selectedNode = presentation.scene.nodes.find(node => node.id === nodeId);
  const selectedLink = presentation.scene.links.find(link => link.id === linkId);
  const selectedGroup = selectedNode?.members ? content.groups.find(group => `group:${group.id}` === selectedNode.id) : undefined;
  const source = presentation.scene.nodes.find(node => node.id === selectedLink?.source);
  const target = presentation.scene.nodes.find(node => node.id === selectedLink?.target);
  const relationKinds = useMemo(() => [...new Set(original.links.map(link => link.meaning))], [original]);

  function clearSelection() { setNodeId(null); setLinkId(null); }
  function chooseMode(next: Mode) {
    setPlaying(false); clearSelection(); setMode(next); setViewChoice(next === "explore" ? "overview" : "auto"); setFilter("all");
  }
  function overview() {
    chooseMode("explore"); setViewChoice("overview");
  }
  function chooseScene(index: number) { setPlaying(false); clearSelection(); setSceneIndex(index); setViewChoice("auto"); }
  function toggleGroup(id: string) {
    setPlaying(false); clearSelection();
    setCollapsed(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  useEffect(() => { setChanges(rememberSpatialLesson(original)); }, [original]);
  useEffect(() => {
    try { localStorage.setItem(predictionKey, JSON.stringify(attempts)); } catch { /* Practice works without storage. */ }
  }, [attempts, predictionKey]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const theme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncMotion = () => setSystemReduced(motion.matches);
    const syncTheme = () => setThemeVersion(version => version + 1);
    motion.addEventListener("change", syncMotion); theme.addEventListener("change", syncTheme);
    return () => { motion.removeEventListener("change", syncMotion); theme.removeEventListener("change", syncTheme); };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    try {
      const view = createSpatialRuntime(host.current, presentationRef.current, {
        reduced, onPick(id) { setPlaying(false); setLinkId(null); setNodeId(id); },
        onLinkPick(id) { setPlaying(false); setNodeId(null); setLinkId(id); },
        onUnavailable() { unavailable.current(); }, onHidden() { setPlaying(false); },
        onInteraction() { setPlaying(false); }, onViewChange: setTop,
      });
      runtime.current = view; setReady(true);
      return () => { runtime.current = null; view.dispose(); };
    } catch { unavailable.current(); }
  }, [original, themeVersion]);
  useEffect(() => { runtime.current?.reconcile(presentation.scene, { animate: !reduced }); }, [presentation.scene, ready, themeVersion]);
  useEffect(() => {
    if (scope !== framedScope.current) runtime.current?.fitPresentation();
    framedScope.current = scope;
  }, [scope, ready, themeVersion]);
  useEffect(() => {
    runtime.current?.reduce(reduced);
    if (reduced) { setPlaying(false); setTop(true); }
  }, [reduced, ready, themeVersion]);
  useEffect(() => {
    if (nodeId || linkId) { runtime.current?.spotlight([], []); runtime.current?.select(nodeId, selectedLink ? presentation.scene.links.indexOf(selectedLink) : null); }
    else { runtime.current?.select(null, null); runtime.current?.spotlight(explanation?.nodeIds ?? [], explanation?.linkIds ?? []); }
  }, [nodeId, linkId, selectedLink, explanation, presentation.scene, ready, themeVersion]);
  useEffect(() => { runtime.current?.playback(playing && !reduced); }, [playing, reduced, explanation, presentation.scene, ready, themeVersion]);
  useEffect(() => {
    if (!playing || reduced || mode !== "guide") return;
    const words = content.scenes[sceneIndex].description.split(/\s+/).length;
    const timer = window.setTimeout(() => {
      if (sceneIndex >= content.scenes.length - 1) setPlaying(false);
      else { clearSelection(); setSceneIndex(index => index + 1); }
    }, Math.max(5000, words * 250 + 1200));
    return () => window.clearTimeout(timer);
  }, [playing, reduced, mode, sceneIndex, content.scenes]);

  return <div className={styles.root}>
    <div className={styles.intro}>
      <div><h3>{original.title}</h3><p>{countLabel(presentation.scene.nodes.length, "visible element")} · {countLabel(presentation.scene.links.length, "relationship")}</p></div>
      <div className={styles.camera} aria-label="Camera controls">
        <button type="button" aria-pressed={!top} disabled={reduced || !ready} onClick={() => runtime.current?.view(false)}>Angled</button>
        <button type="button" aria-pressed={top} disabled={reduced || !ready} onClick={() => runtime.current?.view(true)}>Top</button>
        <button type="button" disabled={reduced || !ready} aria-label="Zoom out" onClick={() => runtime.current?.zoom(.85)}><Minus size={15}/></button>
        <button type="button" disabled={reduced || !ready} aria-label="Zoom in" onClick={() => runtime.current?.zoom(1.18)}><Plus size={15}/></button>
        <button type="button" disabled={!ready} aria-label="Reset 3D view" onClick={() => runtime.current?.reset()}><RotateCcw size={15}/></button>
      </div>
    </div>
    <div className={styles.learningToolbar}>
      <div className={styles.modeSwitch} aria-label="Learning mode">
        <button type="button" aria-pressed={mode === "explore"} onClick={() => chooseMode("explore")}>Explore</button>
        <button type="button" aria-pressed={mode === "guide"} onClick={() => chooseMode("guide")}>Guided explanation</button>
        {content.predictions.length ? <button type="button" aria-pressed={mode === "predict"} onClick={() => chooseMode("predict")}>Predict</button> : null}
      </div>
      {content.views.length ? <label className={styles.viewSelect}>View
        <select aria-label="Teaching view" value={viewChoice} onChange={event => { setPlaying(false); clearSelection(); setViewChoice(event.target.value); }}>
          {mode !== "explore" ? <option value="auto">Follow scene</option> : null}
          <option value="overview">Whole system</option>
          {content.views.map(view => <option key={view.id} value={view.id}>{view.title}</option>)}
        </select>
      </label> : null}
    </div>
    <div ref={host} className={`${styles.viewport} ${expanded ? styles.expanded : ""}`} tabIndex={0} aria-label={`3D diagram: ${original.title}. ${reduced ? "Fixed camera. Use the learning controls below." : "Drag or use arrow keys to rotate. Select a component or connection."}`}>
      {!ready ? <p className={styles.loading} role="status">Preparing the 3D view…</p> : null}
    </div>
    <div className={styles.viewActions}>
      <span>{viewId ? presentation.title : "Select a component or connection to inspect it."}{presentation.omittedNodes || presentation.omittedLinks ? ` · ${countLabel(presentation.omittedNodes, "component")} and ${countLabel(presentation.omittedLinks, "relationship")} hidden here` : ""}</span>
      <div>
        {viewId ? <button type="button" onClick={overview}><ChevronLeft size={14} aria-hidden="true"/>Overview</button> : null}
        <button type="button" disabled={!ready || reduced || (!selectedNode && !selectedLink && !explanation && !viewId)} onClick={() => {
          setPlaying(false); if (selectedNode || selectedLink) runtime.current?.focus(nodeId, selectedLink ? presentation.scene.links.indexOf(selectedLink) : null); else if (explanation) runtime.current?.focusSpotlight(); else runtime.current?.fitPresentation();
        }}><Focus size={14} aria-hidden="true"/>Focus {!selectedNode && !selectedLink ? explanation ? "scene" : viewId ? "view" : "selection" : "selection"}</button>
        <button type="button" disabled={!ready} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? <Minimize2 size={14} aria-hidden="true"/> : <Maximize2 size={14} aria-hidden="true"/>}{expanded ? "Compact view" : "Expand view"}
        </button>
      </div>
    </div>
    <div className={styles.explore}>
      <span className={styles.walkLabel}>{mode === "guide" ? "Explanation · your pace" : mode === "predict" ? "Authored prediction scenario" : "Explore the lesson model"}</span>
      <label className={styles.reduce}><input type="checkbox" checked={reduced} disabled={systemReduced} onChange={event => {
        setManualReduced(event.target.checked);
        try { localStorage.setItem("systemkit:diagram-motion:v1", event.target.checked ? "reduced" : "normal"); } catch { /* Optional preference. */ }
      }}/> Reduce motion{systemReduced ? <span> · System setting</span> : null}</label>
    </div>
    {mode === "guide" ? <section className={styles.teachingPanel} aria-label="Guided explanation">
      <div className={styles.sceneHeading}><span className={styles.kicker}>SCENE {sceneIndex + 1} OF {content.scenes.length}</span>
        <div className={styles.playback}>
          <button type="button" className={styles.play} disabled={!ready || reduced} onClick={() => { if (!playing && sceneIndex === content.scenes.length - 1) setSceneIndex(0); clearSelection(); setViewChoice("auto"); setPlaying(value => !value); }}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? "Pause explanation" : "Play explanation"}</button>
          <button type="button" aria-label="Previous explanation scene" disabled={!ready || sceneIndex === 0} onClick={() => chooseScene(sceneIndex - 1)}><ArrowLeft size={16}/></button>
          <button type="button" aria-label="Next explanation scene" disabled={!ready || sceneIndex === content.scenes.length - 1} onClick={() => chooseScene(sceneIndex + 1)}><ArrowRight size={16}/></button>
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true"><h4>{content.scenes[sceneIndex].title}</h4><p>{content.scenes[sceneIndex].description}</p></div>
      <ol className={styles.sceneList}>{content.scenes.map((scene, index) => <li key={scene.id}><button type="button" aria-current={index === sceneIndex ? "step" : undefined} onClick={() => chooseScene(index)}><span>{String(index + 1).padStart(2, "0")}</span>{scene.title}</button></li>)}</ol>
      <p className={styles.smallNote}>Highlights follow authored relationships. Timing is illustrative. Dragging or inspecting pauses playback.</p>
    </section> : null}
    {mode === "predict" && prediction ? <section className={styles.teachingPanel} aria-label="Diagram prediction">
      {content.predictions.length > 1 ? <label className={styles.viewSelect}>Scenario<select aria-label="Prediction scenario" value={predictionIndex} onChange={event => { clearSelection(); setPredictionIndex(Number(event.target.value)); setViewChoice("auto"); }}>{content.predictions.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}</select></label> : null}
      <span className={styles.kicker}>PREDICT BEFORE THE REVEAL</span><h4>{prediction.title}</h4>
      <fieldset className={styles.predictionChoices}><legend>{prediction.prompt}</legend>{prediction.options.map((option, index) => <label key={index} className={attempt?.choice === index ? styles.chosen : ""}><input type="radio" name={`diagram-prediction-${prediction.id}`} checked={attempt?.choice === index} disabled={attempt?.revealed} onChange={() => setAttempts(current => ({ ...current, [prediction.id]: { choice: index, revealed: false } }))}/><span>{option}</span></label>)}</fieldset>
      <div className={styles.predictionActions}>
        <button type="button" className={styles.primaryAction} disabled={!attempt || attempt.revealed} onClick={() => { clearSelection(); setAttempts(current => ({ ...current, [prediction.id]: { ...current[prediction.id], revealed: true } })); }}>Reveal in diagram</button>
        {attempt?.revealed ? <button type="button" onClick={() => { clearSelection(); setAttempts(current => Object.fromEntries(Object.entries(current).filter(([id]) => id !== prediction.id))); }}>Try again</button> : null}
      </div>
      {attempt?.revealed ? <div className={styles.predictionFeedback} role="status"><strong>{attempt.choice === prediction.correctIndex ? "Your prediction matches this scenario." : "Revisit your prediction."}</strong><p>{prediction.explanation}</p><p>The diagram now highlights: {prediction.reveal.title}.</p></div> : <p className={styles.smallNote}>Your choice stays on this device. Reveal the scene to compare your reasoning.</p>}
    </section> : null}
    <div className={styles.inspector}>
      <span className={styles.kicker}>{selectedLink ? "SELECTED RELATIONSHIP" : selectedNode ? "SELECTED ELEMENT" : "EXPLORE THE DIAGRAM"}</span>
      <div aria-live="polite" aria-atomic="true"><h4>{selectedLink ? source && target ? `${source.title} → ${target.title}` : selectedLink.label : selectedNode?.title ?? (viewId ? presentation.title : "Understand the parts and their relationships.")}</h4>
        <p>{selectedLink ? selectedLink.explanation : selectedGroup?.description ?? selectedNode?.detail ?? (viewId ? presentation.description : original.description)}</p>
        {selectedLink ? <p className={styles.relationCondition}><strong>{relationshipLabels[selectedLink.meaning]}</strong>{selectedLink.condition ? ` · ${selectedLink.condition}` : ""}{selectedLink.dashed ? " · Dashed relationship" : ""}</p> : null}
        {selectedNode?.status ? <p className={styles.relationCondition}>Scenario state: {selectedNode.status.replace(/-/g, " ")}</p> : null}
      </div>
      {selectedGroup ? <button type="button" className={styles.inlineAction} onClick={() => toggleGroup(selectedGroup.id)}>Expand {selectedGroup.title}</button> : null}
      {selectedLink && selectedLink.origins.length > 1 ? <details className={styles.modelDetails}><summary>{selectedLink.origins.length} original relationships represented</summary><ul>{selectedLink.origins.map(id => {
        const link = original.links.find(item => item.id === id);
        const from = original.nodes.find(node => node.id === link?.source)?.title ?? "Boundary";
        const to = original.nodes.find(node => node.id === link?.target)?.title ?? "Boundary";
        return <li key={id}><strong>{from} → {to}</strong> · {link?.label}: {link?.explanation}</li>;
      })}</ul></details> : null}
      <div className={styles.elements} aria-label="Diagram elements"><button type="button" aria-pressed={!selectedNode && !selectedLink} onClick={clearSelection}>Clear selection</button>{presentation.scene.nodes.map(node => <button type="button" key={node.id} aria-pressed={nodeId === node.id} onClick={() => { setPlaying(false); setLinkId(null); setNodeId(node.id); }}>{node.title}{node.members ? ` · ${node.members.length}` : ""}</button>)}</div>
      {content.groups.length ? <details className={styles.modelDetails}><summary>Subsystems · {content.groups.length}</summary><div className={styles.subsystems}>{content.groups.map(group => <div key={group.id}><div><strong>{group.title}</strong><p>{group.description}</p></div><button type="button" disabled={!!viewId || mode !== "explore"} aria-expanded={!collapsed.includes(group.id)} onClick={() => toggleGroup(group.id)}>{collapsed.includes(group.id) ? "Expand" : "Collapse"} {group.title}</button></div>)}</div></details> : null}
      {original.links.length ? <details className={styles.modelDetails}><summary>Relationships · {presentation.scene.links.length}</summary>
        <label className={styles.viewSelect}>Show<select aria-label="Relationship filter" disabled={mode !== "explore"} value={mode === "explore" ? filter : "all"} onChange={event => { clearSelection(); setFilter(event.target.value as RelationMeaning | "all"); }}><option value="all">All relationships</option>{relationKinds.map(kind => <option key={kind} value={kind}>{relationshipLabels[kind]}</option>)}</select></label>
        <div className={styles.relationships} aria-label="Diagram relationships">{presentation.scene.links.map(link => <button type="button" key={link.id} aria-pressed={linkId === link.id} onClick={() => { setPlaying(false); setNodeId(null); setLinkId(link.id); }}><span className={styles.relationBadge} data-meaning={link.meaning}>{relationshipLabels[link.meaning]}</span><span>{link.label}{link.origins.length > 1 ? ` · ${link.origins.length} relationships` : ""}</span></button>)}</div>
      </details> : null}
      {changes ? <details className={styles.modelDetails}><summary>What changed from the previous lesson?</summary><p>Previously: {changes.previousTitle}. {countLabel(changes.retained, "component")} {changes.retained === 1 ? "retains its" : "retain their"} identity.</p>{changes.added.length ? <p>Added: {changes.added.join(", ")}.</p> : null}{changes.removed.length ? <p>Left this view: {changes.removed.join(", ")}.</p> : null}<p className={styles.smallNote}>This compares the lesson diagrams you visited in this browser session.</p></details> : null}
      <p className={styles.note}>{original.note}</p>
    </div>
    <p className={styles.hint}>Positions and shapes help explain the design. Hidden components and aggregated relationships are disclosed in the view controls. Prediction outcomes are authored examples.</p>
  </div>;
}
