import type { Metadata } from "next";
import { ProgressTools } from "@/components/site/ProgressTools";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";

export const metadata: Metadata = {
  title: "Back up your progress | SystemKit",
  description: "Your SystemKit progress lives in this browser. Download a backup to keep it safe or move it to another device.",
  alternates: { canonical: "/progress/" },
  robots: { index: false },
};

export default function ProgressPage() {
  return <SitePage>
    <div className={styles.pageHead}>
      <h1>Your progress lives in this browser.</h1>
      <p className={styles.lede}>There are no accounts, so there’s nothing to sign up for, and your answers and notes never leave this browser. The tradeoff is that browsers can clear saved data: Safari, for one, may remove it after seven days of use without a visit here. A backup file keeps it safe, and it’s also how you move to another device.</p>
    </div>
    <ProgressTools />
    <div style={{ height: 48 }} />
  </SitePage>;
}
