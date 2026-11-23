"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Storage Engines: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "se-log": dynamic(() => import("./se-log").then(played)),
  "se-lsm": dynamic(() => import("./se-lsm").then(played)),
  "se-btree": dynamic(() => import("./se-btree").then(played)),
  "se-choose": dynamic(() => import("./se-choose").then(played)),
  "se-indexes": dynamic(() => import("./se-indexes").then(played)),
  "se-olap": dynamic(() => import("./se-olap").then(played)),
};
