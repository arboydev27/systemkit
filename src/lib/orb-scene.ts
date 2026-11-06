import type { OrbGraph } from "./orb-layout";
import { arcPoint, faceAngles, foldPoint, hitLesson, hopsFrom, nearestAngle, routeAhead, rubberBand, springStep, type HitPoint } from "./orb-motion";
import {
  arcControl, CHAPTER_LINE, chapterOfLesson, dotAlpha, dotRadius, foldHandles, foldNeighbors, lineAlpha, linkDegrees, nearness, ORB_RADIUS, RELATED_LINE,
} from "./orb-view";

// The live orb on a 2D canvas: 158 dots and a few hundred line segments don't need a 3D engine, and this
// loads in a few kilobytes where three.js costs about 253. It draws only while on screen, and everything the
// orb does in motion can be grabbed and redirected partway.

const CAMERA = 3.1;
const FIT = Math.sqrt(1 - 1 / (CAMERA * CAMERA));
const ARC_STEPS = 8;
const FOLD_STEPS = 5;
const ALPHA_STEPS = 16;
const IDLE_SPIN = 0.07; // Radians a second: a full turn every minute and a half.
const SPIN_EASE = 0.7;
const PITCH_LIMIT = 1.2;
const TURN_RESPONSE = 0.9;
const ZOOM_RESPONSE = 0.7;
const EMPHASIS_EASE = 0.16;
const IDLE_FRAME = 30; // Slow rotation looks the same at 30 frames a second and costs half the battery.
const SIGNAL_HOP = 0.075;
const SIGNAL_WIDTH = 0.14;
const PULSE_EVERY = 1.3;
const PULSE_LENGTH = 1.7;

export type OrbSceneEvents = {
  onHover: (lesson: number | null) => void;
  /** A touch landed on or near a lesson, or away from the orb. */
  onTap: (lesson: number | null) => void;
  onOpen: (lesson: number, inNewTab: boolean) => void;
  /** The canvas stopped working, so the page should show the list instead. */
  onFail: () => void;
};

export type OrbFocus = { chapter: number | null; lesson: number | null; faceLesson: boolean };

export type OrbScene = {
  setProgress: (finished: boolean[], next: number | null, nextLabel: string) => void;
  setOrder: (order: number[] | null) => void;
  setFocus: (focus: OrbFocus) => void;
  setHold: (hold: boolean) => void;
  /** Turns to a lesson and sends a signal out from it, then goes back to drifting. */
  announce: (lesson: number) => void;
  destroy: () => void;
};

type Theme = { ink: string; muted: string; canvas: string; dark: boolean; halo: HTMLCanvasElement | null };
type Pulse = { link: number; age: number; forward: boolean };

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

