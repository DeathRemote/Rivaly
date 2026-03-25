import { cn } from "@/lib/cn";

export function SwipeControls({
  disabled,
  onHome,
  onDraw,
  onAway,
}: {
  disabled: boolean;
  onHome: () => void;
  onDraw: () => void;
  onAway: () => void;
}) {
  return (
    <div className="mt-4 sm:mt-5">
      <div className="grid grid-cols-3 gap-3">
        <ActionButton disabled={disabled} tone="lime" onClick={onHome}>
          Home Win
        </ActionButton>
        <ActionButton disabled={disabled} tone="neutral" onClick={onDraw}>
          Draw
        </ActionButton>
        <ActionButton disabled={disabled} tone="cyan" onClick={onAway}>
          Away Win
        </ActionButton>
      </div>

      <div className="hidden sm:flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em] text-white/30 px-1 mt-3">
        <span>Swipe ← home</span>
        <span>Swipe → away</span>
      </div>
    </div>
  );
}

function ActionButton({
  disabled,
  tone,
  children,
  onClick,
}: {
  disabled: boolean;
  tone: "lime" | "cyan" | "neutral";
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-12 rounded-full border border-white/10",
        "text-[11px] font-black uppercase tracking-[0.22em]",
        "active:scale-[0.99] transition",
        tone === "lime" && "bg-lime-300/15 text-lime-100 hover:bg-lime-300/20",
        tone === "cyan" && "bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/20",
        tone === "neutral" && "bg-black/25 text-white/80 hover:bg-white/5",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}
