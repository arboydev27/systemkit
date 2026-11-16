"use client";

import { useEffect, useRef, type RefObject } from "react";
import { makeFilm, shoot, type Film } from "@/lib/neuron-film";
import { createNeuronGl, type NeuronGl } from "@/lib/neuron-gl";
import { FLIGHT, hermite, onFace, ramp, settleTo } from "@/lib/neuron-route";
import { figureOf } from "@/lib/milo-pose";
import { createNeuronScene, holeAt, type FigureCopy, type NeuronPlace } from "@/lib/neuron-scene";
import type { OrbGraph } from "@/lib/orb-layout";
import { linkDegrees } from "@/lib/orb-view";
import styles from "./MiloHome.module.css";

const FOLLOW = 0.05; // Seconds the dive takes to catch up with the page, so a wheel's steps run together.
const QUICKEST = 0.6; // However far the page jumps on its own, a link say, the whole dive takes at least this long.
const FOLLOWING = 0.22; // Following the visitor's own scrolling, it keeps closer to the page than that.
const SETTLE_MS = 1000; // A whole dive, when scrolling stops partway and it finishes on its own.
// How long the page has to be still before a dive stopped partway finishes on its own: long enough that a wheel turned a
// notch at a time, or a finger resting on the glass, isn't taken for stopping.
const QUIET_AFTER_INPUT = 450;
const QUIET_OTHERWISE = 480;
// Stopped partway, the dive goes on the way the visitor was going once they're this far into it, and otherwise goes back,
// so a nudge past Milo's line springs back rather than plays the whole dive.
const NEAR = 0.3;
const SCROLL_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Tab"]);
// The dive plays with the scroll once, on a visitor's first visit, and is remembered here once it has reached the game.
const SEEN = "systemkit:dive-seen:v1";

function seenBefore() {
  try { return window.localStorage.getItem(SEEN) === "1"; } catch { return false; }
}

function markSeen() {
  try { window.localStorage.setItem(SEEN, "1"); } catch { /* A browser that won't keep it just plays it again. */ }
}

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

/** Where an element inside Milo's figure is drawn, from the figure's corner: under each wrapper's transform on the way down. */
function placeIn(figure: HTMLElement, element: HTMLElement) {
  const chain: Element[] = [];
  for (let node = element.parentElement; node && node !== figure; node = node.parentElement) chain.unshift(node);
  let matrix = new DOMMatrix();
  for (const node of chain) matrix = matrix.multiply(ownTransform(node));
  return matrix.translate(element.offsetLeft, element.offsetTop);
}

/** One of Milo's layers as it shows now: the turn frames' canvas while he's turned (copied, since it goes on moving), else its image. */
function layerOf(figure: HTMLElement, at: DOMMatrix, name: "body" | "head") {
  const turned = figure.dataset[name === "head" ? "turnHead" : "turnBody"] !== undefined;
  const canvas = figure.querySelector<HTMLCanvasElement>(`canvas[data-milo-turns='${name}']`);
  if (turned && canvas && canvas.width > 0) {
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d")?.drawImage(canvas, 0, 0);
    return { image: copy, width: canvas.offsetWidth, height: canvas.offsetHeight, matrix: at.multiply(placeIn(figure, canvas)) };
  }
  const image = figure.querySelector<HTMLImageElement>(`img[data-milo-layer='${name}']`);
  if (!image || !image.complete) return null;
  return { image, width: image.offsetWidth, height: image.offsetHeight, matrix: at.multiply(placeIn(figure, image)) };
}

