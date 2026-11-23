export type LimiterAlgorithm = "fixed-window" | "sliding-log" | "sliding-counter" | "token-bucket";
export type TrafficShape = "edge-burst" | "steady" | "spike";
export type LimiterInput = { limit: number; windowSeconds: number; traffic: TrafficShape };
export type LimiterResult = {
  algorithm: LimiterAlgorithm;
  allowed: number[];
  rejected: number;
  /** The most requests admitted inside any one rolling window: what the protected service actually sees. */
  peakInWindow: number;
};

export const limiterAlgorithms: { id: LimiterAlgorithm; name: string; detail: string }[] = [
  { id: "fixed-window", name: "Fixed window", detail: "One counter per window, reset on the boundary." },
  { id: "sliding-log", name: "Sliding log", detail: "A timestamp for every admitted request." },
  { id: "sliding-counter", name: "Sliding counter", detail: "Current count plus a weighted share of the last window." },
  { id: "token-bucket", name: "Token bucket", detail: "Tokens refill steadily, and a full bucket allows a burst." },
];

/** Request arrival times in milliseconds across three windows. Exact and repeatable, with no randomness. */
export function limiterTraffic({ limit, windowSeconds, traffic }: LimiterInput): number[] {
  const windowMs = windowSeconds * 1000;
  const evenly = (start: number, end: number, count: number) =>
    Array.from({ length: count }, (_, index) => start + ((end - start) * index) / count);
  if (traffic === "edge-burst") {
    // A full window's allowance just before a boundary, then another just after it.
    const before = evenly(windowMs * 0.9, windowMs, limit);
    const after = evenly(windowMs, windowMs * 1.1, limit);
    return [...before, ...after];
  }
  if (traffic === "spike") {
    const background = evenly(0, windowMs * 3, Math.round(limit * 1.5));
    const burst = evenly(windowMs * 1.5, windowMs * 1.5 + 1000, limit * 3);
    return [...background, ...burst].sort((a, b) => a - b);
  }
  return evenly(0, windowMs * 3, Math.round(limit * 4.5));
}

function admit(algorithm: LimiterAlgorithm, times: number[], limit: number, windowMs: number): number[] {
  const allowed: number[] = [];
  if (algorithm === "fixed-window") {
    const counts = new Map<number, number>();
    for (const time of times) {
      const window = Math.floor(time / windowMs);
      const count = counts.get(window) ?? 0;
      if (count < limit) { counts.set(window, count + 1); allowed.push(time); }
    }
  } else if (algorithm === "sliding-log") {
    let oldest = 0;
    for (const time of times) {
      while (oldest < allowed.length && allowed[oldest] <= time - windowMs) oldest++;
      if (allowed.length - oldest < limit) allowed.push(time);
    }
  } else if (algorithm === "sliding-counter") {
    const counts = new Map<number, number>();
    for (const time of times) {
      const window = Math.floor(time / windowMs);
      const elapsed = (time - window * windowMs) / windowMs;
      const estimate = (counts.get(window) ?? 0) + (counts.get(window - 1) ?? 0) * (1 - elapsed);
      if (estimate < limit) { counts.set(window, (counts.get(window) ?? 0) + 1); allowed.push(time); }
    }
  } else {
    const refillPerMs = limit / windowMs;
    let tokens = limit, last = 0;
    for (const time of times) {
      tokens = Math.min(limit, tokens + (time - last) * refillPerMs);
      last = time;
      if (tokens >= 1) { tokens -= 1; allowed.push(time); }
    }
  }
  return allowed;
}

function peakInWindow(allowed: number[], windowMs: number) {
  let peak = 0, start = 0;
  for (let end = 0; end < allowed.length; end++) {
    while (allowed[end] - allowed[start] >= windowMs) start++;
    peak = Math.max(peak, end - start + 1);
  }
  return peak;
}

export function runLimiters(input: LimiterInput): { arrivals: number[]; results: LimiterResult[] } {
  const arrivals = limiterTraffic(input);
  const windowMs = input.windowSeconds * 1000;
  return {
    arrivals,
    results: limiterAlgorithms.map(({ id }) => {
      const allowed = admit(id, arrivals, input.limit, windowMs);
      return { algorithm: id, allowed, rejected: arrivals.length - allowed.length, peakInWindow: peakInWindow(allowed, windowMs) };
    }),
  };
}

/** Requests per equal slice of the traffic's span, so the shapes can be drawn on the same axis. */
export function histogram(times: number[], start: number, end: number, buckets: number) {
  const counts = Array.from({ length: buckets }, () => 0);
  for (const time of times) {
    const index = Math.min(buckets - 1, Math.floor(((time - start) / (end - start)) * buckets));
    if (index >= 0) counts[index]++;
  }
  return counts;
}
