"use client";

import { useMemo, useState, useTransition } from "react";

import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileStatsGrid } from "@/components/profile/ProfileStatsGrid";
import { PredictionTrajectoryCard } from "@/components/profile/PredictionTrajectoryCard";
import { BadgesCard, type EarnedBadge } from "@/components/profile/BadgesCard";
import { RecentPerformanceList, type RecentPerformanceItem } from "@/components/profile/RecentPerformanceList";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { Modal } from "@/components/ui/Modal";
import { deleteAccountAction } from "@/app/profile/actions";

export function ProfilePageClient({
  profile,
  stats,
  confidence,
  trajectory,
  badges,
  recentPerformance,
}: {
  profile: {
    id: string;
    displayName: string;
    username: string | null;
    email: string | null;
    image: string | null;
    accountPlan: { key: string; label: string };
    createdAt: string;
  };
  stats: {
    totalPredictions: number;
    accuracyPct: number;
    totalCorrect: number;
    totalWrong: number;
  };
  confidence: {
    pct: number;
    label: string;
    description: string;
  };
  trajectory: {
    d7: Trajectory;
    d14: Trajectory;
    d30: Trajectory;
  };
  badges: {
    latest: EarnedBadge[];
    all: EarnedBadge[];
  };
  recentPerformance: RecentPerformanceItem[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const identity = useMemo(
    () => ({
      name: profile.displayName,
      username: profile.username,
      planLabel: profile.accountPlan.label,
      image: profile.image,
    }),
    [profile],
  );

  return (
    <div className="space-y-8">
      <ProfileHero
        identity={identity}
        confidence={confidence}
        onEditProfile={() => setEditOpen(true)}
      />

      <ProfileStatsGrid stats={stats} />

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PredictionTrajectoryCard trajectory={trajectory} />
        </div>
        <div>
          <BadgesCard badges={badges} />
        </div>
      </section>

      <RecentPerformanceList items={recentPerformance} />

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
              Membership
            </div>
            <div className="mt-1 text-sm font-semibold text-white/70">
              Current plan: <span className="text-white">{profile.accountPlan.label}</span>
            </div>
          </div>

          <button
            type="button"
            disabled
            className="h-11 rounded-xl border border-white/10 bg-black/20 px-5 text-xs font-black uppercase tracking-[0.18em] text-white/50 opacity-70 cursor-not-allowed"
          >
            Upgrade Membership
          </button>
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-200/70">
            Danger zone
          </div>
          <p className="mt-2 text-sm text-white/50">
            Deleting your account permanently removes your user and associated data.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              className="h-11 rounded-xl border border-red-500/30 bg-red-500/10 px-5 text-xs font-black uppercase tracking-[0.18em] text-red-200 hover:bg-red-500/15"
            >
              Delete Account
            </button>
          </div>
        </div>
      </section>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={{
          displayName: profile.displayName,
          username: profile.username ?? "",
          email: profile.email ?? "",
        }}
      />

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete account"
        description="This cannot be undone."
      >
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Confirm you want to permanently delete your Rivaly account.
          </p>

          {deleteError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {deleteError}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="h-11 px-4 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 font-semibold"
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDeleteError(null);
                startTransition(async () => {
                  const res = await deleteAccountAction();
                  if (!res.ok) {
                    setDeleteError(res.error);
                    return;
                  }

                  // After deletion, sign out client-side to clear cookies, then go to landing.
                  try {
                    const { signOut } = await import("next-auth/react");
                    await signOut({ callbackUrl: "/" });
                  } catch {
                    window.location.href = "/";
                  }
                });
              }}
              className="h-11 px-5 rounded-xl bg-red-500 text-black font-black uppercase tracking-[0.18em] text-xs hover:brightness-110"
            >
              {pending ? "Deleting…" : "Confirm delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

type Trajectory = {
  days: number;
  points: number;
  accuracyPct: number;
  series: Array<{ day: string; points: number; correct: number; total: number }>;
};