/** Milo as the page is showing him right now: his layers where they are on screen, and his eyes as they are. */
function copyOf(figure: HTMLElement, hint: { x: number; y: number } | null): FigureCopy | null {
  const box = figure.getBoundingClientRect();
  if (!box.width) return null;
  const at = new DOMMatrix().translate(box.left, box.top);
  let layers: FigureCopy["layers"];
  const model = figure.dataset.milo3d !== undefined ? figure.querySelector<HTMLCanvasElement>("canvas[data-milo-model]") : null;
  const shadow = figure.querySelector<HTMLImageElement>("img[data-milo-shadow]");
  if (model && model.width > 0) {
    // Milo in 3D: his contact shadow, then the model as it's drawn now (copied, since it goes on moving).
    const copy = document.createElement("canvas");
    copy.width = model.width;
    copy.height = model.height;
    copy.getContext("2d")?.drawImage(model, 0, 0);
    layers = [{ image: copy, width: model.offsetWidth, height: model.offsetHeight, matrix: at.multiply(placeIn(figure, model)) }];
    if (shadow?.complete && shadow.naturalWidth) layers.unshift({ image: shadow, width: shadow.offsetWidth, height: shadow.offsetHeight, matrix: at.multiply(placeIn(figure, shadow)) });
  } else {
    const body = layerOf(figure, at, "body");
    const head = layerOf(figure, at, "head");
    if (!body || !head) return null;
    layers = [body, head];
  }
  // His eyes sit on his screen as the head's frames have it turned (the screen's map), and the head rolls a little.
  const screen = figure.querySelector("[data-milo-screen]")?.getAttribute("transform")?.match(/matrix\(([^)]+)\)/);
  const map = screen ? screen[1].trim().split(/[\s,]+/).map(Number) : [1, 0, 0, 1, 0, 0];
  const headTurn = figure.querySelector<HTMLElement>("[data-milo-head]");
  const roll = headTurn ? ownTransform(headTurn) : new DOMMatrix();
  const spin = Math.atan2(roll.b, roll.a);
  const linear = new DOMMatrix([Math.cos(spin), Math.sin(spin), -Math.sin(spin), Math.cos(spin), 0, 0]).multiply(new DOMMatrix([map[0], map[1], map[2], map[3], 0, 0]));
  const turn = [linear.a, linear.b, linear.c, linear.d];
  // His geometry in the pose the page shows him in: sitting on the ledge, or hanging on the rod.
  const MILO = figureOf(figure.dataset.miloPose);
  const unit = box.width / MILO.width;
  const eyes = [...figure.querySelectorAll<SVGGElement>("[data-milo-eye]")].map((eye, index) => {
    const shape = eye.lastElementChild!.getBoundingClientRect();
    // How far a blink or a smile has closed it, from the eye's own transform.
    const style = getComputedStyle(eye).transform;
    const squeeze = style && style !== "none" ? new DOMMatrix(style).d : 1;
    const open = MILO.eyes[index].ry * MILO.height * unit;
    return { x: shape.left + shape.width / 2, y: shape.top + shape.height / 2, rx: MILO.eyes[index].rx * MILO.width * unit, ry: open * squeeze, open, turn };
  });
  if (eyes.length < 2) return null;
  // The eye nearer the pointer, and otherwise the one nearer the middle of the screen, where the dive is going.
  const toward = hint ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const chosen = Math.hypot(eyes[0].x - toward.x, eyes[0].y - toward.y) <= Math.hypot(eyes[1].x - toward.x, eyes[1].y - toward.y) ? 0 : 1;
  const glowShape = figure.querySelector("[data-milo-eye] ellipse");
  const alpha = glowShape ? parseFloat(getComputedStyle(glowShape).opacity) || 0.55 : 0.55;
  return { layers, eyes, chosen, glow: { reach: 4 * unit, blur: 14 * unit, alpha, color: "#ffffff" } };
}

