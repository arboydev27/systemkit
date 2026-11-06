import type { Metadata } from "next";
import Link from "next/link";
import { labs } from "@/content/labs";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";

export const metadata: Metadata = {
  title: "Interactive system design labs | SystemKit",
  description: "Predict what happens, then run it: retry storms, rate limiter algorithms, quorum reads, and cache failures, computed from the settings you choose.",
  alternates: { canonical: "/labs/" },
};

export default function LabsPage() {
  return <SitePage>
    <div className={styles.pageHead}>
      <h1>Labs</h1>
      <p className={styles.lede}>Each lab runs a small, honest model on the settings you choose. You call the outcome first. They teach how a failure behaves, not what your latency will be, and each one lists what it assumes.</p>
    </div>
    <ol className={styles.rows} style={{ marginBottom: 48 }}>
      {labs.map((lab) => <li key={lab.id} className={styles.row}>
        <Link href={`/labs/${lab.id}/`}><span className={styles.rowNumber}>Lab</span><span className={styles.rowTitle}>{lab.question}</span><span className={styles.rowDetail}>{lab.description}</span></Link>
      </li>)}
    </ol>
  </SitePage>;
}
