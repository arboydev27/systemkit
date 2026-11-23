import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { designChallenges } from "@/content/challenges";
import { chapters } from "@/content/chapters";
import { homeFixes, retryFix } from "@/content/home-fixes";
import { labs } from "@/content/labs";
import { lessonHref } from "@/lib/links";
import { PlayOnce } from "./HomeMotion";
import { FixPicture, FixReadout } from "./HomeVisuals";
import styles from "./HomeFixes.module.css";

/** Everything a tile shows, read from the course itself: its part, the lesson, and what to try once it's read. */
export function homeFixTiles() {
  return homeFixes.map((fix) => {
    const chapter = chapters.find((item) => item.id === fix.chapterId);
    const step = chapter?.steps.find((item) => item.id === fix.stepId);
    if (!chapter || !step) throw new Error(`The home page shows ${fix.chapterId}/${fix.stepId}, which isn't a lesson.`);
    const part = chapters.filter((item) => item.part === chapter.part);
    const lab = labs.find((item) => item.lesson.chapterId === fix.chapterId && item.lesson.stepId === fix.stepId);
    const challenge = designChallenges.find((item) => item.chapterId === fix.chapterId);
    const practice = lab
      ? { href: `/labs/${lab.id}/`, label: "Lab", name: `Lab: ${lab.title}` }
      : challenge ? { href: `/practice/${challenge.id}/`, label: "Challenge", name: `Challenge: ${challenge.title}` } : null;
    return {
      ...fix,
      part: chapter.part,
      lessons: part.reduce((sum, item) => sum + item.steps.length, 0),
      lesson: { title: step.title, href: lessonHref(chapter.id, step.id) },
      readout: fix.readout ?? retryFix().readout,
      practice,
    };
  });
}

/** One tile for each part of the course, each a real lesson's fix drawn from what goes wrong to what it does. */
export function HomeFixes() {
  return <ul className={styles.fixes}>
    {homeFixTiles().map((tile, index) => <PlayOnce key={tile.part} className={styles.fix} style={{ "--column": index % 2 } as CSSProperties}>
      <div className={styles.fixHead}>
        <h3>{tile.part}</h3>
        <span className={styles.fixFacts}>{tile.lessons} lessons</span>
      </div>
      <FixPicture picture={tile.picture} />
      <FixReadout {...tile.readout} />
      <div className={styles.fixFoot}>
        <Link className={styles.fixLesson} href={tile.lesson.href} prefetch={false}>{tile.lesson.title} <ArrowRight size={16} aria-hidden="true" /></Link>
        {tile.practice ? <Link className={styles.fixTry} href={tile.practice.href} prefetch={false} aria-label={tile.practice.name}>{tile.practice.label}</Link> : null}
      </div>
    </PlayOnce>)}
  </ul>;
}
