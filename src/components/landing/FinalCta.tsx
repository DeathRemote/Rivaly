import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="py-24">
      <Container>
        <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-white/[0.06] px-8 py-14 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:px-12 lg:px-16">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(202,253,0,0.12),transparent_48%),radial-gradient(circle_at_bottom_left,rgba(255,116,65,0.08),transparent_45%)]"
            aria-hidden="true"
          />

          <h2
            id="cta-title"
            className="relative z-10 font-display text-5xl font-extrabold italic uppercase leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Start competing
            <br />
            <span className="text-lime-200">now.</span>
          </h2>

          <div className="relative z-10 mt-10 flex justify-center">
            <Button href="/signup" variant="primary" size="lg">
              Join the arena
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
