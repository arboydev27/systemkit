import type { ReviewVariation } from "../../lib/review";

export const scalingReview: Record<string, ReviewVariation> = {
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
