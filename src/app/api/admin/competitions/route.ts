import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { getAdminCatalogCached } from "@/lib/admin/catalog";
import { prisma } from "@/lib/prisma";

const QuerySchema = z.object({
  sport: z.enum(["SOCCER", "BASKETBALL", "TENNIS", "ESPORTS"]).optional(),
});

export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ sport: url.searchParams.get("sport") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid query" }, { status: 400 });
  }

  const competitions = await getAdminCatalogCached();
  const filtered = parsed.data.sport
    ? competitions.filter((c) => c.sport === parsed.data.sport)
    : competitions;

  return NextResponse.json({ ok: true, competitions: filtered });
}

const CreateSchema = z.object({
  sport: z.enum(["SOCCER", "BASKETBALL", "TENNIS", "ESPORTS"]),
  name: z.string().trim().min(2),
  country: z.string().trim().min(2).optional(),
  published: z.boolean().optional(),
  seasonLabel: z.string().trim().min(1).optional(),
  seasonPublished: z.boolean().optional(),
});

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const created = await prisma.competition.create({
    data: {
      sport: parsed.data.sport,
      name: parsed.data.name,
      country: parsed.data.country,
      published: parsed.data.published ?? false,
      ...(parsed.data.seasonLabel
        ? {
            seasons: {
              create: {
                seasonLabel: parsed.data.seasonLabel,
                published: parsed.data.seasonPublished ?? (parsed.data.published ?? false),
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  revalidateTag("admin:catalog", "default");

  return NextResponse.json({ ok: true, id: created.id });
}
