import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toDebtListItem } from "../../_lib/dto";

const SCHEMA = z.object({
  note: z.string().trim().max(500).optional(),
});

/**
 * POST /api/debts/[id]/reopen
 * فقط ADMIN — بازگرداندن تعهد به وضعیت OPEN.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
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

    const updated = await db.$transaction(async (tx) => {
      const d = await tx.debt.update({
        where: { id: debt.id },
        data: {
          status: "OPEN",
          settledAt: null,
          forgivenAt: null,
        },
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
          type: "REOPEN",
          note: data.note?.trim() || null,
        },
      });
      return d;
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_REOPEN",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `تعهد «${debt.title}» مجدداً باز شد`,
      data: { note: data.note },
    });

    const item = await toDebtListItem(updated, user.id);
    return NextResponse.json({ debt: item });
  } catch (e) {
    return handleApiError(e);
  }
}
