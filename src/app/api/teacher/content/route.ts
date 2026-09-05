import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { reconcileRgFiles } from "@/lib/resource-guard";

/**
 * محتوای آموزشی استاد.
 *
 * GET:
 *  - بدون پارامتر (استاد/ادمین): محتواهایی که خود استاد منتشر کرده → { contents }
 *  - با ?groupId= : محتوای منتشرشده آن کلاس (همه اساتید آن کلاس).
 *    دسترسی: عضو فعال گروه (شامل مهمانِ گروه)، استاد همان گروه، یا ADMIN/MANAGER.
 *
 * POST: انتشار محتوا با فایل آپلودشده از /api/upload.
 *  - فقط استادِ همان گروه (TeacherGroup) یا ADMINِ تخصیص‌یافته.
 *  - اعضای فعال گروه اعلان می‌گیرند + رکورد ممیزی ثبت می‌شود.
 */

const createSchema = z.object({
  groupId: z.string().trim().min(1, "کلاس را انتخاب کنید"),
  title: z.string().trim().min(1, "عنوان الزامی است").max(200),
  subject: z.string().trim().min(1, "موضوع الزامی است").max(120),
  description: z.string().trim().max(5000).optional(),
  fileUrl: z.string().trim().max(2048).optional(),
  fileName: z.string().trim().max(255).optional(),
  filePath: z
    .string()
    .trim()
    .max(1024)
    .refine((p) => !p.includes(".."), "مسیر فایل نامعتبر است")
    .optional(),
});

const contentSelect = {
  id: true,
  title: true,
  subject: true,
  description: true,
  fileUrl: true,
  fileName: true,
  filePath: true,
  createdAt: true,
  updatedAt: true,
  teacherId: true,
  groupId: true,
} as const;

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const url = new URL(req.url);
    const groupId = url.searchParams.get("groupId");

    // ---------- حالت ۱: محتوای یک کلاس مشخص ----------
    if (groupId) {
      const group = await db.group.findFirst({
        where: { id: groupId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!group) {
        return NextResponse.json({ error: "کلاس پیدا نشد" }, { status: 404 });
      }

      const isStaff = user.role === "ADMIN" || user.role === "MANAGER";
      const isTeacher =
        user.role === "TEACHER" &&
        !!(await db.teacherGroup.findFirst({
          where: { teacherId: user.id, groupId },
          select: { id: true },
        }));
      const membership = await db.groupMember.findFirst({
        where: { groupId, userId: user.id, status: "ACTIVE" },
        select: { id: true },
      });

      if (!isStaff && !isTeacher && !membership) {
        throw new AuthError(403, "دسترسی به محتوای این کلاس را ندارید");
      }

      const contents = await db.teacherContent.findMany({
        where: { groupId },
        select: {
          ...contentSelect,
          teacher: { select: { id: true, name: true, username: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ contents });
    }

    // ---------- حالت ۲: محتوای خود استاد ----------
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      throw new AuthError(403, "دسترسی لازم را ندارید");
    }

    const contents = await db.teacherContent.findMany({
      where: { teacherId: user.id },
      select: {
        ...contentSelect,
        group: { select: { id: true, name: true, color: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contents });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["TEACHER", "ADMIN"]);

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "داده نامعتبر است");
    }
    const { groupId, title, subject, description, fileUrl, fileName, filePath } =
      parsed.data;

    // فقط استادِ همان کلاس می‌تواند برای آن محتوا منتشر کند
    const teacherGroup = await db.teacherGroup.findFirst({
      where: { teacherId: user.id, groupId },
      select: { id: true },
    });
    if (!teacherGroup) {
      throw new AuthError(403, "شما استاد این کلاس نیستید");
    }

    const content = await db.teacherContent.create({
      data: {
        title,
        subject,
        description: description || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        filePath: filePath || null,
        teacherId: user.id,
        groupId,
      },
      select: {
        ...contentSelect,
        group: { select: { id: true, name: true, color: true, slug: true } },
      },
    });

    // نگهبان منابع: فایل آپلودی موقت را به این محتوا وصل کن
    if (filePath) {
      reconcileRgFiles("TEACHER_CONTENT", content.id, [filePath]);
    }

    // اعلان به اعضای فعال کلاس (به‌جز خود نویسنده)
    const members = await db.groupMember.findMany({
      where: { groupId, status: "ACTIVE" },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId).filter((id) => id !== user.id);
    await notifyUsers(memberIds, {
      title: "محتوای جدید در کلاس 📚",
      message: `«${title}» (${subject}) منتشر شد.`,
      type: "INFO",
      link: "#/submissions",
    });

    await logAudit({
      actorId: user.id,
      action: "TEACHER_CONTENT_CREATE",
      entityType: "TEACHER_CONTENT",
      entityId: content.id,
      summary: `انتشار محتوای «${title}»`,
      data: { groupId, hasFile: !!filePath },
    });

    return NextResponse.json({ content }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
