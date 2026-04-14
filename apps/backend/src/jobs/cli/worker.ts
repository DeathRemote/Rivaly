import { runMatchesWorker } from "../worker/matchesWorker.js";

const pollMs = process.env.JOBS_POLL_MS ? Number(process.env.JOBS_POLL_MS) : undefined;

runMatchesWorker({ pollMs }).catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
