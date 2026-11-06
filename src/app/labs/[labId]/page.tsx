import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { findLab, labs } from "@/content/labs";
import { LabView } from "@/components/site/SiteClient";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";
import { lessonHref } from "@/lib/links";
import { siteShareImage } from "@/lib/share-image";
import { SITE_NAME } from "@/lib/site";

type Props = { params: Promise<{ labId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return labs.map((lab) => ({ labId: lab.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lab = findLab((await params).labId);
  if (!lab) return {};
  const title = `${lab.seoTitle} | ${SITE_NAME}`;
  const url = `/labs/${lab.id}/`;
  return {
    title,
    description: lab.description,
    alternates: { canonical: url },
    openGraph: { title, description: lab.description, url, siteName: SITE_NAME, images: [siteShareImage] },
    twitter: { card: "summary_large_image", title, description: lab.description, images: [siteShareImage.url] },
  };
}

export default async function LabPage({ params }: Props) {
  const lab = findLab((await params).labId);
  if (!lab) notFound();
  return <SitePage>
    <div className={styles.pageHead}>
      <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/labs/">Labs</Link><span aria-hidden="true">/</span><span>{lab.title}</span></nav>
      <div className={styles.prose}>{lab.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
    </div>
    <LabView id={lab.id} />
    <p className={styles.labFoot}>This lab goes with a lesson: <Link className={styles.inlineLink} href={lessonHref(lab.lesson.chapterId, lab.lesson.stepId)}>{lab.lesson.title} <ArrowRight size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} /></Link></p>
  </SitePage>;
}
