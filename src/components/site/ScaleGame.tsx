"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Check, Database, RotateCcw, Server, Split, Users, Zap, type LucideIcon } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { formatPercent, formatUsers, SCALE_CALM, SCALE_ROUNDS, SCALE_START, scaleFlow, scaleNodes, systemLoad, withFix, type ScaleNode } from "@/lib/scale-game";
import { createScaleScene, type ScalePlace, type ScaleScene } from "@/lib/scale-scene";
import { Rolling } from "./HomeMotion";
import styles from "./HomeVisuals.module.css";

const ICONS: Record<ScaleNode["kind"], LucideIcon> = { users: Users, balancer: Split, server: Server, cache: Zap, database: Database };

function NodeValue({ node, cacheHit }: { node: ScaleNode; cacheHit: number }) {
  if (node.kind === "cache") return <><Rolling value={formatPercent(cacheHit)} /> hits</>;
  if (node.load === null) return null;
  return <Rolling value={formatPercent(node.load)} />;
}

/** Your app, a surge of traffic, and three calls to make. The dots are requests, and the orange ones are lost. */
export default function ScaleGame() {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ScaleScene | null>(null);
  const firstFix = useRef<HTMLButtonElement>(null);
  const onward = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const [roundIndex, setRoundIndex] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);

  const round = roundIndex >= 0 ? SCALE_ROUNDS[roundIndex] : null;
  const system = round ? withFix(round, picked) : SCALE_START;
  const requests = round?.requests ?? SCALE_CALM.requests;
  const users = round?.users ?? SCALE_CALM.users;
  const load = systemLoad(system, requests);
  const nodes = useMemo(() => scaleNodes(system, requests), [system, requests]);
  const solved = round !== null && picked === round.answer;
  const finished = solved && roundIndex === SCALE_ROUNDS.length - 1;
  const note = round?.fixes.find((fix) => fix.id === picked)?.note;

  // The surge arrives once the game has been seen quiet for a moment.
  useEffect(() => {
    if (!root.current) return;
    let timer = 0;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const watcher = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      watcher.disconnect();
      timer = window.setTimeout(() => setRoundIndex(0), still ? 0 : 900);
    }, { threshold: 0.4 });
    watcher.observe(root.current);
    return () => {
      watcher.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!canvas.current || !map.current) return;
    const board = map.current;
    const drawing = canvas.current;
    const readPlaces = () => {
      const origin = drawing.getBoundingClientRect();
      const places = new Map<string, ScalePlace>();
      board.querySelectorAll<HTMLElement>("[data-node]").forEach((element) => {
        const box = element.getBoundingClientRect();
        places.set(element.dataset.node ?? "", { x: box.left + box.width / 2 - origin.left, y: box.top + box.height / 2 - origin.top, r: box.width / 2 });
      });
      return places;
    };
    scene.current = createScaleScene(drawing, readPlaces);
    return () => {
      scene.current?.destroy();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.update(scaleFlow(system, requests, nodes));
  }, [system, requests, nodes]);

  // The answer disables the choices, so keyboard focus moves on to what comes next.
  useEffect(() => {
    if (solved) onward.current?.focus({ preventScroll: true });
  }, [solved]);

  function choose(id: string) {
    setPicked(id);
    trackEvent("scale_game_call");
    if (round && id === round.answer && roundIndex === SCALE_ROUNDS.length - 1) trackEvent("scale_game_done");
  }

  function advance() {
    setRoundIndex(roundIndex + 1);
    setPicked(null);
    requestAnimationFrame(() => firstFix.current?.focus({ preventScroll: true }));
  }

  function restart() {
    setRoundIndex(0);
    setPicked(null);
    requestAnimationFrame(() => firstFix.current?.focus({ preventScroll: true }));
  }

  return <div ref={root} className={styles.game}>
    <div className={styles.readout}>
      <p className={styles.stat}><Rolling className={styles.statValue} value={formatUsers(users)} /> <span>users</span></p>
      <ol className={styles.rounds} aria-hidden="true">
        {SCALE_ROUNDS.map((item, index) => <li key={item.users} data-state={index < roundIndex || (index === roundIndex && solved) ? "done" : index === roundIndex ? "now" : undefined} />)}
      </ol>
      <p className={`${styles.stat} ${styles.statFailing}`} data-hot={load.failing > 0 || undefined}><Rolling className={styles.statValue} value={formatPercent(load.failing)} /> <span>failing</span></p>
    </div>

    <div ref={map} className={styles.map} aria-hidden="true">
      <canvas ref={canvas} className={styles.wires} />
      {nodes.map((node) => {
        const Icon = ICONS[node.kind];
        const hot = node.load !== null && node.load > 1;
        return <div key={node.id} className={styles.node} data-hot={hot || undefined} style={{ "--x": node.x, "--y": node.y } as CSSProperties}>
          <span className={styles.disc} data-node={node.id}>
            {node.load !== null ? <svg className={styles.ring} viewBox="0 0 100 100"><circle className={styles.ringTrack} cx="50" cy="50" r="48" /><circle className={styles.ringLoad} cx="50" cy="50" r="48" pathLength="100" strokeDasharray={`${Math.min(1, node.load) * 100} 100`} /></svg> : null}
            <Icon size={18} strokeWidth={1.8} />
          </span>
          {node.label ? <span className={styles.nodeLabel}>{node.label}<b><NodeValue node={node} cacheHit={system.cacheHit} /></b></span> : null}
        </div>;
      })}
    </div>

    <div className={styles.calls}>
      <p className={styles.note} data-solved={solved || undefined}>
        {solved ? <Check size={16} aria-hidden="true" /> : null}
        {finished ? `${formatUsers(users)} users. Nothing failing.` : note ?? (round ? "What do you do?" : "All quiet.")}
      </p>
      {finished ? <div className={styles.finish}>
        <Link ref={onward} className={styles.finishMain} href="/learn/scaling/" onClick={() => trackEvent("scale_game_lesson")}>Learn why <ArrowRight size={16} aria-hidden="true" /></Link>
        <Link className={styles.finishNext} href="/labs/cache/" onClick={() => trackEvent("scale_game_lab")}>Now the cache dies <ArrowRight size={16} aria-hidden="true" /></Link>
        <button type="button" className={styles.again} onClick={restart}><RotateCcw size={15} aria-hidden="true" /> Again</button>
      </div> : <div className={styles.fixes}>
        {(round?.fixes ?? SCALE_ROUNDS[0].fixes).map((fix, index) => <button
          key={`${roundIndex}-${fix.id}`}
          ref={index === 0 ? firstFix : undefined}
          type="button"
          aria-pressed={picked === fix.id}
          disabled={!round || solved}
          onClick={() => choose(fix.id)}
        >{fix.label}</button>)}
        {solved ? <button ref={onward} type="button" className={styles.next} onClick={advance}>Traffic keeps growing <ArrowRight size={16} aria-hidden="true" /></button> : null}
      </div>}
    </div>

    <p className={styles.small}>A simplified model.</p>
    <p className="sr-only" role="status">{users.toLocaleString("en-US")} users, {formatPercent(load.failing)} of requests failing. {note ?? ""}</p>
  </div>;
}
