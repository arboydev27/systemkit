import { ImageResponse } from "next/og";

export const shareImageSize = { width: 1200, height: 630 };
export const siteShareImage = { url: "/og/site.png", ...shareImageSize, alt: "SystemKit: learn system design by making the calls" };

/** The card a link shows when pasted into a chat or social feed. Text only, so it stays legible when small. */
export function shareImage({ title, context }: { title: string; context: string }) {
  const large = title.length < 46;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0b0b0b", color: "#f5f5f5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, fontWeight: 700 }}>
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f5f5f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
          <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
          <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
        </svg>
        SystemKit
      </div>
      <div style={{ display: "flex", fontSize: large ? 84 : 66, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.03em", maxWidth: 1040 }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "#b5b5b5" }}>
        <span>{context}</span>
        <span>Free, no signup</span>
      </div>
    </div>,
    shareImageSize,
  );
}
