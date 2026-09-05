import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { canSeeDebt } from "../../_lib/visibility";

const SCHEMA = z.object({
  note: z
    .string()
    .trim()
    .min(1, "متن یادداشت را وارد کنید")
    .max(500, "یادداشت طولانی است"),
});

/**
 * POST /api/debts/[id]/comment
 * هر کسی که بدهی را می‌بیند → DebtEvent COMMENT + اطلاع به طرف مقابل.
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
      include: { allowedUsers: { select: { userId: true } }, debtor: true, creditor: true },
    });
    if (!debt || debt.deletedAt) {
      return NextResponse.json({ error: "بدهی یافت نشد" }, { status: 404 });
    }
    const ok = await canSeeDebt(user, debt);
    if (!ok) {
      return NextResponse.json({ error: "دسترسی لازم را ندارید" }, { status: 403 });
    }

    const ev = await db.debtEvent.create({
      data: {
        debtId: debt.id,
        actorId: user.id,
        type: "COMMENT",
        note: data.note,
      },
      include: { actor: true },
    });

    await logAudit({
      actorId: user.id,
      action: "DEBT_COMMENT",
      entityType: "DEBT",
      entityId: debt.id,
      summary: `یادداشت روی بدهی «${debt.title}»`,
      data: { note: data.note },
    });

    // اطلاع به طرف مقابل درگیر
    const otherIds = [debt.debtorId, debt.creditorId].filter(
      (uid) => uid && uid !== user.id,
    );
    for (const oid of otherIds) {
      await notifyUser(oid, {
        title: "یادداشت جدید روی تعهد",
        message: `${user.name} روی «${debt.title}» یادداشت گذاشت: «${data.note.slice(0, 80)}»`,
        type: "DEBT",
        link: `#/debts`,
      });
    }

    return NextResponse.json({
      event: {
        id: ev.id,
        type: "COMMENT",
        note: ev.note,
        createdAt: ev.createdAt.toISOString(),
        actorId: user.id,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
