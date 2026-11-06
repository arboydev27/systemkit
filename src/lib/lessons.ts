import { chapters } from "../content/chapters";
import { lessonHref } from "./links";
import type { OutlineChapter } from "./progress";

export { lessonHref };

export function findLesson(chapterId: string, stepId: string) {
  const chapter = chapters.find((item) => item.id === chapterId);
  const step = chapter?.steps.find((item) => item.id === stepId);
  return chapter && step ? { chapter, step } : undefined;
}

export const lessonIndex = chapters.flatMap((chapter) => chapter.steps.map((step) => ({
  id: `${chapter.id}/${step.id}`,
  href: lessonHref(chapter.id, step.id),
  chapterTitle: chapter.title,
  chapterNumber: chapter.number,
  title: step.title,
  summary: step.summary,
  paragraphs: [...step.body, ...step.takeaways].map((text) => text.replaceAll("`", "")),
})));

export type LessonEntry = (typeof lessonIndex)[number];

export const courseOutline: OutlineChapter[] = chapters.map((chapter) => ({
  id: chapter.id, number: chapter.number, title: chapter.title, part: chapter.part, storageKey: chapter.storageKey,
  stepIds: chapter.steps.map((step) => step.id),
}));
