import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";

/**
 * GET /api/debts/stats?userId=
 * آمار بدهی یک کاربر برای پروفایل/پرونده.
 * - userId پیش‌فرض: خودم
 * - ادمین می‌تواند هر کاربری را بخواهد.
 * - غیر ادمین فقط خودش را می‌بیند (حریم خصوصی).
 *
 * خروجی: { iOwe, owedToMe, openCount, settledCount, forgivenCount, netBalance }
 * - iOwe = SUM(amount) WHERE I'm debtor AND status in (OPEN, SETTLE_PENDING, DISPUTED)
 * - owedToMe = SUM(amount) WHERE I'm creditor AND same statuses
 * - netBalance = owedToMe - iOwe (مثبت = طلبکار، منفی = بدهکار)
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const sp = req.nextUrl.searchParams;
    const userId = sp.get("userId") ?? user.id;

    if (userId !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "دسترسی لازم را ندارید");
    }

    const ACTIVE = ["OPEN", "SETTLE_PENDING", "DISPUTED"];

    const [iOweAgg, owedAgg, openCount, settleCount, forgivenCount] = await Promise.all([
      db.debt.aggregate({
        _sum: { amount: true },
        where: {
          debtorId: userId,
          status: { in: ACTIVE },
          deletedAt: null,
        },
      }),
      db.debt.aggregate({
        _sum: { amount: true },
        where: {
          creditorId: userId,
          status: { in: ACTIVE },
          deletedAt: null,
        },
      }),
      db.debt.count({
        where: {
          OR: [{ debtorId: userId }, { creditorId: userId }],
          status: { in: ["OPEN", "SETTLE_PENDING", "DISPUTED"] },
          deletedAt: null,
        },
      }),
      db.debt.count({
        where: {
          OR: [{ debtorId: userId }, { creditorId: userId }],
          status: "SETTLED",
          deletedAt: null,
        },
      }),
      db.debt.count({
        where: {
          OR: [{ debtorId: userId }, { creditorId: userId }],
          status: "FORGIVEN",
          deletedAt: null,
        },
      }),
    ]);

    const iOwe = iOweAgg._sum.amount ?? 0;
    const owedToMe = owedAgg._sum.amount ?? 0;
    const netBalance = owedToMe - iOwe;

    return NextResponse.json({
      iOwe,
      owedToMe,
      netBalance,
      openCount,
      settledCount: settleCount,
      forgivenCount,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
