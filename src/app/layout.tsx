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
  description: "Predict matches, climb the leaderboard, and win with your friends.",
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
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4406678040423469"
          crossOrigin="anonymous"
        />
        {children}
      </body>
    </html>
  );
}
