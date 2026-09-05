import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const SCHEMA = z.object({
  currentPassword: z.string().min(1, "رمز فعلی را وارد کنید"),
  newPassword: z
    .string()
    .min(6, "رمز جدید حداقل ۶ کاراکتر است")
    .max(80, "رمز جدید طولانی است"),
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: "رمز جدید نباید با رمز فعلی یکسان باشد",
  path: ["newPassword"],
});

/**
 * POST /api/users/me/password
 * تغییر رمز خود کاربر — با تأیید رمز فعلی.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await req.json().catch(() => ({}));
    const data = SCHEMA.parse(body);

    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, password: true, name: true },
    });
    if (!fresh) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const ok = await verifyPassword(data.currentPassword, fresh.password);
    if (!ok) {
      return NextResponse.json({ error: "رمز فعلی اشتباه است" }, { status: 400 });
    }

    const newHash = await hashPassword(data.newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { password: newHash },
    });

    await logAudit({
      actorId: user.id,
      action: "USER_UPDATE_PASSWORD",
      entityType: "USER",
      entityId: user.id,
      summary: `${user.name} رمز عبور خود را تغییر داد`,
    });

    await notifyUser(user.id, {
      title: "رمز عبور شما تغییر کرد",
      message: "رمز عبور حساب شما با موفقیت به‌روزرسانی شد. اگر این تغییر را شما انجام نداده‌اید، فوراً با ادمین تماس بگیرید.",
      type: "USER",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
