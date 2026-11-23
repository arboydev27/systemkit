"use client";

import dynamic from "next/dynamic";
import type { DesignChallengeContent } from "@/content/design-challenge";

const DesignChallenge = dynamic(() => import("@/components/DesignChallenge").then((module) => module.DesignChallenge));
const EstimationDrill = dynamic(() => import("@/components/labs/EstimationDrill").then((module) => module.EstimationDrill));

export function DesignChallengeView({ challenge }: { challenge: DesignChallengeContent }) {
  return <DesignChallenge challenge={challenge} headingLevel={1} />;
}

export function EstimationDrillView() {
  return <EstimationDrill standalone headingLevel={1} />;
}
