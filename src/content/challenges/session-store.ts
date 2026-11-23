import type { DesignChallengeContent } from "../design-challenge";

export const sessionStoreChallenge: DesignChallengeContent = {
  id: "session-store",
  chapterId: "key-value",
  stepId: "kv-operations",
  minutes: 30,
  adaptationTitle: "Log out everywhere",
  title: "Design a session store for a global website",
  summary: "Apply key-value replication to short-lived data where reads dominate and a logout must not be undone by replication.",
  brief: "A global website keeps a session record for each signed-in browser: user ID, roles, and expiry. Every authenticated request reads it. Sessions expire after inactivity, and a logout must take effect in every region within seconds. Losing a session is an annoyance, since the person signs in again; honoring a revoked one is a security problem. Keep password checks, multi-factor login, and account recovery outside this exercise.",
  assumptions: [
    "30 million people sign in each day. Each makes 200 authenticated requests a day, and each request needs its session once. Use decimal units and 86,400 seconds per day.",
    "Peak traffic is 3 times the daily average. There are 3 regions, and the busiest carries 50% of traffic at peak.",
    "Each person creates one session a day, and a session's expiry is refreshed at most once every 10 minutes while in use, about 6 refreshes per person per day. There are 10 million logouts a day.",
    "A session expires 24 hours after its last use, giving about 1.5 live sessions per daily user. A session is 1 KB and a revocation record is 100 bytes. Plan 3 copies in each region. A store node holds 32 GB of session data and serves 100,000 reads per second.",
    "Session checks must finish within 10 ms at p99 in the local region, and the farthest regions are 150 ms apart. A logout must take effect everywhere within 5 seconds in normal operation.",
  ],
  change: "After a password reset or suspected account takeover, security now requires revoking all of a person's sessions in every region within 5 seconds. Most people have one or two sessions, but some have dozens. Sessions are keyed by session ID, so the store cannot list a person's sessions. What do you add, and what does it cost on each request?",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope. Estimate average and peak session checks, the busiest region's peak, peak writes, live-session storage per region with copies, and the size of a day of revocation records. Keep units visible.",
      placeholder: "I would support…\nChecks per second = …\nWrites per second = …\nLive sessions = …\nStorage per region = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores. Trace a sign-in, an authenticated request, and a logout. Choose W and R within a region, and say how data crosses regions.",
      placeholder: "Sign-in: …\nRequest: browser → …\nLogout: …\nWithin a region, W = … and R = …",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Explain what stops a delayed expiry refresh from undoing a logout, and how long deletion records must be kept. If a network partition cuts off a region, say whether it keeps accepting sessions it cannot check, and for how long.",
      placeholder: "A late refresh cannot win because…\nI keep deletion records for…\nDuring a partition, the region…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the log-out-everywhere change below. Name the data you add, what each request now does, and one cost of your approach.",
      placeholder: "I would add…\nEach request now…\nThe cost is…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I separate reads from writes, average from peak, and show that storage with copies, not read rate, sets the node count." },
    { id: "local", title: "Reads stay in the region.", detail: "I explain why a cross-region call on each request breaks the latency target, and I state which replica settings I use locally." },
    { id: "revocation", title: "A logout cannot be undone.", detail: "I explain how revocation beats a delayed refresh under replication, and I keep deletion records at least as long as a session can live." },
    { id: "partition", title: "The partition behavior is a decision.", detail: "I choose what a cut-off region does, accepting either some stale sessions or some wrongly signed-out people, and I bound the exposure." },
    { id: "everywhere", title: "Log out everywhere avoids a scan.", detail: "I add a per-person check or index rather than scanning sessions, and I name its cost on the request path." },
  ],
  estimateGuide: "30 million people × 200 requests = 6 billion session checks/day, about 69,400/s on average and 208,000/s at peak. The busiest region sees half, about 104,000/s. Writes are 30 million × (1 create + 6 refreshes) = 210 million, plus 10 million logouts = 220 million/day, about 2,550/s on average and 7,640/s at peak, or about 27 reads per write. Live sessions are 30 million × 1.5 = 45 million; at 1 KB that is 45 GB per copy, 135 GB per region with 3 copies, and 405 GB across 3 regions. 135 GB ÷ 32 GB is about 4.2, so 5 nodes per region. At 5 nodes, the busiest region handles about 20,800 checks/s per node, or about 41,700 replica reads/s with R = 2, well under the 100,000/s limit, so storage sets the node count here. A day of revocation records is 10 million × 100 bytes = 1 GB, small enough to hold in memory in every region. Sending each write to 2 other regions at peak is about 7,640 × 1 KB × 2 = 15 MB/s, before overhead.",
  solutions: [
    {
      id: "replicated-records",
      title: "Replicated session records with a separate revocation key",
      approach: "Store each session in a key-value store with per-record expiry, such as Cassandra with a time-to-live, with 3 copies in each region and asynchronous replication between regions. Reads and writes use a local quorum (W = R = 2 of 3), so no request waits on another region. Revocation is a separate record, revoked:<session ID>, that is only ever written and never overwritten, and a session check reads both keys.",
      paths: [
        "Sign-in: the local region creates the session with a local quorum and returns an unguessable session ID in a secure cookie. Replication carries it to other regions, usually within a second or so. A request that lands elsewhere before it arrives can retry the region that created it, encoded in the ID.",
        "Request: the app reads the session and its revocation key from local replicas. If a revocation record exists or the session has expired, the request is treated as signed out. A refresh is written at most once every 10 minutes.",
        "Logout: the app writes revoked:<session ID> with a local quorum and a lifetime of 25 hours, an hour past the longest a session can live, so a late refresh cannot outlast it. Replication reaches other regions, and lag is measured against the 5-second target.",
      ],
      failure: "Keeping revocation in its own key means a delayed refresh cannot overwrite it, whatever the timestamps say; under last-write-wins on one record, a late refresh could bring a session back. If a region is cut off, its reads keep working but it stops hearing about logouts. Measure inbound replication lag per region. Past a threshold, such as 30 seconds, accept low-risk requests and send sensitive actions like payments or email changes to a fresh sign-in. If a whole region is lost, its users route to another region where their replicated sessions still work; anyone whose newest session had not replicated signs in again, which is acceptable for this data.",
      adaptation: "Add a per-person record, user-epoch:<user ID>, holding a counter. Each session stores the epoch it was created under, and a check rejects any session with an older epoch. A reset increments the counter and replicates it like a revocation. This needs no list of sessions but adds a third key to each check. At R = 2 that would mean about 125,000 replica reads/s per node at the busiest region's peak, over the limit, so cache the epoch in the app for a second or two, which still meets the 5-second target. Using a counter rather than a timestamp avoids problems with clock skew.",
      tradeoff: "Logout is simple and exact, and sessions can hold more data. Every request depends on the store: two keys at R = 2 mean four replica reads per check, about 83,000/s per node in the busiest region at peak, so this design may need more than the 5 nodes storage alone suggests. The full data set is also copied everywhere, including sessions never used outside the region that created them.",
    },
    {
      id: "signed-tokens",
      title: "Short-lived signed tokens with a pushed revocation list",
      approach: "Keep authoritative sessions in one home region per person, and issue a signed token that lasts 10 minutes. Any region verifies its signature locally with no store read. Each gateway holds an in-memory revocation set, fed by a replicated stream, and entries are kept only as long as a token can live. At peak, 10 minutes of logouts is about 347/s × 600 s = 208,000 entries, or about 21 MB at 100 bytes each.",
      paths: [
        "Sign-in: the home region creates the session record and returns a long-lived refresh cookie and a 10-minute signed token.",
        "Request: the gateway checks the signature and expiry, checks the token's session ID against its in-memory revocation set, and passes the verified claims to the app. No store read occurs. Every 10 minutes the client exchanges the refresh cookie for a new token at the home region, about 180 million exchanges a day, or 2,100/s on average.",
        "Logout: the home region deletes the session so no new token can be issued, then publishes the session ID to a stream replicated to every region. Gateways apply it within seconds, and the entry drops off once the token would have expired.",
      ],
      failure: "A gateway that stops hearing the stream cannot see new logouts, so the stream carries a heartbeat. If a gateway misses it for more than a few seconds, it must choose: keep accepting tokens, which caps exposure at 10 minutes, or treat sensitive actions as signed out until it reconnects. If a home region is down, tokens keep working for up to 10 minutes and then cannot refresh, so people in that region are signed out until it fails over. A compromised signing key is a new, severe failure: rotate keys on a schedule and be able to reject a key ID at once.",
      adaptation: "Publish a per-person entry on the same stream: tokens for this user ID issued under an older epoch are rejected. Tokens carry the user ID and epoch, gateways hold the entry for 10 minutes, and the home region refuses further refreshes. The per-request cost stays one in-memory lookup, and the list stays small because a reset is rare. Using an epoch rather than a time avoids clock skew between regions.",
      tradeoff: "Session checks become almost free and scale with gateways rather than a store, which removes most of the 208,000 reads per second at peak. In exchange, the design adds a stream every gateway must keep up with, signing-key management, and stale claims: a role change waits for the next token unless it is also pushed.",
    },
  ],
};
