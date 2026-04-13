import { unstable_cache } from "next/cache";

import { getBackendBaseUrl, getBackendJwtSecret } from "@/lib/backend";
import { signBackendUserToken } from "@/lib/backend-auth";

export type GroupCardData = {
  id: string;
  name: string;
  competition: string;
  memberCount: number;
  yourRank: number | null;
  yourPoints: number;
  top3: Array<{ position: number; name: string; points: number; isYou?: boolean }>;
};

async function _getGroups(userId: string, tab: "my" | "public") {
  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();
  if (!backendBase || !backendSecret) throw new Error("Backend not configured");

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });
  const res = await fetch(`${backendBase}/api/internal/groups?tab=${encodeURIComponent(tab)}` , {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { groups: GroupCardData[] };
}

export const getGroupsForUser = unstable_cache(
  async (userId: string, tab: "my" | "public") => _getGroups(userId, tab),
  ["backend-groups"],
  { revalidate: 30 },
);

export async function joinGroupByInviteCode(
  userId: string,
  inviteCode: string,
): Promise<{ ok: true; groupId: string }> {
  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();
  if (!backendBase || !backendSecret) throw new Error("Backend not configured");

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });
  const res = await fetch(`${backendBase}/api/internal/groups/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inviteCode }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { ok: true; groupId: string };
}

export async function getInvitePreview(inviteCode: string): Promise<{
  group: {
    id: string;
    name: string;
    sport: "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS";
    competition: string;
    visibility: "PRIVATE" | "PUBLIC";
  };
} | null> {
  const backendBase = getBackendBaseUrl();
  if (!backendBase) return null;

  const res = await fetch(`${backendBase}/api/public/invites/${encodeURIComponent(inviteCode)}`, {
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as any;
}
