import type { SpatialScene } from "../lib/spatial-model";
import type { TeachingContent } from "../lib/spatial-learning-types";
import { frameworkTeachingContent } from "./spatial-learning/framework";
import { scalingTeachingContent } from "./spatial-learning/scaling";
import { estimationTeachingContent } from "./spatial-learning/estimation";
import { urlTeachingContent } from "./spatial-learning/url";
import { chatTeachingContent } from "./spatial-learning/chat";
import { youtubeTeachingContent } from "./spatial-learning/youtube";
import { notificationTeachingContent } from "./spatial-learning/notification";
import { rateLimiterTeachingContent } from "./spatial-learning/rate-limiter";
import { newsFeedTeachingContent } from "./spatial-learning/news-feed";
import { autocompleteTeachingContent } from "./spatial-learning/autocomplete";
import { keyValueTeachingContent } from "./spatial-learning/key-value";
import { consistentHashingTeachingContent } from "./spatial-learning/consistent-hashing";
import { uniqueIdTeachingContent } from "./spatial-learning/unique-id";
import { googleDriveTeachingContent } from "./spatial-learning/google-drive";
import { webCrawlerTeachingContent } from "./spatial-learning/web-crawler";

const chapters: Record<string, Record<string, TeachingContent>> = {
  "framework": frameworkTeachingContent,
  "scaling": scalingTeachingContent,
  "estimation": estimationTeachingContent,
  "url": urlTeachingContent,
  "chat": chatTeachingContent,
  "youtube": youtubeTeachingContent,
  "notification": notificationTeachingContent,
  "rate-limiter": rateLimiterTeachingContent,
  "news-feed": newsFeedTeachingContent,
  "autocomplete": autocompleteTeachingContent,
  "key-value": keyValueTeachingContent,
  "consistent-hashing": consistentHashingTeachingContent,
  "unique-id": uniqueIdTeachingContent,
  "google-drive": googleDriveTeachingContent,
  "web-crawler": webCrawlerTeachingContent,
};

export function createTeachingContent(chapterId: string, diagramId: string, base: SpatialScene): TeachingContent {
  const content = chapters[chapterId]?.[diagramId];
  if (!content || base.id !== diagramId) {
    throw new Error(`Missing or mismatched teaching content for ${chapterId}/${diagramId}`);
  }
  return content;
}
