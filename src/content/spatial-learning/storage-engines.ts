import { flowLesson } from "./flow-lesson";

export const storageEnginesTeachingContent = {
  "se-log": flowLesson("se-log", {
    kind: "flow",
    semanticIds: ["append-record", "sync-log", "hash-index", "read-offset"],
    points: [
      { title: "The sync makes it safe", description: "Appending puts the record in the file, but only the sync lets it survive a power cut.", items: [0, 1] },
      { title: "The index makes it findable", description: "The hash map stores where the newest record for each key starts, so a read jumps straight there.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A store acknowledges right after the append and syncs once per second. Power fails 0.4 seconds after the last sync. What happens to recent writes?",
      options: [
        "All of them survive, since the append had already finished",
        "Up to about 0.4 seconds of acknowledged writes can vanish",
        "The whole log becomes unreadable until a full rebuild runs",
        "Only the hash index is lost, and every record stays safe",
      ],
      correctIndex: 1,
      explanation: "Appended data can sit in the operating system cache until the next sync, so writes since the last sync can be lost even though they were acknowledged. Redis offers this trade with its once-per-second append-only file setting.",
      items: [0, 1],
    },
  }),
  "se-lsm": flowLesson("se-lsm", {
    kind: "flow",
    semanticIds: ["write-ahead-log", "memtable", "sorted-files", "compaction"],
    points: [
      { title: "Writes land in two places", description: "The log protects the write, and the memtable keeps it sorted and readable.", items: [0, 1] },
      { title: "Files are written once", description: "A full memtable becomes an immutable sorted file, and nothing edits that file afterward.", items: [1, 2] },
      { title: "Compaction pays the debt", description: "Merging files removes old versions and keeps the number of files a read must check under control.", items: [2, 3] },
    ],
    prediction: {
      prompt: "You raise the memtable from 64 MB to 256 MB. What is the most direct effect?",
      options: [
        "Bloom filters stop being needed for files already on disk",
        "Compaction stops running, because files are no longer small",
        "Flushes are rarer and bigger, and crash replay takes longer",
        "Deleted keys free disk space as soon as they are flushed",
      ],
      correctIndex: 2,
      explanation: "A larger memtable takes longer to fill, so flushes are less frequent and each file is larger. The log has to be kept until the flush, so more of it is replayed after a crash. Compaction and filters are still needed.",
      items: [0, 1, 2],
    },
  }),
  "se-btree": flowLesson("se-btree", {
    kind: "flow",
    semanticIds: ["dirty-page", "write-ahead-log", "sync-log", "write-page"],
    points: [
      { title: "The page changes in memory first", description: "The engine finds the leaf page and changes the cached copy, splitting it if it is full.", items: [0] },
      { title: "The log makes the commit safe", description: "Syncing the log at commit means the change can be replayed, even if the page never reached disk.", items: [1, 2] },
      { title: "The page catches up later", description: "A checkpoint writes dirty pages out, which limits how much log recovery has to replay.", items: [2, 3] },
    ],
    prediction: {
      prompt: "Inserts arrive in increasing key order, such as timestamps. Which page takes nearly all of the changes?",
      options: [
        "The root page, which is rewritten for each new key",
        "A different leaf each time, chosen by a hash of the key",
        "The leftmost leaf, which holds the smallest keys",
        "The rightmost leaf, which splits as it fills",
      ],
      correctIndex: 3,
      explanation: "New keys always sort last, so they land on the rightmost leaf until it fills and splits. Few pages get dirty, which is why ordered inserts are cheap on a B-tree.",
      items: [0, 3],
    },
  }),
  "se-choose": flowLesson("se-choose", {
    kind: "comparison",
    semanticIds: ["btree-small-row", "btree-large-row", "lsm-small-row", "lsm-large-row"],
    points: [
      { title: "A B-tree pays per page", description: "One changed row can mean rewriting a whole 16 KB page, so small rows suffer most.", items: [0, 1] },
      { title: "An LSM tree pays per byte", description: "Each byte is rewritten as it moves down levels, whatever size of row it belongs to.", items: [2, 3] },
      { title: "Row size flips the winner", description: "The LSM tree writes less for 100-byte rows and the B-tree writes less for 4 KB rows.", items: [0, 1, 2, 3] },
    ],
    prediction: {
      prompt: "With the same 16 KB pages and LSM levels, rows grow from 100 bytes to 8 KB. Which write amplification changes the most?",
      options: [
        "The LSM tree’s, falling from about 40 to about 2",
        "The B-tree’s, falling from about 160 to about 2",
        "The LSM tree’s, rising from about 40 to about 160",
        "Neither, since both depend only on total bytes written",
      ],
      correctIndex: 1,
      explanation: "16 KB divided by 8 KB is 2. The B-tree’s cost comes from rewriting a page per changed row, so larger rows use more of each page. The LSM tree rewrites each byte a similar number of times at any row size.",
      items: [0, 1],
    },
  }),
  "se-indexes": flowLesson("se-indexes", {
    kind: "comparison",
    semanticIds: ["no-index", "secondary-index", "covering-index", "many-indexes"],
    points: [
      { title: "An index replaces a scan", description: "A secondary index finds the matching rows directly, but each match may still need a row fetch.", items: [0, 1] },
      { title: "A covering index skips the fetch", description: "Holding the needed columns lets the index answer alone, at the cost of a larger structure.", items: [1, 2] },
      { title: "Writes pay for all of them", description: "Each insert changes the table and every index, so unused indexes are pure cost.", items: [3] },
    ],
    prediction: {
      prompt: "A nightly job reads 90% of a table’s rows and most of its columns. Which access path is likely cheapest?",
      options: [
        "A full table scan",
        "A secondary index on the filter column",
        "A covering index on all the columns it reads",
        "Several single-column indexes combined",
      ],
      correctIndex: 0,
      explanation: "Fetching nearly every row through an index means scattered page reads, often revisiting pages, while a sequential scan reads each page once. A covering index would be almost as large as the table and would tax every write for one job.",
      items: [0, 1],
    },
  }),
  "se-olap": flowLesson("se-olap", {
    kind: "comparison",
    semanticIds: ["row-lookup", "row-scan", "column-lookup", "column-scan"],
    points: [
      { title: "A row store favors lookups", description: "One row’s values sit together, so a key lookup is cheap, while a scan reads every column.", items: [0, 1] },
      { title: "A column store favors scans", description: "A query reads only the columns it names, while a whole row must be rebuilt from many files.", items: [2, 3] },
    ],
    prediction: {
      prompt: "A query that read 3 of 60 columns now reads 50 of them across every row. What happens to the column store’s advantage?",
      options: [
        "It grows, because more columns can compress together",
        "It stays the same, because scan cost tracks row count",
        "It disappears, because the store must switch to reading rows",
        "Most of it goes, because it now reads most of the data",
      ],
      correctIndex: 3,
      explanation: "Reading fewer columns is the layout’s main gain, so reading 50 of 60 reads most of the bytes a row store would. Compression still helps, but the gap narrows a lot.",
      items: [1, 3],
    },
  }),
};
