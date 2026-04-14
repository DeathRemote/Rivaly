import { JobStatus, JobType } from "@prisma/client";

import { claimNextJob, markJobDone, markJobFailed } from "../dbQueue.js";
import { sleep } from "../support/sleep.js";
import { scoreMatch } from "../../pipeline/score-match.js";
import {
  recomputeGroupMemberAccuracyAggregate,
  recomputeGroupMomentumAggregate,
  recomputeUserPredictionStatsAggregate,
} from "../../aggregates/recompute.js";
import { syncCompetitionSeasonStandings } from "../../importers/competition-season-standings.js";

export async function runMatchesWorker(opts?: {
  lockOwner?: string;
  pollMs?: number;
}) {
  const lockOwner = opts?.lockOwner ?? `worker-${process.pid}`;
  const pollMs = opts?.pollMs ?? 750;

  console.log(`[worker] starting (lockOwner=${lockOwner}, pollMs=${pollMs})`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await claimNextJob(lockOwner);

    if (!job) {
      await sleep(pollMs);
      continue;
    }

    try {
      if (job.type === JobType.SCORE_MATCH) {
        const payload = job.payload as any;

        const result = await scoreMatch({
          matchId: String(payload.matchId),
          homeScore: Number(payload.homeScore),
          awayScore: Number(payload.awayScore),
          providerEventId: payload.providerEventId ? String(payload.providerEventId) : null,
        });

        // Best-effort aggregates + standings.
        try {
          for (const groupId of result.affectedGroupIds) {
            await recomputeGroupMemberAccuracyAggregate(groupId);
            await recomputeGroupMomentumAggregate(groupId);
          }
          for (const userId of result.affectedUserIds) {
            await recomputeUserPredictionStatsAggregate(userId);
          }
        } catch (err) {
          console.warn("[worker] aggregates recompute failed", err);
        }

        if (payload.competitionSeasonId) {
          try {
            await syncCompetitionSeasonStandings({ competitionSeasonId: String(payload.competitionSeasonId) });
          } catch (err) {
            console.warn("[worker] standings sync failed", err);
          }
        }

        await markJobDone(job.id);
      } else {
        // Unknown job type.
        await markJobFailed(job.id, new Error(`Unsupported job type: ${job.type}`));
      }
    } catch (err) {
      console.error("[worker] job failed", { id: job.id, type: job.type, err });
      // Backoff: retry in 2 minutes for now.
      await markJobFailed(job.id, err, new Date(Date.now() + 2 * 60 * 1000));
    }
  }
}
