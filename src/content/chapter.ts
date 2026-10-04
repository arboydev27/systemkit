export type Step = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  body: string[];
  takeaways: string[];
  diagramId: string;
  scenario?: string;
  scenarioAnswer?: string;
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
    eyebrow: '01 · The request path',
    summary: 'Follow a request before adding any infrastructure.',
    body: [
      'A small application can begin with its web code, database, and cache on one machine. A person enters a domain; DNS resolves it to an IP address; the client sends an HTTP request to that address; the server returns a response such as HTML or JSON.',
      'This simple path is useful because every later change has a purpose. First find the part that fails or slows down. More components add operational work, so traffic alone is not a reason to deploy every scaling technique at once.',
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
    eyebrow: '02 · Independent capacity',
    summary: 'Give application code and stored data room to grow independently.',
    body: [
      'As demand grows, move the database to its own machine. Web traffic can then grow without forcing a database upgrade, and database capacity can change without resizing the web tier.',
      'A relational database is a practical default when records relate to each other and queries need joins. A document, key-value, graph, or column-oriented store may fit better when the access pattern or data model calls for it. Evaluate actual queries, latency needs, and data shape before changing database types; “large scale” alone does not choose one for you.',
    ],
    takeaways: [
      'Tier separation lets each tier scale for its own workload.',
      'Choose storage from data relationships and query patterns.',
    ],
    diagramId: 'split-tiers',
    scenario: 'Users, orders, and products have many relationships. Which storage model would you evaluate first?',
    scenarioAnswer: 'Start by evaluating a relational database because joins suit those related records. Put it on a separate data tier so web and database capacity can change independently. Joins and a familiar model do not guarantee every future workload will fit one machine.',
  },
  {
    id: 'scale-web',
    title: 'Grow the web tier',
    eyebrow: '03 · Capacity and failover',
    summary: 'Know when to strengthen one machine and when to add more.',
    body: [
      'Vertical scaling adds CPU or memory to one server. It is simple at modest load, but hardware has limits and that server can still fail. Horizontal scaling adds servers to a pool, giving more capacity and allowing traffic to continue when one instance is unavailable.',
      'A load balancer receives public traffic and routes requests to healthy web servers, usually reached over private network addresses. It can use added servers once they are provisioned and registered. The balancer also needs a resilient deployment; introducing it does not automatically remove every single point of failure.',
    ],
    takeaways: [
      'Scale up for simplicity when headroom exists; scale out for larger capacity and redundancy.',
      'A load balancer distributes requests; it does not create servers by itself.',
    ],
    diagramId: 'scale-web',
    scenario: 'Two web servers sit behind a load balancer. One stops responding during a traffic spike.',
    scenarioAnswer: 'Route requests to the healthy server and add web capacity if it cannot carry the spike. Health-aware balancing improves availability, but the surviving server and the balancer still need enough capacity and resilience.',
  },
  {
    id: 'replication',
    title: 'Protect the database',
    eyebrow: '04 · Copies and failover',
    summary: 'Replicas add read capacity and provide a path through database failure.',
    body: [
      'In a primary/replica arrangement, changes go to the primary and replicas serve many reads. Read-heavy applications may use several replicas. If one read replica fails, reads can move to another; if it was the only replica, the primary can temporarily serve them.',
      'If the primary fails, a replica can be promoted to accept writes. A replica may lag behind the former primary, so promotion needs a plan for missing or unconfirmed writes and for redirecting clients. Replication creates copies of data; it does not distribute all writes away from the primary.',
    ],
    takeaways: [
      'Replicas help with reads and availability.',
      'Promotion is an operational process, not a guaranteed loss-free switch.',
      'A primary write bottleneck needs a different remedy.',
    ],
    diagramId: 'replication',
    scenario: 'The primary fails just after accepting a write that has not reached a replica.',
    scenarioAnswer: 'Promote a suitable replica so writes can resume, then investigate and recover the missing write if possible. Replica lag means failover may lose a recently accepted change; promotion requires a recovery procedure, not just a routing switch.',
  },
  {
    id: 'cache',
    title: 'Cache repeated work',
    eyebrow: '05 · Faster reads',
    summary: 'Keep frequently requested results close to the web tier.',
    body: [
      'On a cache hit, the application returns a stored result without querying the database. On a miss, it reads from the database, stores the result for later, and returns it. Frequently read, rarely changed data is a strong candidate. Important data still belongs in persistent storage.',
      'An expiration time that is too short causes repeated database work; too long risks stale answers. Updates may need explicit cache invalidation or replacement. When memory fills, an eviction rule such as least recently used, least frequently used, or first in first out chooses what to remove.',
      'A cache outage can send a burst of reads to the database. Multiple cache nodes, spare capacity, and a deliberate fallback help prevent a speed optimization from becoming an availability problem.',
    ],
    takeaways: [
      'A cache speeds repeated reads but may serve stale data.',
      'Expiration, invalidation, eviction, and failure handling are separate decisions.',
    ],
    diagramId: 'cache-cdn',
    scenario: 'A product page is popular, but its price changes throughout the day.',
    scenarioAnswer: 'Cache stable product details and give the price a short lifetime or explicit invalidation on updates. This reduces repeated reads, but stale prices remain possible if database and cache changes are not coordinated.',
  },
  {
    id: 'cdn',
    title: 'Deliver assets near users',
    eyebrow: '06 · Edge delivery',
    summary: 'Use a CDN for reusable static files across distances.',
    body: [
      'A content delivery network stores assets such as images, video, CSS, and JavaScript at distributed edge locations. On a miss, an edge fetches the asset from its origin and caches it; later requests can be answered near the user until the cached copy expires.',
      'CDN delivery has transfer costs, so rarely used assets may bring little benefit. A changed file can be refreshed by invalidating the old object or by giving the new version a new URL. Plan what the application should do if CDN delivery is temporarily unavailable.',
      'A CDN shortens the path for cached assets. It does not automatically accelerate a dynamic request that still crosses the world to a distant application and database.',
    ],
    takeaways: [
      'CDN caching targets static delivery; application caching targets repeated computation or data reads.',
      'Measure the slow request before choosing an edge solution.',
    ],
    diagramId: 'cache-cdn',
    scenario: 'International users report a slow page even though database queries are fast.',
    scenarioAnswer: 'Measure which requests are slow. Serve static assets through a CDN near users; if dynamic requests still travel to a distant region, investigate the application path or regional placement. A CDN cannot fix every dynamic round trip.',
  },
  {
    id: 'stateless',
    title: 'Keep web servers replaceable',
    eyebrow: '07 · Shared state',
    summary: 'Any healthy web server should be able to serve the next request.',
    body: [
      'If a session exists only on one web server, a later request sent to another server may appear logged out. Sticky sessions route a user back to the same server, but they make server removal and failure recovery harder.',
      'Move session information into an appropriately durable shared store that all web servers can reach. Then the web tier is stateless with respect to sessions: servers can be added or removed without moving each user’s session between them. The system still has state; it simply lives outside the web process.',
    ],
    takeaways: [
      'Stateless web servers do not keep unique user sessions locally.',
      'Shared state makes load balancing and autoscaling easier.',
    ],
    diagramId: 'stateless',
    scenario: 'A login works on Server A, then fails when the next request lands on Server B.',
    scenarioAnswer: 'Move session state to a shared store so either server can authenticate the next request. This makes servers replaceable, but the shared store now needs its own availability and capacity plan.',
  },
  {
    id: 'multi-dc',
    title: 'Serve more than one region',
    eyebrow: '08 · Regional resilience',
    summary: 'Route users near a healthy data center and keep required data available there.',
    body: [
      'A geo-aware DNS service can direct people toward a nearby data center. During a major outage, traffic must move to a healthy region that has enough capacity to receive it.',
      'Routing is only part of failover. If needed data exists only in the failed region, requests can still fail. Regions need an explicit data synchronization strategy, and deployments must be tested in each location so the supposedly healthy region actually works.',
    ],
    takeaways: [
      'Regional failover needs both traffic routing and usable data.',
      'Cross-region testing and consistent deployment are part of the design.',
    ],
    diagramId: 'multi-dc',
    scenario: 'GeoDNS sends everyone to Region B after Region A fails, but some profiles are missing.',
    scenarioAnswer: 'Synchronize needed profile data to Region B and test failover before relying on the route change. DNS can redirect traffic, but it cannot make absent data available or guarantee Region B has enough capacity.',
  },
  {
    id: 'queue',
    title: 'Move slow work off the request',
    eyebrow: '09 · Asynchronous work',
    summary: 'A queue lets web requests and background workers move at different speeds.',
    body: [
      'For a slow task such as image processing, the web server publishes a job to a message queue and responds without doing the processing inline. Workers consume jobs and save results. A suitable durable queue can retain pending work while a worker is unavailable.',
      'A growing backlog means jobs arrive faster than workers finish them, or workers are unhealthy. Add or repair workers after checking the cause. When the queue stays mostly empty, fewer workers may be enough. The producer and workers can scale independently.',
    ],
    takeaways: [
      'Queues buffer asynchronous work and decouple producers from consumers.',
      'Backlog and job age reveal whether worker capacity is keeping up.',
    ],
    diagramId: 'queue',
    scenario: 'Uploading a photo takes eight seconds because the request waits for filters to finish.',
    scenarioAnswer: 'Accept the upload, publish a processing job, and let workers apply filters asynchronously. The request can finish sooner, but the UI must show that the processed photo is pending and the queue needs retries and monitoring.',
  },
  {
    id: 'observability',
    title: 'See and operate the system',
    eyebrow: '10 · Evidence and automation',
    summary: 'Measure the bottleneck before changing the architecture.',
    body: [
      'Centralized logs make errors searchable across many servers. Host metrics such as CPU and memory show local pressure; tier metrics show the health of the whole database or cache fleet; business metrics such as active users and retention show whether the product is serving people.',
      'Automated build, test, and deployment reduce mistakes as the number of servers and regions grows. Use latency, errors, saturation, queue age, and workload shape to decide which tier to change. A rising user count by itself does not prove the database needs sharding.',
    ],
    takeaways: [
      'Logs explain failures; metrics show scale and trends.',
      'Automation helps keep deployments consistent across servers and regions.',
    ],
    diagramId: 'queue',
    scenario: 'Traffic doubles, but latency, errors, and capacity remain healthy.',
    scenarioAnswer: 'Keep measuring host, tier, and business metrics before scaling a component. Healthy headroom gives no evidence that sharding or more servers are needed yet; growth forecasts still warrant capacity planning.',
  },
  {
    id: 'sharding',
    title: 'Partition a growing database',
    eyebrow: '11 · Data distribution',
    summary: 'Shard only when one database cannot reasonably hold or handle the workload.',
    body: [
      'Replication makes copies; sharding gives different servers different slices of data. A sharding key decides which slice holds a record. With four shards and a user ID rule of `user_id % 4`, every operation must know the user ID to route to the right place.',
      'A key should distribute both data and traffic well. Uneven growth can exhaust one shard. A celebrity or other hot key can overload one shard even if the overall dataset is balanced. Fixes may involve moving data or splitting a hot partition.',
      'Sharding makes cross-shard joins and later reshuffling harder. Keeping some related data together or denormalizing selected read paths can help, but duplicates must be maintained when source data changes.',
    ],
    takeaways: [
      'Choose a key for access patterns as well as even data distribution.',
      'Sharding adds routing, rebalancing, hotspot, and query complexity.',
    ],
    diagramId: 'sharding',
    scenario: 'One shard receives most reads because several popular accounts landed there.',
    scenarioAnswer: 'Treat this as a hotspot: identify the hot keys and consider caching, moving them, or partitioning their data further. Adding evenly sized shards may leave the same popular accounts concentrated on one machine.',
  },
  {
    id: 'synthesis',
    title: 'Scale in response to evidence',
    eyebrow: '12 · Put it together',
    summary: 'Each technique answers a different pressure on the system.',
    body: [
      'A practical path starts simple, separates web and data, adds web redundancy, replicates the database, caches repeated reads, serves static assets from a CDN, keeps web servers stateless, and introduces regional failover and background work when the workload demands them.',
      'There is no universal checklist to deploy all at once. If reads are slow, inspect query and cache behavior; if writes overload the primary, read replicas alone will not fix it; if one shard is hot, more evenly sized shards may not solve the hotspot. Observe, choose one bottleneck, and test the effect of the change.',
    ],
    takeaways: [
      'Match the technique to the bottleneck and its failure mode.',
      'Revisit tradeoffs after every change; each new component needs an operating plan.',
    ],
    diagramId: 'sharding',
    scenario: 'Your app has twice as many users as last month, but every tier has spare capacity.',
    scenarioAnswer: 'Keep the current architecture and watch latency, errors, saturation, and growth trends. More users alone do not justify sharding; sharding adds routing, rebalancing, and query complexity.',
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
    options: ['A CDN cache miss', 'A single point of failure', 'Replica lag', 'An uneven sharding key'],
    correctIndex: 1,
    explanation: 'When all critical parts live on one machine, that machine failing can take the whole app offline.',
  },
  {
    id: 'q03', stepId: 'single-server', difficulty: 'Apply',
    prompt: 'A new app has ten daily users and healthy latency. What is the strongest first move?',
    options: ['Shard the database', 'Deploy two data centers', 'Keep the simple design and measure it', 'Add a message queue to every request'],
    correctIndex: 2,
    explanation: 'Start with a design you can operate. Add complexity when a measured limit or availability need calls for it.',
  },
  {
    id: 'q04', stepId: 'split-tiers', difficulty: 'Apply',
    prompt: 'Why move the database off the web server as the app grows?',
    options: ['To remove all database failures', 'To scale the two tiers independently', 'To make every query use a CDN', 'To eliminate the need for a load balancer'],
    correctIndex: 1,
    explanation: 'Separate machines let web and database resources change according to their own load.',
  },
  {
    id: 'q05', stepId: 'split-tiers', difficulty: 'Apply',
    prompt: 'Users, products, and orders require joins. Which default deserves evaluation first?',
    options: ['A relational database', 'A CDN object store', 'A message queue', 'A cache with no persistent store'],
    correctIndex: 0,
    explanation: 'Tables and joins fit related records. Another data model may win after examining real queries and requirements.',
  },
  {
    id: 'q06', stepId: 'scale-web', difficulty: 'Recall',
    prompt: 'Which action is horizontal scaling?',
    options: ['Adding RAM to one server', 'Upgrading one CPU', 'Adding servers to a pool', 'Increasing a cache entry lifetime'],
    correctIndex: 2,
    explanation: 'Horizontal scaling adds machines. Adding resources to one machine is vertical scaling.',
  },
  {
    id: 'q07', stepId: 'scale-web', difficulty: 'Diagnose',
    prompt: 'One of two web servers fails. What should a healthy load-balancer setup do?',
    options: ['Send all requests to the failed server', 'Route new requests to the remaining healthy server', 'Promote a database replica', 'Invalidate the CDN'],
    correctIndex: 1,
    explanation: 'Health-aware routing avoids the failed server, provided the remaining server has enough capacity.',
  },
  {
    id: 'q08', stepId: 'scale-web', difficulty: 'Apply',
    prompt: 'A load balancer is in place, but both web servers are saturated. What increases web capacity?',
    options: ['Add and register more web servers', 'Increase database replica lag', 'Shorten DNS names', 'Remove HTTP responses'],
    correctIndex: 0,
    explanation: 'The balancer can distribute work over more servers once they exist and join its pool.',
  },
  {
    id: 'q09', stepId: 'replication', difficulty: 'Recall',
    prompt: 'In the chapter’s primary/replica model, where do writes go?',
    options: ['Every read replica', 'The primary', 'The CDN', 'The load balancer'],
    correctIndex: 1,
    explanation: 'The primary accepts inserts, updates, and deletes; replicas copy its changes and commonly serve reads.',
  },
  {
    id: 'q10', stepId: 'replication', difficulty: 'Diagnose',
    prompt: 'The primary fails while its best replica is behind. What must failover account for?',
    options: ['Only web-server CPU', 'Potential missing writes and a safe promotion path', 'CDN image versions', 'Queue worker count'],
    correctIndex: 1,
    explanation: 'A lagging replica may lack recently accepted writes. Promotion and recovery need a deliberate procedure.',
  },
  {
    id: 'q11', stepId: 'replication', difficulty: 'Apply',
    prompt: 'Will two extra read replicas directly fix a primary saturated by writes?',
    options: ['Yes, replicas accept half its writes', 'Yes, writes are automatically cached', 'No, writes still reach the primary', 'No, because replicas cannot serve reads'],
    correctIndex: 2,
    explanation: 'Replicas relieve read pressure and support failover, but this model still routes writes to one primary.',
  },
  {
    id: 'q12', stepId: 'cache', difficulty: 'Recall',
    prompt: 'On a cache miss, what should the application normally do?',
    options: ['Return stale data forever', 'Read the persistent store, fill the cache, then respond', 'Delete the database', 'Ask the CDN for the database row'],
    correctIndex: 1,
    explanation: 'The database remains the source of important data. A miss fetches it and warms the cache for later reads.',
  },
  {
    id: 'q13', stepId: 'cache', difficulty: 'Apply',
    prompt: 'Which data is the clearest cache candidate?',
    options: ['A popular product description changed once a week', 'A one-time private token that changes every request', 'The only copy of an order', 'A value that is never read twice'],
    correctIndex: 0,
    explanation: 'Frequent reads and infrequent changes make caching useful while keeping freshness manageable.',
  },
  {
    id: 'q14', stepId: 'cache', difficulty: 'Diagnose',
    prompt: 'The database price changed, but the page shows the old price. What is the likely gap?',
    options: ['The load balancer has no private IP', 'The cached price was not updated or invalidated', 'The queue has too few workers', 'The sharding key is too even'],
    correctIndex: 1,
    explanation: 'Database and cache updates are separate operations. A stale cache entry can survive a database change.',
  },
  {
    id: 'q15', stepId: 'cache', difficulty: 'Diagnose',
    prompt: 'The only cache node restarts. What immediate effect deserves attention?',
    options: ['A burst of database reads', 'Automatic data sharding', 'Faster cache hits', 'DNS selecting another region'],
    correctIndex: 0,
    explanation: 'A cold cache turns former hits into misses, increasing database load until the cache warms again.',
  },
  {
    id: 'q16', stepId: 'cdn', difficulty: 'Recall',
    prompt: 'Which resource best fits the CDN role in this chapter?',
    options: ['A user’s session record', 'A photo file requested worldwide', 'A database write transaction', 'A queue acknowledgment'],
    correctIndex: 1,
    explanation: 'A CDN places reusable static assets near users. Sessions and writes need different infrastructure.',
  },
  {
    id: 'q17', stepId: 'cdn', difficulty: 'Apply',
    prompt: 'A changed logo keeps appearing in its old form. What can force the new asset into use?',
    options: ['Promote a database replica', 'Invalidate the CDN object or change its URL version', 'Add an image-processing worker', 'Enable sticky sessions'],
    correctIndex: 1,
    explanation: 'Invalidation removes the cached object. A new URL identifies a distinct version that the edge must fetch.',
  },
  {
    id: 'q18', stepId: 'cdn', difficulty: 'Diagnose',
    prompt: 'Assets load quickly abroad, but dynamic page data is slow. What should you inspect next?',
    options: ['The application and data path to the distant region', 'Only the CDN logo TTL', 'Only local browser font size', 'The order of cache eviction'],
    correctIndex: 0,
    explanation: 'An edge cache speeds assets, while dynamic requests may still travel to a faraway application or database.',
  },
  {
    id: 'q19', stepId: 'stateless', difficulty: 'Diagnose',
    prompt: 'Login works on Server A but fails on Server B. What is the likely design problem?',
    options: ['Session data is tied to Server A', 'DNS returned an IP address', 'The CDN served an image', 'A replica served a read'],
    correctIndex: 0,
    explanation: 'A server-local session makes the next request depend on landing on the same instance.',
  },
  {
    id: 'q20', stepId: 'stateless', difficulty: 'Apply',
    prompt: 'How do you make web servers easier to add and remove?',
    options: ['Keep each session only in server memory', 'Put sessions in a shared store reachable by every web server', 'Route each user to one permanent server', 'Move CSS into the database'],
    correctIndex: 1,
    explanation: 'Shared state lets any healthy instance serve the next request without depending on a particular machine.',
  },
  {
    id: 'q21', stepId: 'multi-dc', difficulty: 'Diagnose',
    prompt: 'Region A fails; DNS routes users to B, but some records are absent. What was overlooked?',
    options: ['Data synchronization across regions', 'Adding a second CSS file', 'A different load-balancer color', 'An LRU cache policy'],
    correctIndex: 0,
    explanation: 'Routing works only if the healthy region can access the data needed to answer requests.',
  },
  {
    id: 'q22', stepId: 'multi-dc', difficulty: 'Apply',
    prompt: 'What else should be tested before relying on a second region for failover?',
    options: ['Whether it can receive traffic and run the same deployed service', 'Whether every user is sent to the failed region', 'Whether static assets are larger there', 'Whether all logs are deleted nightly'],
    correctIndex: 0,
    explanation: 'The alternate region needs capacity, data, and a consistent working deployment, not merely a DNS entry.',
  },
  {
    id: 'q23', stepId: 'queue', difficulty: 'Apply',
    prompt: 'Image processing makes upload requests wait eight seconds. Which design fits?',
    options: ['Publish a job and let workers process it asynchronously', 'Run the same processing twice in the request', 'Move sessions into the CDN', 'Add read replicas for the image bytes'],
    correctIndex: 0,
    explanation: 'The web tier can accept the upload and enqueue expensive work; workers finish it outside the request path.',
  },
  {
    id: 'q24', stepId: 'queue', difficulty: 'Diagnose',
    prompt: 'Queued jobs get older every minute. What does that signal?',
    options: ['Workers are keeping up', 'Arrival rate exceeds effective processing rate', 'DNS has resolved too quickly', 'The database must be sharded immediately'],
    correctIndex: 1,
    explanation: 'A growing backlog or rising job age means workers are not draining the work as fast as it arrives.',
  },
  {
    id: 'q25', stepId: 'queue', difficulty: 'Apply',
    prompt: 'A worker is briefly offline when a job arrives. Why use a durable queue?',
    options: ['It can retain pending work until a worker returns', 'It makes processing synchronous', 'It replaces every database', 'It guarantees zero duplicate processing'],
    correctIndex: 0,
    explanation: 'A suitably configured durable queue buffers work across a worker outage. Consumers still need sound retry behavior.',
  },
  {
    id: 'q26', stepId: 'observability', difficulty: 'Recall',
    prompt: 'Which is a business metric rather than a host metric?',
    options: ['CPU utilization', 'Disk I/O', 'Daily active users', 'Memory pressure'],
    correctIndex: 2,
    explanation: 'Daily active users describes product use; CPU, disk, and memory describe machine resource usage.',
  },
  {
    id: 'q27', stepId: 'observability', difficulty: 'Apply',
    prompt: 'Traffic doubled, but latency and errors are steady and capacity is ample. What next?',
    options: ['Shard immediately', 'Keep measuring and plan for proven limits', 'Disable all logging', 'Add a region without testing'],
    correctIndex: 1,
    explanation: 'User count alone does not reveal the constrained tier. Watch the workload and change architecture when evidence warrants it.',
  },
  {
    id: 'q28', stepId: 'sharding', difficulty: 'Recall',
    prompt: 'With four shards and `user_id % 4`, where does user 31 belong?',
    options: ['Shard 0', 'Shard 1', 'Shard 2', 'Shard 3'],
    correctIndex: 3,
    explanation: '31 divided by 4 leaves a remainder of 3, so the routing rule chooses shard 3.',
  },
  {
    id: 'q29', stepId: 'sharding', difficulty: 'Diagnose',
    prompt: 'Shards hold similar amounts of data, but one is overwhelmed by reads. Why?',
    options: ['A hot account or key concentrates traffic there', 'Equal storage guarantees equal traffic', 'Replicas cannot copy rows', 'The CDN is too close to users'],
    correctIndex: 0,
    explanation: 'An even row count does not ensure an even request rate. A popular key can create a hotspot.',
  },
  {
    id: 'q30', stepId: 'sharding', difficulty: 'Apply',
    prompt: 'What complication appears when related records live on different shards?',
    options: ['Cross-shard joins and routing become harder', 'DNS stops returning addresses', 'Caches can no longer expire', 'Load balancers stop checking health'],
    correctIndex: 0,
    explanation: 'Queries may need to combine data across machines. Denormalization can help selected reads but creates update work.',
  },
  {
    id: 'q31', stepId: 'synthesis', difficulty: 'Apply',
    prompt: 'Reads are slow because the same stable product details are fetched repeatedly. What is a targeted first improvement?',
    options: ['Cache those details with an appropriate freshness policy', 'Shard every table', 'Move all users to one region', 'Disable monitoring'],
    correctIndex: 0,
    explanation: 'Caching addresses repeated reads directly. Choose an expiration and invalidation plan for product changes.',
  },
  {
    id: 'q32', stepId: 'synthesis', difficulty: 'Diagnose',
    prompt: 'Which statement best captures the chapter’s design method?',
    options: ['Deploy every scaling technique before the first user', 'Measure the current limit, make a targeted change, and inspect its tradeoffs', 'Always scale the database before the web tier', 'Use a CDN to solve every latency problem'],
    correctIndex: 1,
    explanation: 'Scaling is iterative. Each technique solves a specific pressure and introduces a new operational responsibility.',
  },
  {
    id: 'q33', stepId: 'split-tiers', difficulty: 'Apply',
    prompt: 'Which requirement gives you a reason to evaluate a non-relational store?',
    options: ['Records must be joined across many related tables', 'The app stores independent JSON documents with simple lookups at very large volume', 'The team wants to avoid measuring queries', 'The web tier has only one server'],
    correctIndex: 1,
    explanation: 'A document-like access pattern at large scale can favor a non-relational model. Confirm it against real queries and consistency needs.',
  },
  {
    id: 'q34', stepId: 'cache', difficulty: 'Apply',
    prompt: 'A cache should preserve items requested repeatedly over time, even after short quiet periods. Which eviction policy fits best?',
    options: ['Least frequently used', 'First in first out', 'Random removal', 'Delete the whole cache on each write'],
    correctIndex: 0,
    explanation: 'LFU favors historically popular entries. LRU emphasizes recency, while FIFO only considers insertion order.',
  },
  {
    id: 'q35', stepId: 'stateless', difficulty: 'Diagnose',
    prompt: 'Sticky sessions seem to fix login errors, but one web server dies. What weakness returns?',
    options: ['Users bound to that server may lose their locally stored sessions', 'DNS stops resolving every domain', 'All database replicas become primaries', 'The CDN deletes every image'],
    correctIndex: 0,
    explanation: 'Affinity masks server-local state. If that server disappears, its unique sessions disappear or become unreachable.',
  },
];
