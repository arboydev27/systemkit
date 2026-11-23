"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Google Drive: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "drive-scope": dynamic(() => import("./drive-scope").then(played)),
  "drive-metadata": dynamic(() => import("./drive-metadata").then(played)),
  "drive-upload": dynamic(() => import("./drive-upload").then(played)),
  "drive-sync": dynamic(() => import("./drive-sync").then(played)),
  "drive-conflicts": dynamic(() => import("./drive-conflicts").then(played)),
  "drive-sharing": dynamic(() => import("./drive-sharing").then(played)),
  "drive-download": dynamic(() => import("./drive-download").then(played)),
  "drive-operations": dynamic(() => import("./drive-operations").then(played)),
};
