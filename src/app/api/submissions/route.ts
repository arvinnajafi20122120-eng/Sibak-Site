import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, requireMemberOrHigher, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { reconcileRgFiles } from "@/lib/resource-guard";

/**
 * ارسال تکالیف/پروژه‌های دانش‌آموزی.
 *
 * GET:
 *  - TEACHER → ارسال‌های گروه‌هایی که در آن‌ها استاد است (TeacherGroup)
 *  - ADMIN / MANAGER → همه ارسال‌ها
 *  - بقیه (MEMBER) → فقط ارسال‌های خودش
 *  فیلتر اختیاری: ?groupId= و ?status=
 *
 * POST:
 *  - دانش‌آموز عضو فعال گروه، با فایل‌های آپلودشده از /api/upload.
 *  - فایل‌ها در تراکنش به‌صورت SubmissionFile ثبت می‌شوند.
 *  - اساتید همان گروه اعلان می‌گیرند + رکورد ممیزی ثبت می‌شود.
 */

const MAX_FILES = 5;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // هماهنگ با /api/upload

const uploadMetaSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  pathname: z
    .string()
    .trim()
    .min(1)
    .max(1024)
    .refine((p) => !p.includes(".."), "مسیر فایل نامعتبر است"),
  fileSize: z.number().int().min(1).max(MAX_FILE_SIZE),
  mimeType: z.string().trim().min(1).max(120),
});

const createSchema = z.object({
  groupId: z.string().trim().min(1, "گروه را انتخاب کنید"),
  title: z.string().trim().min(1, "عنوان الزامی است").max(200, "عنوان بیش از حد طولانی است"),
  description: z.string().trim().max(5000, "توضیحات بیش از حد طولانی است").optional(),
  files: z.array(uploadMetaSchema).max(MAX_FILES, "حداکثر ۵ فایل مجاز است").optional(),
});

const submissionInclude = {
  student: {
    select: { id: true, name: true, username: true, avatar: true },
  },
  group: {
    select: { id: true, name: true, color: true },
  },
  files: true,
  reviewedBy: {
    select: { id: true, name: true, username: true },
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();

    const url = new URL(req.url);
    const groupIdFilter = url.searchParams.get("groupId") ?? undefined;
    const statusFilter = url.searchParams.get("status") ?? undefined;

    const where: Record<string, unknown> = {};

    if (user.role === "TEACHER") {
      const teacherGroups = await db.teacherGroup.findMany({
        where: { teacherId: user.id },
        select: { groupId: true },
      });
      where.groupId = { in: teacherGroups.map((t) => t.groupId) };
    } else if (user.role === "ADMIN" || user.role === "MANAGER") {
      // همه ارسال‌ها
    } else {
      where.studentId = user.id;
    }

    if (groupIdFilter) {
      // همپوشانی فیلتر نقش و فیلتر گروه
      where.groupId = groupIdFilter;
    }
    if (statusFilter) where.status = statusFilter;

    const submissions = await db.submission.findMany({
      where,
      include: submissionInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ submissions });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireMemberOrHigher(); // GUEST ممنوع

    if (user.role === "TEACHER") {
      throw new AuthError(403, "استاد نمی‌تواند ارسال دانش‌آموزی ثبت کند");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "داده‌های ارسالی معتبر نیست");
    }
    const { groupId, title, description, files } = parsed.data;

    // گروه باید موجود و حذف‌نشده باشد و کاربر عضو فعالش باشد
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
      include: { group: { select: { id: true, deletedAt: true } } },
    });

    if (!membership || membership.status !== "ACTIVE" || membership.group?.deletedAt) {
      throw new AuthError(403, "شما عضو فعال این گروه نیستید");
    }

    const fileRows = (files ?? []).map((f) => ({
      fileName: f.fileName,
      fileUrl: `/api/files/${f.pathname}`,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
    }));

    const submission = await db.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: {
          studentId: user.id,
          groupId,
          title,
          description: description || null,
          status: "PENDING",
          files: { create: fileRows },
        },
        include: submissionInclude,
      });
      return created;
    });

    // نگهبان منابع: فایل‌های آپلودی موقت را به این ارسال وصل کن (خروج از حالت UNATTACHED)
    reconcileRgFiles("SUBMISSION", submission.id, (files ?? []).map((f) => f.pathname));

    // اعلان به اساتید همان گروه (به‌جز خود فرستنده)
    const teacherGroups = await db.teacherGroup.findMany({
      where: { groupId },
      select: { teacherId: true },
    });
    const teacherIds = teacherGroups.map((t) => t.teacherId).filter((id) => id !== user.id);
    await notifyUsers(teacherIds, {
      title: "ارسال جدید برای بررسی",
      message: `«${user.name}» پروژه‌ای با عنوان «${title}» ارسال کرد.`,
      type: "INFO",
      link: "#/submissions",
    });

    await logAudit({
      actorId: user.id,
      action: "SUBMISSION_CREATE",
      entityType: "SUBMISSION",
      entityId: submission.id,
      summary: `ارسال تکلیف: ${title}`,
      data: { groupId, filesCount: fileRows.length },
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
