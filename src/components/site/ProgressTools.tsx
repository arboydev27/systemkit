"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { collectBackup, completedLessons, LAST_BACKUP_KEY, parseBackup, restoreBackup, type Backup } from "@/lib/backup";
import styles from "./Site.module.css";

const finishedLessons = (count: number) => `${count} finished ${count === 1 ? "lesson" : "lessons"}`;

export function ProgressTools() {
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(LAST_BACKUP_KEY));
      if (saved > 0) setLastBackup(saved);
    } catch { /* Backups still download without this note. */ }
  }, []);

  function download() {
    try {
      const now = Date.now();
      window.localStorage.setItem(LAST_BACKUP_KEY, String(now));
      const backup = collectBackup(window.localStorage, now);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `systemkit-progress-${new Date(now).toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setLastBackup(now);
      setError("");
      setMessage(`Saved a backup with ${finishedLessons(completedLessons(backup.items))}.`);
      trackEvent("backup_downloaded");
    } catch {
      setError("This browser won’t allow access to saved progress, so there is nothing to back up.");
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseBackup(await file.text());
    setMessage("");
    if (parsed.ok) { setPending(parsed.backup); setError(""); }
    else { setPending(null); setError(parsed.error); }
  }

  function restore() {
    if (!pending) return;
    let restored = false;
    try { restored = restoreBackup(window.localStorage, pending); } catch { /* Reported below. */ }
    if (restored) {
      trackEvent("backup_restored");
      window.location.reload();
    } else {
      setPending(null);
      setError("This browser wouldn’t save the backup, so your existing progress was kept.");
    }
  }

  return <>
    <div className={styles.tools}>
      <button type="button" onClick={download}><Download size={15} aria-hidden="true" /> Download a backup</button>
      <label className={styles.fileButton}>
        <Upload size={15} aria-hidden="true" /> Restore from a backup
        <input type="file" accept="application/json,.json" onChange={chooseFile} />
      </label>
    </div>
    {pending ? <div className={styles.confirm} role="alertdialog" aria-label="Confirm restore">
      <p>This backup{pending.exportedAt ? ` from ${new Date(pending.exportedAt).toLocaleDateString()}` : ""} has {finishedLessons(completedLessons(pending.items))}. Restoring it replaces all SystemKit progress in this browser.</p>
      <div className={styles.tools}>
        <button type="button" className={styles.confirmDanger} onClick={restore}>Replace my progress</button>
        <button type="button" onClick={() => setPending(null)}>Keep what I have</button>
      </div>
    </div> : null}
    {error ? <p className={styles.toolsError} role="alert">{error}</p> : null}
    <p className={styles.toolsNote} role="status">{message || (lastBackup ? `Your last backup was on ${new Date(lastBackup).toLocaleDateString()}.` : "You haven’t made a backup in this browser yet.")}</p>
  </>;
}
