import { unstable_cache } from "next/cache";

import { getBackendBaseUrl, getBackendJwtSecret } from "@/lib/backend";
import { signBackendUserToken } from "@/lib/backend-auth";

export type DashboardPayload = {
  standing:
    | {
        eligible: true;
        topPercent: number;
        cohortSize: number;
        score: number;
        breakdown: {
          recent30dAccuracyPct: number;
          lifetimeAccuracyPct: number;
          avgPointsPerScoredPrediction: number;
          scoredPredictionsLifetime: number;
          scoredPredictions30d: number;
        };
      }
    | { eligible: false; minRequired: number; scoredPredictionsLifetime: number };
  dash: {
    kickoff: {
      matchesToPredict: Array<{
        matchId: string;
        kickoffAt: string;
        home: string;
        away: string;
        groupId: string | null;
        lockAt: string;
      }>;
      allOpenCount: number;
      remainingCount: number;
    };
    lastResult:
      | null
      | {
          matchLabel: string;
          home: string;
          away: string;
          predicted: string;
          actual: string;
          points: number;
          at: string;
        };
    spotlightGroup:
      | null
      | {
          id: string;
          name: string;
          leaderboardTop3: Array<{
            position: number;
            name: string;
            points: number;
            isYou: boolean;
            accent: "lime" | "cyan" | "dim";
          }>;
          needsToPredictCount: number;
        };
  };
};

async function _getDashboard(userId: string): Promise<DashboardPayload> {
  const backendBase = getBackendBaseUrl();
  const backendSecret = getBackendJwtSecret();
  if (!backendBase || !backendSecret) throw new Error("Backend not configured");

  const bearer = await signBackendUserToken({ userId, secret: backendSecret });

  const res = await fetch(`${backendBase}/api/internal/dashboard`, {
    headers: { Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as DashboardPayload;
}

export const getDashboardPayload = unstable_cache(
  async (userId: string) => _getDashboard(userId),
  ["backend-dashboard"],
  // Keep short for responsiveness, long enough to cut load.
  { revalidate: 15 },
);
