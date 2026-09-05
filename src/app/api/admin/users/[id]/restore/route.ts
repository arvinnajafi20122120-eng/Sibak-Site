import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

import { ADMIN_FULL_SELECT } from "../../../_lib/dto";
import { toSafeUser } from "@/lib/types";

/** POST /api/admin/users/[id]/restore — un-delete a soft-deleted user. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;

    const target = await db.user.findUnique({
      where: { id },
      select: ADMIN_FULL_SELECT,
    });
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (!target.deletedAt) {
      return NextResponse.json(
        { error: "این کاربر حذف‌شده نیست" },
        { status: 400 },
      );
    }

    const updated = await db.user.update({
      where: { id },
      data: { deletedAt: null },
      select: ADMIN_FULL_SELECT,
    });

    await logAudit({
      actorId: user.id,
      action: "USER_RESTORE",
      entityType: "USER",
      entityId: id,
      summary: `حساب ${target.name} بازیابی شد`,
    });

    return NextResponse.json({ user: toSafeUser(updated as never) });
  } catch (e) {
    return handleApiError(e);
  }
}
