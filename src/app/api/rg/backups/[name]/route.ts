import { NextRequest, NextResponse } from "next/server";

import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import {
  deleteBackup,
  getBackupBytes,
  RgBackupError,
  restoreBackup,
} from "@/lib/rg-backup";
import { logAudit } from "@/lib/audit";

/**
 * عملیات روی یک پشتیبان — /api/rg/backups/[name] (فقط ADMIN)
 *
 * GET    → دانلود فایل پشتیبان (attachment)
 * POST   → بازگردانی کامل — بدنه { confirm: "REPLACE" } الزامی است
 *          (کل دیتابیس فعلی جایگزین می‌شود؛ درون تراکنش با rollback خودکار)
 * DELETE → حذف فایل پشتیبان
 */

async function resolveName(params: Promise<{ name: string }>): Promise<string> {
  const { name } = await params;
  return decodeURIComponent(name);
}

function backupError(e: unknown): NextResponse | null {
  if (e instanceof RgBackupError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    await requireUser(["ADMIN"]);
    const name = await resolveName(params);
    const bytes = await getBackupBytes(name);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (e) {
    return backupError(e) ?? handleApiError(e);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const name = await resolveName(params);

    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "REPLACE") {
      throw new AuthError(400, "برای بازگردانی، تایید صریح الزامی است");
    }

    const result = await restoreBackup(name);

    await logAudit({
      actorId: user.id,
      action: "RG_BACKUP_RESTORE",
      entityType: "RG_BACKUP",
      entityId: name,
      summary: `بازگردانی کامل دیتابیس از «${name}» با ${result.totalRows} رکورد`,
      data: { fileName: name, totalRows: result.totalRows },
    });

    return NextResponse.json(result);
  } catch (e) {
    return backupError(e) ?? handleApiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const name = await resolveName(params);

    await deleteBackup(name);

    await logAudit({
      actorId: user.id,
      action: "RG_BACKUP_DELETE",
      entityType: "RG_BACKUP",
      entityId: name,
      summary: `حذف فایل پشتیبان «${name}»`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return backupError(e) ?? handleApiError(e);
  }
}
