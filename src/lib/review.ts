export const REVIEW_STORAGE_KEY = "systemkit:review:v1";
export const DAY = 24 * 60 * 60 * 1000;
export const SESSION_LIMIT = 5;

export type ReviewPrompt = { prompt: string; answer: string };
export type ReviewCard = {
  id: string;
  chapterId: string;
  stepId: string;
  chapterTitle: string;
  lessonTitle: string;
  prompts: ReviewPrompt[];
};
export type FirstAttempt = {
  chapterId: string;
  stepId: string;
  selectedIndex: number;
  correct: boolean;
  attemptedAt: number;
};
export type Recall = {
  dueAt: number;
  reviewedAt: number;
  reviews: number;
  streak: number;
  lastRecalled: boolean;
};
export type ReviewState = {
  version: 1;
  studied: Record<string, number>;
  firstAttempts: Record<string, FirstAttempt>;
  recalls: Record<string, Recall>;
};
export type StorageLike = Pick<Storage, "getItem" | "setItem">;
type ChapterSource = {
  id: string;
  storageKey: string;
  steps: { id: string }[];
  questions: { id: string; stepId: string; options: string[] }[];
};

export function emptyReviewState(): ReviewState {
  return { version: 1, studied: {}, firstAttempts: {}, recalls: {} };
}

