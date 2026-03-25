import { cn } from "@/lib/cn";
import { Bolt, Star, Trophy } from "lucide-react";

import type { MatchCard } from "@/features/dashboard/mock";
import { PrimaryCTAButton } from "@/components/dashboard/PrimaryCTAButton";

const SPORT_ICONS: Record<MatchCard["left"]["sport"], React.ComponentType<{ className?: string }>> = {
  basketball: Trophy,
  tennis: Star,
  soccer: Bolt,
};

export function MatchPredictionCard({
  match,
  href,
}: {
  match: MatchCard;
  href?: string;
}) {
  const badgeClass =
    match.badge.variant === "live"
      ? "bg-orange-300 text-black"
      : match.badge.variant === "social"
        ? "bg-cyan-300 text-black"
        : "bg-white/10 text-white/70";

  const metricColor =
    match.metric.color === "lime"
      ? "text-lime-300"
      : match.metric.color === "orange"
        ? "text-orange-300"
        : "text-cyan-300";

  const metricBar =
    match.metric.color === "lime"
      ? "bg-lime-300"
      : match.metric.color === "orange"
        ? "bg-orange-300"
        : "bg-cyan-300";

  const LeftIcon = SPORT_ICONS[match.left.sport];
  const RightIcon = SPORT_ICONS[match.right.sport];

  return (
    <article className="group relative overflow-hidden rounded-xl bg-white/5 hover:-translate-y-1 transition duration-300">
      <div className="relative h-32 bg-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div
          className={cn(
            "absolute left-4 top-4 z-10 rounded-full px-3 py-1",
            "text-[10px] font-black uppercase tracking-[0.2em]",
            badgeClass,
          )}
        >
          {match.badge.label}
        </div>
      </div>

      <div className="relative z-10 -mt-12 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#292c31] shadow-2xl">
              <LeftIcon className="h-7 w-7 text-lime-100" />
            </div>
            <span className="font-display text-xs font-black italic">{match.left.name}</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-tight text-white/60">
              VS
            </span>
            <span className="font-display text-xl font-black italic text-orange-300">
              {match.leagueLabel}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#292c31] shadow-2xl">
              <RightIcon className="h-7 w-7 text-cyan-300" />
            </div>
            <span className="font-display text-xs font-black italic">{match.right.name}</span>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex justify-between text-xs font-bold text-white/60">
            <span>{match.metric.label}</span>
            <span className={metricColor}>{match.metric.valueLabel}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full", metricBar)} style={{ width: `${match.metric.value}%` }} />
          </div>
        </div>

        <PrimaryCTAButton className="py-4" href={href}>Predict Now</PrimaryCTAButton>
      </div>

      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-lime-300/10 blur-[70px]" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-cyan-300/10 blur-[70px]" />
    </article>
  );
}
