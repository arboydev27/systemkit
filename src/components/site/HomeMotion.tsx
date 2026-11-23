"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./HomeVisuals.module.css";

const DIGITS = "0\n1\n2\n3\n4\n5\n6\n7\n8\n9"; // One text node rather than ten elements a digit.
const quantity = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });

/** A value whose digits roll to their new place, like a mechanical counter. Screen readers get the value from nearby text. */
export function Rolling({ value, className = "" }: { value: string; className?: string }) {
  const characters = [...value];
  return <span className={`${styles.rolling} ${className}`} aria-hidden="true">
    {characters.map((character, index) => {
      // Counted from the right, so a digit keeps rolling when the value gains a place on its left.
      const place = characters.length - index;
      return /\d/.test(character)
        ? <span key={`d${place}`} className={styles.rollingPlace}><span className={styles.rollingStrip} style={{ transform: `translateY(${-Number(character)}em)` }}>{DIGITS}</span></span>
        : <span key={`c${place}`}>{character}</span>;
    })}
  </span>;
}

/** Marks its contents as on screen, which is what starts the charts inside moving and stops them again. */
export function Live({ children, className = "" }: { children: ReactNode; className?: string }) {
  const node = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!node.current) return;
    const watcher = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { rootMargin: "60px 0px" });
    watcher.observe(node.current);
    return () => watcher.disconnect();
  }, []);
  return <div ref={node} className={className} data-on={on || undefined}>{children}</div>;
}

const SAMPLES = [
  { users: 2, actions: 4, peak: 5 },
  { users: 10, actions: 20, peak: 2 },
  { users: 50, actions: 10, peak: 3 },
  { users: 100, actions: 40, peak: 3 },
];
const SAMPLE_MS = 3_600;

/** The estimation drill's own arithmetic, with new numbers rolling in while it's on screen. */
export function EstimateRoll() {
  const node = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!node.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    const watcher = new IntersectionObserver(([entry]) => {
      window.clearInterval(timer);
      if (entry.isIntersecting) timer = window.setInterval(() => setIndex((current) => (current + 1) % SAMPLES.length), SAMPLE_MS);
    });
    watcher.observe(node.current);
    return () => {
      watcher.disconnect();
      window.clearInterval(timer);
    };
  }, []);
  const { users, actions, peak } = SAMPLES[index];
  const answer = (users * 1e6 * actions / 86_400) * peak;
  return <div ref={node} className={styles.estimate} role="img" aria-label={`For example, ${users} million users making ${actions} requests a day, divided by the seconds in a day, at ${peak} times the average: about ${quantity.format(answer)} requests per second.`}>
    <div className={styles.estimateRow}>
      <span><Rolling value={`${users}M`} /><small>users</small></span>
      <i>×</i>
      <span><Rolling value={String(actions)} /><small>requests</small></span>
      <i>÷</i>
      <span>86,400<small>seconds</small></span>
      <i>×</i>
      <span><Rolling value={String(peak)} /><small>peak</small></span>
    </div>
    <div className={styles.estimateAnswer}><span>≈</span> <Rolling value={quantity.format(answer)} /> <small>requests a second</small></div>
  </div>;
}

const ScaleGame = dynamic(() => import("./ScaleGame"), { ssr: false });

/** Holds the game's place and loads its code only as the page gets close to it. */
export function ScaleGameSlot() {
  const node = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!node.current) return;
    const watcher = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        watcher.disconnect();
      }
    }, { rootMargin: "700px 0px" });
    watcher.observe(node.current);
    return () => watcher.disconnect();
  }, []);
  return <div ref={node} className={styles.gameSlot} data-scale-slot>{near ? <ScaleGame /> : null}</div>;
}
