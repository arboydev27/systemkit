import { chapters } from "./chapters";
import { lessonKey, type ReviewCard } from "../lib/review";

type Variation = { prompts: [string, string]; answer: string };

const variations: Record<string, Variation> = {
  "framework/framework-scope": {
    prompts: ["A team asks you to design a booking service. What do you clarify before drawing it?", "Why can two good engineers propose very different systems for the same vague request?"],
    answer: "Agree on users, their main actions, the first release, and what is outside scope. Different assumptions about those things lead to different architectures; make the assumptions explicit before choosing components.",
  },
  "framework/framework-requirements": {
    prompts: ["A service must accept uploads and show them within two seconds. Separate the feature from its quality requirement.", "Before choosing storage, how would you turn ‘make it fast and reliable’ into something you can design against?"],
    answer: "Accepting and displaying uploads is behavior. A two-second target is a measurable quality constraint. Clarify latency, availability, consistency, and workload expectations, and state assumptions wherever the answer is unknown.",
  },
  "framework/framework-estimates": {
    prompts: ["Two products each have one million accounts. Why might their infrastructure needs be very different?", "What would you ask before estimating capacity for a newly proposed video service?"],
    answer: "Registered accounts do not reveal workload. Ask about active users, actions per user, read/write mix, peaks, payload size, and retention. Carry units through rough calculations and use the result to guide a design decision.",
  },
  "framework/framework-blueprint": {
    prompts: ["What should a first architecture drawing make clear before you add caches and replicas?", "You have agreed on scope. What belongs in the smallest useful system blueprint?"],
    answer: "Show the clients, main service responsibilities, persistent storage, and the important request/data paths. Explain how the design supports the agreed behavior. Add more components when a requirement or bottleneck gives them a purpose.",
  },
  "framework/framework-flows": {
    prompts: ["Your diagram has all the expected boxes. How can you check that it actually supports a user action?", "Walk through a write and a later read. What questions expose gaps that a box diagram might hide?"],
    answer: "Trace a concrete request end to end: entry, validation, work, persistence, response, and later retrieval. State who owns the data, when success is acknowledged, and what happens if a step fails.",
  },
  "framework/framework-iterate": {
    prompts: ["A teammate proposes reusing an existing service. How should that change the design discussion?", "A reviewer challenges one of your assumptions. What is a productive next step?"],
    answer: "Clarify the feedback, compare options against requirements, and revise the design when the evidence supports it. Explain the tradeoff. Iteration makes the design stronger; defending the first drawing is not the goal.",
  },
  "framework/framework-deep-dive": {
    prompts: ["You have time to investigate only one part of a design. How do you choose it?", "Which deserves more detail: a familiar low-risk component or an uncertain path that could violate the main requirement?"],
    answer: "Deep dive into the highest risk, hardest constraint, or likely bottleneck. Explain the data model, algorithms, scaling, or failure behavior there. Distributing equal time across every box can leave the important risk unresolved.",
  },
  "framework/framework-review": {
    prompts: ["What should you leave a reader with when closing a system design?", "A design meets today’s requirements. What do you still summarize before calling the discussion finished?"],
    answer: "Recap the design, the key tradeoffs, known failure modes and bottlenecks, and useful next steps. Distinguish what is established from assumptions that still need validation.",
  },
  "scaling/single-server": {
    prompts: ["What happens between entering a domain and receiving a page from a small single-server app?", "If DNS resolves a domain successfully, does that mean the application response has already been produced? Explain."],
    answer: "DNS supplies an address. The browser sends HTTP to that address, and the server handles the request and returns a response such as HTML or JSON. DNS resolution is only one step; the server can still be slow or unavailable.",
  },
  "scaling/split-tiers": {
    prompts: ["The database needs more memory but the web process does not. What does separating the tiers let you do?", "Why is ‘we expect lots of users’ insufficient to choose a relational or non-relational database?"],
    answer: "Separate web and data so each can grow for its own workload. Choose storage from relationships, queries, access patterns, and latency requirements. A relational database is a useful starting point for related records and joins; user count alone does not choose a model.",
  },
  "scaling/scale-web": {
    prompts: ["One of three web servers fails. What must already be true for users to keep receiving responses?", "What does adding a load balancer solve, and what does it still leave you to arrange?"],
    answer: "The balancer must detect unhealthy servers and route to healthy ones with enough remaining capacity. Servers must be provisioned and registered separately. The balancer itself needs resilience; adding it does not automatically remove every single point of failure.",
  },
  "scaling/replication": {
    prompts: ["Writes saturate a primary database while replicas are idle. Why will adding another read replica not fix the write bottleneck?", "How can database replicas help availability while still putting a recent acknowledged write at risk?"],
    answer: "Replicas copy the primary’s changes and can serve reads or be promoted after failure. They do not distribute the primary’s writes. Asynchronous replication can lag, so a promoted replica may be missing recent writes; promotion requires a recovery plan.",
  },
  "scaling/cache": {
    prompts: ["A popular item changes price frequently. What cache decisions matter beyond simply storing it?", "A cache disappears during peak traffic. Why might an application that falls back to the database still fail?"],
    answer: "Choose expiry and invalidation around acceptable staleness, and retain important data in persistent storage. A cache outage shifts repeated reads to the database; fallback needs enough capacity and protection against the sudden surge.",
  },
  "scaling/cdn": {
    prompts: ["Images are fast for international users, but their account pages are slow. Why might a CDN not solve the remaining delay?", "What can be served from a nearby CDN edge, and what may still require a distant application round trip?"],
    answer: "A CDN serves reusable cached assets near users. Dynamic account requests may still travel to the application and database in another region. Measure which path is slow before changing placement or caching behavior.",
  },
  "scaling/stateless": {
    prompts: ["Replacing one web server logs some users out. Where might their unique state be living?", "How does moving sessions out of the web process help when a load balancer sends the next request to a different server?"],
    answer: "Unique sessions kept on one web server tie a user to that process. An appropriately durable shared session store lets any healthy server handle the next request. The store still needs its own availability and capacity plan.",
  },
  "scaling/multi-dc": {
    prompts: ["Traffic moves to a healthy backup region, but some profiles cannot load. What did routing alone fail to provide?", "What must be ready in a backup region before redirecting users there during an outage?"],
    answer: "The backup needs synchronized required data, working deployments, and enough capacity. Routing users to a healthy region does not create missing records or validate that the application works there. Test the complete failover path.",
  },
  "scaling/queue": {
    prompts: ["An image upload waits for expensive processing. How can a queue change the request path, and what changes for the user?", "The oldest queued job gets older every minute. What would you investigate before adding workers?"],
    answer: "Accept the upload and enqueue processing so the request can return with a pending state. Workers process asynchronously. Growing job age can mean arrival exceeds processing capacity or workers are failing; inspect the cause, then repair or scale workers. Plan retries and monitoring.",
  },
  "scaling/observability": {
    prompts: ["Users double, but latency and resource headroom stay healthy. What evidence would justify an architecture change?", "What would you measure before deciding that a slow application needs database sharding?"],
    answer: "Use latency, errors, saturation, workload shape, and growth forecasts to identify a real pressure. Inspect logs and metrics at the relevant tiers. User count alone does not prove that the database is the bottleneck or that sharding is the right remedy.",
  },
  "scaling/sharding": {
    prompts: ["Every shard stores the same number of users, but one is overloaded. How can that happen?", "How does sharding change data placement compared with replication, and what new difficulties follow?"],
    answer: "Sharding places different slices of data on different servers; replication creates copies. A balanced record count can still hide hot accounts or uneven traffic. Sharding adds routing, rebalancing, hotspot handling, and cross-shard query complexity.",
  },
  "scaling/synthesis": {
    prompts: ["A team wants to add replicas, sharding, a CDN, and queues all at once. How would you decide what to do first?", "When you introduce a scaling component, what should you verify before adding the next one?"],
    answer: "Identify the measured bottleneck or failure risk, choose a technique that addresses it, and test the effect. Check the new tradeoffs and operational needs. Each technique answers a different pressure; there is no universal component checklist.",
  },
};

export const reviewCards: ReviewCard[] = chapters.flatMap((chapter) => chapter.steps.map((step) => {
  const id = lessonKey(chapter.id, step.id);
  const variation = variations[id];
  const prompts = variation
    ? variation.prompts.map((prompt) => ({ prompt, answer: variation.answer }))
    : chapter.questions.filter((question) => question.stepId === step.id).map((question) => ({
      prompt: question.prompt,
      answer: `${question.options[question.correctIndex]} — ${question.explanation}`,
    }));
  return { id, chapterId: chapter.id, stepId: step.id, chapterTitle: chapter.title,
    lessonTitle: step.title, prompts };
}));
