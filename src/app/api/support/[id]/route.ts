import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/support/[id] — مدیریت اعلام حمایت (فقط ADMIN و MANAGER).
 * action:
 *  - register: ثبت به‌عنوان حامی (نام/مبلغ/پیام قابل اصلاح + رضایت نمایش نام)
 *  - update: ویرایش حامی ثبت‌شده
 *  - reject: رد اعلام (واریز تأیید نشد یا موارد دیگر)
 */
const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("register"),
    name: z.string().trim().min(2, "نام حداقل ۲ حرف باشد").max(60, "نام حداکثر ۶۰ حرف"),
    amount: z
      .number()
      .int()
      .min(1, "مبلغ نامعتبر است")
      .max(1_000_000_000, "مبلغ بیش از حد بزرگ است")
      .nullable(),
    message: z.string().trim().max(300, "پیام حداکثر ۳۰۰ حرف است").nullable(),
    isPublic: z.boolean(),
  }),
  z.object({
    action: z.literal("update"),
    name: z.string().trim().min(2, "نام حداقل ۲ حرف باشد").max(60, "نام حداکثر ۶۰ حرف").optional(),
    amount: z
      .number()
      .int()
      .min(1, "مبلغ نامعتبر است")
      .max(1_000_000_000, "مبلغ بیش از حد بزرگ است")
      .nullable()
      .optional(),
    message: z.string().trim().max(300, "پیام حداکثر ۳۰۰ حرف است").nullable().optional(),
    isPublic: z.boolean().optional(),
  }),
  z.object({ action: z.literal("reject") }),
]);

async function getSupport(id: string) {
  return db.support.findFirst({ where: { id, deletedAt: null } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = patchSchema.parse(body);

    const support = await getSupport(id);
    if (!support) {
      return NextResponse.json({ error: "این اعلام پیدا نشد" }, { status: 404 });
    }

    if (data.action === "register") {
      if (support.status === "REGISTERED") {
        return NextResponse.json({ error: "این حمایت قبلاً ثبت شده است" }, { status: 409 });
      }
      const updated = await db.support.update({
        where: { id },
        data: {
          name: data.name,
          amount: data.amount,
          message: data.message,
          isPublic: data.isPublic,
          status: "REGISTERED",
          registeredAt: new Date(),
          registeredById: user.id,
        },
      });

      if (support.userId) {
        await db.notification.create({
          data: {
            userId: support.userId,
            title: "حمایت شما ثبت شد ❤️",
            message: data.isPublic
              ? `${user.name} حمایت شما را ثبت کرد و نامتان با سپاس در فهرست حامیان سیبک درج شد.`
              : `${user.name} حمایت شما را ثبت کرد. از همراهی‌تان سپاسگزاریم!`,
            type: "SUCCESS",
            link: "#/support",
          },
        });
      }

      await logAudit({
        actorId: user.id,
        action: "SUPPORT_REGISTER",
        entityType: "SUPPORT",
        entityId: id,
        summary: `ثبت ${updated.name} در فهرست حامیان${data.isPublic ? " (نام عمومی)" : " (نام پنهان)"}`,
        data: { amount: updated.amount, isPublic: updated.isPublic },
      });
      return NextResponse.json({ ok: true });
    }

    if (data.action === "update") {
      if (support.status !== "REGISTERED") {
        return NextResponse.json(
          { error: "فقط حامیان ثبت‌شده قابل ویرایش هستند" },
          { status: 409 },
        );
      }
      const updated = await db.support.update({
        where: { id },
        data: {
          name: data.name ?? undefined,
          amount: data.amount !== undefined ? data.amount : undefined,
          message: data.message !== undefined ? data.message : undefined,
          isPublic: data.isPublic !== undefined ? data.isPublic : undefined,
        },
      });
      await logAudit({
        actorId: user.id,
        action: "SUPPORT_UPDATE",
        entityType: "SUPPORT",
        entityId: id,
        summary: `ویرایش حامی ${updated.name}`,
        data: { isPublic: updated.isPublic },
      });
      return NextResponse.json({ ok: true });
    }

    // reject
    if (support.status === "REGISTERED") {
      return NextResponse.json(
        { error: "این حمایت ثبت شده است؛ ابتدا باید حذف شود" },
        { status: 409 },
      );
    }
    await db.support.update({
      where: { id },
      data: { status: "REJECTED" },
    });
    if (support.userId) {
      await db.notification.create({
        data: {
          userId: support.userId,
          title: "اعلام حمایت شما بررسی شد",
          message: `اعلام حمایت شما تأیید نشد. اگر فکر می‌کنید اشتباهی رخ داده، با ${user.name} در میان بگذارید.`,
          type: "WARNING",
          link: "#/support",
        },
      });
    }
    await logAudit({
      actorId: user.id,
      action: "SUPPORT_REJECT",
      entityType: "SUPPORT",
      entityId: id,
      summary: `رد اعلام حمایت ${support.name}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE — حذف نرم (فقط ADMIN و MANAGER). رکورد برای پرونده باقی می‌ماند. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const support = await getSupport(id);
    if (!support) {
      return NextResponse.json({ error: "این رکورد پیدا نشد" }, { status: 404 });
    }

    await db.support.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorId: user.id,
      action: "SUPPORT_DELETE",
      entityType: "SUPPORT",
      entityId: id,
      summary: `حذف رکورد حمایت ${support.name}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
