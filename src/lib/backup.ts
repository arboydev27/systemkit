const PREFIX = "systemkit:";
const APP = "systemkit";
const VERSION = 1;
const MAX_BYTES = 5_000_000;
export const LAST_BACKUP_KEY = "systemkit:last-backup:v1";

export type BackupStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
export type Backup = { app: typeof APP; version: number; exportedAt: number; items: Record<string, string> };
export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: string };

function savedKeys(storage: BackupStorage) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

export function collectBackup(storage: BackupStorage, now: number): Backup {
  const items: Record<string, string> = {};
  for (const key of savedKeys(storage)) {
    const value = storage.getItem(key);
    if (value !== null) items[key] = value;
  }
  return { app: APP, version: VERSION, exportedAt: now, items };
}

export function parseBackup(text: string): ParsedBackup {
  const notBackup = "This file isn’t a SystemKit progress backup.";
  if (text.length > MAX_BYTES) return { ok: false, error: "This file is too large to be a SystemKit progress backup." };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: notBackup }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, error: notBackup };
  const value = parsed as Partial<Backup>;
  if (value.app !== APP || !value.items || typeof value.items !== "object" || Array.isArray(value.items)) return { ok: false, error: notBackup };
  if (value.version !== VERSION) return { ok: false, error: "This backup came from a newer version of SystemKit. Reload the site and try again." };
  const items = Object.entries(value.items).filter(
    (entry): entry is [string, string] => entry[0].startsWith(PREFIX) && typeof entry[1] === "string",
  );
  return { ok: true, backup: {
    app: APP, version: VERSION,
    exportedAt: typeof value.exportedAt === "number" ? value.exportedAt : 0,
    items: Object.fromEntries(items),
  } };
}

/** Replaces saved progress, and puts the earlier values back if the browser refuses part way. */
export function restoreBackup(storage: BackupStorage, backup: Backup): boolean {
  const previous = collectBackup(storage, 0).items;
  try {
    for (const key of Object.keys(previous)) storage.removeItem(key);
    for (const [key, value] of Object.entries(backup.items)) storage.setItem(key, value);
    return true;
  } catch {
    try {
      for (const key of savedKeys(storage)) storage.removeItem(key);
      for (const [key, value] of Object.entries(previous)) storage.setItem(key, value);
    } catch { /* The browser refused both; nothing further can be done here. */ }
    return false;
  }
}

/** Counts finished lessons in a backup, so a restore can say what it will bring back. */
export function completedLessons(items: Record<string, string>) {
  let count = 0;
  for (const value of Object.values(items)) {
    try {
      const parsed: unknown = JSON.parse(value);
      const completed = parsed && typeof parsed === "object" ? (parsed as { completed?: unknown }).completed : undefined;
      if (Array.isArray(completed)) count += completed.length;
    } catch { /* Plain text settings have no lessons. */ }
  }
  return count;
}
