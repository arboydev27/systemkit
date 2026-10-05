import type { Question, Step } from './chapter';

export const crawlerSteps: Step[] = [
  {
    id: 'crawler-scope', title: 'Define the crawl', eyebrow: '01 · Scope and budget',
    summary: 'Choose the purpose, coverage, freshness, and content types before drawing the pipeline.',
    body: [
      'A crawler discovers pages by fetching seed URLs, extracting links, and scheduling useful new URLs. For a search index, the output is a stream of documents and metadata for indexing; an archive may retain the fetched bytes instead. Decide which domains and content types are in scope, how many pages to fetch, how long to retain them, and how quickly changes should appear.',
      'Capacity starts with attempts, not just stored pages. As an illustration, one billion fetches per month is roughly 386 fetches per second on average over 30 days. Peak load, retries, redirects, page size, and recrawls increase the real budget. A crawler must also be polite and robust: the public web contains slow hosts, malformed responses, loops, and changing rules.',
    ],
    takeaways: ['A crawl objective determines what to fetch, keep, and hand to consumers.', 'Estimate peak fetches, bytes, retries, and recrawls separately.'],
    diagramId: 'crawler-scope', scenario: 'A team asks for “a web crawler” but has not decided whether it is an archive or a search index. What do you ask first?',
    scenarioAnswer: 'Clarify coverage, content types, retention, freshness, and the output consumer. An archive needs retained versions; a search index needs parsed documents and links.',
  },
  {
    id: 'crawler-pipeline', title: 'Trace one page through the system', eyebrow: '02 · Discovery loop',
    summary: 'Turn a seed URL into a document, then feed discovered links back into the frontier.',
    body: [
      'Seed URLs enter a durable frontier. A worker leases an eligible URL, checks crawl policy, resolves the host, fetches the response with bounds, and records the outcome. A parser validates the response, extracts document information and links, and hands accepted content to storage or an index pipeline. Links that pass filtering and deduplication return to the frontier.',
      'Keep each stage observable and independently recoverable. A worker crash after fetching should not silently lose a URL; a lease can expire and make it eligible again. That means downstream writes and link insertion need idempotent keys or deduplication. A successfully fetched page can still fail parsing, and a parsed page can still be excluded from indexing.',
    ],
    takeaways: ['The frontier closes the discovery loop; parsing and storage are distinct stages.', 'Leases and idempotent processing make worker failure recoverable.'],
    diagramId: 'crawler-pipeline', scenario: 'A worker crashes after downloading a page but before acknowledging its frontier item. What should happen?',
    scenarioAnswer: 'The lease expires and the URL becomes eligible again. Reprocessing is safe when document storage and discovered-link insertion are idempotent.',
  },
  {
    id: 'crawler-policy', title: 'Respect each host', eyebrow: '03 · Robots and politeness',
    summary: 'Check crawl preferences and schedule requests at a rate each host can tolerate.',
    body: [
      'Before fetching a path, check the applicable robots.txt rules for the crawler identity. Cache the rules with a refresh policy and define behavior when they cannot be fetched. Robots rules express a site’s crawl preferences; they are not a security boundary or permission to access otherwise restricted data. Site terms and applicable law may add constraints beyond robots.txt.',
      'A global concurrency limit cannot protect a small host from a flood. Track per-host or per-site next-eligible times and active requests, then let the frontier schedule only eligible work. Slow responses, 429, 503, and Retry-After can lower that host’s rate. Keep unrelated hosts moving while one is delayed. Define host grouping carefully for subdomains and shared infrastructure.',
    ],
    takeaways: ['Check robots rules before a fetch and refresh cached rules deliberately.', 'Politeness needs per-host scheduling, not only a global worker limit.'],
    diagramId: 'crawler-policy', scenario: 'A crawler has 500 workers. Most queued URLs belong to one small site. Why is a global limit of 500 unsafe?',
    scenarioAnswer: 'All 500 workers could hit the same site. Limit concurrent and timed requests for that host while scheduling other hosts independently.',
  },
  {
    id: 'crawler-frontier', title: 'Schedule useful URLs', eyebrow: '04 · Durable URL frontier',
    summary: 'Combine priority, fairness, and host eligibility instead of using one naive FIFO queue.',
    body: [
      'A breadth-first queue discovers a wide graph, but a page can contain thousands of links to its own host. One FIFO queue can flood that host and bury important or recently changed pages. Give URLs priorities based on the product goal and keep per-host queues or an equivalent host-aware scheduler. A selector picks a valuable URL whose host is eligible, with enough fairness that low-priority hosts are not starved indefinitely.',
      'At scale, the frontier must survive restarts. Store durable queued and leased state, with small memory buffers for hot operations. Record why a URL is waiting, when it may run, its retry count, and its next recrawl time. A Bloom filter can reject many already-seen URLs cheaply, but false positives mean it should not be the sole authoritative test when losing a valid page matters.',
    ],
    takeaways: ['Priority answers which URLs matter; host eligibility answers when they may be fetched.', 'Durable queue state and lease recovery prevent lost work.'],
    diagramId: 'crawler-frontier', scenario: 'A popular page links to 10,000 URLs on one host. How should the frontier avoid flooding it?',
    scenarioAnswer: 'Keep those URLs in that host’s queue, select only when its delay and concurrency rules permit, and use other eligible host queues meanwhile.',
  },
  {
    id: 'crawler-dedup', title: 'Remove repeated work carefully', eyebrow: '05 · URL and content identity',
    summary: 'Normalize URL identity, then compare content separately after fetching.',
    body: [
      'Resolve relative links against their source URL and normalize safe equivalents before enqueueing. Lowercase scheme and host, remove default ports and fragments, and apply a deliberate policy for query parameters and trailing slashes. Avoid aggressive rewriting: path case, parameter order, and even apparently tracking-like parameters can change a resource. Redirect targets and declared canonical URLs are useful signals, but do not erase the fetched URL’s history.',
      'The URL-seen set prevents repeatedly queueing the same normalized URL. Content hashes detect byte-identical pages reached through different URLs. A strong hash match is a cheap duplicate signal, while a near-duplicate method is needed for pages that differ only in boilerplate or timestamps. Store URL-to-content relationships because duplicate content may still have distinct links, provenance, or future changes.',
    ],
    takeaways: ['URL deduplication happens before fetching; content deduplication happens after.', 'Canonicalization is a product policy, not a license to merge every similar URL.'],
    diagramId: 'crawler-dedup', scenario: 'Two URLs show identical HTML today. Should their URLs be discarded from crawl history?',
    scenarioAnswer: 'No. Reuse or deduplicate stored content if appropriate, but retain each URL and its fetch history because links, ownership, or content can diverge later.',
  },
  {
    id: 'crawler-fetch', title: 'Fetch imperfect pages safely', eyebrow: '06 · Downloader and parser',
    summary: 'Bound network and parsing work, and classify outcomes before following links.',
    body: [
      'Use DNS and HTTP clients with timeouts, redirect limits, response-size caps, accepted content types, and bounded decompression. Validate destinations after every redirect and DNS resolution so a discovered public URL cannot redirect workers into private or local network addresses. Set a clear crawler identity, track response status, and close sockets and streams on failure. Concurrency helps throughput, but each worker has finite memory, bandwidth, and file descriptors.',
      'Parse HTML with a tolerant parser, not a regular expression. Resolve relative links using the final document URL and any valid base URL, filter unsupported schemes, and keep metadata such as status, content type, fetch time, and canonical hints. JavaScript-rendered pages require a separate, more expensive rendering path if they are in scope. Do not render every page by default.',
    ],
    takeaways: ['Bound redirects, time, bytes, decompression, and destinations.', 'HTML parsing and browser rendering have different costs and coverage.'],
    diagramId: 'crawler-fetch', scenario: 'A fetched public URL redirects to a private IP address. What should the downloader do?',
    scenarioAnswer: 'Reject that destination before connecting and record the reason. Validate each redirect and resolved address, not just the seed URL.',
  },
  {
    id: 'crawler-freshness', title: 'Revisit without looping', eyebrow: '07 · Retries and change detection',
    summary: 'Schedule recrawls by observed value and change rate while controlling traps.',
    body: [
      'A crawl is never truly finished if pages can change. Record fetch history, content hash, response validators, and last change time. Schedule frequently changing or important pages sooner and stable pages later. Conditional requests such as If-None-Match or If-Modified-Since can save bandwidth when a server supports them; a 304 means no new representation was sent, not that the URL disappears from the schedule.',
      'Retry transient failures with bounded exponential backoff and jitter, honoring Retry-After where relevant. Distinguish permanent errors, policy exclusions, and temporary failures. Cap retries, URL length, path depth, parameter variation, and per-site discovery when patterns suggest a spider trap. Human review or site-specific rules may be needed; a universal trap detector will also suppress legitimate pages.',
    ],
    takeaways: ['Freshness depends on change history and importance, not one global recrawl interval.', 'Bound retries and suspicious URL expansion while preserving reasons for exclusion.'],
    diagramId: 'crawler-freshness', scenario: 'A calendar generates a new URL for every future date. What protects the crawler?',
    scenarioAnswer: 'Detect the expansion pattern, cap per-site and per-pattern discovery, and review a targeted filter. A generic depth limit alone may miss or overblock pages.',
  },
  {
    id: 'crawler-scale', title: 'Partition and operate the crawl', eyebrow: '08 · Distributed operation',
    summary: 'Spread hosts across workers while keeping scheduling state and health visible.',
    body: [
      'Partition host queues across scheduler shards so one host’s rate policy has a clear owner. Multiple downloader workers can lease eligible URLs; rebalance shard ownership as capacity changes without allowing two owners to violate a host delay. A consistent-hash ring can reduce movement, but it does not solve hot hosts or stalled workers by itself. Replicate durable frontier state, checkpoint ownership transitions, and make storage writes idempotent.',
      'Separate document storage from the index handoff: store fetched versions and metadata under stable keys, then publish a durable indexing event or batch. Watch queue age by priority, eligible-host count, fetch success and error rates, robots denials, bytes, duplicate ratio, change-detection lag, and per-host request rates. These signals expose starvation, floods, traps, and stale output before aggregate QPS looks wrong.',
    ],
    takeaways: ['Partition by host to preserve rate ownership, then rebalance carefully.', 'Measure both crawl health and the freshness of downstream indexed content.'],
    diagramId: 'crawler-scale', scenario: 'Adding workers raises total QPS but one important host still falls behind. Why?',
    scenarioAnswer: 'That host may be limited by its politeness budget or have an oversized queue. More workers cannot safely exceed its rate; adjust priorities, freshness goals, or host policy with evidence.',
  },
];

