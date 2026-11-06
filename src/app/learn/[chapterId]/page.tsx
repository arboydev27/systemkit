import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { chapters } from "@/content/chapters";
import { designChallenges } from "@/content/challenges";
import { labs } from "@/content/labs";
import { ChapterStatus, LessonRowStatus } from "@/components/site/SiteClient";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";
import { courseOutline } from "@/lib/lessons";
import { chapterHref, lessonHref } from "@/lib/links";
import { siteShareImage } from "@/lib/share-image";
import { SITE_NAME, SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ chapterId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return chapters.map((chapter) => ({ chapterId: chapter.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapterId } = await params;
  const chapter = chapters.find((item) => item.id === chapterId);
  if (!chapter) return {};
  const title = `${chapter.seoTitle} | ${SITE_NAME}`;
  const url = chapterHref(chapter.id);
  return {
    title,
    description: chapter.summary,
    alternates: { canonical: url },
    openGraph: { title, description: chapter.summary, url, type: "article", siteName: SITE_NAME, images: [siteShareImage] },
    twitter: { card: "summary_large_image", title, description: chapter.summary, images: [siteShareImage.url] },
  };
}

export default async function ChapterPage({ params }: Props) {
  const { chapterId } = await params;
  const index = chapters.findIndex((item) => item.id === chapterId);
  if (index < 0) notFound();
  const chapter = chapters[index];
  const outline = courseOutline[index];
  const previous = chapters[index - 1];
  const next = chapters[index + 1];
  const chapterLabs = labs.filter((lab) => lab.lesson.chapterId === chapter.id);
  const challenge = designChallenges.find((item) => item.chapterId === chapter.id);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: chapter.seoTitle,
    description: chapter.summary,
    url: `${SITE_URL}${chapterHref(chapter.id)}`,
    isAccessibleForFree: true,
    provider: { "@type": "Organization", name: SITE_NAME },
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "online", courseWorkload: `${chapter.steps.length} lessons` },
  };
  return <SitePage>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <div className={styles.pageHead}>
      <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/learn/">Learning path</Link><span aria-hidden="true">/</span><span>Chapter {chapter.number}</span></nav>
      <h1>{chapter.title}</h1>
      <p className={styles.lede}>{chapter.summary}</p>
      <ChapterStatus chapter={outline} />
    </div>

    <section aria-labelledby="lessons-heading">
      <h2 id="lessons-heading" className="sr-only">Lessons</h2>
      <ol className={styles.rows}>
        {chapter.steps.map((step, lesson) => <li key={step.id} className={styles.row}>
          <Link href={lessonHref(chapter.id, step.id)}>
            <span className={styles.rowNumber}>{String(lesson + 1).padStart(2, "0")}</span>
            <span className={styles.rowTitle}>{step.title}</span>
            <LessonRowStatus storageKey={chapter.storageKey} stepId={step.id} />
            <span className={styles.rowDetail}>{step.summary}</span>
          </Link>
        </li>)}
      </ol>
    </section>

    {chapterLabs.length || challenge ? <section className={styles.section} style={{ borderTop: 0 }} aria-labelledby="practice-heading">
      <h2 id="practice-heading">Practice this chapter</h2>
      <ol className={styles.rows}>
        {chapterLabs.map((lab) => <li key={lab.id} className={styles.row}>
          <Link href={`/labs/${lab.id}/`}><span className={styles.rowNumber}>Lab</span><span className={styles.rowTitle}>{lab.question}</span><span className={styles.rowDetail}>{lab.description}</span></Link>
        </li>)}
        {challenge ? <li className={styles.row}>
          <Link href={`/practice/${challenge.id}/`}><span className={styles.rowNumber}>Task</span><span className={styles.rowTitle}>{challenge.title}</span><span className={styles.rowDetail}>{challenge.summary}</span></Link>
        </li> : null}
      </ol>
    </section> : null}

    <nav className={styles.neighbors} aria-label="Other chapters">
      {previous ? <Link href={chapterHref(previous.id)}><ArrowLeft size={15} aria-hidden="true" /> {previous.title}</Link> : <span />}
      {next ? <Link href={chapterHref(next.id)}>{next.title} <ArrowRight size={15} aria-hidden="true" /></Link> : <Link href="/practice/">Practice designs <ArrowRight size={15} aria-hidden="true" /></Link>}
    </nav>
  </SitePage>;
}
