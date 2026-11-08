"use client";

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chapterHref } from "@/lib/links";
import { EYES_GIVE_BACK, GAZE_REACH, detent, gaze, headWeights, mixAffine, nearestLesson, nextBlink, rowWeights, turnFor, type Ledge } from "@/lib/milo";
import { MILO } from "@/lib/milo-figure";
import { MILO_TURNS } from "@/lib/milo-turns";
import type { OrbGraph } from "@/lib/orb-layout";
import { chapterOfLesson } from "@/lib/orb-view";
import type { CourseNavProps, CourseNavState } from "./CourseNav";
import type { Milo3D } from "./milo-3d-scene";
import styles from "./Milo.module.css";

const { width: W, height: H } = MILO;
const T = MILO_TURNS;
const IDLE_MS = 45000;
const STRAIGHT_HEAD = T.nods.indexOf(0) * T.yaws.length + T.yaws.indexOf(0);
const STRAIGHT_BODY = T.twists.indexOf(0);
const YAW_MAX = T.yaws[T.yaws.length - 1];
/** The most his head rolls toward the side he turns to, in degrees, so the turn doesn't look stiff. */
const ROLL = 1.2;
/** How long the head waits after the eyes before it follows, in seconds. */
const HEAD_DELAY = 0.09;
/** How far he turns in 3D, where any angle can be drawn: degrees of yaw, nod and torso twist, each way. */
const TURN_3D = { yaws: [-24, 24], nods: [-9, 12], twists: [-8, 8] };
/** One breath, in seconds. */
const BREATH = 5.6;

/** The prototype draws him in 3D unless the page is opened with ?milo=2d, which keeps the rendered turn frames. */
function wants3D() {
  try { return new URLSearchParams(window.location.search).get("milo") !== "2d"; } catch { return true; }
}

/** A place on screen Milo should look at instead of the pointer, such as the lesson being pointed at on the line. */
export type MiloFocus = { x: number; y: number } | null;

function Layer({ name, sizes, priority }: { name: "body" | "head"; sizes: string; priority: boolean }) {
  const set = (theme: string) => `/milo/${theme}-${name}-s.webp ${MILO.small}w, /milo/${theme}-${name}.webp ${W}w`;
  return <picture>
    <source media="(prefers-color-scheme: dark)" srcSet={set("dark")} sizes={sizes} />
    <img
      className={styles.layer}
      src={`/milo/light-${name}.webp`}
      srcSet={set("light")}
      sizes={sizes}
      width={W}
      height={H}
      alt=""
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      draggable={false}
      data-milo-layer={name}
    />
  </picture>;
}

