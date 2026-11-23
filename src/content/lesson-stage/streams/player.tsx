"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Streams and Schema Evolution: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "st-batch-stream": dynamic(() => import("./st-batch-stream").then(played)),
  "st-log": dynamic(() => import("./st-log").then(played)),
  "st-delivery": dynamic(() => import("./st-delivery").then(played)),
  "st-cdc": dynamic(() => import("./st-cdc").then(played)),
  "st-event-time": dynamic(() => import("./st-event-time").then(played)),
  "st-schema": dynamic(() => import("./st-schema").then(played)),
};
