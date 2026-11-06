import type { ReviewVariation } from "../../lib/review";

export const googleDriveReview: Record<string, ReviewVariation> = {
  "google-drive/drive-scope": {
    prompts: ["A law firm only needs clients to upload and download contracts from a browser. Which parts of a sync product could it skip, and why?", "A film-school file service sees modest upload starts per second, yet its upload servers run out of capacity. What might the estimate have missed?"],
    answer: "Sync is the expensive job, so upload and download alone may need only object storage and signed URLs, with no change log or device state. Size rates, bytes, and peaks separately, because long transfers of large files keep many sessions open despite a modest start rate.",
  },
  "google-drive/drive-metadata": {
    prompts: ["A podcast host stores recordings of several GB. What should renaming one actually change, and where should the name and audio live?", "A firmware service stores images in object storage and versions in a database. In what order do you publish a new version safely?"],
    answer: "Keep names, owners, and revisions in a metadata database and immutable blocks in object storage, so a rename updates one row. With no shared transaction, insert a pending revision, upload, verify each block, then commit the current revision. A crash leaves the old version live, but orphaned objects need reconciling.",
  },
  "google-drive/drive-upload": {
    prompts: ["You are designing a dashcam uploader for weak mobile networks. How would you choose chunk size, and what does each direction cost?", "A medical-imaging portal has received every chunk of a scan. What must still happen before it becomes a new version, and why?"],
    answer: "Small chunks resend less after a drop, but add requests and session state. Receiving every chunk is not publishing: finalization verifies size and checksum, applies content policy, and records the ordered blocks. It must be idempotent, so a timed-out retry cannot create a second revision.",
  },
  "google-drive/drive-sync": {
    prompts: ["A checkout terminal applies some price-file changes, then loses power before saving progress. What does it do on restart, and what makes that safe?", "A digital-signage vendor wants to put each new playlist file inside its push messages and remove the change log. Why is that risky?"],
    answer: "Each device durably saves a cursor, its last applied event, then pulls later changes and advances only once local state is durable, so applying twice must be harmless. Push can be lost or duplicated, so it only prompts that pull. If history has expired, start from a consistent snapshot.",
  },
  "google-drive/drive-conflicts": {
    prompts: ["Editors sharing a video project file keep losing work to whoever uploads last. What should the server check, and what happens to the losing upload?", "A reporting tool writes a rebuilt chart image for a dashboard every few minutes. Would you keep conflict copies for it, and what decides that?"],
    answer: "Have each upload declare its base revision and compare it with the current one at commit. A mismatch becomes a conflict copy or draft for a person to resolve, which costs attention as copies pile up. Last-writer-wins is reasonable for data that is cheap to regenerate.",
  },
  "google-drive/drive-sharing": {
    prompts: ["A university portal gives students signed URLs for lecture recordings. How would you choose their lifetime, and what does each choice cost?", "An HR portal checks permissions only on its document viewer page. What other routes could still expose salary files or their details?"],
    answer: "Check current effective permission on every path: listings, metadata, search, caches, downloads, and writes. A signed URL keeps working until expiry, so match its lifetime to how fast access must end. Short lifetimes add API calls and re-issuing; online checks at serving add a lookup and a dependency.",
  },
  "google-drive/drive-download": {
    prompts: ["A wiki export syncs in fixed-size blocks. Some small edits move a few MB and others nearly the whole file. What explains the difference?", "A team wants content-defined chunking for a store of encrypted media archives. What does it cost, and would it pay off here?"],
    answer: "Fixed blocks move little when bytes change in place, but an insertion shifts every later block, so nearly all must transfer. Content-defined chunking cuts by content, limiting changes to the edit’s neighborhood. It costs client CPU, variable chunks, and larger manifests, and gains little on compressed or encrypted data.",
  },
  "google-drive/drive-operations": {
    prompts: ["A photo-archive service must restore yesterday’s metadata backup after corruption. What breaks for recent uploads, synced devices, and cleanup jobs?", "A school’s file service reports perfect API uptime. Why does that not prove files are safe and syncing, and what would you measure?"],
    answer: "A restored database needs matching bytes: reconcile blocks with no rows, send a snapshot to devices with cursors ahead of the log, and make garbage collection wait past the oldest usable backup’s age. Healthy APIs can hide all this, so measure checksum failures, change-log lag, sync convergence, and restore success.",
  },
};
