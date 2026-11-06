import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { UsageBeacon } from "@/components/site/SiteClient";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { siteShareImage } from "@/lib/share-image";
import "./globals.css";

const description = "Free, no-signup system design lessons for interviews and real work. Predict what breaks in hands-on labs, write your own designs, and keep the ideas with spaced review.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SystemKit: learn system design by making the decisions",
  description,
  openGraph: { siteName: SITE_NAME, type: "website", title: "SystemKit: learn system design by making the decisions", description, images: [siteShareImage] },
  twitter: { card: "summary_large_image", images: [siteShareImage.url] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <UsageBeacon />
        <Analytics />
      </body>
    </html>
  );
}
