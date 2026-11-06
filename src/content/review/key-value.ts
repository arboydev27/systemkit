import type { ReviewVariation } from "../../lib/review";

export const keyValueReview: Record<string, ReviewVariation> = {
  "key-value/kv-contract": {
    prompts: ["A team building a feature-flag store says the API is just get and put. What promises still need agreeing before any design work?", "A small museum’s ticket scanner looks up QR codes by key. When should it stop relying on one machine with a standby?"],
    answer: "Agree on key and value sizes, volume, read/write mix, latency, availability, durability of acknowledged writes, and whether reads must see the latest write. One machine with a standby often suffices until the data outgrows it or a failure promise demands more.",
  },
  "key-value/kv-partition": {
    prompts: ["A sensor platform stores readings under keys that begin with a timestamp and often scans a time span. How do hash and range partitioning compare?", "After splitting a recipe site’s data across five machines, one disk dies and some recipes are simply gone. What had the team misunderstood?"],
    answer: "Partitioning gives each key one home, so it spreads data but makes no safety copy; that takes replication. Hash placement balances ranges but scatters neighboring keys, hurting scans. Range placement keeps scans cheap, yet sequential keys such as timestamps pile onto one hot spot.",
  },
  "key-value/kv-replication": {
    prompts: ["A thumbnail service can regenerate any image from its original. Should it keep three copies of each thumbnail? What do extra copies cost?", "An insurance-claims store runs N = 3 and needs two write acknowledgments. One rack outage makes writes fail for only some keys. What explains it?"],
    answer: "Some keys likely had two copies in that rack, leaving one reachable copy, below the two required. Count independent physical copies and spread them across failure domains. Copies multiply stored bytes and writes, so data you can regenerate may need just one.",
  },
  "key-value/kv-quorum": {
    prompts: ["A leaderboard with N = 7 must keep accepting writes with three replicas down. Which W allows that, and what R then overlaps it?", "A concert-ticket team assumes W + R > N means once one buyer sees an update, later buyers never see older data. What is wrong?"],
    answer: "For N = 7 with three down, W can be at most 4, so overlap needs R of at least 4. Waiting for more replicas costs latency and availability. Overlap covers only acknowledged writes: an unfinished write on one replica can show new then old, which is not linearizable.",
  },
  "key-value/kv-conflicts": {
    prompts: ["A shared-notes app resolves simultaneous saves by keeping the highest timestamp. What can that lose, and what other policies could it use?", "A vector clock shows two versions of a shared calendar event are concurrent. Why can’t the clock alone say which to keep?"],
    answer: "The highest timestamp discards an accepted update, especially when clocks disagree. Compare-and-set rejects stale edits, and siblings keep both values for the application. A vector clock only reveals that neither version includes the other; deciding the outcome takes a domain rule, and even a plain union can revive removed items.",
  },
  "key-value/kv-failure": {
    prompts: ["A school-grades system must show every acknowledged write on every read. Should it allow sloppy quorums during outages, and what does it give up?", "A photo-sharing app acknowledged a caption edit during a replica outage. Right after recovery, a read shows the old caption. How could that happen?"],
    answer: "A sloppy quorum counts a substitute holding a tagged hint, so writes succeed during an outage. A read reaching the recovered owner before handoff sees old data, and hints can expire. If reads must see every acknowledged write, disable it and accept failed writes during outages.",
  },
  "key-value/kv-repair": {
    prompts: ["Comparing two mailbox replicas key by key would flood the network. How can they find their differences cheaply, and when does that stop helping?", "A forum’s store handles delete by erasing the key immediately. Why might background repair bring the post back, and what prevents it?"],
    answer: "A Merkle tree hashes key ranges upward, so replicas compare roots and follow only differing branches; scattered differences erode the saving. Without a retained tombstone, a replica that missed the delete looks like it has new data and repair copies it back. Keeping tombstones costs disk and read speed.",
  },
  "key-value/kv-paths": {
    prompts: ["A booking store’s replica kept acknowledged writes through a process crash but lost some in a power cut. What explains the difference?", "A game’s profile store does many lookups for players with no saved data, each touching many disk files. What reduces that, and what stays uncertain?"],
    answer: "A process crash spares the page cache, but a power cut loses anything not fsynced to the log, so batched fsync leaves a window. A per-table Bloom filter lets reads skip tables that definitely lack the key; a maybe still needs a real lookup that may find nothing.",
  },
  "key-value/kv-operations": {
    prompts: ["A podcast app’s latency charts stay green, yet a replica may have stopped converging. How would you measure freshness directly?", "A platform team wants one consistency setting for both cached recommendations and pharmacy refill limits. What would you argue?"],
    answer: "Green latency can hide a replica that has not converged, so write a canary key regularly and read it back from each replica. Tie consistency to product invariants: low-risk cached values can accept eventual convergence, while a hard business limit needs stronger coordination. Verify each policy during failure drills.",
  },
};
