import type { Metadata } from "next";
import { Lexend, Manrope } from "next/font/google";
import "./globals.css";

import { Footer } from "@/components/layout/Footer";
import { AdsenseScript } from "@/components/ads/AdsenseScript";

const fontDisplay = Lexend({
  subsets: ["latin"],
  variable: "--font-display",
});

const fontBody = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Rivaly — compete with friends",
  description:
    "Predict matches, climb the leaderboard, and win with your friends.",
  other: {
    "google-adsense-account": "ca-pub-4406678040423469",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} dark h-full scroll-smooth antialiased`}
    >
      <body className="min-h-screen bg-black text-white">
        {/*
          AdSense loads client-side to avoid hydration mismatches.
          (The script can mutate its own tag / be rewritten by Google before React hydrates.)
        */}
        <AdsenseScript />
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}