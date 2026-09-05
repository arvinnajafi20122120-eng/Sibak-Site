import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, AuthError } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toFa } from "@/lib/jalali";

import { ADMIN_SAFE_SELECT } from "../../../_lib/dto";

const SCHEMA = z.object({
  delta: z
    .coerce
    .number()
    .int()
    .refine((v) => v !== 0 && v >= -1000 && v <= 1000, {
      message: "مقدار باید عددی صحیح غیرصفر بین ۱۰۰۰- تا ۱۰۰۰ باشد",
    }),
  reason: z.string().trim().min(3, "دلیل را وارد کنید").max(200),
});

/**
 * POST /api/admin/users/[id]/points — تنظیم دستی امتیاز کاربر.
 * آپدیت user.points + ساخت PointLog + audit + notify.
 */
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

    await db.$transaction([
      db.user.update({
        where: { id },
        data: { points: { increment: data.delta } },
      }),
      db.pointLog.create({
        data: {
          userId: id,
          delta: data.delta,
          reason: data.reason,
          actorId: user.id,
        },
      }),
    ]);

    await logAudit({
      actorId: user.id,
      action: "POINTS_ADJUST",
      entityType: "USER",
      entityId: id,
      summary: `تغییر ${data.delta > 0 ? "+" : ""}${toFa(data.delta)} امتیاز برای ${target.name} — ${data.reason}`,
      data: { delta: data.delta, reason: data.reason, by: user.id },
    });
    await notifyUser(id, {
      title: "تغییر امتیاز شما",
      message: `${data.delta > 0 ? `🎉 ${toFa(data.delta)}` : toFa(data.delta)} امتیاز به/از حساب شما ${data.delta > 0 ? "افزوده شد" : "کاهش یافت"} — ${data.reason}`,
      type: "USER",
      link: "#/profile",
    });

    const fresh = await db.user.findUnique({
      where: { id },
      select: ADMIN_SAFE_SELECT,
    });
    return NextResponse.json({
      ok: true,
      points: fresh?.points ?? target.points,
      delta: data.delta,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
