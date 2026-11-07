import { restingOutline } from "./brain-body";
import { surfaceTriangles } from "./brain-folds";
import { cerebrumField, lobePreference, normalOf, ontoSurface, pieceField, pieceSamples, type Vec3 } from "./brain-shape";
import { turned, VIEW } from "./orb-view";

// Places every lesson on a brain, so the course reads as one: each part is a lobe, each chapter a gyrus winding
// through its lessons, and the two halves of a part sit in the two hemispheres, either side of the fissure. This runs
// at build time. The browser only ever receives the rounded result, so the server and every browser draw exactly the
// same brain.

export type OrbChapterInput = {
  id: string;
  part: string;
  steps: { id: string; title: string; related?: { chapterId: string; stepId: string }[] }[];
};

export type OrbGraph = {
  /** x, y, z for each lesson in course order, on the brain's surface inside the unit sphere. */
  positions: number[];
  titles: string[];
  /** Where each chapter's lessons begin, then the lesson count. */
  chapterStarts: number[];
  /** Index into partTitles for each chapter. */
  chapterParts: number[];
  partTitles: string[];
  /** Pairs of lesson indexes, one pair per `related` link. */
  links: number[];
  /**
   * The brain's outline at rest, farthest piece first, as SVG path data on the first paint's square. The first paint
   * draws it, and so does the live map until it has traced its own, so neither has to work it out while the page loads.
   */
  outline: string[];
};

/** Where a part sits: one of three regions of the cerebrum's surface, or the cerebellum. */
export type Region = "frontal" | "parietal" | "temporal" | "cerebellum";

/**
 * The course's four parts in order. Thinking like a designer is estimating and judging scale, which is what the
 * parietal lobe does with numbers and space; how data behaves is memory, the temporal lobe's; keeping systems healthy
 * is balance and timing, the cerebellum's; and designing real products is planning and doing, the frontal lobe's.
 * The temporal region runs back into the occipital lobe, as it does on a real brain, where no groove divides them.
 */
const COURSE_REGIONS: Region[] = ["parietal", "temporal", "cerebellum", "frontal"];
const OTHER_REGIONS: Region[] = ["parietal", "temporal", "frontal"];
/** Which way a region's gyri run, as the axis its chapters are stacked along, from the first chapter to the last. */
const STACKING: Record<Region, Vec3> = { frontal: [0, -1, 0], parietal: [0, 0, -1], temporal: [0, -1, 0], cerebellum: [0, -1, 0] };

const STRETCH = 2.2; // How much longer than wide a gyrus comes out, where gyri lie side by side.
const STRIP_PULL = 0.16; // How far a chapter's lessons draw in across its gyrus, which opens the grooves between gyri.
const PART_PULL = 0.05;
const CANDIDATES = 2600;

