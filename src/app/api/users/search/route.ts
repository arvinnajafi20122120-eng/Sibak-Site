import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";

/**
 * جستجوی کاربران — برای انتخاب کاربر هدف در نظرسنجی VETO_GRANT.
 * فقط اعضای فعال و حذف‌نشده — حداکثر ۱۰ مورد، بر اساس نام/نام کاربری.
 */

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    void user;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    if (q.length < 1) {
      return NextResponse.json({ users: [] });
    }

    const rows = await db.user.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        OR: [
          { name: { contains: q } },
          { username: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { name: "asc" },
    });

    const users = rows.map(toSafeUser);
    return NextResponse.json({ users });
  } catch (e) {
    return handleApiError(e);
  }
}
