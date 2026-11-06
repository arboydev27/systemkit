import { flowLesson } from "./flow-lesson";

export const replicationTeachingContent = {
  "rc-leader": flowLesson("rc-leader", {
    kind: "flow",
    semanticIds: ["client-write", "leader-commit", "first-follower-ack", "all-followers-ack"],
    points: [
      { title: "One node orders every write", description: "Only the leader accepts writes, so followers can apply them in a single order.", items: [0, 1] },
      { title: "Earlier acks are faster but riskier", description: "Answering after the local commit is quick, but a crash loses whatever has not shipped.", items: [1, 2] },
      { title: "Later acks are safer but slower", description: "Waiting for all followers protects the write, but one stalled follower then stalls every commit.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A leader waits for any one of two followers: one 1 ms away, one 90 ms away. The near follower dies. What happens to commits?",
      options: [
        "They stay as fast as before, as the leader stops waiting",
        "They stop until the near follower comes back",
        "Each now waits about 90 ms for the far follower",
        "Each now waits about 91 ms, the sum of both trips",
      ],
      correctIndex: 2,
      explanation: "Any one confirmation is enough, and only the far follower can now give it, so commits slow down rather than stop. The margin is gone, so one more failure would leave the leader with no follower to wait for.",
      items: [1, 2],
    },
  }),
  "rc-lag": flowLesson("rc-lag", {
    kind: "flow",
    semanticIds: ["leader-commit", "keep-position", "follower-read", "wait-or-leader"],
    points: [
      { title: "A write has a position", description: "The commit gets a place in the replication log, and the server remembers it for that user.", items: [0, 1] },
      { title: "The read compares positions", description: "A follower at 9,120 has not applied a write at 9,150, so it must not answer yet.", items: [1, 2, 3] },
    ],
    prediction: {
      prompt: "A user’s last write is at position 9,150. Follower A has applied 9,149 and follower B has applied 9,151. Where can their read go?",
      options: [
        "To A, since one position behind is close enough",
        "To either one, since the difference is so small",
        "To B or the leader, while A would have to wait",
        "To the leader only, since positions rule out followers",
      ],
      correctIndex: 2,
      explanation: "B has applied the user’s write, so it is safe to read from. A has not, however small the gap is. Only a follower at or past the position can answer.",
      items: [2, 3],
    },
  }),
  "rc-order": flowLesson("rc-order", {
    kind: "comparison",
    semanticIds: ["backward-read", "pin-reader", "effect-before-cause", "shared-log"],
    points: [
      { title: "Lag differences move time backward", description: "A reader who hits a fresher follower and then a staler one sees data disappear.", items: [0, 1] },
      { title: "Separate logs have no shared order", description: "Two shards can lag by different amounts, so an effect can be visible before its cause.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A news site pins each reader to one follower by hashing their ID. Two readers compare pages at the same moment. What can still differ?",
      options: [
        "One reader’s page can move back to older stories",
        "Each can see a different amount of recent news",
        "Each can see stories in an order no writer produced",
        "Nothing, because pinning makes all followers agree",
      ],
      correctIndex: 1,
      explanation: "Pinning gives each reader a steady view, not a shared one. Two readers on different followers can see different amounts of lag, while neither view moves backward.",
      items: [0, 1],
    },
  }),
  "rc-failover": flowLesson("rc-failover", {
    kind: "flow",
    semanticIds: ["detect-failure", "promote-follower", "fence-old-leader", "redirect-clients"],
    points: [
      { title: "Detection is a timeout", description: "A short timeout risks a needless failover, and a long one extends a real outage.", items: [0, 1] },
      { title: "The new term shuts out the old leader", description: "Whatever checks writes refuses term 7 once term 8 exists, so a stale leader’s writes do not take effect.", items: [1, 2] },
      { title: "Clients move last", description: "Writes then flow to the new leader, whose history may lack what the old one never shipped.", items: [2, 3] },
    ],
    prediction: {
      prompt: "Some clients keep the old leader’s address for 20 seconds after it has been fenced. What happens to their writes in that time?",
      options: [
        "They fail, and clients retry once they learn the new leader",
        "They commit on the old leader and get merged in afterward",
        "They wait in a follower’s queue for the new leader to apply",
        "They commit on both leaders, with term numbers to order them",
      ],
      correctIndex: 0,
      explanation: "A fenced node cannot make writes take effect, so those requests fail. Clients need retry logic, but an error is far easier to handle than two diverging histories.",
      items: [2, 3],
    },
  }),
  "rc-multi": flowLesson("rc-multi", {
    kind: "comparison",
    semanticIds: ["home-region", "last-write-wins", "automatic-merge", "keep-versions"],
    points: [
      { title: "Avoid the conflict first", description: "A home region sends all of a record’s writes to one leader, so no conflict arises while it is up.", items: [0] },
      { title: "Or settle it after the fact", description: "Last-write-wins drops a write, merging needs a suitable data type, and keeping versions hands the choice to the app.", items: [1, 2, 3] },
    ],
    prediction: {
      prompt: "User preferences use a home-region policy. A user’s home region goes offline and the other region stays up. What must you decide?",
      options: [
        "Whether last-write-wins should replace the home-region policy for good",
        "Whether to re-home the user, risking conflicts when it returns",
        "Whether to convert all preferences into CRDTs straight away",
        "Nothing, since the policy rules out conflicts in every case",
      ],
      correctIndex: 1,
      explanation: "A home region avoids conflicts only while it can take writes. To keep this user writable you must move their home, and unreplicated writes in the old region can conflict when it returns. The alternative is refusing their writes during the outage.",
      items: [0],
    },
  }),
  "rc-leaderless": flowLesson("rc-leaderless", {
    kind: "comparison",
    semanticIds: ["seat-reservations", "offline-notes", "regional-profiles", "sensor-readings"],
    points: [
      { title: "One write must be refused", description: "A seat cannot be sold twice, so one leader decides, which makes this the default model.", items: [0] },
      { title: "Writers are in separate places", description: "Devices and regions write independently, and conflicts are merged or avoided by a home region.", items: [1, 2] },
      { title: "Writes must never pause", description: "Unique keys cannot conflict, so a leaderless store can keep ingesting through a node failure.", items: [3] },
    ],
    prediction: {
      prompt: "Which of these new workloads belongs with seat reservations rather than sensor readings?",
      options: [
        "Click events keyed by a unique random ID",
        "Device heartbeats that update a last-seen time",
        "Coupon codes that can be redeemed once",
        "Server logs stored by host and timestamp",
      ],
      correctIndex: 2,
      explanation: "A coupon redeemed twice is the same problem as a seat sold twice: one of two concurrent writes must be refused. The others either cannot conflict or lose little if one write wins.",
      items: [0, 3],
    },
  }),
};
