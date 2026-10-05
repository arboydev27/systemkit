import type { Question, Step } from './chapter';

export const driveSteps: Step[] = [
  {
    id: 'drive-scope', title: 'Define the file service', eyebrow: '01 · Scope and demand',
    summary: 'Separate storage, sharing, and cross-device sync before sizing the system.',
    body: [
      'The core jobs are upload, download, cross-device sync, revision history, and sharing. Clarify file size, clients, offline edits, sync delay, retention, and deletion behavior. Real-time collaborative document editing is a separate problem: syncing file revisions does not merge simultaneous keystrokes.',
      'Size operations and bytes separately. The book’s exercise assumes 10 million daily users, two uploads each per day, and 500 KB per file: about 20 million uploads and 10 TB of new originals each day before versions and replicas. That is roughly 230 average upload starts per second. Peak traffic, upload duration, and large-file tails matter too. Reserved quota is not the same as occupied storage.',
    ],
    takeaways: ['Scope file sync and collaborative editing separately.', 'Estimate operation rate, occupied bytes, revisions, and peak bandwidth independently.'],
    diagramId: 'drive-scope', scenario: 'A teammate multiplies all accounts by their free quota and calls the result today’s storage use. What is wrong?',
    scenarioAnswer: 'That gives maximum allocated quota, not occupied bytes. Estimate actual uploads, file sizes, versions, retention, and replication.',
  },
  {
    id: 'drive-metadata', title: 'Separate names from bytes', eyebrow: '02 · Metadata and objects',
    summary: 'Keep folders and revisions queryable while durable object storage holds content.',
    body: [
      'Store file identity, owner, parent folder, name, current revision, status, size, and access rules in a metadata database. Immutable content blocks live in object storage. A revision manifest lists ordered block keys and checksums so a download can rebuild that version. Stable file IDs let a rename preserve identity and history.',
      'Metadata and object storage cannot share a simple database transaction. Create a pending revision, upload and verify its objects, then atomically publish the ready revision and a durable change-log entry. A transactional outbox can deliver notifications after commit. Reconcile orphaned objects and pending records before cleanup.',
    ],
    takeaways: ['Metadata describes and authorizes files; object storage holds bytes.', 'Publish only after required content is verified.'],
    diagramId: 'drive-metadata', scenario: 'The object arrived, but the API crashed before marking the revision ready. What should readers see?',
    scenarioAnswer: 'Serve the prior ready revision or a clear pending state. Reconciliation can verify and publish the new object or later clean it up.',
  },
  {
    id: 'drive-upload', title: 'Resume and verify uploads', eyebrow: '03 · Upload path',
    summary: 'Use a scoped upload session, chunks, checksums, and explicit finalization.',
    body: [
      'The client requests a session for a file and expected base revision. The API checks identity, write permission, and quota, then issues an expiring session or scoped storage permission. Numbered chunks let the client ask which byte ranges were accepted and resume only missing ranges after an interruption.',
      'At finalization, verify assembled size and checksum, inspect content according to policy, and record the ordered blocks. A content hash can help detect duplicates within an approved scope, but hash equality does not grant access. Compression helps some formats more than already-compressed media. Encrypt stored content and manage keys separately. Make finalization idempotent so a timed-out retry does not create two revisions.',
    ],
    takeaways: ['Resumable chunks save bandwidth; checksums detect corruption.', 'Durable receipt and published revision are separate states.'],
    diagramId: 'drive-upload', scenario: 'A 4 GB upload loses its connection near completion. How should it recover?',
    scenarioAnswer: 'Resume its authorized session, request accepted ranges, send missing chunks, then verify and finalize once.',
  },
  {
    id: 'drive-sync', title: 'Sync through a change log', eyebrow: '04 · Device convergence',
    summary: 'Treat notifications as wake-up signals and a durable cursor as recovery state.',
    body: [
      'Each committed change adds an ordered event for its account or namespace: file ID, revision, operation, and sequence. A device saves its last applied cursor. On reconnect it requests paginated changes after that cursor, applies them, and advances the cursor only after local state is durable. An expired cursor requires a consistent snapshot followed by later changes. Shared-file updates must enter each authorized recipient’s change view; revocation removes the file from that view without exposing new content.',
      'Push, long polling, or WebSocket can alert an online device that something changed. Signals may be duplicated or missed, so clients pull the authoritative change log. The receiving device fetches metadata, downloads only missing blocks, and rebuilds the revision. Access revocation must stop protected downloads even when an old object key is known.',
    ],
    takeaways: ['Durable cursors recover missed changes after offline periods.', 'Notifications prompt a pull; they are not the complete file state.'],
    diagramId: 'drive-sync', scenario: 'A laptop is offline for a week and misses thousands of pushes. How does it catch up?',
    scenarioAnswer: 'Request changes after its persisted cursor. If history expired, fetch a consistent snapshot and resume from its boundary.',
  },
  {
    id: 'drive-conflicts', title: 'Preserve competing edits', eyebrow: '05 · Versions and conflicts',
    summary: 'Compare the expected base revision so a later edit cannot silently erase another.',
    body: [
      'Each upload declares the revision it was based on. At commit, compare that base with the current revision. A match publishes a new immutable version; a mismatch preserves the submitted bytes as a conflict copy or draft. The user may compare, merge when the file format permits it, or choose a version. Silent last-writer-wins can destroy work.',
      'Retain revisions according to an explicit policy. Delta sync transfers changed blocks, but each manifest still needs enough references to reconstruct its revision. Renames, moves, and deletions can also conflict. Stable IDs and deletion tombstones prevent an offline copy from accidentally resurrecting a removed file. File sync is not a collaborative text protocol.',
    ],
    takeaways: ['Compare base revision at commit.', 'Keep both contents when automatic merge is unsafe.'],
    diagramId: 'drive-conflicts', scenario: 'A phone and laptop both edit revision 12 offline. The phone publishes 13 first. What happens to the laptop edit?',
    scenarioAnswer: 'Its expected base 12 conflicts with current 13. Preserve its bytes as a conflict copy or draft and offer explicit merge or choice.',
  },
  {
    id: 'drive-sharing', title: 'Authorize every path', eyebrow: '06 · Sharing and privacy',
    summary: 'Access rules must protect listings, metadata, and the actual content bytes.',
    body: [
      'A file can be private, shared with named people, or accessed through a scoped link. Store rules against stable IDs and define folder inheritance, link expiry, and whether viewers can download or reshare. Check current effective permission before listing, reading metadata, issuing a download capability, or accepting writes. A guessed object key must not bypass the API gate.',
      'Revocation should block new capabilities immediately. Short-lived signed URLs limit the life of previously issued links; strict immediate revocation may require online authorization at the serving edge. Cache keys and search results must respect effective access. Encrypt in transit and at rest, maintain keys, and audit sharing changes.',
    ],
    takeaways: ['Authorize every path exposing or changing protected data.', 'Define how quickly issued links and cached copies stop working after revocation.'],
    diagramId: 'drive-sharing', scenario: 'An owner removes a collaborator, but their download URL was issued ten minutes ago. What determines continued access?',
    scenarioAnswer: 'Token expiry and the serving path. Very short tokens or online checks are needed for rapid revocation; caches need matching controls.',
  },
  {
    id: 'drive-download', title: 'Deliver without wasted bytes', eyebrow: '07 · Download and caching',
    summary: 'Fetch authorized manifests and missing blocks while respecting access boundaries.',
    body: [
      'After checking access, the API returns a revision manifest and short-lived download capabilities. The client compares checksums against its local block cache, fetches missing objects, verifies them, and assembles them in order. Range requests and a nearby edge can help large downloads. Metadata and immutable blocks have different cache lifetimes.',
      'Content-addressed blocks are easy to cache, but current-revision pointers and file listings need invalidation or short lifetimes. Private files need authorization before content delivery. Account-scoped deduplication avoids cross-user information leaks from global content lookup. Cold storage can save space for old revisions but adds retrieval delay.',
    ],
    takeaways: ['Reuse verified blocks rather than transferring every file in full.', 'Cache and deduplication rules must preserve permissions.'],
    diagramId: 'drive-download', scenario: 'A file changes one block out of 100. What should a synchronized laptop transfer?',
    scenarioAnswer: 'Fetch the new manifest, reuse 99 verified local blocks, and download and verify only the changed block.',
  },
  {
    id: 'drive-operations', title: 'Recover the complete file', eyebrow: '08 · Reliability and operations',
    summary: 'Make failures visible across API, metadata, objects, notifications, and clients.',
    body: [
      'Replicate durable objects and metadata to meet a stated recovery target, and test restores. Replace a failed stateless API or upload worker; promote a metadata replica with awareness of replication lag. A notification outage delays discovery but cursor replay recovers changes. Use retry backoff and jitter to avoid reconnection storms.',
      'Trace an upload from chunks through verification, commit, change event, and another device’s download. Measure pending-upload age, checksum failures, change-log lag, cursor resets, sync convergence time, conflict rate, and restore success. Reconcile missing objects and orphaned blocks before garbage collection. Deletion must follow retention policy across revisions, backups, and links.',
    ],
    takeaways: ['A restore needs both metadata and required bytes.', 'Measure data integrity and end-to-end sync, not only API uptime.'],
    diagramId: 'drive-operations', scenario: 'Notifications stop for an hour while storage remains healthy. Are devices permanently inconsistent?',
    scenarioAnswer: 'No. Durable change-log cursors allow reconnect or periodic polling to catch up. Monitor lag and stagger retries.',
  },
];

