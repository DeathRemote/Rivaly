"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [copied, setCopied] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  // Avoid hydration mismatches:
  // - On the server, window/location is unavailable.
  // - On the client, window.location.origin exists.
  // If we compute different values on first render, React will throw a hydration error.
  // So we start with a stable relative URL, then upgrade to absolute after mount.
  const [inviteLink, setInviteLink] = useState(`/join/${inviteCode}`);

  useEffect(() => {
    setInviteLink(`${window.location.origin}/join/${inviteCode}`);
  }, [inviteCode]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <>
      <GroupHero
        group={group}
        onPredict={
          <a
            href="/swipe"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-5 py-2.5 sm:px-7 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00] shadow-[0_0_20px_rgba(202,253,0,0.25)] transition hover:shadow-[0_0_30px_rgba(202,253,0,0.4)] active:scale-[0.99]"
          >
            Swipe predictions
          </a>
        }
        onInvite={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                } catch {
                  // Clipboard can fail on some browsers/contexts; fall back to showing the code.
                  setOpen(true);
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-5 py-2.5 sm:px-6 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/5 hover:text-lime-100"
            >
              {copied ? "Copied!" : "Copy invite link"}
            </button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-5 py-2.5 sm:px-6 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Show invite code
            </button>

            {canDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDeleteOpen(true)}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 sm:px-6 sm:py-3",
                  "border border-red-500/30 bg-red-500/10",
                  "text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-red-200",
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
                  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-5 py-2.5 sm:px-6 sm:py-3",
                  "text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] text-white/70",
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
        subtitle="You will be removed from this group. Your match predictions are saved globally and won’t be deleted."
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
        subtitle="This deletes the group and removes all members. Season fixtures stay. (Your match predictions are global and won’t be deleted.)"
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
