import type { DesignChallengeContent } from "../design-challenge";

export const pastebinChallenge: DesignChallengeContent = {
  id: "pastebin",
  chapterId: "url",
  stepId: "url-operations",
  minutes: 25,
  adaptationTitle: "Burn-after-reading links",
  title: "Design a code-snippet sharing service",
  summary: "Move from short links to a product where the stored value is large, most of it expires, and some links must stay secret.",
  brief: "Developers paste code or logs up to 1 MB, choose an expiry, and get a link. A public link can be shared widely and cached. A private link must be impractical to guess, and it must stop working when it expires or its owner revokes it. Design the first version. Keep full user accounts, comments, version history, and search outside this exercise.",
  assumptions: [
    "2 million new snippets are created per day, and each is read 5 times on average. Peak traffic is 10 times the daily average. Use decimal units and 86,400 seconds per day.",
    "A snippet averages 20 kB, with a hard limit of 1 MB.",
    "Half of snippets expire within a day, 40% expire after 30 days, and 10% never expire. Estimate stored text after one year of steady traffic, before replicas and metadata.",
    "Size keys for five years of creation. Assume an attacker can make 1,000 guesses per second against private links.",
    "A private link must stop serving within 60 seconds of expiry or revocation. An accepted snippet must survive an application-process crash.",
  ],
  change: "A customer asks for burn-after-reading links: a snippet is shown to one reader and is then gone. Chat apps and email scanners often fetch links automatically to build previews. What changes in your read path and storage? State what happens if the server crashes just after a snippet is claimed.",
  fields: [
    {
      id: "estimate",
      title: "Requirements and estimates",
      prompt: "State your scope and assumptions. Estimate average and peak create and read rates, bytes written and served per day, stored text after one year, and the key length you need. Keep units visible.",
      placeholder: "Creates per second = …\nReads per second = …\nStored text after one year = …\nPublic key length = …; private key length = …",
    },
    {
      id: "architecture",
      title: "Architecture and request paths",
      prompt: "Name the components and what each stores. Trace one create, one public read, and one private read, including where expiry is checked and where snippet bytes live. An arrow list is enough.",
      placeholder: "Create: client → …\nPublic read: client → …\nPrivate read: client → …\nSnippet bytes live in…; expiry is checked at…",
    },
    {
      id: "resilience",
      title: "Bottlenecks and failure",
      prompt: "Choose a likely bottleneck and the metric that would prove it. Explain what happens if the cleanup job stops for a day, and how a revoked link stops being served within 60 seconds, given any caches you added.",
      placeholder: "I would monitor…\nIf cleanup stops…\nA revoked link stops working because…",
    },
    {
      id: "adaptation",
      title: "Revisit the design",
      prompt: "Respond to the burn-after-reading change below. Explain how exactly one reader gets the content, how automatic link previews are handled, and what a crash costs.",
      placeholder: "Only one reader gets it because…\nLink previews do not consume it because…\nIf the server crashes after the claim…",
    },
  ],
  rubric: [
    { id: "units", title: "The estimates explain a decision.", detail: "I show units, separate average from peak, and use the expiry mix to show which snippets dominate long-term storage." },
    { id: "keys", title: "Private keys are sized for guessing, not only uniqueness.", detail: "I compare the guess rate with the number of live keys, and explain why a key long enough to be unique can still be too easy to guess." },
    { id: "expiry", title: "Expiry is enforced on the read path.", detail: "I check expiry and revocation when serving, so a late cleanup job costs storage rather than exposing content." },
    { id: "cache", title: "Caches respect the secrecy promise.", detail: "I say which responses may enter a shared cache, and how private or revoked content stays out of it past the 60-second limit." },
    { id: "burn", title: "The one-time read has an atomic claim and a stated failure.", detail: "I claim the snippet atomically, stop previews from consuming it, and say whether a crash loses the content or could show it twice." },
  ],
  estimateGuide: "Creates: 2 million/day ≈ 23/s average and 231/s at peak. Reads: 10 million/day ≈ 116/s average and 1,157/s at peak. Written: 2 million × 20 kB = 40 GB/day. Served: 10 million × 20 kB = 200 GB/day ≈ 2.3 MB/s average and 23 MB/s (about 185 Mbit/s) at peak. Stored text after one year: the one-day half adds 20 GB/day but holds at most about 20 GB at any moment; the 30-day group adds 16 GB/day × 30 = 480 GB; the never-expiring 10% adds 4 GB/day × 365 = 1.46 TB. That totals about 2 TB, and the smallest group holds about three quarters of it. Keys: five years is 3.65 billion snippets. Six base62 characters (56.8 billion) are enough for uniqueness, but if all those keys were live, about 1 guess in 16 would hit one, or about 64 hits per second at 1,000 guesses per second. Eight characters (218 trillion) still allow about one hit per minute. Private links should use about 128 random bits, which takes 22 base62 characters, so guessing stops being a practical attack.",
  solutions: [
    {
      id: "object-store",
      title: "Metadata in a database, snippet bytes in object storage",
      approach: "Keep small records in a relational database: key, visibility, a hash of the owner's revoke token, expiry, revoked flag, size, and object key. Store snippet text in object storage. Put public snippets behind a CDN with a short TTL. Private snippets use 128-bit random keys and always pass through the application tier, so expiry and revocation are checked on each read.",
      paths: [
        "Create: the API validates size, generates a key, writes the text to object storage, then commits the metadata row. A unique index on the key settles any collision, and the API returns the link only after the commit. A crash between the two steps leaves an orphan object for cleanup, not a broken link.",
        "Public read: the CDN serves a cached copy for up to 60 seconds. On a miss, the application checks expiry in metadata, fetches the text from storage, and responds with text/plain, X-Content-Type-Options: nosniff, and a TTL no longer than the snippet's remaining life. Raw text comes from a separate domain, so a pasted script cannot run with the site's cookies.",
        "Private read: the application reads metadata, which may be cached for up to 30 seconds, rejects expired or revoked keys, and fetches the text. The response carries Cache-Control: no-store, Referrer-Policy: no-referrer, and X-Robots-Tag: noindex, so the secret URL stays out of shared caches, referrer headers, and search results.",
      ],
      failure: "If object storage is down, creates return an error and cached public snippets keep working. If the cleanup job stops, read-time checks still enforce expiry, so the cost is extra storage rather than exposed content. Monitor read latency, CDN hit rate, cleanup backlog, orphan count, and 404s per client as a signal of guessing. Rate-limit by client, but attackers can spread requests across addresses, so key length does the real work.",
      adaptation: "Mark the snippet one-time and bypass the CDN. A GET returns a small confirmation page with no content, so link previews cannot burn it. The reader's POST runs a conditional update that sets consumed_at only if it is still null. The request that changes one row fetches the text, responds, and deletes the object. A crash after the claim loses the snippet, which is the safer failure for a secret: at most once, never twice. Tell senders this can happen.",
      tradeoff: "The database stays small, bytes scale cheaply, and public snippets deliver well through a CDN. The price is two stores to keep in step, orphan cleanup, and an extra storage round trip on each cache miss.",
    },
    {
      id: "single-database",
      title: "One database holding both text and metadata",
      approach: "Store metadata and text together in one managed Postgres database, which compresses large text values automatically. About 2 TB and roughly 1,400 requests per second at peak is a reasonable workload to benchmark on one primary with a standby. Put a CDN in front of public snippets only. Private keys are 128 random bits, as in the other design.",
      paths: [
        "Create: one INSERT writes the key, text, and expiry in a single transaction, so there is no orphan to clean up. A unique constraint on the key rejects collisions, and the API returns the link after the commit.",
        "Public read: the CDN serves cached copies for up to 60 seconds. On a miss, the application runs one indexed lookup that returns text and expiry together, and rejects an expired row. Raw text comes from a separate domain as text/plain with nosniff.",
        "Private read: the same lookup with no shared cache. It reads from the primary, or from a replica only while lag is well under 60 seconds, so a revocation takes effect on time. Responses carry no-store, no-referrer, and noindex headers.",
      ],
      failure: "A failed primary stops creates until the standby is promoted, while cached public snippets keep working. Promotion can lose recent commits under asynchronous replication, so choose between synchronous replication and a documented loss window. A batched job removes expired rows using an index on expiry; if it stops, reads still enforce expiry. Partitioning by expiry would make deletes cheaper, but Postgres requires unique constraints on a partitioned table to include the partition column, so key uniqueness would need its own table. Watch table and backup size, replica lag, and vacuum progress, and move text to object storage when restores take too long.",
      adaptation: "Bypass the CDN and show a confirmation page on GET. The reader's POST runs DELETE ... WHERE key = $1 RETURNING text on the primary, so claiming and reading are one atomic statement and only one request can receive the row. If the process dies before responding, the snippet is gone, which matches an at-most-once promise. A reader whose response was lost cannot retry, so tell senders this can happen.",
      tradeoff: "One store means no orphans, simple transactions, and a one-statement burn. The cost is that text inflates the database, its backups, and replica rebuilds, and serving competes with metadata lookups unless the CDN absorbs most reads.",
    },
  ],
};
