import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { designChallenges } from "@/content/challenges";
import { chapters } from "@/content/chapters";
import { labs } from "@/content/labs";
import { CourseScope } from "@/components/site/CourseMap";
import { HomeFixes } from "@/components/site/HomeFixes";
import { ScaleGameSlot } from "@/components/site/HomeMotion";
import { FluidField, MiloHome } from "@/components/site/MiloHome";
import home from "@/components/site/MiloHome.module.css";
import { SitePage } from "@/components/site/SiteChrome";
import { courseChapters, courseGoals, courseOrb } from "@/lib/course";
import { lessonHref } from "@/lib/links";

export const metadata: Metadata = { alternates: { canonical: "/" } };
// The home page runs edge to edge, into the room beside a phone's notch when it's on its side: its soft light and the
// dive fill the whole screen, while everything to read or touch keeps clear of the notch and the screen's rounded corners.
export const viewport: Viewport = { viewportFit: "cover" };

export default function Home() {
  const first = chapters[0];

  return <SitePage home>
    <FluidField />
    <div className={home.world}>
      <MiloHome
        chapters={courseChapters}
        goals={courseGoals}
        graph={courseOrb}
        start={{ href: lessonHref(first.id, first.steps[0].id), label: "Start lesson one" }}
        counts={{ labs: labs.length, challenges: designChallenges.length }}
        words={<h1>Learn system design by making the calls.</h1>}
        foot={<>
          <p className={home.lede}>Predict what breaks. Run the numbers. Compare your design with worked approaches.</p>
          <CourseScope><strong>Free, with no signup.</strong></CourseScope>
          <a className={home.tryLink} href="#try">Make a call now <ArrowDown size={15} aria-hidden="true" /></a>
        </>}
      />

      <section id="try" className={home.try} aria-labelledby="try-heading">
        <h2 id="try-heading">Your app just went viral.</h2>
        <ScaleGameSlot />
        <noscript><p className={home.tryFallback}><Link href="/learn/scaling/">Scale to a Million Users <ArrowRight size={15} aria-hidden="true" /></Link></p><style>{"[data-scale-slot]{display:none}"}</style></noscript>
      </section>
    </div>

    <section className={home.asks} aria-labelledby="fixes-heading">
      <h2 id="fixes-heading">Every lesson fixes something.</h2>
      <HomeFixes />
    </section>
  </SitePage>;
}
