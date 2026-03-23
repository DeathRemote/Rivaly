import type { MatchListItem } from "@/components/groups/matches/types";
import { MatchCard } from "@/components/groups/matches/MatchCard";
import type { PhaseType } from "@/components/groups/matches/types";

export function MatchSection({
  title,
  subtitle,
  matches,
  groupId,
  phaseType,
}: {
  title: string;
  subtitle?: string;
  matches: MatchListItem[];
  groupId: string;
  phaseType: PhaseType;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-black uppercase tracking-tight text-white">
            {title}
          </h3>
          {subtitle ? <p className="mt-1 text-sm text-white/50">{subtitle}</p> : null}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-200/60">
          {matches.length} matches
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} groupId={groupId} phaseType={phaseType} />
        ))}
      </div>
    </section>
  );
}
