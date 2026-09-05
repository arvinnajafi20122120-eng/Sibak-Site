import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

import { ADMIN_FULL_SELECT, ROLE_LABEL_FA, STATUS_LABEL_FA } from "../../_lib/dto";

const PATCH_SCHEMA = z.object({
  role: z.enum(["ADMIN", "MANAGER", "TEACHER", "MEMBER"]).optional(),
  status: z
    .enum(["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"])
    .optional(),
  rejectionNote: z.string().trim().max(500).nullable().optional(),
});

/**
 * PATCH /api/admin/users/[id] body {role?, status?, rejectionNote?}
 * گاردریل: نقش خود را تغییر نده، آخرین ادمین را تنزل/حذف نده.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = PATCH_SCHEMA.parse(body);

    const target = await db.user.findUnique({
      where: { id },
      select: ADMIN_FULL_SELECT,
    });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    // خود را تغییر نده
    if (target.id === user.id && (data.role || data.status)) {
      throw new AuthError(
        400,
        "نمی‌توانید نقش یا وضعیت حساب خودتان را تغییر دهید",
      );
    }

    // گاردریل آخرین ادمین
    const adminCount = await db.user.count({
      where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    });
    const isLastAdmin = target.role === "ADMIN" && adminCount <= 1;

    const updates: Record<string, unknown> = {};

    if (data.role && data.role !== target.role) {
      if (isLastAdmin && data.role !== "ADMIN") {
        throw new AuthError(
          400,
          "نمی‌توانید تنها ادمین سایت را تنزل دهید؛ ابتدا یک ادمین دیگر تعیین کنید",
        );
      }
      updates.role = data.role;
    }
    if (data.status && data.status !== target.status) {
      if (isLastAdmin && target.role === "ADMIN" && data.status !== "ACTIVE") {
        throw new AuthError(
          400,
          "نمی‌توانید تنها ادمین سایت را معلق/رد/حذف کنید",
        );
      }
      updates.status = data.status;
      if (data.status === "REJECTED" && data.rejectionNote !== undefined) {
        updates.rejectionNote = data.rejectionNote ?? null;
      }
    }
    if (data.rejectionNote !== undefined && !data.status) {
      updates.rejectionNote = data.rejectionNote ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "هیچ فیلدی برای ویرایش ارسال نشد" },
        { status: 400 },
      );
    }

    const updated = await db.user.update({
      where: { id },
      data: updates,
      select: ADMIN_FULL_SELECT,
    });

    // ممیزی + اطلاع
    if (data.role && data.role !== target.role) {
      await logAudit({
        actorId: user.id,
        action: "USER_ROLE_CHANGE",
        entityType: "USER",
        entityId: id,
        summary: `نقش ${target.name} از ${ROLE_LABEL_FA[target.role as keyof typeof ROLE_LABEL_FA]} به ${ROLE_LABEL_FA[data.role]} تغییر کرد`,
        data: { from: target.role, to: data.role },
      });
      await notifyUser(id, {
        title: "تغییر نقش کاربری",
        message: `نقش شما به «${ROLE_LABEL_FA[data.role]}» تغییر یافت.`,
        type: "USER",
        link: "#/profile",
      });
    }
    if (data.status && data.status !== target.status) {
      await logAudit({
        actorId: user.id,
        action: "USER_STATUS_CHANGE",
        entityType: "USER",
        entityId: id,
        summary: `وضعیت ${target.name} از ${STATUS_LABEL_FA[target.status as keyof typeof STATUS_LABEL_FA]} به ${STATUS_LABEL_FA[data.status]} تغییر کرد`,
        data: {
          from: target.status,
          to: data.status,
          note: data.rejectionNote ?? null,
        },
      });
      await notifyUser(id, {
        title: "تغییر وضعیت حساب",
        message: `وضعیت حساب شما به «${STATUS_LABEL_FA[data.status]}» تغییر یافت.`,
        type: "USER",
        link: "#/profile",
      });
    }
    if (data.rejectionNote !== undefined && !data.status) {
      await logAudit({
        actorId: user.id,
        action: "USER_REJECTION_NOTE_UPDATE",
        entityType: "USER",
        entityId: id,
        summary: `یادداشت رد ${target.name} به‌روزرسانی شد`,
        data: { note: data.rejectionNote },
      });
    }

    return NextResponse.json({ user: toSafeUser(updated as never) });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/admin/users/[id] — soft delete. guardrails: last admin / self.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, status: true, deletedAt: true },
    });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (target.id === user.id) {
      throw new AuthError(400, "نمی‌توانید حساب خودتان را حذف کنید");
    }
    const adminCount = await db.user.count({
      where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    });
    if (target.role === "ADMIN" && adminCount <= 1) {
      throw new AuthError(
        400,
        "نمی‌توانید تنها ادمین سایت را حذف کنید؛ ابتدا یک ادمین دیگر تعیین کنید",
      );
    }

    await db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: target.status === "ACTIVE" ? "SUSPENDED" : target.status,
      },
    });

    await logAudit({
      actorId: user.id,
      action: "USER_DELETE",
      entityType: "USER",
      entityId: id,
      summary: `حساب کاربری ${target.name} حذف شد (soft)`,
      data: { role: target.role, prevStatus: target.status },
    });
    await notifyUser(id, {
      title: "حساب شما حذف شد",
      message: `حساب کاربری شما توسط ادمین حذف شد.`,
      type: "USER",
      link: null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
