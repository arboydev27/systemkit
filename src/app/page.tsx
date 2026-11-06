import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { chapters } from "@/content/chapters";
import { designChallenges } from "@/content/challenges";
import { labs } from "@/content/labs";
import { CourseMap } from "@/components/site/CourseMap";
import { ContinueLink, LabView, ProgressTools } from "@/components/site/SiteClient";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";
import { courseChapters, courseGoals, courseOrb, lessonCount } from "@/lib/course";
import { courseOutline } from "@/lib/lessons";
import { lessonHref } from "@/lib/links";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  const first = chapters[0];
  return <SitePage>
    <section className={styles.hero}>
      <h1>Learn system design by making the calls.</h1>
      <p className={styles.lede}>Predict what breaks. Run the numbers. Write a design of your own and compare it with worked approaches. Useful for interviews and for the design decisions at your job.</p>
      <div className={styles.heroActions}>
        <ContinueLink outline={courseOutline} firstHref={lessonHref(first.id, first.steps[0].id)} firstLabel="Start with lesson one" />
        <a className={styles.secondaryLink} href="#try">Try a lab first</a>
      </div>
      <p className={styles.scope}>Free, with no signup. {chapters.length} chapters, {lessonCount} lessons, {labs.length} labs, and {designChallenges.length} design challenges.</p>
    </section>

    <section id="try" className={`${styles.section} ${styles.tryHeading}`} aria-label="Try a lab">
      <LabView id="retry-storm" standalone={false} headingLevel={2} />
      <p className={styles.moreLabs}>
        {labs.filter((lab) => lab.id !== "retry-storm").map((lab) => <Link key={lab.id} href={`/labs/${lab.id}/`}>{lab.question}</Link>)}
      </p>
    </section>

    <section className={styles.section} aria-labelledby="how-heading">
      <h2 id="how-heading">You learn this by doing it, so that’s what you’ll do.</h2>
      <p className={styles.sectionIntro}>Reading about system design makes it feel familiar. It doesn’t make you able to do it with someone watching. Every part of SystemKit asks you to commit to an answer first.</p>
      <dl className={styles.verbs}>
        <div className={styles.verb}><dt>Predict</dt><dd>Labs run real calculations on the settings you choose, and you have to call the outcome before you see it. <Link href="/labs/">See the labs</Link></dd></div>
        <div className={styles.verb}><dt>Reason</dt><dd>Every lesson puts you in a specific decision and asks for your reasoning in writing before it shows any guidance. <Link href={lessonHref(first.id, first.steps[0].id)}>Open a lesson</Link></dd></div>
        <div className={styles.verb}><dt>Design</dt><dd>Work through a full design against the clock, with a requirement that changes partway through. Then compare it against a checklist and two worked approaches, or paste a prompt into your own chatbot to get critiqued. <Link href="/practice/">Practice a design</Link></dd></div>
        <div className={styles.verb}><dt>Estimate</dt><dd>Fresh numbers each time, checked against the worked answer, because this is the one design skill a machine can honestly grade. <Link href="/practice/estimation/">Run a drill</Link></dd></div>
        <div className={styles.verb}><dt>Recall</dt><dd>Five minutes of spaced review brings back what you studied, just as you’re starting to forget it. <Link href="/review/">Open your review</Link></dd></div>
      </dl>
    </section>

    <section id="path" className={styles.section} aria-labelledby="path-heading">
      <h2 id="path-heading">The learning path</h2>
      <CourseMap chapters={courseChapters} goals={courseGoals} orb={courseOrb} />
    </section>

    <section id="progress" className={styles.section} aria-labelledby="progress-heading">
      <h2 id="progress-heading">Your progress lives in this browser.</h2>
      <p className={styles.sectionIntro}>There are no accounts, so there’s nothing to sign up for, and your answers and notes never leave this browser. The tradeoff is that browsers can clear saved data: Safari, for one, may remove it after seven days of use without a visit here. A backup file keeps it safe, and it’s also how you move to another device.</p>
      <ProgressTools />
    </section>
  </SitePage>;
}