/**
 * Scrolling from Milo to the game dives in through one of his eyes and along real links from the visitor's next
 * lesson to a lesson about scaling, then opens on the game. The page scrolls as it always does: the dive only follows
 * it, and once scrolling stops partway it finishes the way the visitor was going. Anything a visitor does stops it.
 * It plays with the scroll once, on a first visit, until it reaches the game; after that the page scrolls past Milo as
 * it would without it, and a tap on his face plays it.
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
    // The page has Milo sitting on the ledge and hanging on the rod, and shows whichever suits the screen: the dive
    // copies the one showing when it starts.
    const shown = () => [...(stage?.querySelectorAll<HTMLElement>("[data-milo]") ?? [])].find((one) => one.offsetWidth > 0) ?? null;
    let figure = shown();
    let seat = figure?.parentElement ?? null;
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
    // Following the scroll, until the dive has once reached the game; until then the stage's own fade stands aside.
    let live = !seenBefore();
    if (live) world.dataset.flight = "";

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
    let settling: { from: number; to: number; start: number; ms: number; at: number } | null = null;
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
      const now = shown();
      if (!now?.parentElement) return false;
      if (now !== figure) seat!.style.visibility = "";
      figure = now;
      seat = now.parentElement;
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
      played = true;
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
      settling = { from, to: y, start: performance.now(), ms: SETTLE_MS * Math.max(0.35, Math.min(1, share)), at: from };
      wake();
    }

    // Once the dive has reached the game it puts itself away, remembered, and the page scrolls past Milo as it would
    // without it: the stage fades as he's scrolled past, and a tap on his face is the way back in.
    let played = false;
    function sleep() {
      live = false;
      // Only a dive the visitor saw counts: a page opened already past the game hasn't shown them one.
      if (played) markSeen();
      settling = null;
      progress = 0;
      drawn = 0;
      land();
      delete world!.dataset.flight;
    }

    function loop(now: number) {
      frame = 0;
      // Two calls in one frame would make no time pass.
      const dt = last ? Math.min(0.05, Math.max(0.004, (now - last) / 1000)) : 1 / 60;
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
      const target = live ? scrolled() : 0;
      const gap = target - progress;
      const most = dt / (touching || now - inputAt < 1000 ? FOLLOWING : QUICKEST);
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
      if (live && progress >= 1 && !settling) {
        sleep();
        return;
      }
      const partway = target > 0 && target < 1;
      if (partway && !settling && !touching && now - lastScrollAt > (now - inputAt < 1000 ? QUIET_AFTER_INPUT : QUIET_OTHERWISE)) settle(settleTo(target, direction, NEAR));
      if (settling || progress !== target || partway) wake();
      else if (!frame) last = 0;
    }

    function wake() {
      if (!frame) frame = requestAnimationFrame(loop);
    }

    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) direction = Math.sign(y - lastY);
      lastY = y;
      lastScrollAt = performance.now();
      if (live) wake();
    };

    // The dive takes no gesture: a wheel, a swipe or a key scrolls the page as it would anywhere, and the dive only follows
    // it, so a slow drag plays it slowly and a flick goes straight through. Whatever the visitor does takes over from a
    // dive finishing on its own.
    // A gesture on something open over the page, like the sections' wheel, is that thing's, not the page's.
    const overPage = (event: Event) => event.target instanceof Element && event.target.closest("dialog[open]") !== null;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || overPage(event)) return;
      inputAt = performance.now();
      settling = null;
      wake();
    };
    const onTouchStart = (event: TouchEvent) => {
      if (overPage(event)) return;
      touching = true;
      inputAt = performance.now();
      settling = null;
      const point = event.touches?.[0];
      if (point) hint = { x: point.clientX, y: point.clientY };
    };
    const onTouchEnd = () => {
      touching = false;
      inputAt = performance.now();
      wake();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !SCROLL_KEYS.has(event.key) || overPage(event)) return;
      inputAt = performance.now();
      settling = null;
      wake();
    };
    // A tap or click on Milo's face, while he's on screen and nothing else is under it, plays the dive down to the game.
    const faceAt = (x: number, y: number) => {
      const now = shown();
      return !!now && onFace(x, y, now.getBoundingClientRect(), figureOf(now.dataset.miloPose).display);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || progress > 0 || settling || window.scrollY > zoneEnd - 2) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("a, button, input, select, textarea, label, dialog, [role='application']")) return;
      if (!faceAt(event.clientX, event.clientY)) return;
      hint = { x: event.clientX, y: event.clientY };
      if (!live) {
        live = true;
        world!.dataset.flight = "";
      }
      settle(1);
    };
    let pointing = false;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") settling = null;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      hint = { x: event.clientX, y: event.clientY };
      // His face takes a click: the pointer says so over it.
      const over = progress === 0 && faceAt(event.clientX, event.clientY);
      if (over === pointing) return;
      pointing = over;
      stage!.style.cursor = over ? "pointer" : "";
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
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("click", onClick);
      stage!.style.cursor = "";
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
    progress = live ? scrolled() : 0;
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
    window.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);
    document.addEventListener("focusin", onFocus);
    motion.addEventListener("change", onMotion);
    resizer.observe(stage);
    resizer.observe(section);
    wake();
    return stop;
  }, [graph, exits, start]);

  return <>
    <canvas ref={deep} className={styles.flightDeep} aria-hidden="true" />
    <canvas ref={canvas} className={styles.flight} aria-hidden="true" />
  </>;
}
