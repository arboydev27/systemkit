"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Web Crawler: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "crawler-scope": dynamic(() => import("./crawler-scope").then(played)),
  "crawler-pipeline": dynamic(() => import("./crawler-pipeline").then(played)),
  "crawler-policy": dynamic(() => import("./crawler-policy").then(played)),
  "crawler-frontier": dynamic(() => import("./crawler-frontier").then(played)),
  "crawler-dedup": dynamic(() => import("./crawler-dedup").then(played)),
  "crawler-fetch": dynamic(() => import("./crawler-fetch").then(played)),
  "crawler-freshness": dynamic(() => import("./crawler-freshness").then(played)),
  "crawler-scale": dynamic(() => import("./crawler-scale").then(played)),
};
