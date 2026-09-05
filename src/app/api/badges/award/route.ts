import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const SCHEMA = z.object({
  userId: z.string().min(1, "کاربر هدف را انتخاب کنید"),
  badgeId: z.string().min(1, "نشان را انتخاب کنید"),
  note: z.string().trim().max(300).optional(),
});

/**
 * POST /api/badges/award
 * فقط ADMIN — اعطای نشان به کاربر (idempotent — جلوگیری از تکرار).
 * ساخت UserBadge + AuditLog + اطلاع شادمانه به کاربر.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const data = SCHEMA.parse(body);

    const [target, badge] = await Promise.all([
      db.user.findFirst({
        where: { id: data.userId, deletedAt: null },
        select: { id: true, name: true, status: true },
      }),
      db.badge.findUnique({ where: { id: data.badgeId } }),
    ]);
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (!badge) {
      return NextResponse.json({ error: "نشان یافت نشد" }, { status: 404 });
    }

    // idempotent: اگر قبلا اعطا شده، همان را برمی‌گردانیم
    const existing = await db.userBadge.findFirst({
      where: { userId: target.id, badgeId: badge.id },
    });
    let userBadge = existing;
    if (!userBadge) {
      userBadge = await db.userBadge.create({
        data: {
          userId: target.id,
          badgeId: badge.id,
          awardedById: user.id,
        },
      });

      await logAudit({
        actorId: user.id,
        action: "BADGE_AWARD",
        entityType: "USER",
        entityId: target.id,
        summary: `نشان «${badge.name}» به ${target.name} اهدا شد`,
        data: { badgeId: badge.id, badgeKey: badge.key, note: data.note },
      });

      await notifyUser(target.id, {
        title: "🎉 نشان جدید به شما اهدا شد",
        message: `نشان «${badge.name}» به شما اهدا شد. ${badge.description}`,
        type: "USER",
        link: `#/profile`,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        userBadge: {
          id: userBadge.id,
          userId: target.id,
          badgeId: badge.id,
          awardedAt: userBadge.awardedAt.toISOString(),
          alreadyAwarded: !!existing,
        },
      },
      { status: existing ? 200 : 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
