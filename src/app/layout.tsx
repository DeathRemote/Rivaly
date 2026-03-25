import type { Metadata } from "next";
import Script from "next/script";
import { Lexend, Manrope } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-full bg-black text-white">
        {/* AdSense Script (must be beforeInteractive for verification) */}
        <Script
          id="adsense-script"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4406678040423469"
          strategy="beforeInteractive"
          crossOrigin="anonymous"
        />

        {children}
      </body>
    </html>
  );
}