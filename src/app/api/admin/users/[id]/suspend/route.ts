import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

import { ADMIN_SAFE_SELECT } from "../../../_lib/dto";

const SCHEMA = z.object({
  note: z.string().trim().max(500).optional(),
});

/** POST /api/admin/users/[id]/suspend — SUSPENDED + audit + notify. */
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
    if (target.id === user.id) {
      throw new AuthError(400, "نمی‌توانید حساب خودتان را معلق کنید");
    }
    const adminCount = await db.user.count({
      where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    });
    if (target.role === "ADMIN" && adminCount <= 1) {
      throw new AuthError(400, "نمی‌توانید تنها ادمین سایت را معلق کنید");
    }
    if (target.status === "SUSPENDED") {
      throw new AuthError(400, "این کاربر قبلاً معلق شده است");
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: "SUSPENDED" },
      select: ADMIN_SAFE_SELECT,
    });

    await logAudit({
      actorId: user.id,
      action: "USER_SUSPEND",
      entityType: "USER",
      entityId: id,
      summary: `حساب ${target.name} معلق شد`,
      data: { note: data.note ?? null, prevStatus: target.status },
    });
    await notifyUser(id, {
      title: "حساب شما معلق شد",
      message: `حساب کاربری شما موقتاً غیرفعال شد. ${
        data.note ? `دلیل: ${data.note}` : "برای اطلاعات بیشتر با ادمین تماس بگیرید."
      }`,
      type: "USER",
      link: null,
    });

    return NextResponse.json({ user: toSafeUser(updated as never) });
  } catch (e) {
    return handleApiError(e);
  }
}
