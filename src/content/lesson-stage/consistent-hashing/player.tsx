"use client";
import dynamic from "next/dynamic";
import { played, type Players } from "@/components/lesson-stage/played";

// Consistent Hashing: each staged lesson loads only its own scene. Keep one line per id in index.ts.
export const players: Players = {};
