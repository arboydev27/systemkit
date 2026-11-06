import type { ReviewVariation } from "../../lib/review";

export const consistentHashingReview: Record<string, ReviewVariation> = {
  "consistent-hashing/hash-scope": {
    prompts: ["Before choosing a hash scheme for a durable document archive, what should the team require of its placement rule?", "You must report whether a music catalog is balanced across storage nodes. Why is one number not enough, and which would you track?"],
    answer: "State balanced load, lookup without a central call, little movement on membership change, and a node list clients agree on. Moving durable data means a bulk copy, not a cache miss. Track key count, bytes, and request rate separately, since each can be even while another is skewed.",
  },
  "consistent-hashing/hash-modulo": {
    prompts: ["A colleague says removing one of five modulo-routed recommendation caches disturbs only that server’s keys. What actually happens?", "An overnight analytics job picks a worker count at startup and routes rows by hash modulo that count. Should the team worry? Why?"],
    answer: "The divisor changes for every key, so most keys get a new index even if their server is healthy. A cache then sends a wave of misses to its backing store. Modulo is still fine when membership stays fixed or a cold start is cheap.",
  },
  "consistent-hashing/hash-ring": {
    prompts: ["A game’s routing tier holds 4,000 ring positions. How does one request find its backend, and why is scanning every position unnecessary?", "Half of a ticketing site’s proxies upgrade to a different hash library on a ring-routed pool. What breaks, and what must all participants share?"],
    answer: "Hash the key onto the same fixed space as the node tokens and take the first token clockwise, wrapping past the end. Binary search over a sorted token list makes this cheap. Every participant must share one hash function and membership version, or the same key reaches different owners.",
  },
  "consistent-hashing/hash-membership": {
    prompts: ["A wiki’s durable page store on a ring retires one node for good. Which pages change owner, and what order of steps keeps them readable?", "A news site’s page cache adds a ring node that starts empty, with no copying. Why would that be unsafe for a durable store?"],
    answer: "Only the affected token’s interval changes owner: a leaving token’s range goes to its successor, and other ranges stay put. Durable data must be copied and concurrent writes caught up before ownership switches, or reads find it missing. A cache can accept misses and refill instead.",
  },
  "consistent-hashing/hash-vnodes": {
    prompts: ["A 12-machine photo store uses one token per machine. What happens to a dead machine’s range, and how would many tokens change that?", "Why not give every machine in a search index cluster thousands of tokens to get near-perfect balance?"],
    answer: "One token leaves uneven arcs and sends a dead machine’s whole range to one successor; many tokens spread ownership and that load across survivors. But imbalance falls only with the square root of tokens, while metadata and repair work keep growing, and two failures are likelier to hit two copies.",
  },
  "consistent-hashing/hash-replicas": {
    prompts: ["A medical-records store keeps copies on the next three ring tokens. An audit finds some records on just two machines. How, and what fixes it?", "A talent show’s vote tally key overwhelms its node with writes despite added tokens. How would you relieve it, and at what cost?"],
    answer: "Neighboring tokens can belong to one machine, so the walk must skip machines already chosen and prefer separate failure domains. Tokens also cannot divide one hot key: split its writes across suffixed keys and sum on read, which makes reads costlier.",
  },
  "consistent-hashing/hash-operate": {
    prompts: ["During a node join, a shopper’s newly added cart item sometimes vanishes, then returns later. How might routing explain it, and what guards against it?", "An email archive moves 900 GB capped at 50 MB/s to protect live traffic. How long does that take, and what should you plan for?"],
    answer: "Clients on different map versions can write to the new owner and read from the old one, so use a versioned map and let nodes refuse ranges they no longer own. At 50 MB/s, 900 GB takes about 5 hours, so plan for a second failure in that window.",
  },
};
