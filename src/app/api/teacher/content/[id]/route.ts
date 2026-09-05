import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { markRgFilesByRef } from "@/lib/resource-guard";

/**
 * DELETE /api/teacher/content/[id] — حذف محتوای آموزشی.
 * استادِ نویسنده یا ADMIN. رکورد ممیزی ثبت می‌شود.
 * فایل پیوست در دفتر نگهبان منابع نرم-حذف می‌شود (منتظر پاک‌سازی فیزیکی).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["TEACHER", "ADMIN"]);
    const { id } = await params;

    const content = await db.teacherContent.findUnique({
      where: { id },
      select: { id: true, title: true, teacherId: true },
    });
    if (!content) {
      return NextResponse.json({ error: "محتوا پیدا نشد" }, { status: 404 });
    }

    if (content.teacherId !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "فقط نویسنده یا ادمین می‌تواند حذف کند");
    }

    await db.teacherContent.delete({ where: { id } });

    // نگهبان منابع: فایل پیوست برای پاک‌سازی آینده علامت‌گذاری می‌شود
    markRgFilesByRef("TEACHER_CONTENT", id);

    await logAudit({
      actorId: user.id,
      action: "TEACHER_CONTENT_DELETE",
      entityType: "TEACHER_CONTENT",
      entityId: id,
      summary: `حذف محتوای «${content.title}»`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
