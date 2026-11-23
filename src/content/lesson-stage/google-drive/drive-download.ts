import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Deliver without wasted bytes": the Laptop asks the File API to sync a 400 MB file stored as 100 fixed 4 MB
// blocks. After checking access, the File API returns the revision manifest (100 block hashes, in order) with
// short-lived download URLs. An in-place edit changed one block: 99 of 100 hashes match the Laptop's local block cache,
// so it fetches one block from Object storage, 4 MB instead of 400 MB, verifies it and assembles the file in order
// (delta sync). One byte inserted near the start shifts every later byte, so every later fixed block gets a new hash
// and nearly all 400 MB moves again. Content-defined chunks (a rolling hash cuts where it matches a pattern; about
// 4 MB on average, example) keep the change to the 2 chunks near the edit, about 8 MB; restic and Borg chunk this way.
// The costs: client CPU, variable chunk sizes, a larger manifest, and little gain on compressed or encrypted files.
// A CDN edge keeps chunks named by their hash (9c1e, example), which never change, while the current-revision pointer
// gets a short lifetime and the signed URL still authorizes the private file. Last, a control compares dedup scoped
// to the account with a global "already stored" reply, which tells anyone holding a file's hash that it exists.
// The chapter's floor plan B: the Laptop in tier 0, the File API and Object storage side by side in tier 1, the
// Manifest behind the File API in tier 2. In step 6 the CDN edge takes storage's place in front and Object storage
// steps back to tier 2. The plan's step 6 drops its second request answered by the edge (the Laptop already holds the
// chunk it fetched, so it wouldn't ask again), and the dedup step gets a control so the leak shows in the picture.
export const driveDownloadStage: StageScene = {
  id: "drive-download",
  intro: "Watch a laptop sync a 400 MB file by fetching only what changed, then see one inserted byte undo the saving.",
  metrics: [
    { id: "bytes", label: "To download" },
    { id: "changed", label: "Changed" },
  ],
  nodes: [
    { id: "laptop", role: "client", label: "Laptop", detail: "local block cache", at: [0, 0] },
    { id: "api", role: "web", label: "File API", detail: "checks access", at: [1, -1] },
    { id: "storage", role: "storage", label: "Object storage", detail: "4 MB blocks", at: [1, 1] },
    { id: "manifest", role: "doc", label: "Manifest", detail: "100 block hashes", at: [2, -1], opts: { count: 2 } },
    { id: "cdn", role: "cdn", label: "CDN edge", detail: "caches by hash", at: [1, 1], appear: 5 },
  ],
  links: [
    { from: "laptop", to: "api" },
    { from: "api", to: "manifest" },
    { from: "laptop", to: "storage", unless: "cdn" },
    { from: "laptop", to: "cdn" },
    { from: "cdn", to: "storage" },
  ],
  steps: [
    {
      title: "Check access, then send the manifest",
      short: "Manifest",
      text: "The Laptop asks the File API to sync a 400 MB file. The File API checks access first, then reads the revision manifest: 100 block hashes in order. It returns the manifest with short-lived download URLs.",
      focus: ["laptop", "api", "manifest"],
      frame: ["laptop", "api", "storage", "manifest"],
      facts: [["File", "400 MB"], ["Blocks", "100 × 4 MB"]],
      changes: ["+ Access checked", "+ Manifest and download URLs"],
      events: [
        { type: "packet", path: ["laptop", "api"], label: "sync the file" },
        { type: "state", node: "api", light: "on" },
        { type: "note", node: "api", text: "access ok", tone: "work", with: true },
        { type: "packet", path: ["api", "manifest"], label: "read manifest" },
        { type: "state", node: "manifest", light: "on" },
        { type: "packet", path: ["manifest", "api"], label: "100 hashes", kind: "response" },
        { type: "packet", path: ["api", "laptop"], label: "manifest + URLs", kind: "response" },
        { type: "state", node: "api", light: "work", with: true },
        { type: "note", node: "laptop", text: "manifest + URLs", tone: "work", with: true },
      ],
    },
    {
      title: "Reuse 99 blocks, fetch the changed one",
      short: "Delta sync",
      text: "An in-place edit changed one block. The Laptop compares the manifest’s hashes with its local block cache, and 99 of 100 match. It fetches only the changed block, 4 MB instead of 400 MB, verifies it and assembles the blocks in order. This is delta sync.",
      focus: ["laptop", "storage", "manifest"],
      frame: ["laptop", "api", "storage", "manifest"],
      metrics: { bytes: { n: 4, unit: " MB" }, changed: "1 block" },
      facts: [["Reused", "99 blocks"], ["Fetched", "1 block, 4 MB"]],
      changes: ["~ 99 blocks reused", "+ 1 block fetched and verified"],
      events: [
        { type: "state", node: "api", light: "idle" },
        { type: "state", node: "manifest", light: "on", readout: "1 of 100 new", with: true },
        { type: "state", node: "laptop", light: "on", with: true },
        { type: "packet", path: ["laptop", "storage"], label: "GET 1 block" },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["storage", "laptop"], label: "4 MB", kind: "response" },
        { type: "state", node: "storage", light: "work", with: true },
        { type: "state", node: "laptop", light: "work" },
        { type: "note", node: "laptop", text: "99 reused, 1 verified", tone: "work", with: true },
      ],
    },
    {
      title: "One inserted byte shifts every later block",
      short: "Insertion",
      text: "Now one byte is inserted near the start. Fixed blocks are cut every 4 MB, so every later byte shifts by one: each later block holds different bytes and gets a new hash. The Laptop matches almost nothing and downloads nearly all 400 MB again.",
      focus: ["laptop", "storage", "manifest"],
      frame: ["laptop", "api", "storage", "manifest"],
      metrics: { bytes: { n: 400, unit: " MB", tone: "hot" }, changed: "nearly all" },
      facts: [["Edit", "1 byte inserted"], ["Cut at", "every 4 MB"]],
      changes: ["~ Every later block shifts", "+ Nearly all 400 MB again"],
      events: [
        { type: "state", nodes: ["laptop", "storage"], light: "idle" },
        { type: "state", node: "manifest", light: "hot", tone: "hot", readout: "nearly all new", with: true },
        { type: "note", node: "laptop", text: "every later hash changed", tone: "hot" },
        { type: "state", node: "storage", light: "on", with: true },
        { type: "stream", every: 200, routes: [{ path: ["storage", "laptop"], kind: "hot" }] },
      ],
    },
    {
      title: "Cut chunks where the content says",
      short: "Content chunks",
      text: "Content-defined chunking slides a rolling hash over the file and cuts wherever it matches a chosen pattern, so boundaries follow the content. After the same insertion only the 2 chunks near it change: about 8 MB. The backup tools restic and Borg chunk this way.",
      focus: ["laptop", "storage", "manifest"],
      frame: ["laptop", "api", "storage", "manifest"],
      metrics: { bytes: { n: 8, unit: " MB" }, changed: "2 chunks" },
      facts: [["Cut where", "the rolling hash matches"], ["Average chunk", "4 MB"]],
      changes: ["~ Boundaries follow the content", "+ 2 chunks, about 8 MB"],
      events: [
        { type: "state", node: "storage", light: "idle", detail: "content chunks" },
        { type: "state", node: "manifest", light: "work", tone: "", detail: "chunk hashes", readout: "2 chunks new", with: true },
        { type: "state", node: "laptop", light: "on", with: true },
        { type: "packet", path: ["laptop", "storage"], label: "GET 2 chunks" },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["storage", "laptop"], label: "8 MB", kind: "response" },
        { type: "state", node: "storage", light: "work", with: true },
        { type: "state", node: "laptop", light: "work" },
        { type: "note", node: "laptop", text: "2 new, the rest reused", tone: "work", with: true },
      ],
    },
    {
      title: "Content chunks cost CPU and manifest size",
      short: "Costs",
      text: "The Laptop spends CPU running the rolling hash, chunks come in variable sizes, and the Manifest grows larger. Chunking also gains little on compressed or encrypted files, where a small edit can change most later bytes.",
      focus: ["laptop", "storage", "manifest"],
      frame: ["laptop", "api", "storage", "manifest"],
      facts: [["Client CPU", "rolling hash"], ["Little gain on", "compressed, encrypted"]],
      changes: ["+ Client CPU for the rolling hash", "~ Variable chunk sizes", "~ Larger manifest"],
      events: [
        { type: "state", node: "storage", light: "idle" },
        { type: "state", node: "laptop", light: "on", with: true },
        { type: "note", node: "laptop", text: "rolling hash: CPU" },
        { type: "state", node: "manifest", light: "on", readout: "grows larger", opts: { count: 3 } },
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "variable chunk sizes", with: true },
      ],
    },
    {
      title: "Chunks named by their hash cache safely",
      short: "Edge cache",
      text: "A CDN edge stands in front of Object storage. Each chunk is named by the hash of its bytes, so it never changes and the edge can keep it. The signed URL still authorizes this private file. The current-revision pointer changes, so it gets a short lifetime.",
      focus: ["laptop", "cdn", "storage", "api"],
      frame: ["laptop", "api", "cdn", "storage", "manifest"],
      metrics: { bytes: "—", changed: "—" },
      changes: ["+ CDN edge", "+ Chunk kept at the edge", "~ Current revision: short lifetime"],
      events: [
        { type: "state", nodes: ["laptop", "storage"], light: "idle" },
        { type: "state", node: "manifest", light: "idle", readout: "", with: true },
        { type: "show", nodes: ["cdn"], at: { storage: [2, 1] }, with: true },
        { type: "packet", path: ["laptop", "cdn", "storage"], label: "GET 9c1e, signed" },
        { type: "state", node: "storage", light: "on" },
        { type: "packet", path: ["storage", "cdn", "laptop"], label: "9c1e", kind: "response" },
        { type: "state", node: "cdn", light: "work" },
        { type: "note", node: "cdn", text: "kept, never stale", tone: "work", with: true },
        { type: "note", node: "api", text: "rev: short TTL", with: true },
      ],
    },
    {
      title: "Dedupe within an account, not across",
      short: "Dedup scope",
      text: "Before an upload, the Laptop asks whether the file with hash 7a3f is already stored. Scoped to this account, the File API’s answer says nothing about anyone else. Switch to all accounts: “already stored” then tells anyone holding a file’s hash that someone has that exact file.",
      focus: ["laptop", "api"],
      frame: ["laptop", "api", "cdn", "storage", "manifest"],
      facts: [["This account", "reveals nothing"], ["All accounts", "reveals the file exists"]],
      changes: ["~ Dedup checks one account", "~ No signal about other accounts"],
      events: [
        { type: "state", nodes: ["cdn", "storage"], light: "idle" },
      ],
      control: {
        label: "Dedup scope",
        options: [
          {
            label: "This account",
            events: [
              { type: "state", node: "api", light: "idle", tone: "" },
              { type: "packet", path: ["laptop", "api"], label: "already stored? 7a3f" },
              { type: "state", node: "api", light: "on" },
              { type: "note", node: "api", text: "this account", with: true },
              { type: "packet", path: ["api", "laptop"], label: "not in your account", kind: "response" },
              { type: "state", node: "api", light: "work", with: true },
              { type: "note", node: "laptop", text: "learns nothing", tone: "work", with: true },
            ],
          },
          {
            label: "All accounts",
            events: [
              { type: "state", node: "api", light: "idle", tone: "" },
              { type: "packet", path: ["laptop", "api"], label: "already stored? 7a3f" },
              { type: "state", node: "api", light: "hot" },
              { type: "note", node: "api", text: "all accounts", with: true },
              { type: "packet", path: ["api", "laptop"], label: "already stored", kind: "hot" },
              { type: "note", node: "laptop", text: "learns it exists", tone: "hot", with: true },
            ],
          },
        ],
      },
    },
  ],
};
