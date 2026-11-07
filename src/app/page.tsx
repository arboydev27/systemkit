import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { chapters } from "@/content/chapters";
import { designChallenges, findChallenge } from "@/content/challenges";
import { labs } from "@/content/labs";
import { reviewVariations } from "@/content/review";
import { CourseScope } from "@/components/site/CourseMap";
import { FluidField, OrbHome } from "@/components/site/OrbHome";
import home from "@/components/site/OrbHome.module.css";
import { DueReviewBadge, HomeLab } from "@/components/site/SiteClient";
import { SitePage } from "@/components/site/SiteChrome";
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

  return <SitePage home>
    <FluidField />
    <div className={home.world}>
      <OrbHome
        chapters={courseChapters}
        goals={courseGoals}
        graph={courseOrb}
        start={{ href: firstHref, label: "Start lesson one" }}
        counts={{ labs: labs.length, challenges: designChallenges.length }}
        words={<h1>Learn system design by making the calls.</h1>}
        foot={<>
          <p className={home.lede}>Predict what breaks. Run the numbers. Write a design of your own and compare it with worked approaches. Useful for interviews and for the design decisions at your job.</p>
          <CourseScope><strong>Free, with no signup.</strong> {chapters.length} chapters, {lessonCount} lessons, {labs.length} labs, and {designChallenges.length} design challenges.</CourseScope>
          <a className={home.tryLink} href="#try">Try a lab first <ArrowDown size={15} aria-hidden="true" /></a>
        </>}
      />

      <section id="try" className={home.try} aria-labelledby="try-heading">
        <div className={home.tryHead}>
          <h2 id="try-heading">You learn this by doing it, so that’s what you’ll do.</h2>
          <p>Reading about system design makes it feel familiar. It doesn’t make you able to do it with someone watching. So every part of SystemKit asks you to commit to an answer first. Here’s one to try.</p>
        </div>
        <HomeLab className={home.labCard} />
        <ul className={home.moreLabs} aria-label="More labs">
          {labs.filter((lab) => lab.id !== "retry-storm").map((lab) => <li key={lab.id}>
            <Link href={`/labs/${lab.id}/`}><span>{lab.question}</span> <ArrowRight size={15} aria-hidden="true" /></Link>
          </li>)}
        </ul>
      </section>
    </div>

    <section className={home.asks} aria-labelledby="practice-heading">
      <h2 id="practice-heading">The rest of SystemKit asks you first, too.</h2>
      <div className={home.bento}>
        <article className={`${home.ask} ${home.askWide}`}>
          <h3>Reason through a lesson</h3>
          <p>Every lesson puts you in a specific decision and asks for your reasoning in writing before it shows any guidance.</p>
          <p className={home.askQuestion}>{firstLesson.scenario}</p>
          <div className={home.askFoot}>
            <span>Lesson one: {firstLesson.title}</span>
            <Link href={firstHref}>Answer it in the lesson <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </article>

        <article className={home.ask}>
          <h3>Design against the clock</h3>
          <p>Work through a full design with a requirement that changes partway through, then compare it against a checklist and two worked approaches.</p>
          <p className={home.askQuestion}>{challenge.title}</p>
          <div className={home.askFoot}>
            <span>{challenge.minutes} minutes</span>
            <Link href={`/practice/${challenge.id}/`}>Start this one <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </article>

        <article className={home.ask}>
          <h3>Estimate with fresh numbers</h3>
          <p>New numbers each time, checked against the worked answer, because this is the one design skill a machine can honestly grade.</p>
          <p className={home.askQuestion}>{drill.prompt}</p>
          <div className={home.askFoot}>
            <span>Answer in {drill.unit}</span>
            <Link href={`/practice/estimation/?drill=${DRILL}`}>Check your estimate <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </article>

        <article className={`${home.ask} ${home.askWide}`}>
          <h3>Recall it in five minutes</h3>
          <p>Short spaced review brings back what you studied, just as you’re starting to forget it.</p>
          <p className={home.askQuestion}>{recall.prompts[0]}</p>
          <details className={home.askAnswer}>
            <summary>Show the answer</summary>
            <p>{recall.answer}</p>
          </details>
          <div className={home.askFoot}>
            <span>Review questions come from lessons you’ve studied.</span>
            <Link href="/review/">Open your review <DueReviewBadge /> <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </article>
      </div>
    </section>
  </SitePage>;
}
