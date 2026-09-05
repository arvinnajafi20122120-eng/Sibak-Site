import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { emitRgEvent, getRgConfig, saveRgConfig } from "@/lib/resource-guard";
import { logAudit } from "@/lib/audit";
import { formatBytes } from "@/lib/rg-types";

/**
 * سقف‌های نگهبان منابع — PUT /api/rg/settings (فقط ADMIN)
 * بدنه کامل RgConfig است؛ اعتبارسنجی zod + clamp نهایی در sanitizeRgConfig.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

const settingsSchema = z
  .object({
    enabled: z.boolean(),
    maxFileBytes: z.number().int().min(100 * 1024).max(200 * MB),
    perUserStorageBytes: z.number().int().min(10 * MB).max(10 * GB),
    perUserDailyUploads: z.number().int().min(1).max(1000),
    globalStorageBytes: z.number().int().min(50 * MB).max(100 * GB),
    chatMaxFileBytes: z.number().int().min(100 * 1024).max(50 * MB),
    warnPct: z.number().int().min(50).max(99),
    criticalPct: z.number().int().min(51).max(100),
    tempMaxAgeHours: z.number().int().min(1).max(24 * 365),
    dbWarnBytes: z.number().int().min(0).max(50 * GB),
  })
  .refine((v) => v.warnPct < v.criticalPct, {
    message: "آستانه هشدار باید کمتر از آستانه بحرانی باشد",
  });

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);

    const body = await req.json().catch(() => ({}));
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, parsed.error.issues[0]?.message ?? "تنظیمات نامعتبر است");
    }

    const before = await getRgConfig();
    const cfg = await saveRgConfig(parsed.data);

    await emitRgEvent("CONFIG", "INFO", "سقف‌های نگهبان منابع به‌روزرسانی شد", {
      before,
      after: cfg,
    });

    await logAudit({
      actorId: user.id,
      action: "RG_CONFIG_UPDATE",
      entityType: "RG_CONFIG",
      summary: `به‌روزرسانی سقف‌های نگهبان منابع (سقف کل: ${formatBytes(cfg.globalStorageBytes)})`,
      data: { before, after: cfg },
    });

    return NextResponse.json({ config: cfg });
  } catch (e) {
    return handleApiError(e);
  }
}
