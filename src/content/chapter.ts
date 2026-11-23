export type RelatedLesson = {
  chapterId: string;
  stepId: string;
  /** What the linked lesson adds for someone reading this one. */
  reason: string;
};

export type Step = {
  id: string;
  title: string;
  /** The term people search for, used in the page title. */
  seoTitle?: string;
  eyebrow: string;
  summary: string;
  body: string[];
  takeaways: string[];
  diagramId: string;
  scenario?: string;
  scenarioAnswer?: string;
  /** Lessons elsewhere in the course that this one builds on or uses. */
  related?: RelatedLesson[];
};

export type Question = {
  id: string;
  stepId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'Recall' | 'Apply' | 'Diagnose';
};

export const steps: Step[] = [
  {
    id: 'single-server',
    title: 'Begin with one server',
    seoTitle: 'How a web request works: DNS, HTTP, and a single server',
    eyebrow: '01 · The request path',
    summary: 'Follow a request before adding any infrastructure.',
    body: [
      'A small application can begin with its web code, database, and cache on one machine. A person enters a domain; DNS, the internet’s directory of names, resolves it to an IP address; the client sends an HTTP request to that address; the server returns a response such as HTML or JSON.',
      'Follow one request with example values. A browser looks up shop.example and receives 203.0.113.10, along with a time to live (TTL) of 300 seconds that says how long the answer may be reused. It connects to that address and sends GET /. The application reads a product list from the local database and sends back HTML. No network hop separates the code from its data, so the path stays short and easy to debug.',
      'One server goes further than many people expect. At an example 10,000 daily users making 20 requests each, the average is about 2.3 requests per second (200,000 ÷ 86,400), well within reach of one modest machine running Nginx and Postgres. More components add operational work, so traffic alone is not a reason to deploy every scaling technique at once. First find the part that fails or slows down.',
      'The cost is risk, not speed. This machine is a single point of failure, one part whose loss stops the whole service: a crash or restart takes the site offline, and a dead disk can destroy your data unless backups live elsewhere. Move on once downtime becomes expensive or one resource runs out.',
    ],
    takeaways: [
      'DNS finds an address; HTTP carries the request and response.',
      'A single server is a reasonable starting point and a single point of failure.',
    ],
    diagramId: 'single-server',
    scenario: 'Your new site has a few daily users. Trace how a browser reaches its home page.',
    scenarioAnswer: 'Keep one server while demand is small: DNS resolves the domain, the browser sends HTTP to the server, and the server returns the page. This is easy to run, but one machine failure can take the site offline.',
  },
  {
    id: 'split-tiers',
    title: 'Separate web and data',
    seoTitle: 'Separating web and database tiers: SQL or NoSQL',
    eyebrow: '02 · Independent capacity',
    summary: 'Give application code and stored data room to grow independently.',
    body: [
      'As demand grows, move the database to its own machine. A tier is a group of machines doing one job, so you now have a web tier and a data tier. Web traffic can then grow without forcing a database upgrade, and database capacity can change without resizing the web tier. The two also stop competing: on one machine, a slow report can starve page rendering of CPU, while the application’s memory use squeezes the database’s cache.',
      'The move has a price. Each query now crosses a network. A round trip inside one data center is very roughly 0.5 ms, so a page that makes 20 queries gains about 10 ms, while a page with 500 accidental queries gains 250 ms. The link can also fail on its own, and you now have two machines to patch and secure. Managed services such as Amazon RDS take over some of that work for a fee.',
      'A relational database, such as Postgres or MySQL, is a practical default when records relate to each other and queries need joins, which combine rows from several tables. A document, key-value, graph, or column-oriented store may fit better when the access pattern or data model calls for it. Cassandra, for example, is built for very high write volumes read by a known key, but it has no joins. Evaluate actual queries, latency needs, and data shape before changing database types; “large scale” alone does not choose one for you.',
    ],
    takeaways: [
      'Tier separation lets each tier scale for its own workload.',
      'Choose storage from data relationships and query patterns.',
    ],
    diagramId: 'split-tiers',
    scenario: 'A sensor platform stores billions of readings, always written and read by device ID and time range. Which storage model would you evaluate first?',
    scenarioAnswer: 'A wide-column store such as Cassandra deserves a look, because the access pattern is known in advance and needs no joins. You give up ad hoc queries and joins, so confirm that no important report needs them. At smaller volumes, a partitioned Postgres table may be simpler to run.',
  },
  {
    id: 'scale-web',
    title: 'Grow the web tier',
    seoTitle: 'Vertical vs horizontal scaling and load balancers',
    eyebrow: '03 · Capacity and failover',
    summary: 'Know when to strengthen one machine and when to add more.',
    body: [
      'Vertical scaling adds CPU or memory to one server. It is simple at modest load and needs no code changes, but hardware has limits, upgrades often mean a restart, and that server can still fail. Horizontal scaling adds servers to a pool, giving more capacity and allowing traffic to continue when one instance is unavailable.',
      'A load balancer receives public traffic and routes requests to healthy web servers, usually reached over private network addresses that are not exposed to the internet. It finds healthy servers with health checks: it requests a path such as /healthz every few seconds and stops sending traffic to a server that fails several in a row. With checks every 5 seconds and two failures required, a dead server can still receive requests for about 10 seconds, so clients need sensible retries. It can use added servers once they are provisioned and registered.',
      'Size the pool for loss, not just for load. If each server handles 300 requests per second and the peak is 900, three servers are exactly enough until one dies. Four servers run at 225 each and rise to 300 after a failure. The balancer also needs a resilient deployment; introducing it does not automatically remove every single point of failure. HAProxy and Nginx are common software choices, and managed options such as AWS Application Load Balancer span multiple zones. For a small internal tool, one larger server may be the better trade.',
    ],
    takeaways: [
      'Scale up for simplicity when headroom exists; scale out for larger capacity and redundancy.',
      'A load balancer distributes requests; it does not create servers by itself.',
    ],
    diagramId: 'scale-web',
    scenario: 'Your one large web server peaks at 80% CPU. The next size up costs twice as much and needs a restart. Do you scale up or out?',
    scenarioAnswer: 'Scaling up is quick and changes no code, but it keeps the single point of failure and has a ceiling. Scaling out needs a load balancer and servers that hold no unique user state, and in return it adds redundancy. If an outage is costly, scale out; if downtime is tolerable, scaling up buys time cheaply.',
  },
  {
    id: 'replication',
    title: 'Protect the database',
    seoTitle: 'Database replication: read replicas, lag, and failover',
    eyebrow: '04 · Copies and failover',
    summary: 'Replicas add read capacity and provide a path through database failure.',
    body: [
      'In a primary/replica arrangement, changes go to the primary, and copies called replicas apply them and serve many reads. If one read replica fails, reads can move to another or to the primary. Replication does not distribute writes away from the primary, so a write bottleneck needs a different remedy.',
      'Replication timing is a choice. With synchronous replication, the primary waits for a replica to confirm a change before telling the client it succeeded. No confirmed write is lost if that replica survives, but every commit pays for the extra round trip, and a stalled replica can stall writes. With asynchronous replication, the primary confirms first and ships the change afterward: faster, but replicas lag behind. Postgres defaults to asynchronous and can be configured for synchronous commits.',
      'Lag makes replica reads stale. If someone renames their profile and the next page reads from a replica two seconds behind, they see the old name. A common fix routes a user’s reads to the primary for a few seconds after their own write. Lag also sets the cost of losing the primary: at 500 writes per second, two seconds of lag means up to 1,000 confirmed writes may be missing from the replica you promote.',
      'Promotion also means redirecting clients and preventing split brain, where an isolated old primary keeps accepting writes alongside the new one and the copies diverge. Tools such as Patroni use a majority-based store like etcd to allow one primary at a time, and the old node must be fenced, meaning blocked from accepting writes.',
    ],
    takeaways: [
      'Replicas help with reads and availability, but their reads can be stale.',
      'Synchronous replication trades write speed for fewer lost writes; asynchronous does the reverse.',
      'Failover is an operational process: plan for missing writes and split brain.',
    ],
    diagramId: 'replication',
    scenario: 'Monitoring loses contact with the primary and promotes a replica. Ten minutes later the network heals, and some web servers are still writing to the old primary.',
    scenarioAnswer: 'This is split brain: two nodes accept writes and their data is diverging. Fence the old primary at once so only the promoted node takes writes, then compare the two write histories and reconcile what you can. Prevent a repeat with fencing and a majority-based failover tool, because a health check alone cannot tell a dead primary from an unreachable one.',
    related: [
      { chapterId: 'replication', stepId: 'rc-lag', reason: 'Ways to show people their own writes despite replica lag' },
      { chapterId: 'replication', stepId: 'rc-failover', reason: 'What failover can lose, and how fencing stops split brain' },
    ],
  },
  {
    id: 'cache',
    title: 'Cache repeated work',
    seoTitle: 'Caching explained: cache-aside, TTL, and eviction',
    eyebrow: '05 · Faster reads',
    summary: 'Keep frequently requested results close to the web tier.',
    body: [
      'A cache is fast, usually in-memory storage for results you expect to need again. In the common cache-aside pattern, a hit returns a stored result without querying the database. On a miss, the application reads from the database, stores the result for later, and returns it. Frequently read, rarely changed data is a strong candidate. Important data still belongs in persistent storage.',
      'The hit rate, the share of lookups answered by the cache, is what protects the database. With an example load of 10,000 reads per second, a 95% hit rate leaves the database 500 queries per second. At 90% it sees 1,000: five points of hit rate doubled its load. If a cache outage drops the rate to zero, all 10,000 arrive at once. Multiple cache nodes, spare capacity, and a deliberate fallback help prevent a speed optimization from becoming an availability problem. Redis and Memcached are the usual tools.',
      'An expiration time, or time to live (TTL), that is too short causes repeated database work; too long risks stale answers. Updates may need explicit cache invalidation or replacement. When memory fills, an eviction rule such as least recently used, least frequently used, or first in first out chooses what to remove.',
      'Do not cache what must be exactly current, such as a balance checked before a payment, or what is rarely requested twice. Each cache adds a system to run and a new way to show wrong data.',
    ],
    takeaways: [
      'A cache speeds repeated reads but may serve stale data.',
      'Expiration, invalidation, eviction, and failure handling are separate decisions.',
    ],
    diagramId: 'cache',
    scenario: 'A product page is popular, but its price changes throughout the day.',
    scenarioAnswer: 'Cache stable product details and give the price a short lifetime or explicit invalidation on updates. This reduces repeated reads, but stale prices remain possible if database and cache changes are not coordinated.',
    related: [
      { chapterId: 'patterns', stepId: 'pt-stampede', reason: 'How to stop an expiry or cold cache from flooding the database' },
    ],
  },
  {
    id: 'cdn',
    title: 'Deliver assets near users',
    seoTitle: 'What is a CDN? How edge caching works',
    eyebrow: '06 · Edge delivery',
    summary: 'Use a CDN for reusable static files across distances.',
    body: [
      'A content delivery network stores assets such as images, video, CSS, and JavaScript at distributed edge locations, which are servers close to users. On a miss, an edge fetches the asset from its origin, the server that holds the source copy, and caches it; later requests can be answered near the user until the cached copy expires.',
      'Distance is the main benefit. As a rough example, a visitor in Sydney fetching an image from an origin in Virginia waits about 200 ms per round trip, while a nearby edge may answer in about 20 ms. A CDN also takes load off the origin. If a 200 KB image is requested one million times a day and the hit ratio is 95%, the origin serves 50,000 requests and 10 GB rather than 200 GB.',
      'CDN delivery has transfer costs, so rarely used assets may bring little benefit. A changed file can be refreshed by invalidating the old object or by giving the new version a new URL, such as app.3f9a2c.js, which lets you cache it for a long time safely. Cloudflare, Amazon CloudFront, and Fastly all support both. Private files need extra care, such as signed URLs. Plan what the application should do if CDN delivery is temporarily unavailable.',
      'A CDN shortens the path for cached assets. It does not automatically accelerate a dynamic request that still crosses the world to a distant application and database. If the HTML takes 800 ms because the server is far away, a faster image will not fix it.',
    ],
    takeaways: [
      'CDN caching targets static delivery; application caching targets repeated computation or data reads.',
      'Measure the slow request before choosing an edge solution.',
    ],
    diagramId: 'cdn',
    scenario: 'International users report a slow page even though database queries are fast.',
    scenarioAnswer: 'Measure which requests are slow. Serve static assets through a CDN near users; if dynamic requests still travel to a distant region, investigate the application path or regional placement. A CDN cannot fix every dynamic round trip.',
  },
  {
    id: 'stateless',
    title: 'Keep web servers replaceable',
    seoTitle: 'Stateless web servers: sessions, sticky routing, and JWTs',
    eyebrow: '07 · Shared state',
    summary: 'Any healthy web server should be able to serve the next request.',
    body: [
      'A session is what the server remembers about a logged-in user between requests. If a session exists only on one web server, a later request sent to another server may appear logged out. Sticky sessions route a user back to the same server, but they make server removal and failure recovery harder: a rolling deploy that restarts each server logs all those users out.',
      'There are two common ways out. The first is a shared store: move session information into Redis or a database that all web servers can reach, and give the browser only a random session ID. Each request costs a lookup, typically about a millisecond on the same network, and the store needs its own availability plan. In exchange, deleting a record logs someone out at once.',
      'The second is a signed token, such as a JSON Web Token (JWT). At login, the server signs a small document containing the user ID and an expiry, and the client sends it with each request. Any server holding the verification key can check it without a lookup. The cost is revocation: a token stays valid until it expires unless you add a server-side deny list, which brings back a lookup. Teams often pair expiries of minutes with a refresh step. Standard JWT payloads are readable, so they should not hold secrets.',
      'Either way, the web tier is stateless with respect to sessions: servers can be added or removed without moving anyone’s session. The system still has state; it simply lives outside the web process.',
    ],
    takeaways: [
      'Stateless web servers do not keep unique user sessions locally.',
      'A shared store makes revocation easy; signed tokens avoid the lookup but are hard to revoke early.',
    ],
    diagramId: 'stateless',
    scenario: 'A login works on Server A, then fails when the next request lands on Server B.',
    scenarioAnswer: 'Move session state to a shared store, or issue signed tokens, so either server can authenticate the next request. This makes servers replaceable, but a shared store needs its own availability and capacity plan, and signed tokens are hard to revoke before they expire.',
  },
  {
    id: 'multi-dc',
    title: 'Serve more than one region',
    seoTitle: 'Multi-region architecture: GeoDNS, failover, and data sync',
    eyebrow: '08 · Regional resilience',
    summary: 'Route users near a healthy data center and keep required data available there.',
    body: [
      'A geo-aware DNS service, often called GeoDNS, answers a lookup with the address of a nearby data center. Amazon Route 53, for example, supports latency-based and failover routing. During a major outage, traffic must move to a healthy region that has enough capacity to receive it. DNS moves slowly: with a 60-second TTL, many clients switch within minutes, but some resolvers hold old answers for longer.',
      'Capacity is the first trap. If two regions each run at 60% of their capacity, the survivor of a regional failure faces 120% and overloads. To absorb a full failover, each must normally stay below 50%, so you pay for about twice what a normal day needs.',
      'Routing is only part of failover. If needed data exists only in the failed region, requests can still fail. Regions need an explicit data synchronization strategy. Cross-region replication is usually asynchronous, because waiting about 100 ms on each write is expensive. As an example, a lag of one second means a failover can lose about a second of confirmed writes. Letting both regions accept writes keeps each one writable, but two people can then change the same record, so conflicts need a rule.',
      'Deployments must be tested in each location so the supposedly healthy region actually works. Netflix has publicly described evacuating traffic from an entire AWS region to prove the others can absorb it. Most products do not need this: running across availability zones, separate facilities within one region, handles common failures at far lower cost.',
    ],
    takeaways: [
      'Regional failover needs both traffic routing and usable data.',
      'Cross-region testing and consistent deployment are part of the design.',
    ],
    diagramId: 'multi-dc',
    scenario: 'Two regions each run at 70% of capacity, and leadership wants the product to survive losing either one. What do you tell them?',
    scenarioAnswer: 'The survivor would face 140% of its capacity and overload, so the routing plan alone is not enough. Add capacity until each region runs near 50%, or decide which features to shed during a failover. Then confirm the required data exists in both regions and rehearse the move.',
    related: [
      { chapterId: 'replication', stepId: 'rc-multi', reason: 'What happens when two regions both accept writes' },
    ],
  },
  {
    id: 'queue',
    title: 'Move slow work off the request',
    seoTitle: 'Message queues: moving slow work to background workers',
    eyebrow: '09 · Asynchronous work',
    summary: 'A queue lets web requests and background workers move at different speeds.',
    body: [
      'For a slow task such as image processing, the web server publishes a job to a message queue and responds without doing the processing inline. Workers, separate processes that pull jobs, consume them and save results. A suitable durable queue, one that stores jobs on disk or across machines, can retain pending work while a worker is unavailable. Amazon SQS and RabbitMQ are common choices.',
      'Size workers with simple arithmetic. If 20 uploads arrive per second and each takes 8 seconds of processing, you need about 160 workers busy at once (20 × 8). Now suppose a burst brings 50 uploads per second for ten minutes. Those 160 workers still finish 20 per second, so 30 per second pile up: a backlog of 18,000 jobs. People wait longer, but the work is not lost and the web tier stays responsive.',
      'A growing backlog means jobs arrive faster than workers finish them, or workers are unhealthy. Add or repair workers after checking the cause. When the queue stays mostly empty, fewer workers may be enough. The producer and workers can scale independently.',
      'Queues have costs. Many, including standard SQS, deliver at least once, so a worker that crashes before acknowledging a job means it runs again; handlers must be idempotent, meaning a repeat does no extra harm. A job that keeps failing needs a dead-letter queue, a place to set it aside. Do not use a queue when the user needs the answer to continue, as with a login or a card authorization.',
    ],
    takeaways: [
      'Queues buffer asynchronous work and decouple producers from consumers.',
      'Backlog and job age reveal whether worker capacity is keeping up.',
    ],
    diagramId: 'queue',
    scenario: 'Uploading a photo takes eight seconds because the request waits for filters to finish.',
    scenarioAnswer: 'Accept the upload, publish a processing job, and let workers apply filters asynchronously. The request can finish sooner, but the UI must show that the processed photo is pending and the queue needs retries and monitoring.',
    related: [
      { chapterId: 'patterns', stepId: 'pt-idempotency', reason: 'How to make a job safe to run twice' },
      { chapterId: 'patterns', stepId: 'pt-backpressure', reason: 'What to do when a backlog keeps growing' },
    ],
  },
  {
    id: 'observability',
    title: 'See and operate the system',
    seoTitle: 'Monitoring and observability: logs, metrics, and CI/CD',
    eyebrow: '10 · Evidence and automation',
    summary: 'Measure the bottleneck before changing the architecture.',
    body: [
      'Centralized logs make errors searchable across many servers. Host metrics such as CPU and memory show local pressure; tier metrics show the health of the whole database or cache fleet; business metrics such as active users and retention show whether the product is serving people. Common tools include Prometheus for collecting metrics and Grafana for dashboards.',
      'Evidence shortens an incident. Imagine, as an example, that p99 latency, the time within which 99% of requests finish, jumps from 200 ms to 900 ms at 14:05. Web CPU is flat, so adding web servers will not help. Database reads have risen sixfold, because the cache hit rate fell from 95% to 70%. A deploy at 14:03 changed the cache key format. The fix is a rollback, not a bigger database. Distributed tracing, which records one request’s path through every service, helps when the cause is less obvious.',
      'Automated build, test, and deployment reduce mistakes as the number of servers and regions grows. Use latency, errors, saturation, queue age, and workload shape to decide which tier to change. A rising user count by itself does not prove the database needs sharding.',
      'Monitoring has costs too. At 1,000 requests per second, a 1 KB log line per request is about 86 GB per day, so teams sample or shorten retention. A metric labeled by user ID can create millions of time series and strain the metrics system. A small app can start with error tracking, an uptime check, and a few dashboards.',
    ],
    takeaways: [
      'Logs explain failures; metrics show scale and trends.',
      'Automation helps keep deployments consistent across servers and regions.',
    ],
    diagramId: 'observability',
    scenario: 'Search has slowed down all week. Web CPU is flat at 30%, database CPU is climbing, and no deploy matches the start of the slowdown.',
    scenarioAnswer: 'Start with the database evidence: slow query logs, query counts, and the cache hit rate. Web servers are not the constraint, so adding them will not help. Without a matching deploy, suspect gradual change such as growing tables or a shifting query mix. Trace one slow request to confirm, then make one targeted change and watch the same metrics.',
  },
  {
    id: 'sharding',
    title: 'Partition a growing database',
    seoTitle: 'Database sharding: shard keys, hot spots, and resharding',
    eyebrow: '11 · Data distribution',
    summary: 'Shard only when one database cannot reasonably hold or handle the workload.',
    body: [
      'Replication makes copies; sharding gives different servers different slices of data. A sharding key decides which slice holds a record. With three shards and a user ID rule of `user_id % 3`, user 7 lands on shard 1, and every operation must know the user ID to route to the right place.',
      'A key should distribute both data and traffic well. Uneven growth can exhaust one shard. A celebrity or other hot key can overload one shard even if the overall dataset is balanced. Fixes may involve moving data or splitting a hot partition.',
      'Resharding is the next cost. Going from three shards to four under a modulo rule moves about three quarters of all users, because `user_id % 3` and `user_id % 4` agree for only a quarter of IDs: user 7 moves from shard 1 to shard 3. Consistent hashing, and fixed logical shards mapped onto machines, exist largely to reduce that movement.',
      'Sharding makes cross-shard joins and transactions harder, since no single database sees all the data. Keeping some related data together or denormalizing selected read paths, which means storing duplicates shaped for a query, can help, but duplicates must be maintained when source data changes. Vitess for MySQL and Citus for Postgres handle routing, yet the key choice remains yours. So treat sharding as a late step: try indexes, read replicas, caching, a larger machine, and archiving old rows first.',
    ],
    takeaways: [
      'Choose a key for access patterns as well as even data distribution.',
      'Sharding adds routing, rebalancing, hotspot, and query complexity.',
    ],
    diagramId: 'sharding',
    scenario: 'Orders are sharded by customer ID. Finance now wants a daily report of revenue by product across all customers.',
    scenarioAnswer: 'That report touches every shard, because no single shard holds all orders for a product. Fan the query out and merge the results, or stream orders into a separate analytics store built for such scans. Changing the key to suit one report would hurt the per-customer paths that run all day.',
    related: [
      { chapterId: 'consistent-hashing', stepId: 'hash-modulo', reason: 'Why modulo routing moves so many keys, and what reduces it' },
    ],
  },
  {
    id: 'synthesis',
    title: 'Scale in response to evidence',
    seoTitle: 'How to scale a web app to a million users, step by step',
    eyebrow: '12 · Put it together',
    summary: 'Each technique answers a different pressure on the system.',
    body: [
      'A practical path starts simple, separates web and data, adds web redundancy, replicates the database, caches repeated reads, serves static assets from a CDN, keeps web servers stateless, and introduces regional failover and background work when the workload demands them. There is no universal checklist to deploy all at once.',
      'Here is one illustrative history, told in signals. At 5,000 daily users, one server has headroom, so nothing changes. At 50,000, the database and application compete for memory, so the database moves out. At 200,000, web CPU peaks at 85% and a single failure would mean an outage, so a load balancer and three web servers arrive, which forces sessions out of server memory. At one million, database reads hit 70% of capacity while writes stay low, so a cache and two replicas follow. Another product would take a different order: a video service needs a CDN early, and a sensor platform with heavy writes may need partitioned storage long before replicas help.',
      'Match the symptom to the remedy. If reads are slow, inspect query and cache behavior; if writes overload the primary, read replicas alone will not fix it; if one shard is hot, more evenly sized shards may not solve the hotspot. Observe, choose one bottleneck, and test the effect of the change. Every addition has a running cost: another system to patch, monitor, and reason about during an outage, and another way for data to be stale or lost.',
    ],
    takeaways: [
      'Match the technique to the bottleneck and its failure mode.',
      'Revisit tradeoffs after every change; each new component needs an operating plan.',
    ],
    diagramId: 'synthesis',
    scenario: 'Writes are saturating your primary while reads are healthy. A colleague proposes two more replicas and a larger cache.',
    scenarioAnswer: 'Neither helps, because both target reads and every write still reaches the primary. Confirm the write path is the limit, then look at batching writes, moving deferrable work to a queue, dropping unused indexes, or a larger primary. Shard only if those are not enough.',
  },
];

