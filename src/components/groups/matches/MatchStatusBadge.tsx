import { cn } from "@/lib/cn";
import type { MatchPredictionStatus, MatchStatus } from "@/components/groups/matches/types";

export function MatchStatusBadge({
  status,
  matchStatus,
}: {
  status: MatchPredictionStatus;
  matchStatus: MatchStatus;
}) {
  const { label, tone } = toTone(status, matchStatus);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1",
        "text-[10px] font-black uppercase tracking-[0.22em]",
        tone === "lime" && "border-lime-300/20 bg-lime-300/10 text-lime-200",
        tone === "orange" && "border-orange-300/20 bg-orange-300/10 text-orange-200",
        tone === "dim" && "border-white/10 bg-black/20 text-white/40",
      )}
    >
      {label}
    </span>
  );
}

function toTone(status: MatchPredictionStatus, matchStatus: MatchStatus) {
  if (matchStatus === "FINAL") return { label: "COMPLETED", tone: "dim" as const };
  if (status === "NOT_PREDICTED") return { label: "NOT PREDICTED", tone: "orange" as const };
  if (status === "PREDICTED") return { label: "PREDICTED", tone: "lime" as const };
  if (status === "LOCKED") return { label: "LOCKED", tone: "dim" as const };
  return { label: "COMPLETED", tone: "dim" as const };
}