type Vector = Vec3;
const add = (a: Vector, b: Vector, scale = 1): Vector => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: Vector, b: Vector) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (points: Vector[]): Vector => {
  const sum = points.reduce<Vector>((total, point) => add(total, point), [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
};

export function regionsFor(partCount: number): Region[] {
  return partCount === COURSE_REGIONS.length ? COURSE_REGIONS : Array.from({ length: partCount }, (_, part) => OTHER_REGIONS[part % OTHER_REGIONS.length]);
}

type Field = (x: number, y: number, z: number) => number;

/** Points over the visible outer surface of one side of a piece: not inside the fissure, under another piece, or facing straight down. */
function candidatesOn(piece: "cerebrum" | "cerebellum", side: number): Vector[] {
  const shape = piece === "cerebellum" ? "cerebellum" : side > 0 ? "right" : "left";
  const field: Field = (x, y, z) => pieceField(shape, x, y, z);
  const surface = pieceSamples(shape, CANDIDATES, 0);
  const normal: Vector = [0, 0, 0];
  const out: Vector[] = [];
  for (let index = 0; index < CANDIDATES; index++) {
    const p: Vector = [surface[index * 3], surface[index * 3 + 1], surface[index * 3 + 2]];
    if (p[0] * side < 0.03) continue;
    normalOf(field, p, normal);
    if (normal[0] * side < -0.35 && Math.abs(p[0]) < 0.12) continue; // The wall inside the fissure.
    if (normal[1] < -0.62) continue; // The underside, which only shows from below.
    if (piece === "cerebrum" && pieceField("cerebellum", p[0], p[1], p[2]) < 0.035) continue;
    if (piece === "cerebellum" && (cerebrumField(p[0], p[1], p[2]) < 0.035 || normal[2] > 0.55)) continue;
    if (pieceField("stem", p[0], p[1], p[2]) < 0.04) continue;
    out.push(p);
  }
  return out;
}

/**
 * The given number of points spread evenly over the candidates: picked far apart first, then each moved to the middle
 * of the candidates nearest it, a few times over, and put back on the surface.
 */
function spread(candidates: Vector[], count: number, field: Field): Vector[] {
  if (count <= 0 || !candidates.length) return [];
  const centers: Vector[] = [];
  const nearest = candidates.map(() => Infinity);
  let pick = candidates.reduce((best, point, index) => point[2] > candidates[best][2] ? index : best, 0);
  while (centers.length < count) {
    centers.push([...candidates[pick]]);
    let far = 0;
    candidates.forEach((point, index) => {
      nearest[index] = Math.min(nearest[index], distance(point, centers[centers.length - 1]));
      if (nearest[index] > nearest[far]) far = index;
    });
    pick = far;
  }
  const owner = new Int32Array(candidates.length);
  for (let round = 0; round < 24; round++) {
    candidates.forEach((point, index) => {
      let best = 0;
      for (let center = 1; center < centers.length; center++) if (distance(point, centers[center]) < distance(point, centers[best])) best = center;
      owner[index] = best;
    });
    centers.forEach((center, index) => {
      const mine = candidates.filter((_, candidate) => owner[candidate] === index);
      if (!mine.length) return;
      const moved = ontoSurface(field, mean(mine), 8);
      // The middle of a patch that curves away can fall onto the wrong wall; then it keeps its nearest candidate.
      const closest = mine.reduce((best, point) => distance(point, moved) < distance(best, moved) ? point : best);
      const kept = distance(closest, moved) < 0.08 ? moved : closest;
      center[0] = kept[0]; center[1] = kept[1]; center[2] = kept[2];
    });
  }
  return centers;
}

/** The share of a hemisphere's points a region claims first, with the lowest scores going to it. */
function regionScore(region: Region, point: Vector) {
  if (region === "temporal") return Math.min(lobePreference(point, "temporal", ["frontal", "parietal"]), lobePreference(point, "occipital", ["frontal", "parietal"]) + 0.02);
  if (region === "frontal") return lobePreference(point, "frontal", ["parietal", "occipital"]);
  return lobePreference(point, "parietal", ["frontal", "temporal", "occipital"]);
}

/** Splits a hemisphere's points between the parts on it, each taking the points that suit its lobe best. */
function carveRegions(points: Vector[], claims: { region: Region; count: number; key: number }[]) {
  const result = new Map<number, Vector[]>();
  let left = [...points];
  const order: Region[] = ["temporal", "frontal", "parietal"];
  const sorted = [...claims].sort((a, b) => order.indexOf(a.region) - order.indexOf(b.region));
  sorted.forEach((claim, index) => {
    if (index === sorted.length - 1) {
      result.set(claim.key, left);
      return;
    }
    const ranked = [...left].sort((a, b) => regionScore(claim.region, a) - regionScore(claim.region, b));
    result.set(claim.key, ranked.slice(0, claim.count));
    left = ranked.slice(claim.count);
  });
  return result;
}

/**
 * Cuts a region into one gyrus per chapter. Where a lobe's gyri run side by side, as in the frontal and parietal
 * lobes, the cut is made with distances stretched along the axis they're stacked on, so each chapter comes out long
 * and narrow but still in one piece.
 */
function gyri(points: Vector[], counts: number[], axis: Vector, stretch: number) {
  const stretched = points.map((point) => add(point, axis, dot(point, axis) * (stretch - 1)));
  const owner = new Map(stretched.map((point, index) => [point, points[index]]));
  return patches(stretched, counts).map((patch) => patch.map((point) => owner.get(point) as Vector));
}

/**
 * Makes sure every chapter is one piece over the surface, as the grooves see it. A lesson cut off from the rest of its
 * chapter trades places with a lesson of the chapter around it, from the same part and hemisphere, that touches the
 * rest, as long as that leaves the other chapter in one piece too.
 */
function mended(groups: Vector[][], sameRegion: (a: number, b: number) => boolean) {
  const points = groups.flat();
  const index = new Map(points.map((point, at) => [point, at]));
  const near: Vector[][] = points.map(() => []);
  const triangles = surfaceTriangles(points.flat());
  for (let at = 0; at < triangles.length; at += 3) {
    const [a, b, c] = [triangles[at], triangles[at + 1], triangles[at + 2]];
    for (const [p, q] of [[a, b], [b, c], [a, c]]) { near[p].push(points[q]); near[q].push(points[p]); }
  }
  const owner = new Map<Vector, number>();
  groups.forEach((group, at) => group.forEach((point) => owner.set(point, at)));
  const neighbours = (point: Vector) => near[index.get(point) as number];
  const pieces = (group: number) => {
    const found: Vector[][] = [];
    const seen = new Set<Vector>();
    for (const start of points) {
      if (owner.get(start) !== group || seen.has(start)) continue;
      const piece = [start];
      seen.add(start);
      for (let at = 0; at < piece.length; at++) {
        for (const other of neighbours(piece[at])) if (owner.get(other) === group && !seen.has(other)) { seen.add(other); piece.push(other); }
      }
      found.push(piece);
    }
    return found.sort((a, b) => b.length - a.length);
  };
  const stuck = new Set<number>();
  for (let round = 0; round < 80; round++) {
    const broken = groups.findIndex((_, group) => !stuck.has(group) && pieces(group).length > 1);
    if (broken < 0) break;
    const [main, ...strays] = pieces(broken);
    const stray = strays[strays.length - 1][0];
    const counts = new Map<number, number>();
    for (const other of neighbours(stray)) {
      const host = owner.get(other) as number;
      if (host !== broken && sameRegion(host, broken)) counts.set(host, (counts.get(host) ?? 0) + 1);
    }
    const middle = mean(main);
    let traded = false;
    for (const [host] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const offers = points.filter((point) => owner.get(point) === host && neighbours(point).some((other) => main.includes(other)))
        .sort((a, b) => distance(a, middle) - distance(b, middle));
      for (const offer of offers) {
        owner.set(stray, host);
        owner.set(offer, broken);
        if (pieces(host).length === 1) { traded = true; break; }
        owner.set(stray, broken);
        owner.set(offer, host);
      }
      if (traded) break;
    }
    if (!traded) stuck.add(broken);
  }
  return groups.map((_, group) => points.filter((point) => owner.get(point) === group));
}

/** The direction a set of points is longest in. */
function longestAxis(points: Vector[]): Vector {
  const center = mean(points);
  const offsets = points.map((point) => add(point, center, -1));
  let axis: Vector = [0.31, 0.47, 0.83];
  for (let round = 0; round < 24; round++) {
    let next: Vector = [0, 0, 0];
    for (const offset of offsets) next = add(next, offset, dot(offset, axis));
    const length = Math.hypot(next[0], next[1], next[2]) || 1;
    axis = [next[0] / length, next[1] / length, next[2] / length];
  }
  return axis;
}

/**
 * Cuts a region that curls round, like the temporal lobe running back into the occipital, into compact patches in
 * course order: halves across its longest direction, then halves of those, so neighbours in the course stay
 * neighbours. Swapping points between patches then rounds them off at the same size.
 */
function patches(points: Vector[], counts: number[]): Vector[][] {
  const out: Vector[][] = counts.map(() => []);
  const cut = (part: Vector[], first: number, last: number) => {
    if (first === last) {
      out[first] = part;
      return;
    }
    const total = counts.slice(first, last + 1).reduce((sum, count) => sum + count, 0);
    let split = first;
    let leftCount = counts[first];
    let best = Math.abs(total - 2 * leftCount);
    for (let index = first + 1, running = leftCount; index < last; index++) {
      running += counts[index];
      if (Math.abs(total - 2 * running) < best) { best = Math.abs(total - 2 * running); split = index; leftCount = running; }
    }
    const axis = longestAxis(part);
    const sorted = [...part].sort((a, b) => dot(a, axis) - dot(b, axis));
    cut(sorted.slice(0, leftCount), first, split);
    cut(sorted.slice(leftCount), split + 1, last);
  };
  if (counts.length) cut(points, 0, counts.length - 1);
  for (let pass = 0; pass < 32; pass++) {
    const centers = out.map(mean);
    let swapped = false;
    for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) {
      for (let i = 0; i < out[a].length; i++) for (let j = 0; j < out[b].length; j++) {
        const now = distance(out[a][i], centers[a]) ** 2 + distance(out[b][j], centers[b]) ** 2;
        const then = distance(out[a][i], centers[b]) ** 2 + distance(out[b][j], centers[a]) ** 2;
        if (then + 1e-9 < now) {
          [out[a][i], out[b][j]] = [out[b][j], out[a][i]];
          swapped = true;
        }
      }
    }
    if (!swapped) break;
  }
  return out;
}

/** A short route through a chapter's points, so the line between consecutive lessons doesn't tangle. */
function route(points: Vector[], from: Vector): Vector[] {
  const left = [...points];
  const path: Vector[] = [];
  let current = from;
  while (left.length) {
    let nearest = 0;
    for (let index = 1; index < left.length; index++) {
      if (distance(left[index], current) < distance(left[nearest], current)) nearest = index;
    }
    current = left.splice(nearest, 1)[0];
    path.push(current);
  }
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < path.length - 2; i++) for (let j = i + 1; j < path.length - 1; j++) {
      const before = distance(path[i], path[i + 1]) + distance(path[j], path[j + 1]);
      const after = distance(path[i], path[j]) + distance(path[i + 1], path[j + 1]);
      if (after + 1e-9 < before) {
        path.splice(i + 1, j - i, ...path.slice(i + 1, j + 1).reverse());
        improved = true;
      }
    }
  }
  return path;
}

