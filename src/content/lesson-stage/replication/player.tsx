"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Replication and Read Consistency: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "rc-leader": dynamic(() => import("./rc-leader").then(played)),
  "rc-lag": dynamic(() => import("./rc-lag").then(played)),
  "rc-failover": dynamic(() => import("./rc-failover").then(played)),
  "rc-multi": dynamic(() => import("./rc-multi").then(played)),
};
