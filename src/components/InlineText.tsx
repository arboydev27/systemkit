import { Fragment } from "react";

/** Lesson text is plain, except that `backticks` mark code. */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  if (parts.length === 1) return text;
  return parts.map((part, index) => index % 2 ? <code key={index}>{part}</code> : <Fragment key={index}>{part}</Fragment>);
}
