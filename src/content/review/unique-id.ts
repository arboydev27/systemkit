import type { ReviewVariation } from "../../lib/review";

export const uniqueIdReview: Record<string, ReviewVariation> = {
  "unique-id/id-contract": {
    prompts: ["A logistics company asks for parcel IDs that have no gaps and always sort by creation time. What would each promise cost?", "A file-sharing site treats knowing a time-based ID as permission to open the file. Why is that a mistake?"],
    answer: "Gap-free numbers must be assigned inside the committing transaction, serializing writes. Always-later ordering needs a shared sequencer, adding a round trip and failure point. Drop promises nobody needs. An ID only names a record: a time-shaped one is no secret, so authorization needs its own check.",
  },
  "unique-id/id-options": {
    prompts: ["A scanner service leases blocks of 3,000 IDs, spending 50 per second. How long can it outlast an allocator outage, and what does leasing cost?", "An analytics startup’s tables and clients all accept 128-bit keys, and rough time order matters. Which generator fits, and what would change your mind?"],
    answer: "At 50 per second a 3,000-ID lease lasts up to a minute, and a crash discards the remainder, leaving gaps. With 128-bit keys allowed, UUIDv7 gives rough time order without coordination. Take a Snowflake-style layout only if compact 64-bit integers are required, accepting worker IDs and clock monitoring.",
  },
  "unique-id/id-layout": {
    prompts: ["A sensor fleet will never exceed 256 workers or 2,048 IDs per millisecond each. How many timestamp bits does a signed 64-bit layout leave?", "A travel site reassigns bits between ID fields while old IDs stay in the same tables. What could go wrong, and what must be kept?"],
    answer: "The sign, 8 worker bits, and 11 sequence bits use 20, leaving 44 timestamp bits, about 8 times a 41-bit span. Widths are a budget, but the layout and epoch become permanent rules: decoding old IDs depends on them, so never change them silently within a shared namespace.",
  },
  "unique-id/id-generate": {
    prompts: ["A coupon service’s ID worker crashes and restarts at once under the same worker ID. Why could it repeat an ID, and what prevents it?", "During a ticket release, one ID worker’s sequence fills every millisecond while others sit idle. What should it do, and what does this suggest?"],
    answer: "Sequence state lives in memory, so a restart within the same millisecond may reuse a value: save the last-issued time, wait past it, or lease a new identity. A full range means waiting for the next millisecond or explicit backpressure, never wrapping. Frequent exhaustion suggests traffic concentrated on few workers.",
  },
  "unique-id/id-clock": {
    prompts: ["A booking site’s ID worker finds its clock reading earlier than its last issued ID. How should the size of that gap change its response?", "A multi-region game logs player actions with time-based IDs. A designer wants replay to reconstruct exact cross-region cause and effect. What do you tell them?"],
    answer: "Never issue at the earlier time, since IDs could repeat. Pause through a tiny rollback; for a long one, stop and alert, costing that worker’s availability, or take a fresh identity. Across regions, clock skew keeps order approximate, so exact order needs a sequencer or ordering protocol.",
  },
  "unique-id/id-workers": {
    prompts: ["An ad platform plans to stop stale ID workers using fencing tokens checked at a storage server. Why will that fail, and what works instead?", "A delivery app’s registry leases worker IDs for 20 seconds. Why should it wait longer than that before giving an expired ID to another worker?"],
    answer: "Generating an ID touches no server, so nothing can reject an old token; the worker must check its lease timer before each ID and stop at expiry. The registry adds a margin before reassigning, covering clock drift and pauses; otherwise two holders could mint identical IDs.",
  },
  "unique-id/id-operate": {
    prompts: ["You have one staging day to show a ride-booking ID service stays unique. Which faults do you inject, and how do you detect duplicates?", "A retail platform moves its ID epoch forward to extend ID lifetime. What goes wrong if new IDs share a namespace with old ones?"],
    answer: "Inject rare events: a backward clock step, restart under the same ID, lease loss, and sequence exhaustion, then load every ID into a uniquely indexed table. Moving the epoch forward shrinks new timestamps, so IDs sort below old ones and can repeat; use versioning or a separate namespace.",
  },
};
