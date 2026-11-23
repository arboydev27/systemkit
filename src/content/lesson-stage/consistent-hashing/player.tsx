"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Consistent Hashing: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "hash-scope": dynamic(() => import("./hash-scope").then(played)),
  "hash-modulo": dynamic(() => import("./hash-modulo").then(played)),
  "hash-ring": dynamic(() => import("./hash-ring").then(played)),
  "hash-membership": dynamic(() => import("./hash-membership").then(played)),
  "hash-vnodes": dynamic(() => import("./hash-vnodes").then(played)),
  "hash-replicas": dynamic(() => import("./hash-replicas").then(played)),
  "hash-operate": dynamic(() => import("./hash-operate").then(played)),
};
