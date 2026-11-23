import { RETRY_DEFAULTS, simulateRetries } from "../lib/labs/retry-storm";
import type { Chapter } from "./chapters";

/**
 * The home page's "Every lesson fixes something" tiles: one real lesson from each part of the course, drawn as what
 * goes wrong and then what the lesson's fix does to it. The figures are the lesson's own worked example, and a test
 * checks each one still appears in the lesson, so the picture can't drift from what the lesson teaches.
 * Lessons the scaling game already plays (bigger machines, load balancing, caching, replicas, sharding) are left out.
 */
export type HomeFix = {
  picture: "edge" | "wallet" | "retries" | "upload";
  chapterId: Chapter["id"];
  stepId: string;
  /** What the readout says after the fix, what it said before it, and what the number is. */
  readout?: { now: string; was: string; unit: string };
  /** Phrases from the lesson's text that the picture and readout rely on. */
  quotes: string[];
};

export const homeFixes: HomeFix[] = [
  {
    picture: "edge",
    chapterId: "scaling",
    stepId: "cdn",
    readout: { now: "20 ms", was: "200 ms", unit: "a round trip" },
    quotes: ["Sydney", "Virginia", "about 200 ms per round trip", "about 20 ms"],
  },
  {
    picture: "wallet",
    chapterId: "transactions",
    stepId: "tx-lost-update",
    readout: { now: "$20", was: "$50", unit: "left of $100" },
    quotes: ["holds $100", "debits $30", "debits $50", "should be 20, but it is 50"],
  },
  {
    // Its readout comes from the retry storm lab's own model.
    picture: "retries",
    chapterId: "patterns",
    stepId: "pt-retries",
    quotes: ["Backoff spreads retries, jitter decorrelates them, and a budget caps their total."],
  },
  {
    picture: "upload",
    chapterId: "youtube",
    stepId: "youtube-upload",
    readout: { now: "500 MB", was: "2 GB", unit: "sent again" },
    quotes: ["2 GB source in 10 MB parts: 200 parts", "after part 150", "500 MB, rather than 2 GB"],
  },
];

/** The retry storm lab's model, run with its usual settings and again with the lesson's three protections. */
export function retryFix() {
  const before = simulateRetries(RETRY_DEFAULTS);
  const after = simulateRetries({ ...RETRY_DEFAULTS, backoff: "jitter", retryBudget: true });
  const time = (seconds: number | null) => seconds === null ? "never" : `${Math.max(1, Math.round(seconds / 60))} min`;
  return { before, after, readout: { now: time(after.recoveryAfter), was: time(before.recoveryAfter), unit: "to recover" } };
}
