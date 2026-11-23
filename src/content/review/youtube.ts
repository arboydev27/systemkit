import type { ReviewVariation } from "../../lib/review";

export const youtubeReview: Record<string, ReviewVariation> = {
  "youtube/youtube-scope": {
    prompts: ["A yoga app will host instructors’ class videos. Which activity drives each of its major costs, and how would you estimate them separately?", "A small museum wants to put a few hundred gallery talks online. Should it build its own video pipeline? Explain."],
    answer: "Watching mostly costs egress, encoding costs compute, and uploads cost storage, so estimate each from behavior: active people, video sizes, renditions, retention, and peaks, stated as assumptions to validate. A small library can buy the pipeline from a managed service and put its effort elsewhere.",
  },
  "youtube/youtube-upload": {
    prompts: ["A genomics lab’s API servers slow down whenever researchers upload huge data files through them. What would you change, and what must the API still do?", "A support form lets customers attach a 3 MB screenshot. Would you add resumable uploads? What do they buy and cost?"],
    answer: "The API should only authenticate, check quota, create a pending record, and hand out a short-lived, single-object permission, so bytes go straight to object storage. Resumable parts avoid resending everything on bad networks but add client code, session state, and abandoned-part cleanup; a small file suits one plain PUT.",
  },
  "youtube/youtube-pipeline": {
    prompts: ["A podcast service normalizes audio, transcribes it, builds chapters from the transcript, and generates artwork. How would you decide what runs in parallel?", "A batch report generator runs on workers that can vanish mid-task. What keeps that survivable without lost or damaged output, and when should retrying stop?"],
    answer: "Model the work as a DAG so only independent tasks run in parallel. Keep task state durable, use leases that expire when a worker dies, and make outputs idempotent, since a task can run twice. Cap retries, park repeated failures on a dead-letter path, and treat malformed input as terminal.",
  },
  "youtube/youtube-renditions": {
    prompts: ["An online course site is choosing a segment length for its lesson videos. What goes wrong if segments are very short or very long?", "A cooking-video app plans twelve quality levels, all encoded only in the newest codec. What would you question?"],
    answer: "Each extra rendition fits more devices and networks but adds compute and storage, so limit the ladder to what you support. Newer codecs save bits but encode slowly and lack universal hardware decoding, so keep a fallback. Very short segments mean more requests; long ones slow adaptation and can waste bytes.",
  },
  "youtube/youtube-metadata": {
    prompts: ["An audiobook service receives storage events twice and out of order. How do you keep each title’s publish status correct?", "A game studio finds patches stuck in processing and stored files that no record points to. What background mechanism catches this, and why can it happen?"],
    answer: "Storage and database changes share no atomic transaction, so use a status with allowed transitions and a conditional update, making repeated events harmless. Mark ready only after verifying outputs. A reconciliation job checks the database against what storage holds to find stuck jobs and orphans. The cost is more states to explain.",
  },
  "youtube/youtube-playback": {
    prompts: ["A paid concert-film site checks a viewer’s ticket before playback. How do you keep outsiders away without calling the API for every segment?", "A news-clip app starts every viewer at low quality, even on fast connections. Why might that be sensible, and what risk comes with stepping up?"],
    answer: "The API authorizes playback and issues signed URLs or cookies, so the CDN can serve segments without a call each time; origin still needs controls. The player picks each next segment from bandwidth and buffer health. A low start may speed the first frame, and stepping up too early risks rebuffering.",
  },
  "youtube/youtube-cost": {
    prompts: ["A sports-highlights app is deciding whether to spend extra compute on slower encoding for every clip. How would you decide which clips deserve it?", "A conference-talk library saves money by keeping rarely watched talks at origin with few prepared renditions. What risk does that add, and what should it plan?"],
    answer: "Encoding is paid once, but a lower bitrate saves egress on every view, so slower encoding suits popular titles and may not pay back at low view counts. Cold titles at origin or with fewer renditions save money but start more slowly, and one can go viral, so set a demand-based promotion path.",
  },
  "youtube/youtube-operations": {
    prompts: ["A gardening-video site wants one green or red health light for the whole service. Why might it mislead, and what would you track instead?", "A school asks a video platform to pull a clip showing a student, today. Which layers must change, and what limits someone already watching?"],
    answer: "One signal hides path-specific faults: a stalled queue delays new videos while old ones play, so track creator metrics like queue lag apart from viewer metrics like rebuffering. Removal means changing the status so the watch API refuses, purging the CDN, and blocking at origin; short-lived signed URLs cap a current viewer’s access.",
  },
};
