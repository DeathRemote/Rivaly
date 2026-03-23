"use client";

import { useState } from "react";

import { GroupHero, type GroupHeroData } from "@/components/groups/GroupHero";
import { InviteCodeModal } from "@/components/groups/InviteCodeModal";

export function GroupDetailsClient({
  group,
  inviteCode,
}: {
  group: GroupHeroData;
  inviteCode: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <GroupHero
        group={group}
        onInvite={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-6 py-3 text-xs font-black uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/5 hover:text-lime-100"
          >
            Invite Friends
          </button>
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
