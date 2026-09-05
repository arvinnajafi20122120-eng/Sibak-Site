import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { toSafeUser } from "@/lib/types";
import { relativeTime } from "@/lib/jalali";

import {
  ADMIN_SAFE_SELECT,
  toAuditDTO,
  type AdminCounts,
} from "../_lib/dto";

/**
 * GET /api/admin/overview — نگاهی فشرده به وضعیت سایت.
 * شامل: counts، کاربران در انتظار، audit اخیر، درخواست عضویت گروه‌های PENDING.
 */
export async function GET() {
  try {
    const { user } = await requireUser(["ADMIN"]);

    const [
      usersTotal,
      usersActive,
      usersPending,
      usersRejected,
      usersSuspended,
      guestsCount,
      groups,
      ideasPending,
      ideasTotal,
      pollsOpen,
      debtsOpen,
      announcements,
      vetoesGrantedTotal,
      recentPendingRaw,
      recentAuditRaw,
      pendingGroupRequests,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
      db.user.count({ where: { status: "PENDING", deletedAt: null } }),
      db.user.count({ where: { status: "REJECTED", deletedAt: null } }),
      db.user.count({ where: { status: "SUSPENDED", deletedAt: null } }),
      db.user.count({ where: { role: "GUEST", deletedAt: null } }),
      db.group.count({ where: { deletedAt: null } }),
      db.idea.count({ where: { status: "PENDING", deletedAt: null } }),
      db.idea.count({ where: { deletedAt: null } }),
      db.poll.count({ where: { status: "OPEN", deletedAt: null } }),
      db.debt.count({
        where: {
          deletedAt: null,
          status: { in: ["OPEN", "SETTLE_PENDING", "DISPUTED"] },
        },
      }),
      db.announcement.count({ where: { deletedAt: null } }),
      db.vetoLedger.aggregate({
        _sum: { delta: true },
        where: { delta: { gt: 0 } },
      }),
      db.user.findMany({
        where: { status: "PENDING", deletedAt: null },
        select: ADMIN_SAFE_SELECT,
        orderBy: { createdAt: "asc" },
        take: 8,
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      db.groupMember.findMany({
        where: { status: "PENDING" },
        include: {
          user: { select: ADMIN_SAFE_SELECT },
          group: { select: { id: true, name: true, color: true, leaderId: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 12,
      }),
    ]);

    const counts: AdminCounts = {
      usersTotal,
      usersActive,
      usersPending,
      usersRejected,
      usersSuspended,
      guestsCount,
      groups,
      ideasPending,
      ideasTotal,
      pollsOpen,
      debtsOpen,
      announcements,
      vetoesGrantedTotal: vetoesGrantedTotal._sum.delta ?? 0,
    };

    const recentPending = recentPendingRaw.map((u) => toSafeUser(u as never));
    const recentAudit = await Promise.all(recentAuditRaw.map(toAuditDTO));

    const pendingJoinRequests = pendingGroupRequests.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      groupName: m.group.name,
      groupColor: m.group.color,
      leaderId: m.group.leaderId,
      user: toSafeUser(m.user as never),
      createdAt: m.createdAt.toISOString(),
      relative: relativeTime(m.createdAt),
    }));

    void user;

    return NextResponse.json({
      counts,
      recentPending,
      recentAudit,
      pendingJoinRequests,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
