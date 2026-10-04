import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SystemKit — Scale to a Million Users",
  description:
    "A visual, hands-on guide to scaling a system from one server to millions of users.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
