import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

import { ADMIN_SAFE_SELECT } from "../../../_lib/dto";

/** POST /api/admin/users/[id]/activate — set status=ACTIVE + audit + notify. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;

    const target = await db.user.findUnique({
      where: { id },
      select: ADMIN_SAFE_SELECT,
    });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (target.status === "ACTIVE") {
      throw new AuthError(400, "این کاربر هم‌اکنون فعال است");
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: "ACTIVE" },
      select: ADMIN_SAFE_SELECT,
    });

    await logAudit({
      actorId: user.id,
      action: "USER_ACTIVATE",
      entityType: "USER",
      entityId: id,
      summary: `حساب ${target.name} فعال شد`,
      data: { prevStatus: target.status },
    });
    await notifyUser(id, {
      title: "حساب شما فعال شد",
      message: `حساب کاربری شما فعال شد؛ اکنون می‌توانید وارد فضای همکاری شوید.`,
      type: "USER",
      link: "#/home",
    });

    return NextResponse.json({ user: toSafeUser(updated as never) });
  } catch (e) {
    return handleApiError(e);
  }
}
