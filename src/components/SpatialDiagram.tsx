"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, Minus, Plus, Maximize2, Minimize2, Pause, X } from "lucide-react";
import { getSpatialLesson, decodeDiagramAttempts, relationshipLabels, type DiagramAttempt } from "../lib/spatial-learning";
import { presentSpatialLesson } from "../lib/spatial-layout";
import { createSpatialRuntime, type SpatialRuntime } from "../lib/spatial-runtime";
import styles from "./SpatialDiagram.module.css";

type Stage = "overview" | "walkthrough" | "prediction";

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
  const pendingFocus = useRef<"caption" | "start" | "step" | "retry" | "choice" | null>(null);
  const unavailable = useRef(onUnavailable); unavailable.current = onUnavailable;
  const [ready, setReady] = useState(false);
  const [stage, setStage] = useState<Stage>("overview");
  const [sceneIndex, setSceneIndex] = useState(0);
  const [predictionIndex, setPredictionIndex] = useState(0);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [linkId, setLinkId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
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
  const viewId = explanation?.viewId;
  const presentation = useMemo(() => presentSpatialLesson(lesson, { collapsed: [], viewId, explanation }), [lesson, viewId, explanation]);
  const presentationRef = useRef(presentation.scene); presentationRef.current = presentation.scene;
  const framingKey = `${stage}:${explanation?.id ?? ""}:${viewId ?? "overview"}:${reduced}:${frameVersion}`;
  const framed = useRef<string | null>(null);
  const selectedNode = presentation.scene.nodes.find(node => node.id === nodeId);
  const selectedLink = presentation.scene.links.find(link => link.id === linkId);
  const nodeTitle = (node: string | null) => presentation.scene.nodes.find(item => item.id === node)?.title ?? "Boundary";
  const lastStep = sceneIndex === content.scenes.length - 1;
  const hidden = presentation.omittedNodes > 0 || presentation.omittedLinks > 0;
  const context = hidden
    ? `${presentation.scene.nodes.length} of ${original.nodes.length} components · ${presentation.scene.links.length} of ${original.links.length} connections`
    : original.links.length ? "Select a component or connection to learn more." : "Select a component to learn more.";

  function clearSelection() { setNodeId(null); setLinkId(null); }
  function wholeSystem() {
    pendingFocus.current = "start"; alignCard.current = true; setFrameVersion(version => version + 1);
    clearSelection(); setStage("overview");
  }
  function beginWalkthrough() {
    pendingFocus.current = "caption"; alignCard.current = true;
    clearSelection(); setSceneIndex(0); setStage("walkthrough");
  }
  function chooseScene(index: number) {
    // Keep the navigation button focused unless this step removes or disables it.
    pendingFocus.current = index === 0 || index === content.scenes.length - 1 ? "step" : null;
    clearSelection(); setSceneIndex(index);
  }
  function beginPrediction() { pendingFocus.current = "caption"; alignCard.current = true; clearSelection(); setStage("prediction"); }
  function selectNode(node: string, trigger?: HTMLButtonElement, keyboard = Boolean(trigger?.matches(":focus-visible"))) {
    selectionTrigger.current = trigger ?? null; focusInspection.current = keyboard; setLinkId(null); setNodeId(node);
  }
  function selectLink(link: string, trigger?: HTMLButtonElement, keyboard = Boolean(trigger?.matches(":focus-visible"))) {
    selectionTrigger.current = trigger ?? null; focusInspection.current = keyboard; setNodeId(null); setLinkId(link);
  }
  function dismissDetails() {
    clearSelection();
    const target = selectionTrigger.current;
    if (target?.isConnected && !target.disabled) target.focus({ preventScroll: true }); else host.current?.focus({ preventScroll: true });
  }

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
        reduced, onPick(node, trigger?: HTMLButtonElement) { if (node) selectNode(node, trigger); else clearSelection(); },
        onLinkPick(link, trigger?: HTMLButtonElement) { selectLink(link, trigger); }, onUnavailable() { unavailable.current(); },
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
  }, [stage, sceneIndex, predictionIndex, frameVersion, attempt]);
  useEffect(() => {
    if (focusInspection.current && (selectedNode || selectedLink)) {
      inspectorHeading.current?.focus({ preventScroll: true }); focusInspection.current = false;
    }
  }, [selectedNode, selectedLink]);

  return <div ref={card} className={styles.root} onKeyDown={event => {
    if (event.key === "Escape" && (selectedNode || selectedLink)) { event.preventDefault(); event.stopPropagation(); dismissDetails(); }
  }}>
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
      <div ref={host} className={`${styles.viewport} ${expanded ? styles.expanded : ""}`} data-reduced={reduced} tabIndex={0} aria-label={`3D diagram: ${original.title}. ${reduced ? "Fixed camera." : "Drag or use arrow keys to rotate."} Tab through components and connections; press Enter to inspect.`}>
        {!ready ? <p className={styles.loading} role="status">Preparing the 3D view…</p> : null}
      </div>
      <div className={styles.camera} data-spatial-overlay role="group" aria-label="Camera controls" title={reduced ? "Camera is fixed while reduced motion is enabled." : undefined}>
        <button type="button" className={styles.cameraButton} aria-pressed={!top} disabled={reduced || !ready} onClick={() => runtime.current?.view(false)}>Angled</button>
        <button type="button" className={styles.cameraButton} aria-pressed={top} disabled={reduced || !ready} onClick={() => runtime.current?.view(true)}>Top</button>
        <div className={styles.cameraZoom}>
          <button type="button" className={styles.cameraButton} disabled={reduced || !ready} aria-label="Zoom out" title="Zoom out" onClick={() => runtime.current?.zoom(.85)}><Minus size={14} aria-hidden="true"/></button>
          <button type="button" className={styles.cameraButton} disabled={reduced || !ready} aria-label="Zoom in" title="Zoom in" onClick={() => runtime.current?.zoom(1.18)}><Plus size={14} aria-hidden="true"/></button>
        </div>
      </div>
      <div className={styles.utilities} data-spatial-overlay role="group" aria-label="Diagram controls">
        <button type="button" className={styles.cameraButton} aria-label="Reduce motion" aria-pressed={reduced} disabled={systemReduced} title={systemReduced ? "Reduced motion follows your system setting" : reduced ? "Allow motion" : "Reduce motion"} onClick={() => {
          setManualReduced(value => !value);
          try { localStorage.setItem("systemkit:diagram-motion:v1", manualReduced ? "normal" : "reduced"); } catch { /* Optional preference. */ }
        }}><Pause size={14} aria-hidden="true"/></button>
        <button type="button" className={styles.cameraButton} disabled={!ready} aria-label="Reset camera view" title="Reset view" onClick={() => runtime.current?.reset()}><RotateCcw size={14} aria-hidden="true"/></button>
        <button type="button" className={styles.cameraButton} disabled={!ready} aria-label={expanded ? "Shrink diagram" : "Expand diagram"} title={expanded ? "Shrink diagram" : "Expand diagram"} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={14} aria-hidden="true"/> : <Maximize2 size={14} aria-hidden="true"/>}</button>
      </div>
      <p className={styles.scope} data-spatial-overlay role="status">{context}</p>
      <div id={`${id}-details`} className={styles.inspectionLayer} data-spatial-overlay aria-live="polite" aria-atomic="true">
        {selectedNode || selectedLink ? <section className={styles.inspector} aria-labelledby={`${id}-details-title`}>
          <div className={styles.inspectionHeading}>
            <div><span className={styles.kicker}>{selectedLink ? "Connection" : "Component"}</span>
              <h4 ref={inspectorHeading} id={`${id}-details-title`} tabIndex={-1}>{selectedLink ? `${nodeTitle(selectedLink.source)} → ${nodeTitle(selectedLink.target)}` : selectedNode?.title}</h4>
            </div>
            <button type="button" className={styles.cameraButton} aria-label="Close details" title="Close details" onClick={dismissDetails}><X size={14} aria-hidden="true"/></button>
          </div>
          <p>{selectedLink?.explanation ?? selectedNode?.detail}</p>
          {selectedLink ? <p className={styles.relationCondition}>{relationshipLabels[selectedLink.meaning]}{selectedLink.condition ? ` · ${selectedLink.condition}` : ""}</p> : null}
          {selectedNode?.status ? <p className={styles.relationCondition}>Scenario state: {selectedNode.status.replace(/-/g, " ")}</p> : null}
        </section> : null}
      </div>
    </div>
  </div>;
}
