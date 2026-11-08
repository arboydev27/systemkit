import type { OrbGraph } from "./orb-layout";
import { arcPoint, foldPoint } from "./orb-motion";
import {
  arcControl, CAMERA, CHAPTER_LINE, dotAlpha, dotRadius, FIT, foldHandles, foldNeighbors, lineAlpha, linkDegrees, nearness, ORB_RADIUS, RELATED_LINE,
} from "./orb-view";
import { axisAt, FILM, onFilm, type Film, type Shot } from "./neuron-film";
import {
  buildFlightPath, FLIGHT, flightDistance, pathIndex, pathPoint, ramp, routeFrom, routesTo, turnPoints, type FlightPath, type Routes, type Vec,
} from "./neuron-route";

// The dive from Milo's eye to the game, drawn on one canvas over the whole screen. It starts as an exact copy of
// Milo, drawn from the same images the page shows, so it can take over without a seam. The camera goes for one of
// his eyes, the eye opens like a pupil onto the neuron the WebGL canvas beneath is drawing, and everything inside is
// the course: the nodes are lessons on the real route from the visitor's next lesson to one about scaling. Without
// WebGL, the inside is the course's own lines, lit, with the route as a fibre. A 2D canvas is enough for a few
// thousand segments a frame, and it keeps the dive to a few kilobytes that load after the first screen.

const ARC_STEPS = 8; // Samples along each link's arc.
const FOLD_STEPS = 5;
const NEAR = 0.03;
const LOOK = 0.42;
const ALPHA_STEPS = 10;
const WIDTHS = [0.5, 0.7, 1, 1.7, 2.8, 4.6, 7.5, 12];
const STRANDS = 9;
const STRAND_REACH = 2.6;
const STRAND_STEPS = 26;
const TUBE = 0.085;
const GATE = 0.13;
const GATE_SIDES = 20;
const ZOOM = 7; // How far the camera has closed in on the eye by the time it fills the screen.

export type NeuronPlace = {
  /** Where the dive goes in, on screen, and the size of what it goes into, which sets the scale inside. */
  orbX: number;
  orbY: number;
  orbSize: number;
  /** Where the far end opens: the place on the game's map the signal arrives at. */
  holeX: number;
  holeY: number;
};

/** How far the far end has opened, as a circle around the place on the game it opens onto. */
export function holeAt(progress: number, place: NeuronPlace, width: number, height: number) {
  if (progress <= FLIGHT.open - 0.02) return 0;
  const hole = ramp(FLIGHT.open - 0.02, FLIGHT.clear, progress);
  const reach = Math.hypot(Math.max(place.holeX, width - place.holeX), Math.max(place.holeY, height - place.holeY));
  return 6 + reach * hole * hole;
}

/** The neuron the WebGL canvas beneath is drawing this frame, so the names can go on its nodes. */
export type Filmed = { film: Film; shot: Shot };

/** One of Milo's image layers as the page shows it: the image, its size, and where the page has put it on screen. */
export type FigureLayer = { image: CanvasImageSource; width: number; height: number; matrix: DOMMatrix };
/** One of his eyes on screen as the dive begins, with how tall it is when open, in case he was mid-blink. */
export type FigureEye = { x: number; y: number; rx: number; ry: number; open: number };
/** Milo as the page is showing him when the dive begins, so the first frame can be an exact copy. */
export type FigureCopy = { layers: FigureLayer[]; eyes: FigureEye[]; chosen: number; glow: { reach: number; blur: number; alpha: number; color: string } };

export type NeuronScene = {
  resize: () => void;
  /** Takes over from Milo as he is now, with the route from the given lesson. Returns where the eye it goes into is on screen. */
  launch: (place: NeuronPlace, start: number, figure: FigureCopy, finished: boolean[]) => { x: number; y: number };
  /** Draws a frame and says where the eye being dived into is on screen. With a film, the inside is left to the WebGL canvas. */
  draw: (progress: number, place: NeuronPlace, filmed?: Filmed | null) => { x: number; y: number };
  route: () => number[];
  destroy: () => void;
};

type Theme = { ink: string; canvas: string; deep: string; spark: string; dark: boolean; contrast: number; font: string };

function makeGlow() {
  const size = 96;
  const glow = document.createElement("canvas");
  glow.width = size;
  glow.height = size;
  const context = glow.getContext("2d");
  if (!context) return null;
  const fill = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fill.addColorStop(0, "rgb(255 255 255 / 100%)");
  fill.addColorStop(0.18, "rgb(255 255 255 / 42%)");
  fill.addColorStop(0.5, "rgb(255 255 255 / 9%)");
  fill.addColorStop(1, "rgb(255 255 255 / 0%)");
  context.fillStyle = fill;
  context.fillRect(0, 0, size, size);
  return glow;
}

