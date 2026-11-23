import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "Count requests, not just searches": 2 million active people × 6 searches a day × 4 suggestion reads per search
// is 48 million reads a day, about 556/s on average; a tenfold busy hour makes about 5,600/s. At 300 bytes per
// five-suggestion response that is about 1.7 MB/s of egress, so latency and hot prefixes, not bandwidth, decide the
// design. A CDN edge answering half the reads leaves the origin about 2,800/s. Typing “camera” requests “ca”, “cam” and
// “came” (3 reads) before 1 search; the 12 million searches a day, about 139/s and 1.2 GB of logs a day at 100 bytes
// each, travel a separate path through the Collector into an event stream. Reads run in lane −1, searches in lane +1.
export const autocompleteTrafficStage: StageScene = {
  id: "autocomplete-traffic",
  intro: "Follow two million people’s typing into reads per second, then see which of those requests count as searches.",
  metrics: [
    { id: "origin", label: "Origin reads" },
    { id: "searches", label: "Searches" },
    { id: "egress", label: "Peak egress" },
  ],
  nodes: [
    { id: "users", role: "crowd", label: "Users", detail: "2M active", at: [0, 0] },
    { id: "cdn", role: "cdn", label: "CDN edge", detail: "short-lived lists", at: [0.85, -1], appear: 3 },
    { id: "api", role: "web", label: "Query API", detail: "suggestion reads", at: [2.08, -1] },
    { id: "collector", role: "web", label: "Collector", detail: "completed searches", at: [0.85, 1], appear: 4 },
    { id: "stream", role: "broker", label: "Event stream", detail: "append-only log", at: [2.08, 1], appear: 5, opts: { count: 3, items: 3 } },
  ],
  links: [
    { from: "users", to: "cdn" },
    { from: "cdn", to: "api" },
    { from: "users", to: "api", unless: "cdn" },
    { from: "users", to: "collector" },
    { from: "collector", to: "stream" },
  ],
  steps: [
    {
      title: "48 million suggestion reads a day",
      short: "Daily reads",
      text: "Two million active people make six searches a day each, and after debouncing the client sends four suggestion requests per search. That is 48 million reads a day, about 556 a second on average, all arriving at the Query API.",
      focus: ["users", "api"],
      frame: ["users", "api"],
      facts: [["People", "2 million"], ["Searches", "6 a day each"], ["Reads per search", "4"]],
      metrics: { origin: { n: 556, unit: "/s" } },
      changes: ["+ 48 million reads a day", "+ About 556/s on average"],
      events: [
        { type: "stream", every: 320, routes: [{ path: ["users", "api"] }] },
        { type: "note", node: "users", text: "6 searches × 4 reads", with: true },
        { type: "pause", ms: 700 },
        { type: "state", node: "api", light: "on", readout: "556/s avg" },
      ],
    },
    {
      title: "The busy hour runs ten times higher",
      short: "Peak",
      text: "Traffic isn’t spread evenly over the day. A tenfold busy-hour multiplier gives about 5,600 reads a second, and capacity has to meet the peak. These are illustrative assumptions: check real keystroke patterns, cache hits and regional peaks before sizing.",
      focus: ["users", "api"],
      frame: ["users", "api"],
      facts: [["Busy hour", "×10"], ["Peak", "about 5,600/s"]],
      metrics: { origin: { n: 5600, unit: "/s" } },
      changes: ["~ 556/s → about 5,600/s at peak"],
      events: [
        { type: "stream", every: 150, routes: [{ path: ["users", "api"] }] },
        { type: "note", node: "users", text: "busy hour ×10", with: true },
        { type: "pause", ms: 700 },
        { type: "state", node: "api", light: "on", readout: "5,600/s peak" },
      ],
    },
    {
      title: "Bandwidth is not the constraint",
      short: "Egress",
      text: "Each response carries five suggestions in about 300 bytes. At the peak, egress is 5,600 × 300 bytes, about 1.7 MB a second, so bandwidth won’t decide this design. Latency and hot prefixes will.",
      focus: ["users", "api"],
      frame: ["users", "api"],
      facts: [["Response", "300 bytes"], ["Peak egress", "1.7 MB/s"]],
      metrics: { egress: "1.7 MB/s" },
      changes: ["+ 1.7 MB/s out at peak", "~ Latency and hot prefixes decide"],
      events: [
        { type: "stream", every: 150, routes: [{ path: ["users", "api"] }, { path: ["api", "users"], kind: "response" }] },
        { type: "packet", path: ["api", "users"], label: "5 suggestions · 300 B", kind: "response" },
        { type: "note", node: "api", text: "latency, hot prefixes" },
      ],
    },
    {
      title: "A CDN edge halves the origin’s load",
      short: "Edge cache",
      text: "If a CDN edge or the browser cache answers half the reads, the origin peak at the Query API falls to about 2,800 a second. If only a few reads a second were expected, a database index on one server might be all you need.",
      focus: ["users", "cdn", "api"],
      frame: ["users", "cdn", "api"],
      facts: [["Answered at edge", "half the reads"], ["Origin peak", "about 2,800/s"]],
      metrics: { origin: { n: 2800, unit: "/s" } },
      changes: ["+ CDN edge", "~ Origin: 5,600/s → 2,800/s"],
      events: [
        {
          type: "stream", every: 150, routes: [
            { path: ["users", "cdn"], w: 1, kind: "work" },
            { path: ["users", "cdn", "api"], w: 1 },
          ],
        },
        { type: "state", node: "cdn", light: "work" },
        { type: "note", node: "cdn", text: "answers half", tone: "work", with: true },
        { type: "pause", ms: 500 },
        { type: "state", node: "api", readout: "2,800/s peak" },
      ],
    },
    {
      title: "Three reads make one search",
      short: "Reads vs searches",
      text: "A person typing “camera” may request “ca”, “cam” and “came” before submitting “camera”: three reads on the read path, but one search. The Collector records only the submitted search. Counting each prefix request as a search would fill popularity with partial words.",
      focus: ["users", "cdn", "api", "collector"],
      frame: ["users", "cdn", "api", "collector"],
      facts: [["Prefix reads", "3"], ["Search events", "1"]],
      changes: ["+ Collector", "+ 3 reads: “ca”, “cam”, “came”", "+ 1 search: “camera”"],
      // Each read is one message along the whole read path, so reduced motion rests one pill per read, all three on
      // the CDN edge → Query API cable, and the search rests alone on the Collector's cable. Their count sits over the
      // CDN edge, where the read path starts: level with "1 search" on a phone.
      events: [
        { type: "state", node: "users", detail: "one person typing" },
        { type: "packet", path: ["users", "cdn", "api"], label: "“ca”" },
        { type: "packet", path: ["users", "cdn", "api"], label: "“cam”", gap: 0 },
        { type: "packet", path: ["users", "cdn", "api"], label: "“came”", gap: 0 },
        { type: "packet", path: ["users", "collector"], label: "search “camera”", with: true },
        { type: "note", node: "cdn", text: "3 reads" },
        { type: "state", node: "collector", light: "on", with: true },
        { type: "note", node: "collector", text: "1 search", tone: "work", with: true },
      ],
    },
    {
      title: "Searches travel a separate path",
      short: "Search events",
      text: "Users submit 12 million searches a day, about 139 a second on average: 1.2 GB of logs a day at 100 bytes each. With consent and retention rules they feed popularity counts. The Event stream keeps collection and index building apart from the read-heavy path.",
      // No focus: the step is both paths side by side, and the search path stands out by its stream, readout and chip.
      // A dimmed Query API on the bottom row of a 375×667 phone would also be faded out as if off screen.
      frame: ["users", "cdn", "api", "collector", "stream"],
      facts: [["Searches", "12 million a day"], ["Logs", "1.2 GB a day"]],
      // 139/s is the daily average (the origin chip beside it is a peak), so the chip, the readout and the change say avg.
      metrics: { searches: { n: 139, unit: "/s avg" } },
      changes: ["+ Event stream", "+ About 139 searches/s on average", "~ Reads and searches kept apart"],
      events: [
        { type: "state", node: "users", detail: "2M active" },
        {
          type: "stream", every: 170, routes: [
            { path: ["users", "cdn"], w: 2, kind: "work" },
            { path: ["users", "cdn", "api"], w: 2 },
            { path: ["users", "collector", "stream"], w: 1 },
          ],
        },
        { type: "state", node: "collector", light: "on" },
        { type: "state", node: "stream", light: "on", readout: "139/s avg", with: true },
      ],
    },
  ],
};
