import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

const AWARD_SCHEMA = z.object({
  userId: z.string().min(1, "کاربر هدف را انتخاب کنید"),
  note: z.string().trim().max(300).optional(),
});

const REVOKE_SCHEMA = z.object({
  userId: z.string().min(1, "کاربر هدف را انتخاب کنید"),
});

/**
 * POST /api/medals/[id]/award — اعطای مدال به کاربر (فقط ADMIN).
 * - سقف maxCount رعایت می‌شود؛ تکرار ناممکن است (unique).
 * - امتیاز مدال به امتیاز کاربر اضافه و در PointLog ثبت می‌شود.
 * - کاربر با نوتیفیکیشن جشن‌دار خبر می‌شود.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = AWARD_SCHEMA.parse(body);

    const [medal, target] = await Promise.all([
      db.medal.findFirst({ where: { id, deletedAt: null } }),
      db.user.findFirst({
        where: { id: data.userId, deletedAt: null },
        select: { id: true, name: true, status: true, points: true },
      }),
    ]);
    if (!medal) {
      return NextResponse.json({ error: "مدال یافت نشد" }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (target.id === user.id) {
      return NextResponse.json({ error: "مدال را نمی‌توانید به خودتان بدهید 🙃" }, { status: 400 });
    }

    const existing = await db.userMedal.findUnique({
      where: { userId_medalId: { userId: target.id, medalId: id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `${target.name} از قبل این مدال را دارد` },
        { status: 409 },
      );
    }

    if (medal.maxCount !== null) {
      const count = await db.userMedal.count({ where: { medalId: id } });
      if (count >= medal.maxCount) {
        return NextResponse.json(
          { error: `سقف این مدال پر شده (${medal.maxCount} نسخه)` },
          { status: 409 },
        );
      }
    }

    await db.$transaction([
      db.userMedal.create({
        data: {
          userId: target.id,
          medalId: id,
          awardedById: user.id,
        },
      }),
      ...(medal.points > 0
        ? [
            db.user.update({
              where: { id: target.id },
              data: { points: { increment: medal.points } },
            }),
            db.pointLog.create({
              data: {
                userId: target.id,
                delta: medal.points,
                reason: `مدال «${medal.name}»`,
                actorId: user.id,
              },
            }),
          ]
        : []),
    ]);

    await logAudit({
      actorId: user.id,
      action: "MEDAL_AWARD",
      entityType: "USER",
      entityId: target.id,
      summary: `مدال «${medal.name}» به ${target.name} اهدا شد`,
      data: { medalId: id, points: medal.points, note: data.note },
    });

    await notifyUser(target.id, {
      title: "🎖 مدال جدید به شما اهدا شد!",
      message: `مدال «${medal.name}» را دریافت کردید.${medal.points > 0 ? ` (+${medal.points} امتیاز)` : ""} ${medal.description}`,
      type: "USER",
      link: "#/profile",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/medals/[id]/award — سلب مدال از کاربر (فقط ADMIN).
 * امتیاز مدال هم پس گرفته می‌شود (PointLog منفی).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = REVOKE_SCHEMA.parse(body);

    const [medal, target, userMedal] = await Promise.all([
      db.medal.findFirst({ where: { id, deletedAt: null } }),
      db.user.findFirst({
        where: { id: data.userId, deletedAt: null },
        select: { id: true, name: true },
      }),
      db.userMedal.findUnique({
        where: { userId_medalId: { userId: data.userId, medalId: id } },
      }),
    ]);
    if (!medal) {
      return NextResponse.json({ error: "مدال یافت نشد" }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }
    if (!userMedal) {
      return NextResponse.json({ error: "این کاربر این مدال را ندارد" }, { status: 404 });
    }

    await db.$transaction([
      db.userMedal.delete({ where: { id: userMedal.id } }),
      ...(medal.points > 0
        ? [
            db.user.update({
              where: { id: target.id },
              data: { points: { decrement: medal.points } },
            }),
            db.pointLog.create({
              data: {
                userId: target.id,
                delta: -medal.points,
                reason: `سلب مدال «${medal.name}»`,
                actorId: user.id,
              },
            }),
          ]
        : []),
    ]);

    await logAudit({
      actorId: user.id,
      action: "MEDAL_REVOKE",
      entityType: "USER",
      entityId: target.id,
      summary: `مدال «${medal.name}» از ${target.name} سلب شد`,
      data: { medalId: id, points: -medal.points },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
