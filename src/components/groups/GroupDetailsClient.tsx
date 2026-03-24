"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { GroupHero, type GroupHeroData } from "@/components/groups/GroupHero";
import { InviteCodeModal } from "@/components/groups/InviteCodeModal";
import { deleteGroupAction, leaveGroupAction } from "@/app/groups/actions";

export function GroupDetailsClient({
  group,
  inviteCode,
  groupId,
  canDelete,
}: {
  group: GroupHeroData;
  inviteCode: string;
  groupId: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <GroupHero
        group={group}
        onInvite={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-6 py-3 text-xs font-black uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/5 hover:text-lime-100"
            >
              Invite Friends
            </button>

            {canDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const ok = window.confirm(
                    "Delete this group? This removes all members and deletes all predictions in this group. (Season fixtures stay.)",
                  );
                  if (!ok) return;

                  startTransition(async () => {
                    const res = await deleteGroupAction({ groupId });
                    if (res.ok) {
                      router.push("/groups");
                      router.refresh();
                      return;
                    }
                    alert(res.error);
                  });
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3",
                  "border border-red-500/30 bg-red-500/10",
                  "text-xs font-black uppercase tracking-[0.22em] text-red-200",
                  "transition hover:bg-red-500/15",
                  pending && "opacity-60 cursor-not-allowed",
                )}
              >
                {pending ? "Deleting…" : "Delete group"}
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const ok = window.confirm(
                    "Leave this group? Your predictions in this group will be removed.",
                  );
                  if (!ok) return;

                  startTransition(async () => {
                    const res = await leaveGroupAction({ groupId });
                    if (res.ok) {
                      router.push("/groups");
                      router.refresh();
                      return;
                    }
                    alert(res.error);
                  });
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-6 py-3",
                  "text-xs font-black uppercase tracking-[0.22em] text-white/70",
                  "transition hover:bg-white/5 hover:text-white",
                  pending && "opacity-60 cursor-not-allowed",
                )}
              >
                {pending ? "Leaving…" : "Leave group"}
              </button>
            )}
          </div>
        }
      />

      <InviteCodeModal
        open={open}
        onClose={() => setOpen(false)}
        groupName={group.name}
        inviteCode={inviteCode}
      />
    </>
  );
}
