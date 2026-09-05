import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";

/**
 * GET /api/groups/[id] — جزئیات گروه + اعضا + ایده‌ها + رویدادها.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const group = await db.group.findFirst({
      where: { id, deletedAt: null },
      include: {
        leader: true,
        members: {
          include: { user: true },
          orderBy: { joinedAt: "asc" },
        },
        events: { where: { deletedAt: null }, orderBy: { date: "asc" } },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    // ایده‌های گروه — برای MEMBER: PENDING فقط اگر نویسنده خودش باشد
    const isAdmin = user.role === "ADMIN" || user.role === "MANAGER";
    const isLeaderOrAdmin = group.leaderId === user.id || isAdmin;
    const ideasRaw = await db.idea.findMany({
      where: {
        groupId: id,
        deletedAt: null,
        ...(isAdmin
          ? {}
          : isLeaderOrAdmin
            ? {}
            : {
                OR: [
                  { status: { not: "PENDING" } },
                  { authorId: user.id },
                ],
              }),
      },
      include: {
        author: true,
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // myVote برای هر ایده
    const votesForUser = await db.ideaVote.findMany({
      where: { ideaId: { in: ideasRaw.map((i) => i.id) }, userId: user.id },
      select: { ideaId: true },
    });
    const myVoteSet = new Set(votesForUser.map((v) => v.ideaId));

    // commentsCount برای هر ایده
    const commentCounts = await db.comment.groupBy({
      by: ["entityId"],
      where: {
        entityType: "IDEA",
        entityId: { in: ideasRaw.map((i) => i.id) },
        deletedAt: null,
      },
      _count: true,
    });
    const commentCountMap = new Map(commentCounts.map((c) => [c.entityId, c._count]));

    const ideas = ideasRaw.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      status: i.status,
      author: toSafeUser(i.author),
      groupId: i.groupId,
      votesCount: i._count.votes,
      commentsCount: commentCountMap.get(i.id) ?? 0,
      myVote: myVoteSet.has(i.id),
      createdAt: i.createdAt.toISOString(),
    }));

    const myMembership = group.members.find((m) => m.userId === user.id) ?? null;
    const memberCount = group.members.filter((m) => m.status === "ACTIVE").length;

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        color: group.color,
        icon: group.icon,
        joinPolicy: group.joinPolicy,
        createdAt: group.createdAt.toISOString(),
        leader: group.leader ? toSafeUser(group.leader) : null,
        memberCount,
        myMembership: myMembership ? myMembership.status : null,
        canManage: isLeaderOrAdmin,
      },
      members: group.members.map((m) => ({
        id: m.id,
        status: m.status,
        joinedAt: m.joinedAt.toISOString(),
        user: toSafeUser(m.user),
      })),
      ideas,
      events: group.events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        date: e.date.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        groupId: e.groupId,
        createdById: e.createdById,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const updateGroupSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  color: z.enum(["emerald", "rose", "amber", "teal", "orange"]).optional(),
  icon: z.string().trim().max(60).optional(),
  joinPolicy: z.enum(["OPEN", "REQUEST", "INVITE"]).optional(),
  leaderId: z.string().trim().optional(),
});

/**
 * PATCH /api/groups/[id] — رهبر یا ADMIN.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = updateGroupSchema.parse(body);

    const group = await db.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (group.leaderId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "فقط رهبر گروه یا ادمین می‌تواند ویرایش کند" }, { status: 403 });
    }

    // اگر leaderId در حال تغییر است
    let newLeaderId = group.leaderId;
    if (data.leaderId && data.leaderId !== group.leaderId) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "تغییر رهبر فقط توسط ادمین ممکن است" },
          { status: 403 },
        );
      }
      const target = await db.user.findFirst({
        where: { id: data.leaderId, deletedAt: null, status: "ACTIVE" },
        select: { id: true, name: true },
      });
      if (!target) {
        return NextResponse.json({ error: "کاربر انتخاب‌شده یافت نشد" }, { status: 404 });
      }
      newLeaderId = target.id;
      // اطمینان از عضویت ACTIVE کاربر جدید
      await db.groupMember.upsert({
        where: { groupId_userId: { groupId: id, userId: target.id } },
        update: { status: "ACTIVE" },
        create: { groupId: id, userId: target.id, status: "ACTIVE" },
      });
    }

    const updated = await db.group.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.color ? { color: data.color } : {}),
        ...(data.icon ? { icon: data.icon } : {}),
        ...(data.joinPolicy ? { joinPolicy: data.joinPolicy } : {}),
        ...(newLeaderId !== group.leaderId ? { leaderId: newLeaderId } : {}),
      },
    });

    await logAudit({
      actorId: user.id,
      action: "GROUP_UPDATE",
      entityType: "GROUP",
      entityId: id,
      summary: `گروه «${updated.name}» ویرایش شد`,
      data: { fields: Object.keys(data) },
    });

    return NextResponse.json({
      group: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        color: updated.color,
        icon: updated.icon,
        joinPolicy: updated.joinPolicy,
        leaderId: updated.leaderId,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/groups/[id] — فقط ADMIN (soft delete).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser(["ADMIN"]);
    const { id } = await params;

    const group = await db.group.findFirst({ where: { id, deletedAt: null } });
    if (!group) {
      return NextResponse.json({ error: "گروه یافت نشد" }, { status: 404 });
    }

    await db.group.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      actorId: user.id,
      action: "GROUP_DELETE",
      entityType: "GROUP",
      entityId: id,
      summary: `گروه «${group.name}» حذف شد`,
    });

    // اطلاع به رهبر (اگر خودش نیست)
    if (group.leaderId && group.leaderId !== user.id) {
      await notifyUser(group.leaderId, {
        title: "گروه شما حذف شد",
        message: `ادمین گروه «${group.name}» را حذف کرد.`,
        type: "GROUP",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
