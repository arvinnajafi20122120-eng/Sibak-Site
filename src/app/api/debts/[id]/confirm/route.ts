import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toDebtListItem } from "../../_lib/dto";
import { canSeeDebt } from "../../_lib/visibility";

const SCHEMA = z.object({
  note: z.string().trim().max(500).optional(),
});

/**
 * POST /api/debts/[id]/confirm
 * طلبکار یا ادمین → SETTLED + settledAt + رویداد SETTLE_CONFIRM.
 * اطلاع شادمانه به بدهکار.
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
    if (debt.status !== "OPEN" && debt.status !== "SETTLE_PENDING") {
      return NextResponse.json(
        { error: "این تعهد قابل تأیید نیست" },
        { status: 400 },
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.debt.update({
        where: { id: debt.id },
        data: { status: "SETTLED", settledAt: new Date() },
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
          type: "SETTLE_CONFIRM",
          note: data.note?.trim() || null,
        },
      });
      return d;
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_SETTLE_CONFIRM",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `جبران «${debt.title}» تأیید شد`,
      data: { note: data.note },
    });

    if (debt.debtorId !== user.id) {
      await notifyUser(debt.debtorId, {
        title: "🎉 جبران تأیید شد",
        message: `جبران «${debt.title}» توسط ${debt.creditor.name} تأیید شد. سپاس!`,
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

// نکته: اطمینان از اینکه canSeeDebt برای route های زیر مجموعه لازم نیست
// چون فقط درگیرها و ادمین اجازه دارند، که در route چک می‌شود.
void canSeeDebt;
