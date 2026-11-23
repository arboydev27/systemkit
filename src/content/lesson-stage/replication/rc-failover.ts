import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Replace a failed leader safely": four lifelines, App servers, Leader, Follower and Patroni (the failover
// manager), with the clock left to run and no axis: a 30 s stall drawn to scale would make the scene some sixteen beats
// long and crowd every phone, so the stall's end is told after a rewind and its length lives in the text and facts.
// The Leader leads term 7 and has acknowledged writes up to 5,000 (the "acked 5,000" reply), but replicates
// asynchronously, so the Follower has only 4,992. Patroni hears heartbeats (a span on its own rail, so no message pill
// crosses the Follower's), then the Leader stalls; after 5 s of silence (two and a half beats) Patroni times out (the
// trade in facts: 5 s can fail over on a blip, 60 s means a minute without writes), promotes the most caught-up
// follower in term 8 and points the app servers at it. Their next write takes 4,993, so the 8 acknowledged writes
// 4,993 to 5,000 are missing from the new history (reused IDs: order 88,213 can name another order). After the rewind,
// 30 s after the stall: the Old leader wakes still leading term 7 (its orange span reads "leads t7", as in step 1, kept
// short so the "5,001 · t7" message doesn't cross it on phones) and accepts 5,001 from an app server still connected to
// it (split brain: two leaders); it ships that write stamped term 7, the New leader refuses it (the fence working, so
// blue) and answers with term 8, and the Old leader steps down. Last, it rejoins as a follower, drops everything after
// 4,992 (the 8 acknowledged writes and the stale one: 9 lost) and takes term 8's log from 4,993; Raft (a cut-off
// minority can neither elect nor commit, which ties it to the split brain) and manual failover close the lesson.
// Each telling runs under ten beats (the first to 9.5, the second to 9.75). In the second, "5,001 · t7" leaves at 3
// and "no · t8" at 6, both quick (0.75): leaving at 2.75, the 375 px phone rests "leads t7" over the rail, across the
// incoming write and the accept mark's stem; from 3 it rests under the rail, clear of the 5,001 line. The three messages
// between the two leaders still leave about three beats apart, so where time runs across their pills don't land on one
// another. Notes are avoided: over a middle lifeline's head they cover the tag above it.
export const rcFailoverStage: StageScene = {
  id: "rc-failover",
  layout: "timeline",
  intro: "Watch Patroni replace a stalled leader with a follower 8 writes behind, then see the old leader wake up still sure it leads.",
  metrics: [{ id: "leaders", label: "Leaders" }, { id: "lost", label: "Lost writes" }],
  nodes: [
    { id: "app", role: "web", label: "App servers", detail: "send writes", at: [0, 0], opts: { many: true } },
    { id: "leader", role: "database", label: "Leader", detail: "term 7", at: [1, 0], opts: { lead: true } },
    { id: "follower", role: "database", label: "Follower", detail: "most caught up", at: [2, 0], opts: { replica: true } },
    { id: "patroni", role: "monitor", label: "Patroni", detail: "failover manager", at: [3, 0] },
  ],
  links: [],
  steps: [
    {
      title: "The leader acks writes up to 5,000",
      short: "Acked to 5,000",
      text: "The Leader, in term 7, has acknowledged every write up to position 5,000, so clients saw each one confirmed. It copies writes to the Follower asynchronously, after answering, so the Follower has reached only 4,992.",
      focus: ["app", "leader", "follower"],
      metrics: { leaders: 1, lost: 0 },
      facts: [["Acknowledged", "up to 5,000"], ["Follower has", "up to 4,992"]],
      changes: ["+ Acked up to 5,000", "+ Follower at 4,992"],
      events: [
        { type: "span", id: "t7", node: "leader", label: "leads t7", tone: "work", t: 0 },
        { type: "state", node: "leader", light: "on" },
        { type: "packet", path: ["leader", "app"], label: "acked 5,000", kind: "response", t: 0, dur: 1 },
        { type: "packet", path: ["leader", "follower"], label: "async copy", kind: "quiet", t: 0.5, dur: 1.5 },
        { type: "mark", node: "follower", text: "has 4,992", t: 2 },
      ],
    },
    {
      title: "Heartbeats stop, and Patroni waits 5 s",
      short: "Detect",
      text: "Patroni hears the Leader’s heartbeats until the Leader stalls and they stop. After 5 s of silence it declares the Leader gone; it can’t tell a stall from a crash. This 5 s timeout can fail over on a brief blip; 60 s would mean a minute without writes.",
      focus: ["leader", "patroni"],
      facts: [["5 s timeout", "a blip can fail over"], ["60 s timeout", "a minute without writes"]],
      changes: ["+ Leader stalls", "+ 5 s without a heartbeat", "+ Patroni times out"],
      events: [
        { type: "span", id: "beats", node: "patroni", label: "heartbeats", tone: "work", t: 0 },
        { type: "span", id: "beats", end: true, t: 3 },
        { type: "span", id: "t7", end: true, t: 3, with: true },
        { type: "span", id: "stall", node: "leader", label: "stalled", tone: "hot", t: 3, with: true },
        { type: "state", node: "leader", light: "hot" },
        { type: "span", id: "quiet", node: "patroni", label: "silence", tone: "quiet", t: 3 },
        { type: "span", id: "quiet", end: true, t: 5.5 },
        { type: "mark", node: "patroni", text: "5 s timeout", t: 5.5 },
      ],
    },
    {
      title: "Patroni promotes the follower",
      short: "Promote",
      text: "Patroni promotes the most caught-up follower with a new term, 8, and points the app servers at it. The New leader takes writes from here on. Patroni automates this for Postgres; MongoDB replica sets hold their own elections.",
      focus: ["app", "follower", "patroni"],
      facts: [["New leader", "term 8"], ["Its history", "up to 4,992"]],
      changes: ["+ Follower promoted, term 8", "~ App servers point at it"],
      events: [
        { type: "packet", path: ["patroni", "follower"], label: "promote · t8", t: 6, dur: 1 },
        { type: "packet", path: ["patroni", "app"], label: "new leader", t: 6, dur: 1, with: true },
        { type: "state", node: "follower", label: "New leader", detail: "term 8", light: "work", opts: { lead: true, replica: false } },
        { type: "state", node: "leader", label: "Old leader", detail: "term 7 · stalled" },
        { type: "span", id: "t8", node: "follower", label: "leads t8", tone: "work", t: 7 },
      ],
    },
    {
      title: "8 acknowledged writes are missing",
      short: "8 writes lost",
      text: "The New leader’s history ends at 4,992, so writes 4,993 to 5,000, which clients saw acknowledged, are missing, and the next write takes 4,993. Reused IDs make it worse: order 88,213 can now name a different order than a cache remembers.",
      focus: ["app", "leader", "follower"],
      metrics: { lost: { n: 8, tone: "hot" } },
      facts: [["Missing", "4,993 to 5,000"], ["Order 88,213", "can name another order"]],
      changes: ["+ Next write takes 4,993", "− 8 acknowledged writes"],
      events: [
        { type: "packet", path: ["app", "follower"], label: "write", t: 8, dur: 1 },
        { type: "mark", node: "follower", text: "takes 4,993", tone: "hot", t: 9 },
      ],
    },
    {
      title: "The old leader wakes, still leading",
      short: "Split brain",
      text: "The Old leader wakes 30 s after it stalled. It never saw term 8, so it still believes it leads term 7, and accepts 5,001 from an app server still connected to it. Two nodes now take writes that can’t be merged automatically: split brain.",
      focus: ["app", "leader", "follower"],
      metrics: { leaders: { n: 2, tone: "hot" } },
      facts: [["Stalled for", "30 s"], ["Leading", "term 7 and term 8"]],
      changes: ["+ Old leader wakes", "+ It accepts 5,001", "~ Two leaders"],
      events: [
        { type: "rewind" },
        { type: "state", node: "leader", detail: "woke after 30 s", gap: 160 },
        { type: "span", id: "t8b", node: "follower", label: "leads t8", tone: "work", t: 0, gap: 160 },
        { type: "span", id: "t7b", node: "leader", label: "leads t7", tone: "hot", t: 0, with: true },
        { type: "packet", path: ["app", "leader"], label: "write", t: 1, dur: 1 },
        { type: "mark", node: "leader", text: "accepts 5,001", tone: "hot", t: 2 },
      ],
    },
    {
      title: "Term 8 refuses writes stamped term 7",
      short: "Fenced",
      text: "The Old leader ships 5,001 stamped with its term, 7. The New leader has seen term 8, so it refuses the write and answers with its term, and the Old leader steps down. Fencing works only if something checks: followers, shared storage or a proxy.",
      focus: ["leader", "follower"],
      metrics: { leaders: 1 },
      facts: [["Its write", "7 < 8: refused"], ["Checked by", "followers, storage, proxy"]],
      changes: ["+ Write stamped 7 refused", "~ Old leader steps down"],
      events: [
        { type: "packet", path: ["leader", "follower"], label: "5,001 · t7", kind: "hot", t: 3, dur: 0.75 },
        { type: "mark", node: "follower", text: "refuses: 7 < 8", tone: "work", t: 3.75, dur: 2.25 },
        { type: "packet", path: ["follower", "leader"], label: "no · t8", kind: "response", t: 6, dur: 0.75 },
        { type: "span", id: "t7b", end: true, t: 6.75 },
        { type: "state", node: "leader", light: "idle", detail: "stepped down", opts: { lead: false } },
      ],
    },
    {
      title: "The old leader rejoins and drops 9 writes",
      short: "Rejoin",
      text: "The Old leader rejoins as a follower and drops everything after 4,992, since term 8 took those positions: the 8 acknowledged writes and the one it took while stale. Under Raft, a majority must elect and commit, so a cut-off minority can do neither; some teams keep failover manual.",
      focus: ["leader", "follower"],
      metrics: { lost: { n: 9, tone: "hot" } },
      facts: [["Raft", "a minority can’t elect or commit"], ["Manual failover", "when loss beats downtime"]],
      changes: ["− 4,993 to 5,001 dropped", "~ Old leader follows term 8"],
      events: [
        { type: "mark", node: "leader", text: "drops 4,993–5,001", tone: "hot", t: 7.25, dur: 1.5 },
        { type: "packet", path: ["follower", "leader"], label: "from 4,993", kind: "work", t: 8.75, dur: 1 },
        { type: "state", node: "leader", label: "Follower", detail: "rejoined, term 8", opts: { replica: true } },
      ],
    },
  ],
};
