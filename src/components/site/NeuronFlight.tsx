"use client";

import { useEffect, useRef, type RefObject } from "react";
import { makeFilm, shoot, type Film } from "@/lib/neuron-film";
import { createNeuronGl, type NeuronGl } from "@/lib/neuron-gl";
import { FLIGHT, hermite, ramp, settleTo } from "@/lib/neuron-route";
import { createNeuronScene, holeAt, type NeuronPlace } from "@/lib/neuron-scene";
import type { OrbGraph } from "@/lib/orb-layout";
import type { OrbScene } from "@/lib/orb-scene";
import { FIT, linkDegrees, ORB_RADIUS } from "@/lib/orb-view";
import styles from "./OrbHome.module.css";

const FOLLOW = 0.05; // Seconds the dive takes to catch up with the page, so a wheel's steps run together.
const QUICKEST = 0.6; // However far the page jumps, the whole dive takes at least this long, and the page waits under it.
const SETTLE_MS = 1000; // A whole dive, when scrolling stops partway and it finishes on its own.
const QUIET_AFTER_INPUT = 140;
const QUIET_OTHERWISE = 480;
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Tab"]);

export type NeuronFlightProps = {
  graph: OrbGraph;
  /** The lessons the dive may come out at: the ones about scaling, since the game is about scaling. */
  exits: number[];
  orb: RefObject<OrbScene | null>;
  finished: boolean[];
};

/**
 * Scrolling from the orb to the game dives through one of its dots and along real links to a lesson about scaling,
 * then opens on the game. The page scrolls as it always does: the dive only follows it, and once scrolling stops
 * partway it finishes the way the visitor was going. Anything a visitor does stops it.
 */
