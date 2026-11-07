"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { lessonHref } from "@/lib/links";
import { makeFilm, shoot, type Film } from "@/lib/neuron-film";
import { createNeuronGl, type NeuronGl } from "@/lib/neuron-gl";
import { FLIGHT, flightAt, gateFor, hopSeconds, ramp, settleStop, stopsFor } from "@/lib/neuron-route";
import { createNeuronScene, holeAt, type NeuronPlace } from "@/lib/neuron-scene";
import { noteFor, type OrbNotes } from "@/lib/orb-notes";
import type { OrbGraph } from "@/lib/orb-layout";
import type { OrbScene } from "@/lib/orb-scene";
import { chapterOfLesson, FIT, linkDegrees, ORB_RADIUS } from "@/lib/orb-view";
import styles from "./OrbHome.module.css";

const FOLLOW = 0.06; // Seconds the camera takes to catch up with the page at the end of a hop, so it settles rather than stops.
const BACK = 0.55; // Going back up, each hop takes this share of the time it took going down.
const JUMP = 1.4; // Seconds for the whole dive when the page jumps, from a link, Home or End, or the skip button.
const SETTLE_MS = 520; // The page's own move to a stop, under the pinned stage, which the camera follows at its own pace.
const NUDGE = 28; // Pixels of scroll that commit to the next stop when the page was scrolled some other way.
const WHEEL_PUSH = 50; // Pixels of wheel that make a hop.
const WHEEL_GAP = 200; // A pause this long between wheel events ends a gesture.
const QUIET = 140; // And the page has to have stopped moving for this long.
const QUIET_OTHERWISE = 480;
const SCROLL_KEYS: Record<string, number> = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };

export type NeuronFlightProps = {
  graph: OrbGraph;
  /** The lessons the dive may come out at: the ones about scaling, since the game is about scaling. */
  exits: number[];
  orb: RefObject<OrbScene | null>;
  finished: boolean[];
  /** Each chapter's id, title and lesson ids, for the captions and their links. */
  chapters: { id: string; title: string; stepIds: string[] }[];
};

type Caption = { lesson: number; from: number | null };
/** A gesture that started where the dive couldn't take it, so the page scrolls natively and is held at the next stop. */
type Gesture = { kind: "wheel" | "touch"; direction: number; from: number; startY: number; last: number; touching: boolean };
type Wheel = { last: number; way: number; sum: number; taken: boolean; hopped: number; sizes: number[] };
type Touch = { x: number; y: number; taken: boolean | null; hopped: boolean };

/**
 * Scrolling from the orb to the game dives through one of its dots and along real links to a lesson about scaling,
 * then opens on the game. It stops on the way: inside the cell it dived into, and at a node for each lesson it
 * passes, each with a caption saying what the lesson is and why it follows. The page scrolls as it always does: one
 * gesture moves it at most one stop, the camera follows at its own pace, and anything a visitor does takes over.
 */
