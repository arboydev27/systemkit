// Milestones and returning visitors, through Google Analytics. Vercel Analytics counts page visits
// separately in the root layout. Google loads only where it's allowed; set NEXT_PUBLIC_GA_ID to turn it on.
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;
const USAGE_KEY = "systemkit:usage:v1";
// Outside the "systemkit:" prefix so a backup never carries one device's choice to another.
const CONSENT_KEY = "systemkit-analytics-consent";
const DAY = 24 * 60 * 60 * 1000;
const RETURN_DAYS = [1, 7, 30];
const MAX_EVENT_NAME = 40;

// Where analytics cookies need consent. Google enforces this by IP, as a backstop to the banner.
const CONSENT_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
];
const EUROPEAN_ZONES_OUTSIDE_EUROPE = new Set([
  "Atlantic/Azores", "Atlantic/Canary", "Atlantic/Faeroe", "Atlantic/Faroe", "Atlantic/Madeira", "Atlantic/Reykjavik",
  "Arctic/Longyearbyen", "Asia/Famagusta", "Asia/Nicosia",
]);

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsChoice = "granted" | "denied";
export type Usage = { firstSeen: number; sent: string[] };

let active = false;
let loaded = false;

/**
 * A static site can't see the visitor's country, so the time zone decides who is asked. It errs
 * toward asking: an unknown zone gets the banner, and a few non-EU European zones do too.
 */
export function needsConsent(timeZone: string | undefined) {
  if (!timeZone) return true;
  return timeZone.startsWith("Europe/") || EUROPEAN_ZONES_OUTSIDE_EUROPE.has(timeZone);
}

export function analyticsAllowed(choice: AnalyticsChoice | null, timeZone: string | undefined) {
  return choice ? choice === "granted" : !needsConsent(timeZone);
}

/** Google allows only letters, numbers, and underscores in event names, up to 40 characters. */
export function eventName(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, MAX_EVENT_NAME);
}

function visitorTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
}

export function readAnalyticsChoice(): AnalyticsChoice | null {
  try {
    const saved = window.localStorage.getItem(CONSENT_KEY);
    return saved === "granted" || saved === "denied" ? saved : null;
  } catch {
    return null;
  }
}

export function analyticsAvailable() {
  return Boolean(MEASUREMENT_ID);
}

export function analyticsActive() {
  return active;
}

export function shouldAskForConsent() {
  return analyticsAvailable() && readAnalyticsChoice() === null && needsConsent(visitorTimeZone());
}

function setDisabled(disabled: boolean) {
  (window as unknown as Record<string, boolean>)[`ga-disable-${MEASUREMENT_ID}`] = disabled;
}

function enable(choice: AnalyticsChoice | null) {
  active = true;
  setDisabled(false);
  if (loaded) {
    window.gtag?.("consent", "update", { analytics_storage: "granted" });
    return;
  }
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  // Google's tag reads the arguments object itself, so this can't take an array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  const noAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  window.gtag("consent", "default", { ...noAds, analytics_storage: "granted" });
  if (choice !== "granted") window.gtag("consent", "default", { ...noAds, analytics_storage: "denied", region: CONSENT_REGIONS });
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: window.location.hostname,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(script);
}

function disable() {
  active = false;
  setDisabled(true);
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  for (const cookie of document.cookie.split("; ")) {
    const name = cookie.split("=")[0];
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of ["", `; domain=${window.location.hostname}`, `; domain=.${window.location.hostname}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  }
}

/** Runs once on arrival. Nothing is loaded from Google unless this visitor is allowed. */
export function startAnalytics() {
  if (!analyticsAvailable() || active) return;
  const choice = readAnalyticsChoice();
  if (analyticsAllowed(choice, visitorTimeZone())) enable(choice);
}

export function setAnalyticsChoice(choice: AnalyticsChoice) {
  try { window.localStorage.setItem(CONSENT_KEY, choice); } catch { /* The choice still applies for this visit. */ }
  if (!analyticsAvailable()) return;
  if (choice === "granted") enable(choice);
  else disable();
}

function send(name: string) {
  if (!active) return false;
  try {
    window.gtag?.("event", eventName(name));
    return true;
  } catch {
    return false;
  }
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
  } catch { /* Measurement must never affect learning. */ }
}

export function recordVisit() {
  withUsage((usage, now) => {
    const sent = dueReturnEvents(usage, now).filter(send);
    return { ...usage, sent: [...usage.sent, ...sent] };
  });
}

export function trackEvent(name: string) {
  send(name);
}

/** For milestones that should count once per browser, such as a first correct answer. */
export function trackOnce(name: string) {
  withUsage((usage) => usage.sent.includes(name) || !send(name) ? usage : { ...usage, sent: [...usage.sent, name] });
}
