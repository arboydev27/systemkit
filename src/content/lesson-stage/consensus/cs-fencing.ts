import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Survive a leader that wakes up late": a timeline from 0 to 25 s with four lifelines, P1, Lease service,
// Storage and P2, so the grants and P2's write go between neighbours and only P2's grant and P1's late write cross one
// rail each. The lease service grants P1 a 10-second lease at t=0; at t=8 P1 checks it and sees 2 s left (the mark sits
// on the lease's lifeline: on P1's it would share t=8 with the pause's label and be pushed far off on a 375 phone), then
// freezes for 15 s (a garbage-collection pause, t=8 to 23). The lease expires at t=10 (its span ends there, the meter's
// flag stands up and a note says so; a mark there would crowd t=8 to 10 on a phone), P2 gets it at t=11 (arriving t=13)
// and its write reaches Storage at t=16. P1 wakes at t=23 still trusting its check and writes too (arriving t=26): two
// leaders wrote. P1 keeps its leader's flag throughout, as cs-raft's stale leader does: it believes it leads (step 3's
// text says so, where both flags first fly). Replayed
// with fencing, the grants carry tokens 71 and 72; next P2's write carries 72 and Storage keeps it as the highest it has
// seen (a step of its own, so the replay doesn't run ten seconds); then P1's late write with 71 is refused (blue: the
// protection working). Last, the cost: the resource has to keep and compare tokens; a third-party API gets an
// idempotency key instead. Messages take 3 s on the drawing (P2's grant 2 s), so the 26 s run is about eight beats.
// Storage's marks move the clock 0.4 s on, so the now line doesn't pin them to their dots (the clock still reads 16 and
// 26). A `state` never runs `with` a mark, span or message here: the engine would undo it once that item finished. The
// replay retells what steps 1 to 3 showed, so its states follow 60 ms after their item and its items 120 to 160 ms after
// the one before (the default is 320): it plays in about 8 s, of which the rewind's clearing takes 1.5.
export const csFencingStage: StageScene = {
  id: "cs-fencing",
  layout: "timeline",
  timeline: { ticks: [0, 5, 10, 15, 20, 25], unit: "s" },
  intro: "Watch a leader freeze past its lease’s expiry and wake up still writing, then replay it with a token that Storage checks.",
  metrics: [
    { id: "time", label: "Time", derive: { clock: true } },
    { id: "holder", label: "Lease holder" },
    { id: "wrote", label: "Leaders wrote" },
  ],
  nodes: [
    { id: "p1", role: "worker", label: "P1", detail: "leads first", at: [0, 0] },
    { id: "lease", role: "lease", label: "Lease service", detail: "backed by a majority", at: [1, 0], opts: { level: 0 } },
    { id: "storage", role: "database", label: "Storage", detail: "takes the writes", at: [2, 0] },
    { id: "p2", role: "worker", label: "P2", detail: "takes over", at: [3, 0] },
  ],
  links: [],
  steps: [
    {
      title: "P1 takes a 10-second lease",
      short: "P1 leads",
      text: "Only one process should run this job, so P1 takes a lease from the lease service: 10 seconds as leader unless it renews. At t=8 it checks the lease, sees 2 seconds left, and goes to write.",
      focus: ["p1", "lease"],
      metrics: { holder: "P1", wrote: 0 },
      facts: [["Lease", "10 s"], ["Left at t=8", "2 s"]],
      changes: ["+ P1’s 10 s lease", "+ P1 leads", "+ Check at t=8: 2 s left"],
      events: [
        { type: "packet", path: ["lease", "p1"], label: "lease · 10 s", kind: "response", t: 0, dur: 3 },
        { type: "span", id: "l1", node: "lease", label: "P1’s lease", tone: "work", t: 0, with: true },
        { type: "state", node: "lease", opts: { level: 1 } },
        { type: "state", node: "p1", light: "on", opts: { lead: true } },
        { type: "mark", node: "lease", text: "2 s left", t: 8, dur: 0.4 },
        { type: "state", node: "lease", opts: { level: 0.2 } },
      ],
    },
    {
      title: "P1 freezes and its lease runs out",
      short: "P1 freezes",
      text: "Right after its check, P1 freezes for 15 seconds: a garbage-collection pause stops it between two instructions, and it can’t notice. At t=10 its lease expires, as it must, so a crashed holder can’t block everyone forever.",
      focus: ["p1", "lease"],
      metrics: { holder: "none" },
      facts: [["P1 frozen", "t=8 to 23"], ["Lease expires", "t=10"]],
      changes: ["+ P1 frozen at t=8", "− P1’s lease at t=10"],
      events: [
        { type: "span", id: "pause", node: "p1", label: "GC pause", tone: "hot", t: 8 },
        { type: "state", node: "p1", light: "hot" },
        { type: "span", id: "l1", end: true, t: 10 },
        { type: "state", node: "lease", opts: { level: 0 } },
        { type: "note", node: "lease", text: "expired at t=10" },
      ],
    },
    {
      title: "P2 takes the lease and writes",
      short: "P2 takes over",
      text: "At t=11 the lease service grants the lease to P2, which was waiting. P2 now leads, renewing its lease as it works, and its write reaches Storage at t=16. So far this is failover working: one lease, one leader writing. Frozen, P1 still believes it leads.",
      focus: ["lease", "storage", "p2"],
      metrics: { holder: "P2", wrote: 1 },
      facts: [["P2’s lease", "from t=11"], ["Writing", "P2 only"]],
      changes: ["+ P2’s 10 s lease", "+ P2 leads", "+ P2’s write"],
      events: [
        { type: "packet", path: ["lease", "p2"], label: "lease", kind: "response", t: 11, dur: 2 },
        { type: "span", id: "l2", node: "lease", label: "P2’s lease", tone: "work", t: 11, with: true },
        { type: "state", node: "lease", opts: { level: 1 } },
        { type: "state", node: "p2", light: "on", opts: { lead: true } },
        { type: "packet", path: ["p2", "storage"], label: "write", t: 13, dur: 3 },
        { type: "mark", node: "storage", text: "P2’s write", tone: "work", dur: 0.4 },
      ],
    },
    {
      title: "P1 wakes up and writes too",
      short: "Two leaders",
      text: "At t=23 P1 wakes. To P1 no time has passed: its check said 2 seconds remained, so it writes as leader, and Storage takes both writes. Checking right before each write wouldn’t help, since the pause can fall just after the check.",
      focus: ["p1", "storage"],
      metrics: { wrote: { n: 2, tone: "hot" } },
      facts: [["Check before writing", "pause can follow it"], ["Longer lease", "slower failover"]],
      changes: ["+ P1 wakes at t=23", "+ P1’s write", "~ Two leaders wrote"],
      events: [
        { type: "span", id: "pause", end: true, t: 23 },
        { type: "state", node: "p1", light: "on" },
        { type: "packet", path: ["p1", "storage"], label: "write", t: 23, dur: 3 },
        { type: "mark", node: "storage", text: "P1 too", tone: "hot", dur: 0.4 },
      ],
    },
    {
      title: "Each grant carries a fencing token",
      short: "Fencing tokens",
      text: "Replay it with fencing: each grant now returns a number that only increases. P1’s lease comes with token 71. P1 still freezes at t=8 and its lease still expires at t=10; P2’s grant at t=11 carries the next number, 72.",
      metrics: { holder: "P2", wrote: 0 },
      facts: [["P1’s token", "71"], ["P2’s token", "72"]],
      changes: ["~ Grants carry tokens", "+ P1 gets 71", "+ P2 gets 72"],
      events: [
        { type: "rewind" },
        { type: "state", node: "p2", light: "idle", opts: { lead: false }, gap: 0 },
        { type: "packet", path: ["lease", "p1"], label: "token 71", kind: "response", t: 0, dur: 3, gap: 120 },
        { type: "span", id: "l1", node: "lease", label: "P1’s lease", tone: "work", t: 0, with: true },
        { type: "span", id: "pause", node: "p1", label: "GC pause", tone: "hot", t: 8, gap: 160 },
        { type: "state", node: "p1", light: "hot", gap: 60 },
        { type: "span", id: "l1", end: true, t: 10, gap: 160 },
        { type: "state", node: "lease", opts: { level: 0 }, gap: 60 },
        { type: "packet", path: ["lease", "p2"], label: "token 72", kind: "response", t: 11, dur: 2, gap: 160 },
        { type: "span", id: "l2", node: "lease", label: "P2’s lease", tone: "work", t: 11, with: true },
        { type: "state", node: "lease", opts: { level: 1 }, gap: 60 },
        { type: "state", node: "p2", light: "on", opts: { lead: true }, gap: 60 },
      ],
    },
    {
      title: "Storage keeps the highest token",
      short: "Storage keeps 72",
      text: "Every write now carries its leader’s token. P2 writes with 72, and the write reaches Storage at t=16. Storage accepts it and remembers 72 as the highest token it has seen, the number every later write is compared with.",
      focus: ["storage", "p2"],
      metrics: { wrote: 1 },
      facts: [["P2’s write", "token 72"], ["Highest seen", "72"]],
      changes: ["+ P2’s write, token 72", "+ Storage keeps 72"],
      events: [
        { type: "packet", path: ["p2", "storage"], label: "write · 72", t: 13, dur: 3 },
        { type: "mark", node: "storage", text: "accepted", tone: "work", dur: 0.4 },
        { type: "state", node: "storage", light: "work", readout: "highest 72" },
      ],
    },
    {
      title: "Storage refuses the stale token",
      short: "71 refused",
      text: "P1 wakes at t=23 and writes with 71. Storage has already seen 72, so it refuses the write: the fence working as designed. The check lives in the resource, which can judge staleness when the paused process can’t.",
      focus: ["p1", "storage"],
      facts: [["Highest seen", "72"], ["P1’s write", "71 < 72: refused"]],
      changes: ["+ P1 wakes at t=23", "+ Write with 71 refused", "~ One leader wrote"],
      events: [
        { type: "span", id: "pause", end: true, t: 23 },
        { type: "state", node: "p1", light: "on" },
        { type: "packet", path: ["p1", "storage"], label: "write · 71", t: 23, dur: 3 },
        { type: "mark", node: "storage", text: "refused", tone: "work", dur: 0.4 },
      ],
    },
    {
      title: "The resource has to cooperate",
      short: "The cost",
      text: "Fencing works only where the resource stores the highest token and compares it on every write. A third-party API won’t, so send it an idempotency key derived from the job instead, which makes a repeat harmless. etcd revisions and ZooKeeper’s zxid can serve as tokens.",
      focus: ["storage"],
      facts: [["Storage must", "keep 72, compare"], ["Third-party API", "idempotency key"], ["Tokens from", "etcd, ZooKeeper"]],
      changes: ["~ Storage compares every write", "+ Idempotency keys elsewhere"],
      events: [
        { type: "state", node: "storage", light: "work", readout: "accepts ≥ 72" },
      ],
    },
  ],
};
