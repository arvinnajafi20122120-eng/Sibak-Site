import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";
import { JALALI_MONTHS, toFa, toJalali, jalaliToGregorian } from "@/lib/jalali";

/**
 * GET /api/leaderboard?period=all|month
 * ۲۰ کاربر برتر (ACTIVE، حذف‌نشده) بر اساس امتیاز.
 * - period=all → user.points
 * - period=month → SUM(PointLog.delta) در ۳۰ روز گذشته به‌عنوان monthlyPoints
 *
 * خروجی: { users: [{ rank, points, monthlyPoints, badgesCount, ideasCount, user: SafeUser }],
 *           me: { rank, points, monthlyPoints } | null }
 */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser();
    const sp = req.nextUrl.searchParams;
    const period = sp.get("period") === "month" ? "month" : "all";

    const usersRaw = await db.user.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: {
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
      },
    });

    let monthlyMap: Map<string, number> | null = null;
    if (period === "month") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const logs = await db.pointLog.findMany({
        where: { createdAt: { gte: since } },
        select: { userId: true, delta: true },
      });
      monthlyMap = new Map<string, number>();
      for (const l of logs) {
        monthlyMap.set(l.userId, (monthlyMap.get(l.userId) ?? 0) + l.delta);
      }
    }

    const ids = usersRaw.map((u) => u.id);
    const [badgeCounts, ideaCounts] = await Promise.all([
      db.userBadge.groupBy({
        by: ["userId"],
        where: { userId: { in: ids } },
        _count: true,
      }),
      db.idea.groupBy({
        by: ["authorId"],
        where: { authorId: { in: ids }, deletedAt: null },
        _count: true,
      }),
    ]);
    const badgeMap = new Map(badgeCounts.map((b) => [b.userId, b._count] as const));
    const ideaMap = new Map(ideaCounts.map((b) => [b.authorId, b._count] as const));

    const ranked = usersRaw
      .map((u) => {
        const monthlyPoints = monthlyMap?.get(u.id) ?? 0;
        return {
          user: toSafeUser(u),
          points: period === "month" ? monthlyPoints : u.points,
          monthlyPoints,
          badgesCount: badgeMap.get(u.id) ?? 0,
          ideasCount: ideaMap.get(u.id) ?? 0,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.monthlyPoints !== a.monthlyPoints) return b.monthlyPoints - a.monthlyPoints;
        return a.user.name.localeCompare(b.user.name, "fa");
      })
      .slice(0, 20)
      .map((row, i) => ({ ...row, rank: i + 1 }));

    // موقعیت من — حتی اگر در ۲۰ نفر برتر نباشد
    let me: { rank: number; points: number; monthlyPoints: number } | null = null;
    if (period === "month") {
      // برای رتبه ماه، باید همه را رتبه‌بندی کنیم
      const allRanked = usersRaw
        .map((u) => ({
          id: u.id,
          pts: monthlyMap?.get(u.id) ?? 0,
        }))
        .sort((a, b) => b.pts - a.pts);
      const idx = allRanked.findIndex((r) => r.id === user.id);
      if (idx >= 0) {
        me = { rank: idx + 1, points: allRanked[idx].pts, monthlyPoints: allRanked[idx].pts };
      }
    } else {
      const allRanked = usersRaw
        .map((u) => ({ id: u.id, pts: u.points, m: monthlyMap?.get(u.id) ?? 0 }))
        .sort((a, b) => b.pts - a.pts);
      const idx = allRanked.findIndex((r) => r.id === user.id);
      if (idx >= 0) {
        me = { rank: idx + 1, points: allRanked[idx].pts, monthlyPoints: allRanked[idx].m };
      }
    }

    return NextResponse.json({ users: ranked, me });
  } catch (e) {
    return handleApiError(e);
  }
}

// جلوگیری از unused warnings
void JALALI_MONTHS;
void toFa;
void toJalali;
void jalaliToGregorian;
