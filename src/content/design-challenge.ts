export const designChallenge = {
  id: "photo-sharing",
  storageKey: "systemkit:design-challenge:photo-sharing:v1",
  title: "Design a photo-sharing service",
  summary: "Bring the chapter together in one design, then revisit it when the requirements change.",
  brief: "People upload photos, browse the newest public photos, and open an image. Design the first version for one million registered users, with 100,000 active each day. Keep comments, followers, private albums, and video outside this exercise.",
  assumptions: [
    "Each active user uploads 2 photos and views 100 images per day.",
    "An original photo averages 3 MB; a delivered image averages 200 kB. Use decimal units and 86,400 seconds per day.",
    "Peak traffic is 5 times the daily average. Estimate 30 days of new original-photo storage, before extra copies or renditions.",
    "Uploads may process in the background. A photo appears in public lists only when its image is ready; an accepted upload must survive an application-process crash.",
    "Aim for 300 ms p95 photo-list API reads for users near the origin. Treat this as a target to verify, not a guarantee from the architecture.",
  ],
  change: "Half your active users now live in Europe and Asia, far from the original region. Images arrive quickly through the CDN, but photo lists feel slow. What would you measure and change? Name the new consistency or operational tradeoff.",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and assumptions. Estimate average and peak upload and image-read rates, plus 30 days of original-photo storage. Keep units visible.",
      placeholder: "I would support…\nUploads per second = …\nImage reads per second = …\nStorage for 30 days = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores or does. Trace one upload and one image view, including when metadata becomes visible. An arrow list is enough.",
      placeholder: "Upload: client → …\nView: client → …\nMetadata lives in…; photo bytes live in…",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Choose a likely bottleneck and the evidence that would justify scaling it. Explain how you recover from an application crash or repeated processing job without losing an accepted photo.",
      placeholder: "I would monitor…\nIf a worker crashes…\nI would add capacity when…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the international-traffic change below. Separate slow image delivery from slow API reads, and explain one cost of your change.",
      placeholder: "First I would measure…\nI would change…\nThe tradeoff is…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I show units, separate average from peak, and distinguish original storage from delivered-image traffic." },
    { id: "paths", title: "The request paths are complete.", detail: "I separate metadata from photo bytes and explain upload acceptance, processing, and public visibility." },
    { id: "durability", title: "Accepted work survives a crash.", detail: "I explain durable storage, retryable jobs, and how repeated processing avoids duplicate or inconsistent results." },
    { id: "scale", title: "Each scaling choice has evidence.", detail: "I name a metric or limit that would trigger a replica, cache, worker, or additional application server." },
    { id: "distance", title: "The international change has a tradeoff.", detail: "I measure API latency separately from CDN delivery and explain consistency, failover, cost, or operational consequences." },
  ],
  estimateGuide: "200,000 uploads/day ≈ 2.3 uploads/s average and 12/s at peak. 10 million image views/day ≈ 116 reads/s average and 580/s at peak. Originals add 600 GB/day, or 18 TB in 30 days. Delivered images total about 2 TB/day; this is network traffic, not new original storage. Renditions, replicas, retention, and headroom add to these budgets.",
  solutions: [
    {
      id: "queue",
      title: "A regional service with a durable queue",
      approach: "Use replaceable application servers behind a load balancer, a relational database for photo metadata, object storage for bytes, a durable queue for processing, and a CDN for public images. Begin with a managed database primary and a documented standby/failover plan; these estimates alone do not justify sharding.",
      paths: [
        "Upload: the API creates a pending upload with a stable ID and a scoped upload URL. The client stores the original in object storage. After verifying it exists, the API commits acceptance and an outbox entry (a record of work to publish) in one database transaction. A dispatcher retries delivery to the queue, and a reconciliation job finds uploads stuck pending. Acknowledge acceptance only after that commit.",
        "Process: workers validate and resize the original, write renditions under deterministic keys, then mark the metadata ready. Retries use the upload ID to avoid duplicate results. Only ready rows appear in public lists.",
        "View: the client fetches ready-photo metadata from the API, then requests an immutable rendition URL from the CDN. On a miss, the CDN fetches the bytes from object storage. The API and database do not serve image bytes.",
      ],
      failure: "A crashed application server can be replaced. A crashed worker leaves durable work that another worker retries. Monitor queue age, processing failures, API p95 latency, database query time, and CDN hit rate. Add workers when queue delay breaches the readiness target; optimize list queries and add read capacity or caching only when measurements justify them. A database standby needs tested promotion and an explicit replication-lag/data-loss policy.",
      adaptation: "Measure network round-trip time against API and database time by region. Keep image delivery on the CDN. If distance dominates public-list reads, a regional read replica or short-lived public-list cache can reduce read latency. Newly published photos may appear late in those regions; route an uploader's read-after-write request to the primary or show the pending upload locally. Keep writes in one region initially and define stale-read and regional-failover behavior before expanding further.",
      tradeoff: "The queue makes workers easy to scale independently, but object storage, metadata, and queue events need reconciliation. More services add operational work even when the request rates are modest.",
    },
    {
      id: "job-table",
      title: "A smaller service with a database job table",
      approach: "Use the same object-storage and CDN boundary, with one managed relational database and a small stateless application pool. Store processing jobs in a database table instead of adding a separate broker or application cache immediately. Keep indexed, bounded photo-list queries and a tested database standby/failover plan.",
      paths: [
        "Upload: create a stable pending upload, receive its original in object storage, and verify it exists. In one database transaction, record acceptance and insert a processing job. Return accepted only after that commit; retrying the request with the same upload ID must not create another job.",
        "Process: workers claim durable jobs with leases (claims that expire after a deadline), create deterministic renditions, and commit ready-photo metadata plus job completion together. A lease expiring after a crash allows another worker to retry. A cleanup/reconciliation task handles abandoned originals and pending uploads.",
        "View: the API reads ready-photo metadata using an index and pagination. The client retrieves rendition bytes through the CDN from object storage, just as in the queue design.",
      ],
      failure: "The job table is durable and the estimated upload rate is a reasonable starting workload to benchmark. Monitor polling load, lock contention, queue age, and list-query latency. Move jobs to a dedicated broker if job traffic competes with user queries; use a transactional outbox for that migration. Object storage and the database are separate systems, so recovery and reconciliation still matter.",
      adaptation: "Measure the slow photo-list path first. A short TTL cache of the newest public-photo page at the edge can be a smaller first change if a brief publication delay is acceptable. Authenticated or personalized responses must not enter that shared cache. Keep origin writes centralized; if fresh global reads are required, an edge cache is insufficient and regional data placement needs a deliberate consistency plan.",
      tradeoff: "Fewer services simplify the first release. Workers share database capacity with API reads and writes, so leases, efficient polling, and a clear threshold for moving the queue are essential.",
    },
  ],
} as const;

