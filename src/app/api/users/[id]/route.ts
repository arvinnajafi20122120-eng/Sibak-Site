import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";
import { relativeTime, formatJalaliDate } from "@/lib/jalali";

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

/**
 * GET /api/users/[id]
 * پروفایل عمومی یک کاربر — برای همه ACTIVE ها قابل‌مشاهده است.
 * اطلاعات خصوصی بدهی نشان داده نمی‌شود — فقط آمار کلان (ideasCount, badgesCount, ...).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const target = await db.user.findUnique({
      where: { id },
      select: SAFE_SELECT,
    });
    if (!target || target.status !== "ACTIVE") {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const [badgesCount, ideasCount, pollsCount, auditLogs, badges, medals] = await Promise.all([
      db.userBadge.count({ where: { userId: id } }),
      db.idea.count({ where: { authorId: id, deletedAt: null } }),
      db.poll.count({ where: { createdById: id, deletedAt: null } }),
      db.auditLog.findMany({
        where: { actorId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.badge.findMany({
        include: {
          users: { where: { userId: id }, select: { id: true, awardedAt: true } },
        },
        orderBy: { name: "asc" },
      }),
      db.userMedal.findMany({
        where: { userId: id, medal: { deletedAt: null } },
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

    return NextResponse.json({
      user: toSafeUser(target as never),
      stats: {
        badgesCount,
        medalsCount: medals.length,
        ideasCount,
        pollsCount,
        points: target.points,
      },
      badges: badgesDTO,
      medals: medalsDTO,
      activity,
      isMe: user.id === id,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
