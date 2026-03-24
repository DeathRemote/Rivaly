"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { ModalShell } from "@/components/groups/ModalShell";
import { SportSelector } from "@/components/groups/SportSelector";
import { CompetitionSelector } from "@/components/groups/CompetitionSelector";
import { createGroupAction, type CreateGroupResult } from "@/app/groups/actions";

type Sport = "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS";

type FormState = {
  name: string;
  sport: Sport | "";
  // For SOCCER: this is a CompetitionSeason id. For other sports: a free-text label.
  competitionSelection: string;
};

type Errors = Partial<Record<keyof FormState, string>> & { form?: string };

export function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ name: "", sport: "", competitionSelection: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<CreateGroupResult | null>(null);

  const canSubmit = useMemo(() => {
    const hasCompetition =
      state.sport === "SOCCER"
        ? Boolean(state.competitionSelection)
        : state.competitionSelection.trim().length >= 2;

    return state.name.trim().length >= 3 && Boolean(state.sport) && hasCompetition && !pending;
  }, [state, pending]);

  function validate(next: FormState): Errors {
    const e: Errors = {};
    if (next.name.trim().length < 3) e.name = "Group name must be at least 3 characters.";
    if (!next.sport) e.sport = "Select a sport.";

    const ok =
      next.sport === "SOCCER"
        ? Boolean(next.competitionSelection)
        : next.competitionSelection.trim().length >= 2;

    if (!ok) e.competitionSelection = "Select a competition.";

    return e;
  }

  async function onSubmit() {
    const e = validate(state);
    setErrors(e);
    if (Object.keys(e).length) return;

    startTransition(async () => {
      setErrors({});
      setResult(null);
      const res = await createGroupAction({
        name: state.name,
        sport: state.sport as Sport,
        ...(state.sport === "SOCCER"
          ? { competitionSeasonId: state.competitionSelection }
          : { competition: state.competitionSelection }),
      });
      setResult(res);
      if (res.ok) {
        // Refresh server data so the new group appears immediately.
        router.refresh();
      }
    });
  }

  function resetAndClose() {
    setState({ name: "", sport: "", competitionSelection: "" });
    setErrors({});
    setResult(null);
    onClose();
  }

  const success = result?.ok === true;

  return (
    <ModalShell
      open={open}
      title={success ? "Group created" : "New Arena"}
      subtitle={
        success
          ? "Invite friends using the code below."
          : "Create a private arena for your friends or open it to the world."
      }
      onClose={resetAndClose}
      footer={
        success ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={async () => {
                if (result?.ok) await navigator.clipboard.writeText(result.inviteCode);
              }}
              className={cn(
                "flex-1 h-14 rounded-xl border border-white/10 bg-black/20",
                "text-xs font-black uppercase tracking-[0.22em] text-white/80",
                "hover:bg-white/5 transition",
              )}
            >
              Copy invite code
            </button>
            <button
              type="button"
              onClick={resetAndClose}
              className={cn(
                "flex-1 h-14 rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "hover:brightness-105 transition active:scale-[0.99]",
              )}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className={cn(
                "flex-1 h-14 rounded-xl",
                "bg-gradient-to-br from-[#f3ffca] to-[#beee00]",
                "text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00]",
                "shadow-[0_0_20px_rgba(202,253,0,0.25)]",
                "hover:shadow-[0_0_30px_rgba(202,253,0,0.4)] transition",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
              )}
            >
              {pending ? "Creating…" : "Create Group"}
            </button>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={pending}
              className={cn(
                "h-14 rounded-xl px-8",
                "border border-white/10 bg-black/20",
                "text-xs font-black uppercase tracking-[0.22em] text-white/60",
                "hover:bg-white/5 hover:text-white transition",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              Cancel
            </button>
          </div>
        )
      }
    >
      {success ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-lime-200/70">
              Invite code
            </div>
            <div className="mt-2 font-display text-4xl font-black italic tracking-[0.12em] text-lime-100">
              {result.inviteCode}
            </div>
          </div>
          <p className="text-sm text-white/60">
            Share this code to let friends join your group. (Join flow is next.)
          </p>
        </div>
      ) : (
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
              Group identity
            </label>
            <div className="relative">
              <input
                value={state.name}
                onChange={(e) => {
                  const next = { ...state, name: e.target.value };
                  setState(next);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="e.g. THE HIGH ROLLERS"
                className={cn(
                  "h-14 w-full rounded-xl bg-black/30 px-5",
                  "text-lg font-black tracking-tight text-white placeholder:text-white/25",
                  "border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-300/30",
                )}
                required
              />
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                ✎
              </div>
            </div>
            {errors.name ? <p className="text-sm text-[#ff7351]">{errors.name}</p> : null}
          </div>

          <SportSelector
            value={state.sport}
            onChange={(sport) => {
              setState((s) => ({ ...s, sport, competitionSelection: "" }));
              setErrors((prev) => ({ ...prev, sport: undefined }));
            }}
            error={errors.sport}
          />

          <CompetitionSelector
            sport={state.sport}
            value={state.competitionSelection}
            onChange={(competitionSelection) => {
              setState((s) => ({ ...s, competitionSelection }));
              setErrors((prev) => ({ ...prev, competitionSelection: undefined }));
            }}
            error={errors.competitionSelection}
          />

          {result?.ok === false ? (
            <div className="rounded-xl border border-[#ff7351]/30 bg-[#d53d18]/10 px-4 py-3 text-sm text-[#ffd2c8]">
              {result.error}
            </div>
          ) : null}
        </form>
      )}
    </ModalShell>
  );
}
