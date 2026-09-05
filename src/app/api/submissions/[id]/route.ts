import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

/**
 * جزئیات و بازبینی یک ارسال تکلیف.
 *
 * GET /api/submissions/[id]
 *  - دانش‌آموزِ صاحب اثر، استادِ همان گروه، ADMIN و MANAGER مجازند.
 *
 * PATCH /api/submissions/[id]  { status: "REVIEWED" | "NEEDS_REVISION" }
 *  - فقط استادِ همان گروه یا ADMIN/MANAGER.
 *  - reviewedById/reviewedAt ثبت، دانش‌آموز اعلان می‌گیرد، ممیزی ثبت می‌شود.
 */

const patchSchema = z.object({
  status: z.enum(["REVIEWED", "NEEDS_REVISION"], {
    message: "وضعیت بازبینی نامعتبر است",
  }),
});

async function loadSubmission(id: string) {
  return db.submission.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, username: true, avatar: true } },
      group: { select: { id: true, name: true, color: true } },
      files: true,
      reviewedBy: { select: { id: true, name: true, username: true } },
    },
  });
}

async function isTeacherOfGroup(userId: string, groupId: string): Promise<boolean> {
  const row = await db.teacherGroup.findFirst({
    where: { teacherId: userId, groupId },
    select: { id: true },
  });
  return !!row;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const submission = await loadSubmission(id);
    if (!submission) {
      return NextResponse.json({ error: "ارسال پیدا نشد" }, { status: 404 });
    }

    const isOwner = submission.studentId === user.id;
    const isStaff = user.role === "ADMIN" || user.role === "MANAGER";
    const isTeacher =
      user.role === "TEACHER" &&
      (await isTeacherOfGroup(user.id, submission.groupId));

    if (!isOwner && !isStaff && !isTeacher) {
      throw new AuthError(403, "دسترسی به این ارسال را ندارید");
    }

    return NextResponse.json({ submission });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "داده نامعتبر است");
    }

    const submission = await loadSubmission(id);
    if (!submission) {
      return NextResponse.json({ error: "ارسال پیدا نشد" }, { status: 404 });
    }

    const isStaff = user.role === "ADMIN" || user.role === "MANAGER";
    const isTeacher =
      user.role === "TEACHER" &&
      (await isTeacherOfGroup(user.id, submission.groupId));

    if (!isStaff && !isTeacher) {
      throw new AuthError(403, "فقط استادِ این کلاس می‌تواند بازبینی کند");
    }

    const updated = await db.submission.update({
      where: { id },
      data: {
        status: parsed.data.status,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: {
        student: { select: { id: true, name: true, username: true, avatar: true } },
        group: { select: { id: true, name: true, color: true } },
        files: true,
        reviewedBy: { select: { id: true, name: true, username: true } },
      },
    });

    await notifyUser(submission.studentId, {
      title:
        parsed.data.status === "REVIEWED"
          ? "تکلیف شما بررسی شد ✅"
          : "تکلیف شما نیاز به اصلاح دارد ✏️",
      message:
        parsed.data.status === "REVIEWED"
          ? `«${submission.title}» توسط ${user.name} تایید شد.`
          : `«${submission.title}» توسط ${user.name} نیاز به اصلاح علامت‌گذاری شد.`,
      type: parsed.data.status === "REVIEWED" ? "SUCCESS" : "WARNING",
      link: "#/submissions",
    });

    await logAudit({
      actorId: user.id,
      action:
        parsed.data.status === "REVIEWED"
          ? "SUBMISSION_REVIEW"
          : "SUBMISSION_NEEDS_REVISION",
      entityType: "SUBMISSION",
      entityId: id,
      summary: `بازبینی تکلیف «${submission.title}» — ${parsed.data.status}`,
    });

    return NextResponse.json({ submission: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
