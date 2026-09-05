import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";
import { relativeTime, formatJalaliDateTime } from "@/lib/jalali";

import { ADMIN_SAFE_SELECT } from "../_lib/dto";

/**
 * GET /api/admin/comments — نظرات اخیر در همه موجودیت‌ها (شامل حذف‌شده).
 * حد ۵۰ رکورد آخر.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    void user;

    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Number(sp.get("limit") ?? "50"), 100);

    const rows = await db.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: ADMIN_SAFE_SELECT } },
    });

    const comments = rows.map((c) => ({
      id: c.id,
      body: c.body,
      entityType: c.entityType,
      entityId: c.entityId,
      author: toSafeUser(c.author as never),
      createdAt: c.createdAt.toISOString(),
      dateTimeFa: formatJalaliDateTime(c.createdAt),
      relative: relativeTime(c.createdAt),
      deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    }));

    return NextResponse.json({ comments });
  } catch (e) {
    return handleApiError(e);
  }
}
