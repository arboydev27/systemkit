import type { DesignChallengeContent } from "../design-challenge";

export const notesSyncChallenge: DesignChallengeContent = {
  id: "notes-sync",
  chapterId: "google-drive",
  stepId: "drive-operations",
  minutes: 30,
  adaptationTitle: "Photo attachments",
  title: "Design an offline-first notes app",
  summary: "Carry the chapter's sync ideas to small text documents, where a conflict can be merged instead of copied.",
  brief: "People write short text notes on a phone, a laptop, and a tablet. Every note must open and accept edits with no network, and all of a person's devices must converge when they reconnect. Design the first version for 2 million registered users. Sharing with other people, rich formatting, and server-side search are outside this exercise.",
  assumptions: [
    "2 million registered users; 500,000 are active each day, with 3 devices each on average. At peak, 20% of those devices hold an open connection.",
    "Each active user makes 40 saves per day, where a save is a batch of typing sent after a pause. A note averages 4 KB of text. As a conservative ceiling, each save sends and stores the full note.",
    "Each user keeps 500 notes on average, and revisions are kept for 30 days. Peak traffic is 4 times the daily average. Use decimal units and 86,400 seconds per day.",
    "An edit should reach another online device within 5 seconds at p95. Treat this as a target to verify, not a guarantee from the architecture.",
    "A device may stay offline for 60 days and must still sync afterward. Text a person typed must not disappear silently, including when two devices edit one note.",
  ],
  change: "Notes may now include photos. Assume 10% of active users attach one photo a day, averaging 3 MB, and a photo should stay viewable offline on any device that has downloaded it. Decide how a photo travels, what another device shows before it arrives, and what the new cost is.",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and assumptions. Estimate average and peak saves per second, daily upload bytes, storage for current notes, and 30 days of revisions. Say which number, if any, forces a bigger design.",
      placeholder: "I would support…\nSaves per second = …\nUpload bytes per day = …\nCurrent notes = …\nRevisions for 30 days = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name what lives on the device and what lives on the server. Trace one offline edit from the keystroke to another device, including what each side saves durably and when.",
      placeholder: "On the device…\nOn the server…\nOffline edit: …\nAnother device learns of it by…",
    },
    {
      id: "resilience",
      title: "Conflicts and failure",
      prompt: "Two devices edit one note offline. Explain exactly what happens to both sets of text. Then cover a lost response, a missed wake-up hint, an edit to a note deleted elsewhere, and a device returning after 60 days.",
      placeholder: "When two edits collide…\nIf a response is lost…\nIf a hint is missed…\nIf the note was deleted elsewhere…\nAfter 60 days offline…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the photo change below. Decide where photo bytes live, how they upload, and what another device shows before they arrive. Explain one cost of your change.",
      placeholder: "Photo bytes live in…\nA note refers to a photo by…\nBefore the bytes arrive…\nThe tradeoff is…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I show units, separate average from peak, separate current notes from revisions, and say whether the numbers justify sharding or a block store." },
    { id: "offline", title: "Offline edits are durable and safe to retry.", detail: "I save edits locally before any network call, and a retried save cannot create a duplicate note or revision." },
    { id: "convergence", title: "Devices converge from durable state.", detail: "I use a saved cursor and a change log, treat notifications as hints, and explain what happens when a cursor is older than retained history." },
    { id: "conflicts", title: "Conflicts cannot silently lose text.", detail: "I give a concrete rule for concurrent edits and for edit-versus-delete, and device clocks do not decide which text survives." },
    { id: "photos", title: "The photo change has a tradeoff.", detail: "I keep photo bytes out of the note sync path, define what appears before the bytes arrive, and name a cost in storage, cleanup, or complexity." },
  ],
  estimateGuide: "Saves: 500,000 users × 40 = 20 million/day. 20,000,000 ÷ 86,400 ≈ 231/s on average and about 926/s at peak. Uploads: 20 million × 4 KB = 80 GB/day, about 926 KB/s on average and 3.7 MB/s at peak. Current notes: 2 million users × 500 notes = 1 billion notes, and 1 billion × 4 KB = 4 TB. Revisions: 80 GB × 30 days = 2.4 TB, before replicas. Connections at peak: 500,000 × 3 = 1.5 million devices, and 20% of that is 300,000. Each save wakes at most 2 other devices, so at most about 1,850 hints/s at peak. Benchmark it, but none of these numbers obviously forces sharding or a block store; the hard part is convergence. Photos add 500,000 × 10% = 50,000 photos/day, and 50,000 × 3 MB = 150 GB/day, or 4.5 TB in 30 days, which is more than all current note text.",
  solutions: [
    {
      id: "three-way-merge",
      title: "Per-note revisions with three-way merge",
      approach: "One managed relational database holds notes, revisions, and a per-user change log. Each device keeps a local SQLite copy plus an outbox table of unsent edits. A note is small enough to travel whole, so text needs no block layer. A save carries the revision it was based on. On a mismatch the client runs a three-way merge, which compares both edited versions against their common starting version.",
      paths: [
        "Edit offline: the client writes the note and an outbox entry in one local SQLite transaction, using a client-generated note ID and edit ID. The screen reads local data, so typing never waits on the network.",
        "Sync up: the client sends the note, its base revision, and its edit ID. In one database transaction the server compares the base with the current revision. On a match it inserts a revision, moves the current pointer, and appends to the change log. On a mismatch it returns the current text; the client merges and resubmits. A repeated edit ID returns the earlier result.",
        "Sync down: a WebSocket message or push hint wakes other devices, which also poll occasionally. Each reads the change log after its cursor, applies a page to SQLite, and advances the cursor only after that local commit.",
      ],
      failure: "A lost response is safe because the edit ID makes the retry idempotent. A missed hint delays a device but loses nothing. Keep the change log and tombstones longer than the 60-day offline window; a device beyond that reloads a snapshot and merges its outbox on top. Overlapping edits that cannot merge keep both versions in the note, clearly marked. An edit to a deleted note restores it as a copy rather than vanishing. Monitor merge failures, outbox age from client telemetry, change-log lag, and convergence time.",
      adaptation: "Photo bytes do not belong in note rows. The client uploads through a resumable session to object storage, and the note text refers to a photo by an ID. That reference can sync first, with a placeholder shown until the bytes arrive, so text stays fast. Devices fetch photos on demand through short-lived signed URLs and keep them in a local cache. Reconciliation finds uploads no note references. Bytes now dominate storage, at 150 GB/day against 80 GB/day of saves, so cleanup needs real attention.",
      tradeoff: "The server stays small and easy to inspect, back up, and restore. Overlapping edits still reach a person as a marked conflict, each device must keep the base text of any note with unsent edits, and whole-note saves send more bytes than a long note's small changes need.",
    },
    {
      id: "crdt-log",
      title: "A CRDT operation log per note",
      approach: "Each note is a CRDT (conflict-free replicated data type): a structure where replicas that apply the same operations reach the same text, in any order. Libraries such as Yjs and Automerge implement this for text. The device stores CRDT state locally. The server keeps an append-only log of operation batches per note, plus periodic snapshots, and does not need to understand the text.",
      paths: [
        "Edit offline: the client applies the operation to local state and appends a batch to a local outbox, tagged with its device ID and a per-device counter, in one local transaction.",
        "Sync up: the client sends batches. The server stores each one once, keyed by device ID and counter, and appends a change-log entry. There is no base-revision check, because concurrent batches are all valid.",
        "Sync down: a hint wakes other devices, which pull batches after their cursor and apply them in any order. A compaction job writes snapshots so a new device need not replay a note's whole history.",
      ],
      failure: "Duplicate batches are dropped by their key, and a missed hint is recovered by the cursor. A CRDT does not decide edit-versus-delete, so keep a note-level tombstone and make restoring explicit. Compaction must not break a device returning after 60 days, so snapshots keep the merge metadata for that long. A malformed batch would spread to every replica, so validate batches on arrival and keep older snapshots to roll back to. Monitor log length per note, snapshot age, and the ratio of state size to visible text.",
      adaptation: "Photos stay outside the CRDT, since a binary value in a text structure would bloat every replica. An operation inserts a photo reference, and bytes travel through a resumable upload to object storage. If two devices add photos at once, both references survive the merge, which is a real gain. Cleanup is harder: bytes can be deleted only once no retained snapshot or operation still refers to them, so photos linger longer than in a revision design.",
      tradeoff: "People almost never see a conflict, even after long offline periods. In exchange the client carries a larger library, metadata grows with edit history, compaction is delicate, and a clean merge can still read oddly when two devices rewrite one sentence. That is a lot to take on for one person's devices, where true overlaps should be uncommon.",
    },
  ],
};
