import type { Question, Step } from './chapter';

export const autocompleteSteps: Step[] = [
  {
    id: 'autocomplete-scope', title: 'Define a useful suggestion', eyebrow: '01 · Product contract',
    summary: 'Decide what a prefix may match, who sees the result, and how quickly it must appear.',
    body: [
      'Autocomplete answers an incomplete input, not a completed search. Set the contract first: prefix-only or substring matches, result count, normalization, supported languages, regional differences, personalization, and empty-input behavior. A useful first version returns five popular completed searches that begin with the typed prefix. Spell correction is a separate feature.',
      'The client should debounce rapid keystrokes and ignore late responses for older inputs. Cancellation helps but can race with an already completed request. Define a high-percentile latency target from keystroke to visible suggestions, not just the server average. Very short prefixes can be disproportionately expensive because they cover large candidate sets.',
    ],
    takeaways: ['Specify matching, ranking, context, and latency before choosing an index.', 'Debouncing reduces traffic; stale-response handling preserves correctness.'],
    diagramId: 'autocomplete-scope', scenario: 'A user types “ca” and then “cat,” but the “ca” response arrives last. Which suggestions should remain visible?',
    scenarioAnswer: 'Only results for “cat.” Tag requests by input or sequence and discard stale responses even if cancellation was attempted.',
  },
  {
    id: 'autocomplete-traffic', title: 'Count requests, not just searches', eyebrow: '02 · Workload estimate',
    summary: 'One typing session can generate many reads, while completed searches become ranking signals.',
    body: [
      'Suppose two million active people make six searches a day and the client sends four suggestion requests per search after debouncing. That is 48 million suggestion reads a day, about 556 per second on average. A tenfold busy-hour multiplier suggests about 5,600 per second. These are illustrative assumptions; check real keystroke patterns, cache hits, and regional peaks before sizing.',
      'Do not count each prefix request as a completed search. A person typing “camera” may request “ca,” “cam,” and “came” before submitting “camera.” Completed searches, with consent and retention rules, can feed popularity counts. Keep the read-heavy serving path separate from collection and periodic index building.',
    ],
    takeaways: ['Estimate suggestion reads from typing behavior and peaks.', 'Intermediate prefixes and completed searches are different events.'],
    diagramId: 'autocomplete-traffic', scenario: 'An estimate says 12 million searches per day means 12 million autocomplete requests. What is missing?',
    scenarioAnswer: 'One search can generate several prefix requests. Measure requests per search after debouncing, then apply a peak factor.',
  },
  {
    id: 'autocomplete-prefix', title: 'Find candidates by prefix', eyebrow: '03 · Prefix index',
    summary: 'Narrow the candidate set before ranking it.',
    body: [
      'For a small catalog, a normalized indexed range query may suffice. A trie can follow one edge per character to reach a prefix node; a terminal marker distinguishes a complete submitted query from a mere prefix. Prefix lookup costs O(p) for input length p, but that says nothing about the cost of finding the best descendants.',
      'Scanning and sorting the entire subtree for every request is expensive for broad prefixes. Store a bounded top-K list at selected nodes, or materialize a prefix-to-top-K map. That trades memory and build work for fast reads. A compressed trie, sparse map, or database index may fit better depending on vocabulary size, update rate, and language. Capping input length bounds p only if enforced; it does not make arbitrary lookup inherently O(1).',
    ],
    takeaways: ['Prefix lookup and top-K selection have separate costs.', 'Precomputed top-K lists trade memory and rebuild work for low read latency.'],
    diagramId: 'autocomplete-prefix', scenario: 'The prefix “a” has a million descendants. Why can a basic trie still be slow?',
    scenarioAnswer: 'Finding the “a” node is cheap; scanning and ranking all descendants is not. Precompute candidates for broad prefixes or choose another ranked index.',
  },
  {
    id: 'autocomplete-rank', title: 'Rank the top few', eyebrow: '04 · Relevance policy',
    summary: 'Turn frequency counts into a stable ordering with explicit guardrails.',
    body: [
      'A baseline ranks normalized completed searches by count, then breaks ties deterministically. Lifetime popularity can be stale, so a time-decayed score can favor recent activity. A product catalog may also account for availability or quality. Decide whether rankings differ by region and locale before mixing their signals.',
      'Keep more internal candidates than displayed slots. If the visible list has five entries and policy blocks one, a cache with exactly five gives only four. Filter a larger ranked candidate set, then take five. Public popularity and personal search history are different products; personal suggestions need account-aware access and private caching.',
    ],
    takeaways: ['Define ranking signals, time window, context, and tie-breakers.', 'Filter before selecting the final K results.'],
    diagramId: 'autocomplete-rank', scenario: 'A blocked phrase is first in a cached top-five list. How can the service still show five safe results?',
    scenarioAnswer: 'Keep additional ranked candidates, apply policy filtering, and select five remaining entries. Correct the source data so the phrase stays excluded.',
  },
  {
    id: 'autocomplete-pipeline', title: 'Build from completed searches', eyebrow: '05 · Collection pipeline',
    summary: 'Aggregate events away from serving and publish a versioned read model.',
    body: [
      'After a completed search, a collector records a permitted normalized term, time, and coarse context. An append-only stream lets consumers aggregate counts by term and window. Because events may be retried, an idempotency key or durable checkpoint prevents double counting. Sampling can reduce cost but must be consistent, and it can distort rare-term estimates.',
      'Workers build ranked prefix lists from aggregates, validate them, and write an immutable snapshot. Serving nodes switch to a new version only after it is ready and retain the prior version for rollback. The build cadence follows freshness needs: a stable catalog may refresh daily; trending terms may need a small streaming delta merged with the baseline. Updating only one trie leaf leaves its ancestor top-K lists stale.',
    ],
    takeaways: ['Collection, aggregation, building, and serving have different latency and failure needs.', 'Versioned snapshots support consistent rollout; a delta buys freshness at added complexity.'],
    diagramId: 'autocomplete-pipeline', scenario: 'A newly popular query is in today’s events but suggestions use yesterday’s snapshot. Is serving broken?',
    scenarioAnswer: 'Not necessarily; it follows the freshness contract. If same-hour trends matter, shorten builds or add a bounded streaming delta and measure lag.',
  },
  {
    id: 'autocomplete-serve', title: 'Serve a predictable read path', eyebrow: '06 · Fast suggestions',
    summary: 'Keep lookup short while handling misses and regional context deliberately.',
    body: [
      'The client sends the current prefix to a query API. It validates length and context, reads a versioned prefix-to-candidates entry from memory or a shared cache, filters it, and returns a bounded list. On a miss, the service can read persistent snapshot storage and fill the cache. Warm broad prefixes or coalesce simultaneous misses to avoid a stampede. Replicated query nodes behind health-aware routing protect availability.',
      'A public cache key must include normalized prefix, locale, region, and snapshot version whenever each changes the answer. Browser or CDN caching can help stable public lists with an appropriate lifetime. Account-specific suggestions require private caching or no shared cache. Keep a last-good snapshot available when a build or cache tier fails.',
    ],
    takeaways: ['A versioned, context-aware key prevents mixing results.', 'Shared edge caches suit public stable lists; personal results require isolation.'],
    diagramId: 'autocomplete-serve', scenario: 'Two countries should see different top results for “football.” Why is a cache keyed only by prefix unsafe?',
    scenarioAnswer: 'It mixes rankings. Include region and locale, as well as snapshot version, and avoid shared caching of personalized results.',
  },
  {
    id: 'autocomplete-scale', title: 'Split hot and large indexes', eyebrow: '07 · Sharding and growth',
    summary: 'Partition by observed load and replicate hot slices.',
    body: [
      'A prefix range map can assign terms to serving shards. Equal alphabet ranges are often unbalanced: common initial letters and one-letter prefixes may be much hotter than rare ones. Measure bytes, request rate, and CPU per range, then split busy ranges or add read replicas. Version the routing map during movement.',
      'If a requested prefix spans shards, the query tier must fetch candidates from each relevant shard and merge their top-K results. Keeping all descendants together avoids this fanout but can concentrate storage and traffic; replicas spread reads without splitting the range. A merged response should not combine incompatible ranking versions. Choose partition boundaries from measured demand and failure goals.',
    ],
    takeaways: ['Partition boundaries should reflect measured load, not equal letter counts.', 'Cross-shard prefixes need fanout and merge; replicas address read heat.'],
    diagramId: 'autocomplete-scale', scenario: 'The “s” shard is saturated while “x” is quiet. Name two remedies.',
    scenarioAnswer: 'Replicate the hot “s” slice to spread reads or split its range and merge candidates for affected prefixes. Measure storage and fanout tradeoffs.',
  },
  {
    id: 'autocomplete-ops', title: 'Keep suggestions trustworthy', eyebrow: '08 · Privacy and operations',
    summary: 'Treat bad suggestions, private data, and stale builds as operational failures.',
    body: [
      'Raw searches can reveal personal information. Minimize collection, limit retention and access, and remove sensitive or abusive terms before public ranking. A fast denylist can suppress an unsafe suggestion now, while aggregate and future snapshot correction prevents its return. Resist manipulation with rate limits, abuse signals, and anomaly review; popularity is not proof of legitimacy.',
      'Monitor keystroke latency, API p95/p99, empty-result rate, cache hit rate, shard skew, build age, stream lag, and policy-block hits. Trace snapshot version from aggregate to response. Test stale-snapshot fallback, shard failure, cache stampede, and rollback. If suggestions fail, full search submission should still work.',
    ],
    takeaways: ['Immediate filtering and source cleanup solve different parts of removal.', 'A last-good snapshot and graceful empty list protect the primary search flow.'],
    diagramId: 'autocomplete-ops', scenario: 'An abusive phrase is filtered now but reappears after the nightly build. What was missed?',
    scenarioAnswer: 'The source aggregate or build policy still admitted it. Keep immediate suppression and exclude it from future snapshots.',
  },
];

