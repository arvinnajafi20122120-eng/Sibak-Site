import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { JALALI_MONTHS, toJalali, toFa } from "@/lib/jalali";

/**
 * GET /api/debts/chart?userId=
 * سری زمانی ۶ ماه شمسی اخیر — برای نمودار پروفایل.
 * خروجی: [{ month: 'آبان ۱۴۰۴', iOwe, owedToMe, net }]
 *
 * منطق: برای هر ماه، SUM(amount) بدهی‌های ACTIVE در آن ماه بر اساس createdAt.
 * - userId پیش‌فرض: خودم
 * - ادمین: هر کاربر؛ بقیه فقط خودش.
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const sp = req.nextUrl.searchParams;
    const userId = sp.get("userId") ?? user.id;

    if (userId !== user.id && user.role !== "ADMIN") {
      throw new AuthError(403, "دسترسی لازم را ندارید");
    }

    // ۶ ماه شمسی اخیر (شامل ماه جاری)
    const now = new Date();
    const months: { jy: number; jm: number; label: string }[] = [];
    const cur = toJalali(now);
    let jy = cur.jy;
    let jm = cur.jm;
    for (let i = 0; i < 6; i++) {
      months.unshift({ jy, jm, label: `${JALALI_MONTHS[jm - 1]} ${toFa(jy)}` });
      jm -= 1;
      if (jm < 1) {
        jm = 12;
        jy -= 1;
      }
    }

    // محاسبه بازه میلادی هر ماه شمسی: از روز اول ماه تا روز آخر
    // برای سادگی: بازه تقریبی با جلالی‌به‌میلادی از اول ماه
    // به‌جای import toGregorian، یک روش کاشی استفاده می‌کنیم: همان ۲۸ روز پس از شروع.
    // اما دقیق‌تر: از lib/jalali.ts، jalaliToGregorian را export کرده‌ایم.
    const { jalaliToGregorian } = await import("@/lib/jalali");
    const buckets = months.map((m) => {
      const start = jalaliToGregorian(m.jy, m.jm, 1);
      // ماه بعد:
      const nextM = m.jm === 12 ? 1 : m.jm + 1;
      const nextY = m.jm === 12 ? m.jy + 1 : m.jy;
      const end = jalaliToGregorian(nextY, nextM, 1);
      return { ...m, start, end };
    });

    // بدهی‌های مرئی برای این کاربر
    const debts = await db.debt.findMany({
      where: {
        deletedAt: null,
        OR: [{ debtorId: userId }, { creditorId: userId }],
      },
      select: {
        debtorId: true,
        creditorId: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    const ACTIVE = new Set(["OPEN", "SETTLE_PENDING", "DISPUTED"]);
    const series = buckets.map((b) => {
      let iOwe = 0;
      let owedToMe = 0;
      for (const d of debts) {
        if (d.createdAt >= b.start && d.createdAt < b.end) {
          if (ACTIVE.has(d.status)) {
            if (d.debtorId === userId) iOwe += d.amount;
            if (d.creditorId === userId) owedToMe += d.amount;
          }
        }
      }
      return { month: b.label, iOwe, owedToMe, net: owedToMe - iOwe };
    });

    return NextResponse.json({ series });
  } catch (e) {
    return handleApiError(e);
  }
}
