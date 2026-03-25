import { Verified } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function ProfileHero({
  identity,
  confidence,
  onEditProfile,
  onUpgradeMembership,
}: {
  identity: {
    name: string;
    username: string | null;
    planLabel: string;
    image: string | null;
  };
  confidence: {
    pct: number;
    label: string;
    description: string;
  };
  onEditProfile: () => void;
  onUpgradeMembership?: () => void;
}) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
      <div className="md:col-span-8 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
        <div className="relative">
          <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 bg-white/5">
            {identity.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="User profile"
                className="h-full w-full object-cover"
                src={identity.image}
              />
            ) : (
              <div className="h-full w-full grid place-items-center text-white/40 font-black">
                {initials(identity.name)}
              </div>
            )}
          </div>
          <div className="absolute -bottom-3 -right-3 bg-orange-500 p-2 rounded-xl shadow-lg">
            <Verified className="h-5 w-5 text-black" />
          </div>
        </div>

        <div className="text-center md:text-left space-y-3">
          <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
            <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-white uppercase">
              {identity.name}
            </h1>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-lime-100 text-[10px] font-black uppercase tracking-[0.22em]">
              {identity.planLabel}
            </span>
          </div>

          {identity.username ? (
            <p className="text-white/55 text-sm font-semibold">
              @{identity.username}
            </p>
          ) : (
            <p className="text-white/35 text-sm">Set a username to make your profile shareable.</p>
          )}

          <div className="flex gap-3 mt-4 justify-center md:justify-start flex-wrap">
            <Button variant="secondary" size="md" onClick={onEditProfile}>
              Edit Profile
            </Button>

            <Button
              variant="ghost"
              size="md"
              className={cn("border border-white/10 rounded-xl", "hover:bg-white/5")}
              onClick={() => {
                // Placeholder: we’ll wire share later (copy link, share sheet, etc.)
                navigator.clipboard?.writeText?.(window.location.href).catch(() => undefined);
              }}
            >
              Share Stats
            </Button>

            <button
              type="button"
              disabled
              onClick={onUpgradeMembership}
              className={cn(
                "h-11 rounded-xl border border-white/10 bg-black/20 px-4",
                "text-xs font-black uppercase tracking-[0.18em]",
                "text-white/50 opacity-70 cursor-not-allowed",
              )}
            >
              Upgrade Membership
            </button>
          </div>
        </div>
      </div>

      <div className="md:col-span-4">
        <ConfidenceMeterCard confidence={confidence} />
      </div>
    </section>
  );
}

function ConfidenceMeterCard({
  confidence,
}: {
  confidence: { pct: number; label: string; description: string };
}) {
  const pct = Math.max(0, Math.min(100, confidence.pct));
  return (
    <Card className="bg-black/30 p-6">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
          Confidence meter
        </span>
        <span className="text-lime-100 font-display font-black">{confidence.label}</span>
      </div>

      <div className="mt-4 h-3 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-lime-300 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-white/50">{confidence.description}</p>
    </Card>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/g).filter(Boolean);
  const a = parts[0]?.[0] ?? "K";
  const b = parts[1]?.[0] ?? "P";
  return (a + b).toUpperCase();
}
