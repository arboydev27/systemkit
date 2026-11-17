"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./HomeVisuals.module.css";

const DIGITS = "0\n1\n2\n3\n4\n5\n6\n7\n8\n9"; // One text node rather than ten elements a digit.

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

/**
 * A tile whose picture plays once, the first time most of it comes on screen, and then stays put. Until then it waits
 * on the picture's first frame. A tile that's already on screen when the page loads, or any tile for someone who
 * prefers reduced motion, is simply left finished, so nothing jumps back to play.
 */
export function PlayOnce({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const node = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const element = node.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.dataset.armed = "";
    const watcher = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.dataset.on = "";
      watcher.disconnect();
    }, { threshold: 0.55 });
    watcher.observe(element);
    return () => watcher.disconnect();
  }, []);
  return <li ref={node} className={className} style={style}>{children}</li>;
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
