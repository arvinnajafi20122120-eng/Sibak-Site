import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toDebtListItem } from "../../_lib/dto";
import { canSeeDebt } from "../../_lib/visibility";

const SCHEMA = z.object({
  note: z.string().trim().max(500, "یادداشت طولانی است").optional(),
});

/**
 * POST /api/debts/[id]/settle-request
 * بدهکار اعلام می‌کند جبران کرده — وضعیت SETTLE_PENDING + رویداد.
 * اطلاع مودبانه به طلبکار برای تأیید.
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
    if (debt.debtorId !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "دسترسی لازم را ندارید");
    }
    if (debt.status !== "OPEN") {
      return NextResponse.json(
        { error: "این تعهد در وضعیت باز نیست" },
        { status: 400 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.debt.update({
        where: { id: debt.id },
        data: { status: "SETTLE_PENDING" },
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
          type: "SETTLE_REQUEST",
          note: data.note?.trim() || null,
        },
      });
      return d;
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_SETTLE_REQUEST",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `${user.name} جبران «${debt.title}» را اعلام کرد`,
      data: { note: data.note },
    });

    if (debt.creditorId !== user.id) {
      await notifyUser(debt.creditorId, {
        title: "جبران اعلام شد — تأیید کنید",
        message: `${debt.debtor.name} جبران «${debt.title}» را اعلام کرد. لطفاً بررسی و تأیید کنید.`,
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
