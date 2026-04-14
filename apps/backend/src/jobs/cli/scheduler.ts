import { runMatchesScheduler } from "../scheduler/matchesScheduler.js";

const maxMatches = process.env.JOBS_MAX_MATCHES ? Number(process.env.JOBS_MAX_MATCHES) : undefined;
const lookbackHours = process.env.JOBS_LOOKBACK_HOURS ? Number(process.env.JOBS_LOOKBACK_HOURS) : undefined;
const lookaheadMinutes = process.env.JOBS_LOOKAHEAD_MIN ? Number(process.env.JOBS_LOOKAHEAD_MIN) : undefined;

runMatchesScheduler({ maxMatches, lookbackHours, lookaheadMinutes })
  .then((res) => {
    console.log("[scheduler] done", res);
    process.exit(0);
  })
  .catch((err) => {
    console.error("[scheduler] failed", err);
    process.exit(1);
  });
