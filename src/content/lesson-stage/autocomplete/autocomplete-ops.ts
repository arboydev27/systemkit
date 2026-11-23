import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Keep suggestions trustworthy": a U of the two halves of removal. The serving column (Snapshot store → Query
// API → Policy filter → Client) and the build column (Term counts → Build policy → Snapshot store) meet at the Snapshot
// store, with the two gates side by side in the middle. The Build policy admits a term only after an example 100
// distinct users, so one person's private query and a script's 50,000 searches (still one user) are held. An unsafe
// phrase that slipped into snapshot v812 is reported at 09:00; by 09:05 the Policy filter's denylist drops it from the
// candidates and the Client still gets a full top 5, while v812 and the counts still hold it. The same day the team
// excludes it in the Build policy and cleans the aggregates; the next morning v813 is verified without it. Then the
// build column leaves and Monitoring watches p99, empty results and build age, and when the Query API fails the Client
// times out and shows no list while full search still works.
export const autocompleteOpsStage: StageScene = {
  id: "autocomplete-ops",
  intro: "Follow an unsafe phrase from its report at 09:00 to a snapshot that no longer holds it, then see what keeps search working when suggestions fail.",
  metrics: [
    { id: "time", label: "Time" },
    { id: "unsafe", label: "Unsafe shown" },
    { id: "snapshot", label: "Snapshot" },
  ],
  // Serving side in lane −1, build side in lane +1, joined at tier 2. On a phone: Client | Term counts, then Policy
  // filter | Build policy, then Query API | Snapshot store, and Monitoring alone below once the build side leaves.
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "search box", at: [0, -1] },
    { id: "filter", role: "gate", label: "Policy filter", detail: "denylist, at serve", at: [1, -1], opts: { open: true } },
    { id: "api", role: "web", label: "Query API", detail: "validates, filters", at: [2, -1] },
    { id: "counts", role: "database", label: "Term counts", detail: "term × window", at: [0, 1] },
    { id: "policy", role: "gate", label: "Build policy", detail: "100 distinct users", at: [1, 1], opts: { open: "half" } },
    { id: "snapshots", role: "storage", label: "Snapshot store", detail: "versioned snapshots", at: [2, 1] },
    { id: "monitor", role: "monitor", label: "Monitoring", detail: "p99, build age", at: [3, 0], appear: 5 },
  ],
  links: [
    { from: "client", to: "filter" },
    { from: "filter", to: "api" },
    // On a wide screen this link bends round the U's right side, where Monitoring stands in the last two steps; it
    // steps aside there, and the Snapshot store reports to Monitoring instead.
    { from: "api", to: "snapshots", unless: "monitor" },
    { from: "snapshots", to: "policy" },
    { from: "policy", to: "counts" },
    { from: "api", to: "monitor" },
    { from: "snapshots", to: "monitor" },
  ],
  steps: [
    {
      title: "A term needs 100 people before it shows",
      short: "Eligibility",
      text: "Raw searches can hold names, phone numbers and medical worries, so collect little and keep it briefly. The Build policy admits a term only after, say, 100 distinct users search it. One person’s private query stays out, and so does a script submitting one phrase 50,000 times: it is still one user.",
      focus: ["counts", "policy"],
      frame: ["client", "filter", "api", "counts", "policy", "snapshots"],
      facts: [["Threshold", "100 distinct users"], ["Script", "50,000 searches, 1 user"]],
      metrics: { snapshot: "v812" },
      changes: ["+ Eligible at 100 distinct users", "~ Private query held", "~ Script’s 50,000 searches held"],
      events: [
        { type: "packet", path: ["counts", "policy"], label: "private query · 1 user", kind: "quiet" },
        { type: "state", node: "policy", light: "on" },
        { type: "packet", path: ["counts", "policy"], label: "50,000 from 1 user", kind: "quiet" },
        { type: "note", node: "policy", text: "held: under 100 users" },
      ],
    },
    {
      title: "09:00: an unsafe phrase is reported",
      short: "Report",
      text: "An unsafe phrase slipped through anyway and sits in snapshot v812. The Query API serves it in a public list, the Policy filter doesn’t block it yet, and at 09:00 a report arrives. Popularity is not proof of legitimacy.",
      focus: ["client", "filter", "api", "snapshots"],
      frame: ["client", "filter", "api", "counts", "policy", "snapshots"],
      facts: [["Reported", "09:00"], ["In", "snapshot v812"]],
      metrics: { time: "09:00", unsafe: { n: 1, tone: "hot" } },
      changes: ["+ Report at 09:00", "~ Unsafe phrase in a public list"],
      events: [
        { type: "state", node: "policy", light: "idle" },
        // The filter takes five from a larger set of candidates (the rank lesson's fix), so step 3 can drop one and
        // still send five. Today it lets the phrase through.
        { type: "packet", path: ["snapshots", "api", "filter"], label: "candidates · 1 unsafe", kind: "hot" },
        { type: "packet", path: ["filter", "client"], label: "top 5 · 1 unsafe", kind: "hot" },
        { type: "state", node: "client", light: "hot" },
        { type: "note", node: "client", text: "reported at 09:00", tone: "hot", with: true },
      ],
    },
    {
      title: "09:05: the Policy filter hides it now",
      short: "Suppress",
      text: "A fast denylist in the serving path suppresses the suggestion within minutes. By 09:05 the phrase is on the Policy filter’s denylist, which removes it from every list on the way out. Snapshot v812 and the term counts still hold it.",
      focus: ["client", "filter", "api", "snapshots"],
      frame: ["client", "filter", "api", "counts", "policy", "snapshots"],
      facts: [["Suppressed", "09:05"], ["Still in", "v812 and the counts"]],
      metrics: { time: "09:05", unsafe: 0 },
      changes: ["+ Phrase on the denylist", "~ Phrase stops appearing", "~ v812 and counts unchanged"],
      events: [
        { type: "state", node: "filter", light: "on", opts: { open: "half" } },
        { type: "note", node: "filter", text: "phrase on denylist", with: true },
        { type: "packet", path: ["api", "filter"], label: "candidates · 1 unsafe", kind: "hot" },
        { type: "packet", path: ["filter", "client"], label: "top 5 · phrase gone", kind: "response" },
        { type: "state", node: "client", light: "work" },
        { type: "note", node: "client", text: "phrase gone", tone: "work", with: true },
        { type: "note", node: "snapshots", text: "v812 still holds it" },
      ],
    },
    {
      title: "Same day: fix the build and the counts",
      short: "Fix the source",
      text: "The same day, the team adds the phrase to the Build policy and cleans it out of the Term counts. The serving filter alone hides the phrase but leaves it in the source data, waiting for the next build.",
      focus: ["counts", "policy"],
      frame: ["client", "filter", "api", "counts", "policy", "snapshots"],
      facts: [["Build policy", "phrase excluded"], ["Term counts", "aggregates cleaned"]],
      metrics: { time: "same day" },
      changes: ["+ Phrase excluded at build", "− Phrase in the aggregates"],
      events: [
        { type: "state", node: "client", light: "idle" },
        { type: "state", node: "filter", light: "idle", with: true },
        { type: "state", node: "policy", light: "work" },
        { type: "note", node: "policy", text: "phrase excluded", tone: "work", with: true },
        { type: "state", node: "counts", light: "work" },
        { type: "note", node: "counts", text: "aggregates cleaned", tone: "work", with: true },
      ],
    },
    {
      title: "Next morning, v813 is checked without it",
      short: "Verify",
      text: "The next morning’s build reads the cleaned counts through the Build policy and writes snapshot v813. The team verifies that v813 omits the phrase. Had the source been left alone, the phrase would have come back with this build.",
      focus: ["counts", "policy", "snapshots"],
      frame: ["client", "filter", "api", "counts", "policy", "snapshots"],
      facts: [["New snapshot", "v813"], ["Phrase", "absent, verified"]],
      metrics: { time: "next morning", snapshot: "v813" },
      changes: ["+ Snapshot v813", "~ Verified: phrase absent"],
      events: [
        { type: "packet", path: ["counts", "policy", "snapshots"], label: "cleaned counts", kind: "work" },
        { type: "state", node: "snapshots", light: "work" },
        { type: "note", node: "snapshots", text: "v813: phrase absent", tone: "work", with: true },
        { type: "state", nodes: ["counts", "policy"], light: "idle", with: true },
      ],
    },
    {
      title: "Watch latency, empty results and build age",
      short: "Monitor",
      text: "Monitoring watches what users feel and what builds deliver: keystroke latency, API p95 and p99, empty-result rate, cache hit rate, shard skew, build age, stream lag and policy-block hits. Test stale-snapshot fallback, shard failure, cache stampede and rollback before you need them.",
      focus: ["api", "snapshots", "monitor"],
      frame: ["client", "filter", "api", "snapshots", "monitor"],
      facts: [["Users feel", "p99, empty results"], ["Builds", "build age, stream lag"]],
      // the removal's clock has run out: watching and failing belong to every day
      metrics: { time: "ongoing" },
      changes: ["+ Monitoring on the API and builds", "+ Drills: fallback, rollback"],
      events: [
        { type: "hide", nodes: ["counts", "policy"] },
        { type: "state", node: "snapshots", light: "idle", with: true },
        { type: "show", nodes: ["monitor"] },
        { type: "state", node: "monitor", light: "on" },
        { type: "note", node: "api", text: "p99 · empty results", with: true },
        { type: "note", node: "snapshots", text: "build age", with: true },
        {
          type: "stream", every: 520, routes: [
            { path: ["api", "monitor"], w: 2, kind: "quiet" },
            { path: ["snapshots", "monitor"], w: 1, kind: "quiet" },
          ],
        },
      ],
    },
    {
      title: "If suggestions fail, search still works",
      short: "Fail soft",
      text: "The Query API goes down. The Client gives its “cam” request a short timeout and shows no list rather than block typing, and submitting the full search still works. Monitoring shows the failure, and a last-good snapshot gives the service something to fall back to.",
      focus: ["client", "filter", "api", "monitor"],
      frame: ["client", "filter", "api", "snapshots", "monitor"],
      facts: [["Client", "short timeout, no list"], ["Search", "still works"]],
      changes: ["− Query API down", "~ Client shows no list", "~ Full search still works"],
      events: [
        { type: "state", node: "api", light: "hot", tone: "hot", down: true },
        { type: "packet", path: ["client", "filter", "api"], label: "“cam”", lost: true },
        { type: "note", node: "client", text: "timeout · no list" },
        { type: "state", node: "monitor", light: "hot" },
        { type: "note", node: "monitor", text: "suggestions down", tone: "hot", with: true },
      ],
    },
  ],
};
