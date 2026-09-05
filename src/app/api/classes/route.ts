import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";

/**
 * GET /api/classes — کلاس‌های درسی سایت.
 *
 * تعریف «کلاس» در سیبک (بدون تغییر schema):
 *   هر گروهی که حداقل یک استاد در آن تخصیص یافته باشد (وجود ردیف TeacherGroup)
 *   یک کلاس درسی است؛ گروه‌های بدون استاد «زیرمجموعه» (گروه مطالعاتی) می‌مانند.
 *
 * پاسخ شامل: اساتید (safe)، شمار دانش‌آموزان فعال، شمار محتوای منتشرشده،
 * وضعیت عضویت خود کاربر و سیاست عضویت — تا کارت کلاس بتواند دکمه عضویت بدهد.
 * مهمان (GUEST) هم دسترسی فقط‌خواندنی دارد (هم‌راستا با زیرمجموعه‌ها).
 */
export async function GET() {
  try {
    const { user } = await requireUser();

    const groups = await db.group.findMany({
      where: {
        deletedAt: null,
        teacherGroups: { some: {} },
      },
      orderBy: { createdAt: "asc" },
      include: {
        teacherGroups: {
          select: { teacher: true },
          orderBy: { createdAt: "asc" },
        },
        members: { where: { userId: user.id }, select: { status: true } },
      },
    });

    const classes = await Promise.all(
      groups.map(async (g) => {
        const [studentCount, contentCount] = await Promise.all([
          db.groupMember.count({ where: { groupId: g.id, status: "ACTIVE" } }),
          db.teacherContent.count({ where: { groupId: g.id } }),
        ]);

        return {
          id: g.id,
          name: g.name,
          slug: g.slug,
          description: g.description,
          color: g.color,
          icon: g.icon,
          joinPolicy: g.joinPolicy,
          createdAt: g.createdAt.toISOString(),
          teachers: g.teacherGroups.map((tg) => toSafeUser(tg.teacher)),
          studentCount,
          contentCount,
          myMembership: g.members[0]?.status ?? null,
        };
      }),
    );

    return NextResponse.json({ classes });
  } catch (e) {
    return handleApiError(e);
  }
}