const boxStyle = (box: readonly number[]) => ({ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${box[2] * 100}%`, height: `${box[3] * 100}%` });

/**
 * Milo: rendered in Blender as two layers, his body and his head, with his face's screen left blank so his eyes can be
 * drawn here, where they blink, follow what's going on and, for the dive, open onto the neuron. What the server sends
 * is exactly what the page goes on to animate, so nothing shifts or swaps when it comes to life. Once the page is
 * quiet, the frames of his head turning and his torso twisting load, and a canvas over each layer crossfades them.
 */
export function MiloFigure({ figureRef, className = "", sizes, priority = false }: {
  figureRef: RefObject<HTMLDivElement | null>;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const glow = `milo-glow-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  return <div ref={figureRef} className={`${styles.figure} ${className}`} data-milo aria-hidden="true">
    <div className={styles.body} data-milo-body>
      <div className={styles.bodyBreath}>
        <Layer name="body" sizes={sizes} priority={priority} />
        <canvas className={styles.turns} style={boxStyle(T.body.box)} data-milo-turns="body" />
      </div>
    </div>
    <div className={styles.head} data-milo-head>
      <div className={styles.headBreath}>
        <Layer name="head" sizes={sizes} priority={priority} />
        <canvas className={styles.turns} style={boxStyle(T.head.box)} data-milo-turns="head" />
        <svg className={styles.eyes} viewBox={`0 0 ${W} ${H}`} focusable="false">
          <defs>
            <filter id={glow} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          <g data-milo-screen>
            <g className={styles.gaze}>
              {MILO.eyes.map((eye, index) => <g key={index} className={styles.eye} data-milo-eye={index}>
                <ellipse className={styles.eyeGlow} cx={eye.x * W} cy={eye.y * H} rx={eye.rx * W + 4} ry={eye.ry * H + 4} filter={`url(#${glow})`} />
                <ellipse className={styles.eyeShape} cx={eye.x * W} cy={eye.y * H} rx={eye.rx * W} ry={eye.ry * H} />
              </g>)}
            </g>
          </g>
        </svg>
      </div>
    </div>
  </div>;
}

type Sprites = { head: HTMLImageElement; body: HTMLImageElement; straightHead: HTMLImageElement; straightBody: HTMLImageElement; small: boolean };

async function decoded(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await image.decode();
  return image;
}

/** A sprite, as AVIF where the browser has it and WebP otherwise. */
async function sprite(base: string) {
  try { return await decoded(`${base}.avif`); } catch { return decoded(`${base}.webp`); }
}

/** The turn frames for the theme showing, at the size this screen wants, with the plain layers to draw the straight frame from. */
async function loadSprites(figure: HTMLElement): Promise<Sprites | null> {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = dark ? "dark" : "light";
  const ratio = window.devicePixelRatio || 1;
  const need = figure.offsetWidth * ratio;
  if (!need) return null;
  // The small sprite holds a figure this many pixels wide; use it when the screen shows him no wider, counting a
  // phone's 3x screen as 2x: the turned frames are a little softer there, at about half the weight.
  const small = figure.offsetWidth * Math.min(ratio, 2) <= (T.head.smallCell[0] / T.head.box[2]) * 1.15;
  // The plain layer the page has chosen for this screen, so it's already loaded.
  const plain = need <= MILO.small ? "-s" : "";
  try {
    const [head, body, straightHead, straightBody] = await Promise.all([
      sprite(`/milo/${theme}-turns-head${small ? "-s" : ""}`),
      sprite(`/milo/${theme}-turns-body${small ? "-s" : ""}`),
      decoded(`/milo/${theme}-head${plain}.webp`),
      decoded(`/milo/${theme}-body${plain}.webp`),
    ]);
    return { head, body, straightHead, straightBody, small };
  } catch {
    return null;
  }
}

/** Draws a mix of frames on a layer's canvas: each frame in its share, added up, so a crossfade is exact. */
function paint(canvas: HTMLCanvasElement, sheet: HTMLImageElement, cell: readonly number[], columns: number, straight: HTMLImageElement, straightIndex: number, box: readonly number[], weights: Map<number, number>) {
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = "lighter";
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  for (const [index, weight] of weights) {
    context.globalAlpha = weight;
    if (index === straightIndex) {
      const sw = straight.naturalWidth;
      const sh = straight.naturalHeight;
      context.drawImage(straight, box[0] * sw, box[1] * sh, box[2] * sw, box[3] * sh, 0, 0, canvas.width, canvas.height);
    } else {
      context.drawImage(sheet, (index % columns) * cell[0], Math.floor(index / columns) * cell[1], cell[0], cell[1], 0, 0, canvas.width, canvas.height);
    }
  }
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
}

const keyOf = (weights: Map<number, number>) => [...weights].map(([cell, weight]) => `${cell}:${weight.toFixed(3)}`).join(",");

/** A value that springs toward its goal without overshooting, so moves start gently and settle softly. */
type Spring = { at: number; speed: number; goal: number };
function step(spring: Spring, omega: number, dt: number) {
  const pull = omega * omega * (spring.goal - spring.at) - 2 * omega * spring.speed;
  spring.speed += pull * dt;
  spring.at += spring.speed * dt;
  return Math.abs(spring.goal - spring.at) > 0.02 || Math.abs(spring.speed) > 0.05;
}
function settle(spring: Spring) {
  spring.at = spring.goal;
  spring.speed = 0;
}

/**
 * Milo's idle life: he breathes, blinks, shifts his weight now and then, and looks at the pointer or whatever the page
 * points him at. His eyes dart there first; his head follows a beat later and carries most of the turn, settling on
 * one of its rendered frames, and his torso follows last and least. It all stops when he's off screen or nothing has
 * happened for a while, and never runs for anyone who prefers reduced motion.
 */
export function useMiloLife(figure: RefObject<HTMLDivElement | null>, focus: RefObject<MiloFocus>, paused = false) {
  const wakeRef = useRef<() => void>(() => {});
  useEffect(() => {
    const node = figure.current;
    if (!node || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el: HTMLDivElement = node;
    const headCanvas = el.querySelector<HTMLCanvasElement>("canvas[data-milo-turns='head']");
    const bodyCanvas = el.querySelector<HTMLCanvasElement>("canvas[data-milo-turns='body']");
    const screen = el.querySelector<SVGGElement>("[data-milo-screen]");
    const fine = window.matchMedia("(pointer: fine)").matches;
    let pointer: { x: number; y: number } | null = null;
    let wander: { x: number; y: number; until: number } | null = null;
    let eyes = { x: 0, y: 0 };
    const yaw: Spring = { at: 0, speed: 0, goal: 0 };
    const nod: Spring = { at: 0, speed: 0, goal: 0 };
    const twist: Spring = { at: 0, speed: 0, goal: 0 };
    const lean: Spring = { at: 0, speed: 0, goal: 0 };
    // Where the head will come to rest, and when it sets off for it.
    let rest = { yaw: 0, nod: 0 };
    let pending: { yaw: number; nod: number; at: number } | null = null;
    let restTwist = 0;
    let sprites: Sprites | null = null;
    // Milo in 3D, once loaded: then the head and torso turn to any angle, and he's drawn on a canvas instead of his images.
    let three: Milo3D | null = null;
    let shadow: HTMLImageElement | null = null;
    let aims: { at: number; yaw: number; nod: number }[] = [];
    let drawnAt = 0;
    // Each load is numbered, so one overtaken by a change of theme is dropped.
    let generation = 0;
    let painted = { head: "", body: "" };
    let frame = 0;
    let last = 0;
    let visible = true;
    let lastInput = performance.now();
    let blinkTimer = 0;
    let wanderTimer = 0;
    let shiftTimer = 0;
    let retryTimer = 0;
    let idle = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let still = false;

    function setStill(value: boolean) {
      if (value === still) return;
      still = value;
      if (value) el.dataset.still = "";
      else delete el.dataset.still;
      if (value) {
        window.clearTimeout(blinkTimer);
        window.clearTimeout(wanderTimer);
        window.clearTimeout(shiftTimer);
      } else {
        scheduleBlink(false);
        scheduleWander();
        scheduleShift();
      }
    }

    function scheduleBlink(justBlinked: boolean) {
      window.clearTimeout(blinkTimer);
      blinkTimer = window.setTimeout(() => {
        if (still) return;
        el.dataset.blink = "";
        window.setTimeout(() => { delete el.dataset.blink; }, 120);
        scheduleBlink(true);
      }, nextBlink(Math.random(), justBlinked));
    }

    // Without a mouse to follow, he glances about now and then: at the line, the words, then back at the visitor.
    function scheduleWander() {
      if (fine) return;
      window.clearTimeout(wanderTimer);
      wanderTimer = window.setTimeout(() => {
        if (still) return;
        const box = el.getBoundingClientRect();
        const pick = Math.random();
        const x = box.left + box.width * (pick < 0.4 ? -0.4 : pick < 0.8 ? 1.4 : 0.5);
        const y = box.top + box.height * (pick < 0.8 ? 0.9 : 0.42);
        wander = { x, y, until: performance.now() + 1400 + Math.random() * 1200 };
        wake();
        scheduleWander();
      }, 3800 + Math.random() * 4200);
    }

    // Now and then he shifts his weight: his torso leans a little to one side on still hips, and back.
    function scheduleShift() {
      window.clearTimeout(shiftTimer);
      shiftTimer = window.setTimeout(() => {
        if (still) return;
        const side = lean.goal === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        lean.goal = side * (0.35 + Math.random() * 0.4);
        wake();
        scheduleShift();
      }, 7000 + Math.random() * 7000);
    }

    function fitCanvas(canvas: HTMLCanvasElement | null, box: readonly number[], cell: readonly number[]) {
      if (!canvas) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      // No sharper than the frames themselves, give or take the plain layer they share it with.
      const width = Math.max(1, Math.round(Math.min(box[2] * el.offsetWidth * ratio, cell[0] * 1.6)));
      const height = Math.max(1, Math.round(width * (box[3] * H) / (box[2] * W)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        painted = { head: "", body: "" };
      }
    }

    function fit() {
      if (!sprites) return;
      fitCanvas(headCanvas, T.head.box, sprites.small ? T.head.smallCell : T.head.cell);
      fitCanvas(bodyCanvas, T.body.box, sprites.small ? T.body.smallCell : T.body.cell);
    }

    async function load3D() {
      const mine = ++generation;
      const theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      let made: Milo3D | null = null;
      try {
        const { createMilo3D } = await import("./milo-3d-scene");
        made = await createMilo3D(el, theme);
      } catch {
        made = null;
      }
      if (mine !== generation || !el.isConnected) {
        made?.destroy();
        return true;
      }
      if (!made) return false;
      three = made;
      // His contact shadow on the ledge, which his body image used to carry, under the model.
      shadow = document.createElement("img");
      shadow.alt = "";
      shadow.dataset.miloShadow = "";
      shadow.src = `/milo/${theme}-shadow.webp`;
      const headLayer = el.querySelector("[data-milo-head]");
      el.insertBefore(shadow, headLayer);
      el.insertBefore(three.canvas, headLayer);
      three.resize();
      draw3D(performance.now());
      // The canvas fades in over his images, which then step aside.
      requestAnimationFrame(() => { el.dataset.milo3d = ""; });
      wake();
      return true;
    }

    async function load(again = true) {
      if (sprites || three) return;
      if (wants3D() && await load3D()) return;
      const mine = ++generation;
      const found = await loadSprites(el);
      if (mine !== generation || !el.isConnected) return;
      // A sprite that didn't come gets one more try a little later; until then, and without it, he looks with his eyes.
      if (!found) {
        if (again) retryTimer = window.setTimeout(() => { void load(false); }, 5000);
        return;
      }
      sprites = found;
      fit();
      wake();
    }

    function draw3D(now: number) {
      if (!three) return;
      drawnAt = now;
      const breath = still ? 0 : (1 - Math.cos((now / 1000 / BREATH) * Math.PI * 2)) / 2;
      const map = three.draw({ yaw: yaw.at, nod: nod.at, roll: (yaw.at / TURN_3D.yaws[1]) * ROLL, twist: twist.at, lean: lean.at, breath });
      screen?.setAttribute("transform", `matrix(${map.map((value) => value.toFixed(4)).join(" ")})`);
    }

    function show(yawNow: number, nodNow: number, twistNow: number) {
      const head = headWeights(T.yaws, T.nods, yawNow, nodNow);
      const body = rowWeights(T.twists, twistNow);
      // The eyes go onto the screen as the frames showing have it.
      const map = mixAffine(T.head.affine, head);
      screen?.setAttribute("transform", `matrix(${map.map((value) => value.toFixed(4)).join(" ")})`);
      const turned = head.size > 1 || !head.has(STRAIGHT_HEAD);
      const twisted = body.size > 1 || !body.has(STRAIGHT_BODY);
      if (sprites && headCanvas && turned) {
        const key = keyOf(head);
        if (key !== painted.head) {
          paint(headCanvas, sprites.head, sprites.small ? T.head.smallCell : T.head.cell, T.yaws.length, sprites.straightHead, STRAIGHT_HEAD, T.head.box, head);
          painted.head = key;
        }
      }
      if (sprites && bodyCanvas && twisted) {
        const key = keyOf(body);
        if (key !== painted.body) {
          paint(bodyCanvas, sprites.body, sprites.small ? T.body.smallCell : T.body.cell, T.twists.length, sprites.straightBody, STRAIGHT_BODY, T.body.box, body);
          painted.body = key;
        }
      }
      if (turned) el.dataset.turnHead = "";
      else delete el.dataset.turnHead;
      if (twisted) el.dataset.turnBody = "";
      else delete el.dataset.turnBody;
      // The head rides on the neck, which moves as the torso twists and leans.
      let neckX = 0;
      let neckY = 0;
      for (const [cell, weight] of body) {
        neckX += T.body.neck[cell][0] * weight;
        neckY += T.body.neck[cell][1] * weight;
      }
      const above = (MILO.neck[1] - MILO.seat[1]) * (H / W);
      neckX += Math.tan((lean.at * Math.PI) / 180) * above;
      el.style.setProperty("--hx", `${(neckX * 100).toFixed(3)}%`);
      el.style.setProperty("--hy", `${(neckY * 100).toFixed(3)}%`);
      el.style.setProperty("--tilt", `${((yawNow / YAW_MAX) * ROLL).toFixed(3)}deg`);
      el.style.setProperty("--lean", `${lean.at.toFixed(3)}deg`);
    }

    function loop(now: number) {
      frame = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (now - lastInput > IDLE_MS) setStill(true);
      if (wander && now > wander.until) wander = null;
      const box = el.getBoundingClientRect();
      const target = focus.current ?? (wander ? { x: wander.x, y: wander.y } : pointer);
      let want = { x: 0, y: 0 };
      if (target && box.width > 0) {
        const cx = box.left + MILO.display.x * box.width;
        const cy = box.top + MILO.display.y * box.height;
        want = gaze((target.x - cx) / box.width, (target.y - cy) / box.height);
      }
      if (three) {
        loop3D(now, dt, want);
        return;
      }
      // The head comes to rest on the frame nearest where he looks, once its frames are here; until then it stays put.
      const aim = turnFor(want, T);
      const next = sprites ? { yaw: detent(T.yaws, rest.yaw, aim.yaw), nod: detent(T.nods, rest.nod, aim.nod) } : { yaw: 0, nod: 0 };
      if (next.yaw !== rest.yaw || next.nod !== rest.nod) {
        rest = next;
        pending = { ...next, at: now + HEAD_DELAY * 1000 };
      }
      if (pending && now >= pending.at) {
        yaw.goal = pending.yaw;
        nod.goal = pending.nod;
        pending = null;
      }
      let moving = pending !== null;
      moving = step(yaw, 9, dt) || moving;
      moving = step(nod, 9, dt) || moving;
      // The torso follows where the head has got to, not where it's going, so it comes last.
      restTwist = sprites ? detent(T.twists, restTwist, turnFor({ x: (yaw.at / YAW_MAX) * GAZE_REACH.x, y: 0 }, T).twist) : 0;
      twist.goal = restTwist;
      moving = step(twist, 5, dt) || moving;
      moving = step(lean, 2.2, dt) || moving;
      if (!moving) {
        settle(yaw);
        settle(nod);
        settle(twist);
        settle(lean);
      }
      // The eyes dart, then give some of the turn back to the head as it comes round.
      const back = {
        x: (yaw.at / YAW_MAX) * GAZE_REACH.x * EYES_GIVE_BACK,
        y: (nod.at >= 0 ? nod.at / T.nods[T.nods.length - 1] : -nod.at / T.nods[0]) * GAZE_REACH.y * EYES_GIVE_BACK,
      };
      const goal = {
        x: Math.max(-GAZE_REACH.x, Math.min(GAZE_REACH.x, want.x - back.x)),
        y: Math.max(-GAZE_REACH.y, Math.min(GAZE_REACH.y, want.y - back.y)),
      };
      const quick = 1 - Math.exp(-dt / 0.07);
      eyes = { x: eyes.x + (goal.x - eyes.x) * quick, y: eyes.y + (goal.y - eyes.y) * quick };
      el.style.setProperty("--gx", `${(eyes.x * W).toFixed(2)}px`);
      el.style.setProperty("--gy", `${(eyes.y * H).toFixed(2)}px`);
      show(yaw.at, nod.at, twist.at);
      moving = moving || Math.abs(goal.x - eyes.x) * W > 0.05 || Math.abs(goal.y - eyes.y) * H > 0.05;
      if (moving && visible) frame = requestAnimationFrame(loop);
      else last = 0;
    }

    // In 3D the head follows where the eyes look continuously, a beat behind them, and the torso follows the head.
    function loop3D(now: number, dt: number, want: { x: number; y: number }) {
      const aim = turnFor(want, TURN_3D);
      aims.push({ at: now, yaw: aim.yaw, nod: aim.nod });
      while (aims.length > 1 && aims[1].at <= now - HEAD_DELAY * 1000) aims.shift();
      yaw.goal = aims[0].yaw;
      nod.goal = aims[0].nod;
      let moving = step(yaw, 7, dt);
      moving = step(nod, 7, dt) || moving;
      twist.goal = turnFor({ x: (yaw.at / TURN_3D.yaws[1]) * GAZE_REACH.x, y: 0 }, TURN_3D).twist;
      moving = step(twist, 4, dt) || moving;
      moving = step(lean, 2.2, dt) || moving;
      const back = {
        x: (yaw.at / TURN_3D.yaws[1]) * GAZE_REACH.x * EYES_GIVE_BACK,
        y: (nod.at >= 0 ? nod.at / TURN_3D.nods[1] : -nod.at / TURN_3D.nods[0]) * GAZE_REACH.y * EYES_GIVE_BACK,
      };
      const goal = {
        x: Math.max(-GAZE_REACH.x, Math.min(GAZE_REACH.x, want.x - back.x)),
        y: Math.max(-GAZE_REACH.y, Math.min(GAZE_REACH.y, want.y - back.y)),
      };
      const quick = 1 - Math.exp(-dt / 0.07);
      eyes = { x: eyes.x + (goal.x - eyes.x) * quick, y: eyes.y + (goal.y - eyes.y) * quick };
      el.style.setProperty("--gx", `${(eyes.x * W).toFixed(2)}px`);
      el.style.setProperty("--gy", `${(eyes.y * H).toFixed(2)}px`);
      moving = moving || Math.abs(goal.x - eyes.x) * W > 0.05 || Math.abs(goal.y - eyes.y) * H > 0.05;
      // While he only breathes, twenty frames a second is plenty.
      if (moving || now - drawnAt > 50) draw3D(now);
      if (visible && (moving || !still)) frame = requestAnimationFrame(loop);
      else last = 0;
    }

    function wake() {
      if (!frame && visible) frame = requestAnimationFrame(loop);
    }
    wakeRef.current = wake;

    const onInput = () => {
      lastInput = performance.now();
      if (visible) setStill(false);
      wake();
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") pointer = { x: event.clientX, y: event.clientY };
      onInput();
    };
    const onLeave = () => { pointer = null; wake(); };
    const watcher = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      setStill(!visible);
      if (visible) wake();
    });
    const sizer = new ResizeObserver(() => {
      fit();
      painted = { head: "", body: "" };
      if (three) { three.resize(); draw3D(performance.now()); }
      wake();
    });
    // A change of theme swaps his images, so the frames go back to straight ahead until the other theme's have loaded.
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (three) {
        const theme = scheme.matches ? "dark" : "light";
        if (shadow) shadow.src = `/milo/${theme}-shadow.webp`;
        void three.setTheme(theme).then(() => draw3D(performance.now()));
        return;
      }
      generation++;
      sprites = null;
      painted = { head: "", body: "" };
      rest = { yaw: 0, nod: 0 };
      restTwist = 0;
      pending = null;
      for (const spring of [yaw, nod, twist]) { spring.goal = 0; settle(spring); }
      show(0, 0, 0);
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => { void load(); }, 300);
    };
    // The turn frames wait until the page is quiet, so they never hold up the first screen.
    const later = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => { void load(); }, { timeout: 3000 });
      else idleTimer = setTimeout(() => { void load(); }, 1500);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    watcher.observe(el);
    sizer.observe(el);
    scheme.addEventListener("change", onScheme);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    for (const name of ["keydown", "touchstart", "wheel", "scroll"] as const) window.addEventListener(name, onInput, { passive: true });
    scheduleBlink(false);
    scheduleWander();
    scheduleShift();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(blinkTimer);
      window.clearTimeout(wanderTimer);
      window.clearTimeout(shiftTimer);
      window.clearTimeout(retryTimer);
      if (idle) window.cancelIdleCallback(idle);
      clearTimeout(idleTimer);
      window.removeEventListener("load", later);
      watcher.disconnect();
      sizer.disconnect();
      scheme.removeEventListener("change", onScheme);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      for (const name of ["keydown", "touchstart", "wheel", "scroll"] as const) window.removeEventListener(name, onInput);
      wakeRef.current = () => {};
      generation++;
      sprites = null;
      three?.destroy();
      three = null;
      shadow?.remove();
      delete el.dataset.milo3d;
      delete el.dataset.still;
      delete el.dataset.blink;
      delete el.dataset.turnHead;
      delete el.dataset.turnBody;
      screen?.removeAttribute("transform");
      for (const name of ["--hx", "--hy", "--tilt", "--lean", "--gx", "--gy"]) el.style.removeProperty(name);
    };
  }, [figure, focus, paused]);
  return wakeRef;
}