/**
 * Each part's chapters are split in course order between the hemisphere facing the viewer and the one behind it,
 * so a part's first chapters face the viewer and the two halves of the brain hold about the same number of lessons.
 */
function splitHalves(partChapters: number[][], sizes: number[]) {
  type Choice = { cut: number; facingFirst: boolean };
  const options = partChapters.map((chapters, part) => {
    const choices: Choice[] = [];
    for (let cut = 0; cut <= chapters.length; cut++) for (const facingFirst of [true, false]) {
      if (part === 0 && chapters.length && ((cut === 0 && facingFirst) || (cut > 0 && !facingFirst))) continue;
      choices.push({ cut, facingFirst });
    }
    return choices;
  });
  let best: Choice[] = options.map((choices) => choices[0]);
  let bestCost = Infinity;
  const walk = (part: number, picked: Choice[]) => {
    if (part === options.length) {
      let facing = 0;
      let behind = 0;
      let cost = 0;
      picked.forEach(({ cut, facingFirst }, index) => {
        const first = partChapters[index].slice(0, cut).reduce((sum, chapter) => sum + sizes[chapter], 0);
        const rest = partChapters[index].slice(cut).reduce((sum, chapter) => sum + sizes[chapter], 0);
        cost += Math.abs(first - rest);
        if (facingFirst) { facing += first; behind += rest; } else { facing += rest; behind += first; }
      });
      cost += Math.abs(facing - behind) * 2;
      if (cost < bestCost) { bestCost = cost; best = [...picked]; }
      return;
    }
    for (const choice of options[part]) walk(part + 1, [...picked, choice]);
  };
  walk(0, []);
  return best;
}

