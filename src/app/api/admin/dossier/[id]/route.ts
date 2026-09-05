import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";
import {
  formatJalaliDate,
  relativeTime,
} from "@/lib/jalali";

import {
  ADMIN_FULL_SELECT,
  sixJalaliMonths,
  toAuditDTO,
} from "../../_lib/dto";

/**
 * GET /api/admin/dossier/[id]
 * پرونده کامل کاربر — شامل محتوای حذف‌شده، نمودارها، تاریخچه ممیزی.
 * این مفصل‌ترین خروجی پنل ادمین است.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    void user;
    const { id } = await params;

    const target = await db.user.findUnique({
      where: { id },
      select: ADMIN_FULL_SELECT,
    });
    if (!target) {
      return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const buckets = sixJalaliMonths();
    const since = buckets[0]!.start;

    const [
      ideasAll,
      ideasDeleted,
      pollsAll,
      pollsDeleted,
      debtsAll,
      events,
      announcements,
      comments,
      groupMemberships,
      pointLogs,
      vetoLedger,
      vetoAgg,
      badgesEarned,
      auditHistory,
    ] = await Promise.all([
      db.idea.findMany({
        where: { authorId: id },
        orderBy: { createdAt: "desc" },
      }),
      db.idea.findMany({
        where: { authorId: id, NOT: { deletedAt: null } },
        select: { id: true, title: true, status: true, deletedAt: true, createdAt: true },
      }),
      db.poll.findMany({
        where: { createdById: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          createdAt: true,
          deletedAt: true,
          closesAt: true,
        },
      }),
      db.poll.findMany({
        where: { createdById: id, NOT: { deletedAt: null } },
        select: { id: true, title: true, status: true, deletedAt: true },
      }),
      db.debt.findMany({
        where: { OR: [{ debtorId: id }, { creditorId: id }] },
        orderBy: { createdAt: "desc" },
        include: {
          debtor: { select: ADMIN_FULL_SELECT },
          creditor: { select: ADMIN_FULL_SELECT },
          events: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              type: true,
              note: true,
              createdAt: true,
              actorId: true,
            },
          },
        },
      }),
      db.calendarEvent.findMany({
        where: { createdById: id },
        orderBy: { date: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          deletedAt: true,
          groupId: true,
        },
      }),
      db.announcement.findMany({
        where: { createdById: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          level: true,
          pinned: true,
          audience: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      db.comment.findMany({
        where: { authorId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          deletedAt: true,
        },
      }),
      db.groupMember.findMany({
        where: { userId: id },
        include: {
          group: {
            select: { id: true, name: true, color: true, deletedAt: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      }),
      db.pointLog.findMany({
        where: { userId: id, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        select: { delta: true, reason: true, createdAt: true, actorId: true },
      }),
      db.vetoLedger.findMany({
        where: { userId: id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          delta: true,
          reason: true,
          balanceAfter: true,
          createdAt: true,
          sourcePollId: true,
        },
      }),
      db.vetoLedger.aggregate({
        _sum: { delta: true },
        where: { userId: id },
      }),
      db.badge.findMany({
        include: {
          users: {
            where: { userId: id },
            select: { id: true, awardedAt: true, awardedById: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      db.auditLog.findMany({
        where: { actorId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    // سری امتیاز ۶ ماه
    const pointsSeries = buckets.map((b) => {
      let sum = 0;
      for (const p of pointLogs) {
        if (p.createdAt >= b.start && p.createdAt < b.end) sum += p.delta;
      }
      return { month: b.label, delta: sum };
    });

    // سری نمودار وتو (دلتا انباشته از ابتدا تا پایان هر ماه)
    let vetoRunning = 0;
    const vetoSeriesByMonth = buckets.map((b) => {
      let grants = 0;
      let uses = 0;
      for (const v of vetoLedger) {
        if (v.createdAt >= b.start && v.createdAt < b.end) {
          if (v.delta > 0) grants += v.delta;
          else if (v.delta < 0) uses += Math.abs(v.delta);
        }
      }
      vetoRunning += grants - uses;
      return { month: b.label, grants, uses, balance: vetoRunning };
    });

    // سری زمانی بدهی ۶ ماه — بر اساس createdAt
    const ACTIVE = new Set(["OPEN", "SETTLE_PENDING", "DISPUTED"]);
    const debtChart = buckets.map((b) => {
      let iOwe = 0;
      let owedToMe = 0;
      for (const d of debtsAll) {
        if (d.createdAt >= b.start && d.createdAt < b.end) {
          if (ACTIVE.has(d.status)) {
            if (d.debtorId === id) iOwe += d.amount;
            if (d.creditorId === id) owedToMe += d.amount;
          }
        }
      }
      return { month: b.label, iOwe, owedToMe, net: owedToMe - iOwe };
    });

    // بدهی‌های حذف‌شده در debtsInvolving شامل شوند
    const debtsInvolving = debtsAll.map((d) => ({
      id: d.id,
      title: d.title,
      amount: d.amount,
      status: d.status,
      visibility: d.visibility,
      createdAt: d.createdAt.toISOString(),
      deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      debtor: toSafeUser(d.debtor as never),
      creditor: toSafeUser(d.creditor as never),
      myRole: (d.debtorId === id ? "debtor" : "creditor") as "debtor" | "creditor",
      eventsCount: d.events.length,
    }));

    const auditHistoryDTO = await Promise.all(auditHistory.map(toAuditDTO));

    // وضعیت/نقش history از auditlog
    const statusHistory = auditHistoryDTO
      .filter(
        (a) =>
          a.action === "USER_APPROVE" ||
          a.action === "USER_REJECT" ||
          a.action === "USER_SUSPEND" ||
          a.action === "USER_ACTIVATE" ||
          a.action === "USER_ROLE_CHANGE" ||
          a.action === "USER_STATUS_CHANGE" ||
          a.action === "USER_DELETE" ||
          a.action === "USER_RESTORE",
      )
      .map((a) => ({
        id: a.id,
        action: a.action,
        summary: a.summary,
        data: a.data,
        relative: a.relative,
        dateFa: a.dateFa,
        createdAt: a.createdAt,
      }));

    const safeUser = {
      ...toSafeUser(target as never),
      deletedAt: target.deletedAt ? target.deletedAt.toISOString() : null,
    };

    // خلاصه محتوای حذف‌شده — همه می‌آیند تا در «محتوای این کاربر» نمایش داده شوند
    const deletedContent = {
      ideas: ideasAll.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        groupId: i.groupId,
        createdAt: i.createdAt.toISOString(),
        deletedAt: i.deletedAt ? i.deletedAt.toISOString() : null,
      })),
      polls: pollsAll.map((p) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
        closesAt: p.closesAt ? p.closesAt.toISOString() : null,
      })),
      debts: debtsInvolving,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        date: e.date.toISOString(),
        groupId: e.groupId,
        deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        level: a.level,
        pinned: a.pinned,
        audience: a.audience,
        createdAt: a.createdAt.toISOString(),
        deletedAt: a.deletedAt ? a.deletedAt.toISOString() : null,
      })),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        entityType: c.entityType,
        entityId: c.entityId,
        createdAt: c.createdAt.toISOString(),
        deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
      })),
      ideasDeletedCount: ideasDeleted.length,
      pollsDeletedCount: pollsDeleted.length,
    };

    const badges = badgesEarned
      .filter((b) => b.users.length > 0)
      .map((b) => ({
        id: b.id,
        key: b.key,
        name: b.name,
        description: b.description,
        icon: b.icon,
        color: b.color,
        awardedAt: b.users[0]!.awardedAt.toISOString(),
        awardedById: b.users[0]!.awardedById ?? null,
      }));

    const counts = {
      ideasTotal: ideasAll.length,
      ideasDeleted: ideasDeleted.length,
      pollsTotal: pollsAll.length,
      pollsDeleted: pollsDeleted.length,
      debtsTotal: debtsAll.length,
      debtsDeleted: debtsAll.filter((d) => d.deletedAt).length,
      eventsTotal: events.length,
      eventsDeleted: events.filter((e) => e.deletedAt).length,
      announcementsTotal: announcements.length,
      announcementsDeleted: announcements.filter((a) => a.deletedAt).length,
      commentsTotal: comments.length,
      commentsDeleted: comments.filter((c) => c.deletedAt).length,
      groupMemberships: groupMemberships.length,
      auditActions: auditHistoryDTO.length,
    };

    const memberships = groupMemberships.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      groupName: m.group.name,
      groupColor: m.group.color,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
      groupDeleted: !!m.group.deletedAt,
    }));

    return NextResponse.json({
      user: safeUser,
      counts,
      pointsSeries,
      vetoSeries: vetoSeriesByMonth,
      vetoBalance: vetoAgg._sum.delta ?? 0,
      vetoLedger: vetoLedger.map((v) => ({
        id: v.id,
        delta: v.delta,
        reason: v.reason,
        balanceAfter: v.balanceAfter,
        sourcePollId: v.sourcePollId,
        createdAt: v.createdAt.toISOString(),
        dateFa: formatJalaliDate(v.createdAt),
        relative: relativeTime(v.createdAt),
      })),
      debtsInvolving,
      debtChart,
      badges,
      auditHistory: auditHistoryDTO,
      statusHistory,
      deletedContent,
      memberships,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
