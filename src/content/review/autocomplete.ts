import type { ReviewVariation } from "../../lib/review";

export const autocompleteReview: Record<string, ReviewVariation> = {
  "autocomplete/autocomplete-scope": {
    prompts: ["A hospital’s staff directory will suggest doctors’ names as people type. What should you decide before choosing any index?", "A flight-booking site’s city box already waits for typing pauses. Why can it still show the wrong suggestions, and what guards against that?"],
    answer: "Settle prefix or substring matching, result count, normalization, languages, region, personalization, and a high-percentile target from keystroke to visible list. Waiting for a pause only reduces traffic. Responses can still arrive out of order, so number each request and display only the latest one.",
  },
  "autocomplete/autocomplete-traffic": {
    prompts: ["A bookstore site knows its daily shoppers and searches per shopper. What else do you need to estimate suggestion traffic, and how is it calculated?", "A movie app sends suggestion responses of a few hundred bytes, a few thousand times a second at peak. What would you worry about most?"],
    answer: "Multiply active users, searches per user, and the requests each search sends once debounced, divide by 86,400, then apply a peak factor. One search produces several reads, and only the completed search is a ranking signal. Responses are small, so bandwidth stays modest; latency and hot prefixes are the constraints.",
  },
  "autocomplete/autocomplete-prefix": {
    prompts: ["A colleague says a trie makes a shop’s suggestions O(p) in the typed length, so catalog size cannot matter. What is missing?", "An internal tool suggests from 10,000 part names that rarely change. Would you build precomputed prefix lists? Explain your choice."],
    answer: "O(p) only covers reaching the prefix node; ranking the descendants below it is another cost, and it grows with the catalog. Stored top-K lists give fast reads at the price of memory and rebuild work. A small catalog can often use a normalized indexed range query instead.",
  },
  "autocomplete/autocomplete-rank": {
    prompts: ["A ski shop’s suggestions still lead with winter gear in July. What scoring change helps, and what setting controls how quickly old demand fades?", "A kids’ reading app hides unsuitable titles from its five suggestions at read time. Why not store exactly five per prefix? How many instead?"],
    answer: "Score by time-decayed counts so older searches shrink; the half-life sets the pace. Read-time filters can leave fewer than K, so store more ranked candidates than you show and take the first survivors. Longer lists cost storage, so size them by how many entries your filters really remove.",
  },
  "autocomplete/autocomplete-pipeline": {
    prompts: ["A shopping app’s nightly suggestion build comes out with half the usual prefixes. What should stop it reaching shoppers, and how would you recover?", "A sports site wants match-day terms suggested within minutes, but its suggestion lists rebuild nightly. What would you add, and what does it cost?"],
    answer: "Build lists away from serving and publish an immutable versioned snapshot; a bad build should fail its own checks, and nodes keep the prior version for rollback. For freshness, merge a small streaming delta with the snapshot at read time, accepting a second code path with its own failures.",
  },
  "autocomplete/autocomplete-serve": {
    prompts: ["A food-delivery app adds device type and app version to its suggestion cache key, and the hit rate falls. What rule should decide the key?", "A bank’s help center suggests public articles, while its account search suggests each customer’s own payees. How should caching differ between them?"],
    answer: "Include a dimension only when it changes the answer, such as prefix, locale, region, or snapshot version; every extra one fragments the cache and costs hit rate. Stable public lists can sit briefly in a browser or CDN; anything tied to an account belongs in a private cache or outside shared caches.",
  },
  "autocomplete/autocomplete-scale": {
    prompts: ["An address-lookup service’s whole suggestion index is 6 GB, and reads are outgrowing its servers. A colleague proposes sharding. What would you say?", "A people-search index splits names into ranges across machines, and a short prefix spans several. What does that cost, and how could you reduce it?"],
    answer: "Start with replicas of one full copy; shard only once the index outgrows a machine or replicas cannot keep up with reads. A spanning prefix needs fanout and a merge, so the slowest shard sets its latency. Precomputing short prefixes avoids that, as does keeping descendants together, which can concentrate load.",
  },
  "autocomplete/autocomplete-ops": {
    prompts: ["A library site handles an offensive suggestion by correcting the data for tonight’s build. Is that a complete response? Explain.", "A store’s suggestion service starts timing out during a sale. What should shoppers typing in the search box experience, and why?"],
    answer: "Correcting the next build leaves the phrase visible until then, while a serving filter alone lets it return with that build; do both and verify the new snapshot. If suggestions fail, a short client timeout shows no list and full search keeps working; a last-good snapshot also helps.",
  },
};
