import { chapters, goalPaths } from "../content/chapters";
import type { CourseChapter, GoalOption } from "../components/site/SiteClient";
import { courseOutline } from "./lessons";

export const courseChapters: CourseChapter[] = courseOutline.map((item, index) => ({
  ...item,
  summary: chapters[index].summary,
  lessonCount: chapters[index].steps.length,
}));

export const courseGoals: GoalOption[] = Object.entries(goalPaths).map(([id, goal]) => ({ id, ...goal }));
export const lessonCount = chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
