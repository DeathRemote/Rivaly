import { cn } from "@/lib/cn";

export function PrimaryCTAButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      {...props}
      className={cn(
        "w-full rounded-xl px-6 py-4",
        "bg-gradient-to-br from-lime-100 to-lime-400 text-black",
        "font-display text-sm font-black uppercase tracking-[0.18em]",
        "shadow-lg shadow-lime-400/15",
        "hover:brightness-110 active:scale-[0.98] transition",
        className,
      )}
    >
      {children}
    </button>
  );
}
