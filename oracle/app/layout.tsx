import type { Metadata } from "next";
import "@fontsource/bangers";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import SpiderSenseChat from "@/components/SpiderSenseChat";

export const metadata: Metadata = {
  title: "ORACLE - 25 Years of Web Intelligence",
  description: "Time-travel through 25 years of data. Ask anything.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <SpiderSenseChat />
      </body>
    </html>
  );
}
