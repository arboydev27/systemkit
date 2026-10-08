"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
import { lessonIndex } from "@/lib/lessons";
import { searchLessons } from "@/lib/search";
import styles from "./LessonSearch.module.css";

export function LessonSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const matches = useMemo(() => searchLessons(lessonIndex, query), [query]);
  const results = matches.slice(0, 12);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) { dialog.close(); return; }
    dialog.showModal();
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function moveFocus(event: React.KeyboardEvent, fromInput = false) {
    const links = Array.from(resultsRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    if (!links.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (fromInput && !["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 :
      event.key === "ArrowDown" ? (index + 1) % links.length : (index <= 0 ? links.length - 1 : index - 1);
    links[next]?.focus();
  }

  return <>
    <button type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K">
      <Search size={16} aria-hidden="true" /><span>Search lessons</span><kbd>⌘ K</kbd>
    </button>
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="lesson-search-heading"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }}
      onCancel={() => setOpen(false)} onClose={() => setOpen(false)}
      onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className={styles.panel}>
        <div className={styles.heading}><h2 id="lesson-search-heading">Find a concept</h2>
          <button className="icon-button" type="button" aria-label="Close search" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className={styles.field}>
          <Search size={19} aria-hidden="true" />
          <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => moveFocus(event, true)} aria-label="Search all chapters" placeholder="Search all chapters…" autoComplete="off" maxLength={120} />
        </div>
        <div className={styles.results}>
          {!query.trim() ? <div className={styles.empty}>
            <p>One place to search every lesson.</p><span>Try a concept you want to revisit.</span>
            <div className={styles.suggestions}>{["replication", "cache", "queues"].map((term) =>
              <button type="button" key={term} onClick={() => { setQuery(term); inputRef.current?.focus(); }}>{term}</button>)}</div>
          </div> : <>
            <p className={styles.count} role="status">{matches.length ? `${matches.length} ${matches.length === 1 ? "lesson" : "lessons"}${matches.length > 12 ? " · showing the first 12" : ""}` : "No matching lessons"}</p>
            {results.length ? <ul ref={resultsRef} onKeyDown={(event) => moveFocus(event)} className={styles.list}>
              {results.map(({ entry, excerpt }) => <li key={entry.id}>
                <Link href={entry.href} prefetch={false} onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setOpen(false); }}>
                  <span className={styles.chapter}>{entry.chapterNumber} / {entry.chapterTitle}</span>
                  <strong>{entry.title}<ArrowUpRight size={16} aria-hidden="true" /></strong><span className={styles.excerpt}>{excerpt}</span>
                </Link>
              </li>)}
            </ul> : <div className={styles.empty}><p>Try a broader term.</p><span>For example, “cache” instead of a full question.</span></div>}
          </>}
        </div>
        <p className={styles.footer}><span>↑ ↓ to explore · Enter to open</span><span>Esc to close</span></p>
      </div>
    </dialog>
  </>;
}
