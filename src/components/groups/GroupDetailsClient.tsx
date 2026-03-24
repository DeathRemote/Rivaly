"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { GroupHero, type GroupHeroData } from "@/components/groups/GroupHero";
import { InviteCodeModal } from "@/components/groups/InviteCodeModal";
import { ConfirmTypedModal } from "@/components/groups/ConfirmTypedModal";
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  return (
    <>
      <GroupHero
        group={group}
        onPredict={
          <a
            href={`/groups/${groupId}/swipe`}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-7 py-3 text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00] shadow-[0_0_20px_rgba(202,253,0,0.25)] transition hover:shadow-[0_0_30px_rgba(202,253,0,0.4)] active:scale-[0.99]"
          >
            Make Predictions
          </a>
        }
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
                onClick={() => setConfirmDeleteOpen(true)}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3",
                  "border border-red-500/30 bg-red-500/10",
                  "text-xs font-black uppercase tracking-[0.22em] text-red-200",
                  "transition hover:bg-red-500/15",
                  pending && "opacity-60 cursor-not-allowed",
                )}
              >
                Delete group
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmLeaveOpen(true)}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-6 py-3",
                  "text-xs font-black uppercase tracking-[0.22em] text-white/70",
                  "transition hover:bg-white/5 hover:text-white",
                  pending && "opacity-60 cursor-not-allowed",
                )}
              >
                Leave group
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

      <ConfirmTypedModal
        open={confirmLeaveOpen}
        onClose={() => setConfirmLeaveOpen(false)}
        title={`Leave ${group.name}?`}
        subtitle="You will be removed from this group and your predictions in this group will be deleted."
        confirmWord="LEAVE"
        confirmLabel="Leave group"
        confirmTone="neutral"
        pending={pending}
        onConfirm={() => {
          startTransition(async () => {
            const res = await leaveGroupAction({ groupId });
            if (res.ok) {
              setConfirmLeaveOpen(false);
              router.push("/groups");
              router.refresh();
              return;
            }
            alert(res.error);
          });
        }}
      />

      <ConfirmTypedModal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title={`Delete ${group.name}?`}
        subtitle="This deletes the group, removes all members, and deletes all predictions in this group. Season fixtures stay."
        confirmWord="DELETE"
        confirmLabel="Delete group"
        confirmTone="danger"
        pending={pending}
        onConfirm={() => {
          startTransition(async () => {
            const res = await deleteGroupAction({ groupId });
            if (res.ok) {
              setConfirmDeleteOpen(false);
              router.push("/groups");
              router.refresh();
              return;
            }
            alert(res.error);
          });
        }}
      />
    </>
  );
}
