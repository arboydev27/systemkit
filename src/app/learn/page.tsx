import type { Metadata } from "next";
import { CourseMap } from "@/components/site/SiteClient";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";
import { courseChapters, courseGoals, lessonCount } from "@/lib/course";

export const metadata: Metadata = {
  title: "The system design learning path | SystemKit",
  description: "Every SystemKit chapter in teaching order, from how to approach a design to how data behaves and complete product designs. Free, with no signup.",
  alternates: { canonical: "/learn/" },
};

export default function LearnPage() {
  return <SitePage>
    <div className={styles.pageHead}>
      <h1>The learning path</h1>
      <p className={styles.lede}>{courseChapters.length} chapters and {lessonCount} lessons. Building blocks come before the products that use them, but every chapter stands on its own, so start wherever you need.</p>
    </div>
    <CourseMap chapters={courseChapters} goals={courseGoals} />
    <div style={{ height: 48 }} />
  </SitePage>;
}
