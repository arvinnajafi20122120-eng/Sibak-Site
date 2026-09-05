import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUser, handleApiError } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ user: null, unreadCount: 0 });
    }

    const unreadCount = await db.notification.count({
      where: { userId: user.id, readAt: null },
    });

    // کاربر PENDING هم خودش را می‌گیرد تا کلاینت دروازه «در انتظار تایید» را نشان دهد
    return NextResponse.json({ user: toSafeUser(user), unreadCount });
  } catch (e) {
    return handleApiError(e);
  }
}
