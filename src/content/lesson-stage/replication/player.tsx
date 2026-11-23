"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Replication and Read Consistency: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "rc-lag": dynamic(() => import("./rc-lag").then(played)),
};
