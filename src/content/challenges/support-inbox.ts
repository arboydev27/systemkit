import type { DesignChallengeContent } from "../design-challenge";

export const supportInboxChallenge: DesignChallengeContent = {
  id: "support-inbox",
  chapterId: "chat",
  stepId: "chat-recovery",
  minutes: 30,
  adaptationTitle: "An outage surge",
  title: "Design a live customer-support inbox",
  summary: "Reuse the chat path for a product where people, not sockets, are the scarce resource, and customers often leave before the reply arrives.",
  brief: "Customers start a chat from a website widget or mobile app. Agents work several conversations at once from a shared inbox. A customer may close the page and come back hours later on another device, and should see the whole thread and hear about replies sent while they were away. Design the first version. Keep bots, voice, file attachments, and reporting outside this exercise.",
  assumptions: [
    "200,000 conversations start per day, averaging 20 messages of 500 bytes each, including metadata. Half of the messages are agent replies. Use decimal units and 86,400 seconds per day.",
    "Peak traffic is 5 times the daily average. A conversation stays active for 30 minutes on average, with its customer connected during that time.",
    "4,000 agents are online at peak, each with one dashboard connection and a limit of 8 conversations at once.",
    "30% of agent replies arrive after the customer has gone offline. Those customers should get an email or push within about a minute, grouped rather than one per message.",
    "Keep history for 2 years. An accepted message must survive a process crash, and two agents must not both believe they own one conversation.",
  ],
  change: "A large customer has an outage, and 50,000 of its users open chats within ten minutes. You cannot add agents quickly. Who waits, in what order, and what do they see? Name what you would protect, and what you would automate or shed.",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and assumptions. Estimate message rates, peak concurrent conversations and connections, agent capacity use, the offline alert rate, and two years of storage. Keep units visible.",
      placeholder: "Messages per second = …\nActive conversations at peak = rate × duration = …\nAgent slots used = …\nOffline alerts per second = …\nStorage = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores. Trace a customer message to an agent, an agent reply to an offline customer, and how a waiting conversation gets assigned to exactly one agent.",
      placeholder: "Customer message: widget → …\nOffline reply: agent → …\nAssignment: waiting conversation → …",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Choose a likely bottleneck and the metric that would prove it. Explain what happens when an agent's laptop dies mid-conversation, and when a connection server or alert worker crashes.",
      placeholder: "I would monitor…\nIf an agent vanishes…\nIf a worker crashes…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the outage surge below. Estimate how long the backlog lasts, then explain what you do about a wait that more machines cannot fix.",
      placeholder: "Customers waiting = …\nThe backlog drains at…\nCustomers see…\nI would protect…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates separate people from machines.", detail: "I show units, derive concurrency from arrival rate and duration, and compare conversations with agent slots as well as with connections." },
    { id: "assignment", title: "One conversation has one owner.", detail: "I use an atomic claim or equivalent, so two agents cannot take one conversation and the limit of 8 holds under concurrency." },
    { id: "offline", title: "Offline customers still get the reply.", detail: "The reply is stored first, a retryable job sends a grouped email or push, and the customer catches up from history on any device." },
    { id: "recovery", title: "Stale ownership is recovered.", detail: "I explain how an agent who vanishes loses their conversations after a defined time, and what the customer sees meanwhile." },
    { id: "surge", title: "The surge plan accepts a human limit.", detail: "I keep customers in a durable queue with honest wait information, and name what I shed or automate, since agent capacity does not autoscale." },
  ],
  estimateGuide: "Messages: 200,000 × 20 = 4 million/day ≈ 46/s average and 231/s at peak. New conversations: 2.3/s average and 11.6/s at peak. Concurrency is arrival rate × duration: 2.31/s × 1,800 s ≈ 4,170 active on average and about 20,800 at peak. Connections at peak: about 20,800 customers plus 4,000 agents ≈ 25,000. Agent capacity: 4,000 × 8 = 32,000 slots, so peak uses about 65%. Offline alerts: 2 million agent replies/day × 30% = 600,000/day ≈ 7/s average and 35/s at peak, before grouping several replies into one alert. Storage: 4 million × 500 B = 2 GB/day, 730 GB/year, and 1.46 TB over 2 years, before indexes and replicas. These rates are modest. Scale is not the hard part here; correct assignment and reliable offline follow-up are.",
  solutions: [
    {
      id: "websocket-routing",
      title: "WebSocket gateways with a separate assignment service",
      approach: "Customers and agents connect through WebSocket gateways. A message service writes to a relational database keyed by conversation and per-conversation sequence. An assignment service owns the waiting queue and agent capacity, with its state in the database. A routing directory in Redis maps each connected device to its gateway, and a notification worker sends email and push.",
      paths: [
        "Customer message: the widget sends text with an idempotency key. The message service commits the row and an outbox entry (a record of work to publish) in one transaction, then acknowledges. A relay publishes the event, and the gateway holding the assigned agent's socket pushes it to the dashboard. With no owner yet, the conversation enters the team's waiting queue.",
        "Assignment: when an agent has a free slot, one transaction raises the agent's count only if it is below 8, and sets the conversation's owner only if it has none. Losing either check means trying the next agent or conversation.",
        "Offline reply: the agent's reply commits as usual. A delayed job checks after 60 seconds whether the customer's read cursor has reached that message. If not, it sends one email or push covering all unread replies, keyed by conversation and last position so a retry cannot send a second. The customer reopens the thread on any device and fetches after their cursor.",
      ],
      failure: "A gateway crash drops sockets; clients reconnect with jitter and fetch after their cursors. An agent's heartbeat lease expires after about two minutes, returning their conversations to the queue with their history, and the customer sees that a new agent is joining. An assignment-service crash loses nothing, because its state is in the database. Monitor waiting-queue age, agent slot use, delivery lag, alert-job age, and reassignment counts.",
      adaptation: "At normal peak, free slots cover about 11,000 of the 50,000, leaving about 39,000 waiting. Slots turn over at about 18 per second and normal arrivals take about 12, so the backlog drains at about 6 per second, close to two hours. More servers do not help. Hold the surge in a durable queue per customer account, and cap that account's share of agents so other customers are still answered. Send an automatic reply naming the known incident, show honest queue information, and let people leave and get an email when an agent answers.",
      tradeoff: "Two-way sockets make instant pickup and typing indicators cheap, and assignment can evolve on its own. The cost is gateways, a routing directory, and an extra service, at request rates a simpler stack could handle.",
    },
    {
      id: "sse-database-queue",
      title: "Server-sent events, plain HTTP, and the database as the queue",
      approach: "Sends are ordinary HTTP POSTs. Live updates flow over server-sent events, which reconnect automatically and report the last event ID. Postgres holds messages, the waiting queue, and alert jobs. Redis pub/sub only wakes the server holding a stream; a lost wake-up is repaired by a periodic check or a reconnect, so Redis holds nothing that must survive.",
      paths: [
        "Customer message: a POST with an idempotency key commits the row and, if needed, a queue entry in one transaction. A Redis publish wakes the server holding the agent's stream, which reads new rows after that stream's cursor and sends them. Each open stream also checks every 30 seconds in case a wake-up was lost.",
        "Assignment: an agent with a free slot asks for work. The API selects the oldest waiting conversation using FOR UPDATE SKIP LOCKED, sets the owner, and raises the agent's count in one transaction, so concurrent agents take different rows.",
        "Offline reply: the reply transaction also inserts an alert job due in 60 seconds, unique per conversation while pending, so a burst of replies becomes one alert. A worker claims due jobs, rechecks the customer's read cursor, and sends the email or push if it is still behind. When the customer returns, a fetch after the saved cursor fills the gap.",
      ],
      failure: "A stream server crash closes its connections; browsers reconnect and resume from the last event ID. A crashed worker's job is retried once its lease expires, and a sent-at record limits duplicate alerts. Agents update a last-seen time through a periodic POST, and a job returns conversations to the queue after two minutes of silence. Browsers allow about six HTTP/1.1 connections per domain, so serve streams over HTTP/2. Watch database CPU and lock waits, queue age, and how many messages arrive through the 30-second check, which reveals lost wake-ups.",
      adaptation: "The numbers are the same: about 39,000 waiting and close to two hours to drain, so the plan again rests on a queue, a per-account cap, an incident auto-reply, and email follow-up. The queue is a table, so extra rows are simple to hold, indexed by team, priority, and age. Compute wait position periodically rather than per request. The risk is shared capacity: 83 new conversations per second, plus reconnects, land on the same database as normal traffic, so benchmark that load and shed polling before message writes.",
      tradeoff: "One database and plain HTTP are easy to operate, debug, and pass through corporate proxies, and these request rates are within reach. The cost is that typing indicators become many POSTs, and messaging, queueing, and alerts share database capacity, so a clear threshold for splitting them out is essential.",
    },
  ],
};
