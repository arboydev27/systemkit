import { chapters } from "./chapters";
import { lessonKey, type ReviewCard, type ReviewVariation } from "../lib/review";
import { frameworkReview } from "./review/framework";
import { estimationReview } from "./review/estimation";
import { scalingReview } from "./review/scaling";
import { ordinaryScaleReview } from "./review/ordinary-scale";
import { storageEnginesReview } from "./review/storage-engines";
import { replicationReview } from "./review/replication";
import { consistentHashingReview } from "./review/consistent-hashing";
import { keyValueReview } from "./review/key-value";
import { transactionsReview } from "./review/transactions";
import { consensusReview } from "./review/consensus";
import { streamsReview } from "./review/streams";
import { uniqueIdReview } from "./review/unique-id";
import { patternsReview } from "./review/patterns";
import { rateLimiterReview } from "./review/rate-limiter";
import { urlReview } from "./review/url";
import { notificationReview } from "./review/notification";
import { chatReview } from "./review/chat";
import { newsFeedReview } from "./review/news-feed";
import { autocompleteReview } from "./review/autocomplete";
import { youtubeReview } from "./review/youtube";
import { googleDriveReview } from "./review/google-drive";
import { webCrawlerReview } from "./review/web-crawler";

export const reviewVariations: Record<string, ReviewVariation> = {
  ...frameworkReview, ...estimationReview, ...scalingReview, ...ordinaryScaleReview,
  ...storageEnginesReview, ...replicationReview, ...consistentHashingReview, ...keyValueReview,
  ...transactionsReview, ...consensusReview, ...streamsReview, ...uniqueIdReview,
  ...patternsReview, ...rateLimiterReview, ...urlReview, ...notificationReview, ...chatReview,
  ...newsFeedReview, ...autocompleteReview, ...youtubeReview, ...googleDriveReview, ...webCrawlerReview,
};

export const reviewCards: ReviewCard[] = chapters.flatMap((chapter) => chapter.steps.map((step) => {
  const id = lessonKey(chapter.id, step.id);
  const variation = reviewVariations[id];
  if (!variation) throw new Error(`No review prompts for ${id}. Add them in src/content/review/.`);
  return { id, chapterId: chapter.id, stepId: step.id, chapterTitle: chapter.title,
    lessonTitle: step.title, prompts: variation.prompts.map((prompt) => ({ prompt, answer: variation.answer })) };
}));
