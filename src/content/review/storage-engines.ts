import type { ReviewVariation } from "../../lib/review";

export const storageEnginesReview: Record<string, ReviewVariation> = {
  "storage-engines/se-log": {
    prompts: ["A game appends each player’s score to a file, with a hash map from player to offset. Which lookups are fast, and which suffer?", "A journaling app stores entries by appending to a file. Why does that tolerate crashes well, and when is an entry actually safe?"],
    answer: "Old records are never rewritten, so a crash threatens only the file’s end, and sequential appends are cheap. A hash map makes point lookups fast but has no order, so ranges mean a scan, and all keys need memory. A record survives power loss only after a sync such as fsync.",
  },
  "storage-engines/se-lsm": {
    prompts: ["An ad-click logger on an LSM tree absorbs scattered inserts cheaply. How does it avoid editing sorted files, and where is the cost paid later?", "Writes on a message archive’s LSM engine are being throttled and its disk use keeps climbing. What has fallen behind, and why does it matter?"],
    answer: "Writes go to a log and a sorted memtable, then flush as immutable sorted files, so nothing is edited in place. Background compaction merges those files, costing disk bandwidth, CPU, and free space. If it cannot keep up, files pile up, reads slow, disk use grows, and some engines throttle writes.",
  },
  "storage-engines/se-btree": {
    prompts: ["A hospital’s records table reaches billions of rows on a B-tree. Why does a lookup still need only a few disk reads?", "An airline database’s B-tree overwrites pages in place. What can a crash do to them mid-update, and what makes recovery possible?"],
    answer: "Many entries per page mean few levels, and cached upper levels leave one or two reads. A crash can leave a dangling reference to an unwritten page or a torn page. A write-ahead log and intact page copies repair this, so each small change eventually costs a whole page write too.",
  },
  "storage-engines/se-choose": {
    prompts: ["A vendor claims its storage engine is simply ‘faster’. Which measurements would you compare instead, and what does each one describe?", "A product-catalog team assumes an LSM tree always writes fewer bytes than a B-tree. When is that false, and why?"],
    answer: "Compare write, read, and space amplification: storage bytes per application byte, reads per query, and disk per live byte. You cannot minimize all three. A B-tree pays per page, so large rows or key-order inserts cut its writes, while an LSM tree’s per-byte cost barely moves.",
  },
  "storage-engines/se-indexes": {
    prompts: ["A colleague proposes indexing every column of a patient-visits table ‘so all queries are fast’. What would you tell them?", "A library page lists a member’s recent loans with due dates. Why might you store due dates in the index, and what does that cost?"],
    answer: "Each index is a separate structure that writes must update, adding page changes, log volume, disk use, and memory pressure, so index measured queries and drop unused ones. Extra columns make an index covering, so queries skip row fetches, but the index grows and updates to those columns touch it.",
  },
  "storage-engines/se-olap": {
    prompts: ["A game studio wants average session length by country across years of event rows with 80 columns. Why would a column store suit this?", "A clinic’s weekly report is starting to slow its production database. What would you try before a warehouse, and what would justify adding one?"],
    answer: "A column store reads only the columns a query names, and alike values compress well, making scans cheap and single-row work slow. Move reports to a read replica first. A warehouse makes sense for several sources, long history, or scans too slow there, despite a pipeline and delayed data.",
  },
};
