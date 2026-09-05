import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";

/**
 * GET /api/badges
 * همه‌ی تعریف نشان‌ها + پرچم earned برای کاربر فراخوان.
 */
export async function GET() {
  try {
    const { user } = await requireUser();
    void user;

    const badges = await db.badge.findMany({
      include: {
        users: { where: { userId: user.id }, select: { id: true, awardedAt: true } },
      },
      orderBy: { name: "asc" },
    });

    const items = badges.map((b) => ({
      id: b.id,
      key: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      color: b.color,
      earned: b.users.length > 0,
      awardedAt: b.users[0]?.awardedAt.toISOString() ?? null,
    }));

    return NextResponse.json({ badges: items });
  } catch (e) {
    return handleApiError(e);
  }
}
