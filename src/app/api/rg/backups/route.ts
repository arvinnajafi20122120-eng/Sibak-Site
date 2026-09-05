import { NextRequest, NextResponse } from "next/server";

import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { createBackup, listBackups } from "@/lib/rg-backup";
import { logAudit } from "@/lib/audit";
import { emitRgEvent } from "@/lib/resource-guard";

/**
 * پشتیبان‌های سیبک — /api/rg/backups (فقط ADMIN)
 *
 * GET  → فهرست پشتیبان‌های ذخیره‌شده روی دیسک
 * POST → ساخت پشتیبان تازه؛ بدنه { mode?: "save" | "download" }
 *        - save (پیش‌فرض): ذخیره در db/backups + ثبت رویداد
 *        - download: خروجی مستقیم به‌عنوان فایل پیوستی (برای محیط‌های
 *          بدون دیسک‌نویسی مثل Vercel Serverless)
 */

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);

    const body = (await req.json().catch(() => ({}))) as { mode?: string };
    const mode = body.mode === "download" ? "download" : "save";

    if (mode === "download") {
      const result = await createBackup({ persist: false });
      return new NextResponse(result.content ?? "", {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
          "Content-Length": String(result.sizeBytes),
        },
      });
    }

    const result = await createBackup({ persist: true });

    await logAudit({
      actorId: user.id,
      action: "RG_BACKUP_CREATE",
      entityType: "RG_BACKUP",
      entityId: result.fileName,
      summary: `پشتیبان کامل با ${result.totalRows} رکورد ساخته شد (${result.fileName})`,
      data: { fileName: result.fileName, checksum: result.checksum, totalRows: result.totalRows },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return handleApiError(e);
    // خطای دیسک از createBackup — ثبت رویداد برای دیدن در داشبورد
    await emitRgEvent("BACKUP", "WARNING", "ساخت پشتیبان ناموفق بود", {
      error: e instanceof Error ? e.message : "unknown",
    });
    return handleApiError(e);
  }
}
