import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toFa } from "@/lib/jalali";

import { computeBalance } from "../../polls/_lib/settle";

/**
 * اعطای/کسر وتو توسط ادمین — تغییری دستی در دفتر وتوی یک کاربر.
 * این endpoint توسط پنل ادمین (تسک ۴) مصرف می‌شود.
 *  - amount مثبت → اعطای n وتو
 *  - amount منفی → کسر n وتو (در صورتی که موجودی کافی باشد)
 */

const GRANT_SCHEMA = z.object({
  userId: z.string().min(1, "کاربر را انتخاب کنید"),
  amount: z.coerce
    .number()
    .int()
    .refine((v) => v >= -10 && v <= 10 && v !== 0, {
      message: "مقدار باید بین ۱۰- تا ۱۰ و ناصفر باشد",
    }),
  reason: z.string().trim().min(3, "دلیل را وارد کنید").max(200, "دلیل طولانی است"),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);

    const body = await req.json().catch(() => ({}));
    const parsed = GRANT_SCHEMA.parse(body);

    const target = await db.user.findUnique({ where: { id: parsed.userId } });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const currentBalance = await computeBalance(parsed.userId);
    const newBalance = currentBalance + parsed.amount;

    if (parsed.amount < 0 && newBalance < 0) {
      return NextResponse.json(
        { error: `موجودی کاربر (${toFa(currentBalance)}) برای این کسر کافی نیست` },
        { status: 400 },
      );
    }

    await db.vetoLedger.create({
      data: {
        userId: parsed.userId,
        delta: parsed.amount,
        reason: parsed.reason,
        balanceAfter: newBalance,
      },
    });

    // اطلاع به کاربر هدف
    if (parsed.amount > 0) {
      await notifyUser(parsed.userId, {
        title: "اعطای وتو",
        message: `🎉 شما ${toFa(parsed.amount)} وتو دریافت کردید: ${parsed.reason}`,
        type: "VETO",
        link: "#/vetoes",
      });
    } else {
      await notifyUser(parsed.userId, {
        title: "کسر وتو",
        message: `${toFa(Math.abs(parsed.amount))} وتو از شما کسر شد: ${parsed.reason}`,
        type: "VETO",
        link: "#/vetoes",
      });
    }

    await logAudit({
      actorId: user.id,
      action: "VETO_ADMIN_ADJUST",
      entityType: "User",
      entityId: parsed.userId,
      summary: `تغییر دستی ${parsed.amount > 0 ? "اعطای" : "کسر"} ${toFa(Math.abs(parsed.amount))} وتو به ${target.name} — دلیل: ${parsed.reason}`,
      data: {
        userId: parsed.userId,
        amount: parsed.amount,
        reason: parsed.reason,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
      },
    });

    return NextResponse.json({
      ok: true,
      balance: newBalance,
      balanceBefore: currentBalance,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
