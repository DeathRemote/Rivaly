import { JobStatus, JobType } from "@prisma/client";

import { prisma } from "../../prisma.js";
import { adminUpsertPredictionAndScore } from "../../pipeline/admin-add-prediction.js";
import {
  recomputeGroupMemberAccuracyAggregate,
  recomputeGroupMomentumAggregate,
  recomputeUserPredictionStatsAggregate,
} from "../../aggregates/recompute.js";
import { syncCompetitionSeasonStandings } from "../../importers/competition-season-standings.js";

function arg(name: string): string | null {
  const idx = process.argv.findIndex((x) => x === name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

async function retryFailedScoreJobs() {
  const minutesRaw = arg("--minutes");
  const matchId = arg("--matchId");

  const since = minutesRaw ? new Date(Date.now() - Number(minutesRaw) * 60 * 1000) : null;

  const where: any = {
    type: JobType.SCORE_MATCH,
    status: JobStatus.FAILED,
  };

  if (since) where.updatedAt = { gte: since };
  if (matchId) where.dedupeKey = matchId;

  const res = await prisma.job.updateMany({
    where,
    data: {
      status: JobStatus.QUEUED,
      lockedAt: null,
      lockedBy: null,
      runAt: new Date(),
    },
  });

  console.log(JSON.stringify({ ok: true, action: "retry-failed-score", updated: res.count }, null, 2));
}

async function addPrediction() {
  const userId = arg("--userId");
  const matchId = arg("--matchId");
  const home = arg("--home");
  const away = arg("--away");
  const scoreIfPossible = !flag("--no-score");

  if (!userId || !matchId || home == null || away == null) {
    throw new Error(
      "Usage: admin:add-prediction --userId <id> --matchId <id> --home <n> --away <n> [--no-score]",
    );
  }

  const out = await adminUpsertPredictionAndScore({
    userId,
    matchId,
    homeScore: Number(home),
    awayScore: Number(away),
    scoreIfPossible,
  });

  // Best-effort: recompute aggregates/standings if we actually scored.
  if ((out as any).scored) {
    const affectedGroupIds: string[] = (out as any).affectedGroupIds ?? [];
    const affectedUserIds: string[] = (out as any).affectedUserIds ?? [];

    try {
      for (const gid of affectedGroupIds) {
        await recomputeGroupMemberAccuracyAggregate(gid);
        await recomputeGroupMomentumAggregate(gid);
      }
      for (const uid of affectedUserIds) {
        await recomputeUserPredictionStatsAggregate(uid);
      }
    } catch (err) {
      console.warn("[admin-cli] aggregates recompute failed", err);
    }

    // Standings: if we can infer competitionSeasonId, sync it.
    try {
      const match = await prisma.match.findUnique({ where: { id: matchId }, select: { competitionSeasonId: true } });
      if (match?.competitionSeasonId) {
        await syncCompetitionSeasonStandings({ competitionSeasonId: match.competitionSeasonId });
      }
    } catch (err) {
      console.warn("[admin-cli] standings sync failed", err);
    }
  }

  console.log(JSON.stringify({ ok: true, action: "add-prediction", result: out }, null, 2));
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === "retry-failed-score") {
    await retryFailedScoreJobs();
    return;
  }

  if (cmd === "add-prediction") {
    await addPrediction();
    return;
  }

  console.log(
    [
      "Admin CLI",
      "",
      "Commands:",
      "  retry-failed-score [--minutes <n>] [--matchId <matchId>]",
      "  add-prediction --userId <id> --matchId <id> --home <n> --away <n> [--no-score]",
    ].join("\n"),
  );
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("[admin-cli] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
