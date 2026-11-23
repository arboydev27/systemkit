import type { ReviewVariation } from "../../lib/review";

export const consensusReview: Record<string, ReviewVariation> = {
  "consensus/cs-linearizability": {
    prompts: ["A bike-rental app considers linearizable reads for everything: ride history, bike unlock status, and station photos. Which deserve it, and what does it cost?", "A parking-permit store claims to be linearizable because followers always catch up within a few milliseconds. Why is that claim wrong?"],
    answer: "A linearizable store behaves like one copy: after a write finishes, any later read must see it, so even brief follower lag breaks the promise. The price is added round trips, plus refusals when no majority is reachable. Spend it where staleness does harm, like unlock status, not history or photos.",
  },
  "consensus/cs-cap": {
    prompts: ["A bank’s regional site loses contact with its leader. What should that site do for transfers, and for showing statement history?", "A majority-based store keeps serving most clients during a partition, so its vendor calls it available. How does CAP’s definition disagree?"],
    answer: "Partitions will happen; the real choice is how a cut-off node behaves: refuse and stay linearizable, or answer and risk staleness. CAP availability demands a reply from every working node, so majority systems lack it. This can vary per operation: refuse transfers, serve slightly stale history.",
  },
  "consensus/cs-ordering": {
    prompts: ["Two inventory servers compare wall-clock timestamps to decide which stock adjustment came first. Why is this unsafe even with NTP, and what can replace it?", "Two warehouse robots report events with Lamport stamps 15 and 20. What can you conclude about whether one caused the other, and what can’t you?"],
    answer: "Clocks drift and NTP can jump them, so an earlier event on a fast clock can outrank a later one. Lamport counters passed with messages give a cause the lower stamp. The reverse fails: a lower stamp alone cannot show causation, and detecting concurrency takes version vectors.",
  },
  "consensus/cs-fencing": {
    prompts: ["A billing job’s lease keeps one runner active. A teammate wants a far longer lease to prevent double runs. Why won’t that work?", "A backup coordinator may freeze mid-job and wake up after losing its lease. Where must the stale-write check live, and why there?"],
    answer: "A process can freeze between check and write, so no lease length or last-moment check helps, and longer leases only slow failover. Each grant carries a rising fencing token, and the resource rejects anything below the highest seen. If a resource cannot compare tokens, use an idempotency key instead.",
  },
  "consensus/cs-raft": {
    prompts: ["A config store runs Raft on nine nodes. How many must hold an entry before it is committed, and why does it survive elections?", "A metadata service’s Raft group is slow on writes, so a team adds four more nodes. What should they expect?"],
    answer: "Five of nine: a majority makes an entry safe, because any later majority overlaps it and those voters reject candidates with older logs. Extra nodes add fault tolerance, not write throughput, since each write still needs a majority round trip plus a disk flush. An even size adds no tolerance.",
  },
  "consensus/cs-2pc": {
    prompts: ["A travel site must commit a flight and a hotel booking across two databases together. What is the main risk of two-phase commit here?", "A startup needs one active report sender and already relies on one Postgres primary. Where would you keep leadership, and what do you accept?"],
    answer: "After voting yes, a participant must wait for the coordinator, so a crash leaves locks held, and one unreachable participant blocks commit; consensus needs only a majority. For small coordination data, a leases table carrying a token column can suffice, accepting downtime with the primary. Avoid homemade consensus.",
  },
};
