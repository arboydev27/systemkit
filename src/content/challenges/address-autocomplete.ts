import type { DesignChallengeContent } from "../design-challenge";

export const addressAutocompleteChallenge: DesignChallengeContent = {
  id: "address-autocomplete",
  chapterId: "autocomplete",
  stepId: "autocomplete-ops",
  minutes: 30,
  adaptationTitle: "Addresses reported by couriers",
  title: "Design address autocomplete for a delivery app",
  summary: "Apply prefix search to addresses and places, where location matters more than popularity and typos are routine.",
  brief: "Customers type a delivery address or a place name into a delivery app and pick from a short list. Suggestions must favor results near the user, stay within the correct country's data, and tolerate common typos. Choosing a suggestion must resolve to one stable place ID with coordinates, because a wrong pin means a failed delivery. Keep routing, pricing, and courier dispatch outside this exercise.",
  assumptions: [
    "10 million people use the app each day. Each runs 1.5 address or place searches a day, and each search sends 6 suggestion requests after debouncing. Use decimal units and 86,400 seconds per day.",
    "Peak traffic is 5 times the daily average. The app serves 4 regions, and the busiest carries 40% of traffic and 40% of the catalog. Assume its peak lines up with the global peak.",
    "The catalog holds 400 million addresses and 50 million places at about 200 bytes each, refreshed monthly from data vendors. Search structures take 3 times the raw size. A serving node has 64 GB of usable memory.",
    "About 10% of requests contain a typo and need fuzzy matching, which costs 5 times an exact prefix lookup. A node handles 2,000 exact lookups per second.",
    "Aim for p95 under 100 ms on the server. Text typed into the box can identify where someone lives, so treat it as personal data: do not put it in shared caches keyed to a person or in public ranking.",
  ],
  change: "Couriers can now report addresses the vendors do not have yet, such as a newly opened apartment tower or a corrected entrance. A verified report must be searchable in its region within 10 minutes, including with typos. Your monthly build alone no longer meets this. What changes, and what new failure can it introduce?",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope. Estimate average and peak request rates, the busiest region's peak, the extra CPU from fuzzy matching, and the index size and shard count for the busiest region. Keep units visible.",
      placeholder: "I would support…\nRequests per second = …\nBusiest region at peak = …\nFuzzy cost = …\nIndex size and shards = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores. Trace one suggestion request, one mistyped request, and the moment a person picks a result. Explain how location affects both ranking and any cache key.",
      placeholder: "Suggestion: client → …\nTypo: …\nPick: place ID → …\nCache key = …",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Choose a likely bottleneck and the evidence that would justify scaling it. Explain what users see if a region's serving tier or a new data build fails, and how they can still finish an order.",
      placeholder: "I would monitor…\nIf a build is bad…\nIf the region's index is down…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the courier-report change below. Decide where new entries live until the next full build, how typo matching reaches them, and what stops a bad report from misdirecting deliveries.",
      placeholder: "New reports go to…\nA query reads…\nThe risk is…\nI would guard against it by…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I show units, separate average from peak, size the busiest region on its own, and use the fuzzy cost to justify a matching strategy." },
    { id: "ranking", title: "Location shapes the results.", detail: "I explain how regional data and distance affect ranking, and I use a coarse location in cache keys instead of exact coordinates." },
    { id: "typos", title: "Typo tolerance has a stated cost.", detail: "I say when fuzzy matching runs and what it costs, and I avoid paying that cost on every request without a reason." },
    { id: "fallback", title: "Failure does not block an order.", detail: "I describe a last-good index and a way to finish without suggestions, such as typing an address and confirming a pin." },
    { id: "fresh", title: "The courier change has a tradeoff.", detail: "I explain where fresh entries live, how they merge with the build, and how an unverified or wrong report is kept away from customers." },
  ],
  estimateGuide: "10 million people × 1.5 searches × 6 requests = 90 million requests/day, about 1,040/s on average and 5,200/s at peak. The busiest region takes 40%, about 2,080/s at peak. With 10% fuzzy at 5 times the cost, an average request costs 0.9 + 0.5 = 1.4 exact lookups, so the region needs about 2,900 lookups/s, or about 1.5 nodes of CPU at 2,000/s. Running fuzzy matching on every request would need about 10,400 lookups/s, or 5.2 nodes. The catalog is 450 million × 200 bytes = 90 GB raw and 270 GB indexed. The busiest region holds 36 GB raw and 108 GB indexed; 108 ÷ 64 is about 1.7, so 2 shards. Two shards with 2 replicas each is 4 nodes: an evenly split shard sees about 1,460 lookups/s at peak, so a surviving replica runs at about 73%. Headroom, the other three regions, and build capacity add to these budgets.",
  solutions: [
    {
      id: "search-engine",
      title: "A regional search-engine cluster",
      approach: "Run a search engine such as Elasticsearch or OpenSearch in each region, with one index per country. Index word-start prefixes so a query can match any word in an address, boost results by distance from a coarse location, and turn on fuzzy matching with an edit distance of 1 or 2. Load vendor data monthly into a new index and swap an alias once it passes checks. Pick resolution reads a separate place-ID store.",
      paths: [
        "Suggestion: the client sends the text, country, and a coarse location cell to a regional API. It runs an exact prefix query first and returns the top five by text match and distance.",
        "Typo: if the exact query returns fewer than three results, the API reruns it with fuzzy matching. This confines the 5 times cost to requests that need it, at the price of a second query.",
        "Pick: the client sends the chosen place ID, and the API returns full address details and coordinates from the place store. The order stores that ID and the coordinates, not the displayed text.",
      ],
      failure: "Replicas absorb a node loss, and the alias can point back to the prior index if a monthly load is bad. If the region's cluster is down, the client shows no list and lets the person type a full address and confirm a map pin, so ordering continues with more friction. Watch p95 by query type, because fuzzy queries and broad short prefixes set the tail.",
      adaptation: "Write verified reports directly into the live index through its normal update path, which typically makes them searchable within seconds and easily meets 10 minutes. Fuzzy matching applies with no extra work. Keep reports in a review queue until verified, tag them by source so a bad batch can be removed, and include them when building the next monthly index so they are not lost in the swap.",
      tradeoff: "This is the quicker design to build and adapts easily to new match types. It uses more memory than a purpose-built index, requires operating a stateful cluster, and fuzzy query latency is harder to keep predictable under load.",
    },
    {
      id: "snapshot-index",
      title: "A compact snapshot index on stateless nodes",
      approach: "Build an immutable index per region offline: a compact prefix structure with top candidates per geographic cell, plus a table of pre-computed delete variants for fuzzy lookup (the SymSpell technique). Publish versioned snapshots to object storage. Stateless serving nodes load a snapshot into memory, validate it, and switch. Candidates are kept per coarse cell, so distance ranking is mostly done before the request arrives.",
      paths: [
        "Suggestion: the API reads the prefix under the user's cell in memory, re-sorts a bounded candidate list by exact distance, and returns five. A short-lived cache can hold popular prefix and cell pairs, because neither identifies a person.",
        "Typo: on a thin result, the API looks up delete variants of the input to find near matches, then ranks them the same way. A bounded candidate list keeps the cost predictable.",
        "Pick: the snapshot holds a place ID for each entry. The client sends it to a place service, and the order stores the ID and coordinates.",
      ],
      failure: "Each node keeps the last-good snapshot, and a build that fails validation is never published. A node failure only reduces capacity, since any replica can load a snapshot and rejoin. If serving is down, the client falls back to a typed address and a map pin. Watch build age and the share of requests landing on thin results.",
      adaptation: "Add a small in-memory overlay per region, fed by a stream of verified reports. Each query reads the snapshot and the overlay and merges candidates, and a matching overlay entry can correct or replace a snapshot entry. Delete variants are computed when a report is added, so typo matching reaches it. Nodes replay the overlay after a restart, and the next build absorbs and clears it. The new risk is a second code path: a bad overlay entry bypasses build validation, so reports need their own checks and a kill switch.",
      tradeoff: "Latency is predictable and serving is simple to scale, with no stateful cluster in the read path. It needs custom build and matching code, a change in matching rules means a full rebuild, and freshness requires the overlay.",
    },
  ],
};
