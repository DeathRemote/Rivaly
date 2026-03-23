import { Flame, Stars } from "lucide-react";
import { cn } from "@/lib/cn";

export function RankBadge({
  label,
  icon = "stars",
  tone = "lime",
}: {
  label: string;
  icon?: "stars" | "flame";
  tone?: "lime" | "orange";
}) {
  const Icon = icon === "flame" ? Flame : Stars;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2",
        "bg-white/5 border border-white/10",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4",
          tone === "lime" ? "text-lime-300" : "text-orange-300",
        )}
        fill="currentColor"
      />
      <span className="font-display text-xs font-bold uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