export type ChallengeFieldId = (typeof designChallenge.fields)[number]["id"];
export type ChallengeDraft = {
  answers: Record<ChallengeFieldId, string>;
  checked: string[];
  reviewed: boolean;
};

export const challengeAnswerLimit = 4000;

export function emptyChallengeDraft(): ChallengeDraft {
  return { answers: { estimate: "", architecture: "", resilience: "", adaptation: "" }, checked: [], reviewed: false };
}

export function hasChallengeAttempt(draft: ChallengeDraft): boolean {
  return designChallenge.fields.every(({ id }) => draft.answers[id].trim().length > 0);
}

export function parseChallengeDraft(raw: string | null): ChallengeDraft {
  const draft = emptyChallengeDraft();
  if (!raw) return draft;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return draft;
    const value = parsed as Partial<ChallengeDraft>;
    if (value.answers && typeof value.answers === "object" && !Array.isArray(value.answers)) {
      for (const { id } of designChallenge.fields) {
        const answer = value.answers[id];
        if (typeof answer === "string") draft.answers[id] = answer.slice(0, challengeAnswerLimit);
      }
    }
    if (Array.isArray(value.checked)) {
      draft.checked = designChallenge.rubric.map(({ id }) => id).filter((id) => value.checked?.includes(id));
    }
    draft.reviewed = value.reviewed === true && hasChallengeAttempt(draft);
    return draft;
  } catch {
    return draft;
  }
}

export function formatChallengeDraft(draft: ChallengeDraft): string {
  const answers = designChallenge.fields.map(({ id, title }) => `${title}\n${draft.answers[id] || "(No response yet)"}`);
  const checks = designChallenge.rubric.map(({ id, title }) => `${draft.checked.includes(id) ? "[x]" : "[ ]"} ${title}`);
  return [designChallenge.title, designChallenge.brief, "Assumptions", designChallenge.assumptions.join("\n"), "The requirement changes", designChallenge.change, ...answers, "My self-review (not a grade)", checks.join("\n")].join("\n\n");
}
