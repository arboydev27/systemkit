// Places every lesson on a sphere so the course reads as a brain: chapters are folds, parts are lobes, and
// the gap between the two halves of the course is the fissure. This runs at build time. The browser only ever
// receives the rounded result, so the server and every browser draw exactly the same orb.

export type OrbChapterInput = {
  id: string;
  part: string;
  steps: { id: string; title: string; related?: { chapterId: string; stepId: string }[] }[];
};

export type OrbGraph = {
  /** x, y, z for each lesson in course order, within the unit sphere. */
  positions: number[];
  titles: string[];
  /** Where each chapter's lessons begin, then the lesson count. */
  chapterStarts: number[];
  /** Index into partTitles for each chapter. */
  chapterParts: number[];
  partTitles: string[];
  /** Pairs of lesson indexes, one pair per `related` link. */
  links: number[];
};

type Vector = [number, number, number];

const CHAPTER_PULL = 0.27;
const PART_PULL = 0.08;
const FOLD_HEIGHT = 0.06;
const FISSURE = 0.075;

const add = (a: Vector, b: Vector, scale = 1): Vector => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: Vector, b: Vector) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const normalize = (a: Vector): Vector => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const mean = (points: Vector[]): Vector => {
  const sum = points.reduce<Vector>((total, point) => add(total, point), [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
};

function fibonacciSphere(count: number): Vector[] {
  const turn = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (2 * index + 1) / count;
    const ring = Math.sqrt(1 - y * y);
    return [Math.cos(turn * index) * ring, y, Math.sin(turn * index) * ring];
  });
}

/** The direction a set of points is longest in, facing the viewer so earlier chapters land in front. */
function longestAxis(points: Vector[]): Vector {
  const center = mean(points);
  const offsets = points.map((point) => add(point, center, -1));
  let axis: Vector = normalize([0.31, 0.47, 0.83]);
  for (let round = 0; round < 24; round++) {
    let next: Vector = [0, 0, 0];
    for (const offset of offsets) next = add(next, offset, dot(offset, axis));
    axis = normalize(next);
  }
  return axis[2] > 0 ? [-axis[0], -axis[1], -axis[2]] : axis;
}

type Region = { weight: number; index: number };

/** Cuts points between regions in order, so neighbors in the course stay neighbors on the sphere. */
function carve(points: Vector[], regions: Region[], axes: Vector[], result: Vector[][]) {
  if (regions.length === 1) {
    result[regions[0].index] = points;
    return;
  }
  const total = regions.reduce((sum, region) => sum + region.weight, 0);
  let split = 1;
  let leftWeight = regions[0].weight;
  let best = Math.abs(total - 2 * leftWeight);
  for (let index = 2, running = leftWeight; index < regions.length; index++) {
    running += regions[index - 1].weight;
    const balance = Math.abs(total - 2 * running);
    if (balance < best) { best = balance; split = index; leftWeight = running; }
  }
  const [axis = longestAxis(points), ...rest] = axes;
  const sorted = [...points].sort((a, b) => dot(a, axis) - dot(b, axis));
  carve(sorted.slice(0, leftWeight), regions.slice(0, split), rest, result);
  carve(sorted.slice(leftWeight), regions.slice(split), rest, result);
}

/** Straight cuts leave boxy chapters. Swapping points between neighbors rounds them off at the same size. */
function roundOff(groups: Vector[][]) {
  for (let pass = 0; pass < 32; pass++) {
    const centers = groups.map(mean);
    let swapped = false;
    for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) {
      for (let i = 0; i < groups[a].length; i++) for (let j = 0; j < groups[b].length; j++) {
        const now = distance(groups[a][i], centers[a]) ** 2 + distance(groups[b][j], centers[b]) ** 2;
        const then = distance(groups[a][i], centers[b]) ** 2 + distance(groups[b][j], centers[a]) ** 2;
        if (then + 1e-9 < now) {
          [groups[a][i], groups[b][j]] = [groups[b][j], groups[a][i]];
          swapped = true;
        }
      }
    }
    if (!swapped) return;
  }
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

const rounded = (value: number) => Math.round(value * 1000) / 1000;

export function buildOrbGraph(chapters: OrbChapterInput[]): OrbGraph {
  const partTitles = [...new Set(chapters.map((chapter) => chapter.part))];
  const chapterParts = chapters.map((chapter) => partTitles.indexOf(chapter.part));
  const lessonCount = chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
  const lessonsInPart = partTitles.map((_, part) => chapters.reduce((sum, chapter, index) => chapterParts[index] === part ? sum + chapter.steps.length : sum, 0));

  // Split the course into two halves left and right, then top and bottom, then chapter by chapter.
  const parts: Vector[][] = [];
  carve(fibonacciSphere(lessonCount), lessonsInPart.map((weight, index) => ({ weight, index })), [[1, 0, 0], [0, -1, 0]], parts);
  const leftHalf = new Set(parts.slice(0, Math.max(1, partTitles.length >> 1)));

  const placed: Vector[][] = chapters.map(() => []);
  parts.forEach((points, part) => {
    const members = chapters.flatMap((chapter, index) => chapterParts[index] === part ? [{ weight: chapter.steps.length, index }] : []);
    const groups: Vector[][] = [];
    carve(points, members.map((member, order) => ({ weight: member.weight, index: order })), [], groups);
    roundOff(groups);
    const partCenter = normalize(mean(points));
    const side = leftHalf.has(points) ? -1 : 1;
    groups.forEach((group, order) => {
      const center = normalize(mean(group));
      const spread = Math.max(...group.map((point) => distance(point, center))) || 1;
      placed[members[order].index] = group.map((point) => {
        const pulled = normalize(add(add(point, add(center, point, -1), CHAPTER_PULL), add(partCenter, point, -1), PART_PULL));
        const fold = 1 + FOLD_HEIGHT * (1 - (distance(point, center) / spread) ** 2);
        return add([pulled[0] * fold, pulled[1] * fold, pulled[2] * fold], [side, 0, 0], FISSURE);
      });
    });
  });

  const reach = Math.max(...placed.flat().map((point) => Math.hypot(point[0], point[1], point[2])));
  const positions: number[] = [];
  const chapterStarts: number[] = [];
  let previous: Vector = [-0.45, 0.45, 1.2]; // The course begins toward the viewer.
  placed.forEach((points) => {
    chapterStarts.push(positions.length / 3);
    const path = route(points, previous);
    previous = path[path.length - 1];
    for (const point of path) positions.push(rounded(point[0] / reach), rounded(point[1] / reach), rounded(point[2] / reach));
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

  return { positions, titles: chapters.flatMap((chapter) => chapter.steps.map((step) => step.title)), chapterStarts, chapterParts, partTitles, links };
}
