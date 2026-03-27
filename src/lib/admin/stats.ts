import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

export type AdminStats = {
  totalUsers: number;
  totalPredictions: number;
  totalOneTimePaymentsCents: number;
  totalMonthlyPaymentsCents: number;
  paymentsSource: "placeholder";
  cachedAt: string;
};

async function readAdminStats(): Promise<AdminStats> {
  // Keep reads lean: single-purpose count queries.
  const [totalUsers, totalPredictions] = await Promise.all([
    prisma.user.count(),
    prisma.prediction.count(),
  ]);

  // Payments are not implemented in the current schema.
  // This is deliberately structured so wiring Stripe (or any PSP) later is a drop-in change:
  // replace these two values with sums from a Payments/Subscriptions table (or your provider sync).
  const totalOneTimePaymentsCents = 0;
  const totalMonthlyPaymentsCents = 0;

  return {
    totalUsers,
    totalPredictions,
    totalOneTimePaymentsCents,
    totalMonthlyPaymentsCents,
    paymentsSource: "placeholder",
    cachedAt: new Date().toISOString(),
  };
}

// Short-lived cache: admin stats are not real-time critical.
export const getAdminStatsCached = unstable_cache(readAdminStats, ["admin:stats:v1"], {
  revalidate: 30, // seconds
  tags: ["admin:stats"],
});
