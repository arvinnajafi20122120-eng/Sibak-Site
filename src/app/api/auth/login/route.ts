import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  createSessionToken,
  cookieOptions,
  handleApiError,
  verifyPassword,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toSafeUser } from "@/lib/types";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "نام کاربری را وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { identifier, password } = loginSchema.parse(body);

    const id = identifier.toLowerCase();
    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { username: id },
        ],
        deletedAt: null,
      },
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      return NextResponse.json(
        { error: "نام کاربری یا رمز عبور اشتباه است" },
        { status: 401 },
      );
    }

    if (user.status === "PENDING") {
      return NextResponse.json(
        {
          error: "حساب شما در انتظار تایید ادمین است",
          code: "PENDING",
        },
        { status: 403 },
      );
    }

    if (user.status === "REJECTED") {
      return NextResponse.json(
        {
          error:
            user.rejectionNote
              ? `درخواست عضویت شما رد شده است — ${user.rejectionNote}`
              : "درخواست عضویت شما رد شده است",
          code: "REJECTED",
        },
        { status: 403 },
      );
    }

    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "حساب شما موقتاً غیرفعال شده است", code: "SUSPENDED" },
        { status: 403 },
      );
    }

    // اعضای مهمان: اگر اعتبارشان به پایان رسیده باشد، ورود مجاز نیست
    if (
      user.role === "GUEST" &&
      user.guestExpiresAt &&
      user.guestExpiresAt < new Date()
    ) {
      return NextResponse.json(
        {
          error:
            "اعتبار عضویت مهمان شما به پایان رسیده است. با ادمین سایت تماس بگیرید.",
          code: "GUEST_EXPIRED",
        },
        { status: 403 },
      );
    }

    const now = new Date();
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });

    await logAudit({
      actorId: user.id,
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      summary: `ورود موفق: ${user.name}`,
    });

    const token = await createSessionToken(user);
    // توکن هم در کوکی (برای context اول-شخص) و هم در بدنه‌ی JSON
    // (برای ذخیره در localStorage و ارسال با Authorization header در iframe) بازمی‌گردد.
    const res = NextResponse.json({
      user: toSafeUser({ ...user, lastLoginAt: now }),
      token,
    });
    res.cookies.set({ ...cookieOptions, value: token });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
