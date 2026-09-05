import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  MEDAL_IMAGE_MAX_LENGTH,
  MEDAL_RARITIES,
  type MedalDTO,
  type MedalHolderDTO,
  type MedalRarity,
} from "@/lib/medals";

/**
 * GET /api/medals — کتابخانه مدال‌ها.
 * برای همهٔ کاربران واردشده (حتی مهمان) — شامل دارندگان هر مدال.
 */
export async function GET() {
  try {
    const { user } = await requireUser();

    const medals = await db.medal.findMany({
      where: { deletedAt: null },
      include: {
        holders: {
          orderBy: { awardedAt: "asc" },
          include: {
            user: { select: { id: true, name: true, username: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items: MedalDTO[] = medals.map((m) => {
      const holders: MedalHolderDTO[] = m.holders.map((h) => ({
        id: h.user.id,
        name: h.user.name,
        username: h.user.username,
        avatar: h.user.avatar,
        awardedAt: h.awardedAt.toISOString(),
      }));
      const mine = m.holders.find((h) => h.user.id === user.id);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        imageUrl: m.imageUrl,
        rarity: m.rarity as MedalRarity,
        points: m.points,
        maxCount: m.maxCount,
        holdersCount: holders.length,
        remaining: m.maxCount === null ? null : Math.max(0, m.maxCount - holders.length),
        earned: !!mine,
        awardedAt: mine?.awardedAt.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
        holders,
      };
    });

    return NextResponse.json({ medals: items });
  } catch (e) {
    return handleApiError(e);
  }
}

const IMAGE_SCHEMA = z
  .string()
  .startsWith("data:image/png;base64,", "عکس باید PNG باشد")
  .max(MEDAL_IMAGE_MAX_LENGTH, "عکس خیلی بزرگ است — نسخهٔ کوچک‌تری بگذار");

const MEDAL_SCHEMA = z.object({
  name: z.string().trim().min(2, "نام مدال حداقل ۲ حرف باشد").max(60, "نام مدال طولانی است"),
  description: z
    .string()
    .trim()
    .min(2, "توضیحات حداقل ۲ حرف باشد")
    .max(500, "توضیحات حداکثر ۵۰۰ حرف است"),
  imageUrl: IMAGE_SCHEMA,
  rarity: z.enum(MEDAL_RARITIES as [MedalRarity, ...MedalRarity[]]),
  points: z.number().int().min(0, "امتیاز نمی‌تواند منفی باشد").max(1000, "امتیاز حداکثر ۱۰۰۰"),
  maxCount: z
    .number()
    .int()
    .min(1, "سقف تعداد حداقل ۱ است")
    .max(999, "سقف تعداد حداکثر ۹۹۹")
    .nullable(),
});

/**
 * POST /api/medals — ایجاد مدال جدید (فقط ADMIN).
 * عکس PNG شفاف به‌صورت data URL ذخیره می‌شود (سازگار با SQLite و Turso).
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const data = MEDAL_SCHEMA.parse(body);

    const medal = await db.medal.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        rarity: data.rarity,
        points: data.points,
        maxCount: data.maxCount,
        createdById: user.id,
      },
    });

    await logAudit({
      actorId: user.id,
      action: "MEDAL_CREATE",
      entityType: "MEDAL",
      entityId: medal.id,
      summary: `مدال «${medal.name}» ساخته شد`,
      data: { rarity: medal.rarity, points: medal.points, maxCount: medal.maxCount },
    });

    return NextResponse.json(
      { ok: true, medal: { id: medal.id, name: medal.name } },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
