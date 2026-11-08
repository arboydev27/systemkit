"use client";

import { useEffect, useRef, type RefObject } from "react";
import { makeFilm, shoot, type Film } from "@/lib/neuron-film";
import { createNeuronGl, type NeuronGl } from "@/lib/neuron-gl";
import { FLIGHT, hermite, ramp, settleTo } from "@/lib/neuron-route";
import { MILO } from "@/lib/milo-figure";
import { createNeuronScene, holeAt, type FigureCopy, type NeuronPlace } from "@/lib/neuron-scene";
import type { OrbGraph } from "@/lib/orb-layout";
import { linkDegrees } from "@/lib/orb-view";
import styles from "./MiloHome.module.css";

const FOLLOW = 0.05; // Seconds the dive takes to catch up with the page, so a wheel's steps run together.
const QUICKEST = 0.6; // However far the page jumps, the whole dive takes at least this long, and the page waits under it.
const SETTLE_MS = 1000; // A whole dive, when scrolling stops partway and it finishes on its own.
const QUIET_AFTER_INPUT = 140;
const QUIET_OTHERWISE = 480;
const WHEEL_GAP = 200; // A pause this long between wheel events ends a gesture.
const PUSH = 12; // Pixels of wheel or swipe that start the dive, or take it back.
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Tab"]);
const DIVE_KEYS: Record<string, number> = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };

export type NeuronFlightProps = {
  graph: OrbGraph;
  /** The lessons the dive may come out at: the ones about scaling, since the game is about scaling. */
  exits: number[];
  /** The lesson the route starts from: the visitor's next one. */
  start: RefObject<number>;
  finished: boolean[];
};

/** The transform an element has on screen, about its own origin, as a matrix. */
function ownTransform(element: Element) {
  const style = getComputedStyle(element);
  if (!style.transform || style.transform === "none") return new DOMMatrix();
  const [x, y] = style.transformOrigin.split(" ").map(parseFloat);
  return new DOMMatrix().translate(x, y).multiply(new DOMMatrix(style.transform)).translate(-x, -y);
}

/** Milo as the page is showing him right now: his layers where they are on screen, and his eyes as they are. */
function copyOf(figure: HTMLElement, hint: { x: number; y: number } | null): FigureCopy | null {
  const box = figure.getBoundingClientRect();
  const body = figure.querySelector<HTMLImageElement>("img[data-milo-layer='body']");
  const head = figure.querySelector<HTMLImageElement>("img[data-milo-layer='head']");
  const headTurn = figure.querySelector<HTMLElement>("[data-milo-head]");
  const breath = headTurn?.firstElementChild;
  if (!box.width || !body || !head || !headTurn || !breath || !body.complete || !head.complete) return null;
  const at = new DOMMatrix().translate(box.left, box.top);
  const layers = [
    { image: body, width: box.width, height: box.height, matrix: at },
    { image: head, width: box.width, height: box.height, matrix: at.multiply(ownTransform(headTurn)).multiply(ownTransform(breath)) },
  ];
  const eyes = [...figure.querySelectorAll("[data-milo-eye]")].map((eye, index) => {
    const shape = eye.lastElementChild!.getBoundingClientRect();
    return { x: shape.left + shape.width / 2, y: shape.top + shape.height / 2, rx: shape.width / 2, ry: shape.height / 2, open: MILO.eyes[index].ry * box.height };
  });
  if (eyes.length < 2) return null;
  // The eye nearer the pointer, and otherwise the one nearer the middle of the screen, where the dive is going.
  const toward = hint ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const chosen = Math.hypot(eyes[0].x - toward.x, eyes[0].y - toward.y) <= Math.hypot(eyes[1].x - toward.x, eyes[1].y - toward.y) ? 0 : 1;
  const unit = box.width / MILO.width;
  const glowShape = figure.querySelector("[data-milo-eye] ellipse");
  const alpha = glowShape ? parseFloat(getComputedStyle(glowShape).opacity) || 0.55 : 0.55;
  return { layers, eyes, chosen, glow: { reach: 4 * unit, blur: 14 * unit, alpha, color: "#ffffff" } };
}

/**
 * Scrolling from Milo to the game dives in through one of his eyes and along real links from the visitor's next
 * lesson to a lesson about scaling, then opens on the game. The page scrolls as it always does: the dive only follows
 * it, and once scrolling stops partway it finishes the way the visitor was going. Anything a visitor does stops it.
 */
