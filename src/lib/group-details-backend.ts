import { unstable_cache } from "next/cache";

import { getBackendBaseUrl, getBackendJwtSecret } from "@/lib/backend";
import { signBackendUserToken } from "@/lib/backend-auth";

export type GroupDetailsPayload = {
  group: {
    id: string;
    name: string;
    sport: "SOCCER" | "BASKETBALL" | "TENNIS" | "ESPORTS";
    competition: string;
    competitionSeasonId: string | null;
    memberCount: number;
    createdById: string;
  };
  membership: {
    role: "MEMBER" | "ADMIN";
    points: number;
  };
  viewer: {
    accuracyPct: number;
  };
  inviteCode: string;
  canDelete: boolean;
};

async function _getGroupDetails(userId: string, groupId: string): Promise<GroupDetailsPayload> {
  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();
  if (!backendBase || !backendSecret) throw new Error("Backend not configured");

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });

  const res = await fetch(`${backendBase}/api/internal/groups/${encodeURIComponent(groupId)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as GroupDetailsPayload;
}

export const getGroupDetails = unstable_cache(
  async (userId: string, groupId: string) => _getGroupDetails(userId, groupId),
  ["backend-group-details"],
  { revalidate: 30 },
);
