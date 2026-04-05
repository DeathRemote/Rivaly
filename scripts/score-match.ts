import { scoreMatchById } from "@/lib/pipeline/score-match";

function usage() {
  console.error("Usage: npx tsx scripts/score-match.ts <matchId> <homeScore> <awayScore>");
  console.error("Example: npx tsx scripts/score-match.ts cmn... 2 1");
}

async function main() {
  const matchId = process.argv[2];
  const homeScore = Number(process.argv[3]);
  const awayScore = Number(process.argv[4]);

  if (!matchId || Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
    usage();
    process.exit(1);
  }

  const res = await scoreMatchById({ matchId, homeScore, awayScore });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(res, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
