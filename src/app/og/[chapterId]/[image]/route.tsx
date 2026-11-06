import { chapters } from "@/content/chapters";
import { findLesson } from "@/lib/lessons";
import { shareImage } from "@/lib/share-image";

// Real .png files: an extensionless image can get the wrong content type or a trailing-slash redirect.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return chapters.flatMap((chapter) => chapter.steps.map((step) => ({ chapterId: chapter.id, image: `${step.id}.png` })));
}

export async function GET(_request: Request, { params }: { params: Promise<{ chapterId: string; image: string }> }) {
  const { chapterId, image } = await params;
  const lesson = findLesson(chapterId, image.replace(/\.png$/, ""));
  return shareImage({ title: lesson?.step.seoTitle ?? lesson?.step.title ?? "SystemKit", context: lesson?.chapter.title ?? "System design" });
}