export const questions: Question[] = [
  {
    id: 'q01', stepId: 'single-server', difficulty: 'Recall',
    prompt: 'What does DNS supply before the browser sends an HTTP request?',
    options: ['The server IP address', 'The finished HTML page', 'A database connection', 'A cached user session'],
    correctIndex: 0,
    explanation: 'DNS resolves the domain to an address. The client then sends its HTTP request to that address.',
  },
  {
    id: 'q02', stepId: 'single-server', difficulty: 'Diagnose',
    prompt: 'A one-server app is unreachable after its machine fails. What weakness does this expose?',
    options: ['Too little CPU for its traffic', 'A single point of failure', 'A DNS record with a long TTL', 'A database missing its indexes'],
    correctIndex: 1,
    explanation: 'When all critical parts live on one machine, that machine failing can take the whole app offline. More CPU or a shorter TTL would not give it anywhere else to run.',
  },
  {
    id: 'q03', stepId: 'single-server', difficulty: 'Apply',
    prompt: 'A new app has ten daily users and healthy latency. What is the strongest first move?',
    options: ['Shard the database before it grows', 'Deploy a second data center now', 'Keep the simple design and measure it', 'Put a message queue before each request'],
    correctIndex: 2,
    explanation: 'Start with a design you can operate. Add complexity when a measured limit or availability need calls for it.',
  },
  {
    id: 'q04', stepId: 'split-tiers', difficulty: 'Recall',
    prompt: 'Why move the database off the web server as the app grows?',
    options: ['To prevent all database failures', 'To scale the two tiers independently', 'To let a CDN answer the queries', 'To avoid needing a load balancer'],
    correctIndex: 1,
    explanation: 'Separate machines let web and database resources change according to their own load. The database can still fail, and now the network between the tiers can too.',
  },
  {
    id: 'q05', stepId: 'split-tiers', difficulty: 'Apply',
    prompt: 'Users, products, and orders require joins. Which default deserves evaluation first?',
    options: ['A relational database', 'A key-value store', 'An object store such as S3', 'A message queue with topics'],
    correctIndex: 0,
    explanation: 'Tables and joins fit related records. Another data model may win after examining real queries and requirements.',
  },
  {
    id: 'q06', stepId: 'scale-web', difficulty: 'Recall',
    prompt: 'Which action is horizontal scaling?',
    options: ['Adding RAM to one server', 'Upgrading a server’s CPU', 'Adding servers to a pool', 'Raising a cache entry’s TTL'],
    correctIndex: 2,
    explanation: 'Horizontal scaling adds machines. Adding resources to one machine is vertical scaling.',
  },
  {
    id: 'q07', stepId: 'scale-web', difficulty: 'Apply',
    prompt: 'Three web servers behind a load balancer each run at 70% CPU, and one dies. If nothing else changes, what happens next?',
    options: ['Requests for the dead server wait until it returns', 'The survivors absorb its load and overload at about 105%', 'The balancer starts a replacement server by itself', 'Traffic falls by a third, so the survivors stay at 70%'],
    correctIndex: 1,
    explanation: 'Health checks remove the dead server and its share moves to the others: 3 × 70% is 210% of one server’s CPU, or 105% each across two. That is why pools are sized for the loss of an instance. A balancer routes traffic; it does not create servers.',
  },
  {
    id: 'q08', stepId: 'scale-web', difficulty: 'Apply',
    prompt: 'A load balancer is in place, but both web servers are saturated. What increases web capacity?',
    options: ['Add and register more web servers', 'Add a second load balancer', 'Use a larger load balancer', 'Switch to least connections'],
    correctIndex: 0,
    explanation: 'The balancer can distribute work over more servers once they exist and join its pool. Changing the balancer or its rule moves the same work around without adding capacity.',
  },
  {
    id: 'q09', stepId: 'replication', difficulty: 'Diagnose',
    prompt: 'A user saves a new display name, reloads, and sees the old one. Seconds later the new name appears. Reads go to asynchronous replicas. What is the likely cause?',
    options: ['The primary rejected the write and retried it later on', 'A replica served the read before it had applied the write', 'The write went to a replica before reaching the primary', 'The browser kept the old page until its cache expired'],
    correctIndex: 1,
    explanation: 'With asynchronous replication the primary confirms a write before replicas apply it, so a read during that lag returns old data. Routing the user’s reads to the primary shortly after a write is a common fix.',
  },
  {
    id: 'q10', stepId: 'replication', difficulty: 'Diagnose',
    prompt: 'The primary fails while its best replica is behind. What must failover account for?',
    options: ['Web server CPU while clients reconnect to the new primary', 'Confirmed writes that may be missing from that replica', 'Cached rows that may expire during the promotion', 'Queue workers that may need restarting after the switch'],
    correctIndex: 1,
    explanation: 'A lagging replica may lack recently confirmed writes. Promotion and recovery need a deliberate procedure, and synchronous replication is the way to narrow that gap in advance.',
  },
  {
    id: 'q11', stepId: 'replication', difficulty: 'Apply',
    prompt: 'Will two extra read replicas directly fix a primary saturated by writes?',
    options: ['Yes, replicas accept half of the writes', 'Yes, replicas cache writes for the primary', 'No, writes still have to reach the primary', 'No, because replicas cannot serve any reads'],
    correctIndex: 2,
    explanation: 'Replicas relieve read pressure and support failover, but this model still routes writes to one primary. Each replica must also apply every write.',
  },
  {
    id: 'q12', stepId: 'cache', difficulty: 'Recall',
    prompt: 'On a cache miss, what should the application normally do?',
    options: ['Return an error so the client can retry', 'Read the database, fill the cache, then respond', 'Serve the last expired value it can still find', 'Ask the CDN to fetch the row from the database'],
    correctIndex: 1,
    explanation: 'The database remains the source of important data. A miss fetches it and warms the cache for later reads.',
  },
  {
    id: 'q13', stepId: 'cache', difficulty: 'Apply',
    prompt: 'Which data is the clearest cache candidate?',
    options: ['A popular product description changed once a week', 'A one-time login code used on a single request', 'The sole stored copy of a customer’s order', 'A report value computed once and not read again'],
    correctIndex: 0,
    explanation: 'Frequent reads and infrequent changes make caching useful while keeping freshness manageable.',
  },
  {
    id: 'q14', stepId: 'cache', difficulty: 'Diagnose',
    prompt: 'An hour after a user edits their bio, the database row is correct but their profile page still shows the old text. What is the likely gap?',
    options: ['The load balancer is routing to a bad server', 'The cached bio was not updated or invalidated', 'The queue has too few profile workers', 'The eviction rule removed the bio too soon'],
    correctIndex: 1,
    explanation: 'Database and cache updates are separate operations, so a stale cache entry can survive a database change. An evicted entry would cause a miss and a fresh read, which is the opposite symptom.',
  },
  {
    id: 'q15', stepId: 'cache', difficulty: 'Diagnose',
    prompt: 'Right after the only cache node restarts, database CPU jumps to 95% while user traffic stays flat. What is the cause?',
    options: ['Reads that used to hit the cache now reach the database', 'The restart triggered automatic resharding', 'The cache is writing entries back to the database', 'DNS moved traffic to a region with a colder database'],
    correctIndex: 0,
    explanation: 'A cold cache turns former hits into misses, increasing database load until the cache warms again.',
  },
  {
    id: 'q16', stepId: 'cdn', difficulty: 'Recall',
    prompt: 'Which resource best fits the CDN role in this chapter?',
    options: ['A user’s session record read on each page', 'A photo file requested worldwide', 'A database transaction for a checkout', 'A queue acknowledgment from a worker'],
    correctIndex: 1,
    explanation: 'A CDN places reusable static assets near users. Sessions and writes need different infrastructure.',
  },
  {
    id: 'q17', stepId: 'cdn', difficulty: 'Apply',
    prompt: 'A changed logo keeps appearing in its old form. What can force the new asset into use?',
    options: ['Restart the origin so edges pull the latest file', 'Invalidate the object or publish it at a new URL', 'Lower the file’s TTL at its next upload', 'Upload the new file under its old name'],
    correctIndex: 1,
    explanation: 'Invalidation removes the cached object, and a new URL identifies a distinct version that the edge must fetch. Changing the origin alone leaves old copies at the edge until they expire.',
  },
  {
    id: 'q18', stepId: 'cdn', difficulty: 'Diagnose',
    prompt: 'Assets load quickly abroad, but dynamic page data is slow. What should you inspect next?',
    options: ['The application and data path to the distant region', 'The TTL on assets the CDN is already serving quickly', 'The hit ratio on the CDN’s cached image objects', 'The number of edge locations close to those users'],
    correctIndex: 0,
    explanation: 'An edge cache speeds assets, while dynamic requests may still travel to a faraway application or database.',
  },
  {
    id: 'q19', stepId: 'stateless', difficulty: 'Apply',
    prompt: 'A team replaces server-side sessions with signed tokens that last 24 hours. A fired employee’s access must end within minutes. What is the catch?',
    options: ['A valid token keeps working until expiry without extra checks', 'Each web server must look the token up in a shared store', 'A token stops working once its signing server exits', 'The balancer must pin each token to one server to verify it'],
    correctIndex: 0,
    explanation: 'Verification needs only the key, so a token stays valid until it expires. Shorter expiries or a server-side deny list close the gap, and a deny list brings back a lookup.',
  },
  {
    id: 'q20', stepId: 'stateless', difficulty: 'Apply',
    prompt: 'Which change lets you add and remove web servers without logging anyone out?',
    options: ['Keep sessions in server memory and copy them at shutdown', 'Put sessions in a shared store every web server can reach', 'Pin each user to one server with load-balancer affinity', 'Write sessions to each server’s local disk for durability'],
    correctIndex: 1,
    explanation: 'Shared state lets any healthy instance serve the next request without depending on a particular machine. Signed tokens reach the same goal by another route. Copying at shutdown fails when a server crashes.',
  },
  {
    id: 'q21', stepId: 'multi-dc', difficulty: 'Diagnose',
    prompt: 'Region A fails; DNS routes users to B, but some records are absent. What was overlooked?',
    options: ['Data synchronization across regions', 'A shorter TTL on the GeoDNS records', 'More web capacity in the second region', 'A larger cache in the second region'],
    correctIndex: 0,
    explanation: 'Routing works only if the healthy region can access the data needed to answer requests.',
  },
  {
    id: 'q22', stepId: 'multi-dc', difficulty: 'Apply',
    prompt: 'What else should be tested before relying on a second region for failover?',
    options: ['That it can run the same service at full traffic', 'That GeoDNS lists its address for users close to it', 'That its static assets are already cached at the CDN', 'That its servers are named the same as the first region'],
    correctIndex: 0,
    explanation: 'The alternate region needs capacity, data, and a consistent working deployment, not merely a DNS entry.',
  },
  {
    id: 'q23', stepId: 'queue', difficulty: 'Apply',
    prompt: 'Generating a PDF invoice makes checkout requests wait six seconds. Which design fits?',
    options: ['Publish a job and let workers build it asynchronously', 'Add read replicas so the invoice data loads more quickly', 'Cache each invoice PDF after its request has finished', 'Move the web tier to servers with more CPU and memory'],
    correctIndex: 0,
    explanation: 'The web tier can accept the order and enqueue expensive work; workers finish it outside the request path. A cache does not help, because each invoice is built once.',
  },
  {
    id: 'q24', stepId: 'queue', difficulty: 'Diagnose',
    prompt: 'Queued jobs get older every minute. What does that signal?',
    options: ['Workers are keeping up, but reporting is delayed', 'Jobs arrive faster than workers finish them', 'The queue has reached its durable storage limit', 'The database must be sharded to speed up workers'],
    correctIndex: 1,
    explanation: 'A growing backlog or rising job age means workers are not draining the work as fast as it arrives.',
  },
  {
    id: 'q25', stepId: 'queue', difficulty: 'Apply',
    prompt: 'A worker is briefly offline when a job arrives. Why use a durable queue?',
    options: ['It can retain pending work until a worker returns', 'It runs the job inside the request if no worker is up', 'It replaces the database as the system of record', 'It guarantees that each job is processed exactly once'],
    correctIndex: 0,
    explanation: 'A suitably configured durable queue buffers work across a worker outage. Many queues deliver at least once, so consumers still need sound retry behavior.',
  },
  {
    id: 'q26', stepId: 'observability', difficulty: 'Recall',
    prompt: 'Which is a business metric rather than a host metric?',
    options: ['CPU utilization per host', 'Disk I/O wait time', 'Daily active users', 'Memory pressure per host'],
    correctIndex: 2,
    explanation: 'Daily active users describes product use; CPU, disk, and memory describe machine resource usage.',
  },
  {
    id: 'q27', stepId: 'observability', difficulty: 'Apply',
    prompt: 'Traffic doubled, but latency and errors are steady and capacity is ample. What next?',
    options: ['Shard now, while migration is still easy', 'Keep measuring and plan for proven limits', 'Add a second region before growth continues', 'Add web servers so the headroom stays the same'],
    correctIndex: 1,
    explanation: 'User count alone does not reveal the constrained tier. Watch the workload and change architecture when evidence warrants it.',
  },
  {
    id: 'q28', stepId: 'sharding', difficulty: 'Apply',
    prompt: 'With four shards and `user_id % 4`, where does user 31 belong?',
    options: ['Shard 0', 'Shard 1', 'Shard 2', 'Shard 3'],
    correctIndex: 3,
    explanation: '31 divided by 4 leaves a remainder of 3, so the routing rule chooses shard 3.',
  },
  {
    id: 'q29', stepId: 'sharding', difficulty: 'Diagnose',
    prompt: 'Shards hold similar amounts of data, but one is overwhelmed by reads. Why?',
    options: ['A hot account or key concentrates traffic there', 'Replication lag on that shard delays its reads', 'The modulo rule put too many rows on that shard', 'Reads go to that shard when the others are busy'],
    correctIndex: 0,
    explanation: 'An even row count does not ensure an even request rate. A popular key can create a hotspot, and each key’s reads go to the shard that holds it.',
  },
  {
    id: 'q30', stepId: 'sharding', difficulty: 'Recall',
    prompt: 'What complication appears when related records live on different shards?',
    options: ['Cross-shard joins and routing become harder', 'Replicas stop copying rows between the shards', 'Writes to one shard block reads on the others', 'Cached rows expire faster across the shards'],
    correctIndex: 0,
    explanation: 'Queries may need to combine data across machines. Denormalization can help selected reads but creates update work.',
  },
  {
    id: 'q31', stepId: 'synthesis', difficulty: 'Apply',
    prompt: 'Reads are slow because the same stable product details are fetched repeatedly. What is a targeted first improvement?',
    options: ['Cache those details with a suitable freshness policy', 'Shard the product table so each read gets faster', 'Add replicas and send product reads to them first', 'Rebuild the pages as static files on a CDN'],
    correctIndex: 0,
    explanation: 'Caching removes the repeated reads directly, with an expiration and invalidation plan for product changes. Replicas and shards would still run the same queries, and at a higher operating cost.',
  },
  {
    id: 'q32', stepId: 'synthesis', difficulty: 'Recall',
    prompt: 'Which statement best captures the chapter’s design method?',
    options: ['Add each scaling technique early so that growth is covered', 'Find the current limit, change one thing, check the result', 'Scale the database first, since it is usually what fails', 'Follow the same fixed order of upgrades at each traffic level'],
    correctIndex: 1,
    explanation: 'Scaling is iterative. Each technique solves a specific pressure and introduces a new operational responsibility.',
  },
  {
    id: 'q33', stepId: 'split-tiers', difficulty: 'Apply',
    prompt: 'Which requirement gives you a reason to evaluate a non-relational store?',
    options: ['Orders that must be joined to customers and products on most reads', 'Independent JSON documents fetched by key at very large volume', 'A team that would rather not measure its query patterns first', 'A web tier that has grown beyond one application server'],
    correctIndex: 1,
    explanation: 'A document-like access pattern at large scale can favor a non-relational model. Confirm it against real queries and consistency needs.',
  },
  {
    id: 'q34', stepId: 'cache', difficulty: 'Apply',
    prompt: 'A cache should preserve items requested repeatedly over time, even after short quiet periods. Which eviction policy fits best?',
    options: ['Least frequently used', 'Least recently used', 'First in, first out', 'Shortest time to live first'],
    correctIndex: 0,
    explanation: 'LFU favors historically popular entries. LRU emphasizes recency, so a short quiet period can evict a popular item, while FIFO only considers insertion order.',
  },
  {
    id: 'q35', stepId: 'stateless', difficulty: 'Diagnose',
    prompt: 'Sticky sessions seem to fix login errors, but one web server dies. What weakness returns?',
    options: ['Users pinned to that server lose their local sessions', 'Users on the surviving servers are logged out as well', 'The balancer keeps sending pinned users to that server', 'Users must clear their cookies before logging back in'],
    correctIndex: 0,
    explanation: 'Affinity masks server-local state. If that server disappears, its unique sessions disappear or become unreachable.',
  },
];
