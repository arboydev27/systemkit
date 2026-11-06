import type { Metadata } from "next";
import Link from "next/link";
import { designChallenges } from "@/content/challenges";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";

export const metadata: Metadata = {
  title: "Practice system design: timed challenges and estimation drills | SystemKit",
  description: "Free system design practice with no signup. Write a full design against the clock, handle a changing requirement, compare worked approaches, and drill estimation.",
  alternates: { canonical: "/practice/" },
};

export default function PracticePage() {
  return <SitePage>
    <div className={styles.pageHead}>
      <h1>Practice</h1>
      <p className={styles.lede}>Knowing the concepts isn’t the same as producing a design under pressure. These ask you to write one, on a clock if you like, then compare it with worked approaches. No signup, and what you write stays in this browser.</p>
    </div>
    <h2 className={styles.partTitle}>Estimation</h2>
    <ol className={styles.rows}>
      <li className={styles.row}><Link href="/practice/estimation/"><span className={styles.rowNumber}>Drill</span><span className={styles.rowTitle}>Back-of-the-envelope estimation drills</span><span className={styles.rowDetail}>New numbers each time, checked against the worked answer.</span></Link></li>
    </ol>
    <div className={styles.part} style={{ marginBottom: 48 }}>
      <h2 className={styles.partTitle}>Design challenges</h2>
      <ol className={styles.rows}>
        {designChallenges.map((challenge) => <li key={challenge.id} className={styles.row}>
          <Link href={`/practice/${challenge.id}/`}><span className={styles.rowNumber}>Task</span><span className={styles.rowTitle}>{challenge.title}</span><span className={styles.rowMeta}>{challenge.minutes} min</span><span className={styles.rowDetail}>{challenge.summary}</span></Link>
        </li>)}
      </ol>
    </div>
  </SitePage>;
}
