"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Scale to a Million Users: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "single-server": dynamic(() => import("./single-server").then(played)),
  "split-tiers": dynamic(() => import("./split-tiers").then(played)),
  "scale-web": dynamic(() => import("./scale-web").then(played)),
  "replication": dynamic(() => import("./replication").then(played)),
  "cache": dynamic(() => import("./cache").then(played)),
  "cdn": dynamic(() => import("./cdn").then(played)),
  "stateless": dynamic(() => import("./stateless").then(played)),
  "multi-dc": dynamic(() => import("./multi-dc").then(played)),
  "queue": dynamic(() => import("./queue").then(played)),
  "observability": dynamic(() => import("./observability").then(played)),
  "sharding": dynamic(() => import("./sharding").then(played)),
  "synthesis": dynamic(() => import("./synthesis").then(played)),
};
