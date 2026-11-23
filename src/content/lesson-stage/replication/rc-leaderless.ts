import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Choose among leaders and quorums": sensors write readings through a coordinator to three replicas with no
// leader, N = 3, W = 2, R = 2. Sensor 17's 12:00:05 reading goes to all three and the coordinator answers after the
// fastest two acks, in 3 ms (Replicas 1 and 2 ack in 2 and 3 ms), so slow Replica 3 (40 ms) doesn't hold it up. A
// dashboard read a moment later, before Replica 3 finishes, asks Replicas 2 and 3: Replica 3 still has 12:00:00,
// Replica 2 has 12:00:05, and the newer wins, since any two of three share one that took the write. Replica 3 dies
// before it finishes 12:00:05: 12:00:10 is acked by the other two and nobody is promoted (Failovers stays 0); it
// returns at 12:00:00 and repair copies 12:00:05 and 12:00:10 from Replica 2. Then the cost: two operators set sensor
// 17's alert limit to 30 and then 35, a millisecond apart, both told OK; the coordinator forwards each as it arrives and
// the replicas get them in different orders; last-write-wins keeps 35 (stamped later) everywhere and 30 is lost (Lost
// writes 1). Last, a control picks a workload and the parts take its model's shape: seat bookings on a single leader
// (a second booking of seat 14B is refused), profiles on two regional leaders with a home region per user (Ana's at
// Region A, Ben's at Region B), and sensor readings keyed by device and time on the leaderless store.
// Placement: on a phone the tiers stack down the screen, so the coordinator (0.85) and replicas (2.1) keep the column
// short enough to hold the label floor at 375×667; on a wide screen the replicas stay 1.25 tiers from the coordinator,
// which keeps its notes (22 characters at most) clear of Replica 1's tag. The two limits ride in one pill: on a wide
// screen the Operators' cable runs under the coordinator's tag, which leaves room for only one pill to rest on it (a
// lower Operators at lane 1.1 or 1.3 still stacks two). Steps 2 to 6 frame all six parts, so the view holds still.
export const rcLeaderlessStage: StageScene = {
  id: "rc-leaderless",
  intro: "Watch sensor readings land on three replicas with no leader, then see what that gives, what it costs, and when to choose it.",
  metrics: [{ id: "model", label: "Model" }, { id: "failovers", label: "Failovers" }, { id: "lost", label: "Lost writes" }],
  nodes: [
    { id: "sensors", role: "sensor", label: "Sensors", detail: "send readings", at: [0, -0.8], opts: { many: true } },
    { id: "dash", role: "client", label: "Dashboard", detail: "reads readings", at: [0, 0.6], appear: 1 },
    { id: "coord", role: "coordinator", label: "Coordinator", detail: "N = 3, W = 2, R = 2", at: [0.85, 0], opts: { count: 3, items: 0 } },
    { id: "r1", role: "database", label: "Replica 1", detail: "acks in 2 ms", at: [2.1, -1.3], opts: { replica: true } },
    { id: "r2", role: "database", label: "Replica 2", detail: "acks in 3 ms", at: [2.1, 0], opts: { replica: true } },
    { id: "r3", role: "database", label: "Replica 3", detail: "acks in 40 ms", at: [2.1, 1.3], opts: { replica: true } },
  ],
  // The quorum path, then the cables of the two leader shapes the last step can show: each is drawn only while the
  // coordinator (single leader) or Replica 2 (two regions) is off the stage.
  links: [
    { from: "sensors", to: "coord" },
    { from: "dash", to: "coord" },
    { from: "coord", to: "r1" },
    { from: "coord", to: "r2" },
    { from: "coord", to: "r3" },
    { from: "dash", to: "r2", unless: "coord" },
    { from: "r2", to: "r1", unless: "coord" },
    { from: "r2", to: "r3", unless: "coord" },
    { from: "dash", to: "r1", unless: "r2" },
    { from: "dash", to: "r3", unless: "r2" },
    { from: "r1", to: "r3", unless: "r2" },
  ],
  steps: [
    {
      title: "A write goes to all three replicas",
      short: "Write to all",
      text: "No replica leads. Sensor 17 sends its 12:00:05 reading, and the coordinator sends it to all three replicas (N = 3). It answers after the fastest two acks (W = 2), in 3 ms, so slow Replica 3’s 40 ms doesn’t hold it up.",
      metrics: { model: "Leaderless", failovers: 0, lost: 0 },
      facts: [["N", "3 replicas"], ["W", "2 acks"]],
      changes: ["+ 12:00:05 on Replicas 1 and 2", "~ Answered after 2 of 3 acks", "~ Replica 3 still writing"],
      events: [
        { type: "state", nodes: ["r1", "r2", "r3"], readout: "has 12:00:00" },
        { type: "packet", path: ["sensors", "coord"], label: "s17 · 12:00:05" },
        { type: "state", node: "coord", light: "on" },
        { type: "packet", path: ["coord", "r1"], label: "12:00:05" },
        { type: "packet", path: ["coord", "r2"], label: "12:00:05", with: true },
        { type: "packet", path: ["coord", "r3"], label: "12:00:05", with: true },
        { type: "state", nodes: ["r1", "r2"], light: "work", readout: "has 12:00:05" },
        { type: "state", node: "r3", light: "on", with: true },
        { type: "packet", path: ["r2", "coord"], label: "ack", kind: "response" },
        { type: "packet", path: ["r1", "coord"], label: "ack", kind: "response", with: true },
        { type: "state", node: "coord", light: "work", opts: { count: 3, items: 2 } },
        { type: "note", node: "coord", text: "OK after 2 of 3 acks", tone: "work", with: true },
        { type: "packet", path: ["coord", "sensors"], label: "OK in 3 ms", kind: "response" },
      ],
    },
    {
      title: "A read asks two and keeps the newest",
      short: "Read two",
      text: "A moment later, before Replica 3 finishes, the dashboard asks for sensor 17’s latest reading. The coordinator asks two replicas (R = 2): Replica 3 still returns 12:00:00 and Replica 2 returns 12:00:05, so it keeps the newer. Any two of three include one that took the write.",
      focus: ["dash", "coord", "r2", "r3"],
      frame: ["sensors", "dash", "coord", "r1", "r2", "r3"],
      facts: [["R", "2 replies"], ["W + R", "2 + 2 > 3"]],
      changes: ["+ Dashboard", "+ Read from Replicas 2 and 3", "~ The newer reading wins"],
      events: [
        { type: "state", node: "coord", light: "on", opts: { count: 3, items: 0 } },
        { type: "packet", path: ["dash", "coord"], label: "latest s17?" },
        { type: "packet", path: ["coord", "r2"], label: "read s17" },
        { type: "packet", path: ["coord", "r3"], label: "read s17", with: true },
        { type: "packet", path: ["r2", "coord"], label: "12:00:05", kind: "response" },
        { type: "packet", path: ["r3", "coord"], label: "12:00:00", kind: "quiet", with: true },
        { type: "state", node: "coord", light: "work", opts: { count: 3, items: 2 } },
        { type: "note", node: "coord", text: "keeps 12:00:05", tone: "work", with: true },
        { type: "packet", path: ["coord", "dash"], label: "12:00:05 reading", kind: "response" },
      ],
    },
    {
      title: "A replica dies and nobody is promoted",
      short: "Replica down",
      text: "Replica 3 dies before it finishes writing 12:00:05. The 12:00:10 reading still goes to all three; Replicas 1 and 2 ack, and the coordinator answers as before. There is no leader to replace, so nobody is promoted and no write pauses.",
      focus: ["sensors", "coord", "r1", "r2", "r3"],
      frame: ["sensors", "dash", "coord", "r1", "r2", "r3"],
      metrics: { failovers: 0 },
      changes: ["− Replica 3 down", "+ 12:00:10 on Replicas 1 and 2", "~ No promotion, no pause"],
      events: [
        { type: "state", node: "r3", down: true, light: "hot", tone: "hot", detail: "down" },
        { type: "state", node: "coord", light: "on", opts: { count: 3, items: 0 }, with: true },
        { type: "packet", path: ["sensors", "coord"], label: "s17 · 12:00:10" },
        { type: "packet", path: ["coord", "r1"], label: "12:00:10" },
        { type: "packet", path: ["coord", "r2"], label: "12:00:10", with: true },
        { type: "packet", path: ["coord", "r3"], label: "12:00:10", kind: "hot", lost: true, with: true },
        { type: "state", nodes: ["r1", "r2"], readout: "has 12:00:10" },
        { type: "packet", path: ["r2", "coord"], label: "ack", kind: "response" },
        { type: "packet", path: ["r1", "coord"], label: "ack", kind: "response", with: true },
        { type: "state", node: "coord", light: "work", opts: { count: 3, items: 2 } },
        { type: "note", node: "coord", text: "nobody promoted", tone: "work", with: true },
        { type: "packet", path: ["coord", "sensors"], label: "OK in 3 ms", kind: "response" },
      ],
    },
    {
      title: "The returning replica is repaired",
      short: "Repair",
      text: "Replica 3 comes back still holding 12:00:00. Nothing waited for it: repair copies the two readings it missed, 12:00:05 and 12:00:10, from Replica 2, and all three hold the same readings again.",
      focus: ["coord", "r2", "r3"],
      frame: ["sensors", "dash", "coord", "r1", "r2", "r3"],
      changes: ["+ Replica 3 back", "+ 12:00:05 and 12:00:10 repaired"],
      events: [
        { type: "state", node: "r3", down: false, light: "on", tone: "", detail: "back", readout: "has 12:00:00" },
        { type: "pause", ms: 700 },
        { type: "packet", path: ["r2", "coord", "r3"], label: "12:00:05, 12:00:10", kind: "work" },
        { type: "state", node: "r3", light: "work", readout: "has 12:00:10" },
        { type: "note", node: "coord", text: "Replica 3 repaired", tone: "work", with: true },
      ],
    },
    {
      title: "No leader puts two writes in order",
      short: "No single order",
      text: "Two operators set sensor 17’s alert limit a millisecond apart, to 30 and then 35, and both are told OK. The coordinator forwards each as it arrives, and the network delivers them in different orders: Replicas 1 and 3 end on 35, Replica 2 on 30.",
      focus: ["dash", "coord", "r1", "r2", "r3"],
      frame: ["sensors", "dash", "coord", "r1", "r2", "r3"],
      changes: ["+ limit = 30, then limit = 35", "~ Replica 2 disagrees"],
      events: [
        { type: "state", node: "dash", label: "Operators", detail: "set alert limits", opts: { many: true } },
        { type: "state", node: "r3", detail: "acks in 40 ms", with: true },
        { type: "state", node: "coord", light: "on", opts: { count: 3, items: 0 }, with: true },
        { type: "packet", path: ["dash", "coord"], label: "limit 30, then 35" },
        { type: "packet", path: ["coord", "r1"], label: "30 → 35" },
        { type: "packet", path: ["coord", "r2"], label: "35 → 30", with: true },
        { type: "packet", path: ["coord", "r3"], label: "30 → 35", with: true },
        { type: "state", nodes: ["r1", "r3"], light: "work", readout: "limit 35" },
        { type: "state", node: "r2", light: "hot", tone: "hot", readout: "limit 30", with: true },
        { type: "state", node: "coord", light: "work", opts: { count: 3, items: 2 }, with: true },
        { type: "note", node: "coord", text: "both OK, orders differ", tone: "hot", with: true },
      ],
    },
    {
      title: "Last-write-wins silently drops one",
      short: "Last-write-wins",
      text: "A rule has to settle it. Last-write-wins keeps 35, stamped a moment later, on every replica, and 30 vanishes, though its operator was told it saved.",
      focus: ["dash", "coord", "r1", "r2", "r3"],
      frame: ["sensors", "dash", "coord", "r1", "r2", "r3"],
      metrics: { lost: { n: 1, tone: "hot" } },
      facts: [["Rule", "last-write-wins"], ["Kept", "limit = 35"]],
      changes: ["~ All three on limit = 35", "− limit = 30, told OK, then lost"],
      events: [
        { type: "packet", path: ["coord", "r2"], label: "limit 35 is newer", kind: "work" },
        { type: "state", node: "r2", light: "work", tone: "", readout: "limit 35" },
        { type: "note", node: "coord", text: "30: told OK, then lost", tone: "hot", with: true },
      ],
    },
    {
      title: "Choose by what two writes to one item mean",
      short: "Choose a model",
      text: "Ask what two writes to one item should do. Seat bookings must refuse one: a single leader orders them and checks uniqueness, the right default. Profiles edited in two regions avoid conflicts with a home region per user: multiple leaders. Sensor readings keyed by device and time never collide: leaderless. Try each workload.",
      events: [],
      control: {
        label: "Workload",
        // in every option a write copied to another replica is ink, as in the chapter's other lessons, and the note
        // saying how the model handles two writes is blue: the refusal is the rule working, as rc-failover's fence is
        options: [
          {
            label: "Seat bookings",
            metrics: { model: "Single leader", lost: 0 },
            events: [
              { type: "hide", nodes: ["sensors", "coord"] },
              { type: "move", at: { dash: [0, 0], r2: [1, 0], r1: [2.1, -0.75], r3: [2.1, 0.75] } },
              { type: "state", node: "dash", label: "Booking app", detail: "seat reservations", light: "idle", opts: { many: false }, with: true },
              { type: "state", node: "r2", label: "Leader", detail: "orders every write", light: "on", tone: "", readout: "", opts: { replica: false, lead: true }, with: true },
              { type: "state", node: "r1", label: "Follower 1", detail: "copies the leader", light: "idle", readout: "", with: true },
              { type: "state", node: "r3", label: "Follower 2", detail: "copies the leader", light: "idle", readout: "", with: true },
              { type: "packet", path: ["r2", "r1"], label: "14B booked" },
              { type: "packet", path: ["r2", "r3"], label: "14B booked", with: true },
              { type: "packet", path: ["dash", "r2"], label: "book 14B again" },
              { type: "note", node: "r2", text: "second booking refused", tone: "work" },
            ],
          },
          {
            label: "Profiles",
            metrics: { model: "Multi-leader", lost: 0 },
            events: [
              { type: "hide", nodes: ["sensors", "coord", "r2"] },
              { type: "move", at: { dash: [0, 0], r1: [1.6, -1], r3: [1.6, 1] } },
              { type: "state", node: "dash", label: "Profile app", detail: "users in 2 regions", light: "idle", opts: { many: true }, with: true },
              { type: "state", node: "r1", label: "Region A", detail: "Ana’s home region", light: "on", tone: "", readout: "", opts: { replica: false, lead: true }, with: true },
              { type: "state", node: "r3", label: "Region B", detail: "Ben’s home region", light: "on", tone: "", readout: "", opts: { replica: false, lead: true }, with: true },
              { type: "packet", path: ["dash", "r1"], label: "edit Ana’s profile" },
              { type: "packet", path: ["dash", "r3"], label: "edit Ben’s profile", with: true },
              { type: "packet", path: ["r1", "r3"], label: "Ana’s edit" },
              { type: "packet", path: ["r3", "r1"], label: "Ben’s edit" },
              { type: "note", node: "dash", text: "one home per profile", tone: "work" },
            ],
          },
          {
            label: "Sensor readings",
            metrics: { model: "Leaderless", lost: 0 },
            events: [
              { type: "state", node: "dash", label: "Dashboard", detail: "reads readings", light: "idle", opts: { many: false } },
              { type: "state", nodes: ["r1", "r2", "r3"], light: "idle", tone: "", readout: "", with: true },
              { type: "state", node: "r3", detail: "acks in 40 ms", with: true },
              { type: "state", node: "coord", light: "on", opts: { count: 3, items: 0 }, with: true },
              { type: "packet", path: ["sensors", "coord"], label: "s42 · 12:00:15" },
              { type: "packet", path: ["coord", "r1"], label: "12:00:15" },
              { type: "packet", path: ["coord", "r2"], label: "12:00:15", with: true },
              { type: "packet", path: ["coord", "r3"], label: "12:00:15", with: true },
              { type: "state", nodes: ["r1", "r2", "r3"], light: "work" },
              { type: "state", node: "coord", light: "work", opts: { count: 3, items: 2 }, with: true },
              { type: "note", node: "sensors", text: "keys never collide", tone: "work" },
            ],
          },
        ],
      },
    },
  ],
};
