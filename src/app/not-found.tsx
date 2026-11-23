import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";

export const metadata: Metadata = { title: "Page not found | SystemKit", robots: { index: false } };

export default function NotFound() {
  return <SitePage>
    <div className={styles.notFound}>
      <h1>That page doesn’t exist.</h1>
      <p className={styles.lede}>The link may be old or mistyped. Your progress is safe, since it lives in your browser.</p>
      <div className={styles.heroActions}>
        <Link className={styles.primaryLink} href="/learn/">See the learning path <ArrowRight size={17} aria-hidden="true" /></Link>
        <Link className={styles.secondaryLink} href="/">Go to the home page</Link>
      </div>
    </div>
  </SitePage>;
}
