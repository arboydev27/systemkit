"use client";

import { useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";

export function CopyLessonLink({ path }: { path: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  async function copy() {
    const link = new URL(path, window.location.origin).href;
    setUrl(link);
    try { await navigator.clipboard.writeText(link); setStatus("copied"); }
    catch { setStatus("manual"); }
  }
  return <div className="copy-lesson">
    <button type="button" className="text-button" onClick={copy}>{status === "copied" ? <Check size={14} aria-hidden="true" /> : <LinkIcon size={14} aria-hidden="true" />}<span aria-live="polite">{status === "copied" ? "Link copied" : "Copy lesson link"}</span></button>
    {status === "manual" ? <label>Copy this link<input aria-label="Lesson link" readOnly value={url} onFocus={(event) => event.target.select()} /></label> : null}
  </div>;
}
