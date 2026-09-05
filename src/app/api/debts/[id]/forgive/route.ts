import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toDebtListItem } from "../../_lib/dto";

const SCHEMA = z.object({
  note: z.string().trim().max(500).optional(),
});

/**
 * POST /api/debts/[id]/forgive
 * طلبکار یا ادمین → FORGIVEN + forgivenAt + رویداد FORGIVE.
 * پیام مودبانه: «بدهی بخشیده شد». بدون تغییر امتیاز.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = SCHEMA.parse(body);

    const debt = await db.debt.findUnique({
      where: { id },
      include: { debtor: true, creditor: true },
    });
    if (!debt || debt.deletedAt) {
      return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });
    }

    const isCreditor = debt.creditorId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isCreditor && !isAdmin) {
      throw new AuthError(403, "دسترسی لازم را ندارید");
    }
    if (debt.status === "FORGIVEN") {
      return NextResponse.json(
        { error: "این تعهد از قبل بخشیده شده است" },
        { status: 400 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.debt.update({
        where: { id: debt.id },
        data: { status: "FORGIVEN", forgivenAt: new Date() },
        include: {
          debtor: true,
          creditor: true,
          createdBy: true,
          events: { select: { id: true } },
        },
      });
      await tx.debtEvent.create({
        data: {
          debtId: debt.id,
          actorId: user.id,
          type: "FORGIVE",
          note: data.note?.trim() || null,
        },
      });
      return d;
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_FORGIVE",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `بدهی «${debt.title}» بخشیده شد`,
      data: { note: data.note },
    });

    if (debt.debtorId !== user.id) {
      await notifyUser(debt.debtorId, {
        title: "🤝 بدهی بخشیده شد",
        message: `«${debt.title}» از سوی ${debt.creditor.name} بخشیده شد. فشارش کن نبود!`,
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
