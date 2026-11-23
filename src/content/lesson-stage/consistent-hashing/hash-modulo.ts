import type { StageScene } from "../../../lib/lesson-stage/types";

// Lesson "See why modulo causes churn": app servers pick one of four caches by hash(key) mod 4 (key 14 → Cache 2,
// key 17 → Cache 1); Cache 3 fails and the rule becomes mod 3, so 14 stays but 17 misses on a healthy cache; about 75% of
// keys remap and the database goes from 10,000 to 77,500 reads/s; a new Cache 3 (3 → 4) moves 75% of keys again.
// Places: the caches stand 1.25 lanes apart and the tiers 1.2 apart, so a phone's row of four caches fits at a readable
// zoom (390 and 375 wide); the app servers sit 0.3 lane up and the database 0.15 lane down: on a wide screen the outer
// links then reach the tilted column of caches without hooking round the Database's tag, and on a phone the Database
// stays near the middle of the row, so its load pill doesn't push Cache 2's link round the far side.
export const hashModuloStage: StageScene = {
  id: "hash-modulo",
  intro: "Watch four caches share keys by hash(key) mod 4, then see one failure send most reads to the database.",
  metrics: [{ id: "rule", label: "Rule" }, { id: "moved", label: "Keys moved" }, { id: "db", label: "Database reads" }],
  nodes: [
    { id: "app", role: "web", label: "App servers", detail: "hash(key) mod 4", at: [0, -0.3], opts: { many: true } },
    { id: "c0", role: "cache", label: "Cache 0", at: [1.2, -1.875] },
    { id: "c1", role: "cache", label: "Cache 1", at: [1.2, -0.625] },
    { id: "c2", role: "cache", label: "Cache 2", at: [1.2, 0.625] },
    { id: "c3", role: "cache", label: "Cache 3", at: [1.2, 1.875] },
    { id: "db", role: "database", label: "Database", detail: "backing store", at: [2.4, 0.15] },
  ],
  links: [
    { from: "app", to: "c0" },
    { from: "app", to: "c1" },
    { from: "app", to: "c2" },
    { from: "app", to: "c3" },
    { from: "c0", to: "db" },
    { from: "c1", to: "db" },
    { from: "c2", to: "db" },
    { from: "c3", to: "db" },
  ],
  steps: [
    {
      title: "Hash mod 4 picks each key’s cache",
      short: "Hash mod 4",
      text: "Each app server picks a cache with hash(key) mod 4, sharing nothing but N. A key hashing to 14 gives 14 mod 4 = 2, so it lives on Cache 2; key 17 gives 1, so Cache 1. Kafka’s default partitioner uses the same idea, since partition counts rarely change.",
      focus: ["app", "c1", "c2"],
      frame: ["app", "c0", "c1", "c2", "c3"],
      facts: [["Rule", "hash(key) mod 4"], ["Key 14", "14 mod 4 = 2"], ["Key 17", "17 mod 4 = 1"]],
      metrics: { rule: "mod 4" },
      changes: ["+ Key 14 on Cache 2", "+ Key 17 on Cache 1"],
      events: [
        // The app servers do the arithmetic, so it floats over them, and the two caches it picks light up. The Database
        // isn't framed: with it, a 375 phone hasn't the height for a note at 10 px. A note over Cache 1 or 2 would sit
        // just under the tag of the cache above it on a wide screen, so the caches carry none here.
        { type: "note", node: "app", text: "mod 4: 14 → 2, 17 → 1" },
        { type: "packet", path: ["app", "c2"], label: "get key 14" },
        { type: "state", node: "c2", light: "on" },
        { type: "packet", path: ["app", "c1"], label: "get key 17" },
        { type: "state", node: "c1", light: "on" },
      ],
    },
    {
      title: "Normal load: 90% of reads hit",
      short: "Normal load",
      text: "The app servers send 100,000 reads a second, spread evenly over the four caches. 90% hit, and the 10% that miss go on to the Database: 10,000 reads a second.",
      facts: [["Reads", "100,000/s"], ["Hit rate", "90%"]],
      metrics: { db: { n: 10000, unit: "/s" } },
      changes: ["+ 100,000 reads/s", "~ 90% hit a cache", "+ 10,000/s at the Database"],
      events: [
        { type: "state", nodes: ["c0", "c1", "c2", "c3"], light: "work" },
        // 10,000 of the 77,500 the storm brings later, so the tank's two levels compare honestly
        { type: "state", node: "db", light: "on", readout: "10,000 reads/s", meter: 0.13, with: true },
        {
          // 9 hits to 1 miss on every cache; the hits come last so a still picture shows them on the caches' links
          type: "stream", every: 190, routes: [
            { path: ["app", "c0", "db"], w: 1 }, { path: ["app", "c1", "db"], w: 1 },
            { path: ["app", "c2", "db"], w: 1 }, { path: ["app", "c3", "db"], w: 1 },
            { path: ["app", "c0"], w: 9, kind: "work" }, { path: ["app", "c1"], w: 9, kind: "work" },
            { path: ["app", "c2"], w: 9, kind: "work" }, { path: ["app", "c3"], w: 9, kind: "work" },
          ],
        },
      ],
    },
    {
      title: "Cache 3 fails and the rule becomes mod 3",
      short: "Cache 3 fails",
      text: "Cache 3 fails, and the service switches to hash(key) mod 3. Key 14 stays put: 14 mod 4 and 14 mod 3 are both 2, so its read still hits Cache 2. Not every key moves.",
      focus: ["app", "c2", "c3"],
      frame: ["app", "c0", "c1", "c2", "c3"],
      facts: [["Rule", "hash(key) mod 3"], ["Key 14", "14 mod 3 = 2: stays"]],
      metrics: { rule: "mod 3" },
      changes: ["− Cache 3", "~ Rule: mod 4 → mod 3", "~ Key 14 stays on Cache 2"],
      events: [
        // The Database isn't framed, so a 375 phone has the height for the notes; its pill goes, or a wide screen,
        // framing the same parts, would cut it at the stage's edge. Cache 1 is dimmed, so the note over Cache 2 can't
        // be read as its own.
        { type: "state", nodes: ["c0", "c1", "c2"], light: "idle" },
        { type: "state", node: "db", readout: "", meter: null, with: true },
        { type: "state", node: "c3", down: true, light: "hot", tone: "hot", with: true },
        { type: "state", node: "app", detail: "hash(key) mod 3", light: "on" },
        { type: "note", node: "app", text: "14 mod 3 = 2", with: true },
        { type: "packet", path: ["app", "c2"], label: "get key 14" },
        { type: "note", node: "c2", text: "hit", tone: "work" },
        { type: "state", node: "c2", light: "work", with: true },
        { type: "packet", path: ["c2", "app"], label: "key 14", kind: "response" },
      ],
    },
    {
      title: "Key 17 moves to a cache without it",
      short: "Key 17 moves",
      text: "Key 17 now gives 17 mod 3 = 2, so it moves from Cache 1 to Cache 2, a healthy cache that doesn’t have it. The read misses, goes on to the Database, and Cache 2 keeps a copy. Cache 1 never failed, yet its key moved.",
      focus: ["app", "c1", "c2", "db"],
      frame: ["app", "c0", "c1", "c2", "c3", "db"],
      facts: [["Key 17", "17 mod 3 = 2"], ["Was on", "Cache 1, healthy"]],
      changes: ["~ Key 17: Cache 1 → Cache 2", "+ 1 miss to the Database", "+ Key 17 copied to Cache 2"],
      events: [
        // Pills, not notes: with all three rows framed, a 375 phone has no height for notes, and a note over Cache 2
        // would sit under Cache 1's tag on a wide screen. Cache 1 can carry a pill (its link comes straight down on a
        // phone); a pill over Cache 2 would bend its link round the app servers, so the miss shows where it lands.
        { type: "state", nodes: ["c0", "c2"], light: "idle" },
        { type: "state", node: "c1", light: "on", readout: "has 17", with: true },
        { type: "packet", path: ["app", "c2"], label: "get key 17" },
        { type: "packet", path: ["c2", "db"], label: "read key 17" },
        { type: "state", node: "db", light: "on", readout: "miss from Cache 2", meter: null },
        { type: "packet", path: ["db", "c2", "app"], label: "key 17", kind: "response" },
        { type: "state", node: "c2", light: "work", with: true },
      ],
    },
    {
      title: "Most keys remap at once",
      short: "Miss storm",
      text: "With the survivors keeping their numbers, about 75% of keys now map to a different cache, spread over all three. Their 75,000 reads a second miss at once, and the other 25,000 add 2,500 ordinary misses: 77,500 a second at the Database, nearly eight times normal.",
      facts: [["Keys moved", "about 75%"], ["Misses", "75,000 + 2,500/s"], ["Database", "77,500/s, ≈ 8×"]],
      metrics: { moved: { n: 75, unit: "%", tone: "hot" }, db: { n: 77500, unit: "/s", tone: "hot" } },
      changes: ["~ About 75% of keys remap", "+ 75,000 misses/s", "~ Database: 10,000 → 77,500/s"],
      events: [
        { type: "state", nodes: ["c0", "c1", "c2"], light: "on", readout: "" },
        { type: "state", node: "app", light: "on", with: true },
        { type: "state", node: "db", light: "hot", readout: "77,500/s ≈ 8× normal", meter: 1, tone: "hot", with: true },
        // a third of the reads each; per cache 7.5% hit and 25.8% miss (9 to 31): 22,500 hits, 77,500 misses
        {
          type: "stream", every: 170, routes: [
            { path: ["app", "c0"], w: 9, kind: "work" }, { path: ["app", "c1"], w: 9, kind: "work" },
            { path: ["app", "c2"], w: 9, kind: "work" },
            { path: ["app", "c0", "db"], w: 31, kind: "hot" }, { path: ["app", "c1", "db"], w: 31, kind: "hot" },
            { path: ["app", "c2", "db"], w: 31, kind: "hot" },
          ],
        },
      ],
    },
    {
      title: "Adding a cache moves most keys too",
      short: "Adding a cache",
      text: "After the caches refill, a new, empty Cache 3 makes it mod 4: 75% of keys move again, another miss storm. N to N+1 keeps only about 1 key in N+1, so 9 to 10 moves about 90%. A durable store must migrate them. Modulo suits stable membership or a cheap cold start.",
      facts: [["N → N+1", "about 1 in N+1 stays"], ["3 → 4", "75% move"], ["9 → 10", "about 90% move"]],
      metrics: { rule: "mod 4", moved: { n: 75, unit: "%", tone: "hot" } },
      changes: ["+ New, empty Cache 3", "~ Rule: mod 3 → mod 4", "~ 75% of keys move again"],
      events: [
        // the refilled caches bring the database back to normal before the new cache sets off a second storm
        { type: "state", nodes: ["c0", "c1", "c2"], light: "work" },
        { type: "state", node: "db", light: "on", readout: "10,000 reads/s", meter: 0.13, tone: "", with: true },
        { type: "state", node: "c3", down: false, light: "on", tone: "", detail: "new, empty", gap: 500 },
        { type: "state", node: "app", detail: "hash(key) mod 4", with: true },
        { type: "state", nodes: ["c0", "c1", "c2"], light: "on" },
        { type: "state", node: "db", light: "hot", readout: "77,500/s ≈ 8× normal", meter: 1, tone: "hot", with: true },
        // a quarter of the reads each; the empty Cache 3 misses all of its quarter, the others hit 7.5% and miss 17.5%
        {
          type: "stream", every: 170, routes: [
            { path: ["app", "c0"], w: 3, kind: "work" }, { path: ["app", "c1"], w: 3, kind: "work" },
            { path: ["app", "c2"], w: 3, kind: "work" },
            { path: ["app", "c0", "db"], w: 7, kind: "hot" }, { path: ["app", "c1", "db"], w: 7, kind: "hot" },
            { path: ["app", "c2", "db"], w: 7, kind: "hot" }, { path: ["app", "c3", "db"], w: 10, kind: "hot" },
          ],
        },
      ],
    },
  ],
};
