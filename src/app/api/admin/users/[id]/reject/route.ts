import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

import { ADMIN_SAFE_SELECT } from "../../../_lib/dto";

const SCHEMA = z.object({
  note: z.string().trim().min(3, "دلیل رد را وارد کنید").max(500),
});

/** POST /api/admin/users/[id]/reject — REJECTED + note + audit + notify. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = SCHEMA.parse(body);

    const target = await db.user.findUnique({
      where: { id },
      select: ADMIN_SAFE_SELECT,
    });
    if (!target || target.deletedAt) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (target.role === "ADMIN") {
      throw new AuthError(400, "نمی‌توانید یک ادمین را رد کنید");
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: "REJECTED", rejectionNote: data.note },
      select: ADMIN_SAFE_SELECT,
    });

    await logAudit({
      actorId: user.id,
      action: "USER_REJECT",
      entityType: "USER",
      entityId: id,
      summary: `درخواست عضویت ${target.name} رد شد`,
      data: { note: data.note, prevStatus: target.status },
    });
    await notifyUser(id, {
      title: "درخواست عضویت رد شد",
      message: `متأسفانه درخواست عضویت شما در سیبک رد شد. دلیل: ${data.note}`,
      type: "USER",
      link: null,
    });

    return NextResponse.json({ user: toSafeUser(updated as never) });
  } catch (e) {
    return handleApiError(e);
  }
}
