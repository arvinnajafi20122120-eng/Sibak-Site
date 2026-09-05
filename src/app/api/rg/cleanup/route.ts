import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { runCleanup } from "@/lib/resource-guard";
import { logAudit } from "@/lib/audit";
import { formatBytes } from "@/lib/rg-types";

/**
 * پاک‌سازی فایل‌های یتیم/موقت — POST /api/rg/cleanup (فقط ADMIN)
 * بدنه: { dryRun: boolean } — پیش‌فرض true (فهرست بدون حذف).
 *
 * ایمنی: مسیرهای ارجاع‌شده در SubmissionFile/TeacherContent هرگز حذف
 * نمی‌شوند و فایل‌های تازه‌تر از tempMaxAgeHours دست‌نخورده می‌مانند.
 */

const bodySchema = z.object({
  dryRun: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new AuthError(400, "درخواست نامعتبر است");
    }

    const report = await runCleanup(parsed.data.dryRun);

    await logAudit({
      actorId: user.id,
      action: parsed.data.dryRun ? "RG_CLEANUP_PREVIEW" : "RG_CLEANUP_RUN",
      entityType: "RG_CLEANUP",
      summary: parsed.data.dryRun
        ? `پیش‌نمایش پاک‌سازی: ${report.candidates.length} کاندید (${formatBytes(report.freedBytes)})`
        : `پاک‌سازی انجام شد: ${report.removed} فایل (${formatBytes(report.freedBytes)})`,
      data: {
        dryRun: parsed.data.dryRun,
        candidates: report.candidates.length,
        removed: report.removed,
        freedBytes: report.freedBytes,
        chatPurged: report.chatPurged,
      },
    });

    return NextResponse.json(report);
  } catch (e) {
    return handleApiError(e);
  }
}
