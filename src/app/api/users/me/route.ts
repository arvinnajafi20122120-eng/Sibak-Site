import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";
import {
  formatJalaliDate,
  relativeTime,
  JALALI_MONTHS,
  toFa,
  toJalali,
  jalaliToGregorian,
} from "@/lib/jalali";

/**
 * GET /api/users/me
 * پروفایل کامل خودم: safe user + آمار + وتو + نمودار امتیاز + نشان‌ها (با earned flag) + فعالیت اخیر.
 */

const SAFE_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
  status: true,
  joinReason: true,
  skills: true,
  bio: true,
  avatar: true,
  points: true,
  rejectionNote: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** ۶ ماه شمسی اخیر برای نمودار امتیاز. */
function sixJalaliMonths(): { jy: number; jm: number; label: string; start: Date; end: Date }[] {
  const now = new Date();
  const cur = toJalali(now);
  const months: { jy: number; jm: number; label: string; start: Date; end: Date }[] = [];
  let jy = cur.jy;
  let jm = cur.jm;
  for (let i = 0; i < 6; i++) {
    const start = jalaliToGregorian(jy, jm, 1);
    const nextM = jm === 12 ? 1 : jm + 1;
    const nextY = jm === 12 ? jy + 1 : jy;
    const end = jalaliToGregorian(nextY, nextM, 1);
    months.unshift({ jy, jm, label: `${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`, start, end });
    jm -= 1;
    if (jm < 1) {
      jm = 12;
      jy -= 1;
    }
  }
  return months;
}

export async function GET() {
  try {
    const { user } = await requireUser();

    const fresh = await db.user.findUnique({
      where: { id: user.id },
      select: SAFE_SELECT,
    });
    if (!fresh) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const [badgesCount, ideasCount, pollsCount, debtsSettledCount, auditLogs, badges, pointLogs, vetoAgg, debtsStats, medals] = await Promise.all([
      db.userBadge.count({ where: { userId: user.id } }),
      db.idea.count({ where: { authorId: user.id, deletedAt: null } }),
      db.poll.count({ where: { createdById: user.id, deletedAt: null } }),
      db.debt.count({
        where: {
          OR: [{ debtorId: user.id }, { creditorId: user.id }],
          status: "SETTLED",
          deletedAt: null,
        },
      }),
      db.auditLog.findMany({
        where: { actorId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.badge.findMany({
        include: {
          users: { where: { userId: user.id }, select: { id: true, awardedAt: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.pointLog.findMany({
        where: { userId: user.id, createdAt: { gte: sixJalaliMonths()[0].start } },
        select: { delta: true, reason: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      db.vetoLedger.aggregate({
        _sum: { delta: true },
        where: { userId: user.id },
      }),
      (async () => {
        const ACTIVE = ["OPEN", "SETTLE_PENDING", "DISPUTED"];
        const [i, o] = await Promise.all([
          db.debt.aggregate({
            _sum: { amount: true },
            where: { debtorId: user.id, status: { in: ACTIVE }, deletedAt: null },
          }),
          db.debt.aggregate({
            _sum: { amount: true },
            where: { creditorId: user.id, status: { in: ACTIVE }, deletedAt: null },
          }),
        ]);
        return { iOwe: i._sum.amount ?? 0, owedToMe: o._sum.amount ?? 0, net: (o._sum.amount ?? 0) - (i._sum.amount ?? 0) };
      })(),
      db.userMedal.findMany({
        where: { userId: user.id, medal: { deletedAt: null } },
        include: { medal: true },
        orderBy: { awardedAt: "desc" },
      }),
    ]);

    const activity = auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      summary: a.summary,
      createdAt: a.createdAt.toISOString(),
      relative: relativeTime(a.createdAt),
      dateFa: formatJalaliDate(a.createdAt),
    }));

    const badgesDTO = badges.map((b) => ({
      id: b.id,
      key: b.key,
      name: b.name,
      description: b.description,
      icon: b.icon,
      color: b.color,
      earned: b.users.length > 0,
      awardedAt: b.users[0]?.awardedAt.toISOString() ?? null,
    }));

    const medalsDTO = medals.map((um) => ({
      id: um.medal.id,
      name: um.medal.name,
      description: um.medal.description,
      imageUrl: um.medal.imageUrl,
      rarity: um.medal.rarity,
      points: um.medal.points,
      awardedAt: um.awardedAt.toISOString(),
    }));

    // سری ماهیانه امتیاز
    const buckets = sixJalaliMonths();
    const series = buckets.map((b) => {
      let sum = 0;
      for (const p of pointLogs) {
        if (p.createdAt >= b.start && p.createdAt < b.end) sum += p.delta;
      }
      return { month: b.label, delta: sum };
    });

    return NextResponse.json({
      user: toSafeUser(fresh as never),
      stats: {
        badgesCount,
        medalsCount: medals.length,
        ideasCount,
        pollsCount,
        debtsSettledCount,
        vetoBalance: vetoAgg._sum.delta ?? 0,
        iOwe: debtsStats.iOwe,
        owedToMe: debtsStats.owedToMe,
        netDebt: debtsStats.net,
        points: fresh.points,
      },
      badges: badgesDTO,
      medals: medalsDTO,
      activity,
      pointsSeries: series,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const PATCH_SCHEMA = z.object({
  name: z.string().trim().min(2, "نام را درست وارد کنید").max(60).optional(),
  bio: z.string().trim().max(400, "درباره طولانی است").nullable().optional(),
  skills: z.string().trim().max(200, "مهارت‌ها طولانی است").optional(),
  avatar: z.string().trim().max(8, "آواتار نامعتبر").optional(),
});

/**
 * PATCH /api/users/me — ویرایش پروفایل خودم.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const body = await req.json().catch(() => ({}));
    const data = PATCH_SCHEMA.parse(body);

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.bio !== undefined ? { bio: data.bio?.trim() || null } : {}),
        ...(data.skills !== undefined ? { skills: data.skills?.trim() || null } : {}),
        ...(data.avatar !== undefined ? { avatar: data.avatar?.trim() || null } : {}),
      },
      select: SAFE_SELECT,
    });

    await logAudit({
      actorId: user.id,
      action: "USER_UPDATE_PROFILE",
      entityType: "USER",
      entityId: user.id,
      summary: `${user.name} پروفایل خود را به‌روزرسانی کرد`,
      data: { fields: Object.keys(data) },
    });

    return NextResponse.json({ user: toSafeUser(updated as never) });
  } catch (e) {
    return handleApiError(e);
  }
}

