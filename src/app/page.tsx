import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeatureBento } from "@/components/landing/FeatureBento";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { MobileBottomNav } from "@/components/landing/MobileBottomNav";

export default function HomePage() {
  return (
    <div id="top" className="min-h-dvh">
      <Navbar />

      <main
        id="content"
        className="bg-[radial-gradient(circle_at_top_right,rgba(243,255,202,0.08),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(255,116,65,0.06),transparent_40%)] pb-28 pt-16"
      >
        <Hero />
        <HowItWorks />
        <FeatureBento />
        <Pricing />
        <FinalCta />
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
}
