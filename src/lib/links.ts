// Kept apart from lesson data so client components can link without bundling every chapter.
export function lessonHref(chapterId: string, stepId: string) {
  return `/learn/${encodeURIComponent(chapterId)}/${encodeURIComponent(stepId)}/`;
}

export function chapterHref(chapterId: string) {
  return `/learn/${encodeURIComponent(chapterId)}/`;
}
