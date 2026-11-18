"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { Players } from "./played";

type Props = { id: string; title: string };

function chapterPlayer(players: Players): ComponentType<Props> {
  return function ChapterPlayer({ id, title }: Props) {
    const P = players[id];
    return P ? <P key={id} title={title} /> : null;
  };
}

// One small chunk per chapter that lists its staged lessons; a lesson then loads only its own scene.
// Written once for every chapter: adding a stage touches only the chapter's folder in src/content/lesson-stage/.
const chapters: Record<string, ComponentType<Props>> = {
  framework: dynamic(() => import("@/content/lesson-stage/framework/player").then((m) => chapterPlayer(m.players))),
  scaling: dynamic(() => import("@/content/lesson-stage/scaling/player").then((m) => chapterPlayer(m.players))),
  estimation: dynamic(() => import("@/content/lesson-stage/estimation/player").then((m) => chapterPlayer(m.players))),
  url: dynamic(() => import("@/content/lesson-stage/url/player").then((m) => chapterPlayer(m.players))),
  chat: dynamic(() => import("@/content/lesson-stage/chat/player").then((m) => chapterPlayer(m.players))),
  youtube: dynamic(() => import("@/content/lesson-stage/youtube/player").then((m) => chapterPlayer(m.players))),
  notification: dynamic(() => import("@/content/lesson-stage/notification/player").then((m) => chapterPlayer(m.players))),
  "rate-limiter": dynamic(() => import("@/content/lesson-stage/rate-limiter/player").then((m) => chapterPlayer(m.players))),
  "news-feed": dynamic(() => import("@/content/lesson-stage/news-feed/player").then((m) => chapterPlayer(m.players))),
  autocomplete: dynamic(() => import("@/content/lesson-stage/autocomplete/player").then((m) => chapterPlayer(m.players))),
  "key-value": dynamic(() => import("@/content/lesson-stage/key-value/player").then((m) => chapterPlayer(m.players))),
  "consistent-hashing": dynamic(() => import("@/content/lesson-stage/consistent-hashing/player").then((m) => chapterPlayer(m.players))),
  "unique-id": dynamic(() => import("@/content/lesson-stage/unique-id/player").then((m) => chapterPlayer(m.players))),
  "google-drive": dynamic(() => import("@/content/lesson-stage/google-drive/player").then((m) => chapterPlayer(m.players))),
  "web-crawler": dynamic(() => import("@/content/lesson-stage/web-crawler/player").then((m) => chapterPlayer(m.players))),
  "ordinary-scale": dynamic(() => import("@/content/lesson-stage/ordinary-scale/player").then((m) => chapterPlayer(m.players))),
  "storage-engines": dynamic(() => import("@/content/lesson-stage/storage-engines/player").then((m) => chapterPlayer(m.players))),
  replication: dynamic(() => import("@/content/lesson-stage/replication/player").then((m) => chapterPlayer(m.players))),
  transactions: dynamic(() => import("@/content/lesson-stage/transactions/player").then((m) => chapterPlayer(m.players))),
  consensus: dynamic(() => import("@/content/lesson-stage/consensus/player").then((m) => chapterPlayer(m.players))),
  streams: dynamic(() => import("@/content/lesson-stage/streams/player").then((m) => chapterPlayer(m.players))),
  patterns: dynamic(() => import("@/content/lesson-stage/patterns/player").then((m) => chapterPlayer(m.players))),
};

/** A lesson's animated stage, or nothing when its chapter doesn't stage that lesson. */
export function StagePlayer({ chapter, id, title }: { chapter: string; id: string; title: string }) {
  const Player = chapters[chapter];
  return Player ? <Player id={id} title={title} /> : null;
}
