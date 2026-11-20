"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Transactions and Isolation: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {
  "tx-acid": dynamic(() => import("./tx-acid").then(played)),
  "tx-read-committed": dynamic(() => import("./tx-read-committed").then(played)),
  "tx-snapshot": dynamic(() => import("./tx-snapshot").then(played)),
  "tx-lost-update": dynamic(() => import("./tx-lost-update").then(played)),
  "tx-write-skew": dynamic(() => import("./tx-write-skew").then(played)),
  "tx-serializable": dynamic(() => import("./tx-serializable").then(played)),
};
