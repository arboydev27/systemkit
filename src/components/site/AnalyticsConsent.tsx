"use client";

import { useEffect, useRef, useState } from "react";
import { analyticsActive, analyticsAvailable, recordVisit, setAnalyticsChoice, shouldAskForConsent, startAnalytics, type AnalyticsChoice } from "@/lib/analytics";
import styles from "./AnalyticsConsent.module.css";

const OPEN_SETTINGS = "systemkit:analytics-settings";

export function AnalyticsConsent() {
  const [open, setOpen] = useState(false);
  const [fromSettings, setFromSettings] = useState(false);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    startAnalytics();
    recordVisit();
    setOpen(shouldAskForConsent());
    function showSettings() {
      setFromSettings(true);
      setOpen(true);
      window.requestAnimationFrame(() => panel.current?.focus());
    }
    window.addEventListener(OPEN_SETTINGS, showSettings);
    return () => window.removeEventListener(OPEN_SETTINGS, showSettings);
  }, []);

  function choose(choice: AnalyticsChoice) {
    setAnalyticsChoice(choice);
    recordVisit();
    setOpen(false);
    setFromSettings(false);
  }

  if (!open) return null;
  return <aside ref={panel} className={styles.panel} tabIndex={-1} aria-labelledby="analytics-consent-heading">
    <h2 id="analytics-consent-heading">Can SystemKit measure how it gets used?</h2>
    <p>With your OK, Google Analytics uses cookies to count visits, return visits, and which lessons and labs get used. There are no ads, and your answers and notes stay in this browser.</p>
    {fromSettings ? <p className={styles.status}>Analytics is currently {analyticsActive() ? "on" : "off"}.</p> : null}
    <div className={styles.actions}>
      <button type="button" onClick={() => choose("granted")}>Allow analytics</button>
      <button type="button" onClick={() => choose("denied")}>Decline</button>
    </div>
  </aside>;
}

export function AnalyticsSettingsButton({ className }: { className?: string }) {
  if (!analyticsAvailable()) return null;
  return <button type="button" className={`${styles.settings} ${className ?? ""}`} onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS))}>Analytics settings</button>;
}
