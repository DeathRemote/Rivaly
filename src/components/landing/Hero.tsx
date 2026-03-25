import Image from "next/image";

import { hero } from "@/config/landing";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pb-16 pt-16">
      <Container className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div className="relative z-10">
          <p className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-lime-100">
            {hero.kicker}
          </p>

          <h1
            id="hero-title"
            className="mt-6 font-display text-5xl font-extrabold italic uppercase leading-[0.9] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            {hero.title.lead} <span className="text-lime-200">{hero.title.highlight}</span>{" "}
            {hero.title.tail}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl">
            {hero.description}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button href={hero.primaryCta.href} variant="primary" size="lg">
              {hero.primaryCta.label}
              <hero.primaryCta.icon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-4">
            <Card className="relative -rotate-3 p-4">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[1.5rem] bg-black">
                <Image
                  src="https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=900&q=80"
                  alt="Football match action"
                  fill
                  className="object-cover opacity-50"
                  sizes="(min-width: 1024px) 260px, 45vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/0 to-black/0" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-200">
                    Premier League
                  </p>
                  <p className="mt-1 font-display text-xl font-extrabold italic leading-none text-white">
                    ARS VS MCI
                  </p>
                  <div className="mt-4 flex gap-2" aria-hidden="true">
                    <div className="h-1 flex-1 rounded-full bg-lime-300" />
                    <div className="h-1 flex-1 rounded-full bg-white/15" />
                  </div>
                </div>
              </div>
            </Card>

            <div className="translate-y-10 rotate-3 space-y-4">
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Leaderboard
                </p>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid size-6 place-items-center rounded-full bg-lime-300 text-[10px] font-black italic text-black">
                        1
                      </div>
                      <p className="text-xs font-semibold text-white">You</p>
                    </div>
                    <p className="text-xs font-extrabold italic text-lime-200">1,240 pts</p>
                  </div>
                  <div className="flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-2">
                      <div className="grid size-6 place-items-center rounded-full bg-white/10 text-[10px] font-black italic text-white">
                        2
                      </div>
                      <p className="text-xs font-semibold text-white">Alex_88</p>
                    </div>
                    <p className="text-xs font-extrabold italic text-white">980 pts</p>
                  </div>
                </div>
              </Card>

              <Card className="grid aspect-square place-items-center p-6">
                <span className="font-display text-xs font-bold uppercase tracking-[0.22em] text-white/60">
                  Swipe
                </span>
                <span className="text-4xl font-black italic text-lime-200" aria-hidden="true">
                  ⇅
                </span>
              </Card>
            </div>
          </div>

          <div
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-lime-300/10 blur-3xl"
            aria-hidden="true"
          />
        </div>
      </Container>
    </section>
  );
}
