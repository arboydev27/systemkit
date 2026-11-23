import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Pick 2PC, consensus, or a service": one purchase debits $40 in Wallet DB and claims seat 14 in Seats DB, both
// or neither. The coordinator asks both to prepare; each holds its change (a span: −$40, seat 14) and votes yes; it logs
// commit and tells both, so the wallet is debited and seat 14 is sold. Replayed with $25 in the wallet, Wallet DB votes
// no (a reply, blue like the yes votes), the coordinator logs abort and Seats DB releases seat 14 (the protocol working,
// so ink, not orange). Replayed again, both vote yes and the coordinator crashes before sending its decision: both holds
// turn into an orange "in doubt" and seat 14 stays locked. Replayed with the coordinator as a group of three (as Spanner runs 2PC across Paxos groups): it
// stores commit on 2 of 3, its leader crashes, and another member sends the decision. Last, a coordination service: etcd
// (a registry, arriving for that step) stores a lease for Seats DB's primary on a majority; small data only, never your
// own consensus, or a leases table in Postgres. The coordinator stands between the two databases and etcd beside Seats
// DB, so no message crosses a rail; the clock runs (times aren't the point). Each database holds its change half a beat
// before its vote leaves, so the vote's pill sits clear of the hold's label, and each run stays within seven beats. Step 1
// names the holds ("holds −$40"); the replays label them "−$40" and "seat 14", short enough that on a 375 phone Wallet
// DB's vote pill still rests mid-line, clear of its arrowhead and the Coordinator's rail.
// A `state` that must happen as a mark appears (or as time rewinds) runs first and the timeline item follows `with: true`
// (a mark at an explicit `t`): a state started alongside a timeline item is undone when the item finishes, but one
// started before it is kept.
export const cs2pcStage: StageScene = {
  id: "cs-2pc",
  layout: "timeline",
  intro: "Watch a coordinator commit one purchase across two databases, then replay it with a no vote, a crash, and a coordinator that agrees by majority.",
  metrics: [
    { id: "votes", label: "Yes votes" },
    { id: "seat", label: "Seat 14" },
    { id: "decision", label: "Decision" },
  ],
  nodes: [
    { id: "wallet", role: "database", label: "Wallet DB", detail: "debits $40", at: [0, 0] },
    { id: "coord", role: "coordinator", label: "Coordinator", detail: "runs the purchase", at: [1, 0], opts: { count: 2, items: 0 } },
    { id: "seats", role: "database", label: "Seats DB", detail: "claims seat 14", at: [2, 0] },
    { id: "etcd", role: "registry", label: "etcd", detail: "leader, lock, config", at: [3, 0], appear: 5, opts: { count: 3, items: 0 } },
  ],
  links: [],
  steps: [
    {
      title: "The coordinator asks both to prepare",
      short: "Prepare",
      text: "A purchase debits $40 in Wallet DB and claims seat 14 in Seats DB: both commit, or neither. In two-phase commit, the coordinator asks each to prepare: store the change durably and promise to commit. Each holds its change and votes yes.",
      metrics: { votes: { n: 2, unit: " of 2" }, seat: "held", decision: "pending" },
      facts: [["Prepare", "store durably, promise"], ["Not the same as", "two-phase locking"]],
      changes: ["+ Wallet DB holds −$40", "+ Seats DB holds seat 14", "+ 2 yes votes"],
      events: [
        // one word, so on a 375 phone the mark's pill beside its dot stays clear of Seats DB's rail
        { type: "mark", node: "coord", text: "purchase", dur: 1 },
        { type: "packet", path: ["coord", "wallet"], label: "prepare" },
        { type: "packet", path: ["coord", "seats"], label: "prepare", with: true },
        { type: "span", id: "w", node: "wallet", label: "holds −$40", tone: "work", dur: 0.5 },
        { type: "span", id: "s", node: "seats", label: "holds seat 14", tone: "work", with: true },
        { type: "packet", path: ["wallet", "coord"], label: "yes", kind: "response" },
        { type: "packet", path: ["seats", "coord"], label: "yes", kind: "response", with: true },
        { type: "state", node: "coord", light: "on", opts: { items: 2 } },
      ],
    },
    {
      title: "Every vote is yes, so both commit",
      short: "Commit",
      text: "Every vote is yes, so the coordinator durably records commit, and only then tells both. Each commits and releases its hold: the wallet is debited $40 and seat 14 is sold, both changes or neither.",
      metrics: { decision: "commit", seat: "sold" },
      changes: ["+ Commit logged", "~ Wallet debited $40", "~ Seat 14 sold"],
      events: [
        // the votes land at 3.5; the decision's pill ends before the commits leave at 5.1, and they land at 6.1; the two
        // outcome marks are short so on a phone each rests beside its dot, clear of the next rail and the stage's edge
        { type: "state", node: "coord", light: "work" },
        { type: "mark", node: "coord", text: "logs commit", tone: "work", t: 3.6, dur: 1.5, with: true },
        { type: "packet", path: ["coord", "wallet"], label: "commit" },
        { type: "packet", path: ["coord", "seats"], label: "commit", with: true },
        { type: "state", nodes: ["wallet", "seats"], light: "work" },
        { type: "span", id: "w", end: true, t: 6.1, with: true },
        { type: "span", id: "s", end: true, with: true },
        { type: "mark", node: "wallet", text: "debited", tone: "work", t: 6.5, with: true },
        { type: "mark", node: "seats", text: "sold", tone: "work", t: 6.5, with: true },
      ],
    },
    {
      title: "One no, and everyone aborts",
      short: "Abort",
      text: "Replay it with only $25 in the wallet. Seats DB holds seat 14 and votes yes, but Wallet DB can’t debit $40, so it votes no. The coordinator records abort and tells both, and Seats DB releases seat 14: neither change happens.",
      metrics: { votes: { n: 1, unit: " of 2" }, seat: "free", decision: "abort" },
      facts: [["Wallet", "$25, needs $40"], ["One no", "everyone aborts"]],
      changes: ["+ Wallet DB votes no", "+ Abort logged", "− Seats DB’s hold on seat 14"],
      events: [
        // the lights reset as time runs back; Seats DB holds seat 14 as its prepare lands, Wallet DB finds $25 half a beat
        // later (its pill rests beside its dot, between the prepare's arrowhead and the no), and both vote at 2; the votes
        // land at 3, the abort is logged at 3.4 (clear of the yes arrow) and the aborts land at 5.7; the logged abort's
        // mark says only "abort" (the text and changes say it's recorded) so on a 375 phone it stays clear of Seats DB's
        // hold; the release's mark moves the clock on a whole beat, so on a small phone its pill hangs above where the run
        // ends rather than past it; short gaps keep the replay near eight seconds
        { type: "state", nodes: ["wallet", "seats"], light: "idle" },
        { type: "state", node: "coord", light: "idle", opts: { items: 0 }, with: true },
        { type: "rewind", with: true },
        { type: "packet", path: ["coord", "wallet"], label: "prepare", gap: 160 },
        { type: "packet", path: ["coord", "seats"], label: "prepare", with: true },
        { type: "span", id: "s", node: "seats", label: "seat 14", tone: "work", gap: 80 },
        { type: "mark", node: "wallet", text: "$25 < $40", t: 1.5, with: true },
        // a vote is a reply, blue whether yes or no, as cs-raft's votes are
        { type: "packet", path: ["wallet", "coord"], label: "no", kind: "response", gap: 80 },
        { type: "packet", path: ["seats", "coord"], label: "yes", kind: "response", with: true },
        { type: "state", node: "coord", light: "on", opts: { items: 2 }, gap: 0 },
        { type: "mark", node: "coord", text: "abort", t: 3.4, dur: 1.3, with: true },
        { type: "packet", path: ["coord", "wallet"], label: "abort", gap: 80 },
        { type: "packet", path: ["coord", "seats"], label: "abort", with: true },
        { type: "span", id: "s", end: true, gap: 80 },
        { type: "mark", node: "seats", text: "seat 14 freed", t: 6, dur: 1, with: true },
      ],
    },
    {
      title: "A coordinator crash leaves seat 14 locked",
      short: "Coordinator crash",
      text: "Replay it: both vote yes, then the coordinator crashes before sending its decision. Having promised, neither database may decide alone, since the coordinator might have chosen either way. Both wait in doubt, and seat 14 stays locked until the coordinator recovers. One unreachable database also prevents a commit.",
      metrics: { votes: { n: 2, unit: " of 2" }, seat: "locked", decision: "unknown" },
      facts: [["Coordinator down", "both wait"], ["One database unreachable", "no commit either"]],
      changes: ["+ Both vote yes", "− Coordinator crashes", "~ Seat 14 locked, in doubt"],
      events: [
        // as in step 1, each holds its change half a beat before its vote leaves; the votes land at 2.5, as the
        // coordinator crashes
        { type: "state", nodes: ["wallet", "seats"], light: "idle" },
        { type: "state", node: "coord", light: "idle", opts: { items: 0 }, with: true },
        { type: "rewind", with: true },
        { type: "packet", path: ["coord", "wallet"], label: "prepare" },
        { type: "packet", path: ["coord", "seats"], label: "prepare", with: true },
        { type: "span", id: "w", node: "wallet", label: "−$40", tone: "work", dur: 0.5 },
        { type: "span", id: "s", node: "seats", label: "seat 14", tone: "work", with: true },
        { type: "packet", path: ["wallet", "coord"], label: "yes", kind: "response" },
        { type: "packet", path: ["seats", "coord"], label: "yes", kind: "response", with: true },
        // the crash moves the clock on, so both holds run on as orange waits: nobody can tell them the outcome
        { type: "mark", node: "coord", text: "crash", tone: "hot", dur: 2, gap: 160 },
        { type: "span", id: "w", end: true, with: true },
        { type: "span", id: "s", end: true, with: true },
        { type: "span", id: "wd", node: "wallet", label: "in doubt", tone: "hot", with: true },
        { type: "span", id: "sd", node: "seats", label: "seat 14 locked", tone: "hot", with: true },
        { type: "state", node: "coord", light: "hot", tone: "hot", down: true, opts: { items: 2 }, gap: 160 },
        { type: "state", nodes: ["wallet", "seats"], light: "hot", with: true },
      ],
    },
    {
      title: "A majority carries on through a crash",
      short: "Consensus",
      text: "Consensus differs: a majority decides, so it carries on through a minority of failures. Spanner runs 2PC across Paxos groups. Replay it with the coordinator as a group of three: it stores commit on 2 of 3, its leader crashes, and another member sends the decision.",
      metrics: { seat: "sold", decision: "commit" },
      facts: [["2PC needs", "every participant"], ["Consensus needs", "a majority"], ["Decision stored on", "2 of 3"]],
      changes: ["~ Coordinator: 3 replicas", "+ Commit stored on 2 of 3", "− The group’s leader", "~ Seat 14 sold"],
      events: [
        // the votes land at 2.5; the decision at 3.1 and the leader's crash at 4.4, far enough apart that on a phone each
        // pill hangs under its own dot (closer, the two pills sit side by side and out of order); the commits leave at 5.9
        // and land at 6.9, inside step 2's run, so the scale holds; short gaps keep the replay near eight seconds
        { type: "state", nodes: ["wallet", "seats"], light: "idle" },
        { type: "state", node: "coord", light: "idle", tone: "", down: false, opts: { items: 0 }, detail: "a group of three", readout: "3 replicas", with: true },
        { type: "rewind", with: true },
        { type: "packet", path: ["coord", "wallet"], label: "prepare", gap: 160 },
        { type: "packet", path: ["coord", "seats"], label: "prepare", with: true },
        { type: "span", id: "w", node: "wallet", label: "−$40", tone: "work", dur: 0.5, gap: 80 },
        { type: "span", id: "s", node: "seats", label: "seat 14", tone: "work", with: true },
        { type: "packet", path: ["wallet", "coord"], label: "yes", kind: "response", gap: 80 },
        { type: "packet", path: ["seats", "coord"], label: "yes", kind: "response", with: true },
        { type: "state", node: "coord", light: "on", opts: { items: 2 }, gap: 0 },
        { type: "mark", node: "coord", text: "commit on 2 of 3", tone: "work", t: 3.1, dur: 1.3, with: true },
        { type: "state", node: "coord", light: "work", readout: "2 of 3 up", gap: 0 },
        { type: "mark", node: "coord", text: "leader down", tone: "hot", t: 4.4, dur: 1.5, with: true },
        { type: "packet", path: ["coord", "wallet"], label: "commit", gap: 80 },
        { type: "packet", path: ["coord", "seats"], label: "commit", with: true },
        { type: "state", nodes: ["wallet", "seats"], light: "work", gap: 0 },
        { type: "span", id: "w", end: true, t: 6.9, with: true },
        { type: "span", id: "s", end: true, with: true },
      ],
    },
    {
      title: "Use a tested service, or your database",
      short: "Pick a service",
      text: "Don’t write your own consensus: etcd and ZooKeeper package it. Seats DB takes its primary’s lease from etcd, stored on a majority like every write, so keep etcd to leaders, locks and configuration, not business data or heavy traffic. A Postgres leases table can be enough.",
      metrics: { votes: "—", seat: "—", decision: "—" },
      focus: ["seats", "etcd"],
      facts: [["Use for", "leader, lock, config"], ["Not for", "business data, heavy traffic"], ["Already on Postgres", "a leases table"]],
      changes: ["+ etcd", "+ Lease for Seats DB’s primary", "~ Small data only"],
      events: [
        { type: "state", nodes: ["wallet", "seats"], light: "idle" },
        { type: "state", node: "coord", light: "idle", opts: { items: 0 }, detail: "runs the purchase", readout: "", with: true },
        { type: "state", node: "etcd", readout: "small data", with: true },
        { type: "rewind", with: true },
        // the lease travels a beat and a half, so on a 375 phone its pill rests mid-line with its start dot showing on
        // Seats DB's rail; the majority mark comes 0.4 after it lands, and is ink so its pill is short enough to stay clear
        // of Seats DB's rail
        { type: "packet", path: ["seats", "etcd"], label: "lease", dur: 1.5, gap: 160 },
        { type: "state", node: "etcd", light: "work", opts: { items: 1 }, gap: 160 },
        { type: "mark", node: "etcd", text: "majority", t: 1.9, dur: 0.8, with: true },
        { type: "packet", path: ["etcd", "seats"], label: "granted", kind: "response", gap: 160 },
      ],
    },
  ],
};
