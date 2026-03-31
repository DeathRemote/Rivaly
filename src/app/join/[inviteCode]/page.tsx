import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProgressBar } from "@/components/ui/ProgressBar";

export const dynamic = "force-dynamic";

function sportLabel(s: "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS") {
  switch (s) {
    case "BASKETBALL":
      return "Basketball";
    case "TENNIS":
      return "Tennis";
    case "ESPORTS":
      return "Esports";
    case "SOCCER":
    default:
      return "Football";
  }
}

export default async function JoinByInviteCodePage({
  params,
}: {
  params: Promise<{ inviteCode: string }>;
}) {
  const { inviteCode } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      name: true,
      sport: true,
      competition: true,
      visibility: true,
    },
  });

  if (!group) {
    return (
      <div className="min-h-screen bg-[#0c0e11] text-[#f9f9fd] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0px_24px_48px_rgba(0,0,0,0.4)] p-8">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/50">
            Invite link
          </div>
          <h1 className="mt-3 font-display text-4xl font-black italic tracking-tight text-white">
            Group not found
          </h1>
          <p className="mt-3 text-sm font-medium text-white/60">
            This invite link is invalid or expired. Ask the group admin for a new invite link.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-6 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/70 hover:bg-white/5 hover:text-white transition"
            >
              Back to Rivaly
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const session = await auth();
  const userId = session?.user?.id;

  // Logged in: auto-join (idempotent) then redirect to the group.
  if (userId) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId },
      update: {},
    });

    redirect(`/groups/${group.id}?tab=matches`);
  }

  const callbackUrl = `/join/${encodeURIComponent(inviteCode)}`;

  return (
    <div className="min-h-screen bg-[#0c0e11] text-[#f9f9fd] flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0px_24px_48px_rgba(0,0,0,0.4)] overflow-hidden">
        <div className="px-8 pt-10 pb-7">
          <div className="text-4xl font-black italic tracking-tighter text-[#f3ffca]">Rivaly</div>
          <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/60">
            You’ve been invited
          </div>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/40">
              Joining group
            </div>
            <div className="mt-2 font-display text-2xl font-black italic tracking-tight text-white">
              {group.name}
            </div>
            <div className="mt-2 text-sm font-medium text-white/60">
              {sportLabel(group.sport)} • {group.competition}
              {group.visibility === "PRIVATE" ? " • Private" : ""}
            </div>
          </div>

          <p className="mt-5 text-sm font-medium text-white/60">
            Log in or create an account to join instantly. You’ll come right back here after auth.
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-6 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#3a4a00] shadow-[0_8px_20px_-4px_rgba(202,253,0,0.3)]"
            >
              Continue
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-black/20 px-6 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/70 hover:bg-white/5 hover:text-white transition"
            >
              Back to landing
            </Link>
          </div>
        </div>

        <ProgressBar value={66} heightClassName="h-1.5" trackClassName="bg-black/60" />
      </div>
    </div>
  );
}
