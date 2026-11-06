import type { DesignChallengeContent } from "../design-challenge";

export const flightAlertsChallenge: DesignChallengeContent = {
  id: "flight-alerts",
  chapterId: "notification",
  stepId: "notification-operations",
  minutes: 30,
  adaptationTitle: "Shared itineraries",
  title: "Design delay and gate-change alerts for an airline",
  summary: "Apply the notification chapter to alerts where one event reaches a whole flight and an old message can send someone to the wrong gate.",
  brief: "An airline’s operations system publishes flight events: a new departure time, a gate change, a cancellation. Each event must alert everyone booked on that flight by push and, for those who opted in, by SMS. Times can change several times in an hour, so an alert that was correct when queued may be wrong by the time it is sent. Keep rebooking, baggage, crew messaging, and marketing outside this exercise.",
  assumptions: [
    "The airline runs 3,000 flights a day with 200 booked passengers on average. One flight in three changes, with an average of 3 events each. Use decimal units and 86,400 seconds per day.",
    "80% of passengers receive push and 30% have opted in to SMS; some receive both. SMS costs an example $0.01 per message.",
    "In a storm, 300 flights each produce 2 events within 10 minutes. The SMS account accepts at most 50 messages per second. Assume push capacity is not the constraint at this volume.",
    "Target: 95% of alerts reach the provider within 60 seconds of the event. An alert superseded by a newer event for the same flight must not be sent if it has not already gone out.",
    "Keep a timeline for each send for 30 days: 5 state records per send, at 200 bytes per record.",
  ],
  change: "The airline lets passengers share a flight with the person collecting them. On average each booked passenger adds 1 follower, reached only by SMS and often with no airline account. What changes in recipient resolution, consent, SMS capacity, and cost?",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and what “delivered” means for an alert. Estimate daily and storm send rates by channel, the SMS backlog against the account limit, daily SMS cost, and 30 days of timeline storage. Keep units visible.",
      placeholder: "I would support…\nStorm alerts per second = …\nSMS backlog after 10 minutes = …\nTimeline storage for 30 days = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores or decides. Trace one gate change from the operations event to a push and an SMS, including where the passenger list is read and where a newer event can stop an older alert.",
      placeholder: "Event: operations feed → …\nFanout: …\nSend: …\nA newer event stops an older alert at…",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Pick the first bottleneck in a storm and the metric that would show it. Explain what happens if a worker crashes after the SMS provider accepts a message, and how you stop a stale gate from being sent or retried.",
      placeholder: "The first bottleneck is…\nI would watch…\nIf a worker crashes after acceptance…\nA stale alert is stopped by…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the shared-itinerary change below. Explain how people without accounts give and withdraw consent, what the new recipients do to SMS capacity and cost, and one thing you would give up.",
      placeholder: "A follower opts in by…\nStorm SMS demand becomes…\nDaily SMS cost becomes…\nI would give up…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I show units, separate the daily average from the storm peak, and compare SMS demand with the account limit." },
    { id: "fanout", title: "One event fans out durably.", detail: "I explain how one flight event becomes per-passenger attempts, where the passenger list comes from, and what survives a crash partway through." },
    { id: "staleness", title: "Stale alerts are stopped.", detail: "I name the version check or equivalent, where it runs, and what happens to an alert superseded while it is queued or being retried." },
    { id: "promise", title: "Delivery claims are honest.", detail: "I separate provider acceptance from a passenger seeing the alert, and I say how a retry can still produce a duplicate." },
    { id: "consent", title: "The change has a consent and cost answer.", detail: "I explain opt-in and opt-out for people without accounts, and I work out the effect on SMS rate and spend." },
  ],
  estimateGuide: "Daily: 3,000 flights ÷ 3 = 1,000 changed flights × 3 events = 3,000 events. 3,000 events × 200 passengers = 600,000 passenger alerts a day, about 6.9 per second on average. Push: 600,000 × 0.8 = 480,000 a day. SMS: 600,000 × 0.3 = 180,000 a day, or $1,800 a day at the example price. Total: 660,000 sends a day. Storm: 300 flights × 2 events × 200 passengers = 120,000 passenger alerts in 600 seconds = 200 per second, about 29 times the daily average. That is 160 push and 60 SMS per second. SMS arrives 10 per second faster than the limit of 50, so the backlog reaches 10 × 600 = 6,000 messages and the last one waits 6,000 ÷ 50 = 120 seconds, twice the target. Waiting passes 60 seconds at a backlog of 3,000, which is 300 seconds into the storm. Timelines: 660,000 sends × 5 records × 200 bytes = 660 MB a day, or 19.8 GB for 30 days.",
  solutions: [
    {
      id: "version-check",
      title: "Per-passenger attempts with a version check at send",
      approach: "Fan each event out to one attempt per passenger and channel, as the chapter does, and give every attempt the flight version it was created for. A worker reads the flight’s current version immediately before calling a provider and discards anything out of date. Separate push and SMS queues keep the slower SMS path from holding up push.",
      paths: [
        "Event: the operations feed delivers a gate change with a flight ID and version number. In one transaction the service stores it as the flight’s current state and adds an outbox row, ignoring any event older than the stored version. A dispatcher publishes the row to a fanout queue.",
        "Fanout: a worker reads the flight’s bookings in pages, checks each passenger’s current consent, and writes attempts keyed by flight, version, passenger, and channel. A crash partway through re-runs the job, and the unique key makes repeats harmless.",
        "Send: a worker takes an attempt, reads the flight’s current version, and marks the attempt superseded if a newer one exists. Otherwise it calls the provider and records the result. Push messages carry a collapse ID per flight, so a newer alert replaces an older one on the device, and a short expiry, so a phone that returns hours later does not show an old gate.",
      ],
      failure: "If the SMS provider slows, the SMS queue ages while push continues. Expect up to 6,000 queued messages in a storm and a 120-second wait, so alert on queue age by channel rather than depth. A worker crash after provider acceptance can still send a duplicate, because the version is still current; say so plainly. If the version read fails, hold the attempt rather than send it, since a wrong gate is worse than a late one. Drop any attempt whose flight has already departed. Also watch event-to-provider time and the share of attempts marked superseded.",
      adaptation: "Followers add another 120,000 SMS alerts to a storm, or 200 per second, for 260 per second against a limit of 50. Put them in a lower-priority SMS lane so passengers go first, and limit them to gate changes and cancellations. A follower opts in by opening the passenger’s share link, entering their own number, and confirming a code; store consent per phone number and flight, honor a STOP reply, and end it when the flight lands. Daily SMS spend rises from $1,800 to as much as $7,800 at the example price, so measure real sharing before buying more throughput.",
      tradeoff: "Every passenger and version has its own attempt and audit trail, which makes support questions easy to answer. In a storm the system creates attempts only to discard them, and each send adds a version read.",
    },
    {
      id: "latest-state",
      title: "Latest state per flight, with coalesced sends",
      approach: "Treat a flight’s alert as state rather than a stream of messages. Store only the newest version for each flight, mark the flight as needing an alert, and wait a short settling period before creating attempts. Changes that arrive inside the period merge into one alert, so passengers get the current answer and fewer messages.",
      paths: [
        "Event: the service stores the flight’s newest state and version and marks the flight dirty in one transaction. A second event during the settling period updates the state and adds no work.",
        "Release: after an example 20 seconds, or at once for a cancellation or a gate change near departure, a dispatcher claims the flight with a lease, reads the current version and bookings, and writes attempts. It clears the dirty mark only if the version has not moved; otherwise the flight stays dirty and is released again.",
        "Send: workers call providers as usual, and a last-notified version per passenger and flight stops an older version from going out and lets a repeated job skip people already covered.",
      ],
      failure: "A crashed dispatcher loses its lease and another one resumes, with attempt keys preventing a second logical send. If both storm events for a flight land inside the settling period, SMS demand falls from 60 to 30 per second, under the limit. If they land further apart, nothing merges and the 120-second wait returns, so measure how events actually cluster. A flight stuck dirty fails silently, so alert on the age of the oldest dirty flight. A retried provider call can still duplicate a message.",
      adaptation: "Followers become extra recipient rows on the flight, with their own consent records, and are released after the passenger batch. If both storm events merge, follower SMS falls from 200 to 100 per second, for 130 per second in total against a limit of 50, so the design still needs a longer follower target or more throughput. Consent works as in any design: opt-in through the share link, a STOP keyword, and an end date at landing. Spend rises by up to $6,000 a day at the example price, less whatever coalescing removes.",
      tradeoff: "Storms produce less work and fewer contradictory messages. In exchange, routine alerts carry the settling delay, a period set too long can breach the 60-second target on its own, and a passenger’s timeline no longer shows interim states they never received. The product has to agree that those states are not worth sending.",
    },
  ],
};
