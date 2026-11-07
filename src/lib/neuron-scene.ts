import { arborsFor, BEADS_PER_LINK, somaPath, strokeOf, STUB_INK, STUB_REACH, type Arbors } from "./orb-arbor";
import type { OrbGraph } from "./orb-layout";
import { arcPoint, foldPoint } from "./orb-motion";
import {
  arcControl, CAMERA, CHAPTER_LINE, dotAlpha, dotRadius, FIT, foldHandles, foldNeighbors, lineAlpha, linkDegrees, nearness, ORB_RADIUS, RELATED_LINE,
} from "./orb-view";
import { axisAt, FILM, onFilm, type Film, type Shot } from "./neuron-film";
import {
  buildFlightPath, chooseEntry, FLIGHT, flightDistance, pathIndex, pathPoint, ramp, routeFrom, routesTo, turnPoints, type FlightPath, type Routes, type Vec,
} from "./neuron-route";

// The dive from the orb to the game, drawn on one canvas over the whole screen. It starts as an exact copy of the
// orb, so it can take over without a seam, and everything it draws is the course: the dots are lessons, the lines
// are their links, and the tube is the route itself. Inside, it uses the two neutrals the other way round, so
// going through an ink dot in the light theme really is going into ink. A 2D canvas is enough for a few thousand
// segments a frame, and it keeps the dive to a few kilobytes that load after the first screen.

const ARC_STEPS = 8; // The same samples the orb draws, so the first frame lands on it exactly.
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

