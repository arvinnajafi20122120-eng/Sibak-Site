import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";

/**
 * لیست مینیمال همه گروه‌های فعال — برای انتخاب در فرم نظرسنجی/پیام.
 * (این endpoint مستقل از groups API است تا تصادمی نباشد.)
 */

export async function GET() {
  try {
    const { user } = await requireUser();
    void user;

    const groups = await db.group.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, color: true },
    });

    return NextResponse.json({ groups });
  } catch (e) {
    return handleApiError(e);
  }
}
