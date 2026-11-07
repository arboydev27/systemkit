import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { chapters } from "@/content/chapters";
import { designChallenges, findChallenge } from "@/content/challenges";
import { labs } from "@/content/labs";
import { reviewVariations } from "@/content/review";
import { CourseMap, CourseScope, StartLink } from "@/components/site/CourseMap";
import { DueReviewBadge, HomeLab } from "@/components/site/SiteClient";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";
import { courseChapters, courseGoals, courseOrb, lessonCount } from "@/lib/course";
import { buildDrill } from "@/lib/estimation-drills";
import { lessonHref } from "@/lib/links";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Real questions from each part of the course, so this section shows what it's describing.
const DRILL = "qps.7";
const CHALLENGE = "pastebin";
const RECALL = "framework/framework-estimates";

export default function Home() {
  const first = chapters[0];
  const firstLesson = first.steps[0];
  const firstHref = lessonHref(first.id, firstLesson.id);
  const challenge = findChallenge(CHALLENGE)!;
  const drill = buildDrill(DRILL)!;
  const recall = reviewVariations[RECALL];

  return <SitePage wide>
    <CourseMap
      chapters={courseChapters}
      goals={courseGoals}
      orb={courseOrb}
      lead={<>
        <h1>Learn system design by making the calls.</h1>
        <p className={styles.lede}>Predict what breaks. Run the numbers. Write a design of your own and compare it with worked approaches. Useful for interviews and for the design decisions at your job.</p>
        <div className={styles.heroActions}>
          <StartLink href={firstHref} label="Start with lesson one" />
          <a className={styles.secondaryLink} href="#try">Try a lab</a>
        </div>
        <CourseScope><strong>Free, with no signup.</strong> {chapters.length} chapters, {lessonCount} lessons, {labs.length} labs, and {designChallenges.length} design challenges.</CourseScope>
      </>}
    />

    <section id="try" className={`${styles.section} ${styles.spine}`} aria-labelledby="try-heading">
      <div className={styles.spineWords}>
        <h2 id="try-heading">You learn this by doing it, so that’s what you’ll do.</h2>
        <p className={styles.sectionIntro}>Reading about system design makes it feel familiar. It doesn’t make you able to do it with someone watching. So every part of SystemKit asks you to commit to an answer first. Here’s one to try.</p>
      </div>
      <div>
        <HomeLab />
        <ul className={`${styles.rows} ${styles.moreLabs}`} aria-label="More labs">
          {labs.filter((lab) => lab.id !== "retry-storm").map((lab) => <li key={lab.id} className={styles.row}>
            <Link href={`/labs/${lab.id}/`}><span className={styles.rowNumber}>Lab</span><span className={styles.rowTitle}>{lab.question}</span></Link>
          </li>)}
        </ul>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="practice-heading">
      <h2 id="practice-heading">The rest of SystemKit asks you first, too.</h2>
      <div className={`${styles.spine} ${styles.practice}`}>
        <div className={styles.spineWords}>
          <h3>Reason through a lesson</h3>
          <p>Every lesson puts you in a specific decision and asks for your reasoning in writing before it shows any guidance.</p>
        </div>
        <div className={styles.specimen}>
          <p className={styles.specimenAsk}>{firstLesson.scenario}</p>
          <div className={styles.specimenFoot}>
            <span>Lesson one: {firstLesson.title}</span>
            <Link href={firstHref}>Answer it in the lesson <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>

      <div className={`${styles.spine} ${styles.practice}`}>
        <div className={styles.spineWords}>
          <h3>Design against the clock</h3>
          <p>Work through a full design with a requirement that changes partway through. Then compare it against a checklist and two worked approaches, or paste a prompt into your own chatbot to get critiqued.</p>
        </div>
        <div className={styles.specimen}>
          <p className={styles.specimenAsk}>{challenge.title}</p>
          <p className={styles.specimenBody}>{challenge.summary}</p>
          <div className={styles.specimenFoot}>
            <span>{challenge.minutes} minutes. One of {designChallenges.length} challenges.</span>
            <Link href={`/practice/${challenge.id}/`}>Start this one <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>

      <div className={`${styles.spine} ${styles.practice}`}>
        <div className={styles.spineWords}>
          <h3>Estimate with fresh numbers</h3>
          <p>New numbers each time, checked against the worked answer, because this is the one design skill a machine can honestly grade.</p>
        </div>
        <div className={styles.specimen}>
          <p className={styles.specimenAsk}>{drill.prompt}</p>
          <div className={styles.specimenFoot}>
            <span>Answer in {drill.unit}</span>
            <Link href={`/practice/estimation/?drill=${DRILL}`}>Check your estimate <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>

      <div className={`${styles.spine} ${styles.practice}`}>
        <div className={styles.spineWords}>
          <h3>Recall it in five minutes</h3>
          <p>Short spaced review brings back what you studied, just as you’re starting to forget it.</p>
        </div>
        <div className={styles.specimen}>
          <p className={styles.specimenAsk}>{recall.prompts[0]}</p>
          <details className={styles.specimenAnswer}>
            <summary>Show the answer</summary>
            <p>{recall.answer}</p>
          </details>
          <div className={styles.specimenFoot}>
            <span>Review questions come from lessons you’ve studied.</span>
            <Link href="/review/">Open your review <DueReviewBadge /> <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </section>
  </SitePage>;
}
