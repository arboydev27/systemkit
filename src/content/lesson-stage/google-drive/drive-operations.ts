import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Recover the complete file": Object storage keeps 3 copies of each block and Metadata DB sends its changes to a
// DB replica, both sized to a recovery target; a failed File API is stateless and replaced, and the replica is promoted
// knowing its lag. The Notifier goes down for an hour, which only delays sync: the change log holds every commit, and
// Devices replay from their cursors. When it returns, 1 million devices retrying in the same minute send about
// 16,700 requests/s; backoff with jitter spreads them over ten minutes, about 1,670/s. Then corruption at 08:00 forces
// the 02:00 metadata backup: six hours of blocks have no rows and the Reconciler finds them; a device's cursor 5,122
// (drive-sync's laptop) lies past the restored log's end, 4,980, so the File API sends a snapshot; the Cleanup job ran
// at 03:00 and may have deleted blocks the 02:00 rows need, so garbage collection waits past the oldest backup. Last,
// one upload is traced to another device and Monitoring watches end-to-end sync, not only API uptime.
// The plan's single jitter step is two here: the storm (16,700/s) and the spread (1,670/s), so each picture shows its
// number. The chapter's operations floor plan: Devices in tier 0; the File API and the Notifier in tier 1; Metadata DB
// and Object storage in tier 2; tier 3 holds the DB replica, then the Reconciler (in the middle lane, between the two
// stores it compares), then the Cleanup job under Object storage. The Notifier stays on stage throughout: without it
// in tier 1 the phone routes the File API–Object storage link up and around the Devices. Monitoring stands beside the
// Devices in tier 0, so the last step is three rows on a phone instead of four.
// The Devices arrive in step 2, so step 1 frames the stores alone. No step sets `frame`: a wide screen shows the whole
// floor, and a phone frames each step's focus. Steps 2 and 6 keep Object storage in focus (step 2 dims nothing): out
// of focus in the bottom row, a 375 × 667 phone fades it as if it were out of view (the engine's out-of-view test
// counts a full-size tag). Readings sit in notes, not load pills, wherever a phone frames three rows (a pill anywhere
// adds room to every row), so tags stay at 10 px on a 375 × 667 phone. The pills are the File API's reconnect rate in
// steps 3 and 4, which frame two rows, and Metadata DB's "corrupt at 08:00" while step 5 plays, gone by its end.
export const driveOperationsStage: StageScene = {
  id: "drive-operations",
  intro: "Take the file service through an outage, a reconnect storm and a restore, and see what each needs to recover.",
  metrics: [
    { id: "reconnects", label: "Reconnects" },
    { id: "asof", label: "Metadata as of" },
  ],
  nodes: [
    { id: "devices", role: "client", label: "Devices", detail: "1M devices", at: [0, 0], appear: 1, opts: { many: true } },
    { id: "api", role: "web", label: "File API", detail: "stateless", at: [1, -1] },
    { id: "notifier", role: "socket", label: "Notifier", detail: "wake-up hints", at: [1, 1], opts: { items: 6 } },
    { id: "db", role: "database", label: "Metadata DB", detail: "leader", at: [2, -1], opts: { lead: true } },
    { id: "replica", role: "database", label: "DB replica", detail: "standby", at: [3, -1], opts: { replica: true } },
    { id: "storage", role: "storage", label: "Object storage", detail: "3 copies", at: [2, 1] },
    { id: "reconciler", role: "worker", label: "Reconciler", detail: "finds orphans", at: [3, 0], appear: 4 },
    { id: "cleanup", role: "worker", label: "Cleanup job", detail: "deletes old blocks", at: [3, 1], appear: 6 },
    { id: "monitor", role: "monitor", label: "Monitoring", detail: "end to end", at: [0, -1.1], appear: 7 },
  ],
  links: [
    { from: "devices", to: "api" },
    // in step 1, without the Devices, this link would run round the File API's far side
    { from: "api", to: "notifier", unless: "replica" },
    { from: "notifier", to: "devices" },
    { from: "api", to: "db" },
    { from: "api", to: "storage" },
    { from: "db", to: "replica" },
    { from: "reconciler", to: "db" },
    { from: "reconciler", to: "storage" },
    { from: "cleanup", to: "storage" },
  ],
  steps: [
    {
      title: "Replicate both stores, promote with care",
      short: "Replicas",
      text: "Object storage keeps 3 copies of each block, and Metadata DB sends changes to a DB replica, each sized to a recovery target: the minutes of commits you can afford to lose. Test restores. Replace a failed File API; promote the replica knowing its lag.",
      focus: ["api", "db", "replica", "storage"],
      facts: [["Blocks", "3 copies"], ["Recovery target", "minutes of commits lost"]],
      metrics: { asof: "live" },
      changes: ["+ 3 copies of each block", "+ DB replica on standby", "~ Promote it knowing its lag"],
      events: [
        { type: "state", node: "db", light: "on" },
        { type: "packet", path: ["db", "replica"], label: "changes", kind: "work" },
        { type: "state", node: "replica", light: "work" },
        { type: "note", node: "replica", text: "check lag first", with: true },
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "3 copies", with: true },
        { type: "note", node: "api", text: "replace if failed", with: true },
      ],
    },
    {
      title: "A notifier outage only delays sync",
      short: "Outage",
      text: "The Notifier goes down for an hour, so Devices get no wake-up hints. The change log in Metadata DB still holds every commit, so when Devices reconnect or poll, the File API replays the changes after each device’s cursor. Sync is late, not lost.",
      facts: [["Notifier", "down 1 hour"], ["Catch-up", "replay from cursors"]],
      changes: ["− Notifier down for an hour", "~ Devices poll from their cursors", "~ Missed changes replayed"],
      events: [
        { type: "hide", nodes: ["replica"] },
        { type: "state", nodes: ["db", "storage"], light: "idle", with: true },
        { type: "state", node: "notifier", light: "hot", tone: "hot", down: true, opts: { items: 0 } },
        { type: "note", node: "notifier", text: "down for an hour", tone: "hot", with: true },
        { type: "packet", path: ["devices", "api", "db"], label: "changes after cursor" },
        { type: "state", node: "db", light: "on" },
        { type: "note", node: "db", text: "holds every commit", with: true },
        { type: "packet", path: ["db", "api", "devices"], label: "missed changes", kind: "response" },
        { type: "state", node: "devices", light: "work" },
        { type: "note", node: "devices", text: "caught up", tone: "work", with: true },
      ],
    },
    {
      title: "A million retries in one minute",
      short: "Storm",
      text: "The Notifier comes back, and 1 million Devices reconnect and catch up through the File API. If all of them retry in the same minute, that is about 16,700 requests a second: a reconnection storm.",
      focus: ["devices", "api", "notifier"],
      facts: [["Devices", "1 million"], ["Same minute", "16,700/s"]],
      metrics: { reconnects: { n: 16700, unit: "/s", tone: "hot" } },
      changes: ["+ Notifier back up", "~ 1 million retries in one minute", "~ File API at 16,700/s"],
      events: [
        { type: "state", node: "notifier", light: "on", tone: "", down: false, opts: { items: 8 } },
        { type: "state", nodes: ["devices", "db"], light: "idle", with: true },
        { type: "note", node: "devices", text: "all retry at once", tone: "hot" },
        { type: "stream", every: 90, routes: [{ path: ["devices", "api"], kind: "hot" }], with: true },
        { type: "state", node: "api", light: "hot", tone: "hot", readout: "16,700/s", gap: 900 },
      ],
    },
    {
      title: "Jitter spreads a million reconnects",
      short: "Jitter",
      text: "With backoff and jitter, a random delay added to each wait, the same 1 million retries spread over ten minutes. The File API takes about 1,670 requests a second instead of 16,700, and every device still catches up.",
      focus: ["devices", "api", "notifier"],
      facts: [["Same minute", "16,700/s"], ["Over 10 minutes", "1,670/s"]],
      metrics: { reconnects: { n: 1670, unit: "/s" } },
      changes: ["+ Backoff with jitter", "~ Retries spread over 10 minutes", "~ File API at 1,670/s"],
      events: [
        { type: "note", node: "devices", text: "each waits at random", tone: "work" },
        { type: "state", node: "api", light: "on", tone: "", readout: "1,670/s", with: true },
        { type: "stream", every: 320, routes: [{ path: ["devices", "api"] }] },
      ],
    },
    {
      title: "A 02:00 restore leaves blocks without rows",
      short: "Restore",
      text: "Corruption at 08:00 forces a restore of the 02:00 metadata backup. Object storage still holds the blocks uploaded in the six hours after 02:00, but Metadata DB has no rows for them. The Reconciler compares the two and finds those orphans.",
      focus: ["db", "storage", "reconciler"],
      facts: [["Corrupted", "08:00"], ["Restored to", "02:00"], ["Blocks without rows", "6 hours’ worth"]],
      metrics: { asof: "02:00" },
      changes: ["− Metadata after 02:00", "+ Reconciler", "~ 6 hours of blocks without rows"],
      events: [
        { type: "state", nodes: ["devices", "api"], light: "idle", readout: "" },
        { type: "state", node: "db", light: "hot", tone: "hot", readout: "corrupt at 08:00" },
        { type: "pause", ms: 700 },
        { type: "state", node: "db", light: "on", tone: "", readout: "" },
        { type: "note", node: "db", text: "restored to 02:00", with: true },
        { type: "show", nodes: ["reconciler"] },
        { type: "packet", path: ["reconciler", "storage"], label: "blocks with no rows?" },
        { type: "packet", path: ["storage", "reconciler"], label: "6 hours’ worth", kind: "response" },
        { type: "state", node: "reconciler", light: "work" },
        { type: "note", node: "reconciler", text: "6 hours of orphans", tone: "work", with: true },
      ],
    },
    {
      title: "Cursors past the restored log get a snapshot",
      short: "Cursor reset",
      text: "Devices hold cursors beyond the restored log. One asks for changes after 5,122, but the change log now ends at 4,980. The File API detects the cursor past the end and sends a snapshot instead of a page of changes.",
      focus: ["devices", "api", "db", "storage"],
      facts: [["Device cursor", "5,122"], ["Restored log ends", "4,980"]],
      changes: ["~ Cursor 5,122 is past the log’s end", "+ Snapshot sent"],
      events: [
        { type: "hide", nodes: ["reconciler"] },
        { type: "packet", path: ["devices", "api", "db"], label: "changes after 5,122" },
        { type: "note", node: "db", text: "log ends at 4,980" },
        { type: "packet", path: ["db", "api", "devices"], label: "snapshot", kind: "response" },
        { type: "state", node: "devices", light: "work" },
        { type: "note", node: "devices", text: "loads a snapshot", tone: "work", with: true },
      ],
    },
    {
      title: "Hold cleanup longer than the oldest backup",
      short: "Hold cleanup",
      text: "If the Cleanup job ran at 03:00, it may have deleted blocks that the restored 02:00 rows still need, so revisions that use them fail to download. Delay garbage collection for longer than the oldest usable backup.",
      focus: ["cleanup", "storage", "db"],
      facts: [["Cleanup ran", "03:00"], ["Backup from", "02:00"]],
      changes: ["+ Cleanup job", "− Blocks the 02:00 rows need", "~ Deletes held past the oldest backup"],
      events: [
        { type: "state", node: "devices", light: "idle" },
        { type: "show", nodes: ["cleanup"] },
        { type: "packet", path: ["cleanup", "storage"], label: "delete unreferenced", kind: "hot" },
        { type: "state", node: "storage", light: "hot", tone: "hot" },
        { type: "note", node: "db", text: "missing blocks", tone: "hot", with: true },
        { type: "pause", ms: 600 },
        { type: "state", node: "cleanup", light: "work", detail: "after oldest backup" },
        { type: "note", node: "cleanup", text: "hold past backups", tone: "work", with: true },
      ],
    },
    {
      title: "Trace a file from upload to another device",
      short: "Monitor",
      text: "Trace one upload from chunks through verification, commit and change event to another device’s download. Measure pending-upload age, checksum failures, change-log lag, cursor resets, sync convergence time, conflict rate and restore success, not only API uptime. Set recovery targets no stricter than the product needs.",
      facts: [["Measure", "end-to-end sync"], ["Not only", "API uptime"]],
      metrics: { asof: "live" },
      changes: ["+ Monitoring, end to end", "~ One upload traced to another device"],
      events: [
        { type: "hide", nodes: ["cleanup"] },
        { type: "show", nodes: ["monitor"], with: true },
        { type: "state", nodes: ["storage", "db"], light: "idle", tone: "", with: true },
        { type: "state", node: "notifier", opts: { items: 6 }, with: true },
        { type: "packet", path: ["devices", "api", "storage"], label: "chunks" },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["api", "db"], label: "commit" },
        { type: "state", node: "db", light: "on" },
        { type: "packet", path: ["api", "notifier", "devices"], label: "change event", kind: "work" },
        { type: "state", node: "devices", light: "work" },
        { type: "state", node: "monitor", light: "work", with: true },
        { type: "note", node: "monitor", text: "sync lag · resets", with: true },
      ],
    },
  ],
};
