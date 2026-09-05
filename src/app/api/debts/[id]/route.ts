import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toDebtDetail, toDebtListItem } from "../_lib/dto";
import { canSeeDebt } from "../_lib/visibility";

/**
 * GET /api/debts/[id] — جزئیات کامل + تایم‌لاین events + allowedUsers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const base = await db.debt.findUnique({
      where: { id },
      select: {
        id: true,
        debtorId: true,
        creditorId: true,
        visibility: true,
        deletedAt: true,
        allowedUsers: { select: { userId: true } },
      },
    });
    if (!base || base.deletedAt) {
      return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });
    }
    const ok = await canSeeDebt(user, base);
    if (!ok) {
      return NextResponse.json({ error: "دسترسی لازم را ندارید" }, { status: 403 });
    }

    const detail = await toDebtDetail(id, user.id);
    if (!detail) {
      return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });
    }
    return NextResponse.json({ debt: detail });
  } catch (e) {
    return handleApiError(e);
  }
}

const PATCH_SCHEMA = z
  .object({
    title: z.string().trim().min(3, "عنوان کوتاه است").max(140).optional(),
    projectName: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    amount: z.coerce.number().int().min(1).max(1000).optional(),
    visibility: z.enum(["PUBLIC", "RESTRICTED", "PRIVATE"]).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    status: z
      .enum(["OPEN", "SETTLE_PENDING", "SETTLED", "FORGIVEN", "DISPUTED"])
      .optional(),
    note: z.string().trim().max(500).optional(),
    allowedUserIds: z.array(z.string()).optional(),
  })
  .refine(
    (d) =>
      Object.keys(d).filter((k) => k !== "note" && k !== "allowedUserIds").length > 0 ||
      d.allowedUserIds,
    { message: "حداقل یک فیلد برای ویرایش لازم است", path: ["title"] },
  );

/**
 * PATCH /api/debts/[id]
 * - ادمین: همه فیلدها
 * - بدهکار/طلبکار: فقط title/description/projectName/dueDate خودشان (نه amount/visibility/status — برای جلوگیری از سوءاستفاده)
 * برای تغییر وضعیت از endpoint های اختصاصی استفاده شود، ولی اجازه می‌دهیم ادمین مستقیم هم بزند.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = PATCH_SCHEMA.parse(body);

    const debt = await db.debt.findUnique({
      where: { id },
      include: { debtor: true, creditor: true, createdBy: true },
    });
    if (!debt || debt.deletedAt) {
      return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    const isInvolved = debt.debtorId === user.id || debt.creditorId === user.id;
    if (!isAdmin && !isInvolved) {
      throw new AuthError(403, "دسترسی لازم را ندارید");
    }

    // کاربر غیرادمین فقط فیلدهای نرم را بتواند عوض کند
    let updates: Record<string, unknown> = {};
    const ADMIN_ONLY = new Set(["amount", "visibility", "status", "allowedUserIds"]);
    for (const [k, v] of Object.entries(data)) {
      if (k === "note") continue;
      if (ADMIN_ONLY.has(k) && !isAdmin) continue;
      if (v === undefined) continue;
      if (k === "allowedUserIds") continue;
      if (k === "dueDate") {
        updates.dueDate = v ? new Date(v as string) : null;
      } else if (k === "status") {
        updates.status = v;
        if (v === "SETTLED") updates.settledAt = new Date();
        if (v === "FORGIVEN") updates.forgivenAt = new Date();
        if (v === "OPEN") {
          updates.settledAt = null;
          updates.forgivenAt = null;
        }
      } else {
        updates[k] = v;
      }
    }

    // ادمین می‌تواند allowedUserIds را بازنویسی کند (RESTRICTED)
    let newAllowedIds: string[] | null = null;
    if (isAdmin && data.allowedUserIds) {
      newAllowedIds = data.allowedUserIds;
    }

    const updated = await db.$transaction(async (tx) => {
      if (newAllowedIds) {
        await tx.debtVisibility.deleteMany({ where: { debtId: debt.id } });
        if (newAllowedIds.length) {
          await tx.debtVisibility.createMany({
            data: newAllowedIds.map((userId) => ({ debtId: debt.id, userId })),
          });
        }
      }
      const d = await tx.debt.update({
        where: { id: debt.id },
        data: updates,
        include: {
          debtor: true,
          creditor: true,
          createdBy: true,
          events: { select: { id: true } },
          allowedUsers: { include: { user: true } },
        },
      });
      await tx.debtEvent.create({
        data: {
          debtId: debt.id,
          actorId: user.id,
          type: "ADJUST",
          note: data.note ?? null,
        },
      });
      return d;
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_UPDATE",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `بدهی «${debt.title}» ویرایش شد`,
      data: { updates, by: user.role },
    });

    // اطلاع مودبانه به طرفین
    const otherId =
      debt.debtorId === user.id ? debt.creditorId : debt.debtorId;
    if (otherId && otherId !== user.id) {
      await notifyUser(otherId, {
        title: "تعهد ویرایش شد",
        message: `جزئیات تعهد «${debt.title}» به‌روزرسانی شد.`,
        type: "DEBT",
        link: `#/debts`,
      });
    }

    const item = await toDebtListItem(updated, user.id);
    return NextResponse.json({ debt: item });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/debts/[id] — soft delete (فقط ADMIN).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;

    const debt = await db.debt.findUnique({ where: { id } });
    if (!debt || debt.deletedAt) {
      return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });
    }

    await db.debt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_DELETE",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `بدهی «${debt.title}» حذف شد`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
