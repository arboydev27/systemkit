import test from "node:test";
import assert from "node:assert/strict";
import { searchLessons } from "../src/lib/search.ts";

const entries = [
  { title: "Grow the web tier", chapterTitle: "Scaling", summary: "Add capacity.", paragraphs: ["A cache outage can send reads to the database."] },
  { title: "Cache repeated work", chapterTitle: "Scaling", summary: "Reduce database reads.", paragraphs: ["Expire cached results."] },
  { title: "Deliver chat messages", chapterTitle: "Chat", summary: "Send messages.", paragraphs: ["Persist messages before delivery."] },
];

test("concept search ranks direct title matches before body mentions", () => {
  const results = searchLessons(entries, "cache");
  assert.equal(results.length, 2);
  assert.equal(results[0].entry.title, "Cache repeated work");
});
test("multiword search requires every term and ignores case and repeated whitespace", () => {
  assert.equal(searchLessons(entries, "  CACHE   OUTAGE  ")[0].entry.title, "Grow the web tier");
  assert.equal(searchLessons(entries, "cache messages").length, 0);
});
test("empty and literal punctuation searches are safe", () => {
  assert.deepEqual(searchLessons(entries, "  "), []);
  assert.deepEqual(searchLessons(entries, "[.*"), []);
});
test("body matches include relevant excerpts without mutating content", () => {
  const results = searchLessons(entries, "outage");
  assert.match(results[0].excerpt, /outage/);
  assert.equal(entries[0].title, "Grow the web tier");
});
