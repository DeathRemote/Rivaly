import { Check } from "lucide-react";

import { pricingTiers } from "@/config/landing";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="bg-black py-20">
      <Container>
        <SectionHeader
          id="pricing-title"
          title="Tiered excellence"
          description="Pick the level of your kinetic journey. Upgrade anytime."
          align="center"
          className="mb-12"
        />

        <div className="grid gap-4 md:grid-cols-5">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.id}
              className={cn(
                "flex flex-col p-6",
                tier.highlighted
                  ? "md:scale-[1.03] ring-2 ring-lime-300/35 shadow-[0_0_42px_rgba(202,253,0,0.12)]"
                  : "hover:border-white/20",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                    {tier.name}
                  </p>
                  {tier.badge ? (
                    <p className="mt-2 inline-flex rounded-full bg-lime-300 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-black">
                      {tier.badge}
                    </p>
                  ) : null}
                </div>
                <tier.icon className="size-5 text-white/50" aria-hidden="true" />
              </div>

              <p className="mt-5 font-display text-3xl font-extrabold italic text-white">
                {tier.price}
                <span className="ml-1 text-xs font-semibold not-italic text-white/50">/mo</span>
              </p>

              <ul className="mt-6 space-y-3 text-sm text-white/70">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-lime-200" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  href={tier.cta.href}
                  variant={tier.highlighted ? "primary" : "secondary"}
                  className="w-full"
                >
                  {tier.cta.label}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
