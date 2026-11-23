import type { MetadataRoute } from "next";
import { chapters } from "@/content/chapters";
import { designChallenges } from "@/content/challenges";
import { labs } from "@/content/labs";
import { chapterHref, lessonHref } from "@/lib/links";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/", "/learn/", "/labs/", "/practice/", "/practice/estimation/", "/review/",
    ...labs.map((lab) => `/labs/${lab.id}/`),
    ...designChallenges.map((challenge) => `/practice/${challenge.id}/`),
    ...chapters.map((chapter) => chapterHref(chapter.id)),
    ...chapters.flatMap((chapter) => chapter.steps.map((step) => lessonHref(chapter.id, step.id))),
  ];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
