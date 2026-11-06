export type QuorumInput = { n: number; w: number; r: number; down: number[] };
export type QuorumResult = {
  up: number;
  /** Replicas holding the latest acknowledged write. In the worst case, the first W and no others. */
  holders: number[];
  canWrite: boolean;
  canRead: boolean;
  overlap: boolean;
  /** Chance a read of R reachable replicas sees only older copies, assuming nothing has caught up yet. */
  staleReadChance: number;
  writesSurvive: number;
  readsSurvive: number;
};

function choose(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return Math.round(result);
}

export function clampQuorum(input: QuorumInput): QuorumInput {
  const n = Math.min(7, Math.max(3, Math.round(input.n)));
  const clamp = (value: number) => Math.min(n, Math.max(1, Math.round(value)));
  return { n, w: clamp(input.w), r: clamp(input.r), down: [...new Set(input.down)].filter((index) => index >= 0 && index < n).sort((a, b) => a - b) };
}

export function modelQuorum(raw: QuorumInput): QuorumResult {
  const { n, w, r, down } = clampQuorum(raw);
  const up = n - down.length;
  const holders = Array.from({ length: w }, (_, index) => index);
  const holdersUp = holders.filter((index) => !down.includes(index)).length;
  const missingUp = up - holdersUp;
  const canRead = up >= r;
  return {
    up,
    holders,
    canWrite: up >= w,
    canRead,
    overlap: w + r > n,
    staleReadChance: canRead ? choose(missingUp, r) / choose(up, r) : 0,
    writesSurvive: n - w,
    readsSurvive: n - r,
  };
}
