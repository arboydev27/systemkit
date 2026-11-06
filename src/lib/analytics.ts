import { pageview } from "@vercel/analytics";

const USAGE_KEY = "systemkit:usage:v1";
const DAY = 24 * 60 * 60 * 1000;
const RETURN_DAYS = [1, 7, 30];

export type Usage = { firstSeen: number; sent: string[] };

// Events are sent as paths under /_event/ because Vercel's custom events need a paid plan,
// and page paths are visible on every plan. No identifier or lesson content is included.
function send(name: string) {
  try { pageview({ path: `/_event/${name}` }); } catch { /* Measurement must never affect learning. */ }
}

export function parseUsage(raw: string | null, now: number): Usage {
  try {
    const value = JSON.parse(raw ?? "null") as Partial<Usage> | null;
    if (value && Number.isFinite(value.firstSeen) && Array.isArray(value.sent)) {
      return { firstSeen: value.firstSeen as number, sent: value.sent.filter((item) => typeof item === "string") };
    }
  } catch { /* Start counting again from this visit. */ }
  return { firstSeen: now, sent: [] };
}

/** Return milestones reached and not yet reported. The first-seen date itself is never sent. */
export function dueReturnEvents({ firstSeen, sent }: Usage, now: number) {
  return RETURN_DAYS.filter((days) => now - firstSeen >= days * DAY)
    .map((days) => `returned_d${days}`)
    .filter((name) => !sent.includes(name));
}

function withUsage(change: (usage: Usage, now: number) => Usage) {
  try {
    const now = Date.now();
    window.localStorage.setItem(USAGE_KEY, JSON.stringify(change(parseUsage(window.localStorage.getItem(USAGE_KEY), now), now)));
    return true;
  } catch {
    return false;
  }
}

export function recordVisit() {
  withUsage((usage, now) => {
    const due = dueReturnEvents(usage, now);
    due.forEach(send);
    return { ...usage, sent: [...usage.sent, ...due] };
  });
}

export function trackEvent(name: string) {
  send(name);
}

/** For milestones that should count once per browser, such as a first correct answer. */
export function trackOnce(name: string) {
  withUsage((usage) => {
    if (usage.sent.includes(name)) return usage;
    send(name);
    return { ...usage, sent: [...usage.sent, name] };
  });
}