const rounded = (value: number) => Math.round(value * 1000) / 1000;

export function buildOrbGraph(chapters: OrbChapterInput[]): OrbGraph {
  const partTitles = [...new Set(chapters.map((chapter) => chapter.part))];
  const chapterParts = chapters.map((chapter) => partTitles.indexOf(chapter.part));
  const sizes = chapters.map((chapter) => chapter.steps.length);
  const regions = regionsFor(partTitles.length);
  const partChapters = partTitles.map((_, part) => chapters.flatMap((__, index) => chapterParts[index] === part ? [index] : []));

  // The hemisphere facing the viewer at rest, and the one behind it.
  const facingSide = Math.sign(turned(1, 0, 0, VIEW.yaw, VIEW.pitch)[2]) || 1;
  const halves = splitHalves(partChapters, sizes);
  const sideOf = new Map<number, number>();
  halves.forEach(({ cut, facingFirst }, part) => partChapters[part].forEach((chapter, order) => {
    sideOf.set(chapter, (order < cut) === facingFirst ? facingSide : -facingSide);
  }));

  const placed: Vector[][] = chapters.map(() => []);
  for (const side of [facingSide, -facingSide]) {
    for (const piece of ["cerebrum", "cerebellum"] as const) {
      const parts = partTitles.flatMap((_, part) => (regions[part] === "cerebellum") === (piece === "cerebellum") ? [part] : []);
      const claims = parts.map((part) => ({
        region: regions[part],
        key: part,
        count: partChapters[part].filter((chapter) => sideOf.get(chapter) === side).reduce((sum, chapter) => sum + sizes[chapter], 0),
      })).filter((claim) => claim.count > 0);
      const total = claims.reduce((sum, claim) => sum + claim.count, 0);
      if (!total) continue;
      const shape = piece === "cerebellum" ? "cerebellum" : side > 0 ? "right" : "left";
      const field: Field = (x, y, z) => pieceField(shape, x, y, z);
      const points = spread(candidatesOn(piece, side), total, field);
      const byPart = piece === "cerebrum" ? carveRegions(points, claims) : new Map([[claims[0].key, points]]);
      for (const claim of claims) {
        const region = byPart.get(claim.key) ?? [];
        const partCenter = mean(region);
        const mine = partChapters[claim.key].filter((chapter) => sideOf.get(chapter) === side);
        const axis = STACKING[claim.region];
        const counts = mine.map((chapter) => sizes[chapter]);
        gyri(region, counts, axis, claim.region === "temporal" ? 1 : STRETCH).forEach((strip, order) => {
          const chapter = mine[order];
          const middle = dot(mean(strip), axis);
          placed[chapter] = strip.map((point) => {
            // Each gyrus draws in across itself, and each lobe toward its middle, so the grooves between them open up.
            const across = (middle - dot(point, axis)) * STRIP_PULL;
            const moved = add(add(point, axis, across), add(partCenter, point, -1), PART_PULL);
            return ontoSurface(field, moved, 8);
          });
        });
      }
    }
  }

  const mendedPlaces = mended(placed, (a, b) => chapterParts[a] === chapterParts[b] && sideOf.get(a) === sideOf.get(b));
  mendedPlaces.forEach((points, chapter) => { placed[chapter] = points; });

  // The course begins on the lesson of its first chapter nearest the viewer, clear of the glass in the middle.
  const facingPoint = (point: Vector) => {
    const [x, y, z] = turned(point[0], point[1], point[2], VIEW.yaw, VIEW.pitch);
    return z - Math.max(0, 0.4 - Math.hypot(x, y)) * 4 + y * 0.3;
  };
  const positions: number[] = [];
  const chapterStarts: number[] = [];
  let previous: Vector | null = null;
  placed.forEach((points) => {
    chapterStarts.push(positions.length / 3);
    if (!points.length) return;
    const from = previous ?? points.reduce((best, point) => facingPoint(point) > facingPoint(best) ? point : best);
    const path = route(points, from);
    previous = path[path.length - 1];
    for (const point of path) positions.push(rounded(point[0]), rounded(point[1]), rounded(point[2]));
  });
  chapterStarts.push(positions.length / 3);

  const lessonIndex = new Map(chapters.flatMap((chapter, index) => chapter.steps.map((step, offset) => [`${chapter.id}/${step.id}`, chapterStarts[index] + offset] as const)));
  const links: number[] = [];
  chapters.forEach((chapter) => chapter.steps.forEach((step) => {
    const from = lessonIndex.get(`${chapter.id}/${step.id}`);
    for (const { chapterId, stepId } of step.related ?? []) {
      const to = lessonIndex.get(`${chapterId}/${stepId}`);
      if (from !== undefined && to !== undefined && from !== to) links.push(from, to);
    }
  }));

  return { positions, titles: chapters.flatMap((chapter) => chapter.steps.map((step) => step.title)), chapterStarts, chapterParts, partTitles, links, outline: restingOutline() };
}
