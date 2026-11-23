export type SearchableLesson = {
  title: string;
  chapterTitle: string;
  summary: string;
  paragraphs: string[];
};

const normalize = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

export function searchLessons<T extends SearchableLesson>(entries: T[], query: string) {
  const terms = [...new Set(normalize(query).trim().split(/\s+/).filter(Boolean))];
  if (!terms.length) return [];
  return entries.flatMap((entry) => {
    const title = normalize(entry.title);
    const chapter = normalize(entry.chapterTitle);
    const summary = normalize(entry.summary);
    const body = normalize(entry.paragraphs.join(" "));
    const all = `${title} ${chapter} ${summary} ${body}`;
    if (!terms.every((term) => all.includes(term))) return [];
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 8 : 0) +
      (summary.includes(term) ? 4 : 0) + (chapter.includes(term) ? 2 : 0) + (body.includes(term) ? 1 : 0), 0);
    const source = [entry.summary, ...entry.paragraphs].find((text) => terms.some((term) => normalize(text).includes(term))) ?? entry.summary;
    const firstMatch = Math.min(...terms.map((term) => normalize(source).indexOf(term)).filter((index) => index >= 0));
    const start = Number.isFinite(firstMatch) ? Math.max(0, firstMatch - 55) : 0;
    const excerpt = `${start ? "…" : ""}${source.slice(start, start + 160)}${source.length > start + 160 ? "…" : ""}`;
    return [{ entry, score, excerpt }];
  }).sort((a, b) => b.score - a.score);
}
