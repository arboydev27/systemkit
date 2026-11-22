"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Consensus, CAP, and Ordering: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "cs-linearizability": dynamic(() => import("./cs-linearizability").then(played)),
  "cs-cap": dynamic(() => import("./cs-cap").then(played)),
};