export function createNeuronScene(canvas: HTMLCanvasElement, graph: OrbGraph, exits: number[]): NeuronScene | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const ctx = context;

  const count = graph.titles.length;
  const linkCount = graph.links.length / 2;
  const degrees = linkDegrees(graph);
  const routes: Routes = routesTo(graph, exits);
  const at = (lesson: number): Vec => [graph.positions[lesson * 3], graph.positions[lesson * 3 + 1], graph.positions[lesson * 3 + 2]];

  // Every point the dive draws, in one array so one loop places them all: the dots, then each link's arc, then each chapter's thread.
  const ARC = count;
  const FOLD = ARC + linkCount * (ARC_STEPS + 1);
  const total = FOLD + count * (FOLD_STEPS + 1);
  const world = new Float32Array(total * 3);
  world.set(graph.positions.slice(0, count * 3));
  for (let link = 0; link < linkCount; link++) {
    const a = at(graph.links[link * 2]);
    const b = at(graph.links[link * 2 + 1]);
    const control = arcControl(a, b);
    for (let step = 0; step <= ARC_STEPS; step++) world.set(arcPoint(a, control, b, step / ARC_STEPS), (ARC + link * (ARC_STEPS + 1) + step) * 3);
  }
  const threaded = new Uint8Array(count);
  for (let chapter = 0; chapter < graph.chapterStarts.length - 1; chapter++) {
    const start = graph.chapterStarts[chapter];
    const end = graph.chapterStarts[chapter + 1];
    for (let lesson = start; lesson < end - 1; lesson++) {
      threaded[lesson] = 1;
      const { before, after } = foldNeighbors(start, end, lesson);
      const [first, second] = foldHandles(at(before), at(lesson), at(lesson + 1), at(after));
      for (let step = 0; step <= FOLD_STEPS; step++) world.set(foldPoint(at(lesson), first, second, at(lesson + 1), step / FOLD_STEPS), (FOLD + lesson * (FOLD_STEPS + 1) + step) * 3);
    }
  }

  const view = new Float32Array(world.length);
  const camX = new Float32Array(total);
  const camY = new Float32Array(total);
  const camZ = new Float32Array(total);

  const order = Array.from({ length: count }, (_, lesson) => lesson);
  const prevX = new Float32Array(count);
  const prevY = new Float32Array(count);
  const prevOn = new Uint8Array(count);
  const fire = new Float32Array(count);
  const onRoute = new Uint8Array(count);
  const batches: number[][] = Array.from({ length: WIDTHS.length * (ALPHA_STEPS + 1) }, () => []);
  const glow = makeGlow();

  let path: FlightPath | null = null;
  let figure: FigureCopy | null = null;
  let finished: boolean[] = [];
  let routeLinks = new Uint8Array(linkCount);
  let width = 0;
  let height = 0;
  let scale = 1;
  let theme: Theme = { ink: "#171717", canvas: "#fafafa", deep: "#171717", spark: "#fafafa", dark: false, contrast: 1, font: "system-ui, sans-serif" };
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const moreContrast = window.matchMedia("(prefers-contrast: more)");

  // The camera, and the projection it was given for this frame.
  const position: Vec = [0, 0, CAMERA];
  const ahead: Vec = [0, 0, 0];
  const forward: Vec = [0, 0, -1];
  const up: Vec = [0, 1, 0];
  const right: Vec = [1, 0, 0];
  let focal = 1;
  let originX = 0;
  let originY = 0;
  let hair = 1;
  let radius = 1;
  let startFocal = 1;
  let lift = 1;

  function readTheme() {
    const styles = getComputedStyle(canvas);
    const dark = scheme.matches;
    const ink = styles.getPropertyValue("--ink").trim() || (dark ? "#f5f5f5" : "#171717");
    const page = styles.getPropertyValue("--canvas").trim() || (dark ? "#0b0b0b" : "#fafafa");
    theme = { ink, canvas: page, deep: dark ? page : ink, spark: dark ? ink : page, dark, contrast: moreContrast.matches ? 1.5 : 1, font: styles.fontFamily || theme.font };
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    // The dive moves too fast for a phone's third pixel to show, and every pixel costs during it.
    scale = Math.min(window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2, window.devicePixelRatio || 1);
    const pixelsWide = Math.round(width * scale);
    const pixelsHigh = Math.round(height * scale);
    if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
  }

  /** Places every point relative to the camera. Depth is along the view, and only what's in front gets drawn. */
  function placeAll() {
    const [px, py, pz] = position;
    const [fx, fy, fz] = forward;
    const [rx, ry, rz] = right;
    const [ux, uy, uz] = up;
    for (let index = 0; index < total; index++) {
      const dx = view[index * 3] - px;
      const dy = view[index * 3 + 1] - py;
      const dz = view[index * 3 + 2] - pz;
      camX[index] = dx * rx + dy * ry + dz * rz;
      camY[index] = dx * ux + dy * uy + dz * uz;
      camZ[index] = dx * fx + dy * fy + dz * fz;
    }
  }

  const screen = { x: 0, y: 0, z: 0 };
  function project(x: number, y: number, z: number) {
    const dx = x - position[0];
    const dy = y - position[1];
    const dz = z - position[2];
    const along = dx * forward[0] + dy * forward[1] + dz * forward[2];
    const s = focal / Math.max(NEAR, along);
    screen.x = originX + (dx * right[0] + dy * right[1] + dz * right[2]) * s;
    screen.y = originY - (dx * up[0] + dy * up[1] + dz * up[2]) * s;
    screen.z = along;
    return screen;
  }

  const a = { x: 0, y: 0 };
  const b = { x: 0, y: 0 };
  /** A segment between two points already placed relative to the camera, cut where it passes behind it. */
  function segment(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, alpha: number, lineWidth: number) {
    if (alpha <= 0.02 || (z1 < NEAR && z2 < NEAR)) return;
    if (z1 < NEAR) {
      const t = (NEAR - z1) / (z2 - z1);
      x1 += (x2 - x1) * t; y1 += (y2 - y1) * t; z1 = NEAR;
    } else if (z2 < NEAR) {
      const t = (NEAR - z2) / (z1 - z2);
      x2 += (x1 - x2) * t; y2 += (y1 - y2) * t; z2 = NEAR;
    }
    a.x = originX + (x1 * focal) / z1; a.y = originY - (y1 * focal) / z1;
    b.x = originX + (x2 * focal) / z2; b.y = originY - (y2 * focal) / z2;
    const margin = 60;
    if ((a.x < -margin && b.x < -margin) || (a.x > width + margin && b.x > width + margin) || (a.y < -margin && b.y < -margin) || (a.y > height + margin && b.y > height + margin)) return;
    const step = Math.round(Math.min(1, alpha) * ALPHA_STEPS);
    let size = 0;
    while (size < WIDTHS.length - 1 && lineWidth > WIDTHS[size] * hair * 1.25) size++;
    batches[size * (ALPHA_STEPS + 1) + step].push(a.x, a.y, b.x, b.y);
  }

  function strokeBatches(color: string, strength: number) {
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    for (let size = 0; size < WIDTHS.length; size++) {
      ctx.lineWidth = WIDTHS[size] * hair;
      for (let step = 1; step <= ALPHA_STEPS; step++) {
        const segments = batches[size * (ALPHA_STEPS + 1) + step];
        if (!segments.length) continue;
        ctx.globalAlpha = Math.min(1, (step / ALPHA_STEPS) * strength);
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

  /** Near lines fade before they hit the lens, and far ones fall back into the dark. */
  const insideAlpha = (z: number) => ramp(NEAR, 0.28, z) * (1 - 0.9 * ramp(0.45, 2.4, z));

  /** The course's links and threads, from outside the sphere (mix 0) or from within it (mix 1). */
  function collectLines(mix: number) {
    for (let link = 0; link < linkCount; link++) {
      const from = graph.links[link * 2];
      const to = graph.links[link * 2 + 1];
      const flare = Math.max(fire[from], fire[to]);
      const routed = routeLinks[link];
      const start = ARC + link * (ARC_STEPS + 1);
      for (let step = 0; step < ARC_STEPS; step++) {
        const i = start + step;
        const j = i + 1;
        const z = (camZ[i] + camZ[j]) / 2;
        const outside = lineAlpha(nearness((view[i * 3 + 2] + view[j * 3 + 2]) / 2), RELATED_LINE);
        const inside = insideAlpha(z) * (0.42 + routed * 0.3 + flare * 0.5);
        const alpha = outside + (inside - outside) * mix;
        const lineWidth = hair * (1 + mix * ((0.3 + flare * 0.4) / Math.max(z, NEAR)));
        segment(camX[i], camY[i], camZ[i], camX[j], camY[j], camZ[j], alpha, lineWidth);
      }
    }
    for (let lesson = 0; lesson < count; lesson++) {
      if (!threaded[lesson]) continue;
      const flare = Math.max(fire[lesson], fire[lesson + 1]);
      const start = FOLD + lesson * (FOLD_STEPS + 1);
      for (let step = 0; step < FOLD_STEPS; step++) {
        const i = start + step;
        const j = i + 1;
        const z = (camZ[i] + camZ[j]) / 2;
        const outside = lineAlpha(nearness((view[i * 3 + 2] + view[j * 3 + 2]) / 2), CHAPTER_LINE);
        const inside = insideAlpha(z) * (0.62 + flare * 0.4);
        const alpha = outside + (inside - outside) * mix;
        const lineWidth = hair * (1.35 + mix * ((0.36 + flare * 0.4) / Math.max(z, NEAR)));
        segment(camX[i], camY[i], camZ[i], camX[j], camY[j], camZ[j], alpha, lineWidth);
      }
    }
  }

  const dotX = new Float32Array(count);
  const dotY = new Float32Array(count);
  const dotSize = new Float32Array(count);
  const dotAlphaNow = new Float32Array(count);

  function drawDots(color: string, mix: number, fade: number, streaks: boolean) {
    for (let index = 1; index < count; index++) {
      const lesson = order[index];
      let place = index - 1;
      while (place >= 0 && camZ[order[place]] < camZ[lesson]) {
        order[place + 1] = order[place];
        place--;
      }
      order[place + 1] = lesson;
    }
    for (let lesson = 0; lesson < count; lesson++) {
      dotAlphaNow[lesson] = 0;
      const z = camZ[lesson];
      if (z < NEAR) { prevOn[lesson] = 0; continue; }
      const s = focal / z;
      a.x = originX + camX[lesson] * s;
      a.y = originY - camY[lesson] * s;
      const viewZ = view[lesson * 3 + 2];
      const depth = nearness(viewZ);
      const done = finished[lesson] ?? false;
      const size = Math.min(mix > 0.5 ? 56 : 160, (dotRadius(depth, degrees[lesson], done, radius) * (CAMERA - viewZ) * focal) / (z * startFocal)) * (1 + fire[lesson] * 0.6);
      const outside = dotAlpha(depth, done) * theme.contrast;
      const inside = (done ? 1 : 0.8) * insideAlpha(z) + onRoute[lesson] * 0.2;
      const alpha = Math.min(1, outside + (inside - outside) * mix + fire[lesson] * 0.5) * fade;
      const seen = a.x > -size - 40 && a.x < width + size + 40 && a.y > -size - 40 && a.y < height + size + 40;
      if (seen && alpha > 0.02) {
        dotX[lesson] = a.x;
        dotY[lesson] = a.y;
        dotSize[lesson] = size;
        dotAlphaNow[lesson] = alpha;
        // A dot rushing past leaves a thin streak along the way it came, as a lens would see it.
        const dx = a.x - prevX[lesson];
        const dy = a.y - prevY[lesson];
        const travel = Math.hypot(dx, dy);
        if (streaks && prevOn[lesson] && travel > 3) {
          const reach = Math.min(1, 90 / travel);
          pushStreak(a.x - dx * reach, a.y - dy * reach, a.x, a.y, alpha * 0.4, Math.min(size * 0.9, 10));
        }
      }
      prevX[lesson] = a.x;
      prevY[lesson] = a.y;
      prevOn[lesson] = 1;
    }
    if (streaks) strokeBatches(color, 1);
    ctx.fillStyle = color;
    for (const lesson of order) {
      const alpha = dotAlphaNow[lesson];
      if (alpha <= 0.02) continue;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(dotX[lesson], dotY[lesson], dotSize[lesson], 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function pushStreak(x1: number, y1: number, x2: number, y2: number, alpha: number, lineWidth: number) {
    const step = Math.round(Math.min(1, alpha) * ALPHA_STEPS);
    if (!step) return;
    let size = 0;
    while (size < WIDTHS.length - 1 && lineWidth > WIDTHS[size] * hair * 1.25) size++;
    batches[size * (ALPHA_STEPS + 1) + step].push(x1, y1, x2, y2);
  }

  const strandPoints = new Float32Array((STRAND_STEPS + 1) * 9);
  /** The route as a nerve fibre: strands twisting around it, pinched at each lesson like the nodes along an axon. */
  function collectStrands(along: number) {
    if (!path) return;
    const stops = path.stops;
    const first = stops[0];
    const from = Math.max(first, along - 0.1);
    for (let step = 0; step <= STRAND_STEPS; step++) {
      const u = from + (step / STRAND_STEPS) * STRAND_REACH;
      const index = pathIndex(path, u);
      let gap = Infinity;
      for (const stop of stops) gap = Math.min(gap, Math.abs(u - stop));
      const tube = TUBE * (0.3 + 0.7 * ramp(0, 0.3, gap)) * ramp(first - 0.05, first + 0.25, u);
      const o = step * 9;
      strandPoints[o] = path.x[index]; strandPoints[o + 1] = path.y[index]; strandPoints[o + 2] = path.z[index];
      strandPoints[o + 3] = path.nx[index] * tube; strandPoints[o + 4] = path.ny[index] * tube; strandPoints[o + 5] = path.nz[index] * tube;
      strandPoints[o + 6] = path.bx[index] * tube; strandPoints[o + 7] = path.by[index] * tube; strandPoints[o + 8] = path.bz[index] * tube;
    }
    const [px, py, pz] = position;
    for (let strand = 0; strand < STRANDS; strand++) {
      let lastX = 0, lastY = 0, lastZ = 0;
      for (let step = 0; step <= STRAND_STEPS; step++) {
        const u = from + (step / STRAND_STEPS) * STRAND_REACH;
        const angle = (strand / STRANDS) * Math.PI * 2 + u * 2.4;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const o = step * 9;
        const dx = strandPoints[o] + strandPoints[o + 3] * cos + strandPoints[o + 6] * sin - px;
        const dy = strandPoints[o + 1] + strandPoints[o + 4] * cos + strandPoints[o + 7] * sin - py;
        const dz = strandPoints[o + 2] + strandPoints[o + 5] * cos + strandPoints[o + 8] * sin - pz;
        const x = dx * right[0] + dy * right[1] + dz * right[2];
        const y = dx * up[0] + dy * up[1] + dz * up[2];
        const z = dx * forward[0] + dy * forward[1] + dz * forward[2];
        if (step > 0) {
          const zMid = (z + lastZ) / 2;
          const far = 1 - step / STRAND_STEPS;
          segment(lastX, lastY, lastZ, x, y, z, (0.18 + 0.5 * far) * ramp(NEAR, 0.12, zMid), hair * (1 + 0.16 / Math.max(zMid, NEAR)));
        }
        lastX = x; lastY = y; lastZ = z;
      }
    }
  }

  /** A ring where the route passes each lesson, cut like any other line where it passes the camera. */
  function collectGates() {
    if (!path) return;
    const [px, py, pz] = position;
    for (let stop = 1; stop < path.stops.length; stop++) {
      const index = pathIndex(path, path.stops[stop]);
      const cx = path.x[index] - px;
      const cy = path.y[index] - py;
      const cz = path.z[index] - pz;
      const z = cx * forward[0] + cy * forward[1] + cz * forward[2];
      const presence = ramp(2.4, 1.1, z) * ramp(-0.05, 0.25, z);
      if (presence <= 0.01) continue;
      let lastX = 0, lastY = 0, lastZ = 0;
      for (let side = 0; side <= GATE_SIDES; side++) {
        const angle = (side / GATE_SIDES) * Math.PI * 2;
        const cos = Math.cos(angle) * GATE;
        const sin = Math.sin(angle) * GATE;
        const dx = cx + path.nx[index] * cos + path.bx[index] * sin;
        const dy = cy + path.ny[index] * cos + path.by[index] * sin;
        const dz = cz + path.nz[index] * cos + path.bz[index] * sin;
        const x = dx * right[0] + dy * right[1] + dz * right[2];
        const y = dx * up[0] + dy * up[1] + dz * up[2];
        const depth = dx * forward[0] + dy * forward[1] + dz * forward[2];
        if (side > 0) segment(lastX, lastY, lastZ, x, y, depth, presence * 0.75, hair * (1.2 + 0.32 / Math.max(NEAR, (depth + lastZ) / 2)));
        lastX = x; lastY = y; lastZ = depth;
      }
    }
  }

  /** Each lesson's name going by as the camera passes through it. */
  function drawNames() {
    if (!path) return;
    ctx.fillStyle = theme.spark;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let stop = 1; stop < path.stops.length; stop++) {
      const index = pathIndex(path, path.stops[stop]);
      const center = project(path.x[index], path.y[index], path.z[index]);
      const z = center.z;
      const presence = ramp(2.2, 1.2, z) * ramp(0.14, 0.42, z);
      if (presence <= 0.01) continue;
      const size = Math.min(30, 10 + 4 / z);
      ctx.globalAlpha = presence;
      ctx.font = `640 ${size.toFixed(1)}px ${theme.font}`;
      const title = graph.titles[path.route[stop]];
      const wide = ctx.measureText(title).width;
      const ring = (GATE * focal) / z;
      // Beside the ring where there's room, otherwise under it, so a name never covers the signal.
      if (center.x + ring + 12 + wide < width - 12) {
        ctx.textAlign = "left";
        ctx.fillText(title, center.x + ring + 12, center.y);
      } else {
        ctx.textAlign = "center";
        ctx.fillText(title, Math.max(12 + wide / 2, Math.min(width - 12 - wide / 2, center.x)), center.y + ring + size);
      }
    }
  }

  /** The signal the camera chases down the fibre. */
  function drawPulse(along: number, progress: number) {
    if (!path || !glow) return;
    const stops = path.stops;
    const lead = Math.min(stops[stops.length - 1], Math.max(stops[0], along + 0.5));
    const point = pathPoint(path, lead, ahead);
    const center = project(point[0], point[1], point[2]);
    if (center.z < NEAR) return;
    const size = Math.min(260, (focal * 0.1) / center.z) * (1 + 0.6 * ramp(FLIGHT.open - 0.06, FLIGHT.open, progress));
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glow, center.x - size, center.y - size, size * 2, size * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.spark;
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.min(26, Math.max(1.6, (focal * 0.009) / center.z)), 0, Math.PI * 2);
    ctx.fill();
  }

  function frameCamera(progress: number, place: NeuronPlace) {
    if (!path) return 0;
    const along = flightDistance(path, progress);
    pathPoint(path, along, position);
    pathPoint(path, along + LOOK, ahead);
    let fx = ahead[0] - position[0];
    let fy = ahead[1] - position[1];
    let fz = ahead[2] - position[2];
    let length = Math.hypot(fx, fy, fz) || 1;
    // The view swings round to look down the route as the camera goes in.
    const turn = ramp(0, FLIGHT.through, progress);
    fx = (fx / length) * turn; fy = (fy / length) * turn; fz = (fz / length) * turn - (1 - turn);
    length = Math.hypot(fx, fy, fz) || 1;
    forward[0] = fx / length; forward[1] = fy / length; forward[2] = fz / length;
    const index = pathIndex(path, along);
    let ux = path.nx[index] * turn;
    let uy = path.ny[index] * turn + (1 - turn);
    let uz = path.nz[index] * turn;
    const lean = ux * forward[0] + uy * forward[1] + uz * forward[2];
    ux -= forward[0] * lean; uy -= forward[1] * lean; uz -= forward[2] * lean;
    length = Math.hypot(ux, uy, uz) || 1;
    ux /= length; uy /= length; uz /= length;
    const rx = forward[1] * uz - forward[2] * uy;
    const ry = forward[2] * ux - forward[0] * uz;
    const rz = forward[0] * uy - forward[1] * ux;
    // It banks as it goes, as anything thrown down a winding tube would.
    const roll = ramp(FLIGHT.pull, FLIGHT.through + 0.1, progress) * 0.5 * Math.sin(along * 1.7 + 0.4);
    const cos = Math.cos(roll);
    const sin = Math.sin(roll);
    right[0] = rx * cos + ux * sin; right[1] = ry * cos + uy * sin; right[2] = rz * cos + uz * sin;
    up[0] = ux * cos - rx * sin; up[1] = uy * cos - ry * sin; up[2] = uz * cos - rz * sin;

    radius = place.orbSize * ORB_RADIUS;
    startFocal = CAMERA * FIT * radius;
    hair = Math.max(0.7, radius / 300);
    const wide = 0.5 * Math.hypot(width, height);
    // The view widens as it plunges through the dot, and again with each burst of speed between lessons.
    const speed = (flightDistance(path, progress + 0.004) - flightDistance(path, progress - 0.004)) / 0.008;
    const rush = Math.min(1, Math.max(0, speed / 14 - 0.3));
    focal = (startFocal + (wide - startFocal) * ramp(FLIGHT.pull, FLIGHT.through + 0.06, progress)) * (1 - 0.2 * rush * ramp(FLIGHT.pull, FLIGHT.through, progress));
    const toCenter = ramp(0.03, FLIGHT.through, progress);
    const toHole = ramp(FLIGHT.open - 0.14, FLIGHT.open + 0.02, progress);
    originX = place.orbX + (width / 2 - place.orbX) * toCenter;
    originY = place.orbY + (height / 2 - place.orbY) * toCenter;
    originX += (place.holeX - originX) * toHole;
    originY += (place.holeY - originY) * toHole;
    return along;
  }

  /** The names of the lessons on the route, each on its node of the neuron as the camera passes through. */
  function drawFilmNames({ film, shot }: Filmed, progress: number) {
    ctx.fillStyle = theme.spark;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgb(0 0 0 / 70%)";
    ctx.shadowBlur = 10;
    const points = film.nodes.map((z, index) => ({ name: film.names[index], z, lift: 0.5 }));
    points.push({ name: film.names[film.names.length - 1], z: film.end - 0.9, lift: 1.1 });
    // One name at a time: the next lesson ahead.
    const next = points.find(({ name, z }) => name && z > shot.depth + 0.7);
    for (const { name, z, lift } of next ? [next] : []) {
      const [x, y] = axisAt(film, z);
      const spot = onFilm(shot, [x + lift * 0.9, y + lift * 0.8, z]);
      if (!spot) continue;
      const presence = ramp(9, 4.5, spot.z) * ramp(0.7, 1.6, spot.z) * (1 - ramp(FILM.open, FILM.open + 0.05, progress));
      if (presence <= 0.01) continue;
      const size = Math.min(26, Math.max(12, spot.scale * 0.055));
      ctx.font = `620 ${size.toFixed(1)}px ${theme.font}`;
      const wide = ctx.measureText(name).width;
      ctx.globalAlpha = presence;
      ctx.textAlign = "left";
      ctx.fillText(name, Math.max(16, Math.min(width - wide - 16, spot.x)), Math.max(24, Math.min(height - 24, spot.y)));
    }
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  function draw(progress: number, place: NeuronPlace, filmed: Filmed | null = null) {
    // The canvas has no size while it's hidden between dives.
    if (canvas.clientWidth !== width || canvas.clientHeight !== height) resize();
    if (!path || !width || !height) return { x: width / 2, y: height / 2 };
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    const along = frameCamera(progress, place);
    placeAll();

    const stops = path.stops;
    fire.fill(0);
    for (let stop = 0; stop < stops.length; stop++) {
      const gap = (along - stops[stop]) / 0.32;
      fire[path.route[stop]] = Math.max(fire[path.route[stop]], Math.exp(-gap * gap)) * ramp(FLIGHT.pull, FLIGHT.through, progress);
    }

    // The eye the camera goes for, and how much of the screen its inside has taken.
    const eye = figure ? figure.eyes[figure.chosen] : { x: originX, y: originY, rx: 6, ry: 6, open: 6 };
    // Where the page scrolls under the dive rather than being pinned, Milo goes up with it.
    const shift = figure ? place.orbY - eye.y : 0;
    a.x = eye.x;
    a.y = eye.y + shift;
    const strain = ramp(0, FLIGHT.pull, progress);
    const opening = ramp(FLIGHT.pull + 0.02, FLIGHT.covered, progress);
    const zoom = Math.exp(Math.log(ZOOM) * ramp(0, FLIGHT.covered, progress) ** 1.7);
    const corner = Math.hypot(Math.max(a.x, width - a.x), Math.max(a.y, height - a.y));
    // The pupil: nothing at first, then most of the eye, then the whole screen.
    const pupil = ramp(0.004, FLIGHT.pull + 0.03, progress) ** 0.8;
    const swell = (1 + 0.16 * strain) * zoom;
    const grown = corner * opening * opening * opening;
    const holeX = progress >= FLIGHT.covered ? Infinity : eye.rx * swell * 0.78 * pupil + grown;
    const holeY = progress >= FLIGHT.covered ? Infinity : eye.open * swell * 0.78 * pupil + grown;
    const mix = ramp(FLIGHT.pull, FLIGHT.covered, progress);

    if (Math.min(holeX, holeY) < corner) {
      // Outside: Milo, as the page showed him, over a veil that hides the page as it falls away.
      ctx.globalAlpha = ramp(0, FLIGHT.pull + 0.04, progress) * 0.97;
      ctx.fillStyle = theme.canvas;
      ctx.fillRect(0, 0, width, height);
      if (figure) drawFigure(figure, zoom, strain, progress, shift);
      if (pupil > 0.01 && filmed) {
        // The eye opens onto the neuron, which the canvas beneath is drawing.
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, holeX, holeY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      } else if (pupil > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, holeX, holeY, 0, 0, Math.PI * 2);
        ctx.clip();
        drawInside(progress, along, 1, true);
        ctx.restore();
      }
      // Once the pupil is wider than the eye, a bright rim is all that's left of it.
      const rim = ramp(0.6, 1, Math.min(holeX / (eye.rx * swell), holeY / (eye.open * swell))) * (1 - ramp(0.55, 1, opening));
      if (rim > 0.01) {
        ctx.globalAlpha = rim;
        ctx.strokeStyle = "#f4f4f4";
        ctx.lineWidth = Math.min(3, 1.4 + Math.min(holeX, holeY) / 160);
        ctx.beginPath();
        ctx.ellipse(a.x, a.y, holeX, holeY, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (filmed) {
      drawFilmNames(filmed, progress);
    } else {
      drawInside(progress, along, mix, false);
    }
    const entryX = a.x;
    const entryY = a.y;

    // The far end opens on the game, and the signal goes on as its first request.
    if (progress > FLIGHT.open - 0.02 && !filmed) {
      const hole = ramp(FLIGHT.open - 0.02, FLIGHT.clear, progress);
      const reach = Math.hypot(Math.max(place.holeX, width - place.holeX), Math.max(place.holeY, height - place.holeY));
      const size = 6 + reach * hole * hole;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(place.holeX, place.holeY, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = theme.spark;
      ctx.lineWidth = 2 + 6 * (1 - hole);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(place.holeX, place.holeY, size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35 * (1 - hole);
      ctx.beginPath();
      ctx.arc(place.holeX, place.holeY, size * 1.18 + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return { x: entryX, y: entryY };
  }

  /** Milo, drawn from the page's own images where the page put them, with the camera closing in on one eye. */
  function drawFigure(copy: FigureCopy, zoom: number, strain: number, progress: number, shift: number) {
    const { x: ex, y: ey } = copy.eyes[copy.chosen];
    const camera = new DOMMatrix([scale, 0, 0, scale, 0, 0]).translate(ex, ey + shift).scale(zoom).translate(-ex, -ey);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    for (const layer of copy.layers) {
      ctx.setTransform(camera.multiply(layer.matrix));
      ctx.drawImage(layer.image, 0, 0, layer.width, layer.height);
    }
    ctx.setTransform(camera);
    // His eyes: a soft glow, then the shape, as the page draws them. One that was mid-blink opens for the dive.
    const opened = ramp(0, FLIGHT.pull, progress);
    const { reach, blur, alpha, color } = copy.glow;
    // The glow is a shadow thrown from a shape drawn well off screen, so only the blur lands, at any zoom.
    const away = 10000;
    for (const [index, eye] of copy.eyes.entries()) {
      const swell = index === copy.chosen ? 1 + 0.16 * strain : 1;
      const ry = (eye.ry + (eye.open - eye.ry) * opened) * swell;
      const rx = eye.rx * swell;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = blur * zoom * scale;
      ctx.shadowOffsetX = away * zoom * scale;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(eye.x - away, eye.y, rx + reach * swell, ry + reach * swell, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f4f4f4";
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  /** The inside, without WebGL: dark, the course's lines lit, the route as a fibre, and the signal ahead. */
  function drawInside(progress: number, along: number, mix: number, clipped: boolean) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.deep;
    ctx.fillRect(0, 0, width, height);
    if (glow) {
      // Light at the end of the fibre, where the signal is going.
      const size = Math.hypot(width, height) * 0.55;
      ctx.globalAlpha = 0.07;
      ctx.drawImage(glow, originX - size, originY - size, size * 2, size * 2);
    }
    lift = 1.22 * theme.contrast;
    collectLines(mix);
    collectStrands(along);
    collectGates();
    strokeBatches(theme.spark, lift);
    drawDots(theme.spark, mix, 1, !clipped);
    drawNames();
    drawPulse(along, progress);
  }

  readTheme();
  resize();
  const onScheme = () => readTheme();
  scheme.addEventListener("change", onScheme);
  moreContrast.addEventListener("change", onScheme);

  return {
    resize,
    launch(place, start, copy, done) {
      readTheme();
      finished = done;
      figure = copy;
      turnPoints(world, 0, 0, view);
      const route = routeFrom(routes, start >= 0 && start < count ? start : exits[0]);
      if (route.length < 2) route.push(route[0] + 1 < count ? route[0] + 1 : route[0] - 1);
      path = buildFlightPath(graph, view, route, routes);
      onRoute.fill(0);
      for (const lesson of route) onRoute[lesson] = 1;
      routeLinks = new Uint8Array(linkCount);
      for (let index = 1; index < route.length; index++) {
        for (let link = 0; link < linkCount; link++) {
          const from = graph.links[link * 2];
          const to = graph.links[link * 2 + 1];
          if ((from === route[index - 1] && to === route[index]) || (to === route[index - 1] && from === route[index])) routeLinks[link] = 1;
        }
      }
      prevOn.fill(0);
      const eye = copy.eyes[copy.chosen];
      place.orbX = eye.x;
      place.orbY = eye.y;
      return { x: eye.x, y: eye.y };
    },
    draw: (progress, place, filmed) => draw(progress, place, filmed),
    route: () => path?.route ?? [],
    destroy() {
      scheme.removeEventListener("change", onScheme);
      moreContrast.removeEventListener("change", onScheme);
      path = null;
      figure = null;
    },
  };
}
