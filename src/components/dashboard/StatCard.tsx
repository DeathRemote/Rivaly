import { cn } from "@/lib/cn";

export function StatCard({
  label,
  children,
  className,
  accent = "lime",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  accent?: "lime" | "orange" | "cyan";
}) {
  const border =
    accent === "lime"
      ? "border-lime-400"
      : accent === "cyan"
        ? "border-cyan-300"
        : "border-orange-300";

  return (
    <section
      className={cn(
        "rounded-xl bg-white/5 p-6",
        "border-l-4",
        border,
        className,
      )}
    >
      <span className={cn("text-[10px] font-bold uppercase tracking-[0.2em] block", accent === "lime" ? "text-lime-100" : "text-white/60")}>
        {label}
      </span>
      <div className="mt-4">{children}</div>
    </section>
  );
}
