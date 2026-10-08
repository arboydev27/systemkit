import { chapters } from "../content/chapters";

export function lessonHref(chapterId: string, stepId: string) {
  return `/learn/${encodeURIComponent(chapterId)}/${encodeURIComponent(stepId)}/`;
}

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
  paragraphs: [...step.body, ...step.takeaways],
})));

export type LessonEntry = (typeof lessonIndex)[number];
