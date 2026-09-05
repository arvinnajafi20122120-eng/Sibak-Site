import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";

/**
 * GET /api/teacher/groups — گروه‌هایی که استاد در آن‌ها مجوز تدریس دارد.
 * منبع: TeacherGroup (رابطه چند-به-چند استاد/گروه).
 * برای ADMIN هم فقط همین گروه‌ها برگردانده می‌شود تا با چک داخل
 * POST /api/teacher/content هم‌خوان باشد.
 */
export async function GET() {
  try {
    const { user } = await requireUser(["TEACHER", "ADMIN"]);

    const rows = await db.teacherGroup.findMany({
      where: { teacherId: user.id, group: { deletedAt: null } },
      orderBy: { createdAt: "asc" },
      include: {
        group: {
          select: { id: true, name: true, slug: true, color: true },
        },
      },
    });

    const groups = rows.map((r) => r.group);

    return NextResponse.json({ groups });
  } catch (e) {
    return handleApiError(e);
  }
}
