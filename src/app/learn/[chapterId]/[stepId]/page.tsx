import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { chapters } from "@/content/chapters";
import { challengeForLesson } from "@/content/challenges";
import { LearningExperience } from "@/components/LearningExperience";
import { courseOutline, findLesson } from "@/lib/lessons";
import { lessonHref } from "@/lib/links";
import { shareImageSize } from "@/lib/share-image";
import { SITE_NAME, SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ chapterId: string; stepId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return chapters.flatMap((chapter) => chapter.steps.map((step) => ({ chapterId: chapter.id, stepId: step.id })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapterId, stepId } = await params;
  const lesson = findLesson(chapterId, stepId);
  if (!lesson) return {};
  const title = `${lesson.step.seoTitle ?? lesson.step.title} | ${SITE_NAME}`;
  const url = lessonHref(chapterId, stepId);
  const image = `/og/${chapterId}/${stepId}.png`;
  return {
    title,
    description: lesson.step.summary,
    alternates: { canonical: url },
    openGraph: { title, description: lesson.step.summary, url, type: "article", siteName: SITE_NAME, images: [{ url: image, ...shareImageSize, alt: lesson.step.title }] },
    twitter: { card: "summary_large_image", title, description: lesson.step.summary, images: [image] },
  };
}

export default async function LessonPage({ params }: Props) {
  const { chapterId, stepId } = await params;
  const lesson = findLesson(chapterId, stepId);
  if (!lesson) notFound();
  const { chapter, step } = lesson;
  const next = chapters[chapters.findIndex((item) => item.id === chapter.id) + 1];
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: step.seoTitle ?? step.title,
    description: step.summary,
    url: `${SITE_URL}${lessonHref(chapter.id, step.id)}`,
    learningResourceType: "Lesson",
    isAccessibleForFree: true,
    isPartOf: { "@type": "Course", name: chapter.title, provider: { "@type": "Organization", name: SITE_NAME } },
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <LearningExperience
      key={`${chapterId}/${stepId}`}
      chapter={{
        id: chapter.id, number: chapter.number, title: chapter.title, lessonLabel: chapter.lessonLabel,
        diagramHeading: chapter.diagramHeading, diagramHint: chapter.diagramHint, storageKey: chapter.storageKey,
        steps: chapter.steps.map(({ id, title }) => ({ id, title })),
      }}
      step={step}
      questions={chapter.questions.filter((question) => question.stepId === step.id)}
      outline={courseOutline}
      nextChapter={next ? { id: next.id, title: next.title, firstStepId: next.steps[0].id } : undefined}
      challenge={challengeForLesson(chapter.id, step.id)}
    />
  </>;
}
