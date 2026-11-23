import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Define a useful suggestion": a timeline of the Client and the Query API. The contract first: “cam” in, five
// popular completed searches out, prefix only, “Café” folded to “cafe”. Then typing “camera” with no debounce sends 6
// requests; with an example 100 ms debounce, pauses after “cam” and “camera” send 2, tagged #1 and #2. #1’s reply lands
// after #2’s, so the Client shows #2 and drops #1. The example budget: a list within 200 ms of the request, minus an
// 80 ms mobile round trip and 20 ms of rendering, leaves the server 100 ms at p99. Last, a country picker of 200 fixed
// entries filters in the browser and calls nothing. A message's one-way trip is a beat (half the 80 ms round trip), so
// both debounce pauses and the server's share are 2.5 beats and the render half a beat; the stale-reply replay is not to
// scale (#1's reply takes 5 beats only to land late). No axis or clock: only the budget step is about durations.
export const autocompleteScopeStage: StageScene = {
  id: "autocomplete-scope",
  layout: "timeline",
  intro: "Watch “camera” typed into a search box: which keystrokes become requests, which answer stays on screen, and how long each part may take.",
  metrics: [
    { id: "requests", label: "Requests" },
    { id: "shows", label: "List shows" },
    { id: "server", label: "Server budget" },
  ],
  nodes: [
    { id: "client", role: "client", label: "Client", detail: "search box", at: [0, 0] },
    { id: "api", role: "web", label: "Query API", detail: "validates, filters", at: [1, 0] },
  ],
  links: [],
  steps: [
    {
      title: "A suggestion completes the typed prefix",
      short: "Contract",
      text: "Set the contract before choosing an index. The Client sends “cam”, and the Query API returns five popular completed searches that begin with it. Case and accents fold, so “Café” matches “cafe”; spell correction is a separate feature.",
      facts: [["Match", "prefix only"], ["Results", "5"], ["Normalize", "Café = cafe"]],
      metrics: { requests: 1, shows: "“cam”" },
      changes: ["+ “cam” sent", "+ 5 suggestions back"],
      events: [
        { type: "packet", path: ["client", "api"], label: "“cam”" },
        { type: "mark", node: "api", text: "prefix · top 5", tone: "work" },
        { type: "packet", path: ["api", "client"], label: "top 5", kind: "response" },
      ],
    },
    {
      title: "Every keystroke would send a request",
      short: "No debounce",
      text: "If every key fired a request, typing “camera” would send six of them, one per letter, from “c” through “camera”. That is the traffic a debounce cuts.",
      facts: [["Typed", "“camera”"], ["Requests", "6"]],
      metrics: { requests: 6, shows: "—" },
      changes: ["+ 6 requests, one per key"],
      // Keys go out in pairs: the second of each pair waits for the clock to reach its place, so they leave a beat apart.
      events: [
        { type: "rewind" },
        { type: "packet", path: ["client", "api"], label: "“c”", t: 0 },
        { type: "packet", path: ["client", "api"], label: "“ca”", t: 1, with: true },
        { type: "packet", path: ["client", "api"], label: "“cam”", t: 2, gap: 80 },
        { type: "packet", path: ["client", "api"], label: "“came”", t: 3, with: true },
        { type: "packet", path: ["client", "api"], label: "“camer”", t: 4, gap: 80 },
        { type: "packet", path: ["client", "api"], label: "“camera”", t: 5, with: true },
      ],
    },
    {
      title: "A 100 ms pause sends each request",
      short: "Debounce",
      text: "The Client debounces: it waits for a pause in typing before it sends. With an example 100 ms debounce, someone who pauses only after “cam” and “camera” sends two requests instead of six, each tagged with a sequence number.",
      facts: [["Debounce", "100 ms (example)"], ["Sent", "2 of 6"]],
      metrics: { requests: 2 },
      changes: ["+ 100 ms pause before sending", "+ “cam” #1", "+ “camera” #2"],
      events: [
        { type: "rewind" },
        { type: "mark", node: "client", text: "types “cam”", t: 0 },
        { type: "span", id: "pause1", node: "client", label: "100 ms pause", tone: "quiet", dur: 2.5, gap: 160 },
        { type: "span", id: "pause1", end: true, gap: 0 },
        { type: "packet", path: ["client", "api"], label: "“cam” #1", gap: 160 },
        { type: "mark", node: "client", text: "types “era”", t: 4.5, gap: 160 },
        { type: "span", id: "pause2", node: "client", label: "100 ms pause", tone: "quiet", dur: 2.5, gap: 160 },
        { type: "span", id: "pause2", end: true, gap: 0 },
        { type: "packet", path: ["client", "api"], label: "“camera” #2", gap: 160 },
      ],
    },
    {
      title: "The late answer for “cam” is dropped",
      short: "Stale reply",
      text: "Replies can arrive out of order. The reply to #1 is slow and lands after the reply to #2. Cancelling #1 can race a request that has already finished, so the Client shows only the newest sequence number: #2 stays, #1 is dropped.",
      facts: [["Shows", "#2, the newest"], ["Drops", "#1, stale"]],
      metrics: { requests: 2, shows: "“camera”" },
      changes: ["+ #2’s reply lands first", "~ #1’s late reply dropped"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["client", "api"], label: "“cam” #1", t: 0 },
        { type: "packet", path: ["client", "api"], label: "“camera” #2", t: 1.5, with: true },
        { type: "packet", path: ["api", "client"], label: "top 5 · #2", kind: "response", t: 2.5 },
        { type: "packet", path: ["api", "client"], label: "top 5 · #1", kind: "quiet", t: 1, dur: 5, with: true },
        { type: "mark", node: "client", text: "keeps #2, drops #1", tone: "quiet", t: 6 },
      ],
    },
    {
      title: "The server gets 100 ms of a 200 ms budget",
      short: "Latency budget",
      text: "Target a high percentile from keystroke to visible list, not a server average. In an example budget of 200 ms from the request, an 80 ms mobile round trip and 20 ms of rendering leave the server 100 ms at p99.",
      facts: [["Budget", "200 ms from request"], ["Network", "80 ms round trip"], ["Render", "20 ms"]],
      metrics: { server: { n: 100, unit: " ms" } },
      changes: ["+ 80 ms on the network", "+ 20 ms to render", "~ Server gets 100 ms"],
      events: [
        { type: "rewind" },
        { type: "packet", path: ["client", "api"], label: "“camera” #2", t: 0 },
        { type: "span", id: "server", node: "api", label: "server ≤100 ms", tone: "work", dur: 2.5 },
        { type: "span", id: "server", end: true, gap: 0 },
        { type: "packet", path: ["api", "client"], label: "top 5", kind: "response" },
        { type: "span", id: "render", node: "client", label: "render 20 ms", tone: "work", dur: 0.5 },
        { type: "span", id: "render", end: true, gap: 0 },
        { type: "mark", node: "client", text: "visible at 200 ms" },
      ],
    },
    {
      title: "A fixed list of 200 needs no server",
      short: "When not",
      text: "You may not need any of this. A country picker with 200 fixed entries ships its list with the page and filters it in the browser: no request to debounce, no stale reply to drop, no server budget.",
      facts: [["List", "200 entries"], ["Filter", "in the browser"]],
      metrics: { requests: 0, shows: "local matches", server: "none" },
      changes: ["+ 200 entries in the page", "~ No requests to the Query API"],
      events: [
        { type: "rewind" },
        { type: "mark", node: "client", text: "200 in the page", t: 0 },
        { type: "span", id: "filter", node: "client", label: "local filter", tone: "work", dur: 1 },
        { type: "span", id: "filter", end: true, gap: 0 },
        { type: "note", node: "api", text: "not called" },
      ],
    },
  ],
};
