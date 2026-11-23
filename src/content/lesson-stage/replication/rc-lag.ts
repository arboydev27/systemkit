import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Show users their own writes": a user saves a new shipping address from their laptop; the leader commits it at
// position 9,150 at 0.5 s, and the reload at 1 s reads a follower 2 s behind that has applied only up to 9,120, so the old
// address shows and the user retries; the follower applies 9,150 at 2.5 s (eventually consistent, with no promised wait).
// Then replays: the reload routed to the leader (by ownership, or by time for 30 s after a write); a read carrying the
// write's position, which the follower holds until it applies 9,150; and the user's phone, which only gets the position
// when it lives on the server (a control), its read then going to the leader: the cost every fix shares, since reads
// sent back to the leader eat into what followers save. Time in seconds.
export const rcLagStage: StageScene = {
  id: "rc-lag",
  layout: "timeline",
  timeline: { ticks: [0, 1, 2, 3], unit: "s" },
  intro: "Watch a saved address seem to vanish when the reload reads a lagging follower, then replay it with fixes that show users their own writes.",
  metrics: [{ id: "follower", label: "Follower at" }, { id: "from", label: "Read from" }, { id: "shows", label: "Page shows" }],
  nodes: [
    { id: "laptop", role: "client", label: "Laptop", detail: "the user’s browser", at: [0, 0] },
    { id: "follower", role: "database", label: "Follower", detail: "2 s behind", at: [1, 0], opts: { replica: true } },
    { id: "leader", role: "database", label: "Leader", detail: "takes every write", at: [2, 0], opts: { lead: true } },
    { id: "phone", role: "phone", label: "Phone", detail: "same user", at: [3, 0], appear: 6 },
  ],
  links: [],
  steps: [
    {
      title: "The leader commits the new address at 9,150",
      short: "Save",
      text: "The user saves a new shipping address from their laptop. The leader commits it at position 9,150 in its replication log and answers at once. Replication is asynchronous, so the follower, 2 s behind, has applied only up to 9,120.",
      metrics: { follower: 9120 },
      changes: ["+ Leader commits 9,150", "+ Save confirmed"],
      events: [
        { type: "packet", path: ["laptop", "leader"], label: "save address", t: 0, dur: 0.5 },
        { type: "mark", node: "leader", text: "commit 9,150", tone: "work", t: 0.5 },
        { type: "packet", path: ["leader", "laptop"], label: "saved", kind: "response", t: 0.5, dur: 0.5 },
      ],
    },
    {
      title: "A follower 2 s behind shows the old address",
      short: "Stale read",
      text: "The page reloads at 1 s, and the read goes to the follower. It has applied only up to 9,120, so it returns the old address. The user assumes the save failed and tries again.",
      metrics: { from: "Follower", shows: "Old address" },
      changes: ["+ Reload reads the follower", "~ Old address shown", "+ User retries the save"],
      events: [
        { type: "packet", path: ["laptop", "follower"], label: "read address", t: 1, dur: 0.5 },
        { type: "packet", path: ["follower", "laptop"], label: "old address", kind: "hot", t: 1.5, dur: 0.5 },
        { type: "mark", node: "laptop", text: "retries the save", tone: "hot", t: 2 },
      ],
    },
    {
      title: "Copies converge, but with no promised wait",
      short: "Eventually",
      text: "At 2.5 s the follower applies 9,150, 2 s after the commit. Copies converge once writes pause, which is what eventually consistent means, but the wait has no promised length: a load spike can stretch it to minutes.",
      metrics: { follower: 9150 },
      facts: [["Lag", "often milliseconds"], ["Upper limit", "none"]],
      changes: ["+ Follower applies 9,150", "~ Copies agree"],
      events: [
        { type: "packet", path: ["leader", "follower"], label: "9,150", t: 0.5, dur: 2 },
        { type: "mark", node: "follower", text: "applies 9,150", tone: "work", t: 2.5 },
      ],
    },
    {
      title: "Route the user’s own reads to the leader",
      short: "Route to leader",
      text: "Replay it with the reload sent to the leader, which has 9,150, so the new address shows. By ownership, your own profile always comes from the leader; that fails when viewers edit most data. By time, the user’s reads go to the leader for 30 s after a write; that only guesses at lag.",
      focus: ["laptop", "leader"],
      metrics: { follower: 9120, from: "Leader", shows: "New address" },
      facts: [["By ownership", "your own data"], ["By time", "30 s after a write"]],
      changes: ["~ Reload reads the leader", "~ New address shown"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["laptop", "leader"], label: "save address", t: 0, dur: 0.5 },
        { type: "mark", node: "leader", text: "commit 9,150", tone: "work", t: 0.5 },
        { type: "packet", path: ["leader", "laptop"], label: "saved", kind: "response", t: 0.5, dur: 0.5 },
        { type: "packet", path: ["laptop", "leader"], label: "read own address", t: 1, dur: 0.5 },
        { type: "packet", path: ["leader", "laptop"], label: "new address", kind: "response", t: 1.5, dur: 0.5 },
      ],
    },
    {
      title: "The read carries the position 9,150",
      short: "Track position",
      text: "Replay it tracking a position: the save’s reply carries 9,150, and the reload’s read asks for at least 9,150. The follower has only up to 9,120, so it holds the read rather than answer with the old address.",
      metrics: { follower: 9120, from: "Follower", shows: "Waiting" },
      facts: [["Postgres", "LSN"], ["MySQL", "GTID"]],
      changes: ["+ Save returns 9,150", "+ Read needs 9,150", "+ Follower holds the read"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["laptop", "leader"], label: "save address", t: 0, dur: 0.5 },
        { type: "mark", node: "leader", text: "commit 9,150", tone: "work", t: 0.5 },
        { type: "packet", path: ["leader", "laptop"], label: "saved at 9,150", kind: "response", t: 0.5, dur: 0.5 },
        { type: "packet", path: ["laptop", "follower"], label: "read ≥ 9,150", t: 1, dur: 0.5 },
        { type: "span", id: "wait", node: "follower", label: "read waits", tone: "quiet", t: 1.5 },
      ],
    },
    {
      title: "The follower answers once it reaches 9,150",
      short: "Read served",
      text: "At 2.5 s the follower applies 9,150 and answers the waiting read with the new address. A position gives an exact answer where a time window only guesses; when the wait would be long, the read goes to the leader instead.",
      metrics: { follower: 9150, shows: "New address" },
      changes: ["+ Follower applies 9,150", "~ New address shown"],
      events: [
        { type: "packet", path: ["leader", "follower"], label: "9,150", t: 0.5, dur: 2 },
        { type: "mark", node: "follower", text: "applies 9,150", tone: "work", t: 2.5 },
        { type: "span", id: "wait", end: true, t: 2.5, with: true },
        { type: "packet", path: ["follower", "laptop"], label: "new address", kind: "response", t: 2.5, dur: 0.5 },
      ],
    },
    {
      title: "Keep the position on the server",
      short: "Second device",
      text: "Replay it with the user’s phone. If only the laptop’s browser keeps 9,150, the phone’s read carries none and gets the old address. Kept per user on the server, 9,150 reaches every device; the follower is behind, so the read goes to the leader. Every fix sends some reads there, eating into what followers save. Try both.",
      metrics: { follower: 9120 },
      facts: [["In the browser", "that device only"], ["On the server", "every device"], ["Cost", "reads back on the leader"]],
      changes: ["+ The user’s phone", "~ The phone reads the address"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["laptop", "leader"], label: "save address", t: 0, dur: 0.5 },
        { type: "mark", node: "leader", text: "commit 9,150", tone: "work", t: 0.5 },
        { type: "packet", path: ["leader", "laptop"], label: "saved at 9,150", kind: "response", t: 0.5, dur: 0.5 },
      ],
      control: {
        label: "Position kept",
        options: [
          {
            label: "In the browser",
            metrics: { from: "Follower", shows: "Old address" },
            events: [
              { type: "mark", node: "laptop", text: "cookie: 9,150", t: 1 },
              { type: "packet", path: ["phone", "follower"], label: "read address", t: 1, dur: 0.5 },
              { type: "packet", path: ["follower", "phone"], label: "old address", kind: "hot", t: 1.5, dur: 0.5 },
            ],
          },
          {
            label: "On the server",
            metrics: { from: "Leader", shows: "New address" },
            events: [
              { type: "packet", path: ["phone", "leader"], label: "read ≥ 9,150", t: 1, dur: 0.5 },
              { type: "packet", path: ["leader", "phone"], label: "new address", kind: "response", t: 1.5, dur: 0.5 },
            ],
          },
        ],
      },
    },
  ],
};
