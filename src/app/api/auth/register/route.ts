import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  createSessionToken,
  cookieOptions,
  hashPassword,
  handleApiError,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام باید حداقل ۲ حرف باشد")
    .max(60, "نام بیش از حد بلند است"),
  username: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9_]{3,20}$/,
      "نام کاربری باید ۳ تا ۲۰ کاراکتر و فقط شامل حروف انگلیسی، عدد و ـ باشد",
    ),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
  joinReason: z.string().trim().max(2000).optional().default(""),
  skills: z.string().trim().max(1000).optional().default(""),
  avatar: z.string().trim().max(400).optional().default(""),
  acceptedRules: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const data = registerSchema.parse(body);

    // آیا ثبت‌نام باز است؟
    const allowReg = await db.setting.findUnique({ where: { key: "allowRegistration" } });
    if (allowReg?.value === "false") {
      return NextResponse.json(
        { error: "ثبت‌نام در حال حاضر بسته است" },
        { status: 403 },
      );
    }

    // پذیرش قوانین — قوانین همیشه فعال‌اند (در نبود ردیف دیتابیس، قوانین پیش‌فرض
    // در صفحهٔ فرود و فرم ثبت‌نام نمایش داده می‌شود)، پس پذیرش همیشه الزامی است.
    if (!data.acceptedRules) {
      return NextResponse.json(
        { error: "برای ثبت‌نام باید قوانین سیبک را بپذیرید" },
        { status: 400 },
      );
    }

    // اولین کاربر سیستم؟ → بوت‌استرپ ادمین
    const userCount = await db.user.count();
    const isFirstUser = userCount === 0;

    const passwordHash = await hashPassword(data.password);

    const user = await db.user.create({
      data: {
        name: data.name,
        username: data.username,
        password: passwordHash,
        role: isFirstUser ? "ADMIN" : "MEMBER",
        status: isFirstUser ? "ACTIVE" : "PENDING",
        joinReason: data.joinReason || null,
        skills: data.skills || null,
        avatar: data.avatar || null,
        lastLoginAt: isFirstUser ? new Date() : null,
      },
    });

    // اعلان به همه ادمین‌ها (به‌جز حالت بوت‌استرپ)
    if (!isFirstUser) {
      const admins = await db.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });
      await notifyUsers(
        admins.map((a) => a.id),
        {
          title: "درخواست عضویت جدید",
          message: `درخواست عضویت جدید: ${user.name} (@${user.username}) در انتظار بررسی است.`,
          type: "USER",
          link: "#/admin-users",
        },
      );
    }

    await logAudit({
      actorId: user.id,
      action: "REGISTER",
      entityType: "USER",
      entityId: user.id,
      summary: isFirstUser
        ? `بوت‌استرپ اولین ادمین سیستم: ${user.name}`
        : `ثبت‌نام جدید: ${user.name} (@${user.username}) — در انتظار تایید`,
      data: { username: user.username, role: user.role, status: user.status },
    });

    // نشست برقرار می‌شود تا کاربر PENDING دروازه «در انتظار تایید» را با نظرسنجی خودکار ببیند
    const token = await createSessionToken(user);
    // توکن هم در کوکی و هم در بدنه‌ی JSON (برای localStorage در iframe) بازمی‌گردد.
    const res = NextResponse.json({ user: toSafeUser(user), token }, { status: 201 });
    res.cookies.set({ ...cookieOptions, value: token });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
