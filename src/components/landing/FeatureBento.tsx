import { bento } from "@/config/landing";
import { cn } from "@/lib/cn";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

function toneClasses(tone: NonNullable<(typeof bento)[number]["tone"]>) {
  switch (tone) {
    case "lime":
      return "bg-lime-300 text-black";
    case "orange":
      return "bg-orange-400 text-black";
    case "cyan":
      return "bg-cyan-300 text-black";
    default:
      return "bg-white/10 text-white";
  }
}

export function FeatureBento() {
  return (
    <section id="features" aria-labelledby="features-title" className="py-20">
      <Container>
        <SectionHeader
          id="features-title"
          title="Engineered for victory"
          align="center"
          className="mb-12"
        />

        <div className="grid gap-4 md:grid-cols-6">
          {bento.map((item) => {
            const accent = item.tone ?? "neutral";
            const isAccentCard = item.title === "Multi-sport mastery";

            return (
              <article
                key={item.title}
                className={cn(
                  "relative overflow-hidden rounded-[2rem] border border-white/10 p-8",
                  item.layout,
                  isAccentCard
                    ? "bg-lime-300 text-black"
                    : "bg-white/5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)]",
                  "min-h-[260px]",
                )}
              >
                <div className="relative z-10">
                  <div
                    className={cn(
                      "mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
                      isAccentCard ? "bg-black/10" : "bg-white/5",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full",
                        isAccentCard ? "bg-black/10" : toneClasses(accent),
                      )}
                      aria-hidden="true"
                    >
                      <item.icon className="size-4" />
                    </span>
                    <span className={cn(isAccentCard ? "text-black/70" : "text-white/70")}>
                      Feature
                    </span>
                  </div>

                  <h3
                    className={cn(
                      "font-display text-2xl font-extrabold italic uppercase tracking-tight",
                      isAccentCard ? "text-black" : "text-white",
                    )}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-2 max-w-sm text-base",
                      isAccentCard ? "text-black/70" : "text-white/70",
                    )}
                  >
                    {item.description}
                  </p>
                </div>

                <div
                  className={cn(
                    "pointer-events-none absolute -bottom-10 -right-10 opacity-20",
                    isAccentCard ? "opacity-25" : "opacity-15",
                  )}
                  aria-hidden="true"
                >
                  <item.icon className="size-40" />
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
