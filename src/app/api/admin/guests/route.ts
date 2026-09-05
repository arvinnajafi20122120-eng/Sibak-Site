import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, hashPassword, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { toSafeUser } from "@/lib/types";

import { ADMIN_FULL_SELECT, toAdminSafeUser } from "../_lib/dto";

/**
 * مدیریت اعضای مهمان سیبک — GET لیست، POST ساخت.
 * مهمان‌ها (GUEST) کاربرانی با دسترسی فقط‌خواندنی و انقضای زمانی هستند.
 * این endpoint فقط برای ADMIN در دسترس است.
 */

const CREATE_GUEST_SCHEMA = z.object({
  name: z
    .string({ error: "نام را وارد کنید" })
    .trim()
    .min(2, "نام را وارد کنید")
    .max(60, "نام طولانی است"),
  username: z
    .string({ error: "نام کاربری را وارد کنید" })
    .trim()
    .min(3, "نام کاربری باید بین ۳ تا ۲۰ نویسه باشد")
    .max(20, "نام کاربری باید بین ۳ تا ۲۰ نویسه باشد")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد و زیرخط باشد",
    ),
  password: z
    .string({ error: "رمز عبور را وارد کنید" })
    .min(6, "رمز عبور حداقل ۶ نویسه باشد"),
  guestExpiresAt: z
    .string()
    .datetime({ message: "تاریخ انقضای عضویت نامعتبر است" })
    .optional(),
  guestScope: z
    .string()
    .trim()
    .max(200, "محدوده عضویت طولانی است")
    .optional(),
  bio: z.string().trim().max(500).optional(),
  skills: z.string().trim().max(200).optional(),
  avatar: z.string().trim().max(20).optional(),
});

/**
 * GET /api/admin/guests — لیست همه اعضای مهمان (شامل حذف‌شده).
 * مرتب بر اساس guestExpiresAt صعودی (نزدیک‌ترین انقضا اول).
 */
export async function GET() {
  try {
    const { user } = await requireUser(["ADMIN"]);
    void user;

    const guestsRaw = await db.user.findMany({
      where: { role: "GUEST" },
      select: ADMIN_FULL_SELECT,
      orderBy: [{ guestExpiresAt: { sort: "asc", nulls: "last" } }],
    });

    const guests = guestsRaw.map((g) => toAdminSafeUser(g as never));

    return NextResponse.json({ guests });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/admin/guests — ساخت عضو مهمان جدید.
 * role=GUEST, status=ACTIVE, points=0, password هش‌شده.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const body = await req.json().catch(() => ({}));
    const data = CREATE_GUEST_SCHEMA.parse(body);

    // یکتایی username — قبل از ساخت چک می‌کنیم تا خطای Prisma را به پیام فارسی تبدیل کنیم.
    const byUsername = await db.user.findUnique({
      where: { username: data.username },
      select: { id: true },
    });
    if (byUsername) {
      return NextResponse.json(
        { error: "این نام کاربری قبلاً گرفته شده است" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(data.password);

    // تبدیل ISO به شروع روز (ساعت ۰۰:۰۰:۰۰) برای انقضا — تا با تاریخ تقویم هم‌خوان باشد.
    let guestExpiresAt: Date | null = null;
    if (data.guestExpiresAt) {
      const d = new Date(data.guestExpiresAt);
      if (!isNaN(d.getTime())) {
        guestExpiresAt = d;
      }
    }

    const created = await db.user.create({
      data: {
        name: data.name,
        username: data.username,
        password: passwordHash,
        role: "GUEST",
        status: "ACTIVE",
        points: 0,
        guestExpiresAt,
        guestScope: data.guestScope?.trim() || null,
        bio: data.bio?.trim() || null,
        skills: data.skills?.trim() || null,
        avatar: data.avatar?.trim() || null,
      },
      select: ADMIN_FULL_SELECT,
    });

    await logAudit({
      actorId: user.id,
      action: "GUEST_CREATE",
      entityType: "USER",
      entityId: created.id,
      summary: `ایجاد عضو مهمان: ${created.name}`,
      data: {
        userId: created.id,
        username: created.username,
        guestExpiresAt: guestExpiresAt ? guestExpiresAt.toISOString() : null,
        guestScope: created.guestScope,
      },
    });

    return NextResponse.json(
      { user: toSafeUser(created as never) },
      { status: 201 },
    );
  } catch (e) {
    return handleApiError(e);
  }
}
