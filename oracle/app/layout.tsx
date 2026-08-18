import type { Metadata } from "next";
import "@fontsource/bangers";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORACLE — Web Intelligence Across the Scrape-Verse",
  description:
    "25 years of scraped web data, one question away. Price predictions, rarity checks, and cultural timelines — answered.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