export const autocompleteQuestions: Question[] = [
  { id:'acq01', stepId:'autocomplete-scope', difficulty:'Recall', prompt:'What must be settled before choosing a prefix index?', options:['Only server language','Matching, normalization, ranking, context, and latency','Only typography','Only database vendor'], correctIndex:1, explanation:'Product rules determine what the index must represent and serve.' },
  { id:'acq02', stepId:'autocomplete-scope', difficulty:'Diagnose', prompt:'An older request finishes after a newer one and replaces current suggestions. What should the client do?', options:['Submit automatically','Disable caching','Ignore results whose input or sequence is stale','Increase result count'], correctIndex:2, explanation:'Response order is not typing order; only the latest input should update the list.' },
  { id:'acq03', stepId:'autocomplete-scope', difficulty:'Apply', prompt:'Why measure keystroke-to-display latency at a high percentile?', options:['It exposes slow experiences hidden by an average','It removes availability checks','It counts stored terms','It guarantees relevance'], correctIndex:0, explanation:'A mean can hide delayed suggestions during hot periods or cache misses.' },
  { id:'acq04', stepId:'autocomplete-traffic', difficulty:'Apply', prompt:'Two million users make six searches daily, each causing four suggestion reads. How many reads per day?', options:['12 million','24 million','48 million','96 million'], correctIndex:2, explanation:'2,000,000 × 6 × 4 = 48,000,000 suggestion reads.' },
  { id:'acq05', stepId:'autocomplete-traffic', difficulty:'Diagnose', prompt:'Why should “ca,” “cam,” and “camera” requests not each count as a completed search?', options:['They are partial inputs, not three submitted queries','A trie cannot store them','They have no network cost','They are uppercase'], correctIndex:0, explanation:'Suggestion reads and completed-search ranking events serve different purposes.' },
  { id:'acq06', stepId:'autocomplete-traffic', difficulty:'Recall', prompt:'What changes an average QPS estimate into a capacity estimate?', options:['Font size','A peak factor and traffic shape','Diagram count','Label length'], correctIndex:1, explanation:'Busy-hour and regional peaks can be much higher than the daily mean.' },
  { id:'acq07', stepId:'autocomplete-prefix', difficulty:'Recall', prompt:'What does following a trie path for p characters cost in the basic model?', options:['O(p) for prefix lookup','O(1) for all input','O(n²) for every node','Zero after a miss'], correctIndex:0, explanation:'One edge is followed per character; top-K work is separate.' },
  { id:'acq08', stepId:'autocomplete-prefix', difficulty:'Diagnose', prompt:'A trie finds “a” quickly but serving it remains slow. Why?', options:['“a” is not a prefix','The subtree scan and ranking are large','DNS changed the alphabet','A terminal marker is missing'], correctIndex:1, explanation:'Locating the prefix node does not precompute its best descendants.' },
  { id:'acq09', stepId:'autocomplete-prefix', difficulty:'Apply', prompt:'What is the main cost of caching top-K suggestions at many prefix nodes?', options:['Every request becomes a write','More memory and rebuild work','All results become personal','No prefix can be deleted'], correctIndex:1, explanation:'Materialized lists duplicate candidate information across prefixes.' },
  { id:'acq10', stepId:'autocomplete-rank', difficulty:'Apply', prompt:'A public list has five slots and may filter blocked entries. How many candidates should it retain internally?', options:['One','Exactly five','Enough beyond five to fill after filtering','Every raw event'], correctIndex:2, explanation:'Extra ranked candidates keep the list full after removals.' },
  { id:'acq11', stepId:'autocomplete-rank', difficulty:'Diagnose', prompt:'A sudden event matters, but lifetime frequency is slow to reflect it. What helps?', options:['A recent-time weighted score or delta','Longer browser TTL','More identical snapshots','Alphabetical sorting alone'], correctIndex:0, explanation:'Time weighting or a fresh overlay makes emerging demand visible.' },
  { id:'acq12', stepId:'autocomplete-rank', difficulty:'Recall', prompt:'Why use a deterministic tie-breaker?', options:['Prevent every miss','Make equal scores order consistently','Skip policy filtering','Publish private history'], correctIndex:1, explanation:'Stable order avoids arbitrary changes for equal scores.' },
  { id:'acq13', stepId:'autocomplete-pipeline', difficulty:'Diagnose', prompt:'A collector retries the same completed-search event. What prevents double counting?', options:['A larger prefix','An idempotency key or durable checkpoint','Browser animation','Sorting after each request'], correctIndex:1, explanation:'Retried delivery requires deduplication or idempotent aggregation.' },
  { id:'acq14', stepId:'autocomplete-pipeline', difficulty:'Apply', prompt:'What is a safe way to deploy a rebuilt prefix index?', options:['Replace half the nodes during reads','Publish a validated version and switch serving nodes','Delete the prior version first','Force users to retype'], correctIndex:1, explanation:'Versioned snapshots support consistent reads and rollback.' },
  { id:'acq15', stepId:'autocomplete-pipeline', difficulty:'Diagnose', prompt:'Why does updating only one trie leaf fail to refresh top suggestions?', options:['Browsers forbid leaf updates','Ancestor prefix lists may still be stale','Leaves cannot contain words','Events are never stored'], correctIndex:1, explanation:'Each affected ancestor or overlay must reflect the new score.' },
  { id:'acq16', stepId:'autocomplete-serve', difficulty:'Recall', prompt:'Which factors belong in a public cache key when each changes ranking?', options:['Prefix, locale, region, snapshot version','Only prefix','Only user-agent','Only cache IP'], correctIndex:0, explanation:'The key must distinguish each context with a different public result.' },
  { id:'acq17', stepId:'autocomplete-serve', difficulty:'Diagnose', prompt:'A cold popular prefix causes many simultaneous snapshot reads. What helps?', options:['Delete all caches','Coalesce requests or warm broad prefixes','Retain more raw logs','Return every match'], correctIndex:1, explanation:'Coalescing and warming prevent a miss stampede.' },
  { id:'acq18', stepId:'autocomplete-serve', difficulty:'Apply', prompt:'Which result suits a shared CDN cache?', options:['Private search history','A public versioned locale-specific ranking','Sensitive unfiltered output','A one-time token'], correctIndex:1, explanation:'Public stable lists can be keyed and timed for shared caching.' },
  { id:'acq19', stepId:'autocomplete-scale', difficulty:'Diagnose', prompt:'Why can equal letter ranges overload one shard?', options:['All letters have identical demand','Prefix and storage distributions are uneven','A trie cannot contain “s”','Replicas remove all reads'], correctIndex:1, explanation:'Hot letters and short prefixes concentrate demand.' },
  { id:'acq20', stepId:'autocomplete-scale', difficulty:'Apply', prompt:'If one requested prefix spans multiple shards, what must the query tier do?', options:['Ask relevant shards and merge ranked candidates','Return only the first shard','Write to all shards','Remove prefix limits'], correctIndex:0, explanation:'No one shard has the complete candidate set.' },
  { id:'acq21', stepId:'autocomplete-scale', difficulty:'Recall', prompt:'What primarily spreads reads for one hot but unsplit slice?', options:['Read replicas','More raw-event retention','Longer strings','Removing filters'], correctIndex:0, explanation:'Replicas share read demand without changing the key range.' },
  { id:'acq22', stepId:'autocomplete-ops', difficulty:'Apply', prompt:'An unsafe public suggestion needs immediate removal. What is the full response?', options:['Hide it in CSS','Suppress it now and exclude it from future builds','Wait for next build','Delete all search records'], correctIndex:1, explanation:'Fast filtering handles current responses; source cleanup prevents reappearance.' },
  { id:'acq23', stepId:'autocomplete-ops', difficulty:'Diagnose', prompt:'A new snapshot causes empty suggestions in one region. What helps?', options:['Block full search','Roll back to a last-good version and inspect rollout signals','Double visible K','Disable all logs'], correctIndex:1, explanation:'Versioned snapshots and monitoring support a known-good fallback.' },
  { id:'acq24', stepId:'autocomplete-ops', difficulty:'Recall', prompt:'Which metric best exposes stale trend data?', options:['Build age and event-to-suggestion lag','CSS selector count','Window width','Table name'], correctIndex:0, explanation:'Freshness depends on when activity affects visible results.' },
];