export default function NeuronFlight({ graph, exits, orb, finished }: NeuronFlightProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const deep = useRef<HTMLCanvasElement>(null);
  const done = useRef(finished);
  useEffect(() => { done.current = finished; }, [finished]);

  useEffect(() => {
    const node = canvas.current;
    const under = deep.current;
    const world = node?.parentElement;
    const stage = world?.querySelector<HTMLElement>("[data-home-stage]");
    const wrap = stage?.querySelector<HTMLElement>("[data-home-orb]");
    const plate = wrap?.querySelector<HTMLElement>("[role='application']");
    const lens = stage?.querySelector<HTMLElement>("[data-home-orb] a");
    const section = document.getElementById("try");
    if (!node || !under || !world || !stage || !wrap || !plate || !section) return;
    const beneath: HTMLCanvasElement = under;
    let scene: ReturnType<typeof createNeuronScene> = null;
    try { scene = createNeuronScene(node, graph, exits); } catch { scene = null; }
    if (!scene) return;
    const dive = scene;
    const root = document.documentElement;
    // The neuron itself, in WebGL. Its shaders compile in the background now, so the first dive doesn't wait for them,
    // and a dive that starts before they're ready, or on a device without WebGL 2, draws the course's lines instead.
    let neuron: NeuronGl | null = null;
    let made = false;
    const onLost = (event: Event) => { event.preventDefault(); neuron = null; film = null; beneath.style.display = "none"; };
    beneath.addEventListener("webglcontextlost", onLost);
    const degrees = linkDegrees(graph);
    let film: Film | null = null;
    const born = performance.now();
    // In idle moments before any dive, time a few hidden frames of a typical stretch of axon to pick a size this
    // device can march in time, so the first dive doesn't start by stuttering.
    const sample = makeFilm([0, 1, 2, 3], graph.titles, degrees);
    let tuning = 0;
    const idles = "requestIdleCallback" in window;
    const tune = () => {
      tuning = 0;
      // Never during a dive: try again once it's over.
      if (launched) {
        tuning = window.setTimeout(tune, 1200);
        return;
      }
      // The context and its shaders are made in an idle moment of their own, apart from everything else.
      if (!made) {
        made = true;
        try { neuron = createNeuronGl(beneath, window.matchMedia("(pointer: coarse)").matches ? "light" : "full"); } catch { neuron = null; }
        if (neuron) tuning = idles ? window.requestIdleCallback(tune, { timeout: 2000 }) : window.setTimeout(tune, 300);
        return;
      }
      if (!neuron) return;
      const width = beneath.clientWidth || window.innerWidth;
      const height = beneath.clientHeight || window.innerHeight;
      if (neuron.calibrate(sample, shoot(sample, 0.45, width, height, width / 2, height / 2))) return;
      tuning = idles ? window.requestIdleCallback(tune, { timeout: 2000 }) : window.setTimeout(tune, 300);
    };
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    world.dataset.flight = "";

    const place: NeuronPlace = { orbX: 0, orbY: 0, orbSize: 0, holeX: 0, holeY: 0 };
    let zoneStart = 0;
    let zoneEnd = 1;
    let progress = 0;
    let drawn = -1;
    let direction = 0;
    let lastY = window.scrollY;
    let lastScrollAt = 0;
    let inputAt = -Infinity;
    let touching = false;
    let settling: { from: number; to: number; start: number; ms: number; way: number; at: number } | null = null;
    let frame = 0;
    let last = 0;
    let launched = false;
    let arrived = false;
    let pinned = false;
    let launchScroll = 0;
    let launchOrbY = 0;
    let hint: { x: number; y: number } | null = null;

    function measure() {
      const top = section!.getBoundingClientRect().top + window.scrollY;
      zoneEnd = top;
      zoneStart = Math.max(0, top - window.innerHeight);
      dive.resize();
    }

    // The page scrolls in whole pixels while the zone's ends can fall between them, so a pixel short of an end is the end.
    const scrolled = () => {
      const y = window.scrollY;
      if (y >= zoneEnd - 1) return 1;
      if (y <= zoneStart + 1) return 0;
      return (y - zoneStart) / (zoneEnd - zoneStart);
    };

    function launch() {
      const box = plate!.getBoundingClientRect();
      place.orbSize = plate!.offsetWidth;
      place.orbX = box.left + box.width / 2;
      place.orbY = box.top + box.height / 2;
      launchOrbY = place.orbY;
      launchScroll = window.scrollY;
      pinned = getComputedStyle(stage!).position === "sticky";
      const reach = place.orbSize * ORB_RADIUS * FIT;
      const pointer = hint && Math.hypot(hint.x - place.orbX, hint.y - place.orbY) < reach * 1.1 ? { x: (hint.x - place.orbX) / reach, y: (hint.y - place.orbY) / reach } : null;
      const lensReach = lens ? (lens.offsetWidth / 2 / reach) * 1.2 : 0;
      orb.current?.setFrozen(true);
      const entry = dive.launch(orb.current?.view() ?? { yaw: 0, pitch: 0 }, place, done.current, pointer, lensReach);
      film = neuron?.ready() && neuron.capable() ? makeFilm(dive.route(), graph.titles, degrees) : null;
      // The page in front of the orb blows outward from the dot as the camera goes for it.
      const stageBox = stage!.getBoundingClientRect();
      stage!.style.transformOrigin = `${(place.orbX + entry.x - stageBox.left).toFixed(1)}px ${(place.orbY + entry.y - stageBox.top).toFixed(1)}px`;
      launched = true;
    }

    function release() {
      stage!.style.transform = "";
      stage!.style.transformOrigin = "";
      stage!.style.willChange = "";
      orb.current?.setFrozen(false);
      launched = false;
    }

    function land() {
      release();
      node!.style.display = "none";
      beneath.style.display = "none";
      stage!.style.opacity = "";
      stage!.style.pointerEvents = "";
      plate!.style.opacity = "";
      wrap!.style.opacity = "";
      section!.style.opacity = "";
      delete root.dataset.neuron;
      arrived = false;
    }

    function arrive() {
      if (arrived) return;
      arrived = true;
      window.dispatchEvent(new Event("neuron:arrive"));
    }

    function trackHole() {
      const target = section!.querySelector<HTMLElement>('[data-node="users-1"]');
      const width = window.innerWidth;
      const height = node!.clientHeight || window.innerHeight;
      if (target) {
        const box = target.getBoundingClientRect();
        place.holeX = box.left + box.width / 2;
        place.holeY = box.top + box.height / 2;
      } else {
        const slot = section!.querySelector<HTMLElement>("[data-scale-slot]") ?? section!;
        const box = slot.getBoundingClientRect();
        place.holeX = box.left + box.width * 0.12;
        place.holeY = box.top + Math.min(box.height * 0.45, 320);
      }
      place.holeX = Math.min(width - 24, Math.max(24, place.holeX));
      place.holeY = Math.min(height - 24, Math.max(24, place.holeY));
    }

    function apply() {
      if (progress <= 0) {
        if (launched || root.dataset.neuron || node!.style.display === "block" || stage!.style.opacity) land();
        return;
      }
      if (progress >= 1) {
        // At the game: the orb rests hidden under it, still in the tab order, and focusing it flies back.
        if (launched) release();
        node!.style.display = "none";
        beneath.style.display = "none";
        stage!.style.opacity = "0";
        stage!.style.pointerEvents = "none";
        section!.style.opacity = "";
        delete root.dataset.neuron;
        arrive();
        return;
      }
      if (!launched) launch();
      // The words go past the camera as it goes for the dot. The orb's own glass goes at once, since the copy on the
      // canvas has taken over the dots and is about to draw back from them.
      const fall = ramp(0, FLIGHT.pull, progress);
      const covered = progress >= FLIGHT.covered;
      stage!.style.willChange = covered ? "" : "transform, opacity";
      stage!.style.transform = covered ? "" : `scale(${(1 + fall * fall * 0.35).toFixed(4)})`;
      stage!.style.opacity = String(1 - fall);
      stage!.style.pointerEvents = "none";
      wrap!.style.opacity = String(1 - ramp(0, 0.03, progress));
      plate!.style.opacity = String(1 - ramp(0, 0.015, progress));
      section!.style.opacity = progress < 0.5 ? "0" : "";
      root.dataset.neuron = progress < FLIGHT.open ? "covering" : "open";
      // Shaders that finish compiling before the dot opens still make this dive.
      if (!film && progress < FLIGHT.pull && neuron?.ready() && neuron.capable()) film = makeFilm(dive.route(), graph.titles, degrees);
      if (progress >= FLIGHT.open - 0.02) arrive();
      else if (progress < 0.5) arrived = false;
      if (!pinned) place.orbY = launchOrbY - (window.scrollY - launchScroll);
      if (progress > FLIGHT.open - 0.2) trackHole();
      node!.style.display = "block";
      if (!film || !neuron) {
        beneath.style.display = "none";
        dive.draw(progress, place);
        return;
      }
      // The neuron beneath shows through the dot as it opens, then fills the screen, and its far end opens on the game.
      const width = node!.clientWidth;
      const height = node!.clientHeight;
      const toward = ramp(FLIGHT.covered - 0.02, FLIGHT.through + 0.08, progress);
      const toHole = ramp(FLIGHT.open - 0.14, FLIGHT.open + 0.02, progress);
      let x = lastEntry.x + (width / 2 - lastEntry.x) * toward;
      let y = lastEntry.y + (height / 2 - lastEntry.y) * toward;
      x += (place.holeX - x) * toHole;
      y += (place.holeY - y) * toHole;
      const shot = shoot(film, progress, width, height, x, y);
      const entry = dive.draw(progress, place, { film, shot });
      // Once the dot's inside fills the screen, the camera stops following the dot and settles on the middle.
      if (progress < FLIGHT.covered) lastEntry = { x: Math.min(width, Math.max(0, entry.x)), y: Math.min(height, Math.max(0, entry.y)) };
      if (progress < FLIGHT.pull) {
        beneath.style.display = "none";
        return;
      }
      beneath.style.display = "block";
      neuron.render(film, shot, { x: place.holeX, y: place.holeY, r: holeAt(progress, place, width, height) }, (performance.now() - born) / 1000);
    }
    let lastEntry = { x: 0, y: 0 };

    function settle(to: number) {
      const y = Math.round(to >= 1 ? zoneEnd : zoneStart);
      const from = window.scrollY;
      if (Math.abs(y - from) < 1) return;
      const share = Math.abs(y - from) / Math.max(1, zoneEnd - zoneStart);
      settling = { from, to: y, start: performance.now(), ms: SETTLE_MS * Math.max(0.35, Math.min(1, share)), way: Math.sign(y - from), at: from };
      wake();
    }

    function loop(now: number) {
      frame = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      // Anything else moving the page, such as a link or the Learn moon scrolling to the top, takes over from the settling.
      if (settling && Math.abs(window.scrollY - settling.at) > 2) settling = null;
      if (settling) {
        const t = Math.min(1, (now - settling.start) / settling.ms);
        // Gathering speed into the dot, then easing the page into place as the far end opens.
        settling.at = Math.round(settling.from + (settling.to - settling.from) * hermite(t, 0.8, 0.25));
        // The page scrolls smoothly by default, which would lag each step, and not every browser takes "instant".
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, settling.at);
        root.style.scrollBehavior = "";
        settling.at = window.scrollY;
        lastScrollAt = now;
        if (t >= 1) settling = null;
      }
      const target = scrolled();
      const gap = target - progress;
      const most = dt / QUICKEST;
      progress = Math.abs(gap) < 0.0005 ? target : progress + Math.max(-most, Math.min(most, gap * (1 - Math.exp(-dt / FOLLOW))));
      if (progress !== drawn) {
        drawn = progress;
        try {
          apply();
        } catch {
          stop();
          return;
        }
      }
      const partway = target > 0 && target < 1;
      if (partway && !settling && !touching && now - lastScrollAt > (now - inputAt < 1000 ? QUIET_AFTER_INPUT : QUIET_OTHERWISE)) settle(settleTo(target, direction));
      if (settling || progress !== target || partway) frame = requestAnimationFrame(loop);
      else last = 0;
    }

    function wake() {
      if (!frame) frame = requestAnimationFrame(loop);
    }

    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) direction = Math.sign(y - lastY);
      lastY = y;
      lastScrollAt = performance.now();
      wake();
    };
    const onWheel = (event: WheelEvent) => {
      inputAt = performance.now();
      // A trackpad's momentum keeps coming the same way, so only a turn the other way stops the settling.
      if (settling && event.deltaY && Math.sign(event.deltaY) !== settling.way) settling = null;
      wake();
    };
    const onTouchStart = (event: TouchEvent) => {
      touching = true;
      settling = null;
      const touch = event.touches?.[0];
      if (touch) hint = { x: touch.clientX, y: touch.clientY };
    };
    const onTouchEnd = () => {
      touching = false;
      inputAt = performance.now();
      wake();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(event.key)) return;
      inputAt = performance.now();
      settling = null;
      wake();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") settling = null;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hint = { x: event.clientX, y: event.clientY };
    };
    // Keyboard focus landing on the hidden orb brings it back rather than leaving focus out of sight.
    const onFocus = (event: FocusEvent) => {
      if (progress > 0.02 && pinned && event.target instanceof Node && stage!.contains(event.target)) settle(0);
    };
    const onResize = () => {
      neuron?.resize();
      measure();
      drawn = -1;
      wake();
    };
    const resizer = new ResizeObserver(onResize);

    function stop() {
      cancelAnimationFrame(frame);
      if (idles) window.cancelIdleCallback(tuning);
      window.clearTimeout(tuning);
      frame = 0;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("focusin", onFocus);
      motion.removeEventListener("change", onMotion);
      resizer.disconnect();
      beneath.removeEventListener("webglcontextlost", onLost);
      land();
      delete world!.dataset.flight;
      dive.destroy();
      neuron?.destroy();
    }
    const onMotion = () => { if (motion.matches) stop(); };

    measure();
    progress = scrolled();
    // Straight after this task rather than at the next quiet moment, since a visitor may scroll at once.
    tuning = window.setTimeout(tune, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("focusin", onFocus);
    motion.addEventListener("change", onMotion);
    resizer.observe(stage);
    resizer.observe(section);
    wake();
    return stop;
  }, [graph, exits, orb]);

  return <>
    <canvas ref={deep} className={styles.flightDeep} aria-hidden="true" />
    <canvas ref={canvas} className={styles.flight} aria-hidden="true" />
  </>;
}
