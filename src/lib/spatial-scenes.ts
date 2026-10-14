import { diagramScenes as scaling } from "../components/ArchitectureDiagram";
import { diagramScenes as framework } from "../components/FrameworkDiagram";
import { diagramScenes as estimation } from "../components/EstimationDiagram";
import { diagramScenes as url } from "../components/UrlShortenerDiagram";
import { diagramScenes as chat } from "../components/ChatDiagram";
import { diagramScenes as youtube } from "../components/YouTubeDiagram";
import { diagramScenes as notification } from "../components/NotificationDiagram";
import { diagramScenes as rate } from "../components/RateLimiterDiagram";
import { diagramScenes as feed } from "../components/NewsFeedDiagram";
import { diagramScenes as autocomplete } from "../components/AutocompleteDiagram";
import { diagramScenes as kv } from "../components/KeyValueDiagram";
import { diagramScenes as foundation } from "../components/FoundationDiagram";
import { diagramScenes as drive } from "../components/GoogleDriveDiagram";
import { diagramScenes as crawler } from "../components/WebCrawlerDiagram";
import { spatialScene } from "./spatial-model";

const libraries: Record<string, { scenes: Record<string, unknown>; height: number }> = {
  scaling: { scenes: scaling, height: 58 }, framework: { scenes: framework, height: 74 },
  estimation: { scenes: estimation, height: 80 }, url: { scenes: url, height: 74 },
  chat: { scenes: chat, height: 82 }, youtube: { scenes: youtube, height: 74 },
  notification: { scenes: notification, height: 82 }, "rate-limiter": { scenes: rate, height: 82 },
  "news-feed": { scenes: feed, height: 82 }, autocomplete: { scenes: autocomplete, height: 74 },
  "key-value": { scenes: kv, height: 82 }, "consistent-hashing": { scenes: foundation, height: 104 },
  "unique-id": { scenes: foundation, height: 104 }, "google-drive": { scenes: drive, height: 82 },
  "web-crawler": { scenes: crawler, height: 74 },
};

export function getSpatialScene(chapterId: string, diagramId: string) {
  const library = libraries[chapterId];
  if (!library) throw new Error("Unknown diagram chapter");
  return spatialScene(diagramId, library.scenes[diagramId], library.height);
}
