import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Authorize every path": the Viewer lists a shared folder and the File API asks the Access check first, for
// the Viewer's effective permission (direct and inherited rules combined). Downloading budget.xlsx, the File API
// issues a URL signed for 15 minutes at 10:00, a capability that grants access to whoever holds it, and Object storage
// serves the bytes after checking the signature; a guessed object key with no signature gets nothing. At 10:05 the
// owner removes the Viewer: the Access check holds and the File API refuses a new URL at once. At 10:10 the 10:00 URL
// still returns the bytes, because storage checks only signature and expiry, so access lasts until 10:15, ten minutes
// after revocation. A search path that skips the check still shows budget.xlsx by name. Last, a control compares
// 15-minute URLs (open until 10:15), one-minute URLs (at most a minute, by 10:06, at the cost of re-issuing) and a
// check at the serving edge (closed at once, at the cost of a lookup on every read).
// The chapter's floor plan B: the Viewer in tier 0, the File API and Object storage side by side in tier 1 (two doors,
// since the Viewer takes a signed URL straight to storage), the Access check behind the File API and the Search index
// behind storage in tier 2. Storage has no link to the Access check: it never asks it, which is the lesson's point.
// The hops from the Viewer to the File API and on to the Access check are short, so with reduced motion a resting
// message must be short to clear the tags: those requests carry one or two words, their replies are unlabelled, and
// notes on the part that answers or receives say what came back. (Spacing the tiers out instead shrinks the 375 phone.)
// The plan puts the search step before the tradeoff (the lesson has the tradeoff first) so the control can come last.
export const driveSharingStage: StageScene = {
  id: "drive-sharing",
  intro: "Watch a shared file’s bytes keep flowing after the Viewer is removed, then choose how fast access should end.",
  metrics: [
    { id: "clock", label: "Clock" },
    { id: "expires", label: "URL expires" },
    { id: "after", label: "After revoke" },
  ],
  nodes: [
    { id: "viewer", role: "client", label: "Viewer", detail: "shared with", at: [0, 0] },
    { id: "api", role: "web", label: "File API", detail: "issues URLs", at: [1, -1] },
    { id: "storage", role: "storage", label: "Object storage", detail: "checks signature", at: [1, 1] },
    { id: "gate", role: "gate", label: "Access check", detail: "current rules", at: [2, -1], opts: { open: true } },
    { id: "search", role: "index", label: "Search index", detail: "file names", at: [2, 1], appear: 5 },
  ],
  links: [
    { from: "viewer", to: "api" },
    { from: "viewer", to: "storage" },
    { from: "api", to: "gate" },
    { from: "api", to: "search" },
  ],
  steps: [
    {
      title: "Every request passes the access check",
      short: "Check",
      text: "The Viewer asks the File API to list a shared folder. The File API first asks the Access check for the Viewer’s effective permission: direct and inherited rules combined. The same check comes before reading metadata, issuing a download URL or accepting a write.",
      focus: ["viewer", "api", "gate"],
      frame: ["viewer", "api", "storage", "gate"],
      facts: [["Permission", "direct + inherited"], ["Checked before", "list, read, URL, write"]],
      changes: ["+ List request", "~ Access check: allowed"],
      events: [
        { type: "packet", path: ["viewer", "api"], label: "list" },
        { type: "state", node: "api", light: "on" },
        { type: "packet", path: ["api", "gate"], label: "may list?" },
        { type: "state", node: "gate", light: "work" },
        { type: "note", node: "gate", text: "allowed", tone: "work", with: true },
        { type: "packet", path: ["api", "viewer"], label: "", kind: "response" },
        { type: "state", node: "api", light: "work", with: true },
      ],
    },
    {
      title: "A signed URL carries access to the bytes",
      short: "Signed URL",
      text: "The Viewer asks to download budget.xlsx. The check passes, and at 10:00 the File API returns a URL signed for 15 minutes: a capability, a token that grants access to whoever holds it. Object storage checks the signature and sends the bytes.",
      frame: ["viewer", "api", "storage", "gate"],
      facts: [["Issued", "10:00"], ["Lasts", "15 minutes"]],
      metrics: { clock: "10:00", expires: "10:15" },
      changes: ["+ Signed URL until 10:15", "+ Bytes from Object storage"],
      events: [
        { type: "state", nodes: ["api", "gate"], light: "idle" },
        { type: "packet", path: ["viewer", "api"], label: "get URL" },
        { type: "state", node: "api", light: "on" },
        { type: "state", node: "gate", light: "work", with: true },
        { type: "note", node: "api", text: "URL · 15 min", tone: "work", with: true },
        { type: "packet", path: ["api", "viewer"], label: "", kind: "response" },
        { type: "state", node: "api", light: "work", with: true },
        { type: "packet", path: ["viewer", "storage"], label: "GET + signature" },
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "signature ok", tone: "work", with: true },
        { type: "packet", path: ["storage", "viewer"], label: "", kind: "response" },
        { type: "state", node: "storage", light: "work", with: true },
        { type: "note", node: "viewer", text: "gets the bytes", tone: "work", gap: 0 },
      ],
    },
    {
      title: "A guessed object key gets nothing",
      short: "Guessed key",
      text: "Object keys can be guessed, so a key alone must open nothing. A request for a guessed key carries no valid signature, and Object storage refuses it. The bytes are reachable only through a URL the File API signed after its check.",
      focus: ["viewer", "storage"],
      frame: ["viewer", "api", "storage", "gate"],
      changes: ["~ Guessed key refused"],
      events: [
        { type: "state", nodes: ["api", "gate", "storage"], light: "idle" },
        { type: "packet", path: ["viewer", "storage"], label: "GET guessed key", lost: true },
        { type: "state", node: "storage", light: "on" },
        { type: "note", node: "storage", text: "no valid signature", with: true },
      ],
    },
    {
      title: "Revoked at 10:05: no new URLs",
      short: "Revoke",
      text: "At 10:05 the owner removes the Viewer, and the Access check’s rules change at once. When the Viewer asks for a new URL, the File API checks, gets a no and refuses. Revocation blocks new capabilities immediately.",
      focus: ["viewer", "api", "gate"],
      frame: ["viewer", "api", "storage", "gate"],
      facts: [["Revoked", "10:05"]],
      metrics: { clock: "10:05" },
      changes: ["− Viewer removed at 10:05", "~ New URLs refused"],
      events: [
        { type: "state", node: "storage", light: "idle" },
        { type: "state", node: "gate", light: "on", opts: { open: false }, with: true },
        { type: "note", node: "gate", text: "Viewer removed", with: true },
        { type: "state", node: "viewer", detail: "removed at 10:05", with: true },
        { type: "packet", path: ["viewer", "api"], label: "new URL" },
        { type: "state", node: "api", light: "on" },
        { type: "packet", path: ["api", "gate"], label: "may read?" },
        { type: "packet", path: ["api", "viewer"], label: "", kind: "quiet" },
        { type: "note", node: "api", text: "no new URL", with: true },
      ],
    },
    {
      title: "The old URL still works until 10:15",
      short: "Old URL",
      text: "At 10:10 the Viewer reuses the URL issued at 10:00, and Object storage still sends the bytes. Storage checks the signature and expiry, not the current sharing rules, so access lasts until 10:15: ten minutes after revocation. S3 presigned URLs behave this way.",
      focus: ["viewer", "storage"],
      frame: ["viewer", "api", "storage", "gate"],
      facts: [["Issued", "10:00"], ["Revoked", "10:05"], ["Expires", "10:15"]],
      metrics: { clock: "10:10", after: { n: 10, unit: " min", tone: "hot" } },
      changes: ["~ 10:00 URL still works", "~ Open 10 min after revoke"],
      events: [
        { type: "state", node: "api", light: "idle" },
        { type: "packet", path: ["viewer", "storage"], label: "GET, 10:00 URL" },
        { type: "state", node: "storage", light: "hot" },
        { type: "note", node: "storage", text: "rules not checked", tone: "hot", with: true },
        { type: "packet", path: ["storage", "viewer"], label: "", kind: "hot" },
        { type: "note", node: "viewer", text: "still gets the bytes", tone: "hot", gap: 0 },
      ],
    },
    {
      title: "Search must check access too",
      short: "Search",
      text: "The File API sends the Viewer’s search for “budget” to the Search index, which returns budget.xlsx without asking the Access check. Search results and cache keys must respect effective access, or a removed collaborator can still find a file by name.",
      focus: ["viewer", "api", "gate", "search"],
      frame: ["viewer", "api", "storage", "gate", "search"],
      changes: ["+ Search index", "~ Name found without the check"],
      events: [
        { type: "show", nodes: ["search"] },
        { type: "state", node: "storage", light: "idle", with: true },
        { type: "packet", path: ["viewer", "api"], label: "" },
        { type: "state", node: "api", light: "on" },
        { type: "packet", path: ["api", "search"], label: "budget" },
        { type: "state", node: "search", light: "on", opts: { mark: 4 } },
        { type: "packet", path: ["search", "api", "viewer"], label: "", kind: "hot" },
        { type: "state", node: "search", light: "hot", with: true },
        { type: "note", node: "search", text: "skipped the check", tone: "hot", with: true },
        { type: "note", node: "viewer", text: "finds budget.xlsx", tone: "hot", gap: 0 },
      ],
    },
    {
      title: "Shorter URLs, or a check at the edge",
      short: "Revocation speed",
      text: "Pick how fast access ends. With 15-minute URLs the old one works until 10:15. One-minute URLs cut that to a minute but mean more API calls and re-issuing during long downloads. An edge check ends access at once but adds a lookup and a dependency to every read.",
      focus: ["viewer", "api", "storage", "gate"],
      frame: ["viewer", "api", "storage", "gate", "search"],
      facts: [["15-min URL", "open to 10:15"], ["1-min URL", "open ≤1 min"], ["Edge check", "closed at once"]],
      changes: ["~ How long the old URL lasts"],
      events: [
        { type: "state", nodes: ["api", "search"], light: "idle" },
      ],
      control: {
        label: "Revocation",
        options: [
          {
            label: "15 min",
            metrics: { expires: "10:15", after: { n: 10, unit: " min", tone: "hot" } },
            events: [
              { type: "state", node: "storage", detail: "checks signature", light: "idle" },
              { type: "state", node: "api", readout: "", light: "idle", with: true },
              { type: "packet", path: ["viewer", "storage"], label: "GET, 10:00 URL" },
              { type: "state", node: "storage", light: "hot" },
              { type: "note", node: "storage", text: "valid until 10:15", tone: "hot", with: true },
              { type: "packet", path: ["storage", "viewer"], label: "", kind: "hot" },
              { type: "note", node: "viewer", text: "still gets the bytes", tone: "hot", gap: 0 },
            ],
          },
          {
            label: "1 min",
            metrics: { expires: "≤10:06", after: "≤1 min" },
            events: [
              { type: "state", node: "storage", detail: "1-min URLs", light: "idle" },
              { type: "state", node: "api", readout: "re-issues each min", light: "on", with: true },
              { type: "packet", path: ["viewer", "storage"], label: "GET, last URL", lost: true },
              { type: "state", node: "storage", light: "on" },
              { type: "note", node: "storage", text: "expired by 10:06", with: true },
            ],
          },
          {
            label: "Edge check",
            metrics: { expires: "10:15", after: { n: 0, unit: " min" } },
            events: [
              { type: "state", node: "storage", detail: "checks rules live", light: "idle" },
              { type: "state", node: "api", readout: "", light: "idle", with: true },
              { type: "packet", path: ["viewer", "storage"], label: "GET, 10:00 URL", lost: true },
              { type: "state", node: "storage", light: "on" },
              { type: "note", node: "storage", text: "lookup per read", with: true },
            ],
          },
        ],
      },
    },
  ],
};
