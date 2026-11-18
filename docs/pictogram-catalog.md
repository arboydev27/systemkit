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
| `phone` | Phone | A smartphone leaning in a small dock: recessed screen, notification cards printed on it, a progress bar on a light track; the light is on the dock | `many` (two smaller phones in their docks, side by side), `items` 0-3 (notification cards on the screen), `level` (a progress or buffer bar at the foot of the screen; none when unset) | chat, notifications, google-drive, youtube, streams (late event), replication |
| `sensor` | Sensor | A weatherproof sensor pod raised on a short post over a screwed-down square foot: a vent grille on the front with its light (a round indicator) in the corner above it, a sensor window (a small port in a collar) on the side, an antenna from a gland on the lid | `many` (three smaller pods) | ordinary-scale (machine traffic), streams, replication (leaderless readings) |
| `sender` | Outside sender | A transmitter mast: a lattice tower on an equipment cabinet, panel antennas round its head, a dish, a beacon on top (its light); no brand | | notifications (push, email, SMS providers), chat (offline push), google-drive (wake-up) |
| `external` | Outside service | A small office block, taller than it is wide: a ribbon window on each upper floor, shop windows and a door under a canopy (its light) on the ground floor, a unit on the roof; someone else's system | | patterns (payment provider), web-crawler (web hosts), rate-limiter, notifications (callbacks) |
| `mailbox` | Inbox | A rural mailbox on a post; with mail its door lies open with the letters on it and its flag goes up (the light sits in the flag's pivot hub) | `items` 0-4 (letters on the open door; 0 shuts it and lowers the flag) | news-feed (follower inboxes), chat (member inboxes), notifications (email) |

## Pack `control`: what checks, limits and lets through

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `gateway` | API gateway | A checkpoint booth glazed all round under an overhanging roof, and a short banded barrier arm across its lane from a post with a signal light, the post set right of the booth so the raised arm stands clear of the roof | `open` (arm up, beside the roof; "half" at an angle) | rate-limiter, notifications, youtube, google-drive, url-shortener, news-feed |
| `gate` | Gate | A boom barrier: a housing with a signal light low on its front (right of the hub, clear of the arm in every state), a long banded arm on a hub at the housing's lane-side edge, reaching well past it across the lane to lie on a forked post; for any check that passes or holds (access, policy, robots rules, consent, shedding) | `open` (true: arm straight up, about level with the notes; "half" at an angle: some get through) | url-shortener, notifications, news-feed, autocomplete, google-drive, web-crawler, patterns |
| `breaker` | Circuit breaker | An upright breaker wall box, taller than it is wide and without vents, a label plate and the light over a plain module on its front, and a big toggle lever standing out of the module, up (steep, its face showing) while it's on | `open` (tripped: toggle down; "half": level, half-open) | patterns |
| `limiter` | Rate limiter | A tripod turnstile: a cabinet with a signal light, a three-armed rotor on its top at the lane-side edge (its spindle along the rotor's axis, one arm level across the lane to the next cabinet or the side panel), a solid low side panel closing the last lane | `count` 1-3 (turnstiles side by side: limiter instances) | rate-limiter, url-shortener, notifications |
| `bucket` | Token bucket | A hopper of tokens with a tap above that drips new ones in; the light is on the metering valve on the tap's standpipe | `level` (its fill: tokens left, with a waterline ring at its edge; none at 0), `items` 0-8 (tokens lying on the fill, seen through the mouth, so a low fill hides them under the near rim; a full load heaps up in the middle; unset, they follow the level, level × 8) · fills | rate-limiter |
| `counter` | Counter | A mechanical tally counter: number wheels behind a window, a plunger on top, a reset knob, the finger ring standing off its end (the pill shows the count) | | rate-limiter (atomic counters), unique-id (sequence), chat (ordering) |
| `lock` | Lock | A padlock on a hasp plate, its shackle through the staple, as large as the parts beside it | `open` (unlocked: the shackle springs up and swings half a turn out of the staple, its short leg in the air beside the body; "half": sprung up, its short leg out of its socket, still through the staple) | transactions, patterns (single-flight), consensus |

## Pack `time`: clocks, timeouts and leases

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `clock` | Clock | A twin-bell alarm clock on two splayed legs (each showing below the case) with solid ball feet, knobs on its bells, facing you: a white dial with indices and two hands under its bezel; the light is the hub | `level` (the minute hand, 0-1 of a turn from twelve; the hour hand follows on from ten; unset shows ten past ten) | unique-id (clock moves back), consensus (ordering, skew), streams (event time), url-shortener (expiry) |
| `timer` | Timer | An hourglass: two round bulbs joined at a neck, between turned plates on two posts that stand clear of the glass; the thick bottom plate, ringed under its lip, lifts the neck clear of the base's back edge and carries the light | `level` (time left: the sand still in the top bulb, 1 just turned, 0 run out, the same way as the lease; as it falls the top bulb empties, the mound below grows, a stream runs between them while it's neither 0 nor 1; hot turns the sand orange) · fills | rate-limiter (windows), streams (windows), web-crawler (host cooldown), patterns (timeouts, backoff), chat (grace) |
| `lease` | Lease | A parking meter: a broad arch-topped head on a post, a large round dial window filling it, a readout (where the fencing token shows) holding the light, a coin slot, a crank lever with a solid knob on its side | `level` (time left: the tapered needle and the shaded wedge (the deep tone) fall from upper right (full) toward upper left (empty), never onto the baseline; at 0 the expired flag stands up on its stem from the window's lower rim; hot turns the wedge orange) · fills | unique-id (worker-id leases), consensus (fencing), replication (failover), chat (presence heartbeats) |
| `scheduler` | Scheduler | A punch clock: a big dial on its face (the light is the hub, kept clear of the hands' short tails), vent slots down its side, and a rack of card slots along its top, each card a job waiting for its time | `items` 0-4 (cards standing in the rack) | notifications (pacing), web-crawler, youtube (tasks) |

## Pack `services`: machines that do one job

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `socket` | WebSocket server | A switchboard: a panel of eight jacks over a shelf, a cord running from the shelf into each held connection | `items` 0-8 (connections held: cords plugged in; 0 an idle board) | chat, google-drive (sync) |
| `fanout` | Fan-out | A manifold: one flanged inlet into a header pipe on saddles, a row of outlets on top, each through a valve | `count` 2-6 (outlets) | chat, news-feed, notifications |
| `idgen` | ID generator | A take-a-number dispenser on a stand: a turned drum under a lid ring, the next ticket sticking out of the slot in its front | | unique-id, url-shortener (keys), chat (sequencer) |
| `transcoder` | Transcoder | A machine fed from a film reel on its lid, renditions coming out in trays of falling size | `count` 1-3 (trays) | youtube, news-feed (media variants) |
| `fetcher` | Fetcher | A small crane on a turret, its boom reaching out, the claw on its cable holding a page | | web-crawler |
| `router` | Router | A coin sorter: a hopper over a sloped bed of chutes, one per key range, each into a coin tube | `count` 2-4 (chutes and tubes), `mark` (the chute taking it: its tube pulled forward, the coin dropping in lit) | web-crawler (host router), consistent-hashing, key-value, autocomplete (range map), replication (read routing), chat (placement) |
| `coordinator` | Coordinator | A ballot box: a vote going in through the slot in its lid, a tally window in front with a cell per voter | `count` 2-5 (voters: cells), `items` 0-5 (votes in: filled cells, at most `count`) | key-value (quorum), consensus (two-phase commit), replication (leaderless quorum) |
| `registry` | Registry | A key cabinet, its door open: pegs with keys hanging on them, a register inside the door; a coordination service (ZooKeeper, etcd) holding leases and owners | `count` 2-6 (pegs, two rows past three), `items` 0-6 (keys held, at most `count`) | unique-id (worker ids), consensus, replication (failover), key-value (membership) |

## Pack `logs`: append-only records and what reads them

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `logfile` | Log | A receipt printer, its strip falling from the front slot and lying out along the floor, one printed entry after another: entries only ever added at the end | `items` 0-8 (entries; the strip grows with them), `mark` (a clip after that entry, 0 the oldest: a thin bar across the strip and a lit block beside it, low so every newer entry still shows; the committed, read or flushed position; at most `items` - 1) | storage-engines (log, WAL), transactions, replication, consensus (Raft log), google-drive (change log), chat (history), notifications (attempt log) |
| `broker` | Broker | A frame of rails, one per partition, records threaded on each in order like an abacus, room left at the end to append (records close up when there are many), a dark board closing its back | `count` 1-6 (partitions), `items` 0-6 (records per rail), `mark` (that rail's end pulled out through the frame with a light on it, 0 the top rail) | streams, patterns (outbox), autocomplete (event stream), notifications |
| `consumer` | Consumer group | A bench of small reading machines, one per member, each a sloped screen over a card slot | `count` 1-4 (members), `mark` (that member lifted on a tall riser slid forward to the bench's front edge, with a light on its front, 0 the leftmost) | streams |
| `frontier` | URL frontier | A sorting rack of pigeonholes, a row per host, envelopes waiting in each row's holes in order | `count` 2-4 (rows), `items` 0-4 (envelopes per row), `mark` (the row that's due, 0 the top: its first envelope pulled up out of its hole, leaning on the lip, with a lit seal; a row with no envelopes shows the light at its end on the rack's side) | web-crawler |
| `disk` | Disk | A hard drive with its lid off: the platter lying in its well, a clamp with its screw on the spindle, the read arm out over a track from its pivot by the dark voice-coil magnet | | storage-engines (fsync), transactions (durability), consensus (log flush) |

## Pack `records`: how data is laid out and found

| Role | Name | The object | Options | Used in |
|---|---|---|---|---|
| `memtable` | Memtable | A whiteboard on a stand, sorted entries written down it, a marker tray along its foot | `level` (how far down the entries reach; full and hot, the written part warms) · fills | storage-engines (LSM), key-value (write path) |
| `sstable` | Sorted files | A stack of archive boxes, each with a label holder and a band sealing its lid | `count` 1-5 (boxes, one per file; default 3; a stack stays three high, so a fourth and fifth start a second stack behind) | storage-engines, key-value |
| `bloom` | Bloom filter | A pegboard sloped back on a low wedge stand, like a game board: a grid of 28 holes, a peg set in each bit that's on, scattered as hashes scatter them | `level` (share of bits set; default 0.4) | storage-engines, key-value, web-crawler (seen URLs) |
| `tree` | Tree | A model on a stand: a root block on a post, children on rods, two leaves under each standing on a long board; blocks are pages with dividers between keys. For a B-tree, a Merkle tree or a trie | `count` 2-3 (children; default 2), `mark` (the child whose leaf the walk reached: that leaf lifts and lights) | storage-engines (B-tree), key-value (Merkle), autocomplete (trie) |
| `shard` | Shard | A drum cut into wedges on a round board, one wedge pulled out and lit: this slice of the data | `count` 2-6 (wedges; default 4), `mark` (the one pulled out; default the front one) | autocomplete (index slices), replication, key-value, scaling (sharding) |
| `index` | Index | A card-catalogue cabinet on legs: twelve small drawers with label holders and pulls | `mark` 0-11 (the drawer pulled out, cards standing in it, lit; none by default) | storage-engines, news-feed (author index), streams and web-crawler (search index), transactions (unique index) |
| `columns` | Column store | A rack of tall column trays side by side, each a column of values stacked under a header | `count` 3-6 (columns; default 4), `items` 0-6 (columns read: they slide forward and light; none by default) | storage-engines (OLAP) |
| `row` | Row | Version cards standing tall in a low slotted stand, each older one taller and further back, the newest in front showing the row's fields | `count` 1-4 (versions; default 2), `locked` (a padlock hung through a hole in the front card) | transactions |
| `doc` | Document | A clipboard on a desk copy stand, lying well back on its wedge (unlike a phone, which stands nearly upright in its dock), its clip holding a ruled sheet, older sheets stepped out behind it | `count` 1-3 (sheets; default 2) | youtube and google-drive (manifests, revisions), transactions (T1, T2), rate-limiter (rules), notifications (templates), streams (schemas) |

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