export default function NeuronFlight({ graph, exits, orb, finished, chapters }: NeuronFlightProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const deep = useRef<HTMLCanvasElement>(null);
  const captionBox = useRef<HTMLDivElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const done = useRef(finished);
  useEffect(() => { done.current = finished; }, [finished]);

  useEffect(() => {
    const node = canvas.current;
    const under = deep.current;
    const box = captionBox.current;
    const skip = skipButton.current;
    const world = node?.parentElement;
    const stage = world?.querySelector<HTMLElement>("[data-home-stage]");
    const wrap = stage?.querySelector<HTMLElement>("[data-home-orb]");
    const plate = wrap?.querySelector<HTMLElement>("[role='application']");
    const lens = stage?.querySelector<HTMLElement>("[data-home-orb] a");
    const section = document.getElementById("try");
    if (!node || !under || !box || !skip || !world || !stage || !wrap || !plate || !section) return;
    const beneath: HTMLCanvasElement = under;
    const caption: HTMLDivElement = box;
    const skipper: HTMLButtonElement = skip;
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
      if (neuron.calibrate(sample, shoot(sample, 0.55, width, height, width / 2, height / 2))) {
        // A device found too slow may only have been busy, with the orb still growing, say, so it gets one more try.
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

    // What the captions say comes in a small file of its own. Until it's here, or if it never comes, they give names only.
    let notes: OrbNotes | null = null;
    const controller = new AbortController();
    fetch("/orb-notes.json", { signal: controller.signal }).then((response) => (response.ok ? response.json() : null)).then((value) => { notes = value; }).catch(() => {});

    // The page makes room for the dive below the orb, which stays pinned while the dive plays over it, in a task of its
    // own after this one, since it lays the whole page out again. A page already scrolled to the game when the room
    // appears is kept where it was, and a link to the game that may still be scrolling the page there, toward where
    // the game was before the room appeared, is held on the game until the visitor does something.
    let ready = false;
    let linked = -Infinity;
    function makeRoom() {
      small = smallHeight();
      const before = section!.getBoundingClientRect().top;
      world!.dataset.flight = "";
      stageHeight = stage!.offsetHeight;
      world!.style.setProperty("--stage-height", `${stageHeight}px`);
      const after = section!.getBoundingClientRect().top;
      linked = window.location.hash === "#try" ? performance.now() : -Infinity;
      root.style.scrollBehavior = "auto";
      if (linked > 0) window.scrollTo(0, after + window.scrollY);
      else if (before < window.innerHeight && Math.abs(after - before) > 1) window.scrollBy(0, after - before);
      root.style.scrollBehavior = "";
      measure();
      share = Math.min(1, Math.max(0, scrolledPlace() / hops()));
      flight = share >= 1 ? 1 : 0;
      ready = true;
      listenToTouches();
      wake();
    }

    const place: NeuronPlace = { orbX: 0, orbY: 0, orbSize: 0, holeX: 0, holeY: 0 };
    let zoneStart = 0;
    let zoneEnd = 1;
    let stops = stopsFor(1);
    let share = 0;
    let flight = 0;
    let drawn = -1;
    let pace = 0;
    let direction = 0;
    let lastY = window.scrollY;
    let lastScrollAt = 0;
    let inputAt = -Infinity;
    let gesture: Gesture | null = null;
    let jumping = false;
    let settling: { from: number; to: number; stop: number; start: number; ms: number; at: number } | null = null;
    let frame = 0;
    let last = 0;
    let launched = false;
    let arrived = false;
    let pinned = false;
    let launchScroll = 0;
    let launchOrbY = 0;
    let hint: { x: number; y: number } | null = null;
    let captions: Caption[] = [];
    let shown = -1;
    let lastEntry = { x: 0, y: 0 };
    let lastRender = 0;
    let drawnFlight = -1;

    const smallHeight = () => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;top:0;left:0;width:1px;height:100svh;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      const height = probe.offsetHeight || window.innerHeight;
      probe.remove();
      return height;
    };

    let small = 0;
    let stageHeight = 0;
    function measure() {
      if (!small) small = smallHeight();
      if (stage!.offsetHeight !== stageHeight) {
        stageHeight = stage!.offsetHeight;
        world!.style.setProperty("--stage-height", `${stageHeight}px`);
      }
      const top = section!.getBoundingClientRect().top + window.scrollY;
      // The stage is the first thing in its world, and pinned, so where it sits now isn't where it belongs.
      const stageBottom = world!.getBoundingClientRect().top + window.scrollY + stage!.offsetHeight;
      zoneEnd = top;
      // The stage pins once its foot reaches the bottom of the screen, measured without the address bar, so the
      // stops don't move as a phone's address bar comes and goes.
      zoneStart = Math.max(0, Math.min(top - 1, stageBottom - small));
      dive.resize();
    }

    const hops = () => stops.length - 1;
    const stopY = (stop: number) => zoneStart + ((zoneEnd - zoneStart) * stop) / hops();
    /** How far the page has scrolled through the dive, in stops. A pixel short of either end is the end. */
    const scrolledPlace = () => {
      const y = window.scrollY;
      if (y >= zoneEnd - 1) return hops() + Math.min(1, Math.max(0, y - zoneEnd) / Math.max(1, window.innerHeight));
      if (y <= zoneStart + 1) return Math.max(-1, Math.min(0, y - zoneStart) / Math.max(1, window.innerHeight));
      return ((y - zoneStart) / (zoneEnd - zoneStart)) * hops();
    };

    function launch() {
      const rect = plate!.getBoundingClientRect();
      place.orbSize = plate!.offsetWidth;
      place.orbX = rect.left + rect.width / 2;
      place.orbY = rect.top + rect.height / 2;
      launchOrbY = place.orbY;
      launchScroll = window.scrollY;
      pinned = getComputedStyle(stage!).position === "sticky";
      const reach = place.orbSize * ORB_RADIUS * FIT;
      const pointer = hint && Math.hypot(hint.x - place.orbX, hint.y - place.orbY) < reach * 1.1 ? { x: (hint.x - place.orbX) / reach, y: (hint.y - place.orbY) / reach } : null;
      const lensReach = lens ? (lens.offsetWidth / 2 / reach) * 1.2 : 0;
      orb.current?.setFrozen(true);
      const entry = dive.launch(orb.current?.view() ?? { yaw: 0, pitch: 0 }, place, done.current, pointer, lensReach, orb.current?.stains() ?? null);
      const route = dive.route();
      film = neuron?.ready() && neuron.capable() ? makeFilm(route, graph.titles, degrees) : null;
      restop(film?.stops ?? stopsFor(route.length - 2));
      // A caption for the cell, one for each lesson with a stop, then the lesson on scaling as the far end comes up.
      const passed = route.slice(1, -1).slice(0, stops.length - 3);
      captions = [{ lesson: route[0], from: null }, ...passed.map((lesson, index) => ({ lesson, from: route[index] })), { lesson: route[route.length - 1], from: route[route.length - 2] ?? null }];
      shown = -1;
      makeDots();
      // The page in front of the orb blows outward from the dot as the camera goes for it.
      const stageBox = stage!.getBoundingClientRect();
      stage!.style.transformOrigin = `${(place.orbX + entry.x - stageBox.left).toFixed(1)}px ${(place.orbY + entry.y - stageBox.top).toFixed(1)}px`;
      launched = true;
    }

    function unstage() {
      stage!.style.transform = "";
      stage!.style.transformOrigin = "";
      stage!.style.willChange = "";
    }

    /**
     * The route, and so how many stops there are, is only known once the dive begins. Whatever stop the page was on
     * its way to keeps its place: counted from the orb going down, and from the game coming back up.
     */
    function restop(next: number[]) {
      const before = stops.length - 1;
      const after = next.length - 1;
      const back = flight >= 0.5;
      stops = next;
      if (before === after) return;
      share = back ? 1 - ((1 - share) * before) / after : (share * before) / after;
      if (settling) {
        settling.stop = Math.max(0, Math.min(after, back ? after - (before - settling.stop) : settling.stop));
        settling.to = Math.round(stopY(settling.stop));
      }
    }

    function release() {
      unstage();
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
      stops = stopsFor(1);
      film = null;
      hideCaption();
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
        const rect = target.getBoundingClientRect();
        place.holeX = rect.left + rect.width / 2;
        place.holeY = rect.top + rect.height / 2;
      } else {
        const slot = section!.querySelector<HTMLElement>("[data-scale-slot]") ?? section!;
        const rect = slot.getBoundingClientRect();
        place.holeX = rect.left + rect.width * 0.12;
        place.holeY = rect.top + Math.min(rect.height * 0.45, 320);
      }
      place.holeX = Math.min(width - 24, Math.max(24, place.holeX));
      place.holeY = Math.min(height - 24, Math.max(24, place.holeY));
    }

    // The captions: one box, filled for whichever stop the camera is at.
    const where = caption.querySelector<HTMLElement>("[data-where]")!;
    const title = caption.querySelector<HTMLElement>("[data-title]")!;
    const text = caption.querySelector<HTMLElement>("[data-text]")!;
    const link = caption.querySelector<HTMLAnchorElement>("[data-link]")!;
    const dots = caption.querySelector<HTMLElement>("[data-dots]")!;

    function makeDots() {
      dots.replaceChildren(...captions.map(() => document.createElement("i")));
    }

    function fillCaption(index: number) {
      const { lesson, from } = captions[index];
      const chapter = chapters[chapterOfLesson(graph, lesson)];
      const step = chapter ? chapter.stepIds[lesson - graph.chapterStarts[chapterOfLesson(graph, lesson)]] : undefined;
      where.textContent = chapter?.title ?? "";
      title.textContent = graph.titles[lesson];
      text.textContent = noteFor(notes, from, lesson);
      text.hidden = !text.textContent;
      if (chapter && step) {
        link.href = lessonHref(chapter.id, step);
        link.hidden = false;
      } else {
        link.hidden = true;
      }
      dots.querySelectorAll("i").forEach((dot, at) => dot.toggleAttribute("data-on", at === index));
    }

    function hideCaption() {
      caption.style.opacity = "0";
      caption.style.visibility = "hidden";
      skipper.style.opacity = "0";
      skipper.style.visibility = "hidden";
      shown = -1;
    }

    /** Each stop's caption shows while the camera rests there, and the last lesson's as the far end comes up. */
    function showCaptions(placeNow: number) {
      const last = hops();
      let best = -1;
      let seen = 0;
      for (let index = 0; index < captions.length; index++) {
        let value: number;
        if (index < captions.length - 1) {
          // In as the camera brakes into the stop, so the words never move with a fast camera; out as soon as it leaves.
          const off = placeNow - (index + 1);
          value = off < 0 ? 1 - ramp(0.05, 0.2, -off) : 1 - ramp(0.04, 0.14, off);
        } else {
          const t = placeNow - (last - 1);
          value = ramp(0.1, 0.28, t) * (1 - ramp(0.5, 0.64, t));
        }
        if (value > seen) { seen = value; best = index; }
      }
      if (best < 0 || seen < 0.01) {
        caption.style.opacity = "0";
        caption.style.visibility = "hidden";
      } else {
        if (best !== shown) {
          shown = best;
          fillCaption(best);
        }
        caption.style.visibility = "visible";
        caption.style.opacity = seen.toFixed(3);
        caption.style.transform = `translateY(${((1 - seen) * 10).toFixed(1)}px)`;
      }
      // The way out is there for the whole dive, until the far end opens.
      const offer = ramp(FLIGHT.pull, FLIGHT.covered, flight) * (1 - ramp(FLIGHT.release, FLIGHT.open, flight));
      skipper.style.visibility = offer > 0.01 ? "visible" : "hidden";
      skipper.style.opacity = offer.toFixed(3);
    }

    function apply(now: number) {
      if (flight <= 0) {
        if (launched || root.dataset.neuron || node!.style.display === "block" || stage!.style.opacity) land();
        return;
      }
      if (flight >= 1) {
        // At the game: the orb rests hidden under it, still in the tab order, and focusing it flies back. The route
        // is kept, so going back up retraces it, stop for stop.
        unstage();
        node!.style.display = "none";
        beneath.style.display = "none";
        stage!.style.opacity = "0";
        stage!.style.pointerEvents = "none";
        section!.style.opacity = "";
        delete root.dataset.neuron;
        hideCaption();
        arrive();
        return;
      }
      if (!launched) launch();
      // The words go past the camera as it goes for the dot. The orb's own glass goes at once, since the copy on the
      // canvas has taken over the dots and is about to draw back from them.
      const progress = flight;
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
      if (!film && progress < FLIGHT.pull && neuron?.ready() && neuron.capable()) {
        film = makeFilm(dive.route(), graph.titles, degrees);
        restop(film.stops);
      }
      if (progress >= FLIGHT.open - 0.02) arrive();
      else if (progress < 0.5) arrived = false;
      if (!pinned) place.orbY = launchOrbY - (window.scrollY - launchScroll);
      if (progress > FLIGHT.open - 0.2) trackHole();
      node!.style.display = "block";
      showCaptions(share * hops());
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
      const time = (now - born) / 1000;
      const shot = shoot(film, progress, width, height, x, y, time, pace);
      const entry = dive.draw(progress, place, { film, shot });
      // Once the dot's inside fills the screen, the camera stops following the dot and settles on the middle.
      if (progress < FLIGHT.covered) lastEntry = { x: Math.min(width, Math.max(0, entry.x)), y: Math.min(height, Math.max(0, entry.y)) };
      if (progress < FLIGHT.pull) {
        beneath.style.display = "none";
        return;
      }
      beneath.style.display = "block";
      neuron.render(film, shot, { x: place.holeX, y: place.holeY, r: holeAt(progress, place, width, height) }, time, flight !== drawnFlight);
      drawnFlight = flight;
      lastRender = now;
    }

    /** Moves the page to a stop, by itself. It's pinned under the dive, so this only keeps the scroll bar honest. */
    function settle(stop: number, jump = false) {
      const to = Math.max(0, Math.min(hops(), stop));
      const y = Math.round(stopY(to));
      const from = window.scrollY;
      if (jump) jumping = true;
      if (Math.abs(y - from) < 1) return;
      const span = Math.abs(y - from) / Math.max(1, stopY(1) - stopY(0));
      settling = { from, to: y, stop: to, start: performance.now(), ms: SETTLE_MS * Math.max(0.4, Math.min(2, span)), at: from };
      wake();
    }

    function scrollTo(y: number) {
      // The page scrolls smoothly by default, which would lag each step, and not every browser takes "instant".
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, y);
      root.style.scrollBehavior = "";
    }

    /** Whether a gesture going this way from where the page is now is the dive's to take, rather than the page's. */
    function ours(way: number) {
      const y = window.scrollY;
      if (way > 0) return y >= zoneStart - 1 && y < zoneEnd - 1;
      if (way < 0) return y > zoneStart + 1 && y <= zoneEnd + 2;
      return false;
    }

    /** One stop on, or back. A gesture during a hop adds one more, and no further, and the camera hurries to catch up. */
    function hop(way: number) {
      const at = settling ? settling.stop : Math.min(hops(), Math.max(0, scrolledPlace()));
      const from = settling ? settling.stop : way > 0 ? Math.floor(at + 1e-3) : Math.ceil(at - 1e-3);
      const next = Math.max(0, Math.min(hops(), from + way));
      if (next === from || Math.abs(next - share * hops()) > 1.6) return;
      gesture = null;
      settle(next);
    }

    /** One gesture the dive couldn't take carries the page to the next stop at most, and holds it there until it ends. */
    function gateNow() {
      if (!gesture || !gesture.direction) return null;
      return gateFor(gesture.from, gesture.direction, hops());
    }

    function hold() {
      const gate = gateNow();
      if (gate === null || !gesture) return;
      const y = Math.round(stopY(gate));
      if ((gesture.direction > 0 && window.scrollY > y + 1) || (gesture.direction < 0 && window.scrollY < y - 1)) {
        settling = null;
        scrollTo(y);
      }
    }

    function gestureOver(now: number) {
      if (!gesture) return true;
      if (gesture.touching) return false;
      if (gesture.kind === "wheel" && now - gesture.last < WHEEL_GAP) return false;
      return now - lastScrollAt > QUIET;
    }

    function startGesture(kind: Gesture["kind"], way: number, now: number) {
      gesture = { kind, direction: way, from: scrolledPlace(), startY: window.scrollY, last: now, touching: kind === "touch" };
    }

    function loop(now: number) {
      frame = 0;
      if (!ready) return;
      // Two calls in one frame would make no time pass, and a pace divided by nothing.
      const dt = last ? Math.min(0.05, Math.max(0.004, (now - last) / 1000)) : 1 / 60;
      last = now;
      if (gesture && gestureOver(now)) gesture = null;
      // Anything else moving the page, such as a link or the Learn moon scrolling to the top, takes over from the settling.
      if (settling && Math.abs(window.scrollY - settling.at) > 2) settling = null;
      if (settling) {
        const t = Math.min(1, (now - settling.start) / settling.ms);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
        scrollTo(Math.round(settling.from + (settling.to - settling.from) * eased));
        settling.at = window.scrollY;
        lastScrollAt = now;
        if (t >= 1) settling = null;
      }
      hold();
      if (inputAt < 0 && now - linked < 1500 && !settling && Math.abs(window.scrollY - zoneEnd) > 1) scrollTo(Math.round(zoneEnd));

      const last2 = hops();
      let target = Math.min(last2, Math.max(0, scrolledPlace()));
      const gate = gateNow();
      if (gate !== null && gesture) target = gesture.direction > 0 ? Math.min(target, gate) : Math.max(target, gate);
      // The far end waits to open until the gesture that brought the camera there is over, so the game never shakes.
      if (gesture && gesture.direction > 0 && gesture.from < last2 - 1e-3 && target > last2 - 1) target = Math.min(target, last2 - 1 + 0.6);
      const place = share * last2;
      const gap = target - place;
      if (Math.abs(gap) > 1.05) jumping = true;
      const hop = Math.max(0, Math.min(last2 - 1, gap >= 0 ? Math.floor(place + 1e-6) : Math.ceil(place - 1e-6) - 1));
      const seconds = jumping ? JUMP / last2 : hopSeconds(stops, hop) * (gap < 0 ? BACK : 1);
      const most = dt / seconds;
      const next = Math.abs(gap) < 0.0008 ? target : place + Math.max(-most, Math.min(most, gap * (1 - Math.exp(-dt / FOLLOW))));
      if (next === target) jumping = false;
      share = next / last2;
      const before = flight;
      flight = share <= 0 ? 0 : share >= 1 ? 1 : flightAt(stops, share);
      pace += ((flight - before) / dt - pace) * (1 - Math.exp(-dt / 0.12));
      if (!Number.isFinite(pace)) pace = 0;
      // While the camera rests inside, the cell goes on living, so frames keep coming, at half the rate.
      const living = film !== null && flight > FLIGHT.pull && flight < 1 && now - lastRender > 30;
      if (flight !== drawn || living) {
        drawn = flight;
        try {
          apply(now);
        } catch {
          stop();
          return;
        }
      }
      const at = scrolledPlace();
      const between = at > 1e-3 && at < last2 - 1e-3 && Math.abs(at - Math.round(at)) > 1e-3;
      const quiet = now - lastScrollAt > (now - inputAt < 1000 ? QUIET : QUIET_OTHERWISE);
      if (between && !settling && !gesture && quiet) settle(settleStop(at, direction, NUDGE / Math.max(1, stopY(1) - stopY(0))));
      if (settling || gesture || Math.abs(share * last2 - target) > 1e-6 || between || (flight > 0 && flight < 1) || now - linked < 1500) wake();
      else if (!frame) last = 0;
    }

    function wake() {
      if (!frame) frame = requestAnimationFrame(loop);
    }

    // Touches near the dive are listened to closely enough to stop the page from scrolling, and only there, so the
    // rest of the page scrolls without waiting on this script.
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
      if (gesture && !gesture.direction && Math.abs(y - gesture.startY) > 6) gesture.direction = Math.sign(y - gesture.startY);
      lastY = y;
      lastScrollAt = performance.now();
      if (!ready) return;
      hold();
      listenToTouches();
      wake();
    };

    const wheel: Wheel = { last: -Infinity, way: 0, sum: 0, taken: false, hopped: -Infinity, sizes: [] };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || !ready) return;
      const now = performance.now();
      inputAt = now;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      const way = Math.sign(delta);
      if (!way) return;
      const size = Math.abs(delta);
      // A pause, a turn the other way, or a fresh push in the middle of a trackpad's momentum starts a new gesture. A
      // browser that says the event is momentum is believed.
      const recent = wheel.sizes.slice(-5);
      const mean = recent.reduce((sum, value) => sum + value, 0) / Math.max(1, recent.length);
      const easing = recent.length >= 4 && recent.every((value, index) => index === 0 || value <= recent[index - 1] + 1);
      const momentum = (event as WheelEvent & { momentum?: boolean }).momentum === true;
      const fresh = !momentum && easing && size > 8 && size > 1.5 * mean && now - wheel.hopped > 300;
      if (now - wheel.last >= WHEEL_GAP || way !== wheel.way || fresh) {
        wheel.way = way;
        wheel.sum = 0;
        wheel.sizes = [];
        wheel.hopped = -Infinity;
        // Only a gesture's first event can be held back, so this is where the dive decides whether it's its own.
        wheel.taken = ours(way) && event.cancelable;
        if (!wheel.taken) {
          startGesture("wheel", way, now);
          if (settling && Math.sign(settling.to - settling.from) !== way) settling = null;
        }
      }
      wheel.last = now;
      wheel.sizes.push(size);
      if (wheel.sizes.length > 8) wheel.sizes.shift();
      if (wheel.taken) {
        // The whole gesture is the dive's, momentum and all, even once it has reached the game.
        if (event.cancelable) event.preventDefault();
        wheel.sum += size;
        if (wheel.hopped < 0 && wheel.sum >= WHEEL_PUSH) {
          wheel.hopped = now;
          hop(way);
        }
      } else if (gesture) {
        gesture.last = now;
      }
      wake();
    };

    let touch: Touch | null = null;
    const onTouchStart = (event: TouchEvent) => {
      settling = null;
      inputAt = performance.now();
      const point = event.touches?.[0];
      touch = event.touches.length === 1 && point ? { x: point.clientX, y: point.clientY, taken: null, hopped: false } : null;
      startGesture("touch", 0, performance.now());
      if (point) hint = { x: point.clientX, y: point.clientY };
    };
    function onTouchMove(event: TouchEvent) {
      if (!ready || !touch || event.touches.length !== 1) return;
      const point = event.touches[0];
      const dy = touch.y - point.clientY;
      const dx = touch.x - point.clientX;
      if (touch.taken === null) {
        if (Math.abs(dy) < 2 && Math.abs(dx) < 2) return;
        const y = window.scrollY;
        // Inside the dive every move is its own. At either end, only a move into the dive is.
        const inside = y > zoneStart + 1 && y < zoneEnd - 1;
        touch.taken = event.cancelable && (inside || (Math.abs(dy) >= Math.abs(dx) && ours(Math.sign(dy))));
        if (touch.taken) gesture = null;
      }
      if (!touch.taken) return;
      if (event.cancelable) event.preventDefault();
      if (!touch.hopped && Math.abs(dy) >= Math.max(48, window.innerHeight * 0.06) && Math.abs(dy) > 1.25 * Math.abs(dx)) {
        touch.hopped = true;
        hop(Math.sign(dy));
      }
    }
    const onTouchEnd = () => {
      if (gesture?.kind === "touch") gesture.touching = false;
      if (touch?.taken) gesture = null;
      touch = null;
      inputAt = performance.now();
      wake();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!ready || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, [contenteditable], [role='application']")) return;
      inputAt = performance.now();
      if (event.key === "Home" || event.key === "End") {
        settling = null;
        gesture = null;
        jumping = true;
        wake();
        return;
      }
      const way = event.key === " " && event.shiftKey ? -1 : SCROLL_KEYS[event.key];
      if (!way || !ours(way)) return;
      event.preventDefault();
      if (!event.repeat) hop(way);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && !skipper.contains(event.target as Node)) settling = null;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hint = { x: event.clientX, y: event.clientY };
    };
    // Links to the game go straight there, with the whole dive played quickly on the way.
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href='#try']") : null;
      if (anchor) { gesture = null; jumping = true; wake(); }
    };
    const onSkip = () => {
      gesture = null;
      settle(hops(), true);
    };
    // Keyboard focus landing on the hidden orb brings it back rather than leaving focus out of sight.
    const onFocus = (event: FocusEvent) => {
      if (flight > 0.02 && pinned && event.target instanceof Node && stage!.contains(event.target)) {
        gesture = null;
        settle(0, true);
      }
    };
    const onResize = () => {
      if (!ready) return;
      neuron?.resize();
      small = 0;
      measure();
      drawn = -1;
      wake();
    };
    const resizer = new ResizeObserver(onResize);

    function stop() {
      cancelAnimationFrame(frame);
      window.clearTimeout(roomy);
      if (idles) window.cancelIdleCallback(tuning);
      window.clearTimeout(tuning);
      controller.abort();
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
      document.removeEventListener("click", onClick);
      document.removeEventListener("focusin", onFocus);
      skipper.removeEventListener("click", onSkip);
      motion.removeEventListener("change", onMotion);
      resizer.disconnect();
      beneath.removeEventListener("webglcontextlost", onLost);
      land();
      // Taking the room away again, with the page kept where it was if it's below.
      const top = section!.getBoundingClientRect().top;
      delete world!.dataset.flight;
      const moved = section!.getBoundingClientRect().top - top;
      if (top < window.innerHeight && Math.abs(moved) > 1) scrollTo(window.scrollY + moved);
      dive.destroy();
      neuron?.destroy();
    }
    const onMotion = () => { if (motion.matches) stop(); };

    const roomy = window.setTimeout(makeRoom, 0);
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
    document.addEventListener("click", onClick);
    document.addEventListener("focusin", onFocus);
    skipper.addEventListener("click", onSkip);
    motion.addEventListener("change", onMotion);
    resizer.observe(stage);
    resizer.observe(section);
    return stop;
  }, [graph, exits, orb, chapters]);

  return <>
    <canvas ref={deep} className={styles.flightDeep} aria-hidden="true" />
    <canvas ref={canvas} className={styles.flight} aria-hidden="true" />
    {/* What the camera is looking at, for anyone watching. The course itself is in the page for everyone else. */}
    <div ref={captionBox} className={styles.caption} aria-hidden="true">
      <p className={styles.captionWhere}><span data-where /><span className={styles.captionDots} data-dots /></p>
      <p className={styles.captionTitle} data-title />
      <p className={styles.captionText} data-text />
      <a className={styles.captionLink} data-link tabIndex={-1} href="/learn/">Open the lesson <ArrowRight size={14} aria-hidden="true" /></a>
    </div>
    <button ref={skipButton} type="button" className={styles.skip} tabIndex={-1} aria-hidden="true">Skip to the game <ArrowDown size={14} aria-hidden="true" /></button>
  </>;
}
