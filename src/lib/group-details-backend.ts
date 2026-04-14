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

  const text = await res.text();

  if (!res.ok) {
    // Include status + body for debugging (safe: this is server-side only).
    throw new Error(`backend groupDetails failed: ${res.status} ${res.statusText} :: ${text.slice(0, 400)}`);
  }

  try {
    return JSON.parse(text) as GroupDetailsPayload;
  } catch {
    throw new Error(`backend groupDetails returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export const getGroupDetails = unstable_cache(
  async (userId: string, groupId: string) => _getGroupDetails(userId, groupId),
  ["backend-group-details"],
  { revalidate: 30 },
);
