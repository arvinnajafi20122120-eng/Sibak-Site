import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { SUPPORT_SETTING_KEYS, normalizeCardNumber } from "@/lib/support";

/**
 * PUT /api/support/settings — تنظیم شماره کارت و نام صاحب کارت (فقط ADMIN).
 * مقدار رشتهٔ خالی یعنی پاک‌کردن (بخش عمومی حالت «هنوز تنظیم نشده» می‌بیند).
 */
const settingsSchema = z.object({
  cardNumber: z.string().trim().max(30).nullable(),
  cardHolder: z.string().trim().max(80).nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const data = settingsSchema.parse(body);

    let storedCard = "";
    if (data.cardNumber !== null && data.cardNumber !== "") {
      const normalized = normalizeCardNumber(data.cardNumber);
      if (!normalized) {
        return NextResponse.json(
          { error: "شماره کارت باید ۱۶ رقم باشد (اعداد فارسی هم قبول است)" },
          { status: 400 },
        );
      }
      storedCard = normalized;
    }

    const entries = [
      { key: SUPPORT_SETTING_KEYS.cardNumber, value: storedCard },
      {
        key: SUPPORT_SETTING_KEYS.cardHolder,
        value: data.cardHolder ?? "",
      },
    ];
    for (const entry of entries) {
      await db.setting.upsert({
        where: { key: entry.key },
        update: { value: entry.value },
        create: entry,
      });
    }

    await logAudit({
      actorId: user.id,
      action: "SUPPORT_SETTINGS_UPDATE",
      entityType: "SETTING",
      summary: storedCard
        ? "به‌روزرسانی شماره کارت حمایت از سیبک"
        : "پاک‌کردن شماره کارت حمایت از سیبک",
      data: { hasCard: Boolean(storedCard), holder: data.cardHolder },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
