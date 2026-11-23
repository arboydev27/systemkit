"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Search Autocomplete: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "autocomplete-scope": dynamic(() => import("./autocomplete-scope").then(played)),
  "autocomplete-traffic": dynamic(() => import("./autocomplete-traffic").then(played)),
  "autocomplete-prefix": dynamic(() => import("./autocomplete-prefix").then(played)),
  "autocomplete-rank": dynamic(() => import("./autocomplete-rank").then(played)),
  "autocomplete-pipeline": dynamic(() => import("./autocomplete-pipeline").then(played)),
  "autocomplete-serve": dynamic(() => import("./autocomplete-serve").then(played)),
  "autocomplete-scale": dynamic(() => import("./autocomplete-scale").then(played)),
  "autocomplete-ops": dynamic(() => import("./autocomplete-ops").then(played)),
};
