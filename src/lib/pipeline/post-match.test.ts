import { describe, expect, it, vi, beforeEach } from "vitest";

import { Provider } from "@prisma/client";

// ---- mocks ----

const prisma = {
  match: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  matchResult: {
    upsert: vi.fn(),
  },
  prediction: {
    findMany: vi.fn(),
  },
  group: {
    findMany: vi.fn(),
  },
  groupMember: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  pointsEvent: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (fn: any) => fn(prisma)),
};

vi.mock("@/lib/prisma", () => ({ prisma }));

vi.mock("@/lib/providers/thesportsdb/client", () => {
  return {
    TheSportsDbClient: vi.fn().mockImplementation(() => {
      return {
        lookupEvent: vi.fn(async () => ({
          strStatus: "Match Finished",
          intHomeScore: 2,
          intAwayScore: 1,
        })),
      };
    }),
  };
});

vi.mock("@/lib/importers/thesportsdb/map", () => {
  return { mapTheSportsDbStatus: vi.fn(() => "FINISHED") };
});

vi.mock("@/lib/aggregates/recompute", () => {
  return {
    recomputeGroupMemberAccuracyAggregate: vi.fn(async () => undefined),
    recomputeGroupMomentumAggregate: vi.fn(async () => undefined),
    recomputeUserPredictionStatsAggregate: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/importers/competition-season-standings", () => {
  return {
    syncCompetitionSeasonStandings: vi.fn(async () => undefined),
  };
});

// Import AFTER mocks.
import { syncAndProcessFinishedMatches } from "@/lib/pipeline/post-match";

describe("syncAndProcessFinishedMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes matches that are already FINISHED when processedAt is null (regression)", async () => {
    // This match is FINISHED but not processed. Previously it would be excluded by the candidate query.
    prisma.match.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        kickoffAt: new Date(),
        processedAt: null,
        provider: Provider.THESPORTSDB,
        providerMatchId: "evt1",
        status: "FINISHED",
        competitionSeasonId: "cs1",
        competitionSeason: { competition: { id: "c1" } },
      },
    ]);

    prisma.prediction.findMany.mockResolvedValueOnce([
      { userId: "u1", homeScore: 1, awayScore: 1 },
    ]);

    prisma.group.findMany.mockResolvedValueOnce([{ id: "g1" }]);

    prisma.groupMember.findMany.mockResolvedValueOnce([{ groupId: "g1", userId: "u1" }]);

    prisma.pointsEvent.create.mockResolvedValueOnce({ points: 3 });

    const res = await syncAndProcessFinishedMatches({ maxMatches: 1, lookbackHours: 24 });

    expect(res.skipped).toBe(false);
    expect(res.scanned).toBe(1);
    expect(res.processed).toHaveLength(1);
    expect(res.processed[0]).toMatchObject({ matchId: "m1" });

    // Verify we attempted to mark as processed.
    expect(prisma.match.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" }, data: expect.objectContaining({ processedAt: expect.any(Date) }) }),
    );
  });
});
