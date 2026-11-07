import { arborsFor, BEADS_PER_LINK, somaPath, stainedAtFirst, strokeOf, STUB_INK, STUB_REACH, type Arbors } from "./orb-arbor";
import type { OrbGraph } from "./orb-layout";
import { arcPoint, faceAngles, foldPoint, hitLesson, hopsFrom, nearestAngle, rimNameFades, routeAhead, rubberBand, springStep, type HitPoint } from "./orb-motion";
import {
  arcControl, CAMERA, CHAPTER_LINE, chapterOfLesson, dotAlpha, dotRadius, FIT, foldHandles, foldNeighbors, lineAlpha, linkDegrees, nearness, ORB_RADIUS, RELATED_LINE,
} from "./orb-view";

// The live orb on a 2D canvas: 158 neurons and a few thousand short segments don't need a 3D engine, and this
// loads in a few kilobytes where three.js costs about 253. It draws only while on screen, and everything the
// orb does in motion can be grabbed and redirected partway. It lands on the poster's dots, then each lesson grows
// into a neuron: see orb-arbor.ts.

const ARC_STEPS = 8;
const FOLD_STEPS = 5;
const ALPHA_STEPS = 16;
const IDLE_SPIN = 0.07; // Radians a second: a full turn every minute and a half.
const SPIN_EASE = 0.7;
const PITCH_LIMIT = 1.2;
const TURN_RESPONSE = 0.9;
const ZOOM_RESPONSE = 0.7;
const EMPHASIS_EASE = 0.16;
const NAME_GAP = 0.12; // Radians of clear rim between two part names before the farther one starts to fade.
const IDLE_FRAME = 30; // Slow rotation looks the same at 30 frames a second and costs half the battery.
const TOUCH_IDLE_FRAME = 60; // On a phone, 15 frames a second: the rim still moves less than a pixel a frame.
const IDLE_LIMIT = 45_000; // The orb opens the home page, so left alone it comes to rest rather than drawing for as long as the tab stays open.
const SIGNAL_HOP = 0.075;
const SIGNAL_WIDTH = 0.14;
const PULSE_EVERY = 1.3;
const PULSE_LENGTH = 1.7;
const GROW = 1.7; // Seconds for the neurons to grow out of the poster's dots, a chapter at a time.
const STAIN_EASE = 0.4;
const FLASH_DECAY = 0.45; // A cell lighting up fades like a calcium indicator: quick to rise, about half a second to fade.
const FLASHES = 0.8; // Cells that light up on their own each second, across the whole orb.
const NODES = 6; // The nodes a signal jumps between on its way through the orb.
const WIDTHS = [0.45, 0.65, 0.9, 1.25, 1.75, 2.5];

export type OrbSceneEvents = {
  onHover: (lesson: number | null) => void;
  /** A touch landed on or near a lesson, or away from the orb. */
  onTap: (lesson: number | null) => void;
  onOpen: (lesson: number, inNewTab: boolean) => void;
  /** The canvas stopped working, so the page should show the list instead. */
  onFail: () => void;
  /** A part's name on the rim was clicked or tapped. Only asked for where the rim is navigation. */
  onPart?: (part: number) => void;
};

export type OrbFocus = {
  chapter: number | null;
  lesson: number | null;
  faceLesson: boolean;
  /** A part being browsed: the orb turns to its lobe and quietens the others. */
  part?: number | null;
  /** A chapter being pointed at in a list, which the orb turns to and lights without selecting it. */
  preview?: number | null;
};

export type OrbSceneOptions = {
  /** The orb is the home page's navigation: its part names can be clicked, and the page names the next lesson itself. */
  navigation?: boolean;
};

export type OrbScene = {
  setProgress: (finished: boolean[], next: number | null, nextLabel: string) => void;
  setOrder: (order: number[] | null) => void;
  setFocus: (focus: OrbFocus) => void;
  setHold: (hold: boolean) => void;
  /** Stops drawing while the page has covered the orb, leaving the last frame on screen. */
  setResting: (resting: boolean) => void;
  /** Holds the orb exactly where it is, for as long as the dive through it borrows its angle. */
  setFrozen: (frozen: boolean) => void;
  /** The angle the orb is turned to right now. */
  view: () => { yaw: number; pitch: number };
  /** Turns to a lesson and sends a signal out from it, then goes back to drifting. */
  announce: (lesson: number) => void;
  /** How far each neuron has grown and how deeply it's stained right now, for the dive to take over from. */
  stains: () => { reach: Float32Array; ink: Float32Array };
  destroy: () => void;
};

type Theme = { ink: string; muted: string; canvas: string; dark: boolean; halo: HTMLCanvasElement | null };
type Pulse = { link: number; age: number; forward: boolean; landed: boolean };

