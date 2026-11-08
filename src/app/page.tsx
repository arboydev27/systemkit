import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { designChallenges, findChallenge } from "@/content/challenges";
import { chapters } from "@/content/chapters";
import { labs } from "@/content/labs";
import { CourseScope } from "@/components/site/CourseMap";
import { EstimateRoll, Live, ScaleGameSlot } from "@/components/site/HomeMotion";
import { CacheChart, DesignChart, ForgettingChart, LimiterChart, QuorumChart, RetryChart } from "@/components/site/HomeVisuals";
import visuals from "@/components/site/HomeVisuals.module.css";
import { FluidField, MiloHome } from "@/components/site/MiloHome";
import home from "@/components/site/MiloHome.module.css";
import { DueReviewBadge } from "@/components/site/SiteClient";
import { SitePage } from "@/components/site/SiteChrome";
import { courseChapters, courseGoals, courseOrb } from "@/lib/course";
import { lessonHref } from "@/lib/links";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const LAB_CHARTS = { "retry-storm": RetryChart, "rate-limiters": LimiterChart, quorum: QuorumChart, cache: CacheChart };
const LAB_ORDER = ["cache", "retry-storm", "rate-limiters", "quorum"] as const;

export default function Home() {
  const first = chapters[0];
  const challenge = findChallenge("pastebin")!;

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

    <section className={home.asks} aria-labelledby="ways-heading">
      <h2 id="ways-heading">Four more ways to make the call.</h2>
      <div className={visuals.bento}>
        <Live className={`${visuals.live} ${visuals.tile} ${visuals.tileWide}`}>
          <div className={visuals.tileHead}>
            <h3><Link href="/labs/">Break it <ArrowRight size={24} aria-hidden="true" /></Link></h3>
            <span className={visuals.tileFacts}>{labs.length} labs</span>
          </div>
          <div className={visuals.labGrid}>
            {LAB_ORDER.map((id) => {
              const lab = labs.find((item) => item.id === id)!;
              const Chart = LAB_CHARTS[id];
              return <Link key={id} className={visuals.lab} href={`/labs/${id}/`}>
                <Chart />
                <span>{lab.title} <ArrowRight size={14} aria-hidden="true" /></span>
              </Link>;
            })}
          </div>
        </Live>

        <Live className={`${visuals.live} ${visuals.tile} ${visuals.tileLink} ${visuals.tileNarrow}`}>
          <div className={visuals.tileHead}>
            <h3><Link href="/review/">Remember it <ArrowRight size={24} aria-hidden="true" /></Link></h3>
            <span className={visuals.tileFacts}>5 minutes <DueReviewBadge /></span>
          </div>
          <div className={visuals.tileBody}><ForgettingChart /></div>
        </Live>

        <div className={`${visuals.tile} ${visuals.tileLink} ${visuals.tileNarrow}`}>
          <div className={visuals.tileHead}>
            <h3><Link href="/practice/estimation/">Estimate it <ArrowRight size={24} aria-hidden="true" /></Link></h3>
            <span className={visuals.tileFacts}>New numbers each time</span>
          </div>
          <div className={visuals.tileBody}><EstimateRoll /></div>
        </div>

        <Live className={`${visuals.live} ${visuals.tile} ${visuals.tileLink} ${visuals.tileWide}`}>
          <div className={visuals.tileHead}>
            <h3><Link href="/practice/">Design it <ArrowRight size={24} aria-hidden="true" /></Link></h3>
            <span className={visuals.tileFacts}>{designChallenges.length} challenges</span>
          </div>
          <div className={visuals.tileBody}><DesignChart minutes={challenge.minutes} /></div>
        </Live>
      </div>
    </section>
  </SitePage>;
}
