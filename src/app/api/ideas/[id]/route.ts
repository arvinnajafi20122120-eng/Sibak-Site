import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { toSafeUser } from "@/lib/types";
import {
  awardPoints,
  hasPointsBeenAwarded,
} from "@/app/api/_lib/content";

/**
 * GET /api/ideas/[id] — جزئیات + آرای رأیدهندگان + کامنت‌ها (صعودی).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const idea = await db.idea.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: true,
        group: { select: { id: true, name: true, color: true } },
        votes: {
          include: { user: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!idea) {
      return NextResponse.json({ error: "ایده یافت نشد" }, { status: 404 });
    }

    // MEMBER: ایده PENDING فقط برای نویسنده
    const isAdmin = user.role === "ADMIN" || user.role === "MANAGER";
    if (idea.status === "PENDING" && idea.authorId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "ایده یافت نشد" }, { status: 404 });
    }

    const comments = await db.comment.findMany({
      where: { entityType: "IDEA", entityId: id, deletedAt: null },
      include: { author: true },
      orderBy: { createdAt: "asc" },
    });

    const myVote = await db.ideaVote.findUnique({
      where: { ideaId_userId: { ideaId: id, userId: user.id } },
      select: { id: true },
    });

    return NextResponse.json({
      idea: {
        id: idea.id,
        title: idea.title,
        description: idea.description,
        status: idea.status,
        author: toSafeUser(idea.author),
        group: idea.group,
        groupId: idea.groupId,
        createdAt: idea.createdAt.toISOString(),
        updatedAt: idea.updatedAt.toISOString(),
      },
      voters: idea.votes.map((v) => ({
        id: v.id,
        user: toSafeUser(v.user),
        createdAt: v.createdAt.toISOString(),
      })),
      votesCount: idea.votes.length,
      myVote: !!myVote,
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        author: toSafeUser(c.author),
        createdAt: c.createdAt.toISOString(),
      })),
      commentsCount: comments.length,
      canManage: isAdmin,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const updateIdeaSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(8).max(2000).optional(),
  status: z
    .enum(["PENDING", "APPROVED", "IN_PROGRESS", "DONE", "REJECTED"])
    .optional(),
  note: z.string().trim().max(500).optional(),
  groupId: z.string().trim().nullable().optional(),
});

/**
 * PATCH /api/ideas/[id]
 * - نویسنده (PENDING): فقط title/description
 * - ADMIN/MANAGER: تغییر وضعیت + note + groupId
 * - در تغییر وضعیت: audit IDEA_STATUS_CHANGE + notify author + نقاط idempotent
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data = updateIdeaSchema.parse(body);

    const idea = await db.idea.findFirst({
      where: { id, deletedAt: null },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!idea) {
      return NextResponse.json({ error: "ایده یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN" || user.role === "MANAGER";
    const isAuthor = idea.authorId === user.id;

    const updateData: Record<string, unknown> = {};
    let statusChanged = false;
    let oldStatus: string | null = null;
    let newStatus: string | null = null;

    // نویسنده فقط هنگام PENDING می‌تواند ویرایش کند
    if (data.title !== undefined || data.description !== undefined) {
      if (!isAuthor) {
        return NextResponse.json(
          { error: "فقط نویسنده می‌تواند متن ایده را ویرایش کند" },
          { status: 403 },
        );
      }
      if (idea.status !== "PENDING" && !isAdmin) {
        return NextResponse.json(
          { error: "بعد از شروع بررسی، فقط ادمین/مدیر می‌تواند ایده را ویرایش کند" },
          { status: 403 },
        );
      }
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
    }

    // تغییر وضعیت فقط برای ADMIN/MANAGER
    if (data.status !== undefined && data.status !== idea.status) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: "تغییر وضعیت فقط توسط ادمین/مدیر مجاز است" },
          { status: 403 },
        );
      }
      updateData.status = data.status;
      statusChanged = true;
      oldStatus = idea.status;
      newStatus = data.status;
    }

    if (data.groupId !== undefined && isAdmin) {
      if (data.groupId === null) {
        updateData.groupId = null;
      } else {
        const g = await db.group.findFirst({
          where: { id: data.groupId, deletedAt: null },
          select: { id: true },
        });
        if (!g) {
          return NextResponse.json({ error: "گروه انتخاب‌شده یافت نشد" }, { status: 404 });
        }
        updateData.groupId = data.groupId;
      }
    } else if (data.groupId !== undefined && !isAdmin) {
      return NextResponse.json(
        { error: "تغییر گروه ایده فقط توسط ادمین/مدیر مجاز است" },
        { status: 403 },
      );
    }

    const updated = await db.idea.update({
      where: { id },
      data: updateData,
      include: {
        author: true,
        group: { select: { id: true, name: true, color: true } },
      },
    });

    // مدیریت تغییر وضعیت: audit + notify + نقاط idempotent
    if (statusChanged && newStatus && oldStatus) {
      await logAudit({
        actorId: user.id,
        action: "IDEA_STATUS_CHANGE",
        entityType: "IDEA",
        entityId: id,
        summary: `وضعیت ایده «${idea.title}» از ${oldStatus} به ${newStatus} تغییر کرد`,
        data: { from: oldStatus, to: newStatus, note: data.note ?? null },
      });

      const STATUS_LABELS: Record<string, string> = {
        PENDING: "در انتظار بررسی",
        APPROVED: "تاییدشده",
        IN_PROGRESS: "در حال اجرا",
        DONE: "انجام‌شده",
        REJECTED: "ردشده",
      };

      let message = `وضعیت ایده شما «${idea.title}» به ${STATUS_LABELS[newStatus]} تغییر کرد.`;
      if (data.note) message += ` یادداشت: ${data.note}`;
      await notifyUser(idea.author.id, {
        title: "به‌روزرسانی وضعیت ایده",
        message,
        type: "IDEA",
        link: `#/ideas`,
      });

      // اعطای امتیاز idempotent — فقط هنگام انتقال به APPROVED (+5) یا DONE (+15)
      const reasonApproved = `IDEA_APPROVED:${id}`;
      const reasonDone = `IDEA_DONE:${id}`;
      if (newStatus === "APPROVED" && oldStatus !== "APPROVED") {
        if (!(await hasPointsBeenAwarded(idea.author.id, reasonApproved))) {
          await awardPoints(idea.author.id, 5, reasonApproved, user.id);
        }
      }
      if (newStatus === "DONE" && oldStatus !== "DONE") {
        if (!(await hasPointsBeenAwarded(idea.author.id, reasonDone))) {
          await awardPoints(idea.author.id, 15, reasonDone, user.id);
        }
      }
    }

    return NextResponse.json({
      idea: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        status: updated.status,
        author: toSafeUser(updated.author),
        group: updated.group,
        groupId: updated.groupId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/ideas/[id] — نویسنده خودش یا ADMIN. soft delete.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;

    const idea = await db.idea.findFirst({
      where: { id, deletedAt: null },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!idea) {
      return NextResponse.json({ error: "ایده یافت نشد" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (idea.authorId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: "شما اجازه حذف این ایده را ندارید" },
        { status: 403 },
      );
    }

    await db.idea.update({ where: { id }, data: { deletedAt: new Date() } });

    await logAudit({
      actorId: user.id,
      action: "IDEA_DELETE",
      entityType: "IDEA",
      entityId: id,
      summary: `ایده «${idea.title}» حذف شد`,
      data: { byAdmin: isAdmin, authorId: idea.authorId },
    });

    // اگر ادمین حذف کرده، به نویسنده اطلاع بده
    if (isAdmin && idea.author.id !== user.id) {
      await notifyUser(idea.author.id, {
        title: "ایده شما حذف شد",
        message: `ایده «${idea.title}» توسط ادمین حذف شد.`,
        type: "IDEA",
        link: `#/ideas`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
