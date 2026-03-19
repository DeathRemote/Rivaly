import { steps } from "@/config/landing";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="bg-white/[0.02] py-20">
      <Container>
        <SectionHeader
          id="how-title"
          eyebrow="The engine"
          title="How it works"
          description="A simple loop that turns games into competition."
          className="mb-12"
        />

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, idx) => (
            <Card key={step.title} className="relative p-8">
              <div
                className="pointer-events-none absolute right-8 top-6 font-display text-6xl font-extrabold text-white/10"
                aria-hidden="true"
              >
                {String(idx + 1).padStart(2, "0")}
              </div>

              <div className="grid size-12 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <step.icon className="size-6 text-lime-200" aria-hidden="true" />
              </div>

              <h3 className="mt-6 font-display text-xl font-bold uppercase italic text-white">
                {step.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-white/70">
                {step.description}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </section>
  );
}
