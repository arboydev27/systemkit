export const ACTIVE_CHAPTER_KEY = "systemkit:active-chapter:v1";
export const GOAL_KEY = "systemkit:goal:v1";
export const COURSE_VIEW_KEY = "systemkit:course-view:v1";
export const MIN_REASONING_LENGTH = 20;

export type Progress = {
  completed: string[];
  answers: Record<string, number>;
  scenarioDrafts: Record<string, string>;
  revealedScenarios: string[];
  activeStepId?: string;
};

export type OutlineChapter = {
  id: string;
  number: string;
  title: string;
  part: string;
  storageKey: string;
  stepIds: string[];
};

export const emptyProgress: Progress = { completed: [], answers: {}, scenarioDrafts: {}, revealedScenarios: [] };

const strings = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string") : [];
const entries = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
  ? Object.entries(value) : [];

export function parseProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyProgress;
    const value = parsed as Partial<Progress>;
    return {
      completed: strings(value.completed),
      answers: Object.fromEntries(entries(value.answers).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isInteger(entry[1]),
      )),
      scenarioDrafts: Object.fromEntries(entries(value.scenarioDrafts).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )),
      revealedScenarios: strings(value.revealedScenarios),
      activeStepId: typeof value.activeStepId === "string" ? value.activeStepId : undefined,
    };
  } catch {
    return emptyProgress;
  }
}

// Progress the browser refused to store, so it still lasts for this visit.
const unsaved = new Map<string, Progress>();

export function readProgress(storageKey: string): Progress {
  const pending = unsaved.get(storageKey);
  if (pending) return pending;
  try {
    return parseProgress(window.localStorage.getItem(storageKey));
  } catch {
    return emptyProgress;
  }
}

/** Reads before writing, so a second open tab can't overwrite answers with an older copy. */
export function updateStoredProgress(storageKey: string, change: (current: Progress) => Progress) {
  const progress = change(readProgress(storageKey));
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
    unsaved.delete(storageKey);
    return { progress, saved: true };
  } catch {
    unsaved.set(storageKey, progress);
    return { progress, saved: false };
  }
}

export function rememberActiveChapter(chapterId: string) {
  try { window.localStorage.setItem(ACTIVE_CHAPTER_KEY, chapterId); } catch { /* Resume is a convenience. */ }
}

let persistenceRequested = false;
/** Asks the browser not to evict saved progress. Browsers may decline, which changes nothing. */
export function requestDurableStorage() {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try { void navigator.storage?.persist?.(); } catch { /* Saving still works without it. */ }
}

/** Where to return in one chapter: the lesson left off, or the next unfinished one after it. */
export function resumeStepInChapter(stepIds: string[], progress: Progress): string | undefined {
  const pointer = stepIds.indexOf(progress.activeStepId ?? "");
  const start = Math.max(pointer, 0);
  const order = [...stepIds.slice(start), ...stepIds.slice(0, start)];
  return order.find((id) => !progress.completed.includes(id));
}

/** The next lesson across the course, starting from the last active chapter in the given order. */
export function resumeLesson(
  outline: OutlineChapter[],
  activeChapterId: string | null,
  read: (storageKey: string) => Progress,
): { chapterId: string; stepId: string } | null {
  const start = outline.findIndex((chapter) => chapter.id === activeChapterId);
  if (start < 0) return null;
  for (const chapter of [...outline.slice(start), ...outline.slice(0, start)]) {
    const stepId = resumeStepInChapter(chapter.stepIds, read(chapter.storageKey));
    if (stepId) return { chapterId: chapter.id, stepId };
  }
  return null;
}

/** The next lesson to do when walking chapters in this order, for a new visitor as well as a returning one. */
export function nextLessonInOrder(
  order: OutlineChapter[],
  activeChapterId: string | null,
  read: (storageKey: string) => Progress,
) {
  const start = order.some((chapter) => chapter.id === activeChapterId) ? activeChapterId : order[0]?.id ?? null;
  return resumeLesson(order, start, read);
}

export function completedCount(stepIds: string[], progress: Progress) {
  return stepIds.filter((id) => progress.completed.includes(id)).length;
}
