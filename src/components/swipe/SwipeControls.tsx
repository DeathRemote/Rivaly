import { cn } from "@/lib/cn";

export function SwipeControls({
  disabled,
  onHome,
  onDraw,
  onAway,
  onPredictScore,
  onSkip,
}: {
  disabled: boolean;
  onHome: () => void;
  onDraw: () => void;
  onAway: () => void;
  onPredictScore: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-5 space-y-3">
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

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onPredictScore}
          className={cn(
            "h-12 rounded-2xl",
            "bg-gradient-to-br from-[#f3ffca] to-[#beee00] text-[#3a4a00]",
            "text-xs font-black uppercase tracking-[0.22em]",
            "shadow-[0_0_24px_rgba(202,253,0,0.16)]",
            "hover:brightness-110 active:scale-[0.99] transition",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          Predict Score
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={onSkip}
          className={cn(
            "h-12 rounded-2xl border border-white/10 bg-black/25",
            "text-xs font-black uppercase tracking-[0.22em] text-white/70",
            "hover:bg-white/5 active:scale-[0.99] transition",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          Skip for now
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em] text-white/30 px-1">
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
        "h-12 rounded-2xl border border-white/10",
        "text-xs font-black uppercase tracking-[0.22em]",
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