const check = (id: string, stepId: string, difficulty: Question['difficulty'], prompt: string, options: string[], correctIndex: number, explanation: string): Question => ({ id, stepId, difficulty, prompt, options, correctIndex, explanation });

export const crawlerQuestions: Question[] = [
  check('crq01','crawler-scope','Recall','Which choice most changes what a crawler must store and emit?',['Whether it serves an archive or search index','Worker programming language','Diagram width','Logo color'],0,'The purpose drives retained versions, parsing, and downstream output.'),
  check('crq02','crawler-scope','Apply','One billion fetches in 30 days is roughly how many fetches per second on average?',['40','386','38,600','4'],1,'One billion divided by 30 × 24 × 3600 is about 386; peaks and retries add demand.'),
  check('crq03','crawler-pipeline','Recall','What closes the crawler discovery loop?',['Rendering each PDF','Only counting DNS responses','Returning accepted extracted links to the frontier','Deleting every source page'],2,'The parser extracts links and accepted unseen URLs become future work.'),
  check('crq04','crawler-pipeline','Diagnose','A worker crashes after fetching but before acknowledging. What keeps the URL from being lost?',['A longer CSS timeout','A random new seed','A browser cache','A durable lease that expires'],3,'The unacknowledged lease becomes eligible again; idempotent processing handles the repeat.'),
  check('crq05','crawler-policy','Recall','What does robots.txt primarily communicate?',['Site crawl preferences for identified user agents','An authentication grant','A page hash','An IP route'],0,'Robots rules guide compliant crawling; they are not access control.'),
  check('crq06','crawler-policy','Diagnose','Why is a global 500-request limit insufficient for politeness?',['It stores too many URLs','All 500 requests could hit one host','It eliminates retries','It prevents DNS caching'],1,'Rate control must be scoped to each host or site, not only the whole fleet.'),
  check('crq07','crawler-frontier','Recall','What are the two core scheduling decisions?',['Database vendor and icon','Only insertion order','URL priority and host eligibility','Font and page size'],2,'Priority chooses value; eligibility enforces politeness and timing.'),
  check('crq08','crawler-frontier','Apply','A Bloom filter says a URL was seen. Why might an authoritative check still matter?',['Bloom filters store HTML','Bloom filters guarantee ordering','Bloom filters parse robots.txt','Bloom filters can return false positives'],3,'A false positive can cause an unseen URL to be skipped.'),
  check('crq09','crawler-dedup','Recall','When can duplicate content be detected?',['After a fetch supplies content to compare','Before knowing any URL','Only before DNS','Only after five years'],0,'URL identity is available earlier; content fingerprints require the response.'),
  check('crq10','crawler-dedup','Diagnose','Why avoid deleting all history for two URLs with equal HTML?',['A page cannot redirect','Their provenance or future content may differ','Hashes cannot match','URLs are never reused'],1,'Keep URL-to-content relationships and fetch history even when bytes are shared.'),
  check('crq11','crawler-fetch','Recall','Which bound protects a downloader from a decompression bomb?',['Longer redirects','More seeds','Maximum decompressed response size','A larger font'],2,'Compressed transfer size alone does not bound expansion in memory.'),
  check('crq12','crawler-fetch','Diagnose','A public URL redirects into a private network. What failed if the worker follows it?',['Ranking priority','Duplicate-content hashing','The index schema','Destination validation on each hop'],3,'Redirect and resolved-address checks must prevent access to private or local destinations.'),
  check('crq13','crawler-freshness','Recall','What can a conditional request save when content is unchanged?',['Response body transfer','All scheduling state','Every DNS lookup forever','Robots evaluation'],0,'A server can return 304 without retransmitting the representation.'),
  check('crq14','crawler-freshness','Diagnose','A calendar creates endless dated URLs. What is the likely failure mode?',['Missing TLS only','Spider trap or unbounded URL expansion','Content hash collision','Load balancer stickiness'],1,'Generated paths can expand without a natural crawl stopping point.'),
  check('crq15','crawler-scale','Recall','Why assign each host queue a clear scheduler owner?',['To avoid all redirects','To make every site equally fast','To coordinate that host’s request budget','To remove HTML parsing'],2,'One owner can enforce host delay and concurrency across workers.'),
  check('crq16','crawler-scale','Apply','Which signal best reveals an important page is not being revisited in time?',['Only fleet average QPS','Card background color','Total domain count alone','Queue age and change-detection lag by priority'],3,'Freshness and queue age reveal starvation that aggregate throughput hides.'),
];
