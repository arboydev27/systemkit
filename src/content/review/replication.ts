import type { ReviewVariation } from "../../lib/review";

export const replicationReview: Record<string, ReviewVariation> = {
  "replication/rc-leader": {
    prompts: ["A game-save service acknowledges each write right after the leader’s own commit. What does that buy, and what can a leader crash cost players?", "A tax-filing service waits for any one follower before acknowledging and assumes no confirmed return can be lost. What could still lose one?"],
    answer: "Asynchronous acknowledgment adds no follower wait, but anything unshipped dies with a crashed leader. Waiting for one follower keeps a second copy at about the nearest follower’s delay, yet the write is lost if both fail, and MySQL’s mode can quietly revert to asynchronous when a timeout expires.",
  },
  "replication/rc-lag": {
    prompts: ["After editing a recipe, an author reloads and sees the old text. What guarantee is missing, and what does it say about other readers?", "On a wiki, any reader can edit any page. How would you route reads so editors see their own changes, and at what cost?"],
    answer: "Read-your-writes means users see their own committed changes, with no promise about anyone else’s. Ownership routing fails when viewers can edit most data, and a time window cannot measure lag. Track each user’s log position on the server; reads then wait or use the leader, giving back some replica savings.",
  },
  "replication/rc-order": {
    prompts: ["A stock-price reader never writes, yet one refresh shows an older price than the last. Why, and what fixes it?", "With auction listings and bids on separate shards, viewers sometimes see a bid on a listing that doesn’t exist yet. Why, and what fixes it?"],
    answer: "Followers lag differently, so a reader bouncing between them can go backward. Monotonic reads fix that by hashing each reader to one follower, until it fails. Shards have separate logs, so an effect can precede its cause. Key related writes to one shard, or hold events until causes are visible.",
  },
  "replication/rc-failover": {
    prompts: ["A ride-booking database promotes an asynchronous follower after its leader dies. What can happen to just-confirmed rides, and to the old leader’s extra writes?", "A forum’s database leader was only frozen, not dead, and wakes after a replacement took over. What can go wrong, and what stops it?"],
    answer: "Promotion can lose acknowledged writes the follower never received, and the old leader’s extra writes usually get discarded. A leader that merely stalled may still accept writes, causing split brain. Fencing stops it: each leadership gets a higher term, and followers, storage, or a proxy reject older ones.",
  },
  "replication/rc-multi": {
    prompts: ["A car-sharing company runs a leader per continent, and one vehicle gets rented twice. Why did both rentals succeed, and what design prevents it?", "A shared-playlist app merges regional edits with last-write-wins. Replicas always match, yet users complain of missing changes. What is happening, and what are the alternatives?"],
    answer: "Each leader commits and confirms before hearing of the other’s write, so the conflict surfaces after both were told yes. Only a home region per record can enforce a one-winner rule. Last-write-wins makes replicas match by silently discarding a write; CRDTs merge some structures, or the application can keep both versions.",
  },
  "replication/rc-leaderless": {
    prompts: ["A leaderless store keeps 5 copies and waits for 3 replicas on each read and write. Two die. What happens now, and when they return?", "A gym-membership system needs unique member emails, and a team proposes leaderless storage to avoid failover. What would you tell them?"],
    answer: "While enough replicas remain for each quorum, here three of five, requests carry on with nobody promoted, and returning nodes are repaired later. But quorums give no single order, so uniqueness checks and transactions do not come naturally. Choose a single leader when one of two concurrent writes must fail.",
  },
};