export function createOrbScene(canvas: HTMLCanvasElement, graph: OrbGraph, tooltip: HTMLElement | null, events: OrbSceneEvents): OrbScene | null {
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
  let active: number | null = null;
  let hovered: number | null = null;
  let hold = false;
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

  type Drag = { id: number; touch: boolean; startX: number; startY: number; x: number; y: number; moved: boolean; pressed: number; samples: { t: number; x: number; y: number }[] };
  let drag: Drag | null = null;
  let pointer: { x: number; y: number } | null = null;

  let onScreen = false;
  let introduced = false;
  let frame = 0;
  let lastTick = 0;
  let lastDraw = 0;
  let destroyed = false;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const moreContrast = window.matchMedia("(prefers-contrast: more)");
  let still = motion.matches;

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
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    radius = Math.min(width, height) * ORB_RADIUS;
    labelSize = width < 480 ? 11 : 12;
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
        const wanted = still || hold || hovered !== null || selected !== null || active !== null ? 0 : IDLE_SPIN;
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

    const wantedZoom = selected !== null ? (width < 640 ? 1.09 : 1.05) : 1;
    if (still) {
      zoom = wantedZoom;
    } else {
      const nextZoom = springStep(zoom, zoomVelocity, wantedZoom, ZOOM_RESPONSE, dt);
      zoom = nextZoom.value;
      zoomVelocity = nextZoom.velocity;
    }

    const ease = still ? 1 : 1 - Math.exp(-dt / EMPHASIS_EASE);
    const focusChapter = selected ?? (hovered !== null ? chapterOf[hovered] : null);
    for (let chapter = 0; chapter < chapterCount; chapter++) {
      const wanted = focusChapter === null ? 1 : chapter === focusChapter ? 1.3 : selected !== null ? 0.3 : 0.6;
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
      pulses[index].age += dt / PULSE_LENGTH;
      if (pulses[index].age >= 1) pulses.splice(index, 1);
    }
    if (!still && linkCount > 0 && signalStart < 0) {
      pulseClock += dt;
      if (pulseClock > PULSE_EVERY && pulses.length < 4) {
        pulseClock = 0;
        const link = Math.floor(Math.random() * linkCount);
        const fromLit = next !== null && (graph.links[link * 2] === next || finished[graph.links[link * 2]]);
        pulses.push({ link, age: 0, forward: fromLit || Math.random() < 0.5 });
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

  function drawPulses() {
    ctx.fillStyle = theme.ink;
    const size = Math.max(1.2, radius * 0.0065);
    for (const pulse of pulses) {
      const along = (pulse.forward ? pulse.age : 1 - pulse.age) * ARC_STEPS;
      const step = Math.min(ARC_STEPS - 1, Math.floor(along));
      const mix = along - step;
      const a = pulse.link * (ARC_STEPS + 1) + step;
      const x = arcX[a] + (arcX[a + 1] - arcX[a]) * mix;
      const y = arcY[a] + (arcY[a + 1] - arcY[a]) * mix;
      const depth = arcDepth[a] + (arcDepth[a + 1] - arcDepth[a]) * mix;
      ctx.globalAlpha = Math.sin(pulse.age * Math.PI) * (0.25 + 0.75 * depth);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (threadPoints && threadDrawn >= 1 && !still) {
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
    for (const lesson of drawOrder) {
      const depth = depths[lesson];
      const done = finished[lesson];
      const mood = emphasis[chapterOf[lesson]];
      const fired = Math.max(signal[lesson], glow[lesson]);
      const size = dotRadius(depth, degrees[lesson], done, radius) * zoom * (0.82 + 0.18 * mood) * (1 + fired * 0.7);
      const alpha = Math.min(1, dotAlpha(depth, done) * (mood > 1 ? 1 + (mood - 1) * 1.6 : mood) * (moreContrast.matches ? 1.5 : 1) + fired * 0.8);
      if (done && theme.halo) {
        ctx.globalAlpha = alpha * 0.8;
        const span = size * 6;
        ctx.drawImage(theme.halo, screenX[lesson] - span / 2, screenY[lesson] - span / 2, span, span);
      }
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(screenX[lesson], screenY[lesson], size, 0, Math.PI * 2);
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
    const selectedPart = selected !== null ? graph.chapterParts[selected] : null;
    graph.partTitles.forEach((title, part) => {
      const turned = turnedDirection(partCenters[part]);
      const facing = Math.min(1, Math.max(0, (turned.z + 0.25) / 0.4));
      if (facing <= 0.01) return;
      // Lettering stays on the top or bottom of the rim, where it can be read, even for a lobe near the equator.
      const below = turned.y < 0;
      const steep = Math.PI / 7;
      const across = Math.atan2(Math.abs(turned.y), turned.x);
      const held = Math.min(Math.PI - steep, Math.max(steep, across));
      const angle = below ? held : -held;
      const alpha = facing;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = selectedPart === part ? theme.ink : theme.muted;
      const letters = [...title];
      const gaps = letters.map((letter) => ctx.measureText(letter).width + 0.5);
      const total = gaps.reduce((sum, gap) => sum + gap, 0);
      const ring = below ? rim + labelSize * 0.8 : rim;
      let travel = -total / 2;
      letters.forEach((letter, index) => {
        const middle = travel + gaps[index] / 2;
        const theta = below ? angle - middle / ring : angle + middle / ring;
        ctx.save();
        ctx.translate(centerX + Math.cos(theta) * ring, centerY + Math.sin(theta) * ring);
        ctx.rotate(below ? theta - Math.PI / 2 : theta + Math.PI / 2);
        ctx.fillText(letter, 0, 0);
        ctx.restore();
        travel += gaps[index];
      });
    });
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
    drawPulses();
    drawDots();
    drawMarkers();
    drawPartNames();
    drawNextLabel();
    ctx.globalAlpha = 1;
    placeTooltip();
  }

  function updateHover() {
    if (!pointer || drag?.moved) return;
    const reach = Math.max(10, radius * 0.045);
    const found = hitLesson(hitPoints, pointer.x, pointer.y, reach);
    const lesson = found < 0 ? null : found;
    if (lesson !== hovered) {
      hovered = lesson;
      events.onHover(lesson);
    }
    canvas.style.cursor = lesson !== null ? "pointer" : "";
  }

  function tick(now: number) {
    frame = 0;
    if (destroyed || !onScreen || document.visibilityState === "hidden") return;
    const busy = Boolean(drag) || signalStart >= 0 || threadDrawn < 1 || Boolean(target) || Math.abs(yawVelocity) + Math.abs(pitchVelocity) > 0.01 || Math.abs(zoomVelocity) > 0.001;
    if (!busy && !still && now - lastDraw < IDLE_FRAME) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.05, lastTick ? (now - lastTick) / 1000 : 1 / 60);
    lastTick = now;
    lastDraw = now;
    try {
      advance(dt);
      updateHover();
      draw();
    } catch {
      destroyed = true;
      events.onFail();
      return;
    }
    if (!still || drag) frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (!frame && !destroyed && onScreen && document.visibilityState !== "hidden") {
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
    const pressed = hitLesson(hitPoints, place.x, place.y, touch ? Math.max(26, radius * 0.16) : Math.max(10, radius * 0.045));
    drag = { id: event.pointerId, touch, startX: place.x, startY: place.y, x: place.x, y: place.y, moved: false, pressed, samples: [{ t: event.timeStamp, ...place }] };
    if (!still && pressed >= 0) glow[pressed] = 1;
    canvas.setPointerCapture(event.pointerId);
    wake();
  }

  function onPointerMove(event: PointerEvent) {
    const place = pointerPlace(event);
    if (event.pointerType === "mouse") pointer = place;
    if (!drag || drag.id !== event.pointerId) {
      if (still) wake();
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
      selected = focus.chapter;
      active = focus.lesson;
      if (focus.lesson !== null && focus.faceLesson) faceTo(position(focus.lesson), false);
      else if (focus.chapter !== null && changedChapter) faceTo(chapterCenters[focus.chapter], false);
      else if (focus.chapter === null && focus.lesson === null && target && !target.passing) target = null;
      wake();
    },
    setHold(nextHold) {
      hold = nextHold;
      wake();
    },
    announce(lesson) {
      faceTo(position(lesson), true);
      startSignal(lesson);
      wake();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
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