export const driveQuestions: Question[] = [
  { id:'dq01', stepId:'drive-scope', difficulty:'Recall', prompt:'Which task is outside basic file synchronization?', options:['Download files','Track revisions','Merge simultaneous keystrokes in one document','Sync across devices'], correctIndex:2, explanation:'Real-time collaborative editing requires a different operation and conflict model.' },
  { id:'dq02', stepId:'drive-scope', difficulty:'Apply', prompt:'What best estimates new original storage per day?', options:['Accounts × free quota','Daily uploads × average file size','API server count × RAM','Number of folders'], correctIndex:1, explanation:'Actual uploads and sizes estimate occupied new bytes before versions and replicas.' },
  { id:'dq03', stepId:'drive-metadata', difficulty:'Recall', prompt:'Where does an ordered list of blocks for a revision belong?', options:['Revision manifest','Load balancer','DNS cache','Only push notification'], correctIndex:0, explanation:'The manifest maps a revision to ordered content objects and checksums.' },
  { id:'dq04', stepId:'drive-metadata', difficulty:'Diagnose', prompt:'Metadata says ready, but a required block was never stored. What failed?', options:['CDN placement','Publication before object verification','Folder sorting','Browser cookies'], correctIndex:1, explanation:'Ready status must follow verification of all required bytes.' },
  { id:'dq05', stepId:'drive-upload', difficulty:'Apply', prompt:'A mobile upload disconnects near completion. What should it do?', options:['Restart with a new file ID','Publish without checks','Resume missing ranges in the same session','Ask the CDN to infer bytes'], correctIndex:2, explanation:'The session records accepted ranges so only missing bytes transfer.' },
  { id:'dq06', stepId:'drive-upload', difficulty:'Diagnose', prompt:'Finalization times out after commit and the client retries. What avoids a duplicate revision?', options:['An idempotent session finalization key','Unbounded retries','Skipping metadata','A shorter CDN TTL'], correctIndex:0, explanation:'A retry of the same session should return the earlier commit result.' },
  { id:'dq07', stepId:'drive-sync', difficulty:'Recall', prompt:'What should a returning device request to recover missed events?', options:['Push history','Change log after its saved cursor','A CDN key','Only worker queue messages'], correctIndex:1, explanation:'The durable log and cursor recover changes missed while offline.' },
  { id:'dq08', stepId:'drive-sync', difficulty:'Apply', prompt:'A cursor is older than retained events. What should the device do?', options:['Assume nothing changed','Use only latest notification','Fetch a consistent snapshot and resume from its boundary','Delete local files'], correctIndex:2, explanation:'A snapshot reestablishes state when incremental history has expired.' },
  { id:'dq09', stepId:'drive-conflicts', difficulty:'Recall', prompt:'What must a new revision declare to detect a stale edit?', options:['Screen width','Expected base revision','CDN region','Open tab count'], correctIndex:1, explanation:'Compare the expected base with the current revision at commit.' },
  { id:'dq10', stepId:'drive-conflicts', difficulty:'Diagnose', prompt:'An offline device restores a deleted file on reconnect. What was likely omitted?', options:['A deletion tombstone','More upload bandwidth','Video transcoding','A CDN purge'], correctIndex:0, explanation:'Tombstones tell old devices that deletion was intentional.' },
  { id:'dq11', stepId:'drive-sharing', difficulty:'Recall', prompt:'Which operation needs checking effective permission?', options:['Only upload','Only listing','Only download','Listing, metadata reads, uploads, and downloads'], correctIndex:3, explanation:'Every path exposing or changing protected data needs authorization.' },
  { id:'dq12', stepId:'drive-sharing', difficulty:'Apply', prompt:'A shared link must stop working rapidly after revocation. What fits?', options:['A week-long signed URL','Online checks or very short tokens','Public immutable caching forever','Only hide the name'], correctIndex:1, explanation:'Long-lived capabilities remain valid until expiry without a serving-time check.' },
  { id:'dq13', stepId:'drive-download', difficulty:'Recall', prompt:'What identifies an immutable block within an authorized scope?', options:['Current filename alone','Content digest and block identity','Display name','Notification time'], correctIndex:1, explanation:'A digest identifies immutable bytes while access remains separately enforced.' },
  { id:'dq14', stepId:'drive-download', difficulty:'Apply', prompt:'One of 100 cached blocks changes. What does a delta-aware client need?', options:['All 100 again','New manifest and changed block','No manifest','Only a push payload'], correctIndex:1, explanation:'The manifest identifies order; verified unchanged blocks can be reused.' },
  { id:'dq15', stepId:'drive-operations', difficulty:'Recall', prompt:'Which metric shows whether devices actually catch up?', options:['API uptime only','Sync convergence time and change-log lag','App icon count','Extension count'], correctIndex:1, explanation:'A healthy API can coexist with delayed synchronization.' },
  { id:'dq16', stepId:'drive-operations', difficulty:'Diagnose', prompt:'Restored metadata references missing blocks. Why is restore incomplete?', options:['Metadata and content must recover together','More users must sign in','All names must change','Cache should be larger'], correctIndex:0, explanation:'A revision is usable only with its metadata and required bytes.' },
];
