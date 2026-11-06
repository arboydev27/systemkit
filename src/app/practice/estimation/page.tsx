import type { Metadata } from "next";
import Link from "next/link";
import { EstimationDrillView } from "@/components/site/PracticeClient";
import { SitePage } from "@/components/site/SiteChrome";
import styles from "@/components/site/Site.module.css";

export const metadata: Metadata = {
  title: "Back-of-the-envelope estimation practice | SystemKit",
  description: "Practice system design estimation with fresh numbers each time: traffic, storage, bandwidth, servers, cache size, and availability, checked against worked answers.",
  alternates: { canonical: "/practice/estimation/" },
};

export default function EstimationPracticePage() {
  return <SitePage>
    <div className={styles.pageHead}>
      <nav className={styles.crumbs} aria-label="Breadcrumb"><Link href="/practice/">Practice</Link><span aria-hidden="true">/</span><span>Estimation</span></nav>
    </div>
    <EstimationDrillView />
  </SitePage>;
}