export function lessonKey(chapterId: string, stepId: string) {
  return `${chapterId}/${stepId}`;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parseReviewState(raw: string | null): ReviewState {
  const result = emptyReviewState();
  if (!raw) return result;
  try {
    const value = object(JSON.parse(raw));
    if (!value || value.version !== 1) return result;
    for (const [id, time] of Object.entries(object(value.studied) ?? {})) {
      if (timestamp(time)) result.studied[id] = time;
    }
    for (const [id, entry] of Object.entries(object(value.firstAttempts) ?? {})) {
      const attempt = object(entry);
      if (attempt && typeof attempt.chapterId === "string" && typeof attempt.stepId === "string"
        && Number.isInteger(attempt.selectedIndex) && (attempt.selectedIndex as number) >= 0
        && typeof attempt.correct === "boolean" && timestamp(attempt.attemptedAt)) {
        result.firstAttempts[id] = attempt as FirstAttempt;
      }
    }
    for (const [id, entry] of Object.entries(object(value.recalls) ?? {})) {
      const recall = object(entry);
      if (recall && timestamp(recall.dueAt) && timestamp(recall.reviewedAt)
        && Number.isInteger(recall.reviews) && (recall.reviews as number) >= 1
        && Number.isInteger(recall.streak) && (recall.streak as number) >= 0
        && typeof recall.lastRecalled === "boolean") {
        result.recalls[id] = recall as Recall;
      }
    }
  } catch {
    // A malformed saved value must never block a review.
  }
  return result;
}

export function readReviewState(storage: StorageLike | null): ReviewState {
  try { return parseReviewState(storage?.getItem(REVIEW_STORAGE_KEY) ?? null); }
  catch { return emptyReviewState(); }
}

export function saveReviewState(storage: StorageLike | null, state: ReviewState): boolean {
  if (!storage) return false;
  try { storage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function browserReviewStorage(): StorageLike | null {
  try { return window.localStorage; } catch { return null; }
}

export function markStudied(state: ReviewState, chapterId: string, stepId: string, now: number): ReviewState {
  const key = lessonKey(chapterId, stepId);
  if (state.studied[key] !== undefined) return state;
  return { ...state, studied: { ...state.studied, [key]: now } };
}

export function recordQuizAttempt(
  state: ReviewState,
  input: { chapterId: string; stepId: string; questionId: string; selectedIndex: number; correctIndex: number },
  now: number,
): ReviewState {
  const next = markStudied(state, input.chapterId, input.stepId, now);
  const key = `${input.chapterId}/${input.questionId}`;
  if (next.firstAttempts[key]) return next;
  return {
    ...next,
    firstAttempts: { ...next.firstAttempts, [key]: {
      chapterId: input.chapterId, stepId: input.stepId, selectedIndex: input.selectedIndex,
      correct: input.selectedIndex === input.correctIndex, attemptedAt: now,
    } },
  };
}

export function recordStoredQuizAttempt(
  chapterId: string, stepId: string, questionId: string, selectedIndex: number, correctIndex: number,
) {
  const storage = browserReviewStorage();
  saveReviewState(storage, recordQuizAttempt(readReviewState(storage),
    { chapterId, stepId, questionId, selectedIndex, correctIndex }, Date.now()));
}

export function recordStoredLessonStudy(chapterId: string, stepId: string) {
  const storage = browserReviewStorage();
  saveReviewState(storage, markStudied(readReviewState(storage), chapterId, stepId, Date.now()));
}

// Old progress proves that a lesson was studied, but cannot tell us its first answer.
// Import only eligibility; never invent an attempt history or modify the old value.
export function importLegacyStudy(
  state: ReviewState, storage: StorageLike | null, sources: ChapterSource[], now: number,
): ReviewState {
  let next = state;
  if (!storage) return next;
  for (const chapter of sources) {
    try {
      const raw = storage.getItem(chapter.storageKey);
      const saved = raw ? object(JSON.parse(raw)) : undefined;
      if (!saved) continue;
      const completed = Array.isArray(saved.completed) ? saved.completed : [];
      const answers = object(saved.answers) ?? {};
      const drafts = object(saved.scenarioDrafts) ?? {};
      for (const step of chapter.steps) {
        const hasAnswer = chapter.questions.some((question) => question.stepId === step.id
          && Number.isInteger(answers[question.id]) && (answers[question.id] as number) >= 0
          && (answers[question.id] as number) < question.options.length);
        const draft = drafts[step.id];
        if (completed.includes(step.id) || hasAnswer || (typeof draft === "string" && draft.trim())) {
          next = markStudied(next, chapter.id, step.id, Math.max(0, now - DAY));
        }
      }
    } catch { /* A blocked or malformed chapter value leaves other chapters usable. */ }
  }
  return next;
}

export function buildReviewSession(
  cards: ReviewCard[], state: ReviewState, now: number, includeFuture = false,
) {
  const missedLessons = new Set(Object.values(state.firstAttempts)
    .filter((attempt) => !attempt.correct)
    .map((attempt) => lessonKey(attempt.chapterId, attempt.stepId)));
  return cards.filter((card) => state.studied[card.id] !== undefined && card.prompts.length > 0)
    .map((card) => {
      const recall = state.recalls[card.id];
      const dueAt = recall?.dueAt ?? state.studied[card.id] + DAY;
      return {
        card, dueAt,
        prompt: card.prompts[(recall?.reviews ?? 0) % card.prompts.length],
        needsRevisit: recall ? !recall.lastRecalled : missedLessons.has(card.id),
      };
    })
    .filter((item) => includeFuture || item.dueAt <= now)
    .sort((a, b) => Number(b.needsRevisit) - Number(a.needsRevisit) || a.dueAt - b.dueAt || a.card.id.localeCompare(b.card.id))
    .slice(0, SESSION_LIMIT);
}

export function recordRecall(state: ReviewState, cardId: string, recalled: boolean, now: number): ReviewState {
  if (state.studied[cardId] === undefined) return state;
  const previous = state.recalls[cardId];
  const streak = recalled ? (previous?.streak ?? 0) + 1 : 0;
  const intervalDays = [1, 3, 7, 14, 30][Math.min(streak, 4)];
  return { ...state, recalls: { ...state.recalls, [cardId]: {
    dueAt: now + intervalDays * DAY, reviewedAt: now,
    reviews: (previous?.reviews ?? 0) + 1, streak, lastRecalled: recalled,
  } } };
}