export type NeuronPlace = {
  /** The orb's center and size on screen, which the first frame matches. */
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

export type NeuronScene = {
  resize: () => void;
  /** Picks the dot and the route from the angle the orb is showing. Returns the dot's offset from the orb's center, in pixels. */
  launch: (view: { yaw: number; pitch: number }, place: NeuronPlace, finished: boolean[], hint: { x: number; y: number } | null, lens: number, stains?: { reach: Float32Array; ink: Float32Array } | null) => { x: number; y: number };
  /** Draws a frame and says where the dot being dived into is on screen. With a film, the inside is left to the WebGL canvas. */
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
  // The neurons the orb has grown are added at the first dive, so its first frame has them too: their dendrites, and
  // the point each cell body makes toward its apical dendrite.
  let arbors: Arbors | null = null;
  const ARBOR = FOLD + count * (FOLD_STEPS + 1);
  let APEX = ARBOR;
  let total = ARBOR;
  let world = new Float32Array(total * 3);
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

  let view = new Float32Array(world.length);
  let camX = new Float32Array(total);
  let camY = new Float32Array(total);
  let camZ = new Float32Array(total);

  function withArbors() {
    if (arbors) return;
    arbors = arborsFor(graph.positions, degrees, graph.links);
    APEX = ARBOR + arbors.owner.length * 2;
    total = APEX + count;
    const grown = new Float32Array(total * 3);
    grown.set(world.subarray(0, ARBOR * 3));
    grown.set(arbors.ends, ARBOR * 3);
    for (let lesson = 0; lesson < count; lesson++) {
      for (let axis = 0; axis < 3; axis++) grown[(APEX + lesson) * 3 + axis] = graph.positions[lesson * 3 + axis] + arbors.apex[lesson * 3 + axis] * 0.05;
    }
    world = grown;
    view = new Float32Array(world.length);
    camX = new Float32Array(total);
    camY = new Float32Array(total);
    camZ = new Float32Array(total);
  }
  const order = Array.from({ length: count }, (_, lesson) => lesson);
  const prevX = new Float32Array(count);
  const prevY = new Float32Array(count);
  const prevOn = new Uint8Array(count);
  const fire = new Float32Array(count);
  const onRoute = new Uint8Array(count);
  const batches: number[][] = Array.from({ length: WIDTHS.length * (ALPHA_STEPS + 1) }, () => []);
  const glow = makeGlow();

  let path: FlightPath | null = null;
  let reach: Float32Array<ArrayBufferLike> = new Float32Array(count);
  let ink: Float32Array<ArrayBufferLike> = new Float32Array(count);
  let labelSide = 0; // Which side of the dot its name goes, chosen once so it doesn't jump as the orb swings.
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
  let suck = 0;
  let suckX = 0;
  let suckY = 0;
  let suckReach = 1;
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
    pull(screen);
    return screen;
  }

  /** Before the dive, the orb leans toward the dot like something being drawn in. */
  function pull(point: { x: number; y: number }) {
    if (suck <= 0) return;
    const dx = point.x - suckX;
    const dy = point.y - suckY;
    const m = (suck * suckReach) / (suckReach + dx * dx + dy * dy);
    point.x -= dx * m;
    point.y -= dy * m;
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
    pull(a);
    pull(b);
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

  /** The course's links and threads, as on the orb from outside (mix 0) or from within (mix 1). */
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

  /** The orb's neurons, as the orb was drawing them when the dive began. They give way as the camera goes in. */
  function collectArbors(mix: number) {
    if (!arbors) return;
    const keep = 1 - ramp(0, 0.45, mix);
    if (keep <= 0) return;
    for (let lesson = 0; lesson < count; lesson++) {
      const stained = reach[lesson];
      for (let index = arbors.starts[lesson]; index < arbors.starts[lesson + 1]; index++) {
        const stub = arbors.stub[index] === 1;
        const out = Math.max(stained, stub ? arbors.to[index] * STUB_REACH : 0);
        const start = arbors.from[index];
        if (out <= start + 1e-4) continue;
        const share = Math.min(1, (out - start) / Math.max(1e-4, arbors.to[index] - start));
        const i = ARBOR + index * 2;
        const j = i + 1;
        const depth = nearness((view[i * 3 + 2] + view[j * 3 + 2]) / 2);
        const { alpha, width } = strokeOf(depth, arbors.rank[index], Math.max(ink[lesson], stub ? STUB_INK : 0), hair);
        const z2 = camZ[i] + (camZ[j] - camZ[i]) * share;
        // Widths are on the orb's scale; up close they grow with it.
        const near = (CAMERA - (view[i * 3 + 2] + view[j * 3 + 2]) / 2) / Math.max(NEAR, (camZ[i] + z2) / 2) * (focal / startFocal);
        segment(camX[i], camY[i], camZ[i], camX[i] + (camX[j] - camX[i]) * share, camY[i] + (camY[j] - camY[i]) * share, z2, alpha * keep, width * Math.max(1, near));
      }
    }
  }

  /** The beads on the axons, as the orb draws them. */
  function drawBeads(color: string, mix: number, fade: number) {
    if (!arbors) return;
    const keep = (1 - ramp(0, 0.3, mix)) * fade;
    if (keep <= 0.02) return;
    ctx.fillStyle = color;
    for (let link = 0; link < linkCount; link++) {
      for (let bead = 0; bead < BEADS_PER_LINK; bead++) {
        const along = arbors.beads[link * BEADS_PER_LINK + bead] * ARC_STEPS;
        const step = Math.min(ARC_STEPS - 1, Math.floor(along));
        const t = along - step;
        const i = ARC + link * (ARC_STEPS + 1) + step;
        const z = camZ[i] + (camZ[i + 1] - camZ[i]) * t;
        if (z < NEAR) continue;
        const depth = nearness(view[i * 3 + 2] + (view[(i + 1) * 3 + 2] - view[i * 3 + 2]) * t);
        if (depth < 0.45) continue;
        a.x = originX + ((camX[i] + (camX[i + 1] - camX[i]) * t) * focal) / z;
        a.y = originY - ((camY[i] + (camY[i + 1] - camY[i]) * t) * focal) / z;
        pull(a);
        const size = (hair * (1.1 + 0.9 * depth) * (focal / startFocal)) / 2;
        ctx.globalAlpha = Math.min(1, lineAlpha(depth, RELATED_LINE * 2.2) * keep * theme.contrast);
        ctx.beginPath();
        ctx.arc(a.x, a.y, size, 0, Math.PI * 2);
        ctx.fill();
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
      pull(a);
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
      // Pointed toward its apical dendrite, as on the orb, until the camera is inside.
      const apex = APEX + lesson;
      const z = camZ[apex];
      let tip = 0;
      let ux = 0;
      let uy = -1;
      if (arbors && z > NEAR && mix < 1) {
        b.x = originX + (camX[apex] * focal) / z;
        b.y = originY - (camY[apex] * focal) / z;
        pull(b);
        ux = b.x - dotX[lesson];
        uy = b.y - dotY[lesson];
        const length = Math.hypot(ux, uy) || 1;
        const side = Math.min(1, length / ((0.05 * focal) / Math.max(NEAR, camZ[lesson])));
        ux /= length;
        uy /= length;
        tip = dotSize[lesson] * (0.45 + 0.75 * reach[lesson]) * side * (1 - mix);
      }
      somaPath(ctx, dotX[lesson], dotY[lesson], dotSize[lesson], ux, uy, tip);
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
    // The view swings from the orb's center to the dot as the dot takes hold.
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

    // The dot the orb is drawn into, and how much of the screen its inside has taken.
    const entry = path.route[0];
    const entryZ = camZ[entry];
    const entryScale = focal / Math.max(NEAR, entryZ);
    a.x = originX + camX[entry] * entryScale;
    a.y = originY - camY[entry] * entryScale;
    const strain = ramp(0, FLIGHT.pull, progress);
    suck = 0;
    suckX = a.x;
    suckY = a.y;
    const viewZ = view[entry * 3 + 2];
    const entrySize = (dotRadius(nearness(viewZ), degrees[entry], finished[entry] ?? false, radius) * (CAMERA - viewZ) * focal) / (Math.max(NEAR, entryZ) * startFocal);
    const corner = Math.hypot(Math.max(a.x, width - a.x), Math.max(a.y, height - a.y));
    const opening = ramp(FLIGHT.pull + 0.03, FLIGHT.covered, progress);
    const portal = entryZ < NEAR * 2 || progress >= FLIGHT.covered ? Infinity : entrySize * (1 + strain * 0.8) + corner * opening * opening * opening;
    const mix = ramp(FLIGHT.pull, FLIGHT.covered, progress);

    if (portal < corner) {
      // Outside: the orb, in the page's colors, over a veil that hides the page as it falls away.
      suck = 0.3 * strain * (1 - ramp(FLIGHT.covered - 0.06, FLIGHT.covered, progress));
      suckReach = (radius * 0.7) ** 2;
      ctx.globalAlpha = ramp(0, FLIGHT.pull + 0.04, progress) * 0.97;
      ctx.fillStyle = theme.canvas;
      ctx.fillRect(0, 0, width, height);
      lift = (theme.dark ? 1.22 : 1) * theme.contrast;
      const fade = ramp(0, 0.012, progress);
      collectLines(mix);
      strokeBatches(theme.ink, lift * fade);
      drawBeads(theme.ink, mix, fade);
      collectArbors(mix);
      strokeBatches(theme.ink, lift * fade);
      drawDots(theme.ink, mix, fade, false);
      // The dot takes the strain before it gives: it swells, and a ring closes in on it.
      const ringPhase = strain * (1 - opening);
      if (ringPhase > 0.01) {
        ctx.strokeStyle = theme.ink;
        ctx.globalAlpha = ringPhase * 0.8;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(a.x, a.y, portal + 4 + (1 - strain) * 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = ringPhase;
        ctx.fillStyle = theme.ink;
        ctx.beginPath();
        ctx.arc(a.x, a.y, portal, 0, Math.PI * 2);
        ctx.fill();
        const label = graph.titles[entry];
        ctx.font = `680 ${radius < 200 ? 13 : 15}px ${theme.font}`;
        ctx.textBaseline = "middle";
        if (!labelSide) labelSide = a.x + portal + 14 + ctx.measureText(label).width < width - 12 || a.x < width / 2 ? 1 : -1;
        const onRight = labelSide > 0;
        ctx.textAlign = onRight ? "left" : "right";
        const x = a.x + (onRight ? portal + 14 : -portal - 14);
        ctx.lineJoin = "round";
        ctx.lineWidth = 5;
        ctx.strokeStyle = theme.canvas;
        ctx.globalAlpha = ringPhase;
        ctx.strokeText(label, x, a.y);
        ctx.fillStyle = theme.ink;
        ctx.fillText(label, x, a.y);
      }
      if (portal > 3 && filmed) {
        // The dot opens onto the neuron, which the canvas beneath is drawing.
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(a.x, a.y, portal, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = theme.ink;
        ctx.lineWidth = Math.min(3, 1 + portal / 120);
        ctx.beginPath();
        ctx.arc(a.x, a.y, portal, 0, Math.PI * 2);
        ctx.stroke();
      } else if (portal > 3) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(a.x, a.y, portal, 0, Math.PI * 2);
        ctx.clip();
        drawInside(progress, along, 1, true);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = theme.ink;
        ctx.lineWidth = Math.min(3, 1 + portal / 120);
        ctx.beginPath();
        ctx.arc(a.x, a.y, portal, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (filmed) {
      drawFilmNames(filmed, progress);
    } else {
      drawInside(progress, along, 1, false);
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

  /** The inside of the orb: dark, the course's lines lit, the route as a fibre, and the signal ahead. */
  function drawInside(progress: number, along: number, mix: number, clipped: boolean) {
    const savedSuck = suck;
    suck = clipped ? suck : 0;
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
    suck = savedSuck;
  }

  readTheme();
  resize();
  const onScheme = () => readTheme();
  scheme.addEventListener("change", onScheme);
  moreContrast.addEventListener("change", onScheme);

  return {
    resize,
    launch(angle, place, done, hint, lens, stains) {
      withArbors();
      readTheme();
      finished = done;
      reach = stains?.reach ?? new Float32Array(count);
      ink = stains?.ink ?? new Float32Array(count);
      turnPoints(world, angle.yaw, angle.pitch, view);
      const entry = chooseEntry(graph, view, routes, { hint, lens });
      const route = routeFrom(routes, entry < 0 ? exits[0] : entry);
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
      labelSide = 0;
      const orbRadius = place.orbSize * ORB_RADIUS * FIT;
      const p = route[0];
      const scaleTo = CAMERA / (CAMERA - view[p * 3 + 2]);
      return { x: view[p * 3] * scaleTo * orbRadius, y: -view[p * 3 + 1] * scaleTo * orbRadius };
    },
    draw: (progress, place, filmed) => draw(progress, place, filmed),
    route: () => path?.route ?? [],
    destroy() {
      scheme.removeEventListener("change", onScheme);
      moreContrast.removeEventListener("change", onScheme);
      path = null;
    },
  };
}