const TICK = { lesson: 5, chapter: 10, next: 15 };

function ticksPath(xs: number[], height: number) {
  return xs.map((x) => `M${(x * 1000).toFixed(1)} 0V${height}`).join("");
}

/**
 * The course as the line Milo sits on: a tick for every lesson (every chapter on a phone), the finished ones inked in,
 * the next one lit, and below it the four parts, which open the course where they point. Pointing along the line names
 * the lesson there, and the arrow keys walk it.
 */
export function CourseLedge({ graph, chapters, nav, ledge, onPart, onFocusLesson, highlight, nextMark, className = "", partsClassName = "" }: {
  graph: OrbGraph;
  chapters: CourseNavProps["chapters"];
  nav: CourseNavState;
  ledge: Ledge;
  onPart?: (part: number) => void;
  /** Called with where on screen the lesson being pointed at is, or null. */
  onFocusLesson?: (spot: { x: number; y: number } | null) => void;
  /** Lessons to ink in for what the panel is showing. */
  highlight: { from: number; to: number } | null;
  /** Drawn at the next lesson in place of its orange tick, which stays for forced colours. */
  nextMark?: ReactNode;
  className?: string;
  partsClassName?: string;
}) {
  const band = useRef<HTMLDivElement>(null);
  const pointerType = useRef("mouse");
  const [hoverPart, setHoverPart] = useState<number | null>(null);
  const firsts = useMemo(() => graph.chapterStarts.slice(0, -1), [graph]);
  const all = useMemo(() => ticksPath(ledge.lessons, TICK.lesson), [ledge]);
  const chapterTicks = useMemo(() => ticksPath(firsts.map((lesson) => ledge.lessons[lesson]), TICK.chapter), [firsts, ledge]);
  const done = useMemo(() => ticksPath(ledge.lessons.filter((_, lesson) => nav.finished[lesson]), TICK.lesson), [ledge, nav.finished]);
  const doneChapters = useMemo(() => ticksPath(firsts.flatMap((start, chapter) => {
    const end = graph.chapterStarts[chapter + 1];
    for (let lesson = start; lesson < end; lesson++) if (!nav.finished[lesson]) return [];
    return [ledge.lessons[start]];
  }), TICK.chapter), [firsts, graph, ledge, nav.finished]);
  const partRange = hoverPart !== null ? partLessons(graph, hoverPart) : null;
  const lit = highlight ?? partRange;
  const litPath = useMemo(() => lit ? ticksPath(ledge.lessons.slice(lit.from, lit.to), TICK.lesson) : "", [ledge, lit]);
  const shown = nav.active ?? nav.hovered;

  function spotOf(lesson: number) {
    const box = band.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: box.left + ledge.lessons[lesson] * box.width, y: box.top + box.height * 0.35 };
  }

  useEffect(() => {
    onFocusLesson?.(shown !== null ? spotOf(shown) : null);
    // Only the lesson matters: the band doesn't move while it's pointed at.
  }, [shown]);

  function lessonAt(event: ReactPointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return nearestLesson(ledge.lessons, (event.clientX - box.left) / box.width);
  }

  const facts = shown === null ? "" : `${chapters[chapterOfLesson(graph, shown)].title}${nav.finished[shown] ? " · Finished" : shown === nav.nextLesson ? ` · ${nav.nextLabel}` : ""}`;

  return <>
    <div className={`${styles.ledge} ${className}`} data-ledge>
      <svg className={styles.ticks} viewBox={`0 0 1000 ${TICK.next + 1}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className={styles.tickAll} d={all} />
        <path className={styles.tickChapter} d={chapterTicks} />
        <path className={styles.tickDone} d={done} />
        <path className={styles.tickDoneChapter} d={doneChapters} />
        {litPath ? <path className={styles.tickLit} d={litPath} /> : null}
        {nav.nextLesson !== null ? <path className={`${styles.tickNext} ${nextMark ? styles.tickNextMarked : ""}`} d={ticksPath([ledge.lessons[nav.nextLesson]], TICK.next)} /> : null}
        {shown !== null ? <path className={styles.tickShown} d={ticksPath([ledge.lessons[shown]], TICK.next)} /> : null}
      </svg>
      {nextMark && nav.nextLesson !== null ? <span className={styles.nextMark} style={{ left: `${ledge.lessons[nav.nextLesson] * 100}%` }}>{nextMark}</span> : null}
      <div
        ref={band}
        className={styles.band}
        role="application"
        tabIndex={0}
        aria-label={`The course, ${graph.titles.length} lessons in a line. Left and right arrows move between lessons, up and down between chapters, and Enter opens a lesson.`}
        onKeyDown={(event) => nav.onKeyDown(event)}
        onPointerDown={(event) => { pointerType.current = event.pointerType; }}
        onPointerMove={(event) => { if (event.pointerType === "mouse") nav.onHover(lessonAt(event)); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") nav.onHover(null); }}
        onClick={(event) => {
          const lesson = lessonAt(event);
          // A mouse opens the lesson it's on; a tap shows its chapter first, since a finger can't point first.
          if (pointerType.current === "mouse" || event.detail === 0) nav.open(lesson, event.metaKey || event.ctrlKey);
          else nav.onTap(lesson);
        }}
      />
      <div className={`${styles.tooltip} ${shown !== null ? styles.tooltipOn : ""} ${nav.tapped ? styles.tooltipTapped : ""}`} style={shown !== null ? { left: `${ledge.lessons[shown] * 100}%`, transform: `translateX(-${(12 + 76 * ledge.lessons[shown]).toFixed(1)}%)` } : undefined} aria-hidden="true">
        {shown === null ? null : nav.tapped ? <Link href={nav.hrefOf(shown)} tabIndex={-1} onClick={() => trackEvent("orb_open_dot")}>
          <strong>{graph.titles[shown]} <ArrowRight size={13} aria-hidden="true" /></strong>
          <span>{facts}</span>
        </Link> : <>
          <strong>{graph.titles[shown]}</strong>
          <span>{facts}</span>
        </>}
      </div>
      <p className={styles.keyHint} aria-hidden="true">Arrow keys walk the course. Enter opens a lesson.</p>
    </div>
    <ol className={`${styles.parts} ${partsClassName}`} aria-label="The four parts of the course">
      {graph.partTitles.map((title, part) => {
        const { from, to } = partLessons(graph, part);
        const finished = nav.finished.slice(from, to).filter(Boolean).length;
        const first = graph.chapterParts.indexOf(part);
        const { start, end } = ledge.parts[part];
        return <li key={title} style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}>
          <Link
            href={chapterHref(chapters[first].id)}
            className={styles.part}
            onClick={(event) => {
              if (!onPart || event.metaKey || event.ctrlKey || event.shiftKey) return;
              event.preventDefault();
              onPart(part);
            }}
            onPointerEnter={(event) => { if (event.pointerType === "mouse") setHoverPart(part); }}
            onPointerLeave={() => setHoverPart(null)}
            onFocus={() => setHoverPart(part)}
            onBlur={() => setHoverPart(null)}
          >
            <span className={styles.partTitle}>{title}</span>
            <span className={styles.partFacts}>{finished > 0 ? `${finished} of ${to - from}` : `${to - from} lessons`}</span>
          </Link>
        </li>;
      })}
    </ol>
  </>;
}

/** The lessons of one part, as a range of lesson indexes. */
export function partLessons(graph: Pick<OrbGraph, "chapterStarts" | "chapterParts">, part: number) {
  let from = Infinity;
  let to = -Infinity;
  graph.chapterParts.forEach((owner, chapter) => {
    if (owner !== part) return;
    from = Math.min(from, graph.chapterStarts[chapter]);
    to = Math.max(to, graph.chapterStarts[chapter + 1]);
  });
  return { from, to };
}
