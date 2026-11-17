import type { StageScene } from "../../../lib/lesson-stage/types";
import { singleServerStage } from "./single-server";
import { splitTiersStage } from "./split-tiers";
import { scaleWebStage } from "./scale-web";
import { replicationStage } from "./replication";
import { cacheStage } from "./cache";
import { cdnStage } from "./cdn";
import { statelessStage } from "./stateless";
import { multiDcStage } from "./multi-dc";
import { queueStage } from "./queue";
import { observabilityStage } from "./observability";
import { shardingStage } from "./sharding";
import { synthesisStage } from "./synthesis";

// Each lesson of "Scale to a Million Users" as an animated, step-through scene, keyed by the lesson's diagram id.
const all: (StageScene | null)[] = [
  singleServerStage, splitTiersStage, scaleWebStage, replicationStage, cacheStage, cdnStage,
  statelessStage, multiDcStage, queueStage, observabilityStage, shardingStage, synthesisStage,
];

export const scalingStages: Record<string, StageScene> = Object.fromEntries(
  all.filter((scene): scene is StageScene => scene !== null).map((scene) => [scene.id, scene]),
);
