import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chapters } from "@/content/chapters";
import { LearningExperience } from "@/components/LearningExperience";
import { findLesson } from "@/lib/lessons";

type Props = { params: Promise<{ chapterId: string; stepId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return chapters.flatMap((chapter) => chapter.steps.map((step) => ({ chapterId: chapter.id, stepId: step.id })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapterId, stepId } = await params;
  const lesson = findLesson(chapterId, stepId);
  if (!lesson) return {};
  return { title: `${lesson.step.title} — SystemKit`, description: lesson.step.summary };
}

export default async function LessonPage({ params }: Props) {
  const { chapterId, stepId } = await params;
  if (!findLesson(chapterId, stepId)) notFound();
  return <LearningExperience key={`${chapterId}/${stepId}`} initialChapterId={chapterId} initialStepId={stepId} />;
}
