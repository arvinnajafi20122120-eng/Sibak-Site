import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

/**
 * تخصیص استاد به کلاس (گروه) — چند استاد می‌توانند یک کلاس را داشته باشند.
 * منبع: جدول TeacherGroup (چند-به-چند). فقط ADMIN.
 *
 * GET    /api/teacher/assignments           → همه تخصیص‌ها با اطلاعات استاد و گروه
 * POST   { teacherId, groupId }             → تخصیص جدید (idempotent)
 * DELETE { teacherId, groupId }             → لغو تخصیص
 */

const assignSchema = z.object({
  teacherId: z.string().trim().min(1, "استاد را انتخاب کنید"),
  groupId: z.string().trim().min(1, "کلاس را انتخاب کنید"),
});

export async function GET() {
  try {
    await requireUser(["ADMIN"]);

    const rows = await db.teacherGroup.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        teacher: {
          select: { id: true, name: true, username: true, avatar: true, role: true },
        },
        group: {
          select: { id: true, name: true, slug: true, color: true, deletedAt: true },
        },
      },
    });

    const assignments = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      teacher: r.teacher,
      group: r.group,
    }));

    return NextResponse.json({ assignments });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);

    const body = await req.json().catch(() => ({}));
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "داده نامعتبر است");
    }
    const { teacherId, groupId } = parsed.data;

    const teacher = await db.user.findFirst({
      where: { id: teacherId, deletedAt: null, role: "TEACHER" },
      select: { id: true, name: true, role: true },
    });
    if (!teacher) {
      throw new AuthError(400, "کاربر انتخاب‌شده استاد معتبر نیست");
    }

    const group = await db.group.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!group) {
      throw new AuthError(400, "کلاس انتخاب‌شده معتبر نیست");
    }

    const existing = await db.teacherGroup.findUnique({
      where: { teacherId_groupId: { teacherId, groupId } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { assignment: existing, message: "این تخصیص از قبل وجود دارد" },
        { status: 200 },
      );
    }

    const assignment = await db.teacherGroup.create({
      data: { teacherId, groupId },
    });

    await notifyUser(teacherId, {
      title: "به کلاسی اختصاص یافتید 🎓",
      message: `ادمین شما را به‌عنوان استاد کلاس «${group.name}» تعیین کرد.`,
      type: "SUCCESS",
      link: "#/teacher",
    });

    await logAudit({
      actorId: user.id,
      action: "TEACHER_ASSIGN",
      entityType: "TEACHER_GROUP",
      entityId: assignment.id,
      summary: `تخصیص استاد ${teacher.name} به کلاس ${group.name}`,
      data: { teacherId, groupId },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);

    const body = await req.json().catch(() => ({}));
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "داده نامعتبر است");
    }
    const { teacherId, groupId } = parsed.data;

    const existing = await db.teacherGroup.findUnique({
      where: { teacherId_groupId: { teacherId, groupId } },
      include: {
        teacher: { select: { name: true } },
        group: { select: { name: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "این تخصیص وجود ندارد" }, { status: 404 });
    }

    await db.teacherGroup.delete({
      where: { teacherId_groupId: { teacherId, groupId } },
    });

    await notifyUser(teacherId, {
      title: "تخصیص کلاس لغو شد",
      message: `تخصیص شما به‌عنوان استاد کلاس «${existing.group.name}» توسط ادمین لغو شد.`,
      type: "WARNING",
      link: "#/teacher",
    });

    await logAudit({
      actorId: user.id,
      action: "TEACHER_UNASSIGN",
      entityType: "TEACHER_GROUP",
      entityId: existing.id,
      summary: `لغو تخصیص استاد ${existing.teacher.name} از کلاس ${existing.group.name}`,
      data: { teacherId, groupId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