export default function NeuronFlight({ graph, exits, start, finished }: NeuronFlightProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const deep = useRef<HTMLCanvasElement>(null);
  const done = useRef(finished);
  useEffect(() => { done.current = finished; }, [finished]);

  useEffect(() => {
    const node = canvas.current;
    const under = deep.current;
    const world = node?.parentElement;
    const stage = world?.querySelector<HTMLElement>("[data-home-stage]");
    const figure = stage?.querySelector<HTMLElement>("[data-milo]");
    const seat = figure?.parentElement;
    const section = document.getElementById("try");
    if (!node || !under || !world || !stage || !figure || !seat || !section) return;
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
    let retried = false;
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
      if (neuron.calibrate(sample, shoot(sample, 0.45, width, height, width / 2, height / 2))) {
        // A device found too slow may only have been busy, with the page still loading, say, so it gets one more try.
        if (!neuron.capable() && !retried) {
          retried = true;
          neuron.retry();
          tuning = window.setTimeout(tune, 3000);
        }
        return;
      }
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
      const copy = copyOf(figure!, hint);
      if (!copy) return false;
      place.orbSize = figure!.offsetWidth;
      launchScroll = window.scrollY;
      pinned = getComputedStyle(stage!).position === "sticky";
      const entry = dive.launch(place, start.current ?? 0, copy, done.current);
      launchOrbY = entry.y;
      film = neuron?.ready() && neuron.capable() ? makeFilm(dive.route(), graph.titles, degrees) : null;
      // The page around Milo blows outward from his eye as the camera goes for it.
      const stageBox = stage!.getBoundingClientRect();
      stage!.style.transformOrigin = `${(entry.x - stageBox.left).toFixed(1)}px ${(entry.y - stageBox.top).toFixed(1)}px`;
      launched = true;
      return true;
    }

    function release() {
      stage!.style.transform = "";
      stage!.style.transformOrigin = "";
      stage!.style.willChange = "";
      launched = false;
    }

    function land() {
      release();
      node!.style.display = "none";
      beneath.style.display = "none";
      stage!.style.opacity = "";
      stage!.style.pointerEvents = "";
      seat!.style.visibility = "";
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
        // At the game: Milo rests hidden under it, still in the tab order, and focusing the stage flies back.
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
      // His images haven't loaded yet, so there's nothing to copy: the page scrolls with its plain fade instead.
      if (!launched && !launch()) return;
      // The words go past the camera as it goes for the eye. Milo himself goes at once, since the copy on the canvas
      // has taken him over.
      const fall = ramp(0, FLIGHT.pull, progress);
      const covered = progress >= FLIGHT.covered;
      stage!.style.willChange = covered ? "" : "transform, opacity";
      stage!.style.transform = covered ? "" : `scale(${(1 + fall * fall * 0.35).toFixed(4)})`;
      stage!.style.opacity = String(1 - fall);
      stage!.style.pointerEvents = "none";
      seat!.style.visibility = "hidden";
      section!.style.opacity = progress < 0.5 ? "0" : "";
      root.dataset.neuron = progress < FLIGHT.open ? "covering" : "open";
      // Shaders that finish compiling before the eye opens still make this dive.
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
      // The neuron beneath shows through the eye as it opens, then fills the screen, and its far end opens on the game.
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
      // Once the eye's inside fills the screen, the camera stops following the eye and settles on the middle.
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

    /** Whether a gesture going this way from where the page is now is the dive's to take, rather than the page's. */
    function ours(way: number) {
      const y = window.scrollY;
      if (way > 0) return y >= zoneStart - 1 && y < zoneEnd - 1;
      if (way < 0) return y > zoneStart + 1 && y <= zoneEnd + 2;
      return false;
    }

    // A gesture that started where the dive couldn't take it, such as a phone's swipe above Milo's line, scrolls the
    // page natively, and is held at the game until it ends, under the dive, so its momentum can't carry past.
    let held: { last: number; touching: boolean } | null = null;
    function hold() {
      if (!held) return;
      const y = Math.round(zoneEnd);
      if (window.scrollY > y + 1) {
        settling = null;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, y);
        root.style.scrollBehavior = "";
      }
    }

    function loop(now: number) {
      frame = 0;
      // Two calls in one frame would make no time pass.
      const dt = last ? Math.min(0.05, Math.max(0.004, (now - last) / 1000)) : 1 / 60;
      last = now;
      if (held && !held.touching && now - held.last > WHEEL_GAP && now - lastScrollAt > QUIET_AFTER_INPUT) held = null;
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
      hold();
      let target = scrolled();
      // The far end waits to open until a held gesture is over, so the game never shakes under it.
      if (held && target > FLIGHT.open - 0.03) target = FLIGHT.open - 0.03;
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
      if (partway && !settling && !touching && !held && now - lastScrollAt > (now - inputAt < 1000 ? QUIET_AFTER_INPUT : QUIET_OTHERWISE)) settle(settleTo(target, direction));
      if (settling || progress !== target || partway || held) wake();
      else if (!frame) last = 0;
    }

    function wake() {
      if (!frame) frame = requestAnimationFrame(loop);
    }

    // Touches near the dive are listened to closely enough to stop the page scrolling, and only there, so the rest
    // of the page scrolls without waiting on this script.
    let listening = false;
    function listenToTouches() {
      const near = window.scrollY <= zoneEnd + 2;
      if (near === listening) return;
      listening = near;
      if (near) document.addEventListener("touchmove", onTouchMove, { passive: false });
      else document.removeEventListener("touchmove", onTouchMove);
    }

    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) direction = Math.sign(y - lastY);
      lastY = y;
      lastScrollAt = performance.now();
      hold();
      listenToTouches();
      wake();
    };

    // Inside the dive, one gesture plays it all, into the eye and out onto the game, or all the way back, and the
    // rest of that gesture, a trackpad's momentum and all, is held back: only its first event can be, so that's where
    // it's decided. So no flick can carry the page past the game.
    const wheel = { last: -Infinity, way: 0, sum: 0, taken: false, done: false, sizes: [] as number[] };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const now = performance.now();
      inputAt = now;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      const way = Math.sign(delta);
      if (!way) return;
      const size = Math.abs(delta);
      const recent = wheel.sizes.slice(-5);
      const mean = recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length);
      const easing = recent.length >= 4 && recent.every((value, index) => index === 0 || value <= recent[index - 1] + 1);
      const momentum = (event as WheelEvent & { momentum?: boolean }).momentum === true;
      const fresh = !momentum && easing && size > 8 && size > 1.5 * mean;
      if (now - wheel.last >= WHEEL_GAP || way !== wheel.way || fresh) {
        wheel.way = way;
        wheel.sum = 0;
        wheel.sizes = [];
        wheel.done = false;
        wheel.taken = ours(way) && event.cancelable;
        if (!wheel.taken && way > 0 && window.scrollY < zoneEnd - 1) held = { last: now, touching: false };
      }
      wheel.last = now;
      wheel.sizes.push(size);
      if (wheel.sizes.length > 8) wheel.sizes.shift();
      if (held) held.last = now;
      if (wheel.taken) {
        if (event.cancelable) event.preventDefault();
        wheel.sum += size;
        if (!wheel.done && wheel.sum >= PUSH) {
          wheel.done = true;
          settle(way > 0 ? 1 : 0);
        }
      } else if (settling && way !== settling.way) {
        settling = null;
      }
      wake();
    };

    let touch: { x: number; y: number; taken: boolean | null; done: boolean } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      touching = true;
      inputAt = performance.now();
      const point = event.touches?.[0];
      if (point) hint = { x: point.clientX, y: point.clientY };
      touch = event.touches.length === 1 && point ? { x: point.clientX, y: point.clientY, taken: null, done: false } : null;
    };
    function onTouchMove(event: TouchEvent) {
      if (!touch || event.touches.length !== 1) return;
      const point = event.touches[0];
      const dy = touch.y - point.clientY;
      const dx = touch.x - point.clientX;
      if (touch.taken === null) {
        if (Math.abs(dy) < 2 && Math.abs(dx) < 2) return;
        const y = window.scrollY;
        // Inside the dive every move is its own. At either end, only a move into it is.
        const inside = y > zoneStart + 1 && y < zoneEnd - 1;
        touch.taken = event.cancelable && (inside || (Math.abs(dy) >= Math.abs(dx) && ours(Math.sign(dy))));
        if (touch.taken) settling = null;
        else if (dy > 0 && y < zoneEnd - 1) held = { last: performance.now(), touching: true };
      }
      if (!touch.taken) return;
      if (event.cancelable) event.preventDefault();
      if (!touch.done && Math.abs(dy) >= PUSH * 2 && Math.abs(dy) > 1.25 * Math.abs(dx)) {
        touch.done = true;
        settle(dy > 0 ? 1 : 0);
      }
    }
    const onTouchEnd = () => {
      touching = false;
      touch = null;
      if (held) { held.touching = false; held.last = performance.now(); }
      inputAt = performance.now();
      wake();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !SCROLL_KEYS.has(event.key)) return;
      inputAt = performance.now();
      const way = event.key === " " && event.shiftKey ? -1 : DIVE_KEYS[event.key];
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (way && ours(way) && !target?.closest("input, textarea, select, button, [contenteditable], [role='application']")) {
        event.preventDefault();
        if (!event.repeat) settle(way > 0 ? 1 : 0);
        return;
      }
      settling = null;
      wake();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") settling = null;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hint = { x: event.clientX, y: event.clientY };
    };
    // Keyboard focus landing on the hidden stage brings it back rather than leaving focus out of sight.
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
      document.removeEventListener("touchmove", onTouchMove);
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
    window.addEventListener("wheel", onWheel, { passive: false });
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
    listenToTouches();
    wake();
    return stop;
  }, [graph, exits, start]);

  return <>
    <canvas ref={deep} className={styles.flightDeep} aria-hidden="true" />
    <canvas ref={canvas} className={styles.flight} aria-hidden="true" />
  </>;
}
