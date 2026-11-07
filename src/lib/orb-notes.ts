// What the dive through the orb says at each stop: a lesson's summary, and why one lesson leads to the next. It's
// written into a small file of its own at build time and fetched with the dive, so the home page doesn't carry it.

type NotesChapter = { steps: { id: string; summary: string; related?: { chapterId: string; stepId: string; reason: string }[] }[]; id: string };

export type OrbNotes = {
  /** Each lesson's one-line summary, in course order, the same order as the orb's dots. */
  summaries: string[];
  /** For each link, the lesson it's from, the lesson it's to, and what the second adds for someone reading the first. */
  reasons: [number, number, string][];
};

export function orbNotes(chapters: NotesChapter[]): OrbNotes {
  const index = new Map<string, number>();
  let at = 0;
  for (const chapter of chapters) for (const step of chapter.steps) index.set(`${chapter.id}/${step.id}`, at++);
  const reasons: [number, number, string][] = [];
  for (const chapter of chapters) {
    for (const step of chapter.steps) {
      const from = index.get(`${chapter.id}/${step.id}`)!;
      for (const link of step.related ?? []) {
        const to = index.get(`${link.chapterId}/${link.stepId}`);
        if (to !== undefined && to !== from) reasons.push([from, to, link.reason]);
      }
    }
  }
  return { summaries: chapters.flatMap((chapter) => chapter.steps.map((step) => step.summary)), reasons };
}

/** What to say on arriving at a lesson from the one before it: why it follows, where the link says, or else its summary. */
export function noteFor(notes: OrbNotes | null, from: number | null, to: number) {
  if (!notes) return "";
  if (from !== null) {
    const reason = notes.reasons.find(([a, b]) => a === from && b === to);
    if (reason) return reason[2];
  }
  return notes.summaries[to] ?? "";
}
