# Pictogram catalogue

Every part a lesson stage can draw. Each is a small isometric drawing of a real object whose working is the idea (a breaker trips, a lease runs down like a parking meter, a log is a strip that only grows), made in code from the kit in `src/lib/lesson-stage/draw.ts`, in the page's neutrals plus the one status light.

- **Using a part in a scene:** set a node's `role` to an id below and, if you like, its `opts`. That's all: the stage loads the pack that draws it. Don't import drawings in a scene.
- **Names:** the name here is only a default; give each node its own `label` ("Push service", "T1", "Shard B").
- **Options:** a role reads only the options listed for it; `npm run check:content -- <chapter>` rejects others and out-of-range values. `lead` (the leader's flag) works on every role. A picked element (`mark`) is pulled out or raised and carries a light that follows the part's status colour.
- **Status light:** every part has one. `state` events set it: `on` (ink), `work` (blue), `hot` (orange). Roles marked *fills* also take the part's `meter` as their `level`.
- **Packs:** the core set loads with every stage; a lesson page loads a pack only when its scene uses one of that pack's parts.

The list lives in `src/lib/lesson-stage/roles.ts` (names, heights, packs, options); the drawings in `pictograms.ts` (core) and `packs/<pack>.ts`.

## Core (every stage)

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `client` | Client | A laptop: recessed screen, keyboard in a pocket, trackpad | `many` (two laptops) | everywhere |
| `crowd` | Users | People, shaded turned bodies with round heads | | scaling, news-feed, chat, rate-limiter, estimation |
| `dns` | DNS | A card index: an open box of address cards, the found card pulled up | | scaling, web-crawler (resolve) |
| `balancer` | Load balancer | A 1U appliance with ports and link lights, the fan-out etched on its lid | | scaling, chat (placement), rate-limiter |
| `web` | Web server | A tower server: label plate, drive bays, grille, vents | `big`, `many` | everywhere (APIs, services, remote hosts) |
| `cache` | Cache | A memory module: chips with legs, gold contacts | | scaling, url-shortener, patterns, rate-limiter (counters), consistent-hashing |
| `database` | Database | A turned drum with raised rings; fills like a tank | `big`, `replica`, `level` · fills | everywhere |
| `cdn` | CDN edge | A globe on a stand with lights where the edges are | | scaling, youtube, news-feed |
| `storage` | Object storage | A bucket with a rim and a wire handle | | scaling, youtube, google-drive, news-feed |
| `queue` | Queue | A tray on rollers with taped parcels | `items` 0-4 | scaling, notifications, patterns, streams |
| `worker` | Worker | A machine with a gear in a round recess | | everywhere (jobs, encoders, verifiers, repair) |
| `monitor` | Monitoring | A screen on a stand with a sparkline | | scaling, operations lessons everywhere |

## Pack `devices`: what stands at the edges, ours and other people's

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `phone` | Phone | A smartphone in a small dock: recessed screen, notification cards stacked on it, a progress bar | `many` (two phones), `items` 0-3 (notifications on screen), `level` (progress or buffer bar) | chat, notifications, google-drive, youtube, streams (late event), replication |
| `sensor` | Sensor | A weatherproof sensor pod on a short post, with an antenna and a vent grille | `many` (three pods) | ordinary-scale (machine traffic), streams, replication (leaderless readings) |
| `sender` | Outside sender | A transmitter mast: a lattice tower on an equipment cabinet, panel antennas and a dish; no brand | | notifications (push, email, SMS providers), chat (offline push), google-drive (wake-up) |
| `external` | Outside service | A small office building: windows in a grid, a door, a rooftop unit; someone else's system | | patterns (payment provider), web-crawler (web hosts), rate-limiter, notifications (callbacks) |
| `mailbox` | Inbox | A post box on a post; its flag goes up when there's mail | `items` 0-4 (letters) | news-feed (follower inboxes), chat (member inboxes), notifications (email) |

## Pack `control`: what checks, limits and lets through

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `gateway` | API gateway | A checkpoint booth with a window, and a barrier arm across its lane | `open` (arm up) | rate-limiter, notifications, youtube, google-drive, url-shortener, news-feed |
| `gate` | Gate | A boom barrier: two posts and an arm, for any check that passes or holds (access, policy, robots rules, consent, shedding) | `open` (true up, "half" at an angle: some get through) | url-shortener, notifications, news-feed, autocomplete, google-drive, web-crawler, patterns |
| `breaker` | Circuit breaker | A breaker box with a big toggle lever | `open` (tripped: lever down; "half": half-open) | patterns |
| `limiter` | Rate limiter | A turnstile in a frame | `count` 1-3 (turnstiles side by side: limiter instances) | rate-limiter, url-shortener, notifications |
| `bucket` | Token bucket | A hopper of tokens with a tap above that refills it | `level`, `items` 0-8 (tokens on top) · fills | rate-limiter |
| `counter` | Counter | A mechanical tally counter: number wheels behind a window, a plunger on top (the pill shows the count) | | rate-limiter (atomic counters), unique-id (sequence), chat (ordering) |
| `lock` | Lock | A padlock on a hasp plate | `open` (shackle up) | transactions, patterns (single-flight), consensus |

## Pack `time`: clocks, timeouts and leases

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `clock` | Clock | A desk clock: a round face with ticks and two hands, on a stand | `level` (minute hand, 0-1 of a turn) | unique-id (clock moves back), consensus (ordering, skew), streams (event time), url-shortener (expiry) |
| `timer` | Timer | An hourglass in a frame | `level` (how much sand has run) · fills | rate-limiter (windows), streams (windows), web-crawler (host cooldown), patterns (timeouts, backoff), chat (grace) |
| `lease` | Lease | A parking meter: a dial showing time left, a coin slot; the fencing token goes in its readout | `level` (time left) · fills | unique-id (worker-id leases), consensus (fencing), replication (failover), chat (presence heartbeats) |
| `scheduler` | Scheduler | A time clock over a rack of card slots: jobs waiting for their time | `items` 0-4 (cards) | notifications (pacing), web-crawler, youtube (tasks) |

## Pack `services`: machines that do one job

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `socket` | WebSocket server | A switchboard: a panel of jacks with cords plugged in, each a held connection | `count` 1-8 (cords) | chat, google-drive (sync) |
| `fanout` | Fan-out | A manifold: one inlet into a header with outlet valves | `count` 2-6 (outlets) | chat, news-feed, notifications |
| `idgen` | ID generator | A ticket dispenser: take a number, one ticket out | | unique-id, url-shortener (keys), chat (sequencer) |
| `transcoder` | Transcoder | A machine with one input slot and output trays of falling size (renditions) | `count` 1-3 (trays) | youtube, news-feed (media variants) |
| `fetcher` | Fetcher | A small crane on a turret, its claw holding a page | | web-crawler |
| `router` | Router | A coin sorter: a hopper over chutes, one per key range | `count` 2-4 (chutes), `mark` (the chute taking it) | web-crawler (host router), consistent-hashing, key-value, autocomplete (range map), replication (read routing), chat (placement) |
| `coordinator` | Coordinator | A ballot box: votes and acks go in the slot, a tally shows how many | `count` 2-5 (voters), `items` 0-5 (votes in) | key-value (quorum), consensus (two-phase commit), replication (leaderless quorum) |
| `registry` | Registry | A key cabinet: hooks with keys hanging on them; a coordination service (ZooKeeper, etcd) holding leases and owners | `count` 2-6 (hooks), `items` 0-6 (keys held) | unique-id (worker ids), consensus, replication (failover), key-value (membership) |

## Pack `logs`: append-only records and what reads them

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `logfile` | Log | A receipt printer with its strip lying out: entries only ever added at the end | `items` 0-8 (entries), `mark` (a cursor: committed, read or flushed position) | storage-engines (log, WAL), transactions, replication, consensus (Raft log), google-drive (change log), chat (history), notifications (attempt log) |
| `broker` | Broker | A rack of rails, one per partition, with records on them | `count` 1-6 (partitions), `items` 0-6 (records per rail), `mark` (a partition) | streams, patterns (outbox), autocomplete (event stream), notifications |
| `consumer` | Consumer group | A bench of small reading machines, one per member | `count` 1-4 (members), `mark` (one member) | streams |
| `frontier` | URL frontier | A sorting rack of pigeonholes, a row per host, envelopes waiting | `count` 2-4 (rows), `items` 0-4 (envelopes per row), `mark` (the row that's due) | web-crawler |
| `disk` | Disk | A hard drive with its lid off: platter, spindle, read arm | | storage-engines (fsync), transactions (durability), consensus (log flush) |

## Pack `records`: how data is laid out and found

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `memtable` | Memtable | A whiteboard on an easel, sorted entries filling it | `level` · fills | storage-engines (LSM), key-value (write path) |
| `sstable` | Sorted files | A stack of archive boxes, each sealed with a band | `count` 1-5 (boxes) | storage-engines, key-value |
| `bloom` | Bloom filter | A pegboard: a grid of holes, pegs in the bits that are set | `level` (share of bits set) | storage-engines, key-value, web-crawler (seen URLs) |
| `tree` | Tree | A tiered stand: a root block, children on arms, leaves under them; for a B-tree, a Merkle tree or a trie | `count` 2-3 (children), `mark` (the leaf the walk reached) | storage-engines (B-tree), key-value (Merkle), autocomplete (trie) |
| `shard` | Shard | A drum cut into wedges, one pulled out: this slice of the data | `count` 2-6 (wedges), `mark` (the one pulled out) | autocomplete (index slices), replication, key-value, scaling (sharding) |
| `index` | Index | A card-catalogue cabinet of small drawers with pulls | `mark` (the drawer pulled out) | storage-engines, news-feed (author index), streams and web-crawler (search index), transactions (unique index) |
| `columns` | Column store | A rack of tall column trays side by side | `count` 3-6 (columns), `items` 0-6 (columns read, lit) | storage-engines (OLAP) |
| `row` | Row | A card holder with a stack of version cards, newest in front | `count` 1-4 (versions), `locked` (a padlock clipped on) | transactions |
| `doc` | Document | A clipboard with a ruled sheet, older sheets behind | `count` 1-3 (sheets) | youtube and google-drive (manifests, revisions), transactions (T1, T2), rate-limiter (rules), notifications (templates), streams (schemas) |

## When a core part with an option is enough

The inventory of all 21 chapters found many parts that are a core drawing with a label. Prefer these to asking for a new drawing:

| In the lesson | Use |
|---|---|
| Leader, follower, standby, read replica, Raft node | `database` with `replica` (and `lead` on the leader) |
| Key-value node, hash-ring node, counter store, route table | `cache` or `database` |
| Any API or service: post API, watch API, chat service, resolver, ranker, monolith module | `web` (`many` for a tier) |
| Encoder, verifier, parser, aggregator, reconciler, compaction, CDC connector, relay, stream processor | `worker` |
| Event stream, task queue, outbox, dead-letter queue, backlog | `queue` (`items`), or `broker` when partitions matter |
| Snapshot, backup, archive, chunk store, cold storage | `storage` |
| History, change log, attempt log, metadata store, ticket server, job table | `database`, or `logfile` when the order of entries is the point |
| Payment provider, remote web host | `external` |
| Browser, creator's device, uploader | `client` or `phone` |
| A failure detector, an alert, a dashboard | `monitor` |

Not parts at all: a network partition (a link's state), a region or zone (a plate under parts), a key or token on a ring (the ring layout draws those), message tags such as terms, offsets and fencing tokens (packet labels and readouts).

## Chapters and the packs they load

| Chapter | Packs |
|---|---|
| url-shortener | control, time, services |
| notifications | devices, control, time, services, logs, records |
| chat | devices, control, time, services, logs |
| news-feed | devices, control, services |
| autocomplete | control, services, logs, records |
| youtube | devices, control, time, services, records |
| google-drive | devices, control, services, logs, records |
| web-crawler | devices, control, time, services, logs, records |
| ordinary-scale | devices |
| key-value | services, records |
| unique-id | control, time, services |
| patterns | devices, control, time, logs |
| rate-limiter | devices, control, time, records |
| consistent-hashing | services |
| storage-engines | logs, records |
| streams | devices, time, logs, records |
| transactions | control, logs, records |
| consensus | control, time, services, logs |
| replication | devices, time, services, logs |
| framework, estimation | core only |

A lesson loads only the packs its own scene uses, so most lessons load one or two.
