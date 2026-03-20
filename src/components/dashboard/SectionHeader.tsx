import { cn } from "@/lib/cn";

export function SectionHeader({
  title,
  description,
  accent = "orange",
  right,
  className,
}: {
  title: string;
  description?: string;
  accent?: "orange" | "lime" | "cyan";
  right?: React.ReactNode;
  className?: string;
}) {
  const border =
    accent === "lime"
      ? "border-lime-400"
      : accent === "cyan"
        ? "border-cyan-300"
        : "border-orange-300";

  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className={cn("pl-4 border-l-4", border)}>
        <h2 className="font-display text-3xl font-black italic uppercase tracking-tight">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-white/60">{description}</p>
        ) : null}
      </div>
      {right ? <div className="hidden md:flex items-center gap-2">{right}</div> : null}
    </div>
  );
}
