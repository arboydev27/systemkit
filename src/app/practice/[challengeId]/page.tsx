import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { designChallenges, findChallenge } from "@/content/challenges";
import { DesignChallengeView } from "@/components/site/PracticeClient";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";
import { chapterHref } from "@/lib/links";
import { siteShareImage } from "@/lib/share-image";
import { SITE_NAME } from "@/lib/site";

type Props = { params: Promise<{ challengeId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return designChallenges.map((challenge) => ({ challengeId: challenge.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const challenge = findChallenge((await params).challengeId);
  if (!challenge) return {};
  const title = `${challenge.title}: system design practice | ${SITE_NAME}`;
  const url = `/practice/${challenge.id}/`;
  return {
    title,
    description: challenge.summary,
    alternates: { canonical: url },
    openGraph: { title, description: challenge.summary, url, siteName: SITE_NAME, images: [siteShareImage] },
    twitter: { card: "summary_large_image", title, description: challenge.summary, images: [siteShareImage.url] },
  };
}

export default async function ChallengePage({ params }: Props) {
  const challenge = findChallenge((await params).challengeId);
  if (!challenge) notFound();
  return <SitePage>
    <div className={styles.pageHead} style={{ paddingBottom: 0 }}>
      <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/practice/">Practice</Link><span aria-hidden="true">/</span><Link href={chapterHref(challenge.chapterId)}>Related chapter</Link></nav>
    </div>
    <DesignChallengeView challenge={challenge} />
    <div style={{ height: 40 }} />
  </SitePage>;
}
