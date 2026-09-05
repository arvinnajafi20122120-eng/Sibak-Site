import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";

const readSchema = z.object({
  ids: z.array(z.string()).optional(),
});

/** علامت‌گذاری اعلان‌ها به‌عنوان خوانده‌شده — همه یا فقط id های داده‌شده */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { ids } = readSchema.parse(body);

    await db.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });

    const unreadCount = await db.notification.count({
      where: { userId: user.id, readAt: null },
    });

    return NextResponse.json({ ok: true, unreadCount });
  } catch (e) {
    return handleApiError(e);
  }
}