const cssColor = (styles: CSSStyleDeclaration, name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

function makeHalo() {
  const size = 64;
  const halo = document.createElement("canvas");
  halo.width = size;
  halo.height = size;
  const context = halo.getContext("2d");
  if (!context) return null;
  const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, "rgb(255 255 255 / 55%)");
  glow.addColorStop(0.35, "rgb(255 255 255 / 14%)");
  glow.addColorStop(1, "rgb(255 255 255 / 0%)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  return halo;
}

export function createOrbScene(canvas: HTMLCanvasElement, graph: OrbGraph, tooltip: HTMLElement | null, events: OrbSceneEvents, options: OrbSceneOptions = {}): OrbScene | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx = context;

  const count = graph.titles.length;
  const chapterCount = graph.chapterStarts.length - 1;
  const linkCount = graph.links.length / 2;
  const base = Float32Array.from(graph.positions);
  const degrees = linkDegrees(graph);
  const chapterOf = graph.titles.map((_, lesson) => chapterOfLesson(graph, lesson));
  const position = (lesson: number) => [base[lesson * 3], base[lesson * 3 + 1], base[lesson * 3 + 2]];

  const arcs = new Float32Array(linkCount * (ARC_STEPS + 1) * 3);
  for (let link = 0; link < linkCount; link++) {
    const a = position(graph.links[link * 2]);
    const b = position(graph.links[link * 2 + 1]);
    const control = arcControl(a, b);
    for (let step = 0; step <= ARC_STEPS; step++) arcs.set(arcPoint(a, control, b, step / ARC_STEPS), (link * (ARC_STEPS + 1) + step) * 3);
  }

  // Each chapter's thread, sampled from its first lesson to its last.
  const folds = new Float32Array(count * (FOLD_STEPS + 1) * 3);
  for (let chapter = 0; chapter < chapterCount; chapter++) {
    const start = graph.chapterStarts[chapter];
    const end = graph.chapterStarts[chapter + 1];
    for (let lesson = start; lesson < end - 1; lesson++) {
      const a = position(lesson);
      const b = position(lesson + 1);
      const { before, after } = foldNeighbors(start, end, lesson);
      const [first, second] = foldHandles(position(before), a, b, position(after));
      for (let step = 0; step <= FOLD_STEPS; step++) folds.set(foldPoint(a, first, second, b, step / FOLD_STEPS), (lesson * (FOLD_STEPS + 1) + step) * 3);
    }
  }

  const direction = (points: number[][]) => {
    const sum = points.reduce((total, point) => [total[0] + point[0], total[1] + point[1], total[2] + point[2]], [0, 0, 0]);
    const length = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    return [sum[0] / length, sum[1] / length, sum[2] / length];
  };
  const chapterCenters = Array.from({ length: chapterCount }, (_, chapter) => {
    const lessons: number[][] = [];
    for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1]; lesson++) lessons.push(position(lesson));
    return direction(lessons);
  });
  const partCenters = graph.partTitles.map((_, part) => direction(graph.titles.flatMap((__, lesson) => graph.chapterParts[chapterOf[lesson]] === part ? [position(lesson)] : [])));

  const screenX = new Float32Array(count);
  const screenY = new Float32Array(count);
  const depths = new Float32Array(count);
  const hitPoints: HitPoint[] = graph.titles.map(() => ({ x: 0, y: 0, depth: 0 }));
  const arcX = new Float32Array(arcs.length / 3);
  const arcY = new Float32Array(arcs.length / 3);
  const arcDepth = new Float32Array(arcs.length / 3);
  const foldX = new Float32Array(folds.length / 3);
  const foldY = new Float32Array(folds.length / 3);
  const foldDepth = new Float32Array(folds.length / 3);
  const drawOrder = graph.titles.map((_, lesson) => lesson);
  const glow = new Float32Array(count);
  const signal = new Float32Array(count);
  const emphasis = new Float32Array(chapterCount).fill(1);
  const linkBoost = new Float32Array(linkCount);
  const faint: number[][] = Array.from({ length: ALPHA_STEPS + 1 }, () => []);
  const folded: number[][] = Array.from({ length: ALPHA_STEPS + 1 }, () => []);
  const strong: number[][] = Array.from({ length: ALPHA_STEPS + 1 }, () => []);
  const pulses: Pulse[] = [];

  // The neurons: dendrites to grow and stain, cell bodies that point outward, beads on the axons. The first frame is
  // the poster's dots and needs none of it, so it's worked out in a quiet moment after that.
  let arbors: Arbors | null = null;
  let arborX = new Float32Array(0);
  let arborY = new Float32Array(0);
  let arborDepth = new Float32Array(0);
  const apexEnds = new Float32Array(count * 3);
  const apexX = new Float32Array(count);
  const apexY = new Float32Array(count);
  const apexDepth = new Float32Array(count);
  const firstStain = graph.titles.map((_, lesson) => stainedAtFirst(lesson));
  const reach = new Float32Array(count);
  const ink = new Float32Array(count);
  const flash = new Float32Array(count);
  const growDelay = graph.titles.map((_, lesson) => (chapterOf[lesson] / Math.max(1, chapterCount - 1)) * 0.55);
  const arborStore: number[][] = Array.from({ length: WIDTHS.length * (ALPHA_STEPS + 1) }, () => []);
  const beadStore: number[][] = Array.from({ length: ALPHA_STEPS + 1 }, () => []);
  const glowStore: number[][] = Array.from({ length: ALPHA_STEPS + 1 }, () => []);
  const sparkStore: number[][] = Array.from({ length: ALPHA_STEPS + 1 }, () => []);
  let grown = 0;
  let staining = false;
  let lean = false;
  let slowness = 16;
  let slowFrames = 0;
  let heavyFrames = 0;
  const born = performance.now();
  let flashClock = 0;

  let width = 0;
  let height = 0;
  let scale = 1;
  let radius = 0;
  let labelSize = 12;
  let fontFamily = "system-ui, sans-serif";
  let theme: Theme = { ink: "#171717", muted: "#595959", canvas: "#fafafa", dark: false, halo: null };

  let yaw = 0;
  let pitch = 0;
  let yawVelocity = 0;
  let pitchVelocity = 0;
  let zoom = 1;
  let zoomVelocity = 0;
  let spin = 0;
  let target: { yaw: number; pitch: number; passing: boolean } | null = null;

  let finished: boolean[] = graph.titles.map(() => false);
  let next: number | null = 0;
  let nextLabel = "Start here";
  let selected: number | null = null;
  let selectedPart: number | null = null;
  let preview: number | null = null;
  let active: number | null = null;
  let hovered: number | null = null;
  let hoveredPart: number | null = null;
  let hold = false;
  let resting = false;
  let frozen = false;
  let rimNames: { part: number; radius: number; angle: number; half: number }[] = [];
  let order: number[] | null = null;
  let threadPoints: Float32Array | null = null;
  let threadX = new Float32Array(0);
  let threadY = new Float32Array(0);
  let threadDepth = new Float32Array(0);
  let threadDrawn = 1;
  let threadGlint = 0;

  let signalStart = -1;
  let signalHops: number[] = [];
  let signalReach = 1;
  let pulseClock = 0;
  let clock = 0;

  type Drag = { id: number; touch: boolean; startX: number; startY: number; x: number; y: number; moved: boolean; pressed: number; pressedPart: number; samples: { t: number; x: number; y: number }[] };
  let drag: Drag | null = null;
  let pointer: { x: number; y: number } | null = null;

  let onScreen = false;
  let introduced = false;
  let frame = 0;
  let lastTick = 0;
  let lastDraw = 0;
  let lastActivity = performance.now();
  let destroyed = false;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const moreContrast = window.matchMedia("(prefers-contrast: more)");
  let still = motion.matches;
  const idleFrame = window.matchMedia("(pointer: coarse)").matches ? TOUCH_IDLE_FRAME : IDLE_FRAME;

  function readTheme() {
    const styles = getComputedStyle(canvas);
    const dark = scheme.matches;
    theme = {
      ink: cssColor(styles, "--ink", dark ? "#f5f5f5" : "#171717"),
      muted: cssColor(styles, "--muted", dark ? "#b5b5b5" : "#595959"),
      canvas: cssColor(styles, "--canvas", dark ? "#0b0b0b" : "#fafafa"),
      dark,
      halo: dark ? makeHalo() : null,
    };
    fontFamily = styles.fontFamily || fontFamily;
  }

  function measure() {
    // Layout size rather than the on-screen box, so an entrance or scroll effect that scales the orb can't lower its resolution.
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    radius = Math.min(width, height) * ORB_RADIUS;
    labelSize = options.navigation ? (width < 480 ? 12 : 14) : width < 480 ? 11 : 12;
  }

  function turn() {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const centerX = width / 2;
    const centerY = height / 2;
    const reach = FIT * radius * zoom;
    const place = (source: Float32Array, index: number, outX: Float32Array, outY: Float32Array, outDepth: Float32Array) => {
      const x = source[index * 3];
      const y = source[index * 3 + 1];
      const z = source[index * 3 + 2];
      const flat = -x * sinYaw + z * cosYaw;
      const turnedX = x * cosYaw + z * sinYaw;
      const turnedY = y * cosPitch - flat * sinPitch;
      const turnedZ = y * sinPitch + flat * cosPitch;
      const perspective = (CAMERA / (CAMERA - turnedZ)) * reach;
      outX[index] = centerX + turnedX * perspective;
      outY[index] = centerY - turnedY * perspective;
      outDepth[index] = nearness(turnedZ);
    };
    for (let lesson = 0; lesson < count; lesson++) {
      place(base, lesson, screenX, screenY, depths);
      const hit = hitPoints[lesson];
      hit.x = screenX[lesson];
      hit.y = screenY[lesson];
      hit.depth = depths[lesson];
    }
    for (let index = 0; index < arcX.length; index++) place(arcs, index, arcX, arcY, arcDepth);
    for (let index = 0; index < foldX.length; index++) place(folds, index, foldX, foldY, foldDepth);
    if (arbors) {
      for (let index = 0; index < arborX.length; index++) place(arbors.ends, index, arborX, arborY, arborDepth);
      for (let lesson = 0; lesson < count; lesson++) place(apexEnds, lesson, apexX, apexY, apexDepth);
    }
    if (threadPoints) for (let index = 0; index < threadX.length; index++) place(threadPoints, index, threadX, threadY, threadDepth);
  }

  function turnedDirection(point: number[]) {
    const flat = -point[0] * Math.sin(yaw) + point[2] * Math.cos(yaw);
    return {
      x: point[0] * Math.cos(yaw) + point[2] * Math.sin(yaw),
      y: point[1] * Math.cos(pitch) - flat * Math.sin(pitch),
      z: point[1] * Math.sin(pitch) + flat * Math.cos(pitch),
    };
  }

  function faceTo(point: number[], passing: boolean) {
    const facing = faceAngles(point[0], point[1], point[2]);
    const goal = { yaw: nearestAngle(yaw, facing.yaw), pitch: facing.pitch * 0.8, passing };
    if (still) {
      yaw = goal.yaw;
      pitch = goal.pitch;
      yawVelocity = 0;
      pitchVelocity = 0;
      target = null;
    } else {
      target = goal;
    }
  }

  function advance(dt: number) {
    clock += dt;
    if (!drag) {
      if (target) {
        const nextYaw = springStep(yaw, yawVelocity, target.yaw, TURN_RESPONSE, dt);
        const nextPitch = springStep(pitch, pitchVelocity, target.pitch, TURN_RESPONSE, dt);
        yaw = nextYaw.value;
        pitch = nextPitch.value;
        yawVelocity = nextYaw.velocity;
        pitchVelocity = nextPitch.velocity;
        if (target.passing && Math.abs(yaw - target.yaw) < 0.01 && Math.abs(pitch - target.pitch) < 0.01) {
          target = null;
          spin = 0;
          yawVelocity = 0;
          pitchVelocity = 0;
        }
      } else {
        const wanted = still || hold || hovered !== null || selected !== null || active !== null || selectedPart !== null || preview !== null ? 0 : IDLE_SPIN;
        spin += (wanted - spin) * (1 - Math.exp(-dt / SPIN_EASE));
        const fade = Math.exp(-dt / SPIN_EASE);
        yawVelocity *= fade;
        pitchVelocity *= fade;
        yaw += (spin + yawVelocity) * dt;
        pitch += pitchVelocity * dt;
        if (Math.abs(pitch) > PITCH_LIMIT) {
          const back = springStep(pitch, pitchVelocity, Math.sign(pitch) * PITCH_LIMIT, TURN_RESPONSE * 0.6, dt);
          pitch = back.value;
          pitchVelocity = back.velocity;
        }
      }
    }

    // Where the orb is navigation it sits inside a sphere drawn by the page, which has to stay the same size.
    const wantedZoom = selected !== null && !options.navigation ? (width < 640 ? 1.09 : 1.05) : 1;
    if (still) {
      zoom = wantedZoom;
    } else {
      const nextZoom = springStep(zoom, zoomVelocity, wantedZoom, ZOOM_RESPONSE, dt);
      zoom = nextZoom.value;
      zoomVelocity = nextZoom.velocity;
    }

    const ease = still ? 1 : 1 - Math.exp(-dt / EMPHASIS_EASE);
    const focusChapter = selected ?? preview ?? (hovered !== null ? chapterOf[hovered] : null);
    const browsedPart = focusChapter === null ? selectedPart ?? hoveredPart : null;
    for (let chapter = 0; chapter < chapterCount; chapter++) {
      const wanted = browsedPart !== null ? (graph.chapterParts[chapter] === browsedPart ? 1.2 : 0.35)
        : focusChapter === null ? 1 : chapter === focusChapter ? 1.3 : selected !== null || preview !== null ? 0.3 : 0.6;
      emphasis[chapter] += (wanted - emphasis[chapter]) * ease;
    }
    const lit = active ?? hovered;
    for (let link = 0; link < linkCount; link++) {
      const from = graph.links[link * 2];
      const to = graph.links[link * 2 + 1];
      const wanted = from === lit || to === lit ? 1 : selected !== null && (chapterOf[from] === selected || chapterOf[to] === selected) ? 0.5 : 0;
      linkBoost[link] += (wanted - linkBoost[link]) * ease;
    }
    for (let lesson = 0; lesson < count; lesson++) glow[lesson] *= still ? 0 : Math.exp(-dt / 0.3);

    // The neurons grow out of the poster's dots once, a chapter at a time. A cell stains in full when its lesson is
    // finished or looked at, and about one in five is stained from the start, the way Golgi's stain takes.
    if ((introduced || still) && arbors) grown = still ? 1 : Math.min(1, grown + dt / GROW);
    const stainEase = still ? 1 : 1 - Math.exp(-dt / STAIN_EASE);
    const flashFade = still ? 0 : Math.exp(-dt / FLASH_DECAY);
    staining = false;
    for (let lesson = 0; lesson < count; lesson++) {
      const looked = lesson === hovered || lesson === active || (focusChapter !== null && chapterOf[lesson] === focusChapter);
      const done = finished[lesson];
      const wantReach = done || looked || firstStain[lesson] ? 1 : 0;
      const wantInk = done ? 1 : looked ? 0.92 : firstStain[lesson] ? 0.6 : 0;
      reach[lesson] += (wantReach - reach[lesson]) * stainEase;
      ink[lesson] += (wantInk - ink[lesson]) * stainEase;
      if (Math.abs(wantReach - reach[lesson]) > 0.01 || Math.abs(wantInk - ink[lesson]) > 0.01) staining = true;
      flash[lesson] *= flashFade;
    }
    // Now and then a cell lights up on its own, the way a few always are in living tissue.
    if (!still && Math.random() < FLASHES * dt) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const lesson = Math.floor(Math.random() * count);
        if (depths[lesson] > 0.5) { flash[lesson] = 1; break; }
      }
    }

    if (signalStart >= 0) {
      const elapsed = clock - signalStart;
      for (let lesson = 0; lesson < count; lesson++) {
        const away = (elapsed - signalHops[lesson] * SIGNAL_HOP) / SIGNAL_WIDTH;
        signal[lesson] = away < -3 || away > 3 ? 0 : Math.exp(-away * away);
      }
      if (elapsed > signalReach * SIGNAL_HOP + SIGNAL_WIDTH * 3) {
        signalStart = -1;
        signal.fill(0);
      }
    }

    if (threadDrawn < 1) threadDrawn = still ? 1 : Math.min(1, threadDrawn + dt / 1.8);
    if (!still) threadGlint = (threadGlint + dt / 26) % 1;

    for (let index = pulses.length - 1; index >= 0; index--) {
      const pulse = pulses[index];
      pulse.age += dt / PULSE_LENGTH;
      // The cell it reaches lights up, and the signal's tail runs on into it before it's gone.
      if (pulse.age >= 1 && !pulse.landed) {
        pulse.landed = true;
        flash[graph.links[pulse.link * 2 + (pulse.forward ? 1 : 0)]] = 1;
      }
      if (pulse.age >= 1.3) pulses.splice(index, 1);
    }
    if (!still && linkCount > 0 && signalStart < 0) {
      pulseClock += dt;
      if (pulseClock > PULSE_EVERY && pulses.length < 4) {
        pulseClock = 0;
        const link = Math.floor(Math.random() * linkCount);
        const fromLit = next !== null && (graph.links[link * 2] === next || finished[graph.links[link * 2]]);
        pulses.push({ link, age: 0, forward: fromLit || Math.random() < 0.5, landed: false });
      }
    }
  }

  /** A goal draws the route still ahead, along each chapter's folds and across the orb between chapters. */
  function buildThread() {
    const lessons = order ? routeAhead(graph, order, finished, next) : [];
    if (lessons.length < 2) {
      threadPoints = null;
      return;
    }
    const points: number[] = [...position(lessons[0])];
    for (let index = 1; index < lessons.length; index++) {
      const lesson = lessons[index - 1];
      const to = lessons[index];
      if (to === lesson + 1 && chapterOf[lesson] === chapterOf[to]) {
        for (let step = 1; step <= FOLD_STEPS; step++) {
          const at = (lesson * (FOLD_STEPS + 1) + step) * 3;
          points.push(folds[at], folds[at + 1], folds[at + 2]);
        }
      } else {
        const from = position(lesson);
        const end = position(to);
        const control = arcControl(from, end);
        for (let step = 1; step <= ARC_STEPS; step++) points.push(...arcPoint(from, control, end, step / ARC_STEPS));
      }
    }
    threadPoints = Float32Array.from(points);
    threadX = new Float32Array(points.length / 3);
    threadY = new Float32Array(points.length / 3);
    threadDepth = new Float32Array(points.length / 3);
  }

  function bucket(store: number[][], alpha: number, x1: number, y1: number, x2: number, y2: number) {
    const step = Math.round(Math.min(1, alpha) * ALPHA_STEPS);
    if (step > 0) store[step].push(x1, y1, x2, y2);
  }

  function strokeBuckets(store: number[][], lineWidth: number) {
    ctx.lineWidth = lineWidth;
    // Thin light lines on black read weaker than thin dark lines on white.
    const lift = (theme.dark ? 1.22 : 1) * (moreContrast.matches ? 1.6 : 1);
    for (let step = 1; step <= ALPHA_STEPS; step++) {
      const segments = store[step];
      if (!segments.length) continue;
      ctx.globalAlpha = Math.min(1, (step / ALPHA_STEPS) * lift);
      ctx.beginPath();
      for (let index = 0; index < segments.length; index += 4) {
        ctx.moveTo(segments[index], segments[index + 1]);
        ctx.lineTo(segments[index + 2], segments[index + 3]);
      }
      ctx.stroke();
      segments.length = 0;
    }
  }

  function drawLines() {
    ctx.strokeStyle = theme.ink;
    ctx.lineCap = "round";
    const hairline = Math.max(0.7, radius / 300);
    const threadActive = threadPoints !== null;

    for (let link = 0; link < linkCount; link++) {
      const start = link * (ARC_STEPS + 1);
      const from = graph.links[link * 2];
      const to = graph.links[link * 2 + 1];
      const mood = Math.max(emphasis[chapterOf[from]], emphasis[chapterOf[to]]) * (threadActive ? 0.55 : 1);
      const fired = Math.max(signal[from], signal[to]);
      const boost = linkBoost[link];
      for (let step = 0; step < ARC_STEPS; step++) {
        const a = start + step;
        const b = a + 1;
        const depth = (arcDepth[a] + arcDepth[b]) / 2;
        const alpha = lineAlpha(depth, RELATED_LINE * Math.min(1, mood) + boost * 0.7 + fired * 0.32);
        bucket(boost > 0.3 ? strong : faint, alpha, arcX[a], arcY[a], arcX[b], arcY[b]);
      }
    }

    for (let chapter = 0; chapter < chapterCount; chapter++) {
      for (let lesson = graph.chapterStarts[chapter]; lesson < graph.chapterStarts[chapter + 1] - 1; lesson++) {
        const after = lesson + 1;
        const walked = finished[lesson] && finished[after];
        const strength = CHAPTER_LINE * (walked ? 1.9 : 1) * emphasis[chapter] + Math.max(signal[lesson], signal[after]) * 0.5;
        const store = walked || emphasis[chapter] > 1.1 ? strong : folded;
        for (let step = 0; step < FOLD_STEPS; step++) {
          const a = lesson * (FOLD_STEPS + 1) + step;
          bucket(store, lineAlpha((foldDepth[a] + foldDepth[a + 1]) / 2, strength), foldX[a], foldY[a], foldX[a + 1], foldY[a + 1]);
        }
      }
    }
    strokeBuckets(faint, hairline);
    strokeBuckets(folded, hairline * 1.35);
    strokeBuckets(strong, hairline * 1.9);

    if (threadPoints) {
      const last = threadX.length - 1;
      const reached = threadDrawn * last;
      for (let index = 0; index < last && index < reached; index++) {
        const along = index / last;
        const depth = (threadDepth[index] + threadDepth[index + 1]) / 2;
        bucket(strong, lineAlpha(depth, 1 - along * 0.72), threadX[index], threadY[index], threadX[index + 1], threadY[index + 1]);
      }
      strokeBuckets(strong, hairline * 1.7);
    }
  }

  /** How far a neuron has grown out of its dot, 0 to 1. */
  const growthOf = (lesson: number) => Math.min(1, Math.max(0, grown * 1.55 - growDelay[lesson]));

  function strokeStore(store: number[][], widths: number[], color: string, lift: number) {
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    for (let size = 0; size < widths.length; size++) {
      ctx.lineWidth = widths[size];
      for (let step = 1; step <= ALPHA_STEPS; step++) {
        const segments = store[size * (ALPHA_STEPS + 1) + step];
        if (!segments.length) continue;
        ctx.globalAlpha = Math.min(1, (step / ALPHA_STEPS) * lift);
        ctx.beginPath();
        for (let index = 0; index < segments.length; index += 4) {
          ctx.moveTo(segments[index], segments[index + 1]);
          ctx.lineTo(segments[index + 2], segments[index + 3]);
        }
        ctx.stroke();
        segments.length = 0;
      }
    }
  }

  /** The dendrites, grown as far as each cell has, and as deeply stained. Behind, they're wider and fainter. */
  function drawArbors() {
    if (!arbors || lean) return;
    const hair = Math.max(0.7, radius / 300) * zoom;
    for (let lesson = 0; lesson < count; lesson++) {
      const grownNow = growthOf(lesson);
      if (grownNow <= 0) continue;
      const stained = reach[lesson];
      const mood = Math.min(1.2, emphasis[chapterOf[lesson]]);
      const lit = Math.max(flash[lesson], signal[lesson], glow[lesson]);
      for (let index = arbors.starts[lesson]; index < arbors.starts[lesson + 1]; index++) {
        const stub = arbors.stub[index] === 1;
        const out = Math.min(grownNow, Math.max(stained, stub ? arbors.to[index] * STUB_REACH : 0));
        const start = arbors.from[index];
        if (out <= start + 1e-4) continue;
        const share = Math.min(1, (out - start) / Math.max(1e-4, arbors.to[index] - start));
        const strength = Math.max(ink[lesson], stub ? STUB_INK : 0) * mood + lit * 0.45 * Math.max(stained, 0.3);
        const a = index * 2;
        const { alpha, width } = strokeOf((arborDepth[a] + arborDepth[a + 1]) / 2, arbors.rank[index], strength, hair);
        const step = Math.round(Math.min(1, alpha) * ALPHA_STEPS);
        if (!step) continue;
        let size = 0;
        while (size < WIDTHS.length - 1 && WIDTHS[size] < width * 0.92) size++;
        arborStore[size * (ALPHA_STEPS + 1) + step].push(arborX[a], arborY[a], arborX[a] + (arborX[a + 1] - arborX[a]) * share, arborY[a] + (arborY[a + 1] - arborY[a]) * share);
      }
    }
    strokeStore(arborStore, WIDTHS, theme.ink, (theme.dark ? 1.15 : 1) * (moreContrast.matches ? 1.5 : 1));
  }

  /** The beads on the axons, where they make contact, on the near side only. */
  function drawBeads() {
    if (!arbors || lean) return;
    const hair = Math.max(0.7, radius / 300);
    const threadActive = threadPoints !== null;
    for (let link = 0; link < linkCount; link++) {
      const from = graph.links[link * 2];
      const to = graph.links[link * 2 + 1];
      const mood = Math.max(emphasis[chapterOf[from]], emphasis[chapterOf[to]]) * (threadActive ? 0.55 : 1);
      const strength = RELATED_LINE * 2.2 * Math.min(1, mood) + linkBoost[link] * 0.8;
      for (let bead = 0; bead < BEADS_PER_LINK; bead++) {
        const along = arbors.beads[link * BEADS_PER_LINK + bead] * ARC_STEPS;
        const step = Math.min(ARC_STEPS - 1, Math.floor(along));
        const mix = along - step;
        const a = link * (ARC_STEPS + 1) + step;
        const depth = arcDepth[a] + (arcDepth[a + 1] - arcDepth[a]) * mix;
        if (depth < 0.45) continue;
        const alpha = Math.round(Math.min(1, lineAlpha(depth, strength)) * ALPHA_STEPS);
        if (!alpha) continue;
        const size = hair * (1.1 + 0.9 * depth) * zoom;
        beadStore[alpha].push(arcX[a] + (arcX[a + 1] - arcX[a]) * mix, arcY[a] + (arcY[a + 1] - arcY[a]) * mix, size);
      }
    }
    ctx.fillStyle = theme.ink;
    for (let step = 1; step <= ALPHA_STEPS; step++) {
      const beads = beadStore[step];
      if (!beads.length) continue;
      ctx.globalAlpha = step / ALPHA_STEPS;
      ctx.beginPath();
      for (let index = 0; index < beads.length; index += 3) {
        ctx.moveTo(beads[index] + beads[index + 2] / 2, beads[index + 1]);
        ctx.arc(beads[index], beads[index + 1], beads[index + 2] / 2, 0, Math.PI * 2);
      }
      ctx.fill();
      beads.length = 0;
    }
  }

  /**
   * Signals light the axon itself rather than sliding a dot along it: a short bright front with a tail, jumping
   * between nodes on the way the way a myelinated axon carries it, and the cell it reaches lights up.
   */
  function drawSignals() {
    const hair = Math.max(0.7, radius / 300) * zoom;
    for (const pulse of pulses) {
      const head = pulse.age;
      const start = pulse.link * (ARC_STEPS + 1);
      for (let step = 0; step < ARC_STEPS; step++) {
        const along = pulse.forward ? (step + 0.5) / ARC_STEPS : 1 - (step + 0.5) / ARC_STEPS;
        const behind = head - along;
        if (behind < -0.05 || behind > 0.45) continue;
        const strength = behind < 0 ? (1 + behind / 0.05) * 0.25 : Math.exp(-behind / 0.12);
        const a = start + step;
        const level = Math.round(Math.min(1, strength * (0.2 + 0.8 * (arcDepth[a] + arcDepth[a + 1]) / 2)) * ALPHA_STEPS);
        if (level) glowStore[level].push(arcX[a], arcY[a], arcX[a + 1], arcY[a + 1]);
      }
      for (let node = 0; node < NODES; node++) {
        const along = (node + 0.5) / NODES;
        const gap = (head - along) / 0.05;
        const lit = gap < -1 ? 0 : gap < 0 ? 1 + gap : Math.exp(-gap * 0.5);
        if (lit < 0.04) continue;
        const place = (pulse.forward ? along : 1 - along) * ARC_STEPS;
        const step = Math.min(ARC_STEPS - 1, Math.floor(place));
        const mix = place - step;
        const a = start + step;
        const depth = arcDepth[a] + (arcDepth[a + 1] - arcDepth[a]) * mix;
        const level = Math.round(Math.min(1, lit * (0.25 + 0.75 * depth)) * ALPHA_STEPS);
        if (level) sparkStore[level].push(arcX[a] + (arcX[a + 1] - arcX[a]) * mix, arcY[a] + (arcY[a + 1] - arcY[a]) * mix, hair * (1.3 + depth));
      }
    }
    // In the dark the signal is light, and adds up where it crosses; on paper it's ink.
    if (theme.dark) ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = theme.ink;
    ctx.lineCap = "round";
    ctx.lineWidth = hair * 1.7;
    for (let step = 1; step <= ALPHA_STEPS; step++) {
      const segments = glowStore[step];
      if (!segments.length) continue;
      ctx.globalAlpha = step / ALPHA_STEPS;
      ctx.beginPath();
      for (let index = 0; index < segments.length; index += 4) {
        ctx.moveTo(segments[index], segments[index + 1]);
        ctx.lineTo(segments[index + 2], segments[index + 3]);
      }
      ctx.stroke();
      segments.length = 0;
    }
    ctx.fillStyle = theme.ink;
    for (let step = 1; step <= ALPHA_STEPS; step++) {
      const sparks = sparkStore[step];
      if (!sparks.length) continue;
      ctx.globalAlpha = step / ALPHA_STEPS;
      ctx.beginPath();
      for (let index = 0; index < sparks.length; index += 3) {
        ctx.moveTo(sparks[index] + sparks[index + 2], sparks[index + 1]);
        ctx.arc(sparks[index], sparks[index + 1], sparks[index + 2], 0, Math.PI * 2);
      }
      ctx.fill();
      sparks.length = 0;
    }
    ctx.globalCompositeOperation = "source-over";
    if (threadPoints && threadDrawn >= 1 && !still) {
      const size = Math.max(1.2, radius * 0.0065);
      const last = threadX.length - 1;
      const along = threadGlint * last;
      const step = Math.min(last - 1, Math.floor(along));
      const mix = along - step;
      ctx.globalAlpha = 0.3 + 0.7 * threadDepth[step];
      ctx.beginPath();
      ctx.arc(threadX[step] + (threadX[step + 1] - threadX[step]) * mix, threadY[step] + (threadY[step + 1] - threadY[step]) * mix, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDots() {
    for (let index = 1; index < drawOrder.length; index++) {
      const lesson = drawOrder[index];
      let place = index - 1;
      while (place >= 0 && depths[drawOrder[place]] > depths[lesson]) {
        drawOrder[place + 1] = drawOrder[place];
        place--;
      }
      drawOrder[place + 1] = lesson;
    }
    ctx.fillStyle = theme.ink;
    const unit = FIT * radius * zoom;
    for (const lesson of drawOrder) {
      const depth = depths[lesson];
      const done = finished[lesson];
      const mood = emphasis[chapterOf[lesson]];
      const fired = Math.max(signal[lesson], glow[lesson], flash[lesson] * 0.8);
      const size = dotRadius(depth, degrees[lesson], done, radius) * zoom * (0.82 + 0.18 * mood) * (1 + fired * 0.7);
      const alpha = Math.min(1, dotAlpha(depth, done) * (mood > 1 ? 1 + (mood - 1) * 1.6 : mood) * (moreContrast.matches ? 1.5 : 1) + fired * 0.8);
      if (theme.halo && (done || fired > 0.05)) {
        ctx.globalAlpha = Math.min(1, alpha * (done ? 0.8 : 0) + fired * 0.9);
        const span = size * (6 + fired * 4);
        ctx.drawImage(theme.halo, screenX[lesson] - span / 2, screenY[lesson] - span / 2, span, span);
      }
      // A cell body points along its apical dendrite, as far as it shows from here and as far as it has grown.
      const ux = apexX[lesson] - screenX[lesson];
      const uy = apexY[lesson] - screenY[lesson];
      const length = Math.hypot(ux, uy);
      const turned = depth * 2 - 1;
      const side = Math.min(1, length / (0.05 * unit * (CAMERA / (CAMERA - turned))));
      const tip = arbors ? size * growthOf(lesson) * (lean ? 0.45 : 0.45 + 0.75 * reach[lesson]) * side : 0;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      somaPath(ctx, screenX[lesson], screenY[lesson], size, length ? ux / length : 0, length ? uy / length : -1, tip);
      ctx.fill();
    }
  }

  function drawRing(lesson: number, gap: number, width: number, alpha: number) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(screenX[lesson], screenY[lesson], dotRadius(depths[lesson], degrees[lesson], true, radius) * zoom + gap, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawMarkers() {
    ctx.strokeStyle = theme.ink;
    ctx.fillStyle = theme.ink;
    if (next !== null) {
      const depth = depths[next];
      const presence = 0.35 + 0.65 * depth;
      ctx.globalAlpha = presence;
      ctx.beginPath();
      ctx.arc(screenX[next], screenY[next], dotRadius(depth, degrees[next], true, radius) * zoom * 1.15, 0, Math.PI * 2);
      ctx.fill();
      drawRing(next, 5, 1.25, presence);
      if (!still) {
        const phase = (clock * 0.42) % 1;
        drawRing(next, 5 + phase * 22, 1, presence * (1 - phase) * 0.7);
      }
    }
    if (active !== null && active !== next) drawRing(active, 4, 1.5, 0.5 + 0.5 * depths[active]);
  }

  function drawNextLabel() {
    if (next === null || active === next) return;
    const depth = depths[next];
    const alpha = Math.min(1, Math.max(0, (depth - 0.42) / 0.16));
    if (alpha <= 0) return;
    const size = dotRadius(depth, degrees[next], true, radius) * zoom;
    const onRight = screenX[next] < width * 0.62;
    const x = screenX[next] + (onRight ? size + 13 : -size - 13);
    const y = screenY[next];
    ctx.font = `680 ${labelSize + 1}px ${fontFamily}`;
    ctx.textAlign = onRight ? "left" : "right";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 5;
    ctx.strokeStyle = theme.canvas;
    ctx.strokeText(nextLabel, x, y);
    ctx.fillStyle = theme.ink;
    ctx.fillText(nextLabel, x, y);
  }

  /** The part names run around the rim like the lettering on an engraved globe, only for lobes facing the viewer. */
  function drawPartNames() {
    const rim = Math.min(radius * zoom * 1.035 + 7, Math.min(width, height) / 2 - labelSize - 2);
    ctx.font = `600 ${labelSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const centerX = width / 2;
    const centerY = height / 2;
    const litPart = hoveredPart ?? (selected !== null ? graph.chapterParts[selected] : selectedPart);
    const shown = graph.partTitles.flatMap((title, part) => {
      const turned = turnedDirection(partCenters[part]);
      const facing = Math.min(1, Math.max(0, (turned.z + 0.25) / 0.4));
      if (facing <= 0.01) return [];
      // Lettering stays on the top or bottom of the rim, where it can be read, even for a lobe near the equator.
      const below = turned.y < 0;
      const steep = Math.PI / 7;
      const across = Math.atan2(Math.abs(turned.y), turned.x);
      const held = Math.min(Math.PI - steep, Math.max(steep, across));
      const letters = [...title];
      const gaps = letters.map((letter) => ctx.measureText(letter).width + 0.5);
      const total = gaps.reduce((sum, gap) => sum + gap, 0);
      const ring = below ? rim + labelSize * 0.8 : rim;
      return [{ part, below, letters, gaps, total, ring, facing, angle: below ? held : -held, half: total / 2 / ring, depth: turned.z }];
    });
    const fades = rimNameFades(shown, NAME_GAP);
    rimNames = shown.flatMap(({ part, below, ring, angle, half }, index) => (fades[index] * shown[index].facing > 0.5 ? [{ part, radius: below ? ring - labelSize * 0.4 : ring + labelSize * 0.4, angle, half }] : []));
    shown.forEach(({ part, below, letters, gaps, total, ring, facing, angle }, index) => {
      if (fades[index] <= 0.01) return;
      ctx.globalAlpha = facing * fades[index];
      ctx.fillStyle = litPart === part ? theme.ink : theme.muted;
      let travel = -total / 2;
      letters.forEach((letter, letterIndex) => {
        const middle = travel + gaps[letterIndex] / 2;
        const theta = below ? angle - middle / ring : angle + middle / ring;
        ctx.save();
        ctx.translate(centerX + Math.cos(theta) * ring, centerY + Math.sin(theta) * ring);
        ctx.rotate(below ? theta - Math.PI / 2 : theta + Math.PI / 2);
        ctx.fillText(letter, 0, 0);
        ctx.restore();
        travel += gaps[letterIndex];
      });
    });
  }

  /** The part whose name on the rim is under a point, or -1. */
  function partAt(x: number, y: number, reach: number) {
    if (!options.navigation) return -1;
    const from = Math.hypot(x - width / 2, y - height / 2);
    const at = Math.atan2(y - height / 2, x - width / 2);
    for (const name of rimNames) {
      const apart = Math.abs(Math.atan2(Math.sin(at - name.angle), Math.cos(at - name.angle)));
      if (Math.abs(from - name.radius) <= reach && apart <= name.half + 0.03) return name.part;
    }
    return -1;
  }

  function placeTooltip() {
    if (!tooltip) return;
    if (active === null && hovered === null) return;
    const lesson = active ?? hovered;
    if (lesson === null) return;
    // A lesson turned behind the orb has nothing on screen to label.
    tooltip.style.opacity = depths[lesson] < 0.32 ? "0" : "";
    tooltip.style.pointerEvents = depths[lesson] < 0.32 ? "none" : "";
    const boxWidth = tooltip.offsetWidth;
    const boxHeight = tooltip.offsetHeight;
    const reach = dotRadius(depths[lesson], degrees[lesson], true, radius) * zoom + 12;
    const above = screenY[lesson] - reach - boxHeight;
    const y = above > 4 ? above : screenY[lesson] + reach;
    const x = Math.max(4, Math.min(width - boxWidth - 4, screenX[lesson] - boxWidth / 2));
    tooltip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  /** A faint rim of shade, the only thing drawn that isn't course data, so the dots read as lying on a sphere. */
  function drawBody() {
    const reach = radius * zoom * 1.015;
    const shade = ctx.createRadialGradient(width / 2, height / 2, reach * 0.6, width / 2, height / 2, reach);
    shade.addColorStop(0, "rgb(128 128 128 / 0%)");
    shade.addColorStop(0.86, theme.dark ? "rgb(255 255 255 / 3.2%)" : "rgb(0 0 0 / 2.6%)");
    shade.addColorStop(0.985, theme.dark ? "rgb(255 255 255 / 7%)" : "rgb(0 0 0 / 5.5%)");
    shade.addColorStop(1, theme.dark ? "rgb(255 255 255 / 0%)" : "rgb(0 0 0 / 0%)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, reach, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    if (!width || !height) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    turn();
    drawBody();
    drawLines();
    drawBeads();
    drawArbors();
    drawSignals();
    drawDots();
    drawMarkers();
    drawPartNames();
    if (!options.navigation) drawNextLabel();
    ctx.globalAlpha = 1;
    placeTooltip();
  }

  function updateHover() {
    if (!pointer || drag?.moved) return;
    const reach = Math.max(10, radius * 0.045);
    const part = partAt(pointer.x, pointer.y, 14);
    const found = part >= 0 ? -1 : hitLesson(hitPoints, pointer.x, pointer.y, reach);
    const lesson = found < 0 ? null : found;
    hoveredPart = part >= 0 ? part : null;
    if (lesson !== hovered) {
      hovered = lesson;
      events.onHover(lesson);
    }
    canvas.style.cursor = lesson !== null || part >= 0 ? "pointer" : "";
  }

  function tick(now: number) {
    frame = 0;
    if (destroyed || !onScreen || resting || frozen || document.visibilityState === "hidden") return;
    const busy = Boolean(drag) || signalStart >= 0 || threadDrawn < 1 || Boolean(target) || Math.abs(yawVelocity) + Math.abs(pitchVelocity) > 0.01 || Math.abs(zoomVelocity) > 0.001
      || (introduced && arbors !== null && grown < 1) || staining;
    if (!busy && !still && now - lastActivity > IDLE_LIMIT) return;
    if (!busy && !still && now - lastDraw < idleFrame) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const gap = lastTick ? now - lastTick : 0;
    const dt = Math.min(0.05, gap ? gap / 1000 : 1 / 60);
    // A device that can't keep up with the neurons, drawing them on the processor or on a slow graphics chip, goes
    // back to the plain cell bodies rather than stutter: judged from frames that should come every 16 ms, after load.
    if (busy && gap && !lean && now - born > 3000) {
      slowness += (gap - slowness) * 0.15;
      if (slowness > 55 && ++slowFrames > 12) lean = true;
    }
    lastTick = now;
    lastDraw = now;
    try {
      const started = performance.now();
      advance(dt);
      updateHover();
      draw();
      if (!lean && performance.now() - started > 14 && ++heavyFrames > 8) lean = true;
    } catch {
      destroyed = true;
      events.onFail();
      return;
    }
    if (!still || drag) frame = requestAnimationFrame(tick);
  }

  function wake() {
    lastActivity = performance.now();
    if (!frame && !destroyed && onScreen && !resting && !frozen && document.visibilityState !== "hidden") {
      lastTick = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  function startSignal(lesson: number) {
    if (still) return;
    signalHops = hopsFrom(graph, lesson);
    signalReach = Math.max(...signalHops.filter(Number.isFinite));
    signalStart = clock;
    wake();
  }

  function pointerPlace(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const place = pointerPlace(event);
    const touch = event.pointerType !== "mouse";
    const pressedPart = partAt(place.x, place.y, touch ? 22 : 14);
    const pressed = pressedPart >= 0 ? -1 : hitLesson(hitPoints, place.x, place.y, touch ? Math.max(26, radius * 0.16) : Math.max(10, radius * 0.045));
    drag = { id: event.pointerId, touch, startX: place.x, startY: place.y, x: place.x, y: place.y, moved: false, pressed, pressedPart, samples: [{ t: event.timeStamp, ...place }] };
    if (!still && pressed >= 0) glow[pressed] = 1;
    canvas.setPointerCapture(event.pointerId);
    wake();
  }

  function onPointerMove(event: PointerEvent) {
    const place = pointerPlace(event);
    if (event.pointerType === "mouse") pointer = place;
    if (!drag || drag.id !== event.pointerId) {
      wake();
      return;
    }
    if (!drag.moved && Math.hypot(place.x - drag.startX, place.y - drag.startY) > (drag.touch ? 10 : 5)) {
      drag.moved = true;
      target = null;
      yawVelocity = 0;
      pitchVelocity = 0;
      spin = 0;
      canvas.style.cursor = "grabbing";
      if (hovered !== null) { hovered = null; events.onHover(null); }
    }
    if (drag.moved) {
      const reach = Math.max(1, radius * zoom);
      yaw += (place.x - drag.x) / reach;
      if (!drag.touch) pitch = rubberBand(pitch + (place.y - drag.y) / reach, PITCH_LIMIT);
      drag.samples.push({ t: event.timeStamp, ...place });
      if (drag.samples.length > 6) drag.samples.shift();
    }
    drag.x = place.x;
    drag.y = place.y;
  }

  function onPointerUp(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    const ended = drag;
    drag = null;
    canvas.style.cursor = "";
    if (ended.moved) {
      const first = ended.samples.find((sample) => event.timeStamp - sample.t < 120) ?? ended.samples[0];
      const span = Math.max(16, event.timeStamp - first.t) / 1000;
      const reach = Math.max(1, radius * zoom);
      if (!still) {
        yawVelocity = Math.max(-5, Math.min(5, (ended.x - first.x) / span / reach));
        pitchVelocity = ended.touch ? 0 : Math.max(-4, Math.min(4, (ended.y - first.y) / span / reach));
      }
    } else if (ended.pressedPart >= 0) {
      events.onPart?.(ended.pressedPart);
    } else if (ended.touch) {
      const inOrb = Math.hypot(ended.x - width / 2, ended.y - height / 2) < radius * zoom * 1.05;
      events.onTap(ended.pressed >= 0 ? ended.pressed : inOrb ? hitLesson(hitPoints, ended.x, ended.y, radius * 2) : null);
    } else if (ended.pressed >= 0) {
      events.onOpen(ended.pressed, event.metaKey || event.ctrlKey);
    } else {
      events.onTap(null);
    }
    wake();
  }

  function onPointerCancel(event: PointerEvent) {
    if (drag?.id === event.pointerId) drag = null;
    canvas.style.cursor = "";
    wake();
  }

  function onPointerLeave() {
    pointer = null;
    hoveredPart = null;
    if (hovered !== null && !drag) {
      hovered = null;
      events.onHover(null);
      canvas.style.cursor = "";
      wake();
    }
  }

  function onAuxClick(event: MouseEvent) {
    if (event.button !== 1) return;
    const box = canvas.getBoundingClientRect();
    const lesson = hitLesson(hitPoints, event.clientX - box.left, event.clientY - box.top, Math.max(10, radius * 0.045));
    if (lesson >= 0) {
      event.preventDefault();
      events.onOpen(lesson, true);
    }
  }

  const onVisibility = () => wake();
  const onSchemeChange = () => { readTheme(); wake(); };
  const onMotionChange = () => {
    still = motion.matches;
    pulses.length = 0;
    if (still) {
      signalStart = -1;
      signal.fill(0);
      threadDrawn = 1;
      target = null;
    }
    wake();
  };

  const resizer = new ResizeObserver(() => { measure(); turn(); draw(); });
  const watcher = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    onScreen = entry.isIntersecting;
    if (onScreen) {
      if (!introduced && entry.intersectionRatio >= 0.2) {
        introduced = true;
        if (next !== null) {
          const point = position(next);
          if (next !== 0) faceTo(point, true);
          startSignal(next);
        }
      }
      wake();
    }
  }, { threshold: [0, 0.2], rootMargin: "120px 0px" });

  readTheme();
  measure();
  turn();
  draw();

  function makeArbors() {
    pending = 0;
    if (destroyed) return;
    arbors = arborsFor(graph.positions, degrees, graph.links);
    arborX = new Float32Array(arbors.owner.length * 2);
    arborY = new Float32Array(arbors.owner.length * 2);
    arborDepth = new Float32Array(arbors.owner.length * 2);
    for (let lesson = 0; lesson < count; lesson++) {
      for (let axis = 0; axis < 3; axis++) apexEnds[lesson * 3 + axis] = base[lesson * 3 + axis] + arbors.apex[lesson * 3 + axis] * 0.05;
    }
    wake();
  }
  const idles = "requestIdleCallback" in window;
  let pending = idles ? window.requestIdleCallback(makeArbors, { timeout: 1500 }) : window.setTimeout(makeArbors, 200);

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("auxclick", onAuxClick);
  document.addEventListener("visibilitychange", onVisibility);
  scheme.addEventListener("change", onSchemeChange);
  motion.addEventListener("change", onMotionChange);
  resizer.observe(canvas);
  watcher.observe(canvas);

  return {
    setProgress(nextFinished, nextLesson, label) {
      finished = nextFinished;
      next = nextLesson;
      nextLabel = label;
      buildThread();
      wake();
    },
    setOrder(nextOrder) {
      order = nextOrder;
      buildThread();
      threadDrawn = still || !threadPoints ? 1 : 0;
      threadGlint = 0;
      wake();
    },
    setFocus(focus) {
      const changedChapter = focus.chapter !== selected;
      const nextPart = focus.part ?? null;
      const nextPreview = focus.preview ?? null;
      const changedPart = nextPart !== selectedPart;
      const changedPreview = nextPreview !== preview;
      selected = focus.chapter;
      selectedPart = nextPart;
      preview = nextPreview;
      active = focus.lesson;
      if (focus.lesson !== null && focus.faceLesson) faceTo(position(focus.lesson), false);
      else if (focus.chapter !== null && changedChapter) faceTo(chapterCenters[focus.chapter], false);
      else if (focus.chapter === null && preview !== null && changedPreview) faceTo(chapterCenters[preview], false);
      else if (focus.chapter === null && selectedPart !== null && (changedPart || changedPreview)) faceTo(partCenters[selectedPart], false);
      else if (focus.chapter === null && focus.lesson === null && selectedPart === null && target && !target.passing) target = null;
      wake();
    },
    setHold(nextHold) {
      hold = nextHold;
      wake();
    },
    setResting(nextResting) {
      resting = nextResting;
      wake();
    },
    setFrozen(nextFrozen) {
      frozen = nextFrozen;
      if (frozen) {
        cancelAnimationFrame(frame);
        frame = 0;
        yawVelocity = 0;
        pitchVelocity = 0;
        target = null;
      }
      wake();
    },
    view: () => ({ yaw, pitch }),
    stains: () => ({ reach: lean ? new Float32Array(count) : Float32Array.from(reach, (value, lesson) => Math.min(value, growthOf(lesson))), ink: lean ? new Float32Array(count) : Float32Array.from(ink) }),
    announce(lesson) {
      faceTo(position(lesson), true);
      startSignal(lesson);
      wake();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      if (idles) window.cancelIdleCallback(pending);
      else window.clearTimeout(pending);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("auxclick", onAuxClick);
      document.removeEventListener("visibilitychange", onVisibility);
      scheme.removeEventListener("change", onSchemeChange);
      motion.removeEventListener("change", onMotionChange);
      resizer.disconnect();
      watcher.disconnect();
    },
  };
}
