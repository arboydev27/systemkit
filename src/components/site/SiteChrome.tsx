import Link from "next/link";
import { Layers3 } from "lucide-react";
import type { ReactNode } from "react";
import { REPO_URL } from "@/lib/site";
import { DueReviewBadge } from "./SiteClient";
import styles from "./Site.module.css";

export function SitePage({ children }: { children: ReactNode }) {
  return <div className={styles.page}>
    <a className="skip-link" href="#site-content">Skip to content</a>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="SystemKit home">
        <span aria-hidden="true"><Layers3 size={19} strokeWidth={2.2} /></span>SystemKit
      </Link>
      <nav className={styles.nav} aria-label="Main">
        <Link href="/learn/">Learn</Link>
        <Link href="/labs/">Labs</Link>
        <Link href="/practice/">Practice</Link>
        <Link href="/review/">Review <DueReviewBadge /></Link>
      </nav>
    </header>
    <main id="site-content" className={styles.main} tabIndex={-1}>{children}</main>
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div>
          <p>SystemKit is free and has no accounts. Your answers, notes, and designs stay in this browser. Anonymous page counts help show which parts get used.</p>
          <p>Lessons are original teaching material informed by Alex Xu’s <em>System Design Interview</em>, Martin Kleppmann’s <em>Designing Data-Intensive Applications</em>, and primary sources. Self-checks and labs teach reasoning; they don’t certify mastery.</p>
        </div>
        <div className={styles.footerLinks}>
          <Link href="/#progress">Back up progress</Link>
          <a href={REPO_URL} rel="noreferrer">Source on GitHub</a>
        </div>
      </div>
    </footer>
  </div>;
}
