"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// YouTube: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "youtube-scope": dynamic(() => import("./youtube-scope").then(played)),
  "youtube-upload": dynamic(() => import("./youtube-upload").then(played)),
  "youtube-pipeline": dynamic(() => import("./youtube-pipeline").then(played)),
  "youtube-renditions": dynamic(() => import("./youtube-renditions").then(played)),
  "youtube-metadata": dynamic(() => import("./youtube-metadata").then(played)),
  "youtube-playback": dynamic(() => import("./youtube-playback").then(played)),
  "youtube-cost": dynamic(() => import("./youtube-cost").then(played)),
  "youtube-operations": dynamic(() => import("./youtube-operations").then(played)),
};
