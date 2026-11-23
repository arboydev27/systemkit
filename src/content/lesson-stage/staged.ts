// Which lessons play as an animated stage, by chapter id and diagram id. Server only: lesson pages read it to choose
// between the stage and the drawing, so no client bundle carries these lists or loads a scene to decide.
import { staged as framework } from "./framework";
import { staged as scaling } from "./scaling";
import { staged as estimation } from "./estimation";
import { staged as url } from "./url";
import { staged as chat } from "./chat";
import { staged as youtube } from "./youtube";
import { staged as notification } from "./notification";
import { staged as rateLimiter } from "./rate-limiter";
import { staged as newsFeed } from "./news-feed";
import { staged as autocomplete } from "./autocomplete";
import { staged as keyValue } from "./key-value";
import { staged as consistentHashing } from "./consistent-hashing";
import { staged as uniqueId } from "./unique-id";
import { staged as googleDrive } from "./google-drive";
import { staged as webCrawler } from "./web-crawler";
import { staged as ordinaryScale } from "./ordinary-scale";
import { staged as storageEngines } from "./storage-engines";
import { staged as replication } from "./replication";
import { staged as transactions } from "./transactions";
import { staged as consensus } from "./consensus";
import { staged as streams } from "./streams";
import { staged as patterns } from "./patterns";

export const stagedLessons: Record<string, readonly string[]> = {
  framework,
  scaling,
  estimation,
  url,
  chat,
  youtube,
  notification,
  "rate-limiter": rateLimiter,
  "news-feed": newsFeed,
  autocomplete,
  "key-value": keyValue,
  "consistent-hashing": consistentHashing,
  "unique-id": uniqueId,
  "google-drive": googleDrive,
  "web-crawler": webCrawler,
  "ordinary-scale": ordinaryScale,
  "storage-engines": storageEngines,
  replication,
  transactions,
  consensus,
  streams,
  patterns,
};

/** True when the chapter's index.ts lists this diagram id as a staged lesson. */
export function hasStage(chapterId: string, diagramId: string): boolean {
  return stagedLessons[chapterId]?.includes(diagramId) ?? false;
}
