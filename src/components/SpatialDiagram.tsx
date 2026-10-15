"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Minus, Plus, Maximize2, Minimize2, X } from "lucide-react";
import { getSpatialLesson, rememberSpatialLesson, decodeDiagramAttempts, relationshipLabels, type DiagramAttempt, type LessonChanges } from "../lib/spatial-learning";
import { presentSpatialLesson } from "../lib/spatial-layout";
import { createSpatialRuntime, type SpatialRuntime } from "../lib/spatial-runtime";
import type { RelationMeaning } from "../lib/spatial-learning-types";
import styles from "./SpatialDiagram.module.css";

type Stage = "overview" | "walkthrough" | "prediction";
const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function SpatialDiagram({ chapterId, diagramId, onUnavailable }: {
  chapterId: string; diagramId: string; onUnavailable: () => void;
}) {
  const lesson = useMemo(() => getSpatialLesson(chapterId, diagramId), [chapterId, diagramId]);
  const { scene: original, content } = lesson;
  const id = useId();
  const card = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), runtime = useRef<SpatialRuntime | null>(null);
  const caption = useRef<HTMLHeadingElement>(null), startButton = useRef<HTMLButtonElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null), selectionTrigger = useRef<HTMLButtonElement | null>(null);
  const nextStep = useRef<HTMLButtonElement>(null), predictionAction = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null), firstChoice = useRef<HTMLInputElement>(null);
  const focusInspection = useRef(false), alignCard = useRef(false);
  const pendingFocus = useRef<"caption" | "start" | "step" | "retry" | "choice" | "canvas" | null>(null);
  const unavailable = useRef(onUnavailable); unavailable.current = onUnavailable;
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>("overview");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [predictionIndex, setPredictionIndex] = useState(0);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [viewChoice, setViewChoice] = useState("overview");
  const [filter, setFilter] = useState<RelationMeaning | "all">("all");
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [changes, setChanges] = useState<LessonChanges | null>(null);
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [manualReduced, setManualReduced] = useState(() => {
    try { return localStorage.getItem("systemkit:diagram-motion:v1") === "reduced"; } catch { return false; }
  });
  const reduced = systemReduced || manualReduced;
  const [top, setTop] = useState(reduced);
  const [themeVersion, setThemeVersion] = useState(0);
  const [frameVersion, setFrameVersion] = useState(0);
  const predictionKey = `systemkit:diagram-predictions:v1:${chapterId}/${diagramId}`;
  const [attempts, setAttempts] = useState<Record<string, DiagramAttempt>>(() => {
    try { return decodeDiagramAttempts(localStorage.getItem(predictionKey), content.predictions); } catch { return {}; }
  });
  const prediction = content.predictions[predictionIndex];
  const attempt = prediction ? attempts[prediction.id] : undefined;
  const explanation = stage === "walkthrough" ? content.scenes[sceneIndex] : stage === "prediction" && attempt?.revealed ? prediction?.reveal : undefined;
  const viewId = stage === "overview" ? viewChoice === "overview" ? undefined : viewChoice : explanation?.viewId;
  const effectiveCollapsed = useMemo(() => collapsed.filter(groupId => !explanation || !content.groups.find(group => group.id === groupId)?.members.some(member => explanation.nodeIds.includes(member))), [collapsed, explanation, content.groups]);
  const presentation = useMemo(() => presentSpatialLesson(lesson, {
    collapsed: effectiveCollapsed, viewId, explanation,
    filter: stage === "overview" ? filter : "all",
  }), [lesson, effectiveCollapsed, viewId, explanation, filter, stage]);
  const presentationRef = useRef(presentation.scene); presentationRef.current = presentation.scene;
  const framingKey = `${stage}:${explanation?.id ?? ""}:${viewId ?? "overview"}:${reduced}:${frameVersion}`;
  const framed = useRef<string | null>(null);
  const selectedNode = presentation.scene.nodes.find(node => node.id === nodeId);
  const selectedLink = presentation.scene.links.find(link => link.id === linkId);
  const selectedGroup = selectedNode?.members ? content.groups.find(group => `group:${group.id}` === selectedNode.id) : undefined;
  const relationKinds = useMemo(() => [...new Set(original.links.map(link => link.meaning))], [original]);
  const nodeTitle = (node: string | null) => presentation.scene.nodes.find(item => item.id === node)?.title ?? "Boundary";
  const lastStep = sceneIndex === content.scenes.length - 1;
  const hidden = presentation.omittedNodes > 0 || presentation.omittedLinks > 0;
  const proxyCount = presentation.scene.nodes.filter(node => node.members?.length).length;
  const scoped = Boolean(viewId || hidden || proxyCount || stage === "overview" && filter !== "all");
  const context = [
    viewId ? presentation.title : "",
    stage === "overview" && filter !== "all" ? `${relationshipLabels[filter]} relationships only` : "",
    proxyCount ? `${countLabel(proxyCount, "subsystem")} collapsed` : "",
    hidden ? `${countLabel(presentation.omittedNodes, "component")} and ${countLabel(presentation.omittedLinks, "relationship")} hidden here` : "",
  ].filter(Boolean).join(" · ");

  function clearSelection() { setNodeId(null); setLinkId(null); }
  function wholeSystem() {
    pendingFocus.current = "start"; alignCard.current = true; setFrameVersion(version => version + 1);
    clearSelection(); setStage("overview"); setViewChoice("overview"); setFilter("all"); setCollapsed([]);
  }
  function beginWalkthrough() {
    pendingFocus.current = "caption"; alignCard.current = true;
    clearSelection(); setSceneIndex(0); setStage("walkthrough"); setViewChoice("overview"); setFilter("all"); setCollapsed([]);
  }
  function chooseScene(index: number) {
    // Keep the navigation button focused unless this step removes or disables it.
    pendingFocus.current = index === 0 || index === content.scenes.length - 1 ? "step" : null;
    clearSelection(); setSceneIndex(index);
  }
  function beginPrediction() { pendingFocus.current = "caption"; alignCard.current = true; clearSelection(); setStage("prediction"); setViewChoice("overview"); setFilter("all"); setCollapsed([]); }
  function toggleGroup(groupId: string) {
    clearSelection(); setStage("overview"); setViewChoice("overview"); setFilter("all");
    setCollapsed(current => current.includes(groupId) ? current.filter(item => item !== groupId) : [...current, groupId]);
  }
  function selectNode(node: string, trigger?: HTMLButtonElement, keyboard = false) {
    selectionTrigger.current = trigger ?? null; focusInspection.current = keyboard; setLinkId(null); setNodeId(node);
  }
  function selectLink(link: string, trigger?: HTMLButtonElement, keyboard = false) {
    selectionTrigger.current = trigger ?? null; focusInspection.current = keyboard; setNodeId(null); setLinkId(link);
  }
  function dismissDetails() {
    clearSelection();
    const target = selectionTrigger.current;
    if (target?.isConnected && !target.closest("details:not([open])") && target.getClientRects().length) target.focus(); else host.current?.focus({ preventScroll: true });
  }

  useEffect(() => { setChanges(rememberSpatialLesson(original)); }, [original]);
  useEffect(() => {
    try { localStorage.setItem(predictionKey, JSON.stringify(attempts)); } catch { /* Practice works without storage. */ }
  }, [attempts, predictionKey]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)"), theme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncMotion = () => setSystemReduced(motion.matches), syncTheme = () => setThemeVersion(version => version + 1);
    motion.addEventListener("change", syncMotion); theme.addEventListener("change", syncTheme);
    return () => { motion.removeEventListener("change", syncMotion); theme.removeEventListener("change", syncTheme); };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    try {
      const view = createSpatialRuntime(host.current, presentationRef.current, {
        reduced, onPick(node) { if (node) selectNode(node); else clearSelection(); },
        onLinkPick(link) { selectLink(link); }, onUnavailable() { unavailable.current(); },
        onHidden() {}, onViewChange: setTop,
      });
      runtime.current = view; framed.current = null; setReady(true);
      return () => { runtime.current = null; view.dispose(); };
    } catch { unavailable.current(); }
  }, [original, themeVersion]);
  useEffect(() => { runtime.current?.reduce(reduced); }, [reduced, ready, themeVersion]);
  useEffect(() => { runtime.current?.reconcile(presentation.scene, { animate: !reduced }); }, [presentation.scene, ready, themeVersion, reduced]);
  useEffect(() => {
    if (nodeId || linkId) {
      runtime.current?.spotlight([], []);
      runtime.current?.select(nodeId, selectedLink ? presentation.scene.links.indexOf(selectedLink) : null);
    } else {
      runtime.current?.select(null, null);
      runtime.current?.spotlight(explanation?.nodeIds ?? [], explanation?.linkIds ?? []);
    }
  }, [nodeId, linkId, selectedLink, explanation, presentation.scene, ready, themeVersion]);
  useEffect(() => {
    if (!ready || !runtime.current || framed.current === framingKey) return;
    if (explanation && !viewId && !reduced) runtime.current.focusSpotlight(); else runtime.current.fitPresentation();
    framed.current = framingKey;
  }, [framingKey, explanation, viewId, ready, themeVersion, reduced]);
  useEffect(() => {
    const focus = pendingFocus.current;
    if (!focus) return;
    pendingFocus.current = null;
    const target = focus === "caption" ? caption.current : focus === "start" ? startButton.current
      : focus === "step" ? nextStep.current ?? predictionAction.current ?? caption.current
      : focus === "retry" ? retryButton.current : focus === "choice" ? firstChoice.current : host.current;
    target?.focus({ preventScroll: true });
    if (alignCard.current) { card.current?.scrollIntoView({ block: "start", behavior: "instant" }); alignCard.current = false; }
  }, [stage, sceneIndex, predictionIndex, frameVersion, attempt, collapsed]);
  useEffect(() => {
    if (focusInspection.current && (selectedNode || selectedLink)) {
      inspectorHeading.current?.focus(); focusInspection.current = false;
    }
  }, [selectedNode, selectedLink]);

  return <div ref={card} className={styles.root}>
    <div className={styles.intro}>
      <h3>{original.title}</h3>
      {stage === "overview" ? <>
        <p>{original.description}</p>
        {content.scenes.length ? <button ref={startButton} type="button" className={styles.primaryAction} disabled={!ready} onClick={beginWalkthrough}>Walk through the flow<ArrowRight size={15} aria-hidden="true"/></button> : null}
      </> : null}
    </div>

    {stage === "walkthrough" && explanation ? <section className={styles.teachingPanel} aria-label="Flow walkthrough">
      <div className={styles.stepHeading}><span className={styles.stepCount}>Step {sceneIndex + 1} of {content.scenes.length}</span><button type="button" className={styles.textAction} onClick={wholeSystem}>Return to whole system</button></div>
      <div aria-live="polite" aria-atomic="true"><h4 ref={caption} tabIndex={-1}>{explanation.title}</h4><p>{explanation.description}</p></div>
      <div className={styles.stepActions}>
        <button type="button" className={styles.secondaryAction} disabled={sceneIndex === 0} onClick={() => chooseScene(sceneIndex - 1)}><ArrowLeft size={15} aria-hidden="true"/>Previous</button>
        {lastStep ? <div className={styles.endActions}>
          <span className={styles.smallNote}>End of walkthrough</span>
          {content.predictions.length ? <button ref={predictionAction} type="button" className={styles.primaryAction} onClick={beginPrediction}>Try a prediction<ArrowRight size={15} aria-hidden="true"/></button> : null}
        </div> : <button ref={nextStep} type="button" className={styles.primaryAction} onClick={() => chooseScene(sceneIndex + 1)}>Next step<ArrowRight size={15} aria-hidden="true"/></button>}
      </div>
    </section> : null}

    {stage === "prediction" && prediction ? <section className={styles.teachingPanel} aria-label="Diagram prediction">
      <div className={styles.stepHeading}><span className={styles.stepCount}>Try a prediction</span><button type="button" className={styles.textAction} onClick={wholeSystem}>Return to whole system</button></div>
      {content.predictions.length > 1 ? <label className={styles.selectLabel}>Scenario<select value={predictionIndex} onChange={event => { clearSelection(); setPredictionIndex(Number(event.target.value)); }}>{content.predictions.map((item, index) => <option key={item.id} value={index}>{item.title}</option>)}</select></label> : null}
      <h4 ref={caption} tabIndex={-1}>{prediction.title}</h4>
      <fieldset className={styles.predictionChoices}><legend>{prediction.prompt}</legend>{prediction.options.map((option, index) => <label key={index} className={attempt?.choice === index ? styles.chosen : ""}><input ref={index === 0 ? firstChoice : undefined} type="radio" name={`diagram-prediction-${prediction.id}`} checked={attempt?.choice === index} disabled={attempt?.revealed} onChange={() => setAttempts(current => ({ ...current, [prediction.id]: { choice: index, revealed: false } }))}/><span>{option}</span></label>)}</fieldset>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.primaryAction} disabled={!attempt || attempt.revealed} onClick={() => { pendingFocus.current = "retry"; clearSelection(); setAttempts(current => ({ ...current, [prediction.id]: { ...current[prediction.id], revealed: true } })); }}>Reveal in diagram</button>
        {attempt?.revealed ? <button ref={retryButton} type="button" className={styles.secondaryAction} onClick={() => { pendingFocus.current = "choice"; clearSelection(); setAttempts(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== prediction.id))); }}>Try again</button> : null}
      </div>
      {attempt?.revealed ? <div className={styles.predictionFeedback} role="status"><strong>{attempt.choice === prediction.correctIndex ? "Your prediction matches this scenario." : "Revisit your prediction."}</strong><p>{prediction.explanation}</p></div> : <p className={styles.smallNote}>Choose an answer, then reveal the explanation. Your choice stays on this device.</p>}
    </section> : null}

    <div className={styles.viewportFrame}>
      <div ref={host} className={`${styles.viewport} ${expanded ? styles.expanded : ""}`} data-reduced={reduced} tabIndex={0} aria-label={`3D diagram: ${original.title}. ${reduced ? "Fixed camera." : "Drag or use arrow keys to rotate."} Select a component or relationship, or use Explore components and relationships below.`}>
        {!ready ? <p className={styles.loading} role="status">Preparing the 3D view…</p> : null}
      </div>
      <div className={styles.camera} role="group" aria-label="Camera controls" title={reduced ? "Camera is fixed while reduced motion is enabled." : undefined}>
        <button type="button" className={styles.cameraButton} aria-pressed={!top} disabled={reduced || !ready} onClick={() => runtime.current?.view(false)}>Angled</button>
        <button type="button" className={styles.cameraButton} aria-pressed={top} disabled={reduced || !ready} onClick={() => runtime.current?.view(true)}>Top</button>
        <div className={styles.cameraZoom}>
          <button type="button" className={styles.cameraButton} disabled={reduced || !ready} aria-label="Zoom out" title="Zoom out" onClick={() => runtime.current?.zoom(.85)}><Minus size={14} aria-hidden="true"/></button>
          <button type="button" className={styles.cameraButton} disabled={reduced || !ready} aria-label="Zoom in" title="Zoom in" onClick={() => runtime.current?.zoom(1.18)}><Plus size={14} aria-hidden="true"/></button>
        </div>
      </div>
    </div>
    <div className={styles.viewActions}>
      <div className={styles.viewContext} aria-live="polite"><p>{context || "Select a component or arrow to learn more."}</p>{stage === "overview" && scoped ? <button type="button" className={styles.textAction} onClick={wholeSystem}>Show whole system</button> : null}</div>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.textAction} disabled={!ready} aria-label="Reset camera view" onClick={() => runtime.current?.reset()}><RotateCcw size={14} aria-hidden="true"/>Reset view</button>
        <button type="button" className={styles.textAction} disabled={!ready} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={14} aria-hidden="true"/> : <Maximize2 size={14} aria-hidden="true"/>}{expanded ? "Shrink diagram" : "Expand diagram"}</button>
      </div>
    </div>

    <div id={`${id}-details`} className={styles.detailsAnnouncement} aria-live="polite" aria-atomic="true">
      {selectedNode || selectedLink ? <section className={styles.inspector} aria-labelledby={`${id}-details-title`}>
        <div className={styles.stepHeading}><span className={styles.kicker}>{selectedLink ? "Relationship" : "Component"}</span><button type="button" className={styles.textAction} onClick={dismissDetails}><X size={14} aria-hidden="true"/>Dismiss details</button></div>
        <h4 ref={inspectorHeading} id={`${id}-details-title`} tabIndex={-1}>{selectedLink ? `${nodeTitle(selectedLink.source)} → ${nodeTitle(selectedLink.target)}` : selectedNode?.title}</h4>
        <p>{selectedLink?.explanation ?? selectedGroup?.description ?? selectedNode?.detail}</p>
        {selectedLink ? <p className={styles.relationCondition}><strong>{relationshipLabels[selectedLink.meaning]}</strong>{selectedLink.condition ? ` · ${selectedLink.condition}` : ""}{selectedLink.dashed ? " · Dashed relationship" : ""}</p> : null}
        {selectedNode?.status ? <p className={styles.relationCondition}>Scenario state: {selectedNode.status.replace(/-/g, " ")}</p> : null}
        {selectedGroup ? <button type="button" className={styles.secondaryAction} onClick={() => { pendingFocus.current = "canvas"; toggleGroup(selectedGroup.id); }}>Expand {selectedGroup.title}</button> : null}
        {selectedLink && selectedLink.origins.length > 1 ? <details className={styles.provenance}><summary>{countLabel(selectedLink.origins.length, "original relationship")} represented</summary><ul>{selectedLink.origins.map(origin => {
          const link = original.links.find(item => item.id === origin);
          const from = original.nodes.find(node => node.id === link?.source)?.title ?? "Boundary", to = original.nodes.find(node => node.id === link?.target)?.title ?? "Boundary";
          return <li key={origin}><strong>{from} → {to}</strong> · {link?.explanation}</li>;
        })}</ul></details> : null}
      </section> : null}
    </div>

    <div className={styles.disclosures}>
      <details className={styles.disclosure}>
        <summary>Diagram options</summary>
        <div className={styles.optionsGrid}>
          <section className={styles.optionGroup} aria-label="Motion">
            <h4>Motion</h4>
            <label className={styles.reduce}><input type="checkbox" checked={reduced} disabled={systemReduced} onChange={event => { setManualReduced(event.target.checked); try { localStorage.setItem("systemkit:diagram-motion:v1", event.target.checked ? "reduced" : "normal"); } catch { /* Optional preference. */ } }}/><span>Reduce motion{systemReduced ? " · System setting" : ""}</span></label>
          </section>
          {content.views.length || original.links.length ? <section className={styles.optionGroup} aria-label="Diagram scope">
            <h4>Show in the diagram</h4>
            {content.views.length ? <label className={styles.selectLabel}>Lesson view<select value={stage === "overview" ? viewChoice : "follow"} onChange={event => { if (event.target.value === "follow") return; clearSelection(); setStage("overview"); setViewChoice(event.target.value); setFilter("all"); }}>
              {stage !== "overview" ? <option value="follow">Follow current step</option> : null}<option value="overview">Whole system</option>{content.views.map(view => <option key={view.id} value={view.id}>{view.title}</option>)}
            </select></label> : null}
            {original.links.length ? <label className={styles.selectLabel}>Relationships<select value={stage === "overview" ? filter : "all"} onChange={event => { clearSelection(); setStage("overview"); setViewChoice("overview"); setFilter(event.target.value as RelationMeaning | "all"); }}><option value="all">All relationships</option>{relationKinds.map(kind => <option key={kind} value={kind}>{relationshipLabels[kind]}</option>)}</select></label> : null}
          </section> : null}
          {content.groups.length ? <section className={styles.optionGroup} aria-label="Subsystems"><h4>Subsystems</h4><div className={styles.subsystems}>{content.groups.map(group => <div key={group.id}><div><strong>{group.title}</strong><p>{group.description}</p></div><button type="button" className={styles.secondaryAction} disabled={!ready} aria-expanded={!effectiveCollapsed.includes(group.id)} onClick={() => toggleGroup(group.id)}>{effectiveCollapsed.includes(group.id) ? "Expand" : "Collapse"} {group.title}</button></div>)}</div></section> : null}
          {changes ? <section className={styles.optionGroup}><h4>Since the previous lesson</h4><p>{countLabel(changes.retained, "component")} {changes.retained === 1 ? "keeps its" : "keep their"} identity from “{changes.previousTitle}”.</p>{changes.added.length ? <p>Added: {changes.added.join(", ")}.</p> : null}{changes.removed.length ? <p>Left this diagram: {changes.removed.join(", ")}.</p> : null}</section> : null}
        </div>
      </details>
      <details className={styles.disclosure}>
        <summary>Explore components and relationships</summary>
        <div className={styles.exploration}>
          <section><h4>Components</h4><div className={styles.elements}>{presentation.scene.nodes.map(node => <button type="button" className={styles.secondaryAction} key={node.id} aria-pressed={nodeId === node.id} aria-controls={`${id}-details`} onClick={event => selectNode(node.id, event.currentTarget, event.detail === 0)}>{node.title}{node.members ? ` · ${countLabel(node.members.length, "component")}` : ""}</button>)}</div></section>
          {presentation.scene.links.length ? <section><h4>Relationships</h4><div className={styles.relationships}>{presentation.scene.links.map(link => <button type="button" key={link.id} aria-pressed={linkId === link.id} aria-controls={`${id}-details`} onClick={event => selectLink(link.id, event.currentTarget, event.detail === 0)}><strong>{nodeTitle(link.source)} → {nodeTitle(link.target)}</strong><span>{relationshipLabels[link.meaning]}{link.label !== "Connection" ? ` · ${link.label}` : ""}{link.origins.length > 1 ? ` · ${countLabel(link.origins.length, "original relationship")}` : ""}</span></button>)}</div></section> : null}
        </div>
      </details>
    </div>
  </div>;
}
