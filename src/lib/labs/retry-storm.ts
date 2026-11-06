export type Backoff = "none" | "exponential" | "jitter";
export type RetryInput = {
  /** Original requests per second from clients. */
  arrivalRate: number;
  /** Requests per second the service can finish when healthy. */
  capacity: number;
  /** Seconds of reduced capacity, starting at outageStart. */
  outageSeconds: number;
  maxRetries: number;
  backoff: Backoff;
  /** Limit retries to a share of original traffic, as a retry budget does. */
  retryBudget: boolean;
  /** Skip queued work whose client already gave up, rather than spending capacity on it. */
  shedExpired: boolean;
};
export type RetryTick = { time: number; offered: number; goodput: number; wasted: number; capacity: number; queue: number };
export type RetryResult = {
  ticks: RetryTick[];
  outageStart: number;
  outageEnd: number;
  /** Seconds after the outage ends until successful work is back, or null within the simulated time. */
  recoveryAfter: number | null;
  /** Attempts made per original request. */
  amplification: number;
  peakQueue: number;
  successShare: number;
};

export const RETRY_DEFAULTS: RetryInput = {
  arrivalRate: 100, capacity: 120, outageSeconds: 20, maxRetries: 3, backoff: "none", retryBudget: false, shedExpired: false,
};

const DURATION = 240;
const OUTAGE_START = 20;
const TIMEOUT = 5;
const OUTAGE_CAPACITY_SHARE = 0.2;
const RECOVERED_SHARE = 0.95;
const RECOVERED_FOR = 5;
const BUDGET_SHARE = 0.1;

type Cohort = { arrivedAt: number; count: number; attempt: number; expired: boolean };

/**
 * A fluid queue model stepped once per simulated second. It answers "does this recover, and
 * roughly how?" from the settings given. It does not predict latency or real capacity.
 */
export function simulateRetries(input: RetryInput): RetryResult {
  const queue: Cohort[] = [];
  const pending = new Map<number, { attempt: number; count: number }[]>();
  const ticks: RetryTick[] = [];
  const outageEnd = OUTAGE_START + input.outageSeconds;
  let totalAttempts = 0, totalOriginal = 0, totalGood = 0;

  const schedule = (time: number, attempt: number, count: number) => {
    const list = pending.get(time) ?? [];
    list.push({ attempt, count });
    pending.set(time, list);
  };

  for (let time = 0; time < DURATION; time++) {
    const capacity = time >= OUTAGE_START && time < outageEnd ? input.capacity * OUTAGE_CAPACITY_SHARE : input.capacity;
    const retries = pending.get(time) ?? [];
    pending.delete(time);
    const retryTotal = retries.reduce((sum, item) => sum + item.count, 0);
    const allowedShare = input.retryBudget && retryTotal > 0 ? Math.min(1, (input.arrivalRate * BUDGET_SHARE) / retryTotal) : 1;

    queue.push({ arrivedAt: time, count: input.arrivalRate, attempt: 0, expired: false });
    totalOriginal += input.arrivalRate;
    let offered = input.arrivalRate;
    for (const retry of retries) {
      const count = retry.count * allowedShare;
      if (count <= 0) continue;
      queue.push({ arrivedAt: time, count, attempt: retry.attempt, expired: false });
      offered += count;
    }
    totalAttempts += offered;

    // Clients give up first, so a retry is scheduled whether or not the abandoned work is later dropped.
    for (const cohort of queue) {
      if (cohort.expired || time - cohort.arrivedAt < TIMEOUT) continue;
      cohort.expired = true;
      if (cohort.attempt >= input.maxRetries) continue;
      const nextAttempt = cohort.attempt + 1;
      if (input.backoff === "none") {
        schedule(time + 1, nextAttempt, cohort.count);
      } else if (input.backoff === "exponential") {
        schedule(time + 2 ** (cohort.attempt + 1), nextAttempt, cohort.count);
      } else {
        // Jitter spreads the same retries evenly across the backoff window.
        const spread = 2 ** (cohort.attempt + 2);
        for (let offset = 1; offset <= spread; offset++) schedule(time + offset, nextAttempt, cohort.count / spread);
      }
    }

    let spare = capacity, goodput = 0, wasted = 0;
    while (spare > 1e-9 && queue.length) {
      const cohort = queue[0];
      const expired = cohort.expired || time - cohort.arrivedAt >= TIMEOUT;
      if (expired && input.shedExpired) { queue.shift(); continue; }
      const served = Math.min(spare, cohort.count);
      if (expired) wasted += served; else goodput += served;
      cohort.count -= served;
      spare -= served;
      if (cohort.count <= 1e-9) queue.shift();
    }
    totalGood += goodput;

    ticks.push({ time, offered, goodput, wasted, capacity, queue: queue.reduce((sum, cohort) => sum + cohort.count, 0) });
  }

  let recoveryAfter: number | null = null;
  for (let index = outageEnd; index <= DURATION - RECOVERED_FOR; index++) {
    if (ticks.slice(index, index + RECOVERED_FOR).every((tick) => tick.goodput >= input.arrivalRate * RECOVERED_SHARE)) {
      recoveryAfter = index - outageEnd;
      break;
    }
  }

  return {
    ticks, outageStart: OUTAGE_START, outageEnd, recoveryAfter,
    amplification: totalAttempts / totalOriginal,
    peakQueue: Math.max(...ticks.map((tick) => tick.queue)),
    successShare: Math.min(1, totalGood / totalOriginal),
  };
}
