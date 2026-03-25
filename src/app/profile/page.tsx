import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scorePredictionPoints } from "@/lib/scoring/predictions";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";

import { sideNavItems, topNavItems } from "@/features/dashboard/mock";

type AccountTier = "FREE" | "BASIC" | "PRO" | "ELITE" | "FRIENDS_AND_FAMILY";

function accountTierLabel(tier: AccountTier) {
  switch (tier) {
    case "FRIENDS_AND_FAMILY":
      return "Friends & Family";
    case "ELITE":
      return "Elite";
    case "PRO":
      return "Pro";
    case "BASIC":
      return "Basic";
    case "FREE":
    default:
      return "Free";
  }
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/profile");
  const userId = session.user.id;
  if (!userId) redirect("/login?callbackUrl=/profile");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: true,
      role: true,
      accountTier: true,
      createdAt: true,
    },
  });

  if (!user) redirect("/login?callbackUrl=/profile");

  // Account tier / plan is stored separately from role (ADMIN is permissions, not billing).
  const accountTier = (user.accountTier ?? "FREE") as AccountTier;

  // Basic stats
  const totalPredictions = await prisma.prediction.count({ where: { userId } });

  // Only predictions whose match is finished & has a result are scorable.
  const scorablePredictions = await prisma.prediction.findMany({
    where: {
      userId,
      match: {
        status: "FINISHED",
        result: { isNot: null },
      },
    },
    select: {
      homeScore: true,
      awayScore: true,
      updatedAt: true,
      match: {
        select: {
          id: true,
          kickoffAt: true,
          finalizedAt: true,
          homeTeam: { select: { name: true, shortName: true } },
          awayTeam: { select: { name: true, shortName: true } },
          result: { select: { homeScore: true, awayScore: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 250, // enough for profile aggregates; keep it bounded.
  });

  let correct = 0;
  let wrong = 0;

  for (const p of scorablePredictions) {
    const r = p.match.result;
    if (!r) continue;

    const predictedOutcome = outcome(p.homeScore, p.awayScore);
    const actualOutcome = outcome(r.homeScore, r.awayScore);

    if (predictedOutcome === actualOutcome) correct++;
    else wrong++;
  }

  const totalScored = correct + wrong;
  const accuracyPct = totalScored === 0 ? 0 : (correct / totalScored) * 100;

  const confidencePct = deriveConfidencePct({
    totalScored,
    accuracyPct,
  });

  // Recent performance (latest 3 predictions, whether finished or not)
  const recentPredictions = await prisma.prediction.findMany({
    where: { userId },
    select: {
      id: true,
      homeScore: true,
      awayScore: true,
      source: true,
      updatedAt: true,
      match: {
        select: {
          id: true,
          kickoffAt: true,
          status: true,
          homeTeam: { select: { name: true, shortName: true } },
          awayTeam: { select: { name: true, shortName: true } },
          result: { select: { homeScore: true, awayScore: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  const recent = recentPredictions.map((p) => {
    const result = p.match.result;
    const points =
      result && p.match.status === "FINISHED"
        ? scorePredictionPoints({
            predicted: { home: p.homeScore, away: p.awayScore },
            actual: { home: result.homeScore, away: result.awayScore },
          }).points
        : null;

    return {
      id: p.id,
      match: {
        id: p.match.id,
        kickoffAt: p.match.kickoffAt.toISOString(),
        status: p.match.status,
        home: { name: p.match.homeTeam.shortName ?? p.match.homeTeam.name },
        away: { name: p.match.awayTeam.shortName ?? p.match.awayTeam.name },
      },
      predicted: { homeScore: p.homeScore, awayScore: p.awayScore, source: p.source },
      actual: result ? { homeScore: result.homeScore, awayScore: result.awayScore } : null,
      points,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  // Trajectory: daily points (global scoring) across a window.
  const trajectory = {
    d7: await getTrajectory({ userId, days: 7 }),
    d14: await getTrajectory({ userId, days: 14 }),
    d30: await getTrajectory({ userId, days: 30 }),
  };

  const badges = deriveBadges({
    totalPredictions,
    totalScored,
    correct,
    accuracyPct,
  });

  return (
    <DashboardLayout
      topNavItems={topNavItems}
      sideNavItems={sideNavItems}
      activeKey="profile"
      user={{
        name: user.username ?? user.name ?? "Kinetic Player",
        image: user.image ?? null,
        rankLabel: accountTierLabel(accountTier),
      }}
    >
      <ProfilePageClient
        profile={{
          id: user.id,
          displayName: user.name ?? user.username ?? "Kinetic Player",
          username: user.username ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          accountPlan: { key: accountTier, label: accountTierLabel(accountTier) },
          createdAt: user.createdAt.toISOString(),
        }}
        stats={{
          totalPredictions,
          accuracyPct,
          totalCorrect: correct,
          totalWrong: wrong,
        }}
        confidence={{
          pct: confidencePct,
          label: `${Math.round(confidencePct)}% Confidence`,
          description:
            totalScored === 0
              ? "Make a few predictions to unlock your confidence meter."
              : "Momentum reflects recent accuracy and activity across scored matches.",
        }}
        trajectory={trajectory}
        badges={badges}
        recentPerformance={recent}
      />
    </DashboardLayout>
  );
}

function outcome(home: number, away: number): "HOME" | "DRAW" | "AWAY" {
  if (home === away) return "DRAW";
  return home > away ? "HOME" : "AWAY";
}

function deriveConfidencePct({
  totalScored,
  accuracyPct,
}: {
  totalScored: number;
  accuracyPct: number;
}) {
  // A simple, stable v1 metric:
  // - accuracy drives confidence
  // - volume reduces variance (up to 100 scored matches)
  const volumeFactor = Math.min(1, totalScored / 100);
  const base = accuracyPct * 0.9 + 10; // keeps low-volume users from showing 0
  return Math.max(0, Math.min(100, base * volumeFactor + (1 - volumeFactor) * 25));
}

async function getTrajectory({ userId, days }: { userId: string; days: 7 | 14 | 30 }) {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const preds = await prisma.prediction.findMany({
    where: {
      userId,
      match: {
        status: "FINISHED",
        finalizedAt: { gte: from },
        result: { isNot: null },
      },
    },
    select: {
      homeScore: true,
      awayScore: true,
      match: {
        select: {
          finalizedAt: true,
          result: { select: { homeScore: true, awayScore: true } },
        },
      },
    },
    orderBy: { match: { finalizedAt: "asc" } },
  });

  // Build a day-bucket series
  const buckets: Array<{ day: string; points: number; correct: number; total: number }> = [];
  const byDay = new Map<string, { points: number; correct: number; total: number }>();

  for (const p of preds) {
    const finalized = p.match.finalizedAt;
    const r = p.match.result;
    if (!finalized || !r) continue;

    const day = finalized.toISOString().slice(0, 10); // YYYY-MM-DD
    const scored = scorePredictionPoints({
      predicted: { home: p.homeScore, away: p.awayScore },
      actual: { home: r.homeScore, away: r.awayScore },
    });

    const predictedOutcome = outcome(p.homeScore, p.awayScore);
    const actualOutcome = outcome(r.homeScore, r.awayScore);

    const cur = byDay.get(day) ?? { points: 0, correct: 0, total: 0 };
    cur.points += scored.points;
    cur.total += 1;
    if (predictedOutcome === actualOutcome) cur.correct += 1;
    byDay.set(day, cur);
  }

  // Ensure we render a continuous series for the range (even if empty days)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const v = byDay.get(key) ?? { points: 0, correct: 0, total: 0 };
    buckets.push({ day: key, ...v });
  }

  const total = buckets.reduce((acc, b) => acc + b.total, 0);
  const correct = buckets.reduce((acc, b) => acc + b.correct, 0);
  const accuracyPct = total === 0 ? 0 : (correct / total) * 100;
  const points = buckets.reduce((acc, b) => acc + b.points, 0);

  return { days, points, accuracyPct, series: buckets };
}

function deriveBadges(input: {
  totalPredictions: number;
  totalScored: number;
  correct: number;
  accuracyPct: number;
}) {
  // Badge system v0: derived-only.
  // We keep the shape as if it were persisted so a later BadgeEarned table fits naturally.
  const earnedAt = new Date().toISOString();

  const all = [
    input.totalPredictions >= 1
      ? {
          id: "first-prediction",
          title: "First Blood",
          subtitle: "Made your first prediction",
          tone: "lime" as const,
          earnedAt,
        }
      : null,
    input.totalPredictions >= 25
      ? {
          id: "predictor-25",
          title: "Predictor",
          subtitle: "25 total predictions",
          tone: "cyan" as const,
          earnedAt,
        }
      : null,
    input.correct >= 10
      ? {
          id: "ten-correct",
          title: "Hot Streak",
          subtitle: "10 correct outcomes",
          tone: "orange" as const,
          earnedAt,
        }
      : null,
    input.totalScored >= 25 && input.accuracyPct >= 60
      ? {
          id: "sniper",
          title: "Sniper",
          subtitle: "60%+ accuracy (scored matches)",
          tone: "lime" as const,
          earnedAt,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    subtitle: string;
    tone: "lime" | "cyan" | "orange";
    earnedAt: string;
  }>;

  const latest = all.slice(-4).reverse();

  return {
    latest,
    all,
  };
}
